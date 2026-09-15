/**
 * Structural tests for the sidebar file tree: the rendered rows must follow
 * the `documents` prop, including after a drag has reordered or reparented a
 * document in the caller's state.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FileTree, resolveDropPlacement } from '../../src/file-tree/filetree';
import type { Document } from '../../src/documents/DocumentTree';

function doc(id: string, title: string, parentId: string | null = null, isFolder = false): Document {
  return {
    id,
    title,
    content: '',
    parentId,
    isFolder,
    isExpanded: true,
    isArchived: false,
    isDeleted: false,
    tags: [],
    children: [],
  } as Document;
}

function renderedNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[role="treeitem"]')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

describe('FileTree', () => {
  const noop = () => {};

  it('renders the documents in order', () => {
    const documents = [doc('a', 'Alpha'), doc('b', 'Bravo'), doc('c', 'Charlie')];
    const { container } = render(
      <FileTree activeId={null} documents={documents} onMove={noop} onSelect={noop} />,
    );
    expect(renderedNames(container)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('re-renders the new order after the documents prop changes', () => {
    const documents = [doc('a', 'Alpha'), doc('b', 'Bravo'), doc('c', 'Charlie')];
    const { container, rerender } = render(
      <FileTree activeId={null} documents={documents} onMove={noop} onSelect={noop} />,
    );

    const reordered = [doc('b', 'Bravo'), doc('c', 'Charlie'), doc('a', 'Alpha')];
    rerender(<FileTree activeId={null} documents={reordered} onMove={noop} onSelect={noop} />);

    expect(renderedNames(container)).toEqual(['Bravo', 'Charlie', 'Alpha']);
  });

  it('re-renders a reparented document under its new folder', () => {
    const documents = [doc('f', 'Folder', null, true), doc('a', 'Alpha')];
    const { container, rerender } = render(
      <FileTree activeId={null} documents={documents} onMove={noop} onSelect={noop} />,
    );
    expect(renderedNames(container)).toEqual(['Folder', 'Alpha']);

    const moved = [doc('f', 'Folder', null, true), doc('a', 'Alpha', 'f')];
    rerender(<FileTree activeId={null} documents={moved} onMove={noop} onSelect={noop} />);

    const rows = Array.from(container.querySelectorAll('[role="treeitem"]'));
    const alpha = rows.find((row) => row.textContent?.trim() === 'Alpha');
    expect(alpha?.getAttribute('aria-level')).toBe('2');
  });
});

describe('resolveDropPlacement', () => {
  const children = ['a', 'b', 'c'];

  it('drops before the sibling now sitting at the insertion slot', () => {
    // "c" dragged to the very top: slot 0 of [a, b].
    expect(resolveDropPlacement(children, ['c'], 0, null)).toEqual({
      targetId: 'a',
      position: 'before',
    });
  });

  it('keeps a downward drag in the slot it was dropped in', () => {
    // "a" dragged between "b" and "c": headless-tree reports insertion slot 1
    // of the lifted-out list [b, c], i.e. before "c" — not after it.
    expect(resolveDropPlacement(children, ['a'], 1, null)).toEqual({
      targetId: 'c',
      position: 'before',
    });
  });

  it('drops after the last sibling when the slot is past the end', () => {
    expect(resolveDropPlacement(children, ['a'], 2, null)).toEqual({
      targetId: 'c',
      position: 'after',
    });
  });

  it('falls back to a child move when the parent has no other children', () => {
    expect(resolveDropPlacement(['a'], ['a'], 0, 'folder')).toEqual({
      targetId: 'folder',
      position: 'child',
    });
  });
});
