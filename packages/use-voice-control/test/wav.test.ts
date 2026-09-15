/**
 * @fileoverview Tests for the WAV encoder used by the Node/CLI path: header
 * fields, sample conversion, clamping, and joining separately synthesized chunks.
 */
import { describe, expect, it } from 'vitest';

import { concatSamples, encodeWav, wavDurationSeconds } from '../speech/utils/wav';

const ascii = (view: DataView, offset: number, length: number): string =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

describe('encodeWav', () => {
  it('writes a RIFF/WAVE header describing the audio', () => {
    const buffer = encodeWav(new Float32Array(100), 24000);
    const view = new DataView(buffer);

    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(ascii(view, 12, 4)).toBe('fmt ');
    expect(ascii(view, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
    expect(view.getUint32(28, true)).toBe(48000); // byte rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it('sizes the file as a 44-byte header plus 16-bit samples', () => {
    const buffer = encodeWav(new Float32Array(10), 24000);
    const view = new DataView(buffer);

    expect(buffer.byteLength).toBe(44 + 20);
    expect(view.getUint32(4, true)).toBe(36 + 20);
    expect(view.getUint32(40, true)).toBe(20);
  });

  it('converts float samples to signed 16-bit values', () => {
    const view = new DataView(encodeWav(Float32Array.from([0, 1, -1]), 24000));

    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });

  it('clamps overshoot instead of letting it wrap into a click', () => {
    const view = new DataView(encodeWav(Float32Array.from([1.8, -2.4]), 24000));

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });

  it('doubles the byte rate and block align for stereo', () => {
    const view = new DataView(encodeWav(new Float32Array(4), 48000, 2));

    expect(view.getUint32(28, true)).toBe(48000 * 2 * 2);
    expect(view.getUint16(32, true)).toBe(4);
  });
});

describe('concatSamples', () => {
  it('joins chunks in order', () => {
    const joined = concatSamples([Float32Array.from([1, 2]), Float32Array.from([3])]);

    expect(Array.from(joined)).toEqual([1, 2, 3]);
  });

  it('inserts silence between chunks but not around them', () => {
    const joined = concatSamples([Float32Array.from([1]), Float32Array.from([2])], 2);

    expect(Array.from(joined)).toEqual([1, 0, 0, 2]);
  });

  it('returns an empty track for no chunks', () => {
    expect(concatSamples([], 5).length).toBe(0);
  });

  it('adds no gap for a single chunk', () => {
    expect(concatSamples([Float32Array.from([1, 2])], 10).length).toBe(2);
  });
});

describe('wavDurationSeconds', () => {
  it('reports the length of the track in seconds', () => {
    expect(wavDurationSeconds(new Float32Array(48000), 24000)).toBe(2);
  });

  it('is zero rather than infinite for a missing sample rate', () => {
    expect(wavDurationSeconds(new Float32Array(10), 0)).toBe(0);
  });
});
