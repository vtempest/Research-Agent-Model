/**
 * @fileoverview Turning a document on disk (or on stdin) into speakable text.
 *
 * A `.md` file is converted with `markdownToSpeech` so the marks become
 * structure rather than words; a `.txt` file is passed through as it is. When
 * the source has no filename — piped stdin, a `--text` string — the format is
 * guessed from the content.
 */
import {
  looksLikeMarkdown,
  markdownToSpeech,
  type MarkdownToSpeechOptions,
} from "../utils/markdown-to-speech";

export type DocumentFormat = "markdown" | "text";
/** What the caller asked for; `auto` defers to the extension, then the content. */
export type RequestedFormat = DocumentFormat | "auto";

/** Extensions read as Markdown. Everything else is treated as plain text. */
export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkd", ".mdx"];

/** Extensions the CLI accepts without complaint. Others still work, with a warning. */
export const TEXT_EXTENSIONS = [".txt", ".text", ""];

/** Lowercased extension of a path, including the dot (`""` when there is none). */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

/**
 * Decides how to read a document.
 *
 * An explicit `requested` format always wins — a `.txt` file full of Markdown is
 * still the user's call. Otherwise the extension decides, and content sniffing
 * is the last resort for input that arrived without a name.
 */
export function detectFormat(
  content: string,
  filename?: string,
  requested: RequestedFormat = "auto"
): DocumentFormat {
  if (requested !== "auto") return requested;

  if (filename) {
    const extension = extensionOf(filename);
    if (MARKDOWN_EXTENSIONS.includes(extension)) return "markdown";
    if (TEXT_EXTENSIONS.includes(extension)) return "text";
  }

  return looksLikeMarkdown(content) ? "markdown" : "text";
}

/** Converts document content to the text that should be spoken. */
export function toSpeechText(
  content: string,
  format: DocumentFormat,
  options: MarkdownToSpeechOptions = {}
): string {
  if (format === "text") {
    // Plain text is already speakable; only normalise line endings and the
    // trailing whitespace that would otherwise become an empty final chunk.
    return content.replace(/\r\n?/g, "\n").trim();
  }
  return markdownToSpeech(content, options);
}

export interface LoadedDocument {
  /** The speakable text, Markdown already converted. */
  text: string;
  /** How the content was read. */
  format: DocumentFormat;
  /** Where it came from, for log lines: a path, `stdin`, or `--text`. */
  source: string;
}

export interface LoadDocumentOptions {
  /** Path to read. Use `-` for stdin. Mutually exclusive with `text`. */
  file?: string;
  /** Literal content to speak, instead of reading a file. */
  text?: string;
  format?: RequestedFormat;
  markdown?: MarkdownToSpeechOptions;
  /** Reads stdin. Injected so the CLI tests do not need a real pipe. */
  readStdin?: () => Promise<string>;
}

/**
 * Reads a document from a path, stdin, or an inline string and returns the text
 * to synthesize.
 */
export async function loadDocument(
  options: LoadDocumentOptions
): Promise<LoadedDocument> {
  const { file, text, format = "auto", markdown = {} } = options;

  if (text !== undefined) {
    const resolved = detectFormat(text, undefined, format);
    return { text: toSpeechText(text, resolved, markdown), format: resolved, source: "--text" };
  }

  if (!file) throw new Error("No input: pass a file path, `-` for stdin, or --text");

  if (file === "-") {
    const stdin = options.readStdin
      ? await options.readStdin()
      : await readStdinToString();
    const resolved = detectFormat(stdin, undefined, format);
    return { text: toSpeechText(stdin, resolved, markdown), format: resolved, source: "stdin" };
  }

  const { readFile } = await import("node:fs/promises");
  const content = await readFile(file, "utf8");
  const resolved = detectFormat(content, file, format);
  return { text: toSpeechText(content, resolved, markdown), format: resolved, source: file };
}

/** Collects all of stdin as UTF-8 text. */
export async function readStdinToString(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
