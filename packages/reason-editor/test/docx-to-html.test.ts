/**
 * Guards the docx-preview entry point the DOCX importer renders through.
 *
 * docx-preview 0.4 changed `renderDocument` from
 * `(document, bodyContainer, styleContainer, options)` to
 * `(document, options) => Promise<Node[]>`. The extra arguments are simply
 * ignored at runtime, so the importer kept calling it with containers that
 * were never filled and every import came back empty — while the type error it
 * raised ("Expected 1-2 arguments, but got 4") was the only visible symptom.
 * `renderAsync` is the entry point that still fills containers.
 */

import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';

// Mirrors docx-preview 0.4's real surface: `renderDocument` returns the
// rendered nodes and touches no container, `renderAsync` fills the ones it is
// given.
const { parseAsync, renderAsync, renderDocument } = vi.hoisted(() => ({
  parseAsync: vi.fn(async () => ({ parsed: true })),
  renderDocument: vi.fn(async () => [] as Node[]),
  renderAsync: vi.fn(
    async (
      _data: unknown,
      bodyContainer: HTMLElement,
      styleContainer?: HTMLElement,
    ) => {
      bodyContainer.innerHTML = '<p>Dictated by the fixture</p>';
      if (styleContainer) styleContainer.textContent = '.docx { color: red; }';
    },
  ),
}));

vi.mock('docx-preview', () => ({ parseAsync, renderAsync, renderDocument }));

import { convertDocxToHTML } from '../src/extensions/ImportWord/docx-to-html';

/** The smallest zip `convertDocxToHTML` will accept as a .docx. */
async function docxFixture(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('word/styles.xml', '<?xml version="1.0"?><w:styles></w:styles>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document></w:document>');
  return (await zip.generateAsync({ type: 'arraybuffer' })) as ArrayBuffer;
}

describe('convertDocxToHTML', () => {
  it('renders through the entry point that fills the containers', async () => {
    const html = await convertDocxToHTML(await docxFixture());

    expect(renderAsync).toHaveBeenCalledTimes(1);
    const [, bodyContainer, styleContainer] = renderAsync.mock.calls[0]!;
    expect((bodyContainer as HTMLElement).tagName).toBe('DIV');
    expect((styleContainer as HTMLElement).tagName).toBe('STYLE');

    expect(html).toContain('Dictated by the fixture');
  });

  it('reads plain text back out of the rendered body', async () => {
    const text = await convertDocxToHTML(await docxFixture(), {
      plainTextOnly: true,
    });

    expect(text).toBe('Dictated by the fixture');
  });
});
