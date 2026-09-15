/**
 * Floating "Ask AI anything…" panel for the Ai extension. Reads the
 * extension's ProseMirror plugin state (menu / loading / reviewing / error)
 * and renders the matching UI: the filterable quick-command list, a streaming
 * indicator with a Stop control, the accept/insert-below/try-again/discard
 * review controls over a preview of the result, or an error with a retry
 * action. Positioned with `@floating-ui/dom` and rendered through a portal so
 * it floats above the editor regardless of scroll containers, the same
 * approach `SlashCommand` uses for its own popup.
 *
 * Styled with hand-written `.ai-menu*` classes (see `src/styles/ProseMirror.scss`)
 * rather than Tailwind utilities: this component ships inside the published
 * extension bundle, and following the `Harper` tooltip's plain-CSS precedent
 * keeps it independent of whichever Tailwind config a host app compiles with.
 */

import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { posToDOMRect, useEditorState } from '@tiptap/react';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useEditorInstance } from '@/store/editor';
import { useEditableEditor } from '@/store/store';

import { getAiOptions, getAiState } from '../Ai';
import { AI_COMMAND_GROUP_LABELS } from '../commands';
import { commandsForSelection, groupCommands } from '../lib/prompt';

import type { AiCommandDefinition, AiPanelState } from '../types';

const CLOSED_PANEL: AiPanelState = { status: 'closed' };

function MenuRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} title={title} className="ai-menu-row">
      <Icon className="ai-menu-row-icon" />
      {label}
    </button>
  );
}

export function AiMenu() {
  const editor = useEditorInstance();
  const editable = useEditableEditor();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [submenu, setSubmenu] = useState<AiCommandDefinition | null>(null);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const panel = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? (getAiState(e.state)?.panel ?? CLOSED_PANEL) : CLOSED_PANEL),
  });

  const range = useMemo(() => {
    if (panel.status === 'closed') return null;
    if (panel.status === 'reviewing') return { from: panel.suggestion.from, to: panel.suggestion.to };
    return { from: panel.from, to: panel.to };
  }, [panel]);

  const isOpen = panel.status !== 'closed';
  const hasSelection = !!range && range.to > range.from;
  const selectionLength = range ? range.to - range.from : 0;

  const commands: AiCommandDefinition[] = editor ? (getAiOptions(editor)?.commands ?? []) : [];

  // Typing filters the command list, so the input doubles as a palette rather
  // than only ever being a free-form prompt box.
  const query = prompt.trim().toLowerCase();
  const visibleCommands = useMemo(() => {
    const available = commandsForSelection(commands, hasSelection);
    if (!query) return available;
    return available.filter((command) =>
      `${command.label} ${command.description ?? ''}`.toLowerCase().includes(query)
    );
    // `commands` is a stable options array; `query`/`hasSelection` drive this.
  }, [commands, query, hasSelection]);

  const sections = useMemo(() => groupCommands(visibleCommands), [visibleCommands]);

  // Reset and focus the input each time the menu opens fresh.
  useEffect(() => {
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
  useEffect(() => {
    setActiveIndex((index) => (index >= visibleCommands.length ? visibleCommands.length - 1 : index));
  }, [visibleCommands.length]);

  // Keep the panel anchored to its range as the document/viewport changes.
  useEffect(() => {
    if (!editor || !range || !containerRef.current) {
      setPosition(null);
      return;
    }

    const virtualElement = {
      getBoundingClientRect: () => posToDOMRect(editor.view, range.from, range.to),
    };

    const update = () => {
      if (!containerRef.current) return;
      computePosition(virtualElement, containerRef.current, {
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
    // Re-run as the streamed suggestion grows so the panel follows it.
  }, [editor, range?.from, range?.to, panel]);

  // Escape / click-outside closes the panel without touching the document.
  useEffect(() => {
    if (!isOpen || !editor) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        editor.commands.closeAiMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (submenu) {
          setSubmenu(null);
          return;
        }
        editor.commands.closeAiMenu();
        return;
      }

      // Cmd/Ctrl+Enter accepts a settled suggestion from anywhere in the panel.
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        const state = getAiState(editor.state)?.panel;
        if (state?.status === 'reviewing' && !state.suggestion.isStreaming) {
          event.preventDefault();
          editor.commands.acceptAiSuggestion();
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, editor, submenu]);

  if (!editable || !editor || !isOpen || !position) return null;

  const runCommand = (command: AiCommandDefinition) => {
    if (command.options?.length) {
      setSubmenu(command);
      return;
    }
    editor.commands.runAiCommand(command.id);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (visibleCommands.length ? (index + 1) % visibleCommands.length : -1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        visibleCommands.length ? (index <= 0 ? visibleCommands.length - 1 : index - 1) : -1
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
      if (prompt.trim()) editor.commands.submitAiPrompt(prompt);
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
      ref={containerRef}
      role="dialog"
      aria-label="Ask AI"
      className="ai-menu"
      style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 60 }}
    >
      <div className="ai-menu-input-row">
        <Sparkles className="ai-menu-input-icon" />
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setActiveIndex(event.target.value.trim() ? 0 : -1);
          }}
          onKeyDown={onInputKeyDown}
          placeholder={hasSelection ? 'Ask AI to change the selection…' : 'Ask AI anything…'}
          className="ai-menu-input"
          aria-label="Ask AI"
        />
      </div>

      {panel.status === 'menu' && submenu && (
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
              onClick={() => {
                setSubmenu(null);
                editor.commands.runAiCommand(submenu.id, option.label);
              }}
            >
              <span className="ai-menu-command-text">
                <span className="ai-menu-command-label">{option.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {panel.status === 'menu' && !submenu && (
        <>
          <div className="ai-menu-hint">
            {hasSelection
              ? `${selectionLength.toLocaleString()} characters selected`
              : 'Nothing selected — select text for rewrite actions'}
          </div>
          <div className="ai-menu-commands">
            {sections.length === 0 && <div className="ai-menu-empty">No matching actions</div>}
            {sections.map((section) => (
              <div key={section.group}>
                <div className="ai-menu-group-label">{AI_COMMAND_GROUP_LABELS[section.group]}</div>
                {section.commands.map((command) => {
                  const index = visibleCommands.indexOf(command);
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-active={index === activeIndex ? 'true' : undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className="ai-menu-command"
                    >
                      <command.icon className="ai-menu-row-icon" />
                      <span className="ai-menu-command-text">
                        <span className="ai-menu-command-label">{command.label}</span>
                        {command.description && (
                          <span className="ai-menu-command-description">{command.description}</span>
                        )}
                      </span>
                      {command.options?.length ? <span className="ai-menu-command-more">›</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {panel.status === 'loading' && (
        <div className="ai-menu-loading">
          <Loader2 className="ai-menu-row-icon ai-menu-spin" />
          <span className="ai-menu-loading-label">
            {panel.commandLabel === 'Custom' ? 'Generating…' : `${panel.commandLabel}…`}
          </span>
          <button type="button" className="ai-menu-stop" onClick={() => editor.commands.stopAiGeneration()}>
            <Square className="ai-menu-row-icon" />
            Stop
          </button>
        </div>
      )}

      {panel.status === 'error' && (
        <div className="ai-menu-error">
          <p className="ai-menu-error-message">{panel.message}</p>
          <div className="ai-menu-review">
            <MenuRow icon={RotateCcw} label="Try again" onClick={() => editor.commands.retryAiSuggestion()} />
            <MenuRow icon={X} label="Dismiss" onClick={() => editor.commands.closeAiMenu()} />
          </div>
        </div>
      )}

      {panel.status === 'reviewing' && (
        <>
          <div className="ai-menu-preview" aria-live="polite">
            {panel.suggestion.suggestedText || '…'}
          </div>
          {panel.suggestion.isStreaming ? (
            <div className="ai-menu-loading">
              <Loader2 className="ai-menu-row-icon ai-menu-spin" />
              <span className="ai-menu-loading-label">{panel.commandLabel}…</span>
              <button
                type="button"
                className="ai-menu-stop"
                onClick={() => editor.commands.stopAiGeneration()}
              >
                <Square className="ai-menu-row-icon" />
                Stop
              </button>
            </div>
          ) : (
            <div className="ai-menu-review">
              <MenuRow
                icon={Check}
                label={panel.suggestion.mode === 'replace' ? 'Replace selection' : 'Insert'}
                title="⌘/Ctrl + Enter"
                onClick={() => editor.commands.acceptAiSuggestion()}
              />
              <MenuRow
                icon={CornerDownRight}
                label="Insert below"
                onClick={() => editor.commands.insertAiSuggestionBelow()}
              />
              <MenuRow icon={RotateCcw} label="Try again" onClick={() => editor.commands.retryAiSuggestion()} />
              <MenuRow
                icon={Copy}
                label={copied ? 'Copied' : 'Copy'}
                onClick={() => copyResult(panel.suggestion.suggestedText)}
              />
              <MenuRow icon={X} label="Discard" onClick={() => editor.commands.discardAiSuggestion()} />
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
}
