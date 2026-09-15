/**
 * @fileoverview IP geolocation helpers.
 *
 * Two entry points:
 * - {@link detectVpnAndLocation} resolves a stored session IP (used to label
 *   the session list in Settings → Account).
 * - {@link resolveClientLocation} resolves the *current* request's location so
 *   Settings can show which city the app thinks you are in. It prefers the
 *   edge headers the host already attaches (Cloudflare / Vercel), and only
 *   falls back to an ipapi.co lookup when those are absent.
 */
import isVpnModule from 'is-vpn';

interface IpGeolocationData {
  city?: string;
  state?: string;
  isVpn: boolean;
}

export interface ClientLocation {
  /** The IP the lookup was performed against, or null when undetectable. */
  ip: string | null;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  /** Where the answer came from — useful when nothing resolved. */
  source: 'edge' | 'ipapi' | 'none';
}

const isVpn = isVpnModule as any;

export async function detectVpnAndLocation(
  ipAddress: string | null | undefined
): Promise<IpGeolocationData> {
  if (!ipAddress) {
    return { city: undefined, state: undefined, isVpn: false };
  }

  try {
    const [vpnCheck, locationData] = await Promise.all([
      isVpn.check(ipAddress).catch(() => false),
      fetch(`https://ipapi.co/${ipAddress}/json/`)
        .then((res) => res.json())
        .catch(() => ({ city: undefined })),
    ]);

    return {
      city: locationData?.city || undefined,
      // ipapi.co returns the full state/region name in `region`
      state: locationData?.region || undefined,
      isVpn: vpnCheck === true,
    };
  } catch (error) {
    console.error('Failed to detect VPN/location:', error);
    return { city: undefined, state: undefined, isVpn: false };
  }
}

/** Loopback / RFC1918 / link-local / CGNAT ranges, which never geolocate. */
const PRIVATE_IP =
  /^(::1|::ffff:127\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fc|fd|fe80:)/i;

/**
 * Extracts the caller's IP from proxy headers. Mirrors the resolution order
 * used by the chat handler: `x-forwarded-for` (leftmost hop) → `x-real-ip` →
 * `cf-connecting-ip`. Private and loopback addresses resolve to null, since a
 * geolocation lookup on them is guaranteed to be useless.
 */
export function getClientIp(headers: Headers): string | null {
  const candidate =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('cf-connecting-ip')?.trim() ||
    '';

  if (!candidate || PRIVATE_IP.test(candidate)) return null;
  return candidate;
}

/** Vercel percent-encodes the city header ("San%20Francisco"). */
const decodeHeader = (value: string | null): string | undefined => {
  if (!value) return undefined;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded || undefined;
  } catch {
    return value.trim() || undefined;
  }
};

const toCoordinate = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Reads the geo headers Cloudflare and Vercel attach at the edge. Returns null
 * when neither platform supplied a city, so the caller can fall back to an
 * outbound lookup.
 */
export function locationFromEdgeHeaders(
  headers: Headers
): Omit<ClientLocation, 'ip' | 'source'> | null {
  const city =
    decodeHeader(headers.get('cf-ipcity')) ??
    decodeHeader(headers.get('x-vercel-ip-city'));
  if (!city) return null;

  return {
    city,
    region:
      decodeHeader(headers.get('cf-region')) ??
      decodeHeader(headers.get('x-vercel-ip-country-region')),
    // Both platforms only expose the two-letter code, never a country name.
    countryCode:
      decodeHeader(headers.get('cf-ipcountry')) ??
      decodeHeader(headers.get('x-vercel-ip-country')),
    timezone:
      decodeHeader(headers.get('cf-timezone')) ??
      decodeHeader(headers.get('x-vercel-ip-timezone')),
    latitude:
      toCoordinate(headers.get('cf-iplatitude')) ??
      toCoordinate(headers.get('x-vercel-ip-latitude')),
    longitude:
      toCoordinate(headers.get('cf-iplongitude')) ??
      toCoordinate(headers.get('x-vercel-ip-longitude')),
  };
}

/** Looks a public IP up against ipapi.co. Never throws. */
export async function lookupIpLocation(
  ip: string
): Promise<Omit<ClientLocation, 'ip' | 'source'> | null> {
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const data: any = await res.json();
    if (!data || data.error || !data.city) return null;

    return {
      city: data.city,
      region: data.region || undefined,
      country: data.country_name || undefined,
      countryCode: data.country_code || undefined,
      timezone: data.timezone || undefined,
      latitude: toCoordinate(data.latitude != null ? String(data.latitude) : null),
      longitude: toCoordinate(data.longitude != null ? String(data.longitude) : null),
    };
  } catch (error) {
    console.error('Failed to look up IP location:', error);
    return null;
  }
}

/**
 * Resolves the city (and surrounding context) for the current request. Edge
 * headers win because they cost nothing; ipapi.co is the fallback for local
 * dev and self-hosted deployments.
 */
export async function resolveClientLocation(
  headers: Headers
): Promise<ClientLocation> {
  const ip = getClientIp(headers);

  const fromEdge = locationFromEdgeHeaders(headers);
  if (fromEdge) return { ip, ...fromEdge, source: 'edge' };

  if (!ip) return { ip: null, source: 'none' };

  const fromApi = await lookupIpLocation(ip);
  if (!fromApi) return { ip, source: 'none' };

  return { ip, ...fromApi, source: 'ipapi' };
}
