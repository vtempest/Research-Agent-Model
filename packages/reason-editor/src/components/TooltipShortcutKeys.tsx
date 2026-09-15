/**
 * Shortcut hint rendered inside a toolbar tooltip: the action's *current*
 * binding (user overrides included) as a row of highlighted <kbd> chips.
 */

import React from 'react';

import { useLiveShortcutKeys } from '@/shortcuts';
import { getShortcutKey } from '@/utils/plateform';

export interface TooltipShortcutKeysProps {
  /* Registry action id, when known */
  shortcutId?: string;
  /* Default keys, matched against the registry to find the live binding */
  shortcutKeys?: string[];
}

export function TooltipShortcutKeys({ shortcutId, shortcutKeys }: TooltipShortcutKeysProps) {
  const keys = useLiveShortcutKeys(shortcutKeys, shortcutId);

  if (!keys?.length) return null;

  return (
    <span className='richtext-mt-1 richtext-flex richtext-flex-wrap richtext-items-center richtext-justify-center richtext-gap-[0.1875rem]'>
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className='richtext-inline-flex richtext-h-[1.125rem] richtext-min-w-[1.25rem] richtext-items-center richtext-justify-center richtext-whitespace-nowrap richtext-rounded richtext-border richtext-border-b-2 richtext-border-popover-foreground/22 richtext-bg-popover-foreground/10 richtext-px-[0.3125rem] richtext-font-[inherit] richtext-text-[0.6875rem] richtext-font-semibold richtext-leading-none richtext-text-popover-foreground'
        >
          {getShortcutKey(key)}
        </kbd>
      ))}
    </span>
  );
}
