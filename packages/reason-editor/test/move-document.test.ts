/**
 * Tests for the file tree's drag-and-drop reordering of the flat document
 * list: a dragged node must land exactly where it was dropped and take its
 * subtree with it.
 */
import { describe, expect, it } from 'vitest';
import { collectDescendantIds, moveDocumentInList } from '../src/editor/moveDocument';
import type { Document } from 'react-reason-editor-sidebar';

function doc(id: string, parentId: string | null = null, isFolder = false): Document {
  return {
    id,
    title: id,
    content: '',
    parentId,
    isFolder,
    isExpanded: true,
    isArchived: false,
    isDeleted: false,
    tags: [],
    children: [],
  } as unknown as Document;
}

const ids = (docs: Document[]) => docs.map((d) => d.id);
const parentOf = (docs: Document[], id: string) => docs.find((d) => d.id === id)?.parentId;

describe('collectDescendantIds', () => {
  it('walks the whole subtree depth-first', () => {
    const docs = [doc('f'), doc('a', 'f'), doc('b', 'a'), doc('c')];
    expect(collectDescendantIds(docs, 'f')).toEqual(['a', 'b']);
    expect(collectDescendantIds(docs, 'c')).toEqual([]);
  });
});

describe('moveDocumentInList', () => {
  it('moves a node up before its target', () => {
    const docs = [doc('a'), doc('b'), doc('c')];
    expect(ids(moveDocumentInList(docs, 'c', 'a', 'before'))).toEqual(['c', 'a', 'b']);
  });

  it('moves a node down after its target', () => {
    const docs = [doc('a'), doc('b'), doc('c')];
    expect(ids(moveDocumentInList(docs, 'a', 'c', 'after'))).toEqual(['b', 'c', 'a']);
  });

  it('drops a node between two siblings rather than past them', () => {
    const docs = [doc('a'), doc('b'), doc('c')];
    expect(ids(moveDocumentInList(docs, 'a', 'c', 'before'))).toEqual(['b', 'a', 'c']);
  });

  it('reparents a node dropped onto a folder, appending after its children', () => {
    const docs = [doc('f', null, true), doc('f1', 'f'), doc('a')];
    const moved = moveDocumentInList(docs, 'a', 'f', 'child');
    expect(ids(moved)).toEqual(['f', 'f1', 'a']);
    expect(parentOf(moved, 'a')).toBe('f');
  });

  it('promotes a nested node back to the root level', () => {
    const docs = [doc('f', null, true), doc('f1', 'f'), doc('a')];
    const moved = moveDocumentInList(docs, 'f1', 'a', 'after');
    expect(ids(moved)).toEqual(['f', 'a', 'f1']);
    expect(parentOf(moved, 'f1')).toBe(null);
  });

  it('appends to the end of the root level when dropped on the root', () => {
    const docs = [doc('a'), doc('b')];
    const moved = moveDocumentInList(docs, 'a', null, 'child');
    expect(ids(moved)).toEqual(['b', 'a']);
    expect(parentOf(moved, 'a')).toBe(null);
  });

  it('carries the dragged folder’s subtree along with it', () => {
    const docs = [doc('f', null, true), doc('f1', 'f'), doc('f1a', 'f1'), doc('z')];
    const moved = moveDocumentInList(docs, 'f', 'z', 'after');
    expect(ids(moved)).toEqual(['z', 'f', 'f1', 'f1a']);
    expect(parentOf(moved, 'f1')).toBe('f');
  });

  it('drops a node before a folder without landing inside it', () => {
    const docs = [doc('f', null, true), doc('f1', 'f'), doc('z')];
    const moved = moveDocumentInList(docs, 'z', 'f', 'before');
    expect(ids(moved)).toEqual(['z', 'f', 'f1']);
    expect(parentOf(moved, 'z')).toBe(null);
  });

  it('drops a node after a folder rather than between its children', () => {
    const docs = [doc('f', null, true), doc('f1', 'f'), doc('f2', 'f'), doc('z')];
    const moved = moveDocumentInList(docs, 'z', 'f', 'after');
    expect(ids(moved)).toEqual(['f', 'f1', 'f2', 'z']);
    expect(parentOf(moved, 'z')).toBe(null);
  });

  it('refuses to move a document into its own subtree', () => {
    const docs = [doc('f', null, true), doc('f1', 'f')];
    expect(moveDocumentInList(docs, 'f', 'f1', 'child')).toBe(docs);
  });

  it('ignores moves onto itself or an unknown target', () => {
    const docs = [doc('a'), doc('b')];
    expect(moveDocumentInList(docs, 'a', 'a', 'before')).toBe(docs);
    expect(moveDocumentInList(docs, 'a', 'nope', 'before')).toBe(docs);
    expect(moveDocumentInList(docs, 'nope', 'a', 'before')).toBe(docs);
  });
});
