import { metNoProvider } from './met-no';
import { openMeteoGfsProvider, openMeteoProvider } from './open-meteo';
import type { WeatherProvider } from './types';
import { wttrProvider } from './wttr';

export * from './types';
export { createOpenMeteoProvider, openMeteoProvider, openMeteoGfsProvider } from './open-meteo';
export { metNoProvider, symbolToWmoCode } from './met-no';
export { wttrProvider, wwoToWmoCode } from './wttr';

/**
 * Tried in order until one answers.
 *
 * Open-Meteo stays the primary source; its GFS endpoint covers a query the
 * default model refused or rate-limited, and met.no and wttr.in are run by
 * different operators entirely, so they still answer when Open-Meteo itself is
 * unreachable.
 */
export const DEFAULT_WEATHER_PROVIDERS: WeatherProvider[] = [
  openMeteoProvider,
  openMeteoGfsProvider,
  metNoProvider,
  wttrProvider,
];

const BY_ID = new Map(DEFAULT_WEATHER_PROVIDERS.map((provider) => [provider.id, provider]));

/**
 * Turn the `weatherProviders` option into the list to try.
 *
 * @param providers Ids (`'open-meteo'`, `'met-no'`, `'wttr'`, `'open-meteo-gfs'`)
 *   or provider objects of your own. Omit for {@link DEFAULT_WEATHER_PROVIDERS}.
 */
export function resolveWeatherProviders(
  providers?: (string | WeatherProvider)[]
): WeatherProvider[] {
  if (!providers || providers.length === 0) return DEFAULT_WEATHER_PROVIDERS;

  const resolved = providers
    .map((provider) => (typeof provider === 'string' ? BY_ID.get(provider) : provider))
    .filter((provider): provider is WeatherProvider => Boolean(provider));

  return resolved.length > 0 ? resolved : DEFAULT_WEATHER_PROVIDERS;
}
