import type { TemperatureUnit, WindSpeedUnit } from '../types';

/**
 * Open-Meteo answers in whatever units the query asked for, but the fallback
 * providers each have their own fixed ones (met.no reports Celsius and m/s,
 * wttr.in reports both Celsius and Fahrenheit alongside km/h and mph). These
 * helpers bring every provider onto the units the caller asked for, so a
 * failover is invisible in the rendered widget.
 */

/** Celsius -> the requested temperature unit. */
export function fromCelsius(value: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? value * 1.8 + 32 : value;
}

const FROM_METRES_PER_SECOND: Record<WindSpeedUnit, number> = {
  kmh: 3.6,
  mph: 2.236_936,
  ms: 1,
  kn: 1.943_844,
};

/** Metres per second -> the requested wind speed unit. */
export function fromMetresPerSecond(value: number, unit: WindSpeedUnit): number {
  return value * FROM_METRES_PER_SECOND[unit];
}

/** Kilometres per hour -> the requested wind speed unit. */
export function fromKilometresPerHour(value: number, unit: WindSpeedUnit): number {
  return fromMetresPerSecond(value / 3.6, unit);
}

/** Round to one decimal, the precision Open-Meteo itself reports. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
