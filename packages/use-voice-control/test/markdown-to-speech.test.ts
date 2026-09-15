/**
 * @fileoverview Tests for the Markdown-to-speech converter: that the marks stop
 * being read out, that the structure they encoded survives as spoken blocks, and
 * that the per-element options behave.
 */
import { describe, expect, it } from 'vitest';

import {
  looksLikeMarkdown,
  markdownToSpeech,
  markdownToSpeechSegments,
  stripInlineMarkdown,
} from '../speech/utils/markdown-to-speech';

describe('stripInlineMarkdown', () => {
  it('drops emphasis marks but keeps the words', () => {
    expect(stripInlineMarkdown('a **bold** and *italic* and ***both***')).toBe(
      'a bold and italic and both'
    );
  });

  it('drops strikethrough and underscore emphasis', () => {
    expect(stripInlineMarkdown('~~gone~~ and __strong__ and _quiet_')).toBe(
      'gone and strong and quiet'
    );
  });

  it('leaves underscores inside identifiers alone', () => {
    expect(stripInlineMarkdown('call snake_case_name twice')).toBe('call snake_case_name twice');
  });

  it('reads code spans without their backticks', () => {
    expect(stripInlineMarkdown('run `npm install` now')).toBe('run npm install now');
  });

  it('does not treat marks inside a code span as emphasis', () => {
    expect(stripInlineMarkdown('`a * b * c`')).toBe('a * b * c');
  });

  it('speaks link text and drops the URL', () => {
    expect(stripInlineMarkdown('see [the docs](https://example.com/docs) first')).toBe(
      'see the docs first'
    );
  });

  it('reads the URL too when asked', () => {
    expect(
      stripInlineMarkdown('see [docs](https://example.com)', { links: 'text-and-url' })
    ).toBe('see docs, https://example.com');
  });

  it('speaks image alt text, or nothing when images are skipped', () => {
    expect(stripInlineMarkdown('![a red bus](bus.png)')).toBe('a red bus');
    expect(stripInlineMarkdown('![a red bus](bus.png)', { images: 'skip' })).toBe('');
  });

  it('keeps escaped marks as literal characters', () => {
    expect(stripInlineMarkdown('literal \\*stars\\* here')).toBe('literal *stars* here');
  });

  it('strips raw HTML tags and decodes entities', () => {
    expect(stripInlineMarkdown('<span class="x">tea &amp; toast</span>')).toBe('tea & toast');
  });

  it('drops footnote references', () => {
    expect(stripInlineMarkdown('a claim[^1] stands')).toBe('a claim stands');
  });
});

describe('markdownToSpeechSegments', () => {
  it('reads a heading as a heading rather than its hashes', () => {
    const segments = markdownToSpeechSegments('## Getting Started');

    expect(segments).toEqual([{ type: 'heading', text: 'Getting Started.', level: 2 }]);
  });

  it('records the heading level and ignores closing hashes', () => {
    const segments = markdownToSpeechSegments('#### Deep ####');

    expect(segments[0]).toEqual({ type: 'heading', text: 'Deep.', level: 4 });
  });

  it('recognises setext headings', () => {
    const segments = markdownToSpeechSegments('Title\n=====\n\nBody text.');

    expect(segments).toEqual([
      { type: 'heading', text: 'Title.', level: 1 },
      { type: 'paragraph', text: 'Body text.' },
    ]);
  });

  it('announces headings when asked, and skips them when asked', () => {
    expect(markdownToSpeechSegments('# Intro', { headings: 'announce' })[0].text).toBe(
      'Heading: Intro.'
    );
    expect(markdownToSpeechSegments('# Intro\n\nBody.', { headings: 'skip' })).toEqual([
      { type: 'paragraph', text: 'Body.' },
    ]);
  });

  it('joins the soft-wrapped lines of a paragraph', () => {
    const segments = markdownToSpeechSegments('one line\nand its continuation');

    expect(segments).toEqual([{ type: 'paragraph', text: 'one line and its continuation.' }]);
  });

  it('strips list markers and keeps ordered numbers', () => {
    const segments = markdownToSpeechSegments('- first\n* second\n1. third');

    expect(segments.map((s) => s.text)).toEqual(['first.', 'second.', '1. third.']);
    expect(segments.every((s) => s.type === 'list-item')).toBe(true);
  });

  it('strips task list checkboxes', () => {
    expect(markdownToSpeechSegments('- [ ] todo\n- [x] done').map((s) => s.text)).toEqual([
      'todo.',
      'done.',
    ]);
  });

  it('announces a fenced code block instead of reading it', () => {
    const segments = markdownToSpeechSegments('```ts\nconst x = 1;\n```');

    expect(segments).toEqual([{ type: 'code', text: 'TypeScript code block.' }]);
  });

  it('reads or skips code blocks on request', () => {
    expect(markdownToSpeechSegments('```\nhi there\n```', { codeBlocks: 'read' })[0].text).toBe(
      'hi there.'
    );
    expect(markdownToSpeechSegments('```\nhi\n```', { codeBlocks: 'skip' })).toEqual([]);
  });

  it('never reads the contents of an announced code block', () => {
    const text = markdownToSpeech('```js\n### not a heading\n**not bold**\n```');

    expect(text).toBe('JavaScript code block.');
  });

  it('strips blockquote markers and marks the block as a quote', () => {
    expect(markdownToSpeechSegments('> a quoted line')).toEqual([
      { type: 'quote', text: 'a quoted line.' },
    ]);
  });

  it('reads table rows as cells and drops the delimiter row', () => {
    const segments = markdownToSpeechSegments('| Name | Age |\n| --- | --- |\n| Ada | 36 |');

    expect(segments.map((s) => s.text)).toEqual(['Name, Age.', 'Ada, 36.']);
    expect(segments.every((s) => s.type === 'table-row')).toBe(true);
  });

  it('skips YAML front matter by default and reads it on request', () => {
    const doc = '---\ntitle: Notes\n---\n\nBody.';

    expect(markdownToSpeechSegments(doc).map((s) => s.text)).toEqual(['Body.']);
    expect(markdownToSpeechSegments(doc, { frontMatter: true }).map((s) => s.text)).toContain(
      'title: Notes.'
    );
  });

  it('drops horizontal rules, comments and link reference definitions', () => {
    const doc = 'Before.\n\n---\n\n<!-- hidden -->\n\n[ref]: https://example.com\n\nAfter.';

    expect(markdownToSpeechSegments(doc).map((s) => s.text)).toEqual(['Before.', 'After.']);
  });

  it('adds a full stop only where one is missing', () => {
    const segments = markdownToSpeechSegments('# Ready?\n\nAlready done.\n\nNo punctuation');

    expect(segments.map((s) => s.text)).toEqual(['Ready?', 'Already done.', 'No punctuation.']);
  });

  it('leaves the text alone when terminal punctuation is turned off', () => {
    expect(
      markdownToSpeechSegments('# Ready', { addTerminalPunctuation: false })[0].text
    ).toBe('Ready');
  });

  it('handles an empty document', () => {
    expect(markdownToSpeechSegments('')).toEqual([]);
    expect(markdownToSpeech('')).toBe('');
  });
});

describe('markdownToSpeech', () => {
  it('never leaves a Markdown mark in the spoken text', () => {
    const doc = [
      '# Title',
      '',
      'A paragraph with **bold**, `code`, and a [link](https://example.com).',
      '',
      '## Section',
      '',
      '- one',
      '- two',
      '',
      '> quoted',
      '',
      '```py',
      'print("hi")',
      '```',
    ].join('\n');

    const spoken = markdownToSpeech(doc);

    expect(spoken).not.toMatch(/[#*`>|]/);
    expect(spoken).not.toContain('https://example.com');
    expect(spoken).toContain('Title.');
    expect(spoken).toContain('Python code block.');
  });

  it('separates blocks with a blank line so the chunker breaks on them', () => {
    expect(markdownToSpeech('# Title\n\nBody.')).toBe('Title.\n\nBody.');
  });

  it('keeps a run of list items in one block', () => {
    expect(markdownToSpeech('- one\n- two')).toBe('one.\ntwo.');
  });
});

describe('looksLikeMarkdown', () => {
  it('recognises a document with several Markdown signals', () => {
    expect(looksLikeMarkdown('# Title\n\n- a bullet\n- another')).toBe(true);
  });

  it('does not mistake prose for Markdown', () => {
    expect(looksLikeMarkdown('Just a couple of ordinary sentences. Nothing special.')).toBe(
      false
    );
  });

  it('is false for empty input', () => {
    expect(looksLikeMarkdown('')).toBe(false);
  });
});
