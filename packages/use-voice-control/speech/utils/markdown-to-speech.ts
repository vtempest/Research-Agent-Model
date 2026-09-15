/**
 * @fileoverview Turns Markdown into text a speech synthesizer can read.
 *
 * Markdown handed straight to a TTS engine is read literally: "hash hash Getting
 * started", "star star important star star". This module parses the document
 * instead and emits only the words, keeping the *structure* the marks encoded —
 * a heading becomes its own spoken segment ending in a full stop so the
 * synthesizer pauses, a list item becomes one sentence, a fenced code block is
 * announced rather than spelled out.
 *
 * It is deliberately dependency-free and runs in the browser as well as Node, so
 * `ReadAloudController` and the CLI can share it.
 */

/** Kind of block the converter recognised. */
export type SpeechSegmentType =
  | "heading"
  | "paragraph"
  | "list-item"
  | "quote"
  | "code"
  | "table-row";

export interface SpeechSegment {
  type: SpeechSegmentType;
  /** Spoken text of the block, with every Markdown mark already removed. */
  text: string;
  /** Heading level 1-6. Only set on `heading` segments. */
  level?: number;
}

export interface MarkdownToSpeechOptions {
  /**
   * How headings are spoken. `text` (default) reads the heading words on their
   * own so they land between pauses; `announce` prefixes them with "Heading:";
   * `skip` drops them entirely.
   */
  headings?: "text" | "announce" | "skip";
  /**
   * What to do with fenced code blocks. `announce` (default) replaces the block
   * with a short spoken note, `read` reads the code verbatim, `skip` drops it.
   */
  codeBlocks?: "announce" | "read" | "skip";
  /** `text` (default) speaks the link text and drops the URL; `text-and-url` reads both. */
  links?: "text" | "text-and-url";
  /** `alt` (default) speaks the image's alt text; `skip` drops images. */
  images?: "alt" | "skip";
  /** Read the YAML front matter block. Off by default. */
  frontMatter?: boolean;
  /** `rows` (default) reads table rows as comma-separated cells; `skip` drops tables. */
  tables?: "rows" | "skip";
  /**
   * Append a full stop to blocks that do not end in punctuation, so the
   * synthesizer pauses between them instead of running them together.
   * Default true.
   */
  addTerminalPunctuation?: boolean;
}

type ResolvedOptions = Required<MarkdownToSpeechOptions>;

const DEFAULTS: ResolvedOptions = {
  headings: "text",
  codeBlocks: "announce",
  links: "text",
  images: "alt",
  frontMatter: false,
  tables: "rows",
  addTerminalPunctuation: true,
};

/** Spoken names for code fence languages that would otherwise be read as letters. */
const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shell: "shell",
  console: "shell",
  yml: "YAML",
  yaml: "YAML",
  md: "Markdown",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  go: "Go",
  java: "Java",
  c: "C",
  cpp: "C plus plus",
  cs: "C sharp",
  php: "PHP",
  swift: "Swift",
  kt: "Kotlin",
  diff: "diff",
  text: "",
  txt: "",
  plaintext: "",
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  ldquo: '"',
  rdquo: '"',
  lsquo: "'",
  rsquo: "'",
};

const ATX_HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)\s*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^`]*)$/;
const LIST_ITEM = /^ *(?:[-+*]|\d{1,9}[.)])(?:\s+(.*))?$/;
const ORDERED_ITEM = /^ *(\d{1,9})[.)]\s+(.*)$/;
const TASK_MARKER = /^\[([ xX])\]\s+/;
const LINK_REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*\S+.*$/;
const TABLE_DELIMITER_ROW = /^[\s|:-]*-[\s|:-]*$/;

/** Marks the slot where a protected substring was lifted out of the line. */
const PLACEHOLDER_OPEN = "\u0000";
const PLACEHOLDER_CLOSE = "\u0001";
const PLACEHOLDER_PATTERN = /\u0000(\d+)\u0001/g;

/** Ends a block with a full stop unless it already ends in sentence punctuation. */
function withTerminalPunctuation(text: string): string {
  return /[.!?:;,…]["')\]]?$/.test(text) ? text : `${text}.`;
}

/** Replaces `&amp;`-style entities with the characters they stand for. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d{1,7});/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#[xX]([0-9a-fA-F]{1,6});/g, (_m, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&([a-zA-Z]+);/g, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Strips the inline marks — emphasis, code spans, links, images, raw HTML — from
 * a single line, leaving the words behind.
 */
export function stripInlineMarkdown(
  input: string,
  options: MarkdownToSpeechOptions = {}
): string {
  const opts: ResolvedOptions = { ...DEFAULTS, ...options };
  const protectedRuns: string[] = [];
  const hold = (value: string): string =>
    `${PLACEHOLDER_OPEN}${protectedRuns.push(value) - 1}${PLACEHOLDER_CLOSE}`;

  let text = input;

  // Backslash escapes and code spans come out first: whatever they contain must
  // survive the emphasis pass untouched.
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, (_m, char) => hold(char));
  text = text.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_m, _ticks, code) =>
    hold(String(code).trim())
  );

  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Images before links: `![alt](src)` is a link whose text starts with `!`.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt) =>
    opts.images === "skip" ? "" : String(alt)
  );
  text = text.replace(/!\[([^\]]*)\]\[[^\]]*\]/g, (_m, alt) =>
    opts.images === "skip" ? "" : String(alt)
  );

  // Footnote references carry no spoken meaning.
  text = text.replace(/\[\^[^\]]+\]/g, "");

  text = text.replace(/\[([^\]]*)\]\(\s*<?([^\s)]*)>?[^)]*\)/g, (_m, label, url) =>
    opts.links === "text-and-url" && url ? `${label}, ${url}` : String(label)
  );
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1");

  // Autolinks: `<https://example.com>` reads better as the bare address.
  text = text.replace(/<((?:https?|mailto):[^>\s]+)>/gi, (_m, url) =>
    opts.links === "text-and-url"
      ? String(url)
      : String(url).replace(/^mailto:/i, "")
  );

  // Remaining angle brackets are raw HTML tags.
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  text = text.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, "$1");
  text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "$1");
  text = text.replace(/(?<![A-Za-z0-9_])__(?=\S)([\s\S]*?\S)__(?![A-Za-z0-9_])/g, "$1");
  text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1");
  text = text.replace(/\*(?=\S)([^*\n]*?\S)\*/g, "$1");
  // Underscores are only emphasis between word boundaries, so `snake_case` survives.
  text = text.replace(/(?<![A-Za-z0-9_])_(?=\S)([^_\n]*?\S)_(?![A-Za-z0-9_])/g, "$1");

  text = decodeEntities(text);
  text = text.replace(
    PLACEHOLDER_PATTERN,
    (_m, index) => protectedRuns[Number(index)] ?? ""
  );

  return text.replace(/[ \t]+/g, " ").trim();
}

/** Spoken stand-in for a fenced code block, e.g. "TypeScript code block." */
function announceCode(language: string): string {
  const key = language.trim().split(/[\s,{]/)[0]?.toLowerCase() ?? "";
  const name = key in LANGUAGE_NAMES ? LANGUAGE_NAMES[key] : key;
  return name ? `${name} code block.` : "Code block.";
}

/**
 * Parses Markdown into the blocks that should be spoken, in reading order.
 *
 * Use this when the caller wants the structure — to highlight the current
 * heading, say, or to skip to a section. Callers that only need something to
 * feed a synthesizer want {@link markdownToSpeech}.
 */
export function markdownToSpeechSegments(
  markdown: string,
  options: MarkdownToSpeechOptions = {}
): SpeechSegment[] {
  const opts: ResolvedOptions = { ...DEFAULTS, ...options };
  const segments: SpeechSegment[] = [];

  let source = (markdown ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  source = source.replace(/<!--[\s\S]*?-->/g, "");

  const lines = source.split("\n");
  let index = 0;

  // YAML front matter: only when it opens on the very first line.
  if (!opts.frontMatter && /^---\s*$/.test(lines[0] ?? "")) {
    const closing = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
    if (closing > 0) index = closing + 1;
  }

  /** Soft-wrapped lines of the paragraph being accumulated. */
  let paragraph: string[] = [];
  let quoting = false;

  const push = (type: SpeechSegmentType, text: string, level?: number): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const spoken = opts.addTerminalPunctuation ? withTerminalPunctuation(trimmed) : trimmed;
    segments.push(level === undefined ? { type, text: spoken } : { type, text: spoken, level });
  };

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const text = stripInlineMarkdown(paragraph.join(" "), opts);
    paragraph = [];
    const type = quoting ? "quote" : "paragraph";
    quoting = false;
    push(type, text);
  };

  for (; index < lines.length; index += 1) {
    let line = lines[index];

    // A fence closes any paragraph before it and swallows lines until it ends.
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      flushParagraph();
      const marker = fence[1];
      const language = fence[2] ?? "";
      const closingFence = new RegExp(`^ {0,3}\\${marker[0]}{${marker.length},}\\s*$`);
      const body: string[] = [];
      index += 1;
      for (; index < lines.length; index += 1) {
        if (closingFence.test(lines[index])) break;
        body.push(lines[index]);
      }
      if (opts.codeBlocks === "announce") {
        push("code", announceCode(language));
      } else if (opts.codeBlocks === "read") {
        push("code", body.join(" ").replace(/\s+/g, " "));
      }
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    // Blockquote markers are stripped so the quoted content is parsed normally.
    let isQuote = false;
    while (/^ {0,3}>\s?/.test(line)) {
      line = line.replace(/^ {0,3}>\s?/, "");
      isQuote = true;
    }
    if (isQuote) {
      if (paragraph.length === 0) quoting = true;
      if (line.trim() === "") {
        flushParagraph();
        continue;
      }
    }

    if (THEMATIC_BREAK.test(line)) {
      flushParagraph();
      continue;
    }

    const heading = ATX_HEADING.exec(line);
    if (heading) {
      flushParagraph();
      if (opts.headings === "skip") continue;
      // A closing run of hashes (`## Title ##`) is decoration, not content.
      const text = stripInlineMarkdown((heading[2] ?? "").replace(/\s+#+$/, ""), opts);
      if (!text) continue;
      push("heading", opts.headings === "announce" ? `Heading: ${text}` : text, heading[1].length);
      continue;
    }

    // Setext heading: the underline applies to the single line above it.
    const underline = SETEXT_UNDERLINE.exec(line);
    if (underline && paragraph.length > 0 && opts.headings !== "skip") {
      const text = stripInlineMarkdown(paragraph.join(" "), opts);
      paragraph = [];
      quoting = false;
      if (text) {
        push(
          "heading",
          opts.headings === "announce" ? `Heading: ${text}` : text,
          underline[1].startsWith("=") ? 1 : 2
        );
      }
      continue;
    }

    if (LINK_REFERENCE_DEFINITION.test(line) && paragraph.length === 0) continue;

    if (line.trimStart().startsWith("|")) {
      flushParagraph();
      if (opts.tables === "skip" || TABLE_DELIMITER_ROW.test(line)) continue;
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split(/(?<!\\)\|/)
        .map((cell) => stripInlineMarkdown(cell, opts))
        .filter((cell) => cell.length > 0);
      if (cells.length > 0) push("table-row", cells.join(", "));
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      const ordered = ORDERED_ITEM.exec(line);
      // Keep the number — a listener needs it — but drop bullets and checkboxes.
      const body = (ordered ? ordered[2] : (item[1] ?? "")).replace(TASK_MARKER, "");
      const text = stripInlineMarkdown(body, opts);
      if (!text) continue;
      push("list-item", ordered ? `${ordered[1]}. ${text}` : text);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return segments;
}

/**
 * Converts Markdown to plain text ready for a speech synthesizer.
 *
 * Blocks are separated by blank lines so downstream chunkers (`splitTextSmart`)
 * break on them; runs of list items and table rows stay in one block so a list
 * is not chopped into one request per bullet.
 */
export function markdownToSpeech(
  markdown: string,
  options: MarkdownToSpeechOptions = {}
): string {
  const segments = markdownToSpeechSegments(markdown, options);

  return segments.reduce((out, segment, i) => {
    if (i === 0) return segment.text;
    const previous = segments[i - 1].type;
    const runsOn =
      (segment.type === "list-item" || segment.type === "table-row") &&
      previous === segment.type;
    return `${out}${runsOn ? "\n" : "\n\n"}${segment.text}`;
  }, "");
}

/**
 * Guesses whether a blob of text is Markdown, for callers with no filename to go
 * on (piped stdin, a paste). Errs towards `false`: prose read as Markdown is
 * mostly unchanged anyway, so only reasonably clear signals count.
 */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 20000);
  const signals = [
    /^ {0,3}#{1,6}\s+\S/m,
    /^ {0,3}(?:```|~~~)/m,
    /^ {0,3}[-+*]\s+\S/m,
    /^ {0,3}>\s+\S/m,
    /\[[^\]]+\]\([^)]+\)/,
    /(?<![A-Za-z0-9])\*\*\S[\s\S]*?\S\*\*/,
    /^ {0,3}\|.*\|\s*$/m,
  ];
  return signals.filter((pattern) => pattern.test(sample)).length >= 2;
}
