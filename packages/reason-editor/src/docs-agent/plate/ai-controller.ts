/**
 * The writing assistant for the Plate editor — the state machine behind the
 * bubble menu's "Ask AI" button, ported from the Tiptap side's
 * `src/extensions/Ai/Ai.ts`. Read that extension's doc comment first: the
 * command set, the prompt construction, the response sanitising and the review
 * flow are literally the same modules (`src/extensions/Ai/{commands,lib}`), so
 * a rewrite asks the same route for the same thing on either engine.
 *
 * Only the document half is re-implemented here, because Slate has no
 * ProseMirror plugin state to hang a panel off and no decorations to render a
 * diff with:
 *
 *   - State lives in a per-editor controller (a `WeakMap` + subscribe/notify),
 *     the same shape `./transcribe-controller.ts` uses, rather than in
 *     transaction metadata. Components read it with `useSyncExternalStore`.
 *   - The review surface is the panel's preview, not an inline red/green diff.
 *     What that preserves is the rule that matters: nothing reaches the
 *     document until the user accepts, and what is written is the sanitised,
 *     Markdown-aware content the preview showed.
 *   - The range a request was launched against is captured when the menu opens
 *     and is not mapped through later edits — the panel is modal in practice
 *     (its input holds focus, clicking the document closes it), so there is no
 *     transaction to map through.
 *
 * The plugin is keyed `KEYS.aiChat` and mirrors the panel's open/closed state
 * into its `open` option because that is the flag `./ui/floating-toolbar.tsx`
 * already checks (`usePluginOption({ key: KEYS.aiChat }, 'open')`) to get the
 * selection toolbar out of the way — the same contract Plate's own AI kit has
 * with that component.
 */

import { KEYS, NodeApi, PathApi, RangeApi, type Descendant, type TRange } from 'platejs';
import { createPlatePlugin, type PlateEditor } from 'platejs/react';

import { DEFAULT_AI_COMMANDS } from '@/extensions/Ai/commands';
import { needsRichInsert } from '@/extensions/Ai/lib/completionToContent';
import {
  AI_SYSTEM_PROMPT,
  buildAiInstruction,
  clampContext,
  commandsForSelection,
} from '@/extensions/Ai/lib/prompt';
import { createRewriteCompletion, DEFAULT_AI_ENDPOINT } from '@/extensions/Ai/lib/rewriteEndpoint';
import { sanitizeCompletion } from '@/extensions/Ai/lib/sanitizeCompletion';

import type {
  AiCommandDefinition,
  AiCompletionFn,
  AiSuggestionMode,
} from '@/extensions/Ai/types';

export type { AiCommandDefinition, AiCompletionFn, AiSuggestionMode };

/** Options the `AiPlugin` carries; the controller reads them on every request. */
export interface PlateAiOptions {
  /** Quick commands offered in the panel. Same defaults as the Tiptap extension. */
  commands: AiCommandDefinition[];
  /** Runs a completion. Defaults to the shared rewrite endpoint. */
  getCompletion: AiCompletionFn;
  /** System message sent with every request. */
  systemPrompt: string;
  /** How much surrounding text (characters) is sent as context. `0` sends none. */
  contextChars: number;
  /**
   * Whether the panel is open. Mirrored from the panel state rather than set by
   * hand — `./ui/floating-toolbar.tsx` reads it to hide the selection toolbar
   * while the panel is up.
   */
  open: boolean;
}

/** A suggestion being reviewed. Nothing here is in the document yet. */
export interface PlateAiSuggestion {
  originalText: string;
  suggestedText: string;
  mode: AiSuggestionMode;
  /** True while text is still streaming in; accept/insert-below stay disabled. */
  isStreaming: boolean;
}

export type PlateAiPanel =
  | { status: 'closed' }
  | { status: 'menu'; range: TRange }
  | { status: 'loading'; range: TRange; commandLabel: string }
  | {
      status: 'reviewing';
      range: TRange;
      suggestion: PlateAiSuggestion;
      commandLabel: string;
    }
  | { status: 'error'; range: TRange; commandLabel: string; message: string };

/** The last request that ran, so "Try again" can re-issue it without retyping. */
interface PlateAiLastRequest {
  instruction: string;
  commandId: string;
  commandLabel: string;
  option?: string;
  range: TRange;
}

export interface PlateAiController {
  /** Opens the command menu over the current selection. */
  open(): void;
  /** Closes the panel and cancels anything in flight. Writes nothing. */
  close(): void;
  /** Runs a quick command by id, with the submenu choice it needs, if any. */
  runCommand(commandId: string, option?: string): boolean;
  /** Runs a free-form instruction typed into the panel. */
  submitPrompt(instruction: string): boolean;
  /** Re-issues the last request against the same range. */
  retry(): boolean;
  /** Stops generating, keeping whatever has already streamed in. */
  stop(): void;
  /** Writes the suggestion over the range it was asked about. */
  accept(): boolean;
  /** Writes the suggestion into a new block after the range, leaving it intact. */
  insertBelow(): boolean;
  /** Same as `close` — named for the button that calls it. */
  discard(): void;
  /** Commands available for the panel's current range. */
  availableCommands(): AiCommandDefinition[];
  getState(): PlateAiPanel;
  subscribe(listener: () => void): () => void;
}

export const DEFAULT_PLATE_AI_OPTIONS: PlateAiOptions = {
  commands: DEFAULT_AI_COMMANDS,
  getCompletion: createRewriteCompletion(DEFAULT_AI_ENDPOINT),
  systemPrompt: AI_SYSTEM_PROMPT,
  contextChars: 4000,
  open: false,
};

/**
 * Registers the assistant. `render.afterEditable` (the panel) is attached in
 * `./kits/ai-kit.tsx`, which is what a host should spread into its plugin list;
 * this is the plugin the options and the `mod+j` shortcut live on.
 */
export const AiPlugin = createPlatePlugin({
  key: KEYS.aiChat,
  options: DEFAULT_PLATE_AI_OPTIONS,
  shortcuts: {
    openAiMenu: {
      keys: 'mod+j',
      handler: ({ editor }) => {
        getPlateAiController(editor).open();
        return true;
      },
    },
  },
});

const controllers = new WeakMap<PlateEditor, PlateAiController>();

/** The range a panel state was launched against, if it has one. */
function panelRange(panel: PlateAiPanel): TRange | null {
  return panel.status === 'closed' ? null : panel.range;
}

/** Text of a range, one line per block — `editor.api.string` runs blocks together. */
function rangeText(editor: PlateEditor, at: TRange): string {
  try {
    const fragment = editor.api.fragment(at) ?? [];
    return fragment.map((node) => NodeApi.string(node as any)).join('\n');
  } catch {
    return '';
  }
}

/**
 * The document text sent as context: a window centred on the range rather than
 * the whole document, so cost and latency stay bounded on a long file. Mirrors
 * `readContextWindow` in `src/extensions/Ai/Ai.ts`.
 */
function readContextWindow(editor: PlateEditor, at: TRange, budget: number): string {
  if (budget <= 0) return '';

  const docStart = editor.api.start([]);
  const docEnd = editor.api.end([]);
  if (!docStart || !docEnd) return '';

  const before = rangeText(editor, { anchor: docStart, focus: RangeApi.start(at) });
  const after = rangeText(editor, { anchor: RangeApi.end(at), focus: docEnd });

  const half = Math.floor(budget / 2);
  const head = clampContext(before, half);
  const tail =
    after.length > budget - head.length ? `${after.slice(0, budget - head.length)}…` : after;

  return `${head}${head && tail ? '\n' : ''}${tail}`.trim();
}

/**
 * The content to write for a suggestion: a bare string when the answer is a
 * single-line rewrite (so the marks already on the range survive), and real
 * nodes when it carries Markdown structure or spans paragraphs — the same
 * `needsRichInsert` split the Tiptap side makes before `insertContentAt`.
 */
function completionToNodes(editor: PlateEditor, text: string): string | Descendant[] {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (!needsRichInsert(trimmed)) return trimmed;

  try {
    const nodes = (editor.api as any).markdown?.deserialize?.(trimmed) as
      | Descendant[]
      | undefined;
    if (nodes?.length) return nodes;
  } catch {
    // Markdown plugin missing or the answer would not parse — fall through to
    // paragraphs, which is still better than writing "- " into the document.
  }

  return trimmed
    .split(/\n{2,}/)
    .map((block) => ({ type: KEYS.p, children: [{ text: block.trim() }] }) as Descendant);
}

/** Wraps a plain-text result into blocks, for the insert-below path. */
function asBlocks(content: string | Descendant[]): Descendant[] {
  if (typeof content !== 'string') return content;
  return content
    .split(/\n{2,}/)
    .map((block) => ({ type: KEYS.p, children: [{ text: block.trim() }] }) as Descendant);
}

function createController(editor: PlateEditor): PlateAiController {
  let panel: PlateAiPanel = { status: 'closed' };
  let lastRequest: PlateAiLastRequest | null = null;
  let abortController: AbortController | null = null;
  let requestToken = 0;

  const listeners = new Set<() => void>();

  const readOptions = (): PlateAiOptions => ({
    ...DEFAULT_PLATE_AI_OPTIONS,
    ...(editor.getOptions(AiPlugin) as Partial<PlateAiOptions> | undefined),
  });

  const setPanel = (next: PlateAiPanel) => {
    panel = next;
    // Keeps the selection toolbar out of the panel's way; see the module doc.
    try {
      editor.setOption(AiPlugin, 'open', next.status !== 'closed');
    } catch {
      // The plugin is not registered on this editor — the panel simply has no
      // toolbar to coordinate with.
    }
    listeners.forEach((listener) => listener());
  };

  /** Cancels any in-flight request so a late chunk cannot revive a closed panel. */
  const cancelInFlight = () => {
    abortController?.abort();
    abortController = null;
    requestToken += 1;
  };

  /** Where a request acts: the panel's captured range, else the live selection. */
  const currentRange = (): TRange | null =>
    panelRange(panel) ?? editor.selection ?? null;

  async function run(request: {
    instruction: string;
    commandId: string;
    commandLabel: string;
    option?: string;
    range: TRange;
  }) {
    const options = readOptions();
    const { range } = request;
    const selectedText = RangeApi.isCollapsed(range) ? '' : rangeText(editor, range);
    const documentText = readContextWindow(editor, range, options.contextChars);
    const mode: AiSuggestionMode = selectedText ? 'replace' : 'insert';

    cancelInFlight();
    const controller = new AbortController();
    abortController = controller;
    const token = requestToken;

    lastRequest = {
      instruction: request.instruction,
      commandId: request.commandId,
      commandLabel: request.commandLabel,
      option: request.option,
      range,
    };
    setPanel({ status: 'loading', range, commandLabel: request.commandLabel });

    const showSuggestion = (text: string, isStreaming: boolean) => {
      if (token !== requestToken) return;
      setPanel({
        status: 'reviewing',
        range,
        commandLabel: request.commandLabel,
        suggestion: {
          originalText: selectedText,
          suggestedText: sanitizeCompletion(text, { streaming: isStreaming }),
          mode,
          isStreaming,
        },
      });
    };

    try {
      const result = await options.getCompletion(
        {
          instruction: request.instruction,
          selectedText,
          documentText,
          commandId: request.commandId,
          commandLabel: request.commandLabel,
          option: request.option,
          systemPrompt: options.systemPrompt,
          mode,
        },
        (chunk) => showSuggestion(chunk, true),
        controller.signal,
      );

      if (token !== requestToken) return;

      if (!sanitizeCompletion(result)) {
        setPanel({
          status: 'error',
          range,
          commandLabel: request.commandLabel,
          message: 'The model returned an empty response.',
        });
        return;
      }

      showSuggestion(result, false);
    } catch (error) {
      if (controller.signal.aborted || token !== requestToken) return;
      setPanel({
        status: 'error',
        range,
        commandLabel: request.commandLabel,
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  }

  /** Writes `content` at `at`, replacing whatever it covers. */
  const writeAt = (at: TRange, content: string | Descendant[]) => {
    editor.tf.select(at);
    if (typeof content === 'string') editor.tf.insertText(content);
    else editor.tf.insertFragment(content as any);
    editor.tf.focus();
  };

  return {
    open() {
      cancelInFlight();
      const range = editor.selection;
      if (!range) {
        const end = editor.api.end([]);
        if (!end) return;
        setPanel({ status: 'menu', range: { anchor: end, focus: end } });
        return;
      }
      setPanel({ status: 'menu', range });
    },

    close() {
      cancelInFlight();
      setPanel({ status: 'closed' });
    },

    runCommand(commandId, option) {
      const options = readOptions();
      const command = options.commands.find((c) => c.id === commandId);
      if (!command) return false;

      const range = currentRange();
      if (!range) return false;

      // A command that rewrites a selection has nothing to act on when the
      // caret is collapsed; running it anyway produces a confident answer about
      // nothing, so refuse instead.
      if (command.requiresSelection !== false && RangeApi.isCollapsed(range)) return false;
      if (command.options?.length && !option) return false;

      void run({
        instruction: buildAiInstruction(command, option),
        commandId: command.id,
        commandLabel: option ? `${command.label} → ${option}` : command.label,
        option,
        range,
      });
      return true;
    },

    submitPrompt(instruction) {
      const trimmed = instruction.trim();
      if (!trimmed) return false;

      const range = currentRange();
      if (!range) return false;

      void run({
        instruction: trimmed,
        commandId: 'custom',
        commandLabel: 'Custom',
        range,
      });
      return true;
    },

    retry() {
      if (!lastRequest) return false;
      void run({ ...lastRequest });
      return true;
    },

    stop() {
      if (panel.status !== 'loading' && panel.status !== 'reviewing') return;

      cancelInFlight();

      // Text already streamed in is worth keeping: settle it so the user can
      // accept the partial result. With nothing yet to review, fall back to the
      // command list.
      if (panel.status === 'reviewing') {
        setPanel({ ...panel, suggestion: { ...panel.suggestion, isStreaming: false } });
      } else {
        setPanel({ status: 'menu', range: panel.range });
      }
    },

    accept() {
      if (panel.status !== 'reviewing' || panel.suggestion.isStreaming) return false;

      const content = completionToNodes(editor, panel.suggestion.suggestedText);
      if (!content.length) return false;

      const { range } = panel;
      cancelInFlight();
      setPanel({ status: 'closed' });
      writeAt(range, content);
      return true;
    },

    insertBelow() {
      if (panel.status !== 'reviewing' || panel.suggestion.isStreaming) return false;

      const content = completionToNodes(editor, panel.suggestion.suggestedText);
      if (!content.length) return false;

      const at = RangeApi.end(panel.range);
      const block = editor.api.block({ at });
      if (!block) return false;

      cancelInFlight();
      setPanel({ status: 'closed' });
      // Insert after the block the suggestion ends in, so the original text is
      // left exactly as it was rather than being split around the result.
      editor.tf.insertNodes(asBlocks(content) as any, {
        at: PathApi.next(block[1]),
        select: true,
      });
      editor.tf.focus();
      return true;
    },

    discard() {
      cancelInFlight();
      setPanel({ status: 'closed' });
    },

    availableCommands() {
      const options = readOptions();
      const range = currentRange();
      const hasSelection = !!range && !RangeApi.isCollapsed(range);
      return commandsForSelection(options.commands, hasSelection);
    },

    getState: () => panel,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** One controller per editor instance, created on first use and cached for its lifetime. */
export function getPlateAiController(editor: PlateEditor): PlateAiController {
  let controller = controllers.get(editor);
  if (!controller) {
    controller = createController(editor);
    controllers.set(editor, controller);
  }

  return controller;
}
