import type { GrabJsonOptions } from '../http';
import type { TemperatureUnit, WeatherForecastData, WeatherLocation, WindSpeedUnit } from '../../types';

/** A forecast request after validation: every field is safe to put in a URL. */
export type ForecastRequest = {
  location: WeatherLocation;
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  /** 1-16. */
  forecastDays: number;
  /** 1-384. */
  forecastHours: number;
  /** A validated IANA zone, or `undefined` to let the provider resolve it. */
  timezone?: string;
  /** Transport and retry settings passed through to grab-url. */
  transport: GrabJsonOptions;
};

/**
 * One upstream that can answer a {@link ForecastRequest}.
 *
 * Providers are tried in order and the first one to answer wins, so each has
 * to return the same normalized shape whatever units or codes it speaks
 * natively.
 */
export type WeatherProvider = {
  /** Stable id, e.g. `open-meteo`. Used in options and in the error message. */
  id: string;
  /** Human-readable name for the aggregated error message. */
  label: string;
  fetchForecast: (request: ForecastRequest) => Promise<WeatherForecastData>;
};
