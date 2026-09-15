/**
 * Exercises the Plate writing assistant — the state machine behind the bubble
 * menu's "Ask AI" button — against a fake completion function, the way
 * `test/ai-extension.test.ts` exercises the Tiptap `Ai` extension.
 *
 * The rule under test throughout: nothing reaches the document until the user
 * accepts, and what is written is the sanitised result the panel showed.
 */

import { createPlateEditor } from 'platejs/react';
import { describe, expect, it, vi } from 'vitest';

import { AiPlugin, getPlateAiController } from '../../src/docs-agent/plate/ai-controller';
import { platePlugins } from '../../src/docs-agent/plate/plate-editor-config';

import type { AiCompletionFn } from '../../src/extensions/Ai/types';

const PARAGRAPH = 'The cat sat on the mat.';

function createEditor(getCompletion: AiCompletionFn) {
  const editor = createPlateEditor({
    plugins: platePlugins as any,
    value: [
      { children: [{ text: PARAGRAPH }], type: 'p' },
      { children: [{ text: 'A second block.' }], type: 'p' },
    ],
  });

  editor.setOption(AiPlugin, 'getCompletion', getCompletion);
  // The DOM-facing half of `accept()`/`insertBelow()` has no editable to focus
  // in jsdom; the document writes are what these tests are about.
  editor.tf.focus = vi.fn() as any;

  return editor;
}

/** Resolves immediately with `text`, streaming it in `chunks` pieces first. */
function completionOf(text: string, chunks: string[] = []): AiCompletionFn {
  return async (_request, onChunk) => {
    chunks.forEach((chunk) => onChunk(chunk));
    return text;
  };
}

/** Selects the whole first paragraph. */
function selectFirstParagraph(editor: ReturnType<typeof createEditor>) {
  editor.tf.select({
    anchor: { offset: 0, path: [0, 0] },
    focus: { offset: PARAGRAPH.length, path: [0, 0] },
  });
}

const firstBlockText = (editor: ReturnType<typeof createEditor>) =>
  (editor.children[0] as any).children.map((child: any) => child.text).join('');

describe('plate ai controller', () => {
  it('is part of the default plugin set, so the bubble button has a panel to open', () => {
    const editor = createEditor(completionOf('x'));

    // Registered under `KEYS.aiChat`, which is the key
    // `ui/floating-toolbar.tsx` reads to hide itself while the panel is up.
    expect(editor.getPlugin(AiPlugin).key).toBe('aiChat');
    expect(editor.getOption(AiPlugin, 'commands').length).toBeGreaterThan(0);
  });

  it('opens over the current selection and flags the panel open', () => {
    const editor = createEditor(completionOf('x'));
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();

    const panel = ai.getState();
    expect(panel.status).toBe('menu');
    // The floating toolbar reads this flag to get out of the panel's way.
    expect(editor.getOption(AiPlugin, 'open')).toBe(true);

    ai.close();
    expect(ai.getState().status).toBe('closed');
    expect(editor.getOption(AiPlugin, 'open')).toBe(false);
  });

  it('offers only the caret-safe commands with nothing selected', () => {
    const editor = createEditor(completionOf('x'));
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 0, path: [0, 0] },
    });

    const ai = getPlateAiController(editor);
    ai.open();

    const ids = ai.availableCommands().map((command) => command.id);
    expect(ids).toContain('continue');
    expect(ids).not.toContain('improve');
  });

  it('refuses a rewrite command at a collapsed caret', () => {
    const getCompletion = vi.fn(completionOf('x'));
    const editor = createEditor(getCompletion);
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 0, path: [0, 0] },
    });

    const ai = getPlateAiController(editor);
    ai.open();

    expect(ai.runCommand('improve')).toBe(false);
    expect(getCompletion).not.toHaveBeenCalled();
  });

  it('streams a suggestion without touching the document, then replaces on accept', async () => {
    const editor = createEditor(completionOf('The cat rested.', ['The cat', 'The cat rested.']));
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    expect(ai.runCommand('improve')).toBe(true);

    await vi.waitFor(() => {
      const panel = ai.getState();
      expect(panel.status === 'reviewing' && !panel.suggestion.isStreaming).toBe(true);
    });

    // Still nothing written.
    expect(firstBlockText(editor)).toBe(PARAGRAPH);

    expect(ai.accept()).toBe(true);
    expect(firstBlockText(editor)).toBe('The cat rested.');
    expect(ai.getState().status).toBe('closed');
  });

  it('sends the selection and a bounded context window to the completion', async () => {
    const getCompletion = vi.fn(completionOf('ok'));
    const editor = createEditor(getCompletion);
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('improve');

    await vi.waitFor(() => expect(getCompletion).toHaveBeenCalled());

    const request = getCompletion.mock.calls[0][0];
    expect(request.selectedText).toBe(PARAGRAPH);
    expect(request.mode).toBe('replace');
    expect(request.documentText).toContain('A second block.');
    expect(request.documentText).not.toContain(PARAGRAPH);
  });

  it('strips a chat preamble before it is ever shown', async () => {
    const editor = createEditor(completionOf("Sure! Here's a tighter version:\n\nThe cat sat."));
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('improve');

    await vi.waitFor(() => {
      const panel = ai.getState();
      expect(panel.status === 'reviewing' && !panel.suggestion.isStreaming).toBe(true);
    });

    const panel = ai.getState();
    expect(panel.status === 'reviewing' && panel.suggestion.suggestedText).toBe('The cat sat.');
  });

  it('inserts a Markdown answer below as real blocks, leaving the original alone', async () => {
    const editor = createEditor(completionOf('- first point\n- second point'));
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('key-points');

    await vi.waitFor(() => {
      const panel = ai.getState();
      expect(panel.status === 'reviewing' && !panel.suggestion.isStreaming).toBe(true);
    });

    const blocksBefore = editor.children.length;
    expect(ai.insertBelow()).toBe(true);

    expect(firstBlockText(editor)).toBe(PARAGRAPH);
    expect(editor.children.length).toBeGreaterThan(blocksBefore);
    // The list markers became structure, not literal text.
    expect(JSON.stringify(editor.children)).not.toContain('- first point');
    expect(JSON.stringify(editor.children)).toContain('first point');
  });

  it('discards without writing anything', async () => {
    const editor = createEditor(completionOf('Something else entirely.'));
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('improve');

    await vi.waitFor(() => expect(ai.getState().status).toBe('reviewing'));

    ai.discard();
    expect(ai.getState().status).toBe('closed');
    expect(firstBlockText(editor)).toBe(PARAGRAPH);
  });

  it('keeps what has streamed in when generation is stopped', async () => {
    let release: (() => void) | undefined;
    const getCompletion: AiCompletionFn = async (_request, onChunk) => {
      onChunk('Half a sen');
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return 'Half a sentence, finished.';
    };

    const editor = createEditor(getCompletion);
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('improve');

    await vi.waitFor(() => expect(ai.getState().status).toBe('reviewing'));
    ai.stop();

    const panel = ai.getState();
    expect(panel.status === 'reviewing' && panel.suggestion.isStreaming).toBe(false);
    expect(panel.status === 'reviewing' && panel.suggestion.suggestedText).toBe('Half a sen');

    // A late resolution of the cancelled request must not revive the panel.
    release?.();
    await Promise.resolve();
    expect(
      ai.getState().status === 'reviewing' &&
        (ai.getState() as any).suggestion.suggestedText,
    ).toBe('Half a sen');
  });

  it('surfaces an empty answer as an error rather than an empty edit', async () => {
    const editor = createEditor(completionOf('   '));
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('improve');

    await vi.waitFor(() => expect(ai.getState().status).toBe('error'));
    expect((ai.getState() as any).message).toMatch(/empty response/i);
    expect(firstBlockText(editor)).toBe(PARAGRAPH);
  });

  it('surfaces a failed request, and retries the same instruction', async () => {
    const getCompletion = vi
      .fn<AiCompletionFn>()
      .mockRejectedValueOnce(new Error('Model unavailable'))
      .mockResolvedValueOnce('Second time lucky.');

    const editor = createEditor(getCompletion as unknown as AiCompletionFn);
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    ai.runCommand('improve');

    await vi.waitFor(() => expect(ai.getState().status).toBe('error'));
    expect((ai.getState() as any).message).toBe('Model unavailable');

    expect(ai.retry()).toBe(true);
    await vi.waitFor(() => expect(ai.getState().status).toBe('reviewing'));
    expect(getCompletion.mock.calls[1][0].instruction).toBe(
      getCompletion.mock.calls[0][0].instruction,
    );
  });

  it('runs a free-form prompt as a custom command', async () => {
    const getCompletion = vi.fn(completionOf('Rewritten.'));
    const editor = createEditor(getCompletion);
    selectFirstParagraph(editor);

    const ai = getPlateAiController(editor);
    ai.open();
    expect(ai.submitPrompt('  make it rhyme  ')).toBe(true);
    expect(ai.submitPrompt('   ')).toBe(false);

    await vi.waitFor(() => expect(getCompletion).toHaveBeenCalledTimes(1));
    expect(getCompletion.mock.calls[0][0].instruction).toBe('make it rhyme');
    expect(getCompletion.mock.calls[0][0].commandId).toBe('custom');
  });
});
