import type { WeatherLocation } from '../types';
import { normalizeCoordinates, normalizeTimezone } from '../lib/validate';
import { grabJson, type GrabJsonOptions } from './http';

/**
 * IP geolocation, over a chain of upstreams.
 *
 * Every free IP lookup rate-limits (ipapi.co allows 1,000 requests/day and
 * answers a 200 carrying `{ error: true, reason: 'RateLimited' }` past that),
 * and a geo worker can drop a request while it cold-starts. Worse, a lookup
 * can "succeed" with no coordinates in the body -- which used to become
 * `latitude=NaN` in the forecast URL and surface as
 * `Weather request failed: 400 Bad Request`.
 *
 * So each provider is retried, a payload without usable coordinates counts as
 * a failure, and the next provider in the chain gets a turn.
 */

/** default=2 Tries per provider before moving to the next one. */
const DEFAULT_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
/** Geolocation is on the critical path of the first render, so it waits less than a forecast. */
const DEFAULT_TIMEOUT_SECONDS = 8;

/** One IP geolocation upstream. */
export type GeoProvider = {
  id: string;
  /** Used in the thrown message, e.g. `ipapi.co lookup`. */
  label: string;
  /** Full URL for the lookup; `ip` is the address to look up, if any. */
  url: (ip?: string) => string;
  /** Map the body onto a location, or return `null` if it carries none. */
  parse: (body: Record<string, any>) => Partial<WeatherLocation> | null;
};

export type GeolocationOptions = {
  /** default=2 How many times each provider is tried before the next one is used. */
  attempts?: number;
  /** default=500 Milliseconds before a retry; each further wait doubles. */
  retryDelay?: number;
  /** default=8 Seconds before a single lookup is aborted. */
  timeout?: number;
  /** Providers to try, by id or as objects. Omit for {@link DEFAULT_GEO_PROVIDERS}. */
  providers?: (string | GeoProvider)[];
  /** Used when every provider failed, instead of throwing. */
  fallbackLocation?: Partial<WeatherLocation> | null;
  /** Called for each provider that failed, before the next one is tried. */
  onProviderError?: (info: { provider: string; error: Error }) => void;
};

export const ipapiProvider: GeoProvider = {
  id: 'ipapi',
  label: 'ipapi.co lookup',
  url: (ip) => `https://ipapi.co/${ip ? `${encodeURIComponent(ip)}/` : ''}json/`,
  parse: (data) => ({
    city: data.city,
    region: data.region,
    country: data.country_name,
    timezone: data.timezone,
    latitude: data.latitude,
    longitude: data.longitude,
  }),
};

export const ipwhoProvider: GeoProvider = {
  id: 'ipwho',
  label: 'ipwho.is lookup',
  url: (ip) => `https://ipwho.is/${ip ? encodeURIComponent(ip) : ''}`,
  parse: (data) => {
    // ipwho.is reports a failure as a 200 with `success: false`.
    if (data.success === false) return null;
    return {
      city: data.city,
      region: data.region,
      country: data.country,
      timezone: data.timezone?.id ?? data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
    };
  },
};

export const geojsProvider: GeoProvider = {
  id: 'geojs',
  label: 'geojs.io lookup',
  url: (ip) =>
    ip
      ? `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`
      : 'https://get.geojs.io/v1/ip/geo.json',
  parse: (data) => {
    const body = Array.isArray(data) ? data[0] : data;
    if (!body) return null;
    return {
      city: body.city,
      region: body.region,
      country: body.country,
      timezone: body.timezone,
      latitude: body.latitude,
      longitude: body.longitude,
    };
  },
};

export const freeipapiProvider: GeoProvider = {
  id: 'freeipapi',
  label: 'freeipapi.com lookup',
  url: (ip) => `https://freeipapi.com/api/json${ip ? `/${encodeURIComponent(ip)}` : ''}`,
  parse: (data) => ({
    city: data.cityName,
    region: data.regionName,
    country: data.countryName,
    timezone: data.timeZone,
    latitude: data.latitude,
    longitude: data.longitude,
  }),
};

/** Tried in order; each is a different operator, so a rate limit on one is not a rate limit on all. */
export const DEFAULT_GEO_PROVIDERS: GeoProvider[] = [
  ipapiProvider,
  ipwhoProvider,
  geojsProvider,
  freeipapiProvider,
];

const BY_ID = new Map(DEFAULT_GEO_PROVIDERS.map((provider) => [provider.id, provider]));

/** The bundled Cloudflare worker, wrapped as a provider so it joins the same chain. */
export function createWorkerGeoProvider(geoEndpoint: string): GeoProvider {
  return {
    id: 'worker',
    label: 'Geolocation worker lookup',
    url: (ip) => (ip ? `${geoEndpoint}?ip=${encodeURIComponent(ip)}` : geoEndpoint),
    parse: (data) => ({
      city: data.city,
      region: data.region,
      country: data.country,
      timezone: data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
    }),
  };
}

export function resolveGeoProviders(
  providers?: (string | GeoProvider)[],
  geoEndpoint?: string
): GeoProvider[] {
  const configured = providers
    ?.map((provider) => (typeof provider === 'string' ? BY_ID.get(provider) : provider))
    .filter((provider): provider is GeoProvider => Boolean(provider));

  const chain = configured && configured.length > 0 ? configured : DEFAULT_GEO_PROVIDERS;

  // A deployed worker is both faster and not rate-limited, so it goes first.
  return geoEndpoint ? [createWorkerGeoProvider(geoEndpoint), ...chain] : chain;
}

/** A provider's body, only if it carries coordinates that can go in a URL. */
function toLocation(provider: GeoProvider, body: Record<string, any>): WeatherLocation | null {
  const parsed = provider.parse(body);
  if (!parsed) return null;

  const coordinates = normalizeCoordinates(parsed.latitude, parsed.longitude);
  if (!coordinates) return null;

  return {
    city: parsed.city,
    region: parsed.region,
    country: parsed.country,
    timezone: normalizeTimezone(parsed.timezone),
    ...coordinates,
  };
}

/**
 * Resolve the caller's location from a deployed geo worker or from one of the
 * public IP lookups.
 *
 * Each provider is retried with a growing delay, then the chain moves on; only
 * if all of them fail (and no `fallbackLocation` was given) does an error
 * reach the caller, listing what every provider said.
 *
 * @param geoEndpoint URL of a deployed geo worker; it is tried before the public providers.
 * @param ip Look up this IP instead of the caller's own.
 * @param options Retry, timeout, provider chain and fallback settings.
 */
export async function getClientLocation(
  geoEndpoint?: string,
  ip?: string,
  options: GeolocationOptions = {}
): Promise<WeatherLocation> {
  const providers = resolveGeoProviders(options.providers, geoEndpoint);
  const transport: GrabJsonOptions = {
    attempts: Math.max(1, Math.trunc(options.attempts ?? DEFAULT_ATTEMPTS)),
    retryDelay: Math.max(0, options.retryDelay ?? DEFAULT_RETRY_DELAY_MS),
    timeout: options.timeout ?? DEFAULT_TIMEOUT_SECONDS,
  };

  const failures: Error[] = [];

  for (const provider of providers) {
    try {
      const body = await grabJson<Record<string, any>>(provider.url(ip), provider.label, transport);
      const location = toLocation(provider, body);
      if (location) return location;

      throw new Error(`${provider.label} failed: no coordinates in the response`);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      failures.push(failure);
      options.onProviderError?.({ provider: provider.id, error: failure });
    }
  }

  const fallback = options.fallbackLocation
    ? normalizeCoordinates(options.fallbackLocation.latitude, options.fallbackLocation.longitude)
    : null;
  if (fallback && options.fallbackLocation) {
    return {
      ...options.fallbackLocation,
      timezone: normalizeTimezone(options.fallbackLocation.timezone),
      ...fallback,
    };
  }

  if (failures.length === 1) throw failures[0];
  throw new Error(`Geolocation lookup failed: ${failures.map((error) => error.message).join('; ')}`);
}
