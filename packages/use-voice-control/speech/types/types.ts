/**
 * @fileoverview Type definitions for text-to-speech providers
 */

export type TTSProvider = "kokoro" | "deepgram";

export interface TTSOptions {
  text: string;
  provider?: TTSProvider;
  voice?: string;
}

export interface TTSResult {
  audio: ArrayBuffer;
  contentType: string;
}

// Kokoro voices from the model. The `a`/`b` prefix is the accent (American /
// British English) and the `f`/`m` that follows it is the voice's gender, which
// is how `describeKokoroVoice` derives a listing without a second catalog.
export const KOKORO_VOICES = [
  "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica",
  "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
  "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
  "am_michael", "am_onyx", "am_puck", "am_santa",
  "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
  "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
] as const;

export type KokoroVoice = (typeof KOKORO_VOICES)[number];

export interface KokoroVoiceDescription {
  id: string;
  /** Display name, e.g. `Heart` for `af_heart`. */
  name: string;
  /** `American English` or `British English`. */
  accent: string;
  gender: "Female" | "Male";
}

/**
 * Describes a voice from its id, so listings (`--list-voices`, a voice picker)
 * do not need a hand-maintained table that can drift from `KOKORO_VOICES`.
 */
export function describeKokoroVoice(id: string): KokoroVoiceDescription {
  const [accentCode, genderCode] = id;
  const suffix = id.slice(3) || id;

  return {
    id,
    name: suffix.charAt(0).toUpperCase() + suffix.slice(1),
    accent: accentCode === "b" ? "British English" : "American English",
    gender: genderCode === "m" ? "Male" : "Female",
  };
}

// Deepgram Aura speakers
export const DEEPGRAM_SPEAKERS = [
  "angus", "asteria", "arcas", "orion", "orpheus", "athena",
  "luna", "zeus", "perseus", "helios", "hera", "stella",
] as const;

export type DeepgramSpeaker = (typeof DEEPGRAM_SPEAKERS)[number];
