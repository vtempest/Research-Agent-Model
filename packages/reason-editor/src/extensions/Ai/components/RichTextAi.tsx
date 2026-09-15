/**
 * Toolbar control (React) for the Ai extension: a single "AI" button that
 * opens the writing-assistant actions — the same commands the floating
 * "Ask AI anything…" menu offers, reachable without first learning the
 * ⌘J shortcut or the `/ai` slash command.
 *
 * Running a command from here hands off to the extension, so the streamed
 * result is still reviewed as an inline diff next to the text it changes;
 * this control is an entry point, not a second implementation of the flow.
 *
 * Like `AiMenu` it is styled with plain `.ai-menu*` / `.ai-toolbar*` classes
 * (see `src/styles/ProseMirror.scss`) rather than Tailwind utilities, because
 * it ships inside the published extension bundle and must not depend on the
 * host app's Tailwind config.
 */

import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { useEditorState } from '@tiptap/react';
import { ArrowLeft, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTiptapEditor } from '@/store/editor';

import { getAiOptions, getAiState, isAiEnabled } from '../Ai';
import { AI_COMMAND_GROUP_LABELS } from '../commands';
import { commandsForSelection, groupCommands } from '../lib/prompt';

import type { Editor } from '@tiptap/core';
import type { AiCommandDefinition } from '../types';

export interface RichTextAiProps {
  /** Editor to act on. Falls back to the one from Tiptap context. */
  editor?: Editor | null;
  /** Label shown next to the icon. Pass `''` for an icon-only button. */
  label?: string;
}

/**
 * Renders nothing when the Ai extension is not registered on the editor, so
 * hosts can drop it into a toolbar unconditionally.
 */
export function RichTextAi({ editor: providedEditor, label = 'AI' }: RichTextAiProps) {
  const { editor } = useTiptapEditor(providedEditor);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<AiCommandDefinition | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const { hasSelection, isBusy } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { hasSelection: false, isBusy: false };
      const status = getAiState(e.state)?.panel.status;
      return {
        hasSelection: !e.state.selection.empty,
        isBusy: status === 'loading' || status === 'reviewing',
      };
    },
  }) ?? { hasSelection: false, isBusy: false };

  const commands = editor ? (getAiOptions(editor)?.commands ?? []) : [];
  const sections = useMemo(
    () => groupCommands(commandsForSelection(commands, hasSelection)),
    [commands, hasSelection]
  );

  // Anchor the dropdown under the button and keep it there while scrolling.
  useEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;

    const anchor = buttonRef.current;
    const update = () => {
      if (!panelRef.current) return;
      computePosition(anchor, panelRef.current, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => setPosition({ x, y }));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, sections.length, submenu]);

  useEffect(() => {
    if (!open) {
      setSubmenu(null);
      setPosition(null);
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!isAiEnabled(editor)) return null;

  const run = (command: AiCommandDefinition, option?: string) => {
    if (command.options?.length && !option) {
      setSubmenu(command);
      return;
    }
    setOpen(false);
    // Focus first: the command reads the live selection, and clicking the
    // toolbar can otherwise leave the editor without a resolved selection.
    editor?.chain().focus().run();
    editor?.commands.runAiCommand(command.id, option);
  };

  const askAnything = () => {
    setOpen(false);
    editor?.chain().focus().run();
    editor?.commands.openAiMenu();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="AI writing assistant (Ctrl/⌘ + J)"
        aria-haspopup="menu"
        aria-expanded={open}
        data-state={open ? 'open' : 'closed'}
        className="ai-toolbar-button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        {isBusy ? (
          <Loader2 className="ai-toolbar-icon ai-menu-spin" />
        ) : (
          <Sparkles className="ai-toolbar-icon" />
        )}
        {label && <span className="ai-toolbar-label">{label}</span>}
        <ChevronDown className="ai-toolbar-chevron" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="AI actions"
            className="ai-menu ai-toolbar-menu"
            style={{
              position: 'fixed',
              top: position?.y ?? -9999,
              left: position?.x ?? -9999,
              visibility: position ? 'visible' : 'hidden',
              zIndex: 60,
            }}
          >
            {submenu ? (
              <div className="ai-menu-commands">
                <button type="button" className="ai-menu-row" onClick={() => setSubmenu(null)}>
                  <ArrowLeft className="ai-menu-row-icon" />
                  {submenu.label}
                </button>
                {submenu.options?.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="ai-menu-command"
                    onClick={() => run(submenu, option.label)}
                  >
                    <span className="ai-menu-command-text">
                      <span className="ai-menu-command-label">{option.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button type="button" className="ai-menu-command ai-menu-ask" onClick={askAnything}>
                  <Sparkles className="ai-menu-row-icon" />
                  <span className="ai-menu-command-text">
                    <span className="ai-menu-command-label">Ask AI anything…</span>
                    <span className="ai-menu-command-description">Write your own instruction</span>
                  </span>
                  <span className="ai-menu-command-shortcut">⌘J</span>
                </button>

                <div className="ai-menu-hint">
                  {hasSelection
                    ? 'Runs on the selected text'
                    : 'Select text to rewrite it, or generate from the caret'}
                </div>

                <div className="ai-menu-commands">
                  {sections.map((section) => (
                    <div key={section.group}>
                      <div className="ai-menu-group-label">
                        {AI_COMMAND_GROUP_LABELS[section.group]}
                      </div>
                      {section.commands.map((command) => (
                        <button
                          key={command.id}
                          type="button"
                          className="ai-menu-command"
                          onClick={() => run(command)}
                        >
                          <command.icon className="ai-menu-row-icon" />
                          <span className="ai-menu-command-text">
                            <span className="ai-menu-command-label">{command.label}</span>
                            {command.description && (
                              <span className="ai-menu-command-description">{command.description}</span>
                            )}
                          </span>
                          {command.options?.length ? (
                            <span className="ai-menu-command-more">›</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
