const CACHE_PREFIX = 'weather-forecast-cache:';
const CACHE_TTL_MS = 30 * 60 * 1000;
/** How long a cached forecast may still be served after every provider failed. */
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

/** Keys holding a resolved location rather than a forecast. */
const LOCATION_PREFIX = 'location:';
/**
 * default=12h How long a resolved IP location is reused.
 *
 * Far longer than the forecast's own 30 minutes, and deliberately so: the
 * weather at a place changes through the day, the place the caller is looking
 * at from one IP does not. Every free IP lookup bills per request against a
 * daily quota (1,000/day on ipwho.is and ipapi.co, shared by everyone on the
 * domain for a browser call), so re-resolving the location on each forecast
 * refresh is what exhausts it and answers `429 Too Many Requests` for the rest
 * of the day.
 */
export const LOCATION_TTL_MS = 12 * 60 * 60 * 1000;

type CacheEntry<T> = {
  timestamp: number;
  data: T;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

/** The stored entry for `key`, however old, or `null` if there is none. */
function readEntry<T>(key: string): CacheEntry<T> | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

/** Returns the cached value for `key` if it was written within the last 30 minutes. */
export function readCachedForecast<T>(key: string): T | null {
  const entry = readEntry<T>(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;

  return entry.data;
}

/**
 * Returns the cached value for `key` regardless of its age, up to a day old.
 *
 * The last resort when every weather provider failed: an hour-old forecast is
 * a better widget than `Error: Weather request failed`. Kept apart from
 * {@link readCachedForecast} so a served-stale answer is always a deliberate
 * choice by the caller.
 */
export function readStaleForecast<T>(key: string, maxAgeMs = STALE_TTL_MS): T | null {
  const entry = readEntry<T>(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > maxAgeMs) {
    const storage = getStorage();
    storage?.removeItem(CACHE_PREFIX + key);
    return null;
  }

  return entry.data;
}

export function writeCachedForecast<T>(key: string, data: T): void {
  writeEntry(key, data);
}

function writeEntry<T>(key: string, data: T): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const entry: CacheEntry<T> = { timestamp: Date.now(), data };
    storage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — safe to ignore,
    // the next call will simply hit the network again.
  }
}

/**
 * The location last resolved for `scope`, if it was resolved within
 * {@link LOCATION_TTL_MS}.
 *
 * `scope` distinguishes the lookups that answer different things -- the
 * caller's own address, an explicit `ip`, a deployed geo worker -- so one
 * never serves another's answer.
 */
export function readCachedLocation<T>(scope: string, maxAgeMs = LOCATION_TTL_MS): T | null {
  const key = LOCATION_PREFIX + scope;
  const entry = readEntry<T>(key);
  if (!entry) return null;

  // A ttl of zero is "never reuse one", not "reuse one written this millisecond".
  if (maxAgeMs <= 0 || Date.now() - entry.timestamp > maxAgeMs) {
    getStorage()?.removeItem(CACHE_PREFIX + key);
    return null;
  }

  return entry.data;
}

export function writeCachedLocation<T>(scope: string, location: T): void {
  writeEntry(LOCATION_PREFIX + scope, location);
}

/** Forgets every cached location, so the next lookup goes back to the network. */
export function clearCachedLocations(): void {
  clearByPrefix(CACHE_PREFIX + LOCATION_PREFIX);
}

/** Clears all cached forecasts and locations. Mainly useful for tests/debugging. */
export function clearWeatherForecastCache(): void {
  clearByPrefix(CACHE_PREFIX);
}

function clearByPrefix(prefix: string): void {
  const storage = getStorage();
  if (!storage) return;

  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) storage.removeItem(key);
  }
}
