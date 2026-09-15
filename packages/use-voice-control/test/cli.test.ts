/**
 * @fileoverview Tests for the `use-voice-control` command: option parsing, the
 * document-to-speakable-text path, and a full run with the synthesizer stubbed
 * out so no model is downloaded.
 */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { formatVoiceList, parseArgs, runCli, USAGE } from '../speech/node/cli';
import { detectFormat, loadDocument, toSpeechText } from '../speech/node/document';
import { defaultOutputPath } from '../speech/node/render';

/** Stands in for Kokoro: one sample per character, so length is predictable. */
const fakeSynthesize = async (text: string) => ({
  samples: new Float32Array(text.length),
  sampleRate: 24000,
});

/** Runs the CLI with every effect captured, and nothing on stdin. */
async function run(argv: string[], overrides: Record<string, unknown> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, {
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    synthesize: fakeSynthesize,
    stdinIsTTY: true,
    ...overrides,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const tempFiles: string[] = [];

async function tempMarkdown(content: string, name = 'doc.md'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'use-voice-control-'));
  const path = join(dir, name);
  await writeFile(path, content, 'utf8');
  tempFiles.push(path);
  return path;
}

afterEach(() => {
  tempFiles.length = 0;
});

describe('parseArgs', () => {
  it('defaults to speaking the given file with af_heart', () => {
    const options = parseArgs(['notes.md']);

    expect(options).toMatchObject({
      command: 'speak',
      input: 'notes.md',
      voice: 'af_heart',
      speed: 1,
      format: 'auto',
      quiet: false,
      errors: [],
    });
  });

  it('reads the short and long forms of the common flags', () => {
    const options = parseArgs(['a.md', '-o', 'a.wav', '-v', 'am_adam', '-s', '1.25', '-q']);

    expect(options).toMatchObject({
      output: 'a.wav',
      voice: 'am_adam',
      speed: 1.25,
      quiet: true,
      errors: [],
    });
  });

  it('accepts --flag=value', () => {
    expect(parseArgs(['a.md', '--voice=bf_emma']).voice).toBe('bf_emma');
  });

  it('maps format aliases onto the two real formats', () => {
    expect(parseArgs(['a.txt', '--format', 'md']).format).toBe('markdown');
    expect(parseArgs(['a.md', '-f', 'txt']).format).toBe('text');
  });

  it('collects the Markdown handling flags', () => {
    const options = parseArgs([
      'a.md',
      '--headings',
      'announce',
      '--code',
      'skip',
      '--links',
      'text-and-url',
      '--tables',
      'skip',
      '--front-matter',
    ]);

    expect(options.markdown).toEqual({
      headings: 'announce',
      codeBlocks: 'skip',
      links: 'text-and-url',
      tables: 'skip',
      frontMatter: true,
    });
  });

  it('treats "-" as an input rather than a flag', () => {
    expect(parseArgs(['-']).input).toBe('-');
  });

  it('lets --text start with a dash', () => {
    expect(parseArgs(['--text', '-5 degrees']).text).toBe('-5 degrees');
  });

  it('switches to the standalone commands', () => {
    expect(parseArgs(['--help']).command).toBe('help');
    expect(parseArgs(['-V']).command).toBe('version');
    expect(parseArgs(['--list-voices']).command).toBe('list-voices');
    expect(parseArgs(['a.md', '--print']).command).toBe('print');
  });

  it('rejects an unknown voice and names the way to list them', () => {
    const options = parseArgs(['a.md', '--voice', 'af_nobody']);

    expect(options.errors).toHaveLength(1);
    expect(options.errors[0]).toContain('--list-voices');
  });

  it('rejects a speed outside the supported range', () => {
    expect(parseArgs(['a.md', '--speed', '9']).errors).toEqual([
      '--speed must be between 0.5 and 2',
    ]);
  });

  it('rejects a non-numeric speed', () => {
    expect(parseArgs(['a.md', '--speed', 'fast']).errors[0]).toContain('expects a number');
  });

  it('rejects an unknown option and an unknown enum value', () => {
    expect(parseArgs(['a.md', '--nope']).errors[0]).toContain('unknown option');
    expect(parseArgs(['a.md', '--dtype', 'q3']).errors[0]).toContain('fp32');
  });

  it('rejects a flag whose value is missing', () => {
    expect(parseArgs(['a.md', '--voice']).errors).toEqual(['--voice needs a value']);
  });

  it('rejects a second input file and a file combined with --text', () => {
    expect(parseArgs(['a.md', 'b.md']).errors[0]).toContain('one file at a time');
    expect(parseArgs(['a.md', '--text', 'hi']).errors).toContain(
      'pass either a file or --text, not both'
    );
  });

  it('treats everything after -- as an input path', () => {
    expect(parseArgs(['--', '--weird-name.md']).input).toBe('--weird-name.md');
  });
});

describe('document handling', () => {
  it('picks the format from the extension', () => {
    expect(detectFormat('# hi', 'a.md')).toBe('markdown');
    expect(detectFormat('# hi', 'a.txt')).toBe('text');
    expect(detectFormat('# hi', 'A.MARKDOWN')).toBe('markdown');
  });

  it('lets an explicit format override the extension', () => {
    expect(detectFormat('# hi', 'a.txt', 'markdown')).toBe('markdown');
  });

  it('falls back to sniffing the content when there is no filename', () => {
    expect(detectFormat('# Title\n\n- a\n- b')).toBe('markdown');
    expect(detectFormat('Just a sentence.')).toBe('text');
  });

  it('passes plain text through, only trimming it', () => {
    expect(toSpeechText('  hello there  \r\n', 'text')).toBe('hello there');
  });

  it('converts Markdown files read from disk', async () => {
    const path = await tempMarkdown('# Title\n\nSome **bold** words.\n');
    const document = await loadDocument({ file: path });

    expect(document.format).toBe('markdown');
    expect(document.text).toBe('Title.\n\nSome bold words.');
    expect(document.source).toBe(path);
  });

  it('reads stdin for "-"', async () => {
    const document = await loadDocument({
      file: '-',
      readStdin: async () => '## Piped\n\n- item\n',
    });

    expect(document.text).toBe('Piped.\n\nitem.');
    expect(document.source).toBe('stdin');
  });

  it('refuses to guess when given no input at all', async () => {
    await expect(loadDocument({})).rejects.toThrow(/No input/);
  });
});

describe('defaultOutputPath', () => {
  it('swaps the extension for .wav', () => {
    expect(defaultOutputPath('/tmp/notes.md')).toBe('/tmp/notes.wav');
    expect(defaultOutputPath('notes.markdown')).toBe('notes.wav');
  });

  it('appends .wav when there is no extension', () => {
    expect(defaultOutputPath('/tmp/notes')).toBe('/tmp/notes.wav');
  });
});

describe('runCli', () => {
  it('prints usage for --help', async () => {
    const { code, out } = await run(['--help']);

    expect(code).toBe(0);
    expect(out).toBe(USAGE);
  });

  it('lists every voice with its accent and gender', async () => {
    const { code, out } = await run(['--list-voices']);

    expect(code).toBe(0);
    expect(out).toBe(formatVoiceList());
    expect(out).toContain('af_heart');
    expect(out).toContain('British English');
  });

  it('prints the speakable text for --print without synthesizing', async () => {
    const path = await tempMarkdown('# Title\n\nSee [docs](https://example.com).\n');
    const { code, out } = await run([path, '--print']);

    expect(code).toBe(0);
    expect(out).toBe('Title.\n\nSee docs.');
  });

  it('honours the Markdown flags when printing', async () => {
    const path = await tempMarkdown('# Title\n\n```js\nx\n```\n');
    const { out } = await run([path, '--print', '--headings', 'announce', '--code', 'skip']);

    expect(out).toBe('Heading: Title.');
  });

  it('writes a WAV file next to the input by default', async () => {
    const path = await tempMarkdown('# Title\n\nBody text.\n');
    const { code, err } = await run([path]);

    expect(code).toBe(0);
    const written = await readFile(path.replace(/\.md$/, '.wav'));
    expect(written.subarray(0, 4).toString()).toBe('RIFF');
    expect(err).toContain('wrote');
  });

  it('writes to the path given with -o and stays silent with --quiet', async () => {
    const path = await tempMarkdown('Hello there.\n', 'note.txt');
    const output = path.replace(/note\.txt$/, 'spoken.wav');
    const { code, err } = await run([path, '-o', output, '--quiet']);

    expect(code).toBe(0);
    expect(err).toBe('');
    expect((await readFile(output)).subarray(0, 4).toString()).toBe('RIFF');
  });

  it('speaks --text without touching the filesystem for input', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'use-voice-control-'));
    const output = join(dir, 'inline.wav');
    const { code } = await run(['--text', 'Hello there.', '-o', output]);

    expect(code).toBe(0);
    expect((await readFile(output)).byteLength).toBeGreaterThan(44);
  });

  it('reads stdin when nothing is named and stdin is a pipe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'use-voice-control-'));
    const output = join(dir, 'piped.wav');
    const { code } = await run(['-o', output], {
      stdinIsTTY: false,
      readStdin: async () => '# Piped\n\nBody.',
    });

    expect(code).toBe(0);
    expect((await readFile(output)).subarray(0, 4).toString()).toBe('RIFF');
  });

  it('fails with usage advice when there is no input', async () => {
    const { code, err } = await run([]);

    expect(code).toBe(1);
    expect(err).toContain('no input');
    expect(err).toContain('--help');
  });

  it('reports every parse error and does not synthesize', async () => {
    const { code, err } = await run(['a.md', '--voice', 'nope', '--speed', '9']);

    expect(code).toBe(1);
    expect(err).toContain('unknown voice');
    expect(err).toContain('--speed must be between 0.5 and 2');
  });

  it('reports a missing file instead of throwing', async () => {
    const { code, err } = await run(['/nope/missing.md']);

    expect(code).toBe(1);
    expect(err).toContain('use-voice-control:');
  });

  it('refuses a document with nothing to say', async () => {
    const path = await tempMarkdown('<!-- only a comment -->\n');
    const { code, err } = await run([path]);

    expect(code).toBe(1);
    expect(err).toContain('Nothing to speak');
  });

  it('passes the voice and speed through to the synthesizer', async () => {
    const seen: Record<string, unknown>[] = [];
    const dir = await mkdtemp(join(tmpdir(), 'use-voice-control-'));
    const output = join(dir, 'voiced.wav');

    await run(['--text', 'Hi.', '-o', output, '-v', 'bm_george', '-s', '1.5'], {
      synthesize: async (text: string, options: Record<string, unknown>) => {
        seen.push(options);
        return fakeSynthesize(text);
      },
    });

    expect(seen[0]).toMatchObject({ voice: 'bm_george', speed: 1.5 });
  });
});
