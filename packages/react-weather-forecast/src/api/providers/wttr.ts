import type { DailyWeather, HourlyWeather, WeatherForecastData } from '../../types';
import { getWeatherIcon } from '../../weatherCodes';
import { fromKilometresPerHour, round1 } from '../../lib/units';
import { toZonedIsoMinutes } from '../../lib/time';
import { grabJson } from '../http';
import type { ForecastRequest, WeatherProvider } from './types';

/**
 * wttr.in maps the World Weather Online condition codes it inherited onto the
 * WMO codes the rest of this package speaks.
 */
const WWO_TO_WMO: Record<number, number> = {
  113: 0,
  116: 2,
  119: 3,
  122: 3,
  143: 45,
  176: 80,
  179: 85,
  182: 85,
  185: 56,
  200: 95,
  227: 73,
  230: 75,
  248: 45,
  260: 48,
  263: 51,
  266: 53,
  281: 56,
  284: 57,
  293: 61,
  296: 61,
  299: 63,
  302: 63,
  305: 65,
  308: 65,
  311: 66,
  314: 67,
  317: 66,
  320: 67,
  323: 71,
  326: 71,
  329: 73,
  332: 73,
  335: 75,
  338: 75,
  350: 77,
  353: 80,
  356: 81,
  359: 82,
  362: 85,
  365: 86,
  368: 85,
  371: 86,
  374: 85,
  377: 86,
  386: 95,
  389: 95,
  392: 95,
  395: 96,
};

export function wwoToWmoCode(code: unknown): number {
  const parsed = Number(code);
  return WWO_TO_WMO[parsed] ?? 3;
}

type WttrHour = Record<string, string>;
type WttrDay = { date?: string; maxtempC?: string; maxtempF?: string; mintempC?: string; mintempF?: string; hourly?: WttrHour[] };
type WttrResponse = {
  current_condition?: Record<string, unknown>[];
  weather?: WttrDay[];
  nearest_area?: { areaName?: { value?: string }[]; region?: { value?: string }[]; country?: { value?: string }[] }[];
};

/** wttr.in reports hours as `0`, `300`, `1200`; turn that into `HH:MM`. */
function hourLabel(time: string | undefined): string {
  const minutes = Number(time ?? 0);
  const hours = Math.floor(minutes / 100);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 100).padStart(2, '0')}`;
}

/**
 * wttr.in, the second independent fallback.
 *
 * Its free endpoint needs no key and answers with the location's own local
 * times, in both Celsius and Fahrenheit, so only the wind speed has to be
 * converted. It is 3-hourly rather than hourly -- a coarser forecast, but a
 * rendered widget rather than an error message.
 */
export const wttrProvider: WeatherProvider = {
  id: 'wttr',
  label: 'wttr.in',

  async fetchForecast(request: ForecastRequest): Promise<WeatherForecastData> {
    const { latitude, longitude } = request.location;
    const url = `https://wttr.in/${latitude},${longitude}?format=j1&lang=en`;

    const data = await grabJson<WttrResponse>(url, 'Weather request', request.transport);

    const current = data.current_condition?.[0];
    const days = (data.weather ?? []).filter((day) => day.date && day.hourly?.length);
    if (!current || days.length === 0) throw new Error('Invalid weather response');

    const zone = request.timezone || request.location.timezone;
    const unit = request.temperatureUnit === 'celsius' ? 'C' : 'F';
    // The hourly rows name the field `tempC`, the current conditions `temp_C`.
    const temperatureOf = (source: Record<string, unknown>, field: string) => {
      const value = source[`${field}${unit}`] ?? source[`${field}_${unit}`];
      return Math.round(Number(value));
    };
    const windOf = (source: Record<string, unknown>) =>
      round1(fromKilometresPerHour(Number(source.windspeedKmph ?? 0), request.windSpeedUnit));

    // Open-Meteo starts the hourly series at the current hour, so wttr.in's
    // past hours are dropped to keep the widget's first column meaning "now".
    const nowLocal = toZonedIsoMinutes(new Date(), zone);
    const hourly: HourlyWeather[] = days
      .flatMap((day) =>
        (day.hourly ?? []).map((hour) => {
          const code = wwoToWmoCode(hour.weatherCode);
          return {
            time: `${day.date}T${hourLabel(hour.time)}`,
            temperature: temperatureOf(hour, 'temp'),
            weatherCode: code,
            precipitationProbability: hour.chanceofrain === undefined ? undefined : Number(hour.chanceofrain),
            rain: hour.precipMM === undefined ? undefined : Number(hour.precipMM),
            icon: getWeatherIcon(code),
          };
        })
      )
      .filter((hour) => hour.time >= nowLocal.slice(0, 13))
      .slice(0, request.forecastHours);

    const daily: DailyWeather[] = days.slice(0, request.forecastDays).map((day) => {
      const hours = day.hourly ?? [];
      const midday = hours.find((hour) => hour.time === '1200') ?? hours[Math.floor(hours.length / 2)];
      const code = wwoToWmoCode(midday?.weatherCode);
      const precipitation = hours.reduce((total, hour) => total + Number(hour.precipMM ?? 0), 0);
      const windMax = hours.reduce((peak, hour) => Math.max(peak, windOf(hour)), 0);

      return {
        date: day.date as string,
        min: temperatureOf(day as Record<string, unknown>, 'mintemp'),
        max: temperatureOf(day as Record<string, unknown>, 'maxtemp'),
        weatherCode: code,
        precipitationProbabilityMax: hours.reduce(
          (peak, hour) => Math.max(peak, Number(hour.chanceofrain ?? 0)),
          0
        ),
        precipitationSum: round1(precipitation),
        windSpeedMax: windMax,
        icon: getWeatherIcon(code),
      };
    });

    if (hourly.length === 0) throw new Error('Invalid weather response');

    const area = data.nearest_area?.[0];
    const currentCode = wwoToWmoCode(current.weatherCode);
    const isDay = nowLocal.slice(11, 13) >= '06' && nowLocal.slice(11, 13) < '19' ? 1 : 0;

    return {
      location: {
        ...request.location,
        city: request.location.city ?? area?.areaName?.[0]?.value,
        region: request.location.region ?? area?.region?.[0]?.value,
        country: request.location.country ?? area?.country?.[0]?.value,
        timezone: zone,
      },
      current: {
        time: nowLocal,
        temperature: temperatureOf(current, 'temp'),
        weatherCode: currentCode,
        icon: getWeatherIcon(currentCode, isDay),
        isDay,
        rain: current.precipMM === undefined ? undefined : Number(current.precipMM),
        windSpeed: windOf(current),
      },
      hourly,
      daily,
    };
  },
};
