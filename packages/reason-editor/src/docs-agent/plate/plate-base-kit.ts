/**
 * The static ("base") mirror of `./plate-editor-config.ts`'s `platePlugins`.
 *
 * Plate splits every feature in two: a React plugin that renders an editable
 * node, and a *base* plugin that renders the same node without React hooks or
 * browser events. `plateBasePlugins` is the second half — the `./kits/*-base-kit`
 * files, each already pointing at its `./ui/*-node-static` component — and it
 * exists for one job: `serializeHtml`, which renders a document to an HTML
 * string outside the editor (see `./plate-to-html.ts`).
 *
 * Only node-rendering features appear here. Editing affordances — the slash
 * menu, autoformat, exit-break, block placeholder, dictation — have nothing to
 * contribute to a serialized document, so the registry ships no base kit for
 * them and none is needed.
 *
 * Keep the order aligned with `platePlugins`: when a feature is added there,
 * add its base kit here too, or documents using it serialize to bare
 * paragraphs.
 */

import { BaseAlignKit } from './kits/align-base-kit';
import { BaseBasicBlocksKit } from './kits/basic-blocks-base-kit';
import { BaseBasicMarksKit } from './kits/basic-marks-base-kit';
import { BaseCalloutKit } from './kits/callout-base-kit';
import { BaseCodeBlockKit } from './kits/code-block-base-kit';
import { BaseColumnKit } from './kits/column-base-kit';
import { BaseFontKit } from './kits/font-base-kit';
import { BaseIndentKit } from './kits/indent-base-kit';
import { BaseLineHeightKit } from './kits/line-height-base-kit';
import { BaseLinkKit } from './kits/link-base-kit';
import { BaseListKit } from './kits/list-base-kit';
import { BaseMathKit } from './kits/math-base-kit';
import { BaseMediaKit } from './kits/media-base-kit';
import { BaseMentionKit } from './kits/mention-base-kit';
import { BaseTableKit } from './kits/table-base-kit';
import { BaseTocKit } from './kits/toc-base-kit';
import { BaseToggleKit } from './kits/toggle-base-kit';

export const plateBasePlugins = [
  // 1. Basic text, headings, inline marks.
  ...BaseBasicBlocksKit,
  ...BaseBasicMarksKit,

  // 2. Lists and code blocks.
  ...BaseListKit,
  ...BaseCodeBlockKit,

  // 3. Links, colours/highlighting, alignment, indentation, line height.
  ...BaseLinkKit,
  ...BaseFontKit,
  ...BaseAlignKit,
  ...BaseIndentKit,
  ...BaseLineHeightKit,

  // 4. Tables.
  ...BaseTableKit,

  // 5. Images/media.
  ...BaseMediaKit,

  // 6. Structured blocks.
  ...BaseCalloutKit,
  ...BaseColumnKit,
  ...BaseMathKit,
  ...BaseToggleKit,
  ...BaseTocKit,

  // 7. Mentions — the only inline of the editing group that survives
  //    serialization as a node of its own.
  ...BaseMentionKit,
];
