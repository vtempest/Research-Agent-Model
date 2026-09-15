/**
 * Shared type definitions for the Ai extension: the quick-command menu, the
 * pluggable completion function apps wire real model calls into, and the
 * panel/suggestion state that drives both the ProseMirror decorations and
 * the floating React menu.
 */

import type { ComponentType } from 'react';

/** Section a command is listed under in the menu. Purely presentational grouping. */
export type AiCommandGroup = 'edit' | 'tone' | 'transform' | 'generate';

/** One choice offered by a command that needs an argument (e.g. a target language). */
export interface AiCommandOption {
  /** Stable identifier, also used as the React key. */
  id: string;
  /** Label shown in the submenu. */
  label: string;
}

/** A single quick-action offered in the "Ask AI anything…" command list. */
export interface AiCommandDefinition {
  /** Stable identifier, also used as the React key. */
  id: string;
  /** Label shown in the command list. */
  label: string;
  /** Short helper text shown under the label. */
  description?: string;
  /** `lucide-react` icon component rendered next to the label. */
  icon: ComponentType<{ className?: string }>;
  /** Section the command is listed under. Defaults to `edit`. */
  group?: AiCommandGroup;
  /**
   * Whether the command only makes sense with text selected. Commands that
   * rewrite the selection are hidden (rather than silently misfiring on an
   * empty selection) when the caret is collapsed. Defaults to `true`.
   */
  requiresSelection?: boolean;
  /**
   * Choices the command needs before it can run — rendered as a submenu.
   * The picked option's `label` is appended to `prompt` and passed to the
   * completion function as `request.option`.
   */
  options?: AiCommandOption[];
  /**
   * Instruction sent to the completion function as `request.instruction`.
   * The selection (or, when nothing is selected, an empty string) is passed
   * alongside it as `request.selectedText` — combine them however the
   * backend prompt format needs.
   */
  prompt: string;
}

/** What the completion function is asked to do. */
export interface AiCompletionRequest {
  /** The resolved instruction, e.g. a command's `prompt` or free-form text typed by the user. */
  instruction: string;
  /** The selected text the instruction should act on. Empty when generating fresh content. */
  selectedText: string;
  /**
   * Plain text around the selection, for context. Clamped to a bounded window
   * (see `AiOptions.contextChars`) so a long document does not blow up the
   * request — never assume it is the whole document.
   */
  documentText: string;
  /** `id` of the quick command that ran, or `'custom'` for a free-form prompt. */
  commandId: string;
  /** Human label of the command that ran, for logging/telemetry. */
  commandLabel: string;
  /** The submenu choice the command was run with (e.g. `'Spanish'`), when it has options. */
  option?: string;
  /**
   * A ready-to-use system message that constrains the model to return only the
   * replacement text — no preamble, no Markdown fences. Pass it straight
   * through to the provider; the editor sanitises the response either way.
   */
  systemPrompt: string;
  /** `replace` when the result will swap the selection, `insert` when it will be added at the caret. */
  mode: AiSuggestionMode;
}

/**
 * Runs an AI completion. Called with an `onChunk` callback so implementations
 * can stream partial text as it arrives; the returned promise must resolve
 * with the final full text. Apps supply their own implementation (real LLM
 * call) via `Ai.configure({ getCompletion })`, the same way `Image`/`Video`
 * take an `upload` callback.
 */
export type AiCompletionFn = (
  request: AiCompletionRequest,
  onChunk: (accumulatedText: string) => void,
  signal: AbortSignal
) => Promise<string>;

/** `replace` swaps `[from, to]` on accept; `insert` adds the text at the caret. */
export type AiSuggestionMode = 'replace' | 'insert';

/** A suggestion currently being reviewed: either a replacement for a selection or a fresh insertion at the cursor. */
export interface AiSuggestion {
  from: number;
  to: number;
  originalText: string;
  suggestedText: string;
  mode: AiSuggestionMode;
  /** True while text is still streaming in; accept/insert-below are disabled until it settles. */
  isStreaming: boolean;
}

/** The last request that ran, kept around so "Try again" can be re-issued without retyping. */
export interface AiLastRequest {
  instruction: string;
  commandId: string;
  commandLabel: string;
  option?: string;
  from: number;
  to: number;
}

export type AiPanelState =
  | { status: 'closed' }
  | { status: 'menu'; from: number; to: number }
  | { status: 'loading'; from: number; to: number; commandLabel: string }
  | { status: 'reviewing'; suggestion: AiSuggestion; commandLabel: string }
  | { status: 'error'; from: number; to: number; commandLabel: string; message: string };
