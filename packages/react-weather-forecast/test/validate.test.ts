import { describe, expect, it } from 'vitest';
import {
  clampInteger,
  isValidLatitude,
  isValidLongitude,
  normalizeCoordinates,
  normalizeLocation,
  normalizeTimezone,
} from '../src/lib/validate';

describe('coordinate validation', () => {
  it('accepts coordinates on the globe', () => {
    expect(isValidLatitude(30.27)).toBe(true);
    expect(isValidLongitude(-97.74)).toBe(true);
  });

  it.each([Number.NaN, undefined, null, '', 'north', 91, -91])(
    'rejects %s as a latitude',
    (value) => {
      expect(isValidLatitude(value)).toBe(false);
    }
  );

  it.each([Number.NaN, undefined, null, '', 181, -181])('rejects %s as a longitude', (value) => {
    expect(isValidLongitude(value)).toBe(false);
  });

  it('coerces string coordinates', () => {
    expect(normalizeCoordinates('30.27', '-97.74')).toEqual({ latitude: 30.27, longitude: -97.74 });
  });

  it('rounds to the precision every upstream accepts', () => {
    expect(normalizeCoordinates(30.267_153_3, -97.743_057_9)).toEqual({
      latitude: 30.2672,
      longitude: -97.7431,
    });
  });

  it('returns null when either coordinate is unusable', () => {
    // `latitude=NaN` in a forecast URL is what Open-Meteo answers 400 for.
    expect(normalizeCoordinates(Number.NaN, 12)).toBeNull();
    expect(normalizeCoordinates(12, undefined)).toBeNull();
  });

  it('normalizes a whole location, or rejects it', () => {
    expect(normalizeLocation({ city: 'Austin', latitude: 30.27, longitude: -97.74 })).toEqual({
      city: 'Austin',
      latitude: 30.27,
      longitude: -97.74,
      timezone: undefined,
    });
    expect(normalizeLocation({ city: 'Austin' })).toBeNull();
    expect(normalizeLocation(undefined)).toBeNull();
  });
});

describe('normalizeTimezone', () => {
  it('keeps an IANA zone', () => {
    expect(normalizeTimezone('Europe/Berlin')).toBe('Europe/Berlin');
  });

  it('canonicalizes a legacy alias', () => {
    expect(normalizeTimezone('US/Pacific')).toBe('America/Los_Angeles');
  });

  it.each(['', '   ', 'auto', 'Mars/Phobos', undefined, null, 42])('drops %s', (value) => {
    expect(normalizeTimezone(value)).toBeUndefined();
  });
});

describe('clampInteger', () => {
  it('keeps a value inside the range', () => {
    expect(clampInteger(7, 5, 1, 16)).toBe(7);
  });

  it('clamps a value outside the range', () => {
    expect(clampInteger(0, 5, 1, 16)).toBe(1);
    expect(clampInteger(99, 5, 1, 16)).toBe(16);
  });

  it('falls back for a value that is not a number', () => {
    expect(clampInteger('many', 5, 1, 16)).toBe(5);
    expect(clampInteger(Number.NaN, 5, 1, 16)).toBe(5);
  });

  it('truncates a fractional value', () => {
    expect(clampInteger(7.9, 5, 1, 16)).toBe(7);
  });
});
