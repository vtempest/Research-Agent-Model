'use client';

import { AiPlugin, type PlateAiOptions } from '../ai-controller';
import { AIMenu } from '../ui/ai-menu';

/**
 * The writing assistant, in the shape the other kits here have: spread it into
 * the plugin list and the editor gains the `⌘/Ctrl + J` shortcut, the panel
 * that `./ui/ai-toolbar-button.tsx` opens from the bubble menu, and the
 * `KEYS.aiChat` `open` flag the floating toolbar reads to get out of its way.
 *
 * Unlike the rest of `./`, this is not a copy of Plate's registry `ai-kit`.
 * Upstream's is built on `@platejs/ai`'s `AIChatPlugin`, which needs the Vercel
 * AI SDK (`ai`, `@ai-sdk/react`) in the bundle and a streaming chat route to
 * talk to — neither of which a published editor library can bring with it. This
 * package already answers that question once, for Tiptap: a pluggable
 * `getCompletion` (see `src/extensions/Ai/README.md`) that defaults to the
 * host's rewrite endpoint. Both engines now share it, so the commands, prompts
 * and response handling are the same on either side of the port.
 *
 * Point it at a different model or command set with `createAiKit`:
 *
 * ```ts
 * createPlateEditor({
 *   plugins: [
 *     ...otherPlugins,
 *     ...createAiKit({
 *       getCompletion: createStreamingCompletion({ endpoint: '/api/ai' }),
 *       contextChars: 8000,
 *     }),
 *   ],
 * });
 * ```
 *
 * A host that only needs to swap the model at runtime can leave the kit alone
 * and call `editor.setOption(AiPlugin, 'getCompletion', fn)`; the controller
 * reads its options fresh on every request.
 */
export const createAiKit = (options?: Partial<PlateAiOptions>) => [
  AiPlugin.extend({
    options,
    render: { afterEditable: AIMenu },
  }),
];

/** The assistant with its defaults — what `plate-editor-config` spreads in. */
export const AiKit = createAiKit();
