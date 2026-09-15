/**
 * @fileoverview The `use-voice-control` command line tool.
 *
 * Reads a Markdown or text file and speaks it to a WAV file:
 *
 * ```sh
 * npx use-voice-control README.md -o readme.wav
 * ```
 *
 * Argument parsing is a pure function (`parseArgs`) and every effect the command
 * has — writing lines, reading stdin, synthesizing — is injectable, so the whole
 * command is testable without loading a 90 MB model.
 */
import { describeKokoroVoice, KOKORO_VOICES } from "../types/types";
import type { KokoroDevice, KokoroDtype } from "../core/kokoro-node";
import type { MarkdownToSpeechOptions } from "../utils/markdown-to-speech";
import { loadDocument, type RequestedFormat } from "./document";
import { renderDocument, type RenderOptions } from "./render";

export type CliCommand = "speak" | "print" | "help" | "version" | "list-voices";

export interface CliOptions {
  command: CliCommand;
  /** Input path, or `-` for stdin. Undefined when `text` is set. */
  input?: string;
  /** Literal text passed with `--text`. */
  text?: string;
  output?: string;
  format: RequestedFormat;
  voice: string;
  speed: number;
  model?: string;
  dtype?: KokoroDtype;
  device?: KokoroDevice;
  maxChunkLength?: number;
  gapMs?: number;
  markdown: MarkdownToSpeechOptions;
  quiet: boolean;
  /** Everything wrong with the command line. Non-empty means do not run. */
  errors: string[];
}

export interface CliIO {
  /** Writes a line to stdout. */
  log?: (line: string) => void;
  /** Writes a line to stderr — progress and errors go here so `-o -` stays clean. */
  error?: (line: string) => void;
  /** Overrides synthesis, for tests. */
  synthesize?: RenderOptions["synthesize"];
  /** Overrides reading stdin, for tests. */
  readStdin?: () => Promise<string>;
  /** Whether stdin is a terminal. When false and no input is given, stdin is read. */
  stdinIsTTY?: boolean;
}

const FORMATS: Record<string, RequestedFormat> = {
  auto: "auto",
  markdown: "markdown",
  md: "markdown",
  text: "text",
  txt: "text",
  plain: "text",
};

const DTYPES: KokoroDtype[] = ["fp32", "fp16", "q8", "q4", "q4f16"];
const DEVICES: KokoroDevice[] = ["wasm", "webgpu", "cpu"];

export const USAGE = `use-voice-control — read a Markdown or text file aloud into an audio file

Usage
  npx use-voice-control <file.md|file.txt|-> [options]
  npx use-voice-control --text "Hello there" -o hello.wav
  cat notes.md | npx use-voice-control - -o notes.wav

Markdown is converted before it is spoken: "#", "**" and the rest are not read
out, headings become their own spoken lines, links keep their text, and fenced
code blocks are announced instead of being spelled out.

Input
  <file>                 File to read. Use "-" to read stdin.
  --text <string>        Speak this string instead of reading a file.
  -f, --format <fmt>     auto (default), markdown, or text.

Output
  -o, --out <file>       Audio file to write. Default: the input path with a
                         .wav extension. Use "-" to write the WAV to stdout.
  -p, --print            Print the speakable text and exit — no model, no audio.
                         Useful for checking the Markdown conversion.
  -q, --quiet            No progress output.

Voice
  -v, --voice <id>       Voice id. Default af_heart. See --list-voices.
  -s, --speed <n>        Speaking rate, 0.5-2. Default 1.
      --list-voices      Print the available voices and exit.

Markdown handling
  --headings <mode>      text (default) | announce | skip
  --code <mode>          announce (default) | read | skip
  --links <mode>         text (default) | text-and-url
  --tables <mode>        rows (default) | skip
  --front-matter         Read the YAML front matter instead of skipping it.

Model
  --model <id>           Hugging Face model id.
                         Default onnx-community/Kokoro-82M-v1.0-ONNX.
  --dtype <type>         fp32 | fp16 | q8 (default) | q4 | q4f16
  --device <device>      cpu (default) | wasm | webgpu
  --chunk <chars>        Target characters per synthesis chunk. Default 400.
  --gap <ms>             Silence between chunks. Default 120.

Other
  -h, --help             Show this help.
  -V, --version          Print the package version.

The first run downloads the Kokoro weights (about 90 MB at the default q8) into
the Hugging Face cache; later runs are offline. Speech is synthesized locally —
no text leaves the machine.`;

/** Reads the next value for a flag, recording an error when it is missing. */
function takeValue(
  argv: string[],
  index: number,
  flag: string,
  errors: string[]
): { value?: string; next: number } {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    errors.push(`${flag} needs a value`);
    return { next: index + 1 };
  }
  return { value, next: index + 1 };
}

/** Parses a numeric flag, recording an error when it is not a finite number. */
function toNumber(value: string | undefined, flag: string, errors: string[]): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    errors.push(`${flag} expects a number, got "${value}"`);
    return undefined;
  }
  return parsed;
}

/** Parses an enum flag, recording an error when the value is not in `allowed`. */
function toChoice<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  flag: string,
  errors: string[]
): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    errors.push(`${flag} expects one of ${allowed.join(", ")} — got "${value}"`);
    return undefined;
  }
  return value as T;
}

/**
 * Parses the command line. Pure: it reads nothing and writes nothing, so the
 * tests can assert on the whole option set.
 */
export function parseArgs(argv: string[]): CliOptions {
  const errors: string[] = [];
  const markdown: MarkdownToSpeechOptions = {};
  const options: CliOptions = {
    command: "speak",
    format: "auto",
    voice: "af_heart",
    speed: 1,
    markdown,
    quiet: false,
    errors,
  };

  let positionalsOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (positionalsOnly || !arg.startsWith("-") || arg === "-") {
      if (options.input !== undefined) {
        errors.push(`unexpected extra input "${arg}" — pass one file at a time`);
      } else {
        options.input = arg;
      }
      continue;
    }

    if (arg === "--") {
      positionalsOnly = true;
      continue;
    }

    // `--voice=af_bella` is the same as `--voice af_bella`.
    const equals = arg.indexOf("=");
    if (equals > 1) {
      argv.splice(i, 1, arg.slice(0, equals), arg.slice(equals + 1));
      i -= 1;
      continue;
    }

    switch (arg) {
      case "-h":
      case "--help":
        options.command = "help";
        return options;

      case "-V":
      case "--version":
        options.command = "version";
        return options;

      case "--list-voices":
        options.command = "list-voices";
        return options;

      case "-p":
      case "--print":
      case "--dry-run":
        options.command = "print";
        break;

      case "-q":
      case "--quiet":
        options.quiet = true;
        break;

      case "--front-matter":
        markdown.frontMatter = true;
        break;

      case "-o":
      case "--out":
      case "--output": {
        const { value, next } = takeValue(argv, i, arg, errors);
        options.output = value;
        i = next;
        break;
      }

      case "--text": {
        // Unlike every other value, this one may legitimately start with "-".
        const value = argv[i + 1];
        if (value === undefined) errors.push("--text needs a value");
        else options.text = value;
        i += 1;
        break;
      }

      case "-f":
      case "--format": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        if (value !== undefined) {
          const format = FORMATS[value.toLowerCase()];
          if (!format) {
            errors.push(`--format expects auto, markdown or text — got "${value}"`);
          } else {
            options.format = format;
          }
        }
        break;
      }

      case "-v":
      case "--voice": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        if (value !== undefined) {
          if (!KOKORO_VOICES.includes(value as (typeof KOKORO_VOICES)[number])) {
            errors.push(`unknown voice "${value}" — run --list-voices to see them all`);
          } else {
            options.voice = value;
          }
        }
        break;
      }

      case "-s":
      case "--speed": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        const speed = toNumber(value, arg, errors);
        if (speed !== undefined) {
          if (speed < 0.5 || speed > 2) errors.push("--speed must be between 0.5 and 2");
          else options.speed = speed;
        }
        break;
      }

      case "--model": {
        const { value, next } = takeValue(argv, i, arg, errors);
        options.model = value;
        i = next;
        break;
      }

      case "--dtype": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        options.dtype = toChoice(value, DTYPES, arg, errors) ?? options.dtype;
        break;
      }

      case "--device": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        options.device = toChoice(value, DEVICES, arg, errors) ?? options.device;
        break;
      }

      case "--chunk":
      case "--chunk-length": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        const chunk = toNumber(value, arg, errors);
        if (chunk !== undefined) {
          if (chunk < 40) errors.push("--chunk must be at least 40 characters");
          else options.maxChunkLength = chunk;
        }
        break;
      }

      case "--gap": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        const gap = toNumber(value, arg, errors);
        if (gap !== undefined) {
          if (gap < 0) errors.push("--gap cannot be negative");
          else options.gapMs = gap;
        }
        break;
      }

      case "--headings": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        markdown.headings =
          toChoice(value, ["text", "announce", "skip"] as const, arg, errors) ??
          markdown.headings;
        break;
      }

      case "--code":
      case "--code-blocks": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        markdown.codeBlocks =
          toChoice(value, ["announce", "read", "skip"] as const, arg, errors) ??
          markdown.codeBlocks;
        break;
      }

      case "--links": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        markdown.links =
          toChoice(value, ["text", "text-and-url"] as const, arg, errors) ?? markdown.links;
        break;
      }

      case "--tables": {
        const { value, next } = takeValue(argv, i, arg, errors);
        i = next;
        markdown.tables =
          toChoice(value, ["rows", "skip"] as const, arg, errors) ?? markdown.tables;
        break;
      }

      default:
        errors.push(`unknown option "${arg}" — run --help to see the options`);
    }
  }

  if (options.text !== undefined && options.input !== undefined) {
    errors.push("pass either a file or --text, not both");
  }

  return options;
}

/** The `--list-voices` table, derived from the ids so it cannot drift. */
export function formatVoiceList(): string {
  const rows = KOKORO_VOICES.map((id) => {
    const voice = describeKokoroVoice(id);
    return `  ${id.padEnd(14)}${voice.name.padEnd(12)}${voice.gender.padEnd(8)}${voice.accent}`;
  });
  return [`${KOKORO_VOICES.length} Kokoro voices:`, ...rows].join("\n");
}

/** Reads the package version, so `--version` matches what npx installed. */
async function readVersion(): Promise<string> {
  try {
    const { readFile } = await import("node:fs/promises");
    // From `dist/cli.js` the manifest is one level up; from a source checkout it
    // is two. Try both before giving up.
    for (const relative of ["../package.json", "../../package.json"]) {
      try {
        const url = new URL(relative, import.meta.url);
        const manifest = JSON.parse(await readFile(url, "utf8"));
        if (manifest?.name === "use-voice-control" && manifest.version) return manifest.version;
      } catch {
        // Try the next candidate.
      }
    }
  } catch {
    // No filesystem (bundled for a runtime without fs) — fall through.
  }
  return "unknown";
}

/**
 * Runs the command line and resolves to the process exit code.
 *
 * @param argv Arguments after the executable and script, i.e. `process.argv.slice(2)`.
 * @param io Injection points for output, stdin and synthesis.
 */
export async function runCli(argv: string[], io: CliIO = {}): Promise<number> {
  const log = io.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  const warn = io.error ?? ((line: string) => process.stderr.write(`${line}\n`));

  const options = parseArgs([...argv]);

  if (options.command === "help") {
    log(USAGE);
    return 0;
  }

  if (options.command === "version") {
    log(await readVersion());
    return 0;
  }

  if (options.command === "list-voices") {
    log(formatVoiceList());
    return 0;
  }

  if (options.errors.length > 0) {
    options.errors.forEach((message) => warn(`use-voice-control: ${message}`));
    warn("Run `npx use-voice-control --help` for usage.");
    return 1;
  }

  // With nothing named on the command line, a pipe is the intended input.
  const stdinIsTTY = io.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const input =
    options.input ?? (options.text === undefined && !stdinIsTTY ? "-" : undefined);

  if (input === undefined && options.text === undefined) {
    warn("use-voice-control: no input — pass a file, pipe text in, or use --text");
    warn("Run `npx use-voice-control --help` for usage.");
    return 1;
  }

  const shared = {
    file: input,
    text: options.text,
    format: options.format,
    markdown: options.markdown,
    readStdin: io.readStdin,
  };

  try {
    if (options.command === "print") {
      const document = await loadDocument(shared);
      log(document.text);
      return 0;
    }

    const started = Date.now();
    const result = await renderDocument({
      ...shared,
      output: options.output,
      voice: options.voice,
      speed: options.speed,
      model: options.model,
      dtype: options.dtype,
      device: options.device,
      maxChunkLength: options.maxChunkLength,
      gapMs: options.gapMs,
      synthesize: io.synthesize,
      onModelProgress: options.quiet
        ? undefined
        : (progress: any) => {
            if (progress?.status === "progress" && progress.file && progress.total) {
              const done = Math.round(((progress.loaded ?? 0) / progress.total) * 100);
              warn(`downloading ${progress.file}: ${done}%`);
            }
          },
      onChunk: options.quiet
        ? undefined
        : ({ index, total }) => warn(`speaking chunk ${index + 1}/${total}`),
    });

    if (!options.quiet) {
      const seconds = result.durationSeconds.toFixed(1);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      const target = result.output === "-" ? "stdout" : result.output;
      warn(`wrote ${target} — ${seconds}s of audio from ${result.source} in ${elapsed}s`);
    }
    return 0;
  } catch (error) {
    warn(`use-voice-control: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
