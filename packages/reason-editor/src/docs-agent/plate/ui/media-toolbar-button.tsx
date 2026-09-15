'use client';

import * as React from 'react';

import {
  AudioLinesIcon,
  FileUpIcon,
  FilmIcon,
  ImageIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';

import { insertBlock } from '@/docs-agent/plate/kits/transforms';

import { ToolbarButton } from './toolbar';

const MEDIA = {
  [KEYS.audio]: { icon: AudioLinesIcon, label: 'Audio' },
  [KEYS.file]: { icon: FileUpIcon, label: 'File' },
  [KEYS.img]: { icon: ImageIcon, label: 'Image' },
  [KEYS.video]: { icon: FilmIcon, label: 'Video' },
} as const;

export type MediaNodeType = keyof typeof MEDIA;

/**
 * One button per media type. Insertion goes through `insertBlock`, which routes
 * images and embeds to `insertMedia` (URL prompt) and video/audio/file to their
 * placeholder transforms (file picker) — the same paths the slash menu uses, so
 * upload behaviour never forks between the two entry points.
 */
export function MediaToolbarButton({
  nodeType,
  ...props
}: React.ComponentProps<typeof ToolbarButton> & { nodeType: MediaNodeType }) {
  const editor = useEditorRef();
  const { icon: Icon, label } = MEDIA[nodeType];

  return (
    <ToolbarButton
      {...props}
      onClick={() => {
        insertBlock(editor, nodeType);
        editor.tf.focus();
      }}
      tooltip={label}
    >
      <Icon />
    </ToolbarButton>
  );
}
