/**
 * Defines the Ai Tiptap extension: a writing-assistant menu ("Ask AI
 * anything…" + quick commands like Improve writing / Make shorter / Fix
 * spelling) that streams a suggestion, renders it as a non-destructive
 * red/green diff over the selection, and lets the user Accept, Discard,
 * Insert below, or Try again before anything is written to the document.
 *
 * Ported from `packages/reason-editor/ai` (the Plate.js `@platejs/ai`
 * package) and rebuilt on Tiptap/ProseMirror: a decoration-driven plugin
 * (state machine + diff rendering) in place of Slate's editor transforms,
 * following the same shape as this package's `Harper` extension.
 *
 * Three rules shape the behaviour here, all of them about not damaging the
 * document: nothing is written until the user accepts; what is written is the
 * sanitised, Markdown-aware content the review panel showed, not the raw model
 * response; and the request only ever carries a bounded window of the document
 * so a long file cannot silently blow up the call.
 */

import { type Editor, Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { Mapping } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { DEFAULT_AI_COMMANDS } from './commands';
import { completionToContent } from './lib/completionToContent';
import { mockAiCompletion } from './lib/mockCompletion';
import { AI_SYSTEM_PROMPT, buildAiInstruction, clampContext } from './lib/prompt';
import { sanitizeCompletion } from './lib/sanitizeCompletion';

import type {
  AiCommandDefinition,
  AiCompletionFn,
  AiLastRequest,
  AiPanelState,
  AiSuggestion,
} from './types';

export * from './types';
export { DEFAULT_AI_COMMANDS, DEFAULT_AI_LANGUAGES, AI_COMMAND_GROUP_LABELS } from './commands';
export { AI_SYSTEM_PROMPT } from './lib/prompt';

export interface AiOptions {
  /** Quick commands offered in the "Ask AI anything…" menu. */
  commands: AiCommandDefinition[];
  /**
   * Runs a completion for an instruction. Defaults to an offline demo
   * transform; host apps should supply a real implementation, the same way
   * `Image`/`Video` take an `upload` callback. See `createStreamingCompletion`
   * for a ready-made fetch/stream implementation.
   */
  getCompletion: AiCompletionFn;
  /**
   * System message sent with every request. Constrains the model to return
   * only the replacement text — override to add house style or domain rules.
   */
  systemPrompt: string;
  /**
   * How much surrounding document text (in characters) is sent as context.
   * The window is taken from around the selection, so the nearest text is
   * what survives the clamp. Set to `0` to send no context at all.
   */
  contextChars: number;
  /** Class applied to the (still-present) original text while a replacement is reviewed. */
  removedClass: string;
  /** Class applied to the streamed/suggested text widget. */
  insertedClass: string;
  /** Class applied to the "thinking" placeholder shown before the first chunk arrives. */
  loadingClass: string;
}

export interface AiStorage {
  requestToken: number;
  abortController: AbortController | null;
}

interface AiPluginState {
  panel: AiPanelState;
  decorations: DecorationSet;
  lastRequest: AiLastRequest | null;
}

type AiMeta =
  | { type: 'open-menu'; from: number; to: number }
  | {
      type: 'set-loading';
      from: number;
      to: number;
      commandId: string;
      commandLabel: string;
      instruction: string;
      option?: string;
    }
  | { type: 'set-suggestion'; suggestion: AiSuggestion; commandLabel: string }
  | { type: 'set-error'; from: number; to: number; commandLabel: string; message: string }
  | { type: 'settle' }
  | { type: 'close' };

export const aiPluginKey = new PluginKey<AiPluginState>('ai');

export function getAiState(state: EditorState): AiPluginState | undefined {
  return aiPluginKey.getState(state);
}

/** Reads the live, resolved options (including any `commands` override) off the registered extension instance. */
export function getAiOptions(editor: Editor): AiOptions | undefined {
  return editor.extensionManager.extensions.find((extension) => extension.name === 'ai')?.options as
    | AiOptions
    | undefined;
}

/** Whether the Ai extension is registered on this editor, for hosts that render its controls conditionally. */
export function isAiEnabled(editor: Editor | null | undefined): boolean {
  return !!editor && typeof (editor.commands as any).openAiMenu === 'function';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ai: {
      /** Open the quick-command / free-form prompt menu at the current selection (or cursor). */
      openAiMenu: () => ReturnType;
      /** Close the menu and discard any pending suggestion without touching the document. */
      closeAiMenu: () => ReturnType;
      /** Run one of `options.commands` against the menu's range, optionally with a submenu choice. */
      runAiCommand: (commandId: string, option?: string) => ReturnType;
      /** Run a free-form instruction typed into the menu's input. */
      submitAiPrompt: (instruction: string) => ReturnType;
      /** Abort an in-flight completion and return to the command menu. */
      stopAiGeneration: () => ReturnType;
      /** Replace the original range with the suggestion (or insert it, when there was no selection). */
      acceptAiSuggestion: () => ReturnType;
      /** Discard the suggestion, leaving the document untouched. */
      discardAiSuggestion: () => ReturnType;
      /** Keep the original text and insert the suggestion as a new block below it. */
      insertAiSuggestionBelow: () => ReturnType;
      /** Re-run the last instruction against its original range. */
      retryAiSuggestion: () => ReturnType;
    };
  }
}

function getPanelRange(
  panel: AiPanelState,
  fallback: { from: number; to: number }
): { from: number; to: number } {
  switch (panel.status) {
    case 'menu':
    case 'loading':
    case 'error':
      return { from: panel.from, to: panel.to };
    case 'reviewing':
      return { from: panel.suggestion.from, to: panel.suggestion.to };
    default:
      return fallback;
  }
}

function mapPanel(panel: AiPanelState, mapping: Mapping): AiPanelState {
  switch (panel.status) {
    case 'closed':
      return panel;
    case 'menu':
    case 'loading':
    case 'error':
      return { ...panel, from: mapping.map(panel.from), to: mapping.map(panel.to) };
    case 'reviewing':
      return {
        ...panel,
        suggestion: {
          ...panel.suggestion,
          from: mapping.map(panel.suggestion.from),
          to: mapping.map(panel.suggestion.to),
        },
      };
    default:
      return panel;
  }
}

function buildDecorations(doc: ProseMirrorNode, panel: AiPanelState, options: AiOptions): DecorationSet {
  if (panel.status === 'loading') {
    return DecorationSet.create(doc, [
      Decoration.widget(
        panel.to,
        () => {
          const span = document.createElement('span');
          span.className = options.loadingClass;
          span.textContent = '● ● ●';
          return span;
        },
        { side: 1 }
      ),
    ]);
  }

  if (panel.status === 'reviewing') {
    const { from, to, suggestedText, mode } = panel.suggestion;
    const decorations: Decoration[] = [];

    if (mode === 'replace' && to > from) {
      decorations.push(Decoration.inline(from, to, { class: options.removedClass }));
    }

    decorations.push(
      Decoration.widget(
        to,
        () => {
          const span = document.createElement('span');
          span.className = options.insertedClass;
          span.textContent = suggestedText || '…';
          return span;
        },
        { side: 1 }
      )
    );

    return DecorationSet.create(doc, decorations);
  }

  return DecorationSet.empty;
}

/**
 * The document text sent as context: a window centred on the range rather than
 * the whole document, so cost and latency stay bounded on a long file.
 */
function readContextWindow(doc: ProseMirrorNode, from: number, to: number, budget: number): string {
  if (budget <= 0) return '';

  // Read a generous span either side, then clamp precisely by characters:
  // positions and characters are not 1:1 once nodes are involved.
  const span = budget + 200;
  const before = doc.textBetween(Math.max(0, from - span), from, '\n');
  const after = doc.textBetween(to, Math.min(doc.content.size, to + span), '\n');

  const half = Math.floor(budget / 2);
  const head = clampContext(before, half);
  const tail = after.length > budget - head.length ? `${after.slice(0, budget - head.length)}…` : after;

  return `${head}${head && tail ? '\n' : ''}${tail}`.trim();
}

async function runAiRequest(
  editor: Editor,
  options: AiOptions,
  storage: AiStorage,
  request: { instruction: string; commandId: string; commandLabel: string; option?: string },
  from: number,
  to: number
) {
  const { view } = editor;
  const doc = editor.state.doc;
  const selectedText = from === to ? '' : doc.textBetween(from, to, '\n');
  const documentText = readContextWindow(doc, from, to, options.contextChars);
  const mode: AiSuggestion['mode'] = selectedText ? 'replace' : 'insert';

  storage.abortController?.abort();
  const controller = new AbortController();
  storage.abortController = controller;
  const token = (storage.requestToken += 1);

  view.dispatch(
    view.state.tr.setMeta(aiPluginKey, {
      type: 'set-loading',
      from,
      to,
      commandId: request.commandId,
      commandLabel: request.commandLabel,
      instruction: request.instruction,
      option: request.option,
    } satisfies AiMeta)
  );

  const dispatchSuggestion = (text: string, isStreaming: boolean) => {
    if (token !== storage.requestToken || editor.isDestroyed) return;
    const suggestedText = sanitizeCompletion(text, { streaming: isStreaming });
    editor.view.dispatch(
      editor.view.state.tr.setMeta(aiPluginKey, {
        type: 'set-suggestion',
        commandLabel: request.commandLabel,
        suggestion: { from, to, originalText: selectedText, suggestedText, mode, isStreaming },
      } satisfies AiMeta)
    );
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
      (chunk) => dispatchSuggestion(chunk, true),
      controller.signal
    );

    if (token !== storage.requestToken || editor.isDestroyed) return;

    const finalText = sanitizeCompletion(result);
    if (!finalText) {
      editor.view.dispatch(
        editor.view.state.tr.setMeta(aiPluginKey, {
          type: 'set-error',
          from,
          to,
          commandLabel: request.commandLabel,
          message: 'The model returned an empty response.',
        } satisfies AiMeta)
      );
      return;
    }

    dispatchSuggestion(result, false);
  } catch (error) {
    if (controller.signal.aborted || token !== storage.requestToken || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(aiPluginKey, {
        type: 'set-error',
        from,
        to,
        commandLabel: request.commandLabel,
        message: error instanceof Error ? error.message : 'Something went wrong.',
      } satisfies AiMeta)
    );
  }
}

export const Ai = Extension.create<AiOptions, AiStorage>({
  name: 'ai',

  addOptions() {
    return {
      commands: DEFAULT_AI_COMMANDS,
      getCompletion: mockAiCompletion,
      systemPrompt: AI_SYSTEM_PROMPT,
      contextChars: 4000,
      removedClass: 'ai-removed-text',
      insertedClass: 'ai-suggested-text',
      loadingClass: 'ai-loading-indicator',
    };
  },

  addStorage() {
    return {
      requestToken: 0,
      abortController: null,
    };
  },

  onDestroy() {
    this.storage.abortController?.abort();
  },

  addKeyboardShortcuts() {
    return {
      'Mod-j': () => this.editor.commands.openAiMenu(),
    };
  },

  addCommands() {
    /** Cancels any in-flight request so a late chunk cannot revive a closed panel. */
    const cancelInFlight = () => {
      this.storage.abortController?.abort();
      this.storage.abortController = null;
      this.storage.requestToken += 1;
    };

    return {
      openAiMenu:
        () =>
        ({ state, dispatch }) => {
          cancelInFlight();
          const { from, to } = state.selection;
          if (dispatch) {
            dispatch(state.tr.setMeta(aiPluginKey, { type: 'open-menu', from, to } satisfies AiMeta));
          }
          return true;
        },

      closeAiMenu:
        () =>
        ({ state, dispatch }) => {
          cancelInFlight();
          if (dispatch) {
            dispatch(state.tr.setMeta(aiPluginKey, { type: 'close' } satisfies AiMeta));
          }
          return true;
        },

      stopAiGeneration:
        () =>
        ({ state, dispatch }) => {
          const panel = getAiState(state)?.panel;
          if (!panel || (panel.status !== 'loading' && panel.status !== 'reviewing')) return false;
          if (panel.status === 'reviewing' && !panel.suggestion.isStreaming) return false;

          cancelInFlight();
          if (!dispatch) return true;

          // Text already streamed in is worth keeping: settle it so the user
          // can accept the partial result. With nothing yet to review, fall
          // back to the command list.
          if (panel.status === 'reviewing') {
            dispatch(state.tr.setMeta(aiPluginKey, { type: 'settle' } satisfies AiMeta));
          } else {
            const { from, to } = getPanelRange(panel, state.selection);
            dispatch(state.tr.setMeta(aiPluginKey, { type: 'open-menu', from, to } satisfies AiMeta));
          }
          return true;
        },

      runAiCommand:
        (commandId: string, option?: string) =>
        ({ state, editor }) => {
          const command = this.options.commands.find((c) => c.id === commandId);
          if (!command) return false;

          const panel = getAiState(state)?.panel ?? { status: 'closed' as const };
          const { from, to } = getPanelRange(panel, state.selection);

          // A command that rewrites a selection has nothing to act on when the
          // caret is collapsed; running it anyway produces a confident answer
          // about nothing, so refuse instead.
          if (command.requiresSelection !== false && from === to) return false;
          if (command.options?.length && !option) return false;

          void runAiRequest(
            editor as Editor,
            this.options,
            this.storage,
            {
              instruction: buildAiInstruction(command, option),
              commandId: command.id,
              commandLabel: option ? `${command.label} → ${option}` : command.label,
              option,
            },
            from,
            to
          );
          return true;
        },

      submitAiPrompt:
        (instruction: string) =>
        ({ state, editor }) => {
          const trimmed = instruction.trim();
          if (!trimmed) return false;

          const panel = getAiState(state)?.panel ?? { status: 'closed' as const };
          const { from, to } = getPanelRange(panel, state.selection);
          void runAiRequest(
            editor as Editor,
            this.options,
            this.storage,
            { instruction: trimmed, commandId: 'custom', commandLabel: 'Custom' },
            from,
            to
          );
          return true;
        },

      retryAiSuggestion:
        () =>
        ({ state, editor }) => {
          const last = getAiState(state)?.lastRequest;
          if (!last) return false;
          void runAiRequest(
            editor as Editor,
            this.options,
            this.storage,
            {
              instruction: last.instruction,
              commandId: last.commandId,
              commandLabel: last.commandLabel,
              option: last.option,
            },
            last.from,
            last.to
          );
          return true;
        },

      acceptAiSuggestion:
        () =>
        ({ state, chain }) => {
          const panel = getAiState(state)?.panel;
          if (!panel || panel.status !== 'reviewing' || panel.suggestion.isStreaming) return false;

          const { from, to, suggestedText } = panel.suggestion;
          const { content } = completionToContent(suggestedText);
          if (!content) return false;

          cancelInFlight();
          return chain()
            .insertContentAt({ from, to }, content, {
              parseOptions: { preserveWhitespace: false },
            })
            .command(({ tr }) => {
              tr.setMeta(aiPluginKey, { type: 'close' } satisfies AiMeta);
              return true;
            })
            .run();
        },

      discardAiSuggestion:
        () =>
        ({ state, dispatch }) => {
          cancelInFlight();
          if (dispatch) {
            dispatch(state.tr.setMeta(aiPluginKey, { type: 'close' } satisfies AiMeta));
          }
          return true;
        },

      insertAiSuggestionBelow:
        () =>
        ({ state, chain }) => {
          const panel = getAiState(state)?.panel;
          if (!panel || panel.status !== 'reviewing' || panel.suggestion.isStreaming) return false;

          const { to, suggestedText } = panel.suggestion;
          const { content } = completionToContent(suggestedText);
          if (!content) return false;

          // Insert after the block the suggestion ends in, so the original text
          // is left exactly as it was rather than being split around the result.
          const $to = state.doc.resolve(Math.min(to, state.doc.content.size));
          const insertAt = $to.depth > 0 ? $to.after($to.depth) : $to.pos;

          cancelInFlight();
          return chain()
            .insertContentAt(insertAt, content, { parseOptions: { preserveWhitespace: false } })
            .command(({ tr }) => {
              tr.setMeta(aiPluginKey, { type: 'close' } satisfies AiMeta);
              return true;
            })
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin<AiPluginState>({
        key: aiPluginKey,
        state: {
          init() {
            return { panel: { status: 'closed' }, decorations: DecorationSet.empty, lastRequest: null };
          },
          apply(tr, value) {
            let panel = value.panel;
            let lastRequest = value.lastRequest;

            if (tr.docChanged) {
              panel = mapPanel(panel, tr.mapping);
            }

            const meta = tr.getMeta(aiPluginKey) as AiMeta | undefined;
            if (meta) {
              switch (meta.type) {
                case 'open-menu':
                  panel = { status: 'menu', from: meta.from, to: meta.to };
                  break;
                case 'set-loading':
                  panel = { status: 'loading', from: meta.from, to: meta.to, commandLabel: meta.commandLabel };
                  lastRequest = {
                    instruction: meta.instruction,
                    commandId: meta.commandId,
                    commandLabel: meta.commandLabel,
                    option: meta.option,
                    from: meta.from,
                    to: meta.to,
                  };
                  break;
                case 'set-suggestion':
                  panel = { status: 'reviewing', suggestion: meta.suggestion, commandLabel: meta.commandLabel };
                  break;
                case 'set-error':
                  panel = {
                    status: 'error',
                    from: meta.from,
                    to: meta.to,
                    commandLabel: meta.commandLabel,
                    message: meta.message,
                  };
                  break;
                case 'settle':
                  if (panel.status === 'reviewing') {
                    panel = { ...panel, suggestion: { ...panel.suggestion, isStreaming: false } };
                  }
                  break;
                case 'close':
                  panel = { status: 'closed' };
                  break;
              }
            }

            return { panel, decorations: buildDecorations(tr.doc, panel, options), lastRequest };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
