import { grabJson } from '../src/api/http';
import { normalizeCoordinates, normalizeTimezone } from '../src/lib/validate';

export interface Env {}

type CloudflareGeo = {
  country?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  postalCode?: string;
};

type GeoResult = {
  source: string;
  ip?: string | null;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  postalCode?: string;
};

/**
 * Upstreams for an explicit `?ip=`, and for the rare request whose Cloudflare
 * geolocation carries no coordinates. They are run by different operators, so
 * one of them being rate-limited is not all of them being rate-limited.
 *
 * Requests go through `grab-url` rather than `fetch` so a cold or throttled
 * upstream is retried (with backoff) before the next one is tried.
 */
const IP_LOOKUPS: { source: string; url: (ip: string) => string; parse: (body: any) => Partial<GeoResult> }[] = [
  {
    source: 'ipapi.co',
    url: (ip) => `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
    parse: (data) => ({
      ip: data.ip,
      country: data.country_name,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      postalCode: data.postal,
    }),
  },
  {
    source: 'ipwho.is',
    url: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`,
    parse: (data) =>
      data?.success === false
        ? {}
        : {
            ip: data.ip,
            country: data.country,
            countryCode: data.country_code,
            region: data.region,
            city: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone?.id ?? data.timezone,
            postalCode: data.postal,
          },
  },
  {
    source: 'geojs.io',
    url: (ip) => `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
    parse: (data) => {
      const body = Array.isArray(data) ? data[0] : data;
      return {
        ip: body?.ip,
        country: body?.country,
        countryCode: body?.country_code,
        region: body?.region,
        city: body?.city,
        latitude: body?.latitude,
        longitude: body?.longitude,
        timezone: body?.timezone,
      };
    },
  },
];

/**
 * Look an IP up, moving to the next provider whenever one fails *or* answers
 * without usable coordinates -- an answer with `latitude: undefined` is what
 * turns into `latitude=NaN` in a forecast URL and comes back as
 * `400 Bad Request`.
 */
async function lookupIp(ip: string): Promise<GeoResult> {
  const failures: string[] = [];

  for (const provider of IP_LOOKUPS) {
    try {
      const body = await grabJson<Record<string, unknown>>(provider.url(ip), `${provider.source} lookup`, {
        attempts: 2,
        retryDelay: 250,
        timeout: 8,
      });
      const parsed = provider.parse(body);
      const coordinates = normalizeCoordinates(parsed.latitude, parsed.longitude);
      if (!coordinates) {
        failures.push(`${provider.source}: no coordinates in the response`);
        continue;
      }

      return {
        ...parsed,
        source: provider.source,
        ip: parsed.ip ?? ip,
        timezone: normalizeTimezone(parsed.timezone),
        ...coordinates,
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`IP geolocation failed: ${failures.join('; ')}`);
}

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const requestedIp = url.searchParams.get('ip');
    const clientIp = request.headers.get('CF-Connecting-IP');

    try {
      if (requestedIp) return json(await lookupIp(requestedIp));

      const cf = request.cf as CloudflareGeo | undefined;
      const coordinates = normalizeCoordinates(cf?.latitude, cf?.longitude);

      // Cloudflare's own geolocation is free and instant, but it is missing
      // for some networks. Rather than answer without coordinates, fall back
      // to the IP lookups so the caller always gets a usable location.
      if (!coordinates) {
        if (!clientIp) throw new Error('no Cloudflare geolocation and no client IP to look up');
        return json({ ...(await lookupIp(clientIp)), source: 'ip-fallback' });
      }

      return json({
        source: 'cloudflare',
        ip: clientIp,
        country: request.headers.get('CF-IPCountry') ?? undefined,
        region: cf?.region,
        city: cf?.city,
        timezone: normalizeTimezone(cf?.timezone),
        postalCode: cf?.postalCode,
        ...coordinates,
      } satisfies GeoResult);
    } catch (error) {
      // A status the client can classify: the package retries a 502, and
      // moves on to the next geolocation provider once the retries are spent.
      return json({ error: true, reason: error instanceof Error ? error.message : String(error) }, 502);
    }
  },
} satisfies ExportedHandler<Env>;
