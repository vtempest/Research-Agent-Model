import type { WeatherLocation } from '../types';
import {
  readCachedLocation,
  writeCachedLocation,
  LOCATION_TTL_MS as DEFAULT_CACHE_TTL_MS,
} from '../lib/cache';
import { normalizeCoordinates, normalizeTimezone } from '../lib/validate';
import { grabJson, type GrabJsonOptions } from './http';

/**
 * IP geolocation, over a chain of upstreams.
 *
 * Every free IP lookup rate-limits (ipwho.is and ipapi.co both allow 1,000
 * requests/day, and ipapi.co answers a 200 carrying
 * `{ error: true, reason: 'RateLimited' }` past that), and a geo worker can
 * drop a request while it cold-starts. Worse, a lookup can "succeed" with no
 * coordinates in the body -- which used to become `latitude=NaN` in the
 * forecast URL and surface as `Weather request failed: 400 Bad Request`.
 *
 * So each provider is retried, a payload without usable coordinates counts as
 * a failure, and the next provider in the chain gets a turn.
 *
 * The quota is the reason for the cache below rather than a detail of it.
 * A browser request spends a quota shared by everyone on the domain, so a
 * widget that re-resolves the location on every forecast refresh (or on every
 * tab, or every remount) exhausts 1,000 requests without needing many users,
 * and then answers `429` for the rest of the day. A resolved location is
 * therefore stored for 12 hours and reused: an IP moves far less often than
 * the weather at it changes.
 */

/** default=2 Tries per provider before moving to the next one. */
const DEFAULT_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
/** Geolocation is on the critical path of the first render, so it waits less than a forecast. */
const DEFAULT_TIMEOUT_SECONDS = 8;

/** One IP geolocation upstream. */
export type GeoProvider = {
  id: string;
  /** Used in the thrown message, e.g. `ipwho.is lookup`. */
  label: string;
  /** Full URL for the lookup; `ip` is the address to look up, if any. */
  url?: (ip?: string) => string;
  /** Map the body onto a location, or return `null` if it carries none. */
  parse?: (body: Record<string, any>) => Partial<WeatherLocation> | null;
  /**
   * Answer without an HTTP request at all, for a source that is not a URL --
   * {@link browserProvider} asks the device. Used instead of `url`/`parse`.
   */
  resolve?: (
    ip: string | undefined,
    options: { timeout: number }
  ) => Promise<Partial<WeatherLocation> | null>;
};

export type GeolocationOptions = {
  /** default=2 How many times each provider is tried before the next one is used. */
  attempts?: number;
  /**
   * default=true Reuse a location resolved in the last 12 hours instead of
   * spending a lookup. The single most effective thing against a `429`.
   */
  cache?: boolean;
  /** default=43200000 Milliseconds a cached location stays usable. */
  cacheTtl?: number;
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

/**
 * Default primary.
 *
 * `rate=1` asks ipwho.is to report the quota it has left alongside the
 * location, which is what makes an approaching limit visible before it is a
 * `429`. It is a free, no-key, CORS-enabled endpoint, so it works from the
 * browser without a proxy of any kind.
 */
export const ipwhoProvider: GeoProvider = {
  id: 'ipwho',
  label: 'ipwho.is lookup',
  url: (ip) => `https://ipwho.is/${ip ? encodeURIComponent(ip) : ''}?rate=1`,
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

/**
 * The device's own geolocation, which costs no quota and is far more precise
 * than any IP lookup -- but only after the user has granted permission, and
 * the request is what raises the browser's permission prompt.
 *
 * Deliberately **not** in {@link DEFAULT_GEO_PROVIDERS}: a weather widget
 * should not make the page ask for the user's location the moment it renders.
 * Put `'browser'` at the front of `geoProviders` in a place where asking is
 * expected, and the IP lookups stay behind it as the answer for everyone who
 * declines.
 */
export const browserProvider: GeoProvider = {
  id: 'browser',
  label: 'Browser geolocation',
  resolve: (ip, { timeout }) =>
    new Promise((resolve, reject) => {
      // An explicit `ip` is a question about an address, not about this
      // device; the device cannot answer it, so the chain moves on.
      if (ip) return reject(new Error('Browser geolocation cannot look up another IP'));
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        return reject(new Error('Browser geolocation is unavailable'));
      }

      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            // The device knows where it is, not what that place is called;
            // the zone it is in is the one the runtime is set to.
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        (error) => reject(new Error(error.message || 'Browser geolocation was refused')),
        { timeout: timeout * 1000, maximumAge: DEFAULT_CACHE_TTL_MS }
      );
    }),
};

/**
 * Tried in order; each is a different operator, so a rate limit on one is not
 * a rate limit on all.
 *
 * ipwho.is leads because ipapi.co is the stricter of the two in practice: it
 * counts a browser request against a quota shared by the whole domain and then
 * spends the rest of the day answering `RateLimited` as a 200, which is the
 * failure this chain was built around in the first place.
 */
export const DEFAULT_GEO_PROVIDERS: GeoProvider[] = [
  ipwhoProvider,
  ipapiProvider,
  geojsProvider,
  freeipapiProvider,
];

const BY_ID = new Map(
  [...DEFAULT_GEO_PROVIDERS, browserProvider].map((provider) => [provider.id, provider])
);

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

/** A provider's answer, only if it carries coordinates that can go in a URL. */
function toLocation(parsed: Partial<WeatherLocation> | null): WeatherLocation | null {
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
 * The key a resolved location is stored under.
 *
 * A lookup of an explicit `ip`, a lookup through a worker and a lookup of the
 * caller's own address are different questions, so each keeps its own answer
 * rather than serving one for another.
 */
export function locationCacheKey(geoEndpoint?: string, ip?: string): string {
  return `v1|${geoEndpoint ?? 'public'}|${ip ?? 'self'}`;
}

/** One provider's HTTP lookup, fetched and mapped onto a partial location. */
async function resolveOverHttp(
  provider: GeoProvider,
  ip: string | undefined,
  transport: GrabJsonOptions
): Promise<Partial<WeatherLocation> | null> {
  if (!provider.url || !provider.parse) {
    throw new Error(`${provider.label} failed: provider has no url or resolve`);
  }

  const body = await grabJson<Record<string, any>>(provider.url(ip), provider.label, transport);
  return provider.parse(body);
}

/**
 * Resolve the caller's location from a deployed geo worker or from one of the
 * public IP lookups.
 *
 * A location resolved in the last 12 hours is reused as-is and costs no
 * request at all -- see the note at the top of this file for why that is the
 * difference between a widget that works and one that answers `429` from
 * mid-afternoon onwards. Pass `cache: false` to force a fresh lookup.
 *
 * Otherwise each provider is retried with a growing delay, then the chain
 * moves on; only if all of them fail (and no `fallbackLocation` was given)
 * does an error reach the caller, listing what every provider said.
 *
 * @param geoEndpoint URL of a deployed geo worker; it is tried before the public providers.
 * @param ip Look up this IP instead of the caller's own.
 * @param options Cache, retry, timeout, provider chain and fallback settings.
 */
export async function getClientLocation(
  geoEndpoint?: string,
  ip?: string,
  options: GeolocationOptions = {}
): Promise<WeatherLocation> {
  const cacheKey = locationCacheKey(geoEndpoint, ip);
  const useCache = options.cache !== false;

  if (useCache) {
    // Re-validated rather than trusted: the entry was written by an older
    // version of this package, or edited by hand, as easily as by the code
    // above.
    const cached = toLocation(readCachedLocation<WeatherLocation>(cacheKey, options.cacheTtl));
    if (cached) return cached;
  }

  const providers = resolveGeoProviders(options.providers, geoEndpoint);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_SECONDS;
  const transport: GrabJsonOptions = {
    attempts: Math.max(1, Math.trunc(options.attempts ?? DEFAULT_ATTEMPTS)),
    retryDelay: Math.max(0, options.retryDelay ?? DEFAULT_RETRY_DELAY_MS),
    timeout,
  };

  const failures: Error[] = [];

  for (const [index, provider] of providers.entries()) {
    const isLast = index === providers.length - 1;
    try {
      const parsed = provider.resolve
        ? await provider.resolve(ip, { timeout })
        : await resolveOverHttp(provider, ip, {
            ...transport,
            // A provider that has spent its daily quota will spend the retry
            // saying so again. Move on to the next operator instead -- unless
            // this is the last one, which has nowhere to move on to.
            retryRateLimits: isLast,
          });

      const location = toLocation(parsed);
      if (location) {
        if (useCache) writeCachedLocation(cacheKey, location);
        return location;
      }

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
