import type { DailyWeather, HourlyWeather, WeatherForecastData } from '../../types';
import { getWeatherIcon } from '../../weatherCodes';
import { fromCelsius, fromMetresPerSecond, round1 } from '../../lib/units';
import { toZonedDate, toZonedIsoMinutes } from '../../lib/time';
import { grabJson } from '../http';
import type { ForecastRequest, WeatherProvider } from './types';

const ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

/**
 * met.no names conditions (`lightrainshowers_day`) where Open-Meteo uses WMO
 * codes, so the widget's icon and code mapping keeps working after a failover.
 */
const SYMBOL_TO_WMO: Record<string, number> = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,
  lightrain: 61,
  rain: 63,
  heavyrain: 65,
  lightrainshowers: 80,
  rainshowers: 81,
  heavyrainshowers: 82,
  lightsleet: 66,
  sleet: 66,
  heavysleet: 67,
  lightsleetshowers: 85,
  sleetshowers: 85,
  heavysleetshowers: 86,
  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  lightsnowshowers: 85,
  snowshowers: 85,
  heavysnowshowers: 86,
};

export function symbolToWmoCode(symbol: string | undefined): number {
  if (!symbol) return 3;
  const base = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (base.includes('thunder')) return base.startsWith('heavy') ? 96 : 95;
  return SYMBOL_TO_WMO[base] ?? 3;
}

type MetNoEntry = {
  time: string;
  data?: {
    instant?: { details?: Record<string, number> };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: Record<string, number> };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: Record<string, number> };
  };
};

type MetNoResponse = { properties?: { timeseries?: MetNoEntry[] } };

const symbolOf = (entry: MetNoEntry) =>
  entry.data?.next_1_hours?.summary?.symbol_code ?? entry.data?.next_6_hours?.summary?.symbol_code;

const precipitationOf = (entry: MetNoEntry) =>
  entry.data?.next_1_hours?.details?.precipitation_amount ??
  entry.data?.next_6_hours?.details?.precipitation_amount;

/**
 * met.no is an independent upstream (a different operator, a different model),
 * so it stays useful exactly when Open-Meteo is the thing that is down.
 *
 * It reports instants in UTC with Celsius and m/s; everything is converted to
 * the request's units and rewritten into the naive local timestamps the widget
 * renders, so a failover is invisible.
 */
export const metNoProvider: WeatherProvider = {
  id: 'met-no',
  label: 'met.no',

  async fetchForecast(request: ForecastRequest): Promise<WeatherForecastData> {
    const { latitude, longitude } = request.location;
    const url = `${ENDPOINT}?lat=${latitude}&lon=${longitude}`;
    const zone = request.timezone || request.location.timezone;

    const data = await grabJson<MetNoResponse>(url, 'Weather request', {
      ...request.transport,
      headers: {
        // met.no asks every client to identify itself; browsers refuse to set
        // this header, in which case the request simply goes out without it.
        'User-Agent': 'use-weather-forecast (https://npmjs.com/package/use-weather-forecast)',
        ...request.transport.headers,
      },
    });

    const entries = data.properties?.timeseries ?? [];
    if (entries.length === 0) throw new Error('Invalid weather response');

    const temperature = (entry: MetNoEntry) => entry.data?.instant?.details?.air_temperature;
    const toDisplayTemp = (celsius: number) => Math.round(fromCelsius(celsius, request.temperatureUnit));
    const toDisplayWind = (ms: number) => round1(fromMetresPerSecond(ms, request.windSpeedUnit));

    const first = entries[0];
    const firstTemperature = temperature(first);
    if (firstTemperature === undefined) throw new Error('Invalid weather response');

    const currentCode = symbolToWmoCode(symbolOf(first));
    const currentSymbol = symbolOf(first) ?? '';
    const isDay = currentSymbol.endsWith('_night') ? 0 : 1;
    const currentWind = first.data?.instant?.details?.wind_speed;

    const hourly: HourlyWeather[] = entries
      .filter((entry) => entry.data?.next_1_hours || entry.data?.next_6_hours)
      .slice(0, request.forecastHours)
      .map((entry) => {
        const code = symbolToWmoCode(symbolOf(entry));
        const celsius = temperature(entry);
        return {
          time: toZonedIsoMinutes(new Date(entry.time), zone),
          temperature: celsius === undefined ? Number.NaN : toDisplayTemp(celsius),
          weatherCode: code,
          precipitationProbability: entry.data?.next_1_hours?.details?.probability_of_precipitation,
          rain: precipitationOf(entry),
          icon: getWeatherIcon(code),
        };
      })
      .filter((hour) => Number.isFinite(hour.temperature));

    // met.no reports instants, not days, so the days are aggregated here: the
    // extremes of every reading that falls on the same local calendar date,
    // with the condition taken from the reading closest to local midday.
    const byDate = new Map<string, MetNoEntry[]>();
    for (const entry of entries) {
      const date = toZonedDate(new Date(entry.time), zone);
      const bucket = byDate.get(date);
      if (bucket) bucket.push(entry);
      else byDate.set(date, [entry]);
    }

    const daily: DailyWeather[] = [...byDate.entries()]
      .slice(0, request.forecastDays)
      .map(([date, dayEntries]) => {
        const temperatures = dayEntries.map(temperature).filter((value): value is number => value !== undefined);
        const winds = dayEntries
          .map((entry) => entry.data?.instant?.details?.wind_speed)
          .filter((value): value is number => value !== undefined);
        const precipitation = dayEntries
          .map(precipitationOf)
          .filter((value): value is number => value !== undefined);

        const middayEntry = dayEntries.reduce((closest, entry) => {
          const hourOf = (candidate: MetNoEntry) =>
            Math.abs(Number(toZonedIsoMinutes(new Date(candidate.time), zone).slice(11, 13)) - 12);
          return hourOf(entry) < hourOf(closest) ? entry : closest;
        }, dayEntries[0]);

        const code = symbolToWmoCode(symbolOf(middayEntry));

        return {
          date,
          min: temperatures.length ? toDisplayTemp(Math.min(...temperatures)) : Number.NaN,
          max: temperatures.length ? toDisplayTemp(Math.max(...temperatures)) : Number.NaN,
          weatherCode: code,
          precipitationSum: precipitation.length ? round1(precipitation.reduce((a, b) => a + b, 0)) : undefined,
          windSpeedMax: winds.length ? toDisplayWind(Math.max(...winds)) : undefined,
          icon: getWeatherIcon(code),
        };
      })
      .filter((day) => Number.isFinite(day.min) && Number.isFinite(day.max));

    if (hourly.length === 0 || daily.length === 0) throw new Error('Invalid weather response');

    return {
      location: { ...request.location, timezone: zone },
      current: {
        time: toZonedIsoMinutes(new Date(first.time), zone),
        temperature: toDisplayTemp(firstTemperature),
        weatherCode: currentCode,
        icon: getWeatherIcon(currentCode, isDay),
        isDay,
        rain: precipitationOf(first),
        windSpeed: currentWind === undefined ? undefined : toDisplayWind(currentWind),
      },
      hourly,
      daily,
    };
  },
};
