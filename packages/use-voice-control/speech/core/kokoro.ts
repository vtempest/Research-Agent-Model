/**
 * @fileoverview Kokoro TTS provider for `generateSpeech`.
 *
 * The work happens in `kokoro-node.ts`, which runs the Kokoro model locally
 * through `kokoro-js`; this file is the thin provider adapter that validates the
 * voice and returns the package's `TTSResult` shape.
 */
import type { TTSResult } from "../types/types";
import { KOKORO_VOICES, type KokoroVoice } from "../types/types";
import { synthesizeWav, type KokoroNodeOptions } from "./kokoro-node";

/**
 * Generate speech from text using Kokoro.
 *
 * Long text is chunked and joined automatically. An unrecognised voice falls
 * back to `af_heart` rather than failing the request.
 */
export async function generateKokoroSpeech(
  text: string,
  voice: string = "af_heart",
  options: Omit<KokoroNodeOptions, "voice"> = {}
): Promise<TTSResult> {
  const kokoroVoice = KOKORO_VOICES.includes(voice as KokoroVoice)
    ? (voice as KokoroVoice)
    : "af_heart";

  return synthesizeWav(text, { ...options, voice: kokoroVoice });
}
