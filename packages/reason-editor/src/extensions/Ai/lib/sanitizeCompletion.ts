/**
 * Cleans a model response into text that is safe to paste into the document.
 *
 * The system prompt asks for a bare replacement, but chat-tuned models still
 * lead with "Sure — here's a tighter version:", wrap prose in ```code fences,
 * or quote the whole answer. Accepting a suggestion writes it into the user's
 * document verbatim, so the response is normalised on the way in — while it
 * streams as well as at the end, so the review diff shows what accepting will
 * actually produce.
 *
 * Every step is conservative: it only strips a wrapper when the whole response
 * is wrapped, so a genuinely fenced or quoted answer keeps its markers.
 */

/**
 * Assistant lead-ins, matched only at the very start and only when the line
 * ends in a colon — "Here is why this matters." is content, "Here is the
 * revised text:" is not.
 */
const PREAMBLE_RE =
  /^(?:sure|certainly|of course|absolutely|got it|okay|ok|here(?:'|’)?s|here is|here are|below is|i(?:'|’)?ve|i have)\b[^\n:]{0,120}:[ \t]*\r?\n+/i;

/** A single-line preamble followed by the answer on the same line, e.g. `Rewritten: …`. */
const INLINE_PREAMBLE_RE =
  /^(?:sure|certainly|of course|absolutely|got it|okay|ok)[,!.]?[ \t]*/i;

/** Opening fence, with or without a language tag. */
const OPENING_FENCE_RE = /^[ \t]*(?:```|~~~)[^\n]*\r?\n/;
/** Closing fence at the end of the response. */
const CLOSING_FENCE_RE = /\r?\n[ \t]*(?:```|~~~)[ \t]*$/;

/**
 * Removes a fence that wraps the *entire* response. While streaming, the
 * closing fence has not arrived yet, so an opening fence alone is dropped too.
 */
export function stripCodeFences(text: string): string {
  if (!OPENING_FENCE_RE.test(text)) return text;

  const withoutOpening = text.replace(OPENING_FENCE_RE, '');
  // A second fence in the middle means the response is genuinely multi-block
  // code; leave it alone rather than mangling half of it.
  const inner = withoutOpening.replace(CLOSING_FENCE_RE, '');
  if (/(?:^|\n)[ \t]*(?:```|~~~)/.test(inner)) return text;

  return inner;
}

/** Removes a leading "Sure, here's the rewrite:" style lead-in. */
export function stripPreamble(text: string): string {
  const withoutBlock = text.replace(PREAMBLE_RE, '');
  if (withoutBlock !== text) return withoutBlock;
  return text.replace(INLINE_PREAMBLE_RE, '');
}

/** Removes quotation marks that wrap the whole response and nothing else. */
export function stripWrappingQuotes(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;

  const pairs: [string, string][] = [
    ['"', '"'],
    ['“', '”'],
    ["'", "'"],
    ['‘', '’'],
  ];

  for (const [open, close] of pairs) {
    if (!trimmed.startsWith(open) || !trimmed.endsWith(close)) continue;
    const inner = trimmed.slice(open.length, trimmed.length - close.length);
    // Only unwrap when the marks really are a wrapper — not when the text
    // happens to open and close with separate quotations.
    if (!inner.includes(close)) return inner;
  }

  return text;
}

/** Collapses the runs of blank lines models like to emit, and trims trailing space. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

export interface SanitizeOptions {
  /**
   * True while chunks are still arriving. Trailing whitespace is meaningful
   * mid-stream (the next chunk continues the word), so it is preserved; the
   * final pass trims it.
   */
  streaming?: boolean;
}

/**
 * Runs the full clean-up. Idempotent, so it can be applied to every streamed
 * chunk and again to the final text without compounding.
 */
export function sanitizeCompletion(text: string, { streaming = false }: SanitizeOptions = {}): string {
  if (!text) return '';

  let out = normalizeWhitespace(text);
  out = stripPreamble(out);
  out = stripCodeFences(out);
  // Only unwrap quotes once the response has settled: mid-stream the closing
  // mark has not arrived, so unwrapping early makes the preview flicker.
  if (!streaming) out = stripWrappingQuotes(out);
  out = out.replace(/^\n+/, '');

  return streaming ? out.replace(/[ \t]+$/, ' ').replace(/^[ \t]+/, '') : out.trim();
}
