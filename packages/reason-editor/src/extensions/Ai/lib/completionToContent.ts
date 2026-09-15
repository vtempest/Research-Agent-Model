/**
 * Turns a sanitised completion into content the editor can insert.
 *
 * Models answer in Markdown even when nobody asked: "Key takeaways" comes back
 * as `- ` lines, "Draft an outline" as `## ` headings, emphasis as `**bold**`.
 * Inserting that as plain text writes the punctuation into the document and
 * loses the structure, so the same `marked` conversion the MarkdownPaste
 * extension uses on pasted text is applied here before accepting.
 *
 * Text with no Markdown structure and no paragraph breaks is left as plain
 * text, so a simple rewrite keeps the marks (bold, links, highlights) that
 * were already on the replaced range.
 */

import { marked } from 'marked';

/** Structural Markdown — the patterns worth converting rather than inserting literally. */
const BLOCK_MARKDOWN_RE = [
  /^#{1,6}\s+/m, // headings
  /^\s*[-*+]\s+\S/m, // bullet lists
  /^\s*\d+\.\s+\S/m, // ordered lists
  /^\s*>\s+\S/m, // blockquotes
  /^\s*[-*]\s+\[[ xX]\]/m, // task lists
  /^\|.+\|\s*$/m, // tables
  /^\s*(?:---|\*\*\*)\s*$/m, // horizontal rules
];

/** Inline Markdown that is only worth converting when it is unambiguous. */
const INLINE_MARKDOWN_RE = [
  /\*\*[^\s*][^*]*\*\*/, // bold
  /\[[^\]]+\]\([^)\s]+\)/, // links
  /`[^`\n]+`/, // inline code
];

/** Whether the completion carries formatting that should become real nodes. */
export function hasMarkdownStructure(text: string): boolean {
  return (
    BLOCK_MARKDOWN_RE.some((re) => re.test(text)) || INLINE_MARKDOWN_RE.some((re) => re.test(text))
  );
}

/**
 * Whether the completion should be inserted as HTML rather than plain text:
 * either it carries Markdown structure, or it spans more than one paragraph
 * (which as plain text would collapse into one block with literal newlines).
 */
export function needsRichInsert(text: string): boolean {
  return hasMarkdownStructure(text) || /\n/.test(text.trim());
}

/**
 * Renders a completion to HTML for `insertContentAt`. `<thead>`/`<tbody>` are
 * dropped for the same reason MarkdownPaste drops them: the editor's table
 * schema has no node for them, so ProseMirror would discard the rows inside.
 */
export function completionToHtml(text: string): string {
  const html = marked.parse(text, { gfm: true, breaks: true, async: false }) as string;
  return html.replace(/<\/?(thead|tbody)>/g, '');
}

/**
 * The content to hand `insertContentAt`, plus whether it is HTML. Plain-text
 * results are returned untouched so simple rewrites keep the existing marks.
 */
export function completionToContent(text: string): { content: string; isHtml: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { content: '', isHtml: false };
  if (!needsRichInsert(trimmed)) return { content: trimmed, isHtml: false };
  return { content: completionToHtml(trimmed), isHtml: true };
}
