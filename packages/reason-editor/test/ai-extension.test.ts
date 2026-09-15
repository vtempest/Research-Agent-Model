/**
 * The Ai extension's document-facing behaviour: what it refuses to run, what
 * the completion function is handed, and — the part that matters most — what
 * actually lands in the document when a suggestion is accepted.
 */

import { Editor } from '@tiptap/core';
import { BulletList } from '@tiptap/extension-bullet-list';
import { Document } from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list-item';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Ai, getAiState } from '../src/extensions/Ai';

import type { AiCompletionFn, AiCompletionRequest } from '../src/extensions/Ai/types';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** A completion that resolves immediately with `text`, recording what it was asked. */
function stubCompletion(text: string) {
  const seen: AiCompletionRequest[] = [];
  const fn: AiCompletionFn = async (request, onChunk) => {
    seen.push(request);
    onChunk(text);
    return text;
  };
  return { fn, seen };
}

function createEditor(content: string, getCompletion: AiCompletionFn, options = {}) {
  editor = new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      BulletList,
      ListItem,
      Ai.configure({ getCompletion, ...options }),
    ],
    content,
  });
  return editor;
}

/** Lets the completion promise and its dispatched transactions settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Selects the given document positions. */
function select(instance: Editor, from: number, to: number) {
  instance.commands.setTextSelection({ from, to });
}

describe('running a command', () => {
  it('refuses a rewrite command when nothing is selected', async () => {
    const { fn, seen } = stubCompletion('rewritten');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    instance.commands.setTextSelection(3);
    expect(instance.commands.runAiCommand('improve')).toBe(false);

    await settle();
    expect(seen).toHaveLength(0);
    expect(getAiState(instance.state)?.panel.status).toBe('closed');
  });

  it('runs a generate command with no selection', async () => {
    const { fn, seen } = stubCompletion('A new paragraph.');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    instance.commands.setTextSelection(3);
    expect(instance.commands.runAiCommand('continue')).toBe(true);

    await settle();
    expect(seen[0]?.mode).toBe('insert');
    expect(seen[0]?.selectedText).toBe('');
  });

  it('waits for a submenu choice before running a command that needs one', () => {
    const { fn } = stubCompletion('Hola.');
    const instance = createEditor('<p>Hello.</p>', fn);

    select(instance, 1, 6);
    expect(instance.commands.runAiCommand('translate')).toBe(false);
    expect(instance.commands.runAiCommand('translate', 'Spanish')).toBe(true);
  });

  it('passes the selection, the command id and the system prompt to the completion', async () => {
    const { fn, seen } = stubCompletion('The cat rested.');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(seen[0]).toMatchObject({
      commandId: 'improve',
      commandLabel: 'Improve writing',
      selectedText: 'The cat sat.',
      mode: 'replace',
    });
    expect(seen[0]?.systemPrompt).toContain('Return only the text');
  });

  it('clamps the document context to the configured budget', async () => {
    const { fn, seen } = stubCompletion('short');
    const long = 'word '.repeat(400);
    const instance = createEditor(`<p>${long}</p><p>Target sentence.</p>`, fn, {
      contextChars: 120,
    });

    const end = instance.state.doc.content.size - 1;
    select(instance, end - 16, end);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(seen[0]?.documentText.length).toBeLessThanOrEqual(130);
    expect(seen[0]?.documentText.length).toBeGreaterThan(0);
  });

  it('sends no context at all at a zero budget', async () => {
    const { fn, seen } = stubCompletion('short');
    const instance = createEditor('<p>The cat sat.</p>', fn, { contextChars: 0 });

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(seen[0]?.documentText).toBe('');
  });
});

describe('reviewing and accepting', () => {
  it('leaves the document untouched until the suggestion is accepted', async () => {
    const { fn } = stubCompletion('The cat rested.');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(instance.getText()).toBe('The cat sat.');
    expect(getAiState(instance.state)?.panel.status).toBe('reviewing');
  });

  it('replaces the selection on accept and closes the panel', async () => {
    const { fn } = stubCompletion('The cat rested.');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(instance.commands.acceptAiSuggestion()).toBe(true);
    expect(instance.getText()).toBe('The cat rested.');
    expect(getAiState(instance.state)?.panel.status).toBe('closed');
  });

  it('strips a chat preamble and code fence before anything reaches the document', async () => {
    const { fn } = stubCompletion("Sure! Here's the rewrite:\n\n```\nThe cat rested.\n```");
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();
    instance.commands.acceptAiSuggestion();

    expect(instance.getText()).toBe('The cat rested.');
  });

  it('writes a multi-paragraph answer as real paragraphs', async () => {
    const { fn } = stubCompletion('First para.\n\nSecond para.');
    const instance = createEditor('<p>Old.</p>', fn);

    select(instance, 1, 5);
    instance.commands.runAiCommand('longer');
    await settle();
    instance.commands.acceptAiSuggestion();

    expect(instance.getJSON().content).toHaveLength(2);
    expect(instance.getHTML()).not.toContain('First para.\n');
  });

  it('writes a bullet answer as a real list rather than literal dashes', async () => {
    const { fn } = stubCompletion('- First point\n- Second point');
    const instance = createEditor('<p>Old.</p>', fn);

    select(instance, 1, 5);
    instance.commands.runAiCommand('key-points');
    await settle();
    instance.commands.acceptAiSuggestion();

    expect(instance.getHTML()).toContain('<ul>');
    expect(instance.getText()).not.toContain('- First point');
  });

  it('keeps the original text when inserting below', async () => {
    const { fn } = stubCompletion('An added thought.');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(instance.commands.insertAiSuggestionBelow()).toBe(true);
    expect(instance.getText()).toContain('The cat sat.');
    expect(instance.getText()).toContain('An added thought.');
    expect(instance.getJSON().content).toHaveLength(2);
  });

  it('discards without touching the document', async () => {
    const { fn } = stubCompletion('Something else.');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();
    instance.commands.discardAiSuggestion();

    expect(instance.getText()).toBe('The cat sat.');
    expect(getAiState(instance.state)?.panel.status).toBe('closed');
  });

  it('reports an empty model response as an error instead of an empty suggestion', async () => {
    const { fn } = stubCompletion('   ');
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    const panel = getAiState(instance.state)?.panel;
    expect(panel?.status).toBe('error');
  });

  it('surfaces a failed completion as an error the user can retry', async () => {
    const fn: AiCompletionFn = async () => {
      throw new Error('Rate limit reached.');
    };
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    const panel = getAiState(instance.state)?.panel;
    expect(panel?.status).toBe('error');
    expect(panel && 'message' in panel && panel.message).toBe('Rate limit reached.');
  });
});

describe('cancelling', () => {
  it('keeps what already streamed when generation is stopped', async () => {
    let resolveRequest: (() => void) | undefined;
    const fn: AiCompletionFn = (request, onChunk) => {
      onChunk('Partial resu');
      return new Promise<string>((resolve) => {
        resolveRequest = () => resolve('Partial result.');
      });
    };
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    expect(instance.commands.stopAiGeneration()).toBe(true);
    const panel = getAiState(instance.state)?.panel;
    expect(panel?.status).toBe('reviewing');
    expect(panel && 'suggestion' in panel && panel.suggestion.isStreaming).toBe(false);
    expect(panel && 'suggestion' in panel && panel.suggestion.suggestedText).toBe('Partial resu');

    // A late resolution from the cancelled request must not revive the panel.
    resolveRequest?.();
    await settle();
    expect(getAiState(instance.state)?.panel.status).toBe('reviewing');
  });

  it('aborts the request when the menu is closed', async () => {
    const aborted = vi.fn();
    const fn: AiCompletionFn = (request, onChunk, signal) => {
      signal.addEventListener('abort', aborted);
      return new Promise<string>(() => {});
    };
    const instance = createEditor('<p>The cat sat.</p>', fn);

    select(instance, 1, 13);
    instance.commands.runAiCommand('improve');
    await settle();

    instance.commands.closeAiMenu();
    expect(aborted).toHaveBeenCalled();
    expect(getAiState(instance.state)?.panel.status).toBe('closed');
  });
});
