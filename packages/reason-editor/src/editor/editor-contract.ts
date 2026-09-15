/**
 * @module editor-contract
 * @description The props and imperative handle every `ReasonDocs` editor
 * implements, independent of which engine renders it.
 *
 * `ReasonDocs` stores a document as an HTML string and drives the editor
 * through this one shape: HTML in, debounced HTML out, headings reported for
 * the table of contents, and a ref for scrolling to one. `EditorArea` picks the
 * implementation — `PlateEditorWrapper` by default, `TiptapEditorWrapper` when
 * asked for — and nothing above it branches on the choice.
 */

import type { TocEntry } from 'react-reason-editor-sidebar';

/** Imperative handle exposed via `ref` on a `ReasonDocs` editor. */
export type ReasonEditorHandle = {
  /** Smoothly scrolls the editor viewport to the heading identified by `key`. */
  scrollToHeading: (key: string) => void;
  /** Returns the DOM element for the heading with the given key, or null. */
  getElementByKey: (key: string) => HTMLElement | null;
};

export interface ReasonEditorProps {
  content: string;
  /** Change this when switching documents to force a reload */
  contentKey?: string;
  onChange: (content: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  scrollToHeading?: (headingText: string) => void;
  onHeadingsChange?: (headings: TocEntry[]) => void;
  readOnly?: boolean;
  aiSuggestion?: {
    originalText: string;
    suggestedText: string;
    range: { from: number; to: number };
    mode?: string;
  } | null;
  isAiLoading?: boolean;
  onAiRewrite?: (customPrompt?: string, modeId?: string) => void;
  onAiApprove?: () => void;
  onAiReject?: () => void;
  onAiRegenerate?: (mode: any) => void;
  onInviteClick?: () => void;
  onShareClick?: () => void;
  documentId?: string;
}

/**
 * Heading key format shared by every engine: `"{level}:{index}:{text}"`.
 * `RightPanel`'s table of contents round-trips these strings straight back into
 * `scrollToHeading`, so the shape is part of the contract, not an
 * implementation detail — level and index make the DOM lookup unambiguous when
 * two headings share text.
 */
export function tocHeadingKey(level: number, index: number, text: string): string {
  return `${level}:${index}:${text}`;
}

/** Splits a key made by {@link tocHeadingKey} back into its level and text. */
export function parseTocHeadingKey(key: string): { level: string; text: string } {
  const first = key.indexOf(':');
  const second = key.indexOf(':', first + 1);

  return { level: key.slice(0, first), text: key.slice(second + 1) };
}
