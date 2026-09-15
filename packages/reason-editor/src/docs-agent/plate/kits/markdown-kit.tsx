import {
  BaseFootnoteDefinitionPlugin,
  BaseFootnoteReferencePlugin,
} from '@platejs/footnote';
import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { type AnySlatePlugin, KEYS } from 'platejs';
import remarkEmoji from 'remark-emoji';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/**
 * Annotated rather than inferred: `MarkdownPlugin.configure()` infers a type
 * that reaches into `remark-stringify`'s `Options`, which under bun's install
 * layout is only nameable through a `.bun/remark-stringify@x.y.z/...` path.
 * Declaration emit refuses to write that (TS2883), so pin the public shape.
 */
export const MarkdownKit: AnySlatePlugin[] = [
  BaseFootnoteReferencePlugin,
  BaseFootnoteDefinitionPlugin,
  MarkdownPlugin.configure({
    options: {
      plainMarks: [KEYS.suggestion, KEYS.comment],
      remarkPlugins: [
        remarkMath,
        remarkGfm,
        remarkEmoji as any,
        remarkMdx,
        remarkMention,
      ],
    },
  }),
];
