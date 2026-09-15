/**
 * Integration coverage for the sidebar's expand/collapse toggle: one click
 * steps the file tree one folder level deeper, and the resulting expansion is
 * reported to the host so it can be persisted. Before it was reported, the
 * stepped expansion lived only in the tree's local state, so the next
 * document change — including the user opening a folder by hand — reset the
 * tree back to the persisted flags and threw the cycle away.
 */

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileTree, type DocumentTreeHandle } from '../../src/file-tree/filetree';
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
  vi.restoreAllMocks();
});

const doc = (
  id: string,
  parentId: string | null,
  isFolder: boolean,
  isExpanded = false,
): Document => ({ id, title: id, content: '', parentId, isFolder, isExpanded });

/**
 * root
 *  ├ a (folder) ─ a1 (folder) ─ a1x (note)
 *  ├ b (folder) ─ b1 (note)
 *  └ c (note)
 */
const documents: Document[] = [
  doc('a', null, true),
  doc('a1', 'a', true),
  doc('a1x', 'a1', false),
  doc('b', null, true),
  doc('b1', 'b', false),
  doc('c', null, false),
];

/** Titles of the rows the tree currently draws, in order. */
function rows() {
  return Array.from(container.querySelectorAll('[role="treeitem"]')).map(
    (node) => node.textContent,
  );
}

/** Applies an expanded-folder set to the documents the way the host does. */
function withExpanded(docs: Document[], folderIds: string[]): Document[] {
  return docs.map((entry) => ({ ...entry, isExpanded: folderIds.includes(entry.id) }));
}

describe('file tree expand-level cycle', () => {
  it('reports the level it is at and the tree depth', () => {
    const onExpandStateChange = vi.fn();
    const ref = createRef<DocumentTreeHandle>();

    act(() => {
      root.render(
        <FileTree
          ref={ref}
          documents={documents}
          activeId={null}
          onMove={() => {}}
          onSelect={() => {}}
          onExpandStateChange={onExpandStateChange}
        />,
      );
    });

    expect(onExpandStateChange).toHaveBeenLastCalledWith({ level: 0, maxLevel: 2 });
    expect(rows()).toEqual(['a', 'b', 'c']);

    act(() => ref.current!.expandToLevel(1));
    expect(rows()).toEqual(['a', 'a1', 'b', 'b1', 'c']);
    expect(onExpandStateChange).toHaveBeenLastCalledWith({ level: 1, maxLevel: 2 });

    act(() => ref.current!.expandToLevel(2));
    expect(rows()).toEqual(['a', 'a1', 'a1x', 'b', 'b1', 'c']);
    expect(onExpandStateChange).toHaveBeenLastCalledWith({ level: 2, maxLevel: 2 });

    act(() => ref.current!.collapseAll());
    expect(rows()).toEqual(['a', 'b', 'c']);
    expect(onExpandStateChange).toHaveBeenLastCalledWith({ level: 0, maxLevel: 2 });
  });

  it('hands each stepped expansion to the host so it can be persisted', () => {
    const onExpandedFoldersChange = vi.fn();
    const ref = createRef<DocumentTreeHandle>();

    act(() => {
      root.render(
        <FileTree
          ref={ref}
          documents={documents}
          activeId={null}
          onMove={() => {}}
          onSelect={() => {}}
          onExpandedFoldersChange={onExpandedFoldersChange}
        />,
      );
    });

    act(() => ref.current!.expandToLevel(1));
    expect(onExpandedFoldersChange).toHaveBeenLastCalledWith(['a', 'b']);

    act(() => ref.current!.expandToLevel(2));
    expect(onExpandedFoldersChange).toHaveBeenLastCalledWith(['a', 'b', 'a1']);

    act(() => ref.current!.expandAll());
    expect(onExpandedFoldersChange).toHaveBeenLastCalledWith(['a', 'b', 'a1']);

    act(() => ref.current!.collapseAll());
    expect(onExpandedFoldersChange).toHaveBeenLastCalledWith([]);
  });

  it('keeps the stepped expansion once the host persists it and the docs change', () => {
    const onExpandStateChange = vi.fn();
    const ref = createRef<DocumentTreeHandle>();
    let persisted = documents;

    const render = () =>
      root.render(
        <FileTree
          ref={ref}
          documents={persisted}
          activeId={null}
          onMove={() => {}}
          onSelect={() => {}}
          onExpandStateChange={onExpandStateChange}
          onExpandedFoldersChange={(ids) => {
            persisted = withExpanded(persisted, ids);
          }}
        />,
      );

    act(() => render());
    act(() => ref.current!.expandToLevel(1));
    // The host persisted the level, then re-renders (e.g. after a rename).
    act(() => render());

    expect(rows()).toEqual(['a', 'a1', 'b', 'b1', 'c']);
    expect(onExpandStateChange).toHaveBeenLastCalledWith({ level: 1, maxLevel: 2 });
  });

  it('leaves the other folders open when one folder is toggled by hand', () => {
    const onExpandStateChange = vi.fn();
    const ref = createRef<DocumentTreeHandle>();
    let persisted = documents;

    const render = () =>
      root.render(
        <FileTree
          ref={ref}
          documents={persisted}
          activeId={null}
          onMove={() => {}}
          onSelect={() => {}}
          onExpandStateChange={onExpandStateChange}
          onExpandedFoldersChange={(ids) => {
            persisted = withExpanded(persisted, ids);
          }}
        />,
      );

    act(() => render());
    act(() => ref.current!.expandToLevel(2));

    // The user collapses "a1" by hand; the host toggles just that flag.
    persisted = persisted.map((entry) =>
      entry.id === 'a1' ? { ...entry, isExpanded: false } : entry,
    );
    act(() => render());

    // "a" and "b" stay open — only the hand-toggled folder closed — and the
    // toggle now reports level 1, so the next click steps back to level 2.
    expect(rows()).toEqual(['a', 'a1', 'b', 'b1', 'c']);
    expect(onExpandStateChange).toHaveBeenLastCalledWith({ level: 1, maxLevel: 2 });
  });
});
