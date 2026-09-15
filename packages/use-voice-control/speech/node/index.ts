/**
 * @fileoverview Server-side entry point: read a document, speak it to a file.
 *
 * ```ts
 * import { renderDocument } from "use-voice-control/node";
 *
 * const result = await renderDocument({ file: "README.md", output: "readme.wav" });
 * console.log(`${result.durationSeconds.toFixed(1)}s of audio`);
 * ```
 *
 * The same code backs the `use-voice-control` command, exported here as
 * `runCli` for hosts that want to wrap it.
 */
export {
  detectFormat,
  extensionOf,
  loadDocument,
  readStdinToString,
  toSpeechText,
  MARKDOWN_EXTENSIONS,
  TEXT_EXTENSIONS,
  type DocumentFormat,
  type LoadDocumentOptions,
  type LoadedDocument,
  type RequestedFormat,
} from "./document";

export {
  defaultOutputPath,
  renderDocument,
  type RenderOptions,
  type RenderResult,
} from "./render";

export {
  formatVoiceList,
  parseArgs,
  runCli,
  USAGE,
  type CliCommand,
  type CliIO,
  type CliOptions,
} from "./cli";

export {
  loadKokoroTTS,
  resetKokoroCache,
  synthesizeSamples,
  synthesizeWav,
  type KokoroAudio,
  type KokoroDevice,
  type KokoroDtype,
  type KokoroNodeOptions,
} from "../core/kokoro-node";

export {
  looksLikeMarkdown,
  markdownToSpeech,
  markdownToSpeechSegments,
  stripInlineMarkdown,
  type MarkdownToSpeechOptions,
  type SpeechSegment,
  type SpeechSegmentType,
} from "../utils/markdown-to-speech";
