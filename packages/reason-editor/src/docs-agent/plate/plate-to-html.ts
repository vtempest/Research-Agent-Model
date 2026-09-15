/**
 * Serializes a Plate value back to the HTML the document store persists.
 *
 * The inverse of `./html-to-plate.ts`, and the half that makes Plate usable as
 * the product's default editor rather than only as a collaboration surface:
 * `ReasonDocs` stores each document as an HTML string, so an editor that cannot
 * hand HTML back cannot be saved.
 *
 * Serialization goes through Plate's `serializeHtml`, which renders the
 * document with the *static* plugin set (`./plate-base-kit.ts`) — the same node
 * components, minus the editing behaviour. Two post-steps keep the stored
 * markup interchangeable with what the Tiptap editor wrote:
 *
 *   - Tailwind classes and Slate's per-node data attributes are stripped, so
 *     what lands in the store is semantic HTML (`<h1>`, `<ul>`, `<strong>`)
 *     rather than a snapshot of the editor's styling. Formatting carried as
 *     inline `style` — alignment, indent, colour, font — is injected by the
 *     plugins themselves and survives.
 *   - The editor's own wrapper element is unwrapped, because the store holds a
 *     document body, not a rendered editor.
 */

import { createSlateEditor, type Value } from 'platejs';
import { getEditorDOMFromHtmlString, serializeHtml } from 'platejs/static';

import { plateBasePlugins } from './plate-base-kit';
import { EditorStatic } from './ui/editor-static';

export async function plateValueToHtml(value: Value | undefined | null): Promise<string> {
  if (!value?.length) return '';

  const editor = createSlateEditor({ plugins: plateBasePlugins as any, value });

  const html = await serializeHtml(editor, {
    editorComponent: EditorStatic,
    stripClassNames: true,
    stripDataAttributes: true,
  });

  // `stripDataAttributes` leaves `data-slate-editor` in place — it is the hook
  // Plate itself uses to find the root — so the wrapper is still locatable here.
  const root = getEditorDOMFromHtmlString(html);

  return root ? root.innerHTML : html;
}
