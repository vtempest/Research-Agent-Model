/**
 * Full-loop coverage for the file tree's expand/collapse level cycle as the
 * user actually drives it: from the sidebar toolbar, and from the Files
 * panel's own header.
 *
 * The FileTree unit tests only drive the imperative handle directly, so they
 * miss the two ways the cycle reached the user broken — a toolbar button with
 * no tree behind it (Files turned off for that sidebar, or moved to the right
 * panel) that silently did nothing while advertising "Expand All", and a Files
 * panel with no expand control of its own once it was not next to the toolbar.
 */

import { act, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Sidebar } from '../../src/Sidebar';
import { SidebarContent } from '../../src/SidebarContent';
import type { Document } from '../../src/documents/DocumentTree';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const doc = (id: string, parentId: string | null, isFolder: boolean): Document => ({
  id,
  title: id,
  content: '',
  parentId,
  isFolder,
  isExpanded: false,
});

/**
 * root
 *  ├ a (folder) ─ a1 (folder) ─ a1x (folder) ─ deep (note)
 *  ├ b (folder) ─ b1 (note)
 *  └ c (note)
 */
const initialDocuments: Document[] = [
  doc('a', null, true),
  doc('a1', 'a', true),
  doc('a1x', 'a1', true),
  doc('deep', 'a1x', false),
  doc('b', null, true),
  doc('b1', 'b', false),
  doc('c', null, false),
];

/** Persists the expanded set the way ReasonDocs' host state does. */
function useHostDocuments() {
  const [documents, setDocuments] = useState(initialDocuments);
  const onSetExpandedFolders = useCallback((folderIds: string[]) => {
    const expanded = new Set(folderIds);
    setDocuments((docs) =>
      docs.map((entry) =>
        !!entry.isExpanded === expanded.has(entry.id)
          ? entry
          : { ...entry, isExpanded: expanded.has(entry.id) },
      ),
    );
  }, []);
  return { documents, onSetExpandedFolders };
}

/** Titles of the rows the tree currently draws, in order. */
function rows() {
  return Array.from(container.querySelectorAll('[role="treeitem"]')).map(
    (node) => node.textContent,
  );
}

/** The expand/collapse cycle control, found by the label it advertises. */
function toggle(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((node) =>
    /^(Expand|Collapse)/.test(node.getAttribute('aria-label') ?? ''),
  );
  if (!button) throw new Error('expand/collapse toggle not found');
  return button as HTMLButtonElement;
}

function click() {
  act(() => {
    toggle().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Walks the whole cycle: one level per click, then back to fully collapsed. */
function expectCycleStepsThroughEveryLevel() {
  expect(rows()).toEqual(['a', 'b', 'c']);
  expect(toggle().getAttribute('aria-label')).toBe('Expand Level 1');

  click();
  expect(rows()).toEqual(['a', 'a1', 'b', 'b1', 'c']);
  expect(toggle().getAttribute('aria-label')).toBe('Expand Level 2');

  click();
  expect(rows()).toEqual(['a', 'a1', 'a1x', 'b', 'b1', 'c']);
  expect(toggle().getAttribute('aria-label')).toBe('Expand Level 3');

  click();
  expect(rows()).toEqual(['a', 'a1', 'a1x', 'deep', 'b', 'b1', 'c']);
  expect(toggle().getAttribute('aria-label')).toBe('Collapse All');

  click();
  expect(rows()).toEqual(['a', 'b', 'c']);
  expect(toggle().getAttribute('aria-label')).toBe('Expand Level 1');
}

function SidebarHost({ leftPanels }: { leftPanels: ('files' | 'openTabs')[] }) {
  const { documents, onSetExpandedFolders } = useHostDocuments();
  return (
    <Sidebar
      documents={documents}
      activeId={null}
      activeDocument={null}
      onSelect={() => {}}
      onAdd={() => {}}
      onDelete={() => {}}
      onDuplicate={() => {}}
      onSetExpandedFolders={onSetExpandedFolders}
      onMove={() => {}}
      onRename={() => {}}
      onSearchFocus={() => {}}
      isOpen
      onOpenChange={() => {}}
      isMobile={false}
      leftPanels={leftPanels}
      onLeftPanelsChange={() => {}}
      rightPanels={[]}
      onRightPanelsChange={() => {}}
      onRestore={() => {}}
    />
  );
}

describe('file tree expand-level cycle, as the user drives it', () => {
  it('steps one folder level per toolbar click and wraps back to collapsed', () => {
    act(() => root.render(<SidebarHost leftPanels={['files']} />));
    expectCycleStepsThroughEveryLevel();
  });

  it('cycles from the Files panel header when the panel has no toolbar', () => {
    // How the Files panel is rendered in the right panel: its own content,
    // no sidebar toolbar, and no tree ref handed in from a host.
    function RightPanelHost() {
      const { documents, onSetExpandedFolders } = useHostDocuments();
      return (
        <SidebarContent
          panels={['files']}
          persistenceKey="right"
          activeDocuments={documents}
          activeId={null}
          activeDocument={null}
          headings={[]}
          isMobile={false}
          onSelect={() => {}}
          onAdd={() => {}}
          onDelete={() => {}}
          onDuplicate={() => {}}
          onMove={() => {}}
          onRename={() => {}}
          onSetExpandedFolders={onSetExpandedFolders}
        />
      );
    }

    act(() => root.render(<RightPanelHost />));
    expectCycleStepsThroughEveryLevel();
  });

  it('disables the toolbar toggle when the files panel is not in this sidebar', () => {
    act(() => root.render(<SidebarHost leftPanels={['openTabs']} />));

    // The toolbar still renders (Open Tabs is showing), but there is no tree
    // behind the toggle, so it must not offer a cycle it cannot run.
    expect(toggle().disabled).toBe(true);
  });
});
