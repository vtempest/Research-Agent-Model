/**
 * Guards for everything that goes into a forecast URL.
 *
 * Open-Meteo answers `400 Bad Request` for a query it cannot parse, and the
 * most common way to build one is not a typo in this package but a geolocation
 * upstream that answered 200 with no coordinates in the body: `Number(undefined)`
 * becomes `NaN`, `latitude=NaN` goes out on the wire, and the widget renders
 * `Error: Weather request failed: 400 Bad Request`. Everything below fails
 * that request *before* it is sent, so the caller can fall back to another
 * geolocation provider instead.
 */

/** Open-Meteo rejects more than 4 decimals of precision from some endpoints, and met.no's terms require rounding. */
const COORDINATE_PRECISION = 4;

/** Open-Meteo accepts 0-16 forecast days. */
export const MAX_FORECAST_DAYS = 16;
/** Open-Meteo accepts up to 16 days' worth of hours. */
export const MAX_FORECAST_HOURS = 384;

export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

export function isValidLatitude(value: unknown): value is number {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed >= -90 && parsed <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed >= -180 && parsed <= 180;
}

/**
 * Coordinates rounded to the precision every upstream accepts, or `null` when
 * either of them is missing, unparseable or off the globe.
 */
export function normalizeCoordinates(
  latitude: unknown,
  longitude: unknown
): { latitude: number; longitude: number } | null {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return {
    latitude: roundCoordinate(toFiniteNumber(latitude) as number),
    longitude: roundCoordinate(toFiniteNumber(longitude) as number),
  };
}

/**
 * Anything carrying coordinates: an option object, or a body from one of the
 * geolocation providers. Kept structural so this module stays free of the
 * package's React-facing types and can be imported by the Cloudflare worker.
 */
export type CoordinateSource = {
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  [key: string]: unknown;
};

/** The same location with usable coordinates, or `null` if it has none. */
export function normalizeLocation<T extends CoordinateSource>(
  location: T | undefined
): (T & { latitude: number; longitude: number; timezone?: string }) | null {
  if (!location) return null;
  const coordinates = normalizeCoordinates(location.latitude, location.longitude);
  if (!coordinates) return null;
  return { ...location, ...coordinates, timezone: normalizeTimezone(location.timezone) };
}

/**
 * The canonical IANA name of a zone the runtime recognises, or `undefined`.
 *
 * IP geolocation providers disagree on this field (`timezone`, `timezone.id`,
 * `timeZone`, sometimes a legacy alias like `PST` or `US/Pacific`), and
 * Open-Meteo answers 400 for a zone it does not know. So an alias is
 * canonicalized to what every upstream accepts (`America/Los_Angeles`) and a
 * zone the runtime cannot resolve at all is dropped rather than sent.
 */
export function normalizeTimezone(timezone: unknown): string | undefined {
  if (typeof timezone !== 'string') return undefined;
  const trimmed = timezone.trim();
  if (!trimmed || trimmed.toLowerCase() === 'auto') return undefined;

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone || trimmed;
  } catch {
    return undefined;
  }
}

/** Whole number inside `[min, max]`, falling back to `fallback` for anything else. */
export function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
