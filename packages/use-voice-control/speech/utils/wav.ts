/**
 * @fileoverview Minimal WAV (RIFF) encoder for raw Float32 PCM.
 *
 * The browser path gets its WAV from `convertAudioBufferToWav`, which needs a Web
 * Audio `AudioBuffer`. Node has no such thing: the Kokoro model hands back a bare
 * `Float32Array`, and long documents are synthesized one chunk at a time and
 * joined before encoding. Both of those are pure buffer work, so they live here
 * with no platform dependency.
 */

/** Number of bytes in the fixed RIFF/fmt/data header this encoder writes. */
const HEADER_BYTES = 44;

/**
 * Joins per-chunk sample buffers into one contiguous track.
 *
 * @param chunks Sample buffers in playback order.
 * @param silenceSamples Samples of silence to insert between chunks, so the
 *   seams between separately synthesized chunks do not sound clipped.
 */
export function concatSamples(
  chunks: Float32Array[],
  silenceSamples = 0
): Float32Array {
  const gaps = Math.max(chunks.length - 1, 0) * Math.max(silenceSamples, 0);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + gaps;
  const out = new Float32Array(total);

  let offset = 0;
  chunks.forEach((chunk, i) => {
    out.set(chunk, offset);
    offset += chunk.length;
    if (i < chunks.length - 1) offset += Math.max(silenceSamples, 0);
  });

  return out;
}

/**
 * Encodes Float32 samples (nominally -1..1) as a 16-bit PCM WAV file.
 *
 * @param samples Interleaved samples when `channels` is greater than 1.
 * @param sampleRate Sample rate of the audio, e.g. 24000 for Kokoro.
 * @param channels Channel count. Kokoro is mono.
 */
export function encodeWav(
  samples: Float32Array,
  sampleRate = 24000,
  channels = 1
): ArrayBuffer {
  const buffer = new ArrayBuffer(HEADER_BYTES + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  const byteRate = sampleRate * channels * 2;

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i += 1) {
    // Clamp before scaling: the model occasionally overshoots 1.0 and wrapping
    // a 16-bit sample turns that into a loud click.
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(HEADER_BYTES + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

/** Duration of a Float32 track in seconds, for progress and log lines. */
export function wavDurationSeconds(samples: Float32Array, sampleRate: number): number {
  return sampleRate > 0 ? samples.length / sampleRate : 0;
}
