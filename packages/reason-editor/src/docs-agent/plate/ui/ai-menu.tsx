'use client';

/**
 * The "Ask AI anything…" panel for the Plate editor — the surface the bubble
 * menu's `AIToolbarButton` (and `⌘/Ctrl + J`) opens.
 *
 * Same panel as the Tiptap side's `src/extensions/Ai/components/AiMenu.tsx`,
 * button for button: a filterable command palette over a free-form prompt box,
 * a streaming state with a Stop control, and a review state whose result is
 * only written to the document when the user picks Replace / Insert below.
 * Two things differ, both because this one lives with the Plate playground UI
 * rather than inside the published Tiptap bundle: it reads its state from the
 * per-editor controller in `../ai-controller.ts` instead of ProseMirror plugin
 * state, and it is styled with the same Tailwind/shadcn tokens as its
 * neighbours in `./` instead of the extension's plain `.ai-menu*` CSS.
 *
 * It is rendered through a portal and positioned against the captured range's
 * DOM rect, so it floats above the editor regardless of scroll containers.
 */

import * as React from 'react';

import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import {
  ArrowLeft,
  Check,
  Copy,
  CornerDownRight,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { RangeApi, type TRange } from 'platejs';
import { useEditorReadOnly, useEditorRef } from 'platejs/react';
import { createPortal } from 'react-dom';

import { AI_COMMAND_GROUP_LABELS } from '@/extensions/Ai/commands';
import { groupCommands } from '@/extensions/Ai/lib/prompt';
import { cn } from '@/lib/utils';

import {
  getPlateAiController,
  type PlateAiController,
  type PlateAiPanel,
} from '../ai-controller';

import type { AiCommandDefinition } from '@/extensions/Ai/types';

/** Stable snapshot for the server/first render — a fresh object would re-render forever. */
const CLOSED_PANEL: PlateAiPanel = { status: 'closed' };

function ReviewButton({
  icon: Icon,
  label,
  onClick,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      {label}
    </button>
  );
}

/** Keeps the panel anchored to the range the request was launched against. */
function useAnchoredPosition(
  editor: ReturnType<typeof useEditorRef>,
  range: TRange | null,
  panelRef: React.RefObject<HTMLDivElement | null>,
) {
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!range) {
      setPosition(null);
      return;
    }

    const virtualElement = {
      getBoundingClientRect: () => {
        try {
          const domRange = editor.api.toDOMRange(range);
          if (domRange) return domRange.getBoundingClientRect();
        } catch {
          // The range has no DOM to resolve against (the block was replaced, or
          // the editor is not mounted); fall through to the corner.
        }
        return new DOMRect(0, 0, 0, 0);
      },
    };

    const update = () => {
      if (!panelRef.current) return;
      void computePosition(virtualElement, panelRef.current, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => setPosition({ x, y }));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [editor, range, panelRef]);

  return position;
}

export function AIMenu() {
  const editor = useEditorRef();
  const readOnly = useEditorReadOnly();
  const controller: PlateAiController = React.useMemo(
    () => getPlateAiController(editor),
    [editor],
  );

  const panel = React.useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    () => CLOSED_PANEL,
  );

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [submenu, setSubmenu] = React.useState<AiCommandDefinition | null>(null);
  const [copied, setCopied] = React.useState(false);

  const range = panel.status === 'closed' ? null : panel.range;
  const isOpen = panel.status !== 'closed';
  const hasSelection = !!range && !RangeApi.isCollapsed(range);
  const position = useAnchoredPosition(editor, range, panelRef);

  // Typing filters the command list, so the input doubles as a palette rather
  // than only ever being a free-form prompt box.
  const query = prompt.trim().toLowerCase();
  const visibleCommands = React.useMemo(() => {
    if (!isOpen) return [];
    const available = controller.availableCommands();
    if (!query) return available;
    return available.filter((command) =>
      `${command.label} ${command.description ?? ''}`.toLowerCase().includes(query),
    );
  }, [controller, query, isOpen, hasSelection]);

  const sections = React.useMemo(() => groupCommands(visibleCommands), [visibleCommands]);

  // Reset and focus the input each time the panel opens fresh.
  React.useEffect(() => {
    if (panel.status === 'menu') {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    if (panel.status === 'closed') {
      setPrompt('');
      setSubmenu(null);
      setActiveIndex(-1);
      setCopied(false);
    }
  }, [panel.status]);

  // A filtered-out highlight would run the wrong command on Enter.
  React.useEffect(() => {
    setActiveIndex((index) =>
      index >= visibleCommands.length ? visibleCommands.length - 1 : index,
    );
  }, [visibleCommands.length]);

  // Escape / click-outside closes the panel without touching the document.
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        controller.close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (submenu) {
          setSubmenu(null);
          return;
        }
        controller.close();
        return;
      }

      // Cmd/Ctrl+Enter accepts a settled suggestion from anywhere in the panel.
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        if (controller.accept()) event.preventDefault();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, controller, submenu]);

  if (readOnly || !isOpen || typeof document === 'undefined') return null;

  const runCommand = (command: AiCommandDefinition) => {
    if (command.options?.length) {
      setSubmenu(command);
      return;
    }
    controller.runCommand(command.id);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleCommands.length ? (index + 1) % visibleCommands.length : -1,
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleCommands.length
          ? index <= 0
            ? visibleCommands.length - 1
            : index - 1
          : -1,
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const highlighted = activeIndex >= 0 ? visibleCommands[activeIndex] : undefined;
      if (highlighted) {
        runCommand(highlighted);
        return;
      }
      if (prompt.trim()) controller.submitPrompt(prompt);
    }
  };

  const copyResult = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the result is still visible to select.
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Ask AI"
      className="fixed z-[60] w-[22rem] max-w-[90vw] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
      // Rendered before it is placed — `useAnchoredPosition` needs the node in
      // the DOM to measure against, so it is hidden rather than withheld for
      // the one frame that takes.
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setActiveIndex(event.target.value.trim() ? 0 : -1);
          }}
          onKeyDown={onInputKeyDown}
          placeholder={hasSelection ? 'Ask AI to change the selection…' : 'Ask AI anything…'}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Ask AI"
        />
      </div>

      {panel.status === 'menu' && submenu && (
        <div className="max-h-80 overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => setSubmenu(null)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
            {submenu.label}
          </button>
          {submenu.options?.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSubmenu(null);
                controller.runCommand(submenu.id, option.label);
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 pl-8 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {panel.status === 'menu' && !submenu && (
        <>
          <div className="px-3 py-1.5 text-muted-foreground text-xs">
            {hasSelection
              ? 'Acting on the selection'
              : 'Nothing selected — select text for rewrite actions'}
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {sections.length === 0 && (
              <div className="px-2 py-3 text-center text-muted-foreground text-sm">
                No matching actions
              </div>
            )}
            {sections.map((section) => (
              <div key={section.group}>
                <div className="px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs">
                  {AI_COMMAND_GROUP_LABELS[section.group]}
                </div>
                {section.commands.map((command) => {
                  const index = visibleCommands.indexOf(command);
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-active={index === activeIndex ? 'true' : undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                        'hover:bg-accent hover:text-accent-foreground',
                        'data-[active=true]:bg-accent data-[active=true]:text-accent-foreground',
                      )}
                    >
                      <command.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{command.label}</span>
                        {command.description && (
                          <span className="truncate text-muted-foreground text-xs">
                            {command.description}
                          </span>
                        )}
                      </span>
                      {command.options?.length ? (
                        <span className="ml-auto text-muted-foreground">›</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {panel.status === 'loading' && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">
            {panel.commandLabel === 'Custom' ? 'Generating…' : `${panel.commandLabel}…`}
          </span>
          <button
            type="button"
            onClick={() => controller.stop()}
            className="ml-auto flex items-center gap-1 rounded-sm px-2 py-1 text-xs hover:bg-accent"
          >
            <Square className="size-3" />
            Stop
          </button>
        </div>
      )}

      {panel.status === 'error' && (
        <div className="p-1">
          <p className="px-2 py-1.5 text-destructive text-sm">{panel.message}</p>
          <ReviewButton icon={RotateCcw} label="Try again" onClick={() => controller.retry()} />
          <ReviewButton icon={X} label="Dismiss" onClick={() => controller.close()} />
        </div>
      )}

      {panel.status === 'reviewing' && (
        <>
          <div
            className="max-h-64 overflow-y-auto whitespace-pre-wrap border-b px-3 py-2 text-sm"
            aria-live="polite"
          >
            {panel.suggestion.suggestedText || '…'}
          </div>
          {panel.suggestion.isStreaming ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">{panel.commandLabel}…</span>
              <button
                type="button"
                onClick={() => controller.stop()}
                className="ml-auto flex items-center gap-1 rounded-sm px-2 py-1 text-xs hover:bg-accent"
              >
                <Square className="size-3" />
                Stop
              </button>
            </div>
          ) : (
            <div className="p-1">
              <ReviewButton
                icon={Check}
                label={panel.suggestion.mode === 'replace' ? 'Replace selection' : 'Insert'}
                title="⌘/Ctrl + Enter"
                onClick={() => controller.accept()}
              />
              <ReviewButton
                icon={CornerDownRight}
                label="Insert below"
                onClick={() => controller.insertBelow()}
              />
              <ReviewButton icon={RotateCcw} label="Try again" onClick={() => controller.retry()} />
              <ReviewButton
                icon={Copy}
                label={copied ? 'Copied' : 'Copy'}
                onClick={() => void copyResult(panel.suggestion.suggestedText)}
              />
              <ReviewButton icon={X} label="Discard" onClick={() => controller.discard()} />
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
