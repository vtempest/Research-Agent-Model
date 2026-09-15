/**
 * The pure half of the Ai extension: turning a model response into text that
 * is safe to write into a document (no chat preamble, no stray code fence),
 * deciding whether that text should be inserted as rich content, building the
 * instruction a command sends, and the fetch/stream glue host apps wire up.
 */

import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_AI_COMMANDS } from '../src/extensions/Ai/commands';
import { createStreamingCompletion } from '../src/extensions/Ai/lib/createStreamingCompletion';
import {
  completionToContent,
  hasMarkdownStructure,
  needsRichInsert,
} from '../src/extensions/Ai/lib/completionToContent';
import {
  buildAiInstruction,
  buildAiUserPrompt,
  clampContext,
  commandsForSelection,
  groupCommands,
} from '../src/extensions/Ai/lib/prompt';
import { sanitizeCompletion } from '../src/extensions/Ai/lib/sanitizeCompletion';

import type { AiCompletionRequest } from '../src/extensions/Ai/types';

describe('sanitizeCompletion', () => {
  it('drops a "here is the rewrite:" preamble', () => {
    expect(sanitizeCompletion("Sure! Here's a tighter version:\n\nThe cat sat.")).toBe(
      'The cat sat.'
    );
  });

  it('drops a bare acknowledgement prefix on the same line', () => {
    expect(sanitizeCompletion('Sure, the cat sat.')).toBe('the cat sat.');
  });

  it('keeps a sentence that merely starts like a preamble', () => {
    const text = 'Here is why the migration matters.';
    expect(sanitizeCompletion(text)).toBe(text);
  });

  it('unwraps a code fence that wraps the whole answer', () => {
    expect(sanitizeCompletion('```markdown\n# Title\n\nBody.\n```')).toBe('# Title\n\nBody.');
  });

  it('leaves a genuinely multi-block code answer alone', () => {
    const text = '```ts\nconst a = 1;\n```\n\nand\n\n```ts\nconst b = 2;\n```';
    expect(sanitizeCompletion(text)).toBe(text);
  });

  it('unwraps quotes around the whole answer but not internal quotations', () => {
    expect(sanitizeCompletion('"The cat sat."')).toBe('The cat sat.');
    expect(sanitizeCompletion('He said "no" and left.')).toBe('He said "no" and left.');
  });

  it('leaves the closing quote alone while the response is still streaming', () => {
    expect(sanitizeCompletion('"The cat sat."', { streaming: true })).toBe('"The cat sat."');
  });

  it('collapses runs of blank lines and trailing spaces', () => {
    expect(sanitizeCompletion('One.   \n\n\n\nTwo.')).toBe('One.\n\nTwo.');
  });

  it('is idempotent, so it can run on every streamed chunk', () => {
    const once = sanitizeCompletion("Here's the result:\n\n```\nHello\n```");
    expect(sanitizeCompletion(once)).toBe(once);
    expect(once).toBe('Hello');
  });

  it('returns an empty string for an empty response', () => {
    expect(sanitizeCompletion('')).toBe('');
    expect(sanitizeCompletion('   \n  ')).toBe('');
  });
});

describe('completionToContent', () => {
  it('keeps a single-line rewrite as plain text, so existing marks survive', () => {
    expect(completionToContent('A tighter sentence.')).toEqual({
      content: 'A tighter sentence.',
      isHtml: false,
    });
  });

  it('converts a bullet list into real list markup', () => {
    const { content, isHtml } = completionToContent('- First\n- Second');
    expect(isHtml).toBe(true);
    expect(content).toContain('<ul>');
    expect(content).toContain('<li>');
  });

  it('treats multi-paragraph text as rich content rather than one block', () => {
    expect(needsRichInsert('One.\n\nTwo.')).toBe(true);
    expect(completionToContent('One.\n\nTwo.').isHtml).toBe(true);
  });

  it('does not mistake a hyphenated sentence for a list', () => {
    expect(hasMarkdownStructure('A well-known result.')).toBe(false);
  });

  it('strips table wrappers the editor schema has no node for', () => {
    const { content } = completionToContent('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(content).toContain('<table>');
    expect(content).not.toContain('<tbody>');
  });
});

describe('command resolution', () => {
  it('hides selection-only commands when nothing is selected', () => {
    const available = commandsForSelection(DEFAULT_AI_COMMANDS, false);
    expect(available.length).toBeGreaterThan(0);
    expect(available.every((command) => command.requiresSelection === false)).toBe(true);
    expect(available.map((c) => c.id)).toContain('continue');
    expect(available.map((c) => c.id)).not.toContain('improve');
  });

  it('offers every command once there is a selection', () => {
    expect(commandsForSelection(DEFAULT_AI_COMMANDS, true)).toHaveLength(DEFAULT_AI_COMMANDS.length);
  });

  it('groups commands in menu order and drops empty groups', () => {
    const sections = groupCommands(commandsForSelection(DEFAULT_AI_COMMANDS, false));
    expect(sections.every((section) => section.commands.length > 0)).toBe(true);
    expect(sections.map((section) => section.group)).toEqual(['generate']);
  });

  it('appends a submenu choice to a prompt that ends in a colon', () => {
    const translate = DEFAULT_AI_COMMANDS.find((command) => command.id === 'translate')!;
    expect(buildAiInstruction(translate, 'Spanish')).toMatch(/Target language: Spanish\.$/);
  });

  it('parenthesises a choice for a prompt that does not end in a colon', () => {
    const improve = DEFAULT_AI_COMMANDS.find((command) => command.id === 'improve')!;
    expect(buildAiInstruction(improve, 'British English')).toMatch(/\(British English\)$/);
  });

  it('gives every default command a unique id and a prompt', () => {
    const ids = DEFAULT_AI_COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_AI_COMMANDS.every((command) => command.prompt.trim().length > 20)).toBe(true);
  });
});

describe('clampContext', () => {
  it('keeps the text nearest the selection when the window overflows', () => {
    const clamped = clampContext('abcdefghij', 4);
    expect(clamped).toBe('…ghij');
  });

  it('passes short context through untouched', () => {
    expect(clampContext('abc', 10)).toBe('abc');
  });

  it('drops context entirely at a zero budget', () => {
    expect(clampContext('abc', 0)).toBe('');
  });
});

describe('buildAiUserPrompt', () => {
  it('names the text to act on when replacing a selection', () => {
    const prompt = buildAiUserPrompt({
      instruction: 'Fix grammar.',
      selectedText: 'the cat sat',
      documentText: 'Some context.',
      mode: 'replace',
    });
    expect(prompt).toContain('Instruction:\nFix grammar.');
    expect(prompt).toContain('Text to act on:\nthe cat sat');
    expect(prompt).toContain('Some context.');
  });

  it('says there is no selection when generating at the caret', () => {
    const prompt = buildAiUserPrompt({
      instruction: 'Continue.',
      selectedText: '',
      documentText: '',
      mode: 'insert',
    });
    expect(prompt).toContain('No text is selected');
  });
});

/** Builds a `Response` whose body streams the given chunks. */
function streamingResponse(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers });
}

const REQUEST: AiCompletionRequest = {
  instruction: 'Improve this.',
  selectedText: 'the cat sat',
  documentText: '',
  commandId: 'improve',
  commandLabel: 'Improve writing',
  systemPrompt: 'system',
  mode: 'replace',
};

describe('createStreamingCompletion', () => {
  it('accumulates a plain text stream and reports each step', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamingResponse(['The cat ', 'sat down.'])));

    const chunks: string[] = [];
    const result = await createStreamingCompletion()(REQUEST, (text) => chunks.push(text), new AbortController().signal);

    expect(result).toBe('The cat sat down.');
    expect(chunks).toEqual(['The cat ', 'The cat sat down.']);
  });

  it('decodes an OpenAI-style SSE stream, ignoring [DONE]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamingResponse(
          [
            'data: {"choices":[{"delta":{"content":"The cat "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"sat."}}]}\n\ndata: [DONE]\n\n',
          ],
          { 'content-type': 'text/event-stream' }
        )
      )
    );

    const result = await createStreamingCompletion()(REQUEST, () => {}, new AbortController().signal);
    expect(result).toBe('The cat sat.');
  });

  it('reassembles an SSE event split across two network chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamingResponse(['data: {"choices":[{"delta":{"con', 'tent":"Whole."}}]}\n\n'], {
          'content-type': 'text/event-stream',
        })
      )
    );

    const result = await createStreamingCompletion()(REQUEST, () => {}, new AbortController().signal);
    expect(result).toBe('Whole.');
  });

  it('accepts a plain JSON rewrite response as a single chunk', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ rewrittenText: 'The cat rested.' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
      )
    );

    const chunks: string[] = [];
    const result = await createStreamingCompletion()(
      REQUEST,
      (text) => chunks.push(text),
      new AbortController().signal
    );

    expect(result).toBe('The cat rested.');
    expect(chunks).toEqual(['The cat rested.']);
  });

  it('surfaces the server error message rather than a bare status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Rate limit reached.' }), {
            status: 429,
            headers: { 'content-type': 'application/json' },
          })
      )
    );

    await expect(
      createStreamingCompletion()(REQUEST, () => {}, new AbortController().signal)
    ).rejects.toThrow('Rate limit reached.');
  });

  it('posts the whole request to the configured endpoint', async () => {
    const fetchMock = vi.fn(async () => streamingResponse(['ok']));
    vi.stubGlobal('fetch', fetchMock);

    await createStreamingCompletion({ endpoint: '/api/write', headers: { 'X-Test': '1' } })(
      REQUEST,
      () => {},
      new AbortController().signal
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/write');
    expect((init.headers as Record<string, string>)['X-Test']).toBe('1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      commandId: 'improve',
      instruction: 'Improve this.',
      systemPrompt: 'system',
    });
  });
});
