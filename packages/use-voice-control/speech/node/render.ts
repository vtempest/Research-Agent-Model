/**
 * @fileoverview Rendering a loaded document to an audio file on disk.
 *
 * Sits between `document.ts` (what to say) and `core/kokoro-node.ts` (how to say
 * it): resolves the output path, runs the synthesizer, and writes the WAV.
 */
import {
  synthesizeSamples,
  type KokoroAudio,
  type KokoroNodeOptions,
} from "../core/kokoro-node";
import { encodeWav, wavDurationSeconds } from "../utils/wav";
import { extensionOf, loadDocument, type LoadDocumentOptions } from "./document";

export interface RenderOptions extends LoadDocumentOptions, KokoroNodeOptions {
  /** Where to write the audio. `-` writes the WAV to stdout. */
  output?: string;
  /**
   * Replace the synthesizer. Used by the tests, and by hosts that already have a
   * model loaded and do not want a second copy.
   */
  synthesize?: (text: string, options: KokoroNodeOptions) => Promise<KokoroAudio>;
}

export interface RenderResult {
  /** Path written, or `-` when the audio went to stdout. */
  output: string;
  /** The text that was spoken, after Markdown conversion. */
  text: string;
  format: "markdown" | "text";
  source: string;
  durationSeconds: number;
  bytes: number;
}

/** `notes.md` becomes `notes.wav`, next to the original. */
export function defaultOutputPath(input: string): string {
  const extension = extensionOf(input);
  const base = extension ? input.slice(0, -extension.length) : input;
  return `${base}.wav`;
}

/**
 * Reads a document, synthesizes it, and writes a WAV file.
 *
 * Returns the spoken text alongside the file details so a caller can show what
 * was read without converting the document a second time.
 */
export async function renderDocument(options: RenderOptions): Promise<RenderResult> {
  const document = await loadDocument(options);

  if (!document.text.trim()) {
    throw new Error(`Nothing to speak: ${document.source} has no readable text`);
  }

  const synthesize = options.synthesize ?? synthesizeSamples;
  const { samples, sampleRate } = await synthesize(document.text, options);
  const audio = encodeWav(samples, sampleRate);

  const output =
    options.output ??
    (options.file && options.file !== "-" ? defaultOutputPath(options.file) : "out.wav");

  if (output === "-") {
    process.stdout.write(Buffer.from(audio));
  } else {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(output, Buffer.from(audio));
  }

  return {
    output,
    text: document.text,
    format: document.format,
    source: document.source,
    durationSeconds: wavDurationSeconds(samples, sampleRate),
    bytes: audio.byteLength,
  };
}
