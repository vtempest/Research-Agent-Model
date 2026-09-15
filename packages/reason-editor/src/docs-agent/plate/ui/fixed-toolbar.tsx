'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import { Toolbar } from './toolbar';

/**
 * The Plate registry's sticky toolbar shell, copied in verbatim alongside the
 * rest of `./` (see `../plate-editor-config.ts` on why the registry files are
 * kept unmodified). The REASON look is layered on by the caller through
 * `className` — see `./reason-toolbar-skin.ts`.
 */
export function FixedToolbar({
  className,
  ...props
}: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      {...props}
      className={cn(
        'scrollbar-hide sticky top-0 left-0 z-40 w-full justify-between overflow-x-auto border-b border-b-border bg-background/95 p-1 backdrop-blur-sm supports-backdrop-blur:bg-background/60',
        className,
      )}
    />
  );
}
