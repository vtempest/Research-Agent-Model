/**
 * The REASON toolbar's look, expressed as classes that can be dropped on any
 * container of Plate registry toolbar buttons.
 *
 * The playground toolbar is assembled from `./*-toolbar-button.tsx`, which are
 * the Plate shadcn registry's components copied in verbatim (see
 * `../plate-editor-config.ts`) — they must stay regenerable, so they are not
 * edited to match the product. Their default look is shadcn's theme tokens
 * (`h-8 rounded-md hover:bg-muted aria-checked:bg-accent`), which reads a shade
 * heavier than `shared/toolbar-renderer.tsx`'s row of `rounded p-1.5` grey
 * icons.
 *
 * Rather than fork ~20 registry files, this restyles them from the outside with
 * descendant variants. The selectors below intentionally mirror
 * `shared/toolbar-renderer.tsx`'s `triggerClass` / `activeClass` / separator
 * classes value-for-value; change them together or the two toolbars drift.
 */

import { cn } from '@/lib/utils';

/** Container: the same row `ReasonToolbar` renders. */
const container = cn(
  'flex w-full flex-wrap items-center justify-start gap-0.5 px-2 py-1',
  // `border-b-*` rather than `border-*`: `FixedToolbar` sets `border-b-border`,
  // and tailwind-merge only drops a class its own group replaces.
  'border-b border-b-gray-200 dark:border-b-slate-700',
);

/**
 * Buttons. `[&_button]` catches both `ToolbarPrimitive.Button` and the toggle
 * items behind `pressed`; `[role=button]` catches the split buttons' halves,
 * which the registry renders as spans.
 */
const buttons = cn(
  '[&_button]:h-7 [&_button]:min-w-7 [&_button]:rounded [&_button]:px-1 [&_button]:font-normal',
  '[&_[role=button]]:h-7 [&_[role=button]]:rounded [&_[role=button]]:px-1',
  '[&_[role=button]]:text-gray-600 [&_button]:text-gray-600 dark:[&_[role=button]]:text-gray-300 dark:[&_button]:text-gray-300',
  '[&_button:not(:disabled):hover]:bg-gray-100 [&_[role=button]:hover]:bg-gray-100 dark:[&_button:not(:disabled):hover]:bg-slate-800 dark:[&_[role=button]:hover]:bg-slate-800',
  '[&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-40',
);

/**
 * Active state. The registry marks a pressed toggle item with
 * `aria-checked`/`data-state=on` and an open dropdown trigger with
 * `data-state=open`; all three get `ReasonToolbar`'s `activeClass`.
 */
const active = cn(
  '[&_[aria-checked=true]]:bg-gray-200 [&_[aria-checked=true]]:text-gray-900 dark:[&_[aria-checked=true]]:bg-slate-700 dark:[&_[aria-checked=true]]:text-white',
  '[&_[data-state=on]]:bg-gray-200 [&_[data-state=on]]:text-gray-900 dark:[&_[data-state=on]]:bg-slate-700 dark:[&_[data-state=on]]:text-white',
  '[&_button[data-state=open]]:bg-gray-200 [&_button[data-state=open]]:text-gray-900 dark:[&_button[data-state=open]]:bg-slate-700 dark:[&_button[data-state=open]]:text-white',
);

/**
 * Icons and rules. `:not([data-icon])` spares the dropdown chevrons, which the
 * registry sizes at `size-3.5` and tags with `data-icon`.
 */
const chrome = cn(
  '[&_svg:not([data-icon])]:size-4',
  '[&_[data-orientation=vertical]]:bg-gray-200 dark:[&_[data-orientation=vertical]]:bg-slate-700',
);

/** Everything above, in the order the cascade needs it. */
export const REASON_TOOLBAR_SKIN = cn(container, buttons, active, chrome);
