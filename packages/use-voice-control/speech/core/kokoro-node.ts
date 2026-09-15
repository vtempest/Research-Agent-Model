/**
 * @fileoverview Kokoro TTS running locally on Node (or Bun/Deno) via `kokoro-js`.
 *
 * This is the engine behind `generateSpeech({ provider: "kokoro" })` on a server
 * and behind the `use-voice-control` CLI. The model runs on the CPU through
 * onnxruntime, so nothing is sent to a third-party service; the first call
 * downloads the weights (~90 MB at the default `q8`) into the Hugging Face cache
 * and every later call reuses the instance held in this module.
 *
 * Kokoro's context is a few hundred phonemes, so anything longer than a
 * paragraph has to be synthesized in pieces. `synthesizeSamples` chunks on
 * sentence and paragraph boundaries with `splitTextSmart`, runs the chunks in
 * order, and joins the audio with a short silence at each seam.
 */
import type { TTSResult } from "../types/types";
import { splitTextSmart } from "../utils/semantic-split.js";
import { concatSamples, encodeWav } from "../utils/wav";

export type KokoroDtype = "fp32" | "fp16" | "q8" | "q4" | "q4f16";
export type KokoroDevice = "wasm" | "webgpu" | "cpu";

export interface KokoroNodeOptions {
  /** Voice id, e.g. `af_heart`. Default `af_heart`. */
  voice?: string;
  /** Speaking rate; 1 is the model's natural pace. Default 1. */
  speed?: number;
  /** Hugging Face model id. Default `onnx-community/Kokoro-82M-v1.0-ONNX`. */
  model?: string;
  /** Weight quantization. `q8` (default) is the best size/quality trade on CPU. */
  dtype?: KokoroDtype;
  /** Execution device. Default `cpu`. */
  device?: KokoroDevice;
  /**
   * Target chunk size in characters. Kokoro's context is limited, so long text
   * is split before synthesis; 400 leaves headroom for phoneme expansion.
   */
  maxChunkLength?: number;
  /** Silence inserted between chunks, in milliseconds. Default 120. */
  gapMs?: number;
  /** Model download/loading progress, forwarded from transformers.js. */
  onModelProgress?: (progress: unknown) => void;
  /** Called before each chunk is synthesized, for CLI progress output. */
  onChunk?: (info: { index: number; total: number; text: string }) => void;
}

export interface KokoroAudio {
  samples: Float32Array;
  sampleRate: number;
}

const DEFAULT_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const DEFAULT_VOICE = "af_heart";
const DEFAULT_DTYPE: KokoroDtype = "q8";
const DEFAULT_DEVICE: KokoroDevice = "cpu";
const DEFAULT_MAX_CHUNK = 400;
const DEFAULT_GAP_MS = 120;

/** One loaded model per model/dtype/device combination, keyed by those three. */
const instances = new Map<string, Promise<any>>();

/** True on Node, Bun and Deno — anywhere `kokoro-js` can load onnxruntime-node. */
function isServerRuntime(): boolean {
  const g = globalThis as any;
  return Boolean(g.process?.versions?.node || g.Bun || g.Deno);
}

/**
 * Loads (and caches) a `kokoro-js` instance.
 *
 * `kokoro-js` is an optional dependency: a browser-only consumer should not have
 * to download onnxruntime-node, so a missing install is reported as an
 * actionable error rather than a module-resolution stack trace.
 */
export async function loadKokoroTTS(options: KokoroNodeOptions = {}): Promise<any> {
  const model = options.model ?? DEFAULT_MODEL;
  const dtype = options.dtype ?? DEFAULT_DTYPE;
  const device = options.device ?? (isServerRuntime() ? DEFAULT_DEVICE : "wasm");
  const key = `${model}|${dtype}|${device}`;

  const cached = instances.get(key);
  if (cached) return cached;

  const loading = (async () => {
    let KokoroTTS: any;
    try {
      // Kept in a variable so bundlers treat this as an optional runtime
      // dependency rather than something to resolve at build time.
      const specifier = "kokoro-js";
      ({ KokoroTTS } = await import(/* @vite-ignore */ specifier));
    } catch (error) {
      throw new Error(
        "Local Kokoro speech needs the optional `kokoro-js` package. " +
          "Install it with `npm install kokoro-js`. " +
          `(import failed: ${error instanceof Error ? error.message : String(error)})`
      );
    }

    return KokoroTTS.from_pretrained(model, {
      dtype,
      device,
      progress_callback: options.onModelProgress,
    });
  })();

  instances.set(key, loading);

  try {
    return await loading;
  } catch (error) {
    // A failed download must not poison every later attempt.
    instances.delete(key);
    throw error;
  }
}

/** Drops cached model instances. Mainly useful in tests and long-lived workers. */
export function resetKokoroCache(): void {
  instances.clear();
}

/**
 * Synthesizes `text` to raw samples, chunking anything longer than the model's
 * comfortable context.
 */
export async function synthesizeSamples(
  text: string,
  options: KokoroNodeOptions = {}
): Promise<KokoroAudio> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) throw new Error("Text is required");

  const chunks = splitTextSmart(trimmed, options.maxChunkLength ?? DEFAULT_MAX_CHUNK)
    .map((chunk: string) => chunk.trim())
    .filter((chunk: string) => chunk.length > 0);

  const tts = await loadKokoroTTS(options);
  const voice = options.voice ?? DEFAULT_VOICE;
  const speed = options.speed ?? 1;

  const rendered: Float32Array[] = [];
  let sampleRate = 24000;

  for (let index = 0; index < chunks.length; index += 1) {
    options.onChunk?.({ index, total: chunks.length, text: chunks[index] });
    const audio = await tts.generate(chunks[index], { voice, speed });
    rendered.push(audio.audio);
    sampleRate = audio.sampling_rate ?? sampleRate;
  }

  const gapMs = options.gapMs ?? DEFAULT_GAP_MS;
  return {
    samples: concatSamples(rendered, Math.round((gapMs / 1000) * sampleRate)),
    sampleRate,
  };
}

/** Synthesizes `text` and encodes it as a 16-bit PCM WAV file. */
export async function synthesizeWav(
  text: string,
  options: KokoroNodeOptions = {}
): Promise<TTSResult> {
  const { samples, sampleRate } = await synthesizeSamples(text, options);
  return { audio: encodeWav(samples, sampleRate), contentType: "audio/wav" };
}
