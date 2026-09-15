/**
 * Coverage for the file tree's "expand one level at a time" cycle.
 */
import { describe, expect, it } from 'vitest';

import {
  expandToggleLabelFor,
  getExpandedLevel,
  getFolderIdsByLevel,
  getFolderIdsUpToLevel,
  getMaxFolderLevel,
  nextExpandLevel,
  type FolderItems,
} from '../../src/file-tree/expandLevels';

const ROOT = '__root__';

/**
 * root
 *  ├ a (folder)
 *  │  ├ a1 (folder)
 *  │  │  └ a1x (file)
 *  │  └ a2 (file)
 *  ├ b (folder, no subfolders)
 *  └ c (file)
 */
const items: FolderItems = {
  [ROOT]: { children: ['a', 'b', 'c'], isFolder: true },
  a: { children: ['a1', 'a2'], isFolder: true },
  a1: { children: ['a1x'], isFolder: true },
  a1x: { children: [], isFolder: false },
  a2: { children: [], isFolder: false },
  b: { children: [], isFolder: true },
  c: { children: [], isFolder: false },
};

describe('getFolderIdsByLevel', () => {
  it('groups folders by nesting depth, ignoring files', () => {
    expect(getFolderIdsByLevel(items, ROOT)).toEqual([['a', 'b'], ['a1']]);
  });

  it('returns no levels for a tree without folders', () => {
    expect(getFolderIdsByLevel({ [ROOT]: { children: ['c'], isFolder: true }, c: { isFolder: false } }, ROOT))
      .toEqual([]);
  });

  it('terminates on a cyclic parent link', () => {
    const cyclic: FolderItems = {
      [ROOT]: { children: ['a'], isFolder: true },
      a: { children: ['b'], isFolder: true },
      b: { children: ['a'], isFolder: true },
    };
    expect(getFolderIdsByLevel(cyclic, ROOT)).toEqual([['a'], ['b']]);
  });
});

describe('getMaxFolderLevel', () => {
  it('counts the deepest folder nesting level', () => {
    expect(getMaxFolderLevel(items, ROOT)).toBe(2);
  });

  it('is zero when nothing can be expanded', () => {
    expect(getMaxFolderLevel({ [ROOT]: { children: [], isFolder: true } }, ROOT)).toBe(0);
  });
});

describe('getFolderIdsUpToLevel', () => {
  it('returns nothing at level 0', () => {
    expect(getFolderIdsUpToLevel(items, ROOT, 0)).toEqual([]);
  });

  it('returns top-level folders at level 1', () => {
    expect(getFolderIdsUpToLevel(items, ROOT, 1)).toEqual(['a', 'b']);
  });

  it('adds the next depth at level 2', () => {
    expect(getFolderIdsUpToLevel(items, ROOT, 2)).toEqual(['a', 'b', 'a1']);
  });

  it('caps at the deepest level', () => {
    expect(getFolderIdsUpToLevel(items, ROOT, 99)).toEqual(['a', 'b', 'a1']);
  });
});

describe('getExpandedLevel', () => {
  it('is 0 when nothing is expanded', () => {
    expect(getExpandedLevel(items, ROOT, [])).toBe(0);
  });

  it('is 0 when only some top-level folders are expanded', () => {
    expect(getExpandedLevel(items, ROOT, ['a'])).toBe(0);
  });

  it('is 1 when every top-level folder is expanded', () => {
    expect(getExpandedLevel(items, ROOT, ['a', 'b'])).toBe(1);
  });

  it('is 0 when a deeper folder is open but a top-level sibling is not', () => {
    expect(getExpandedLevel(items, ROOT, ['a', 'a1'])).toBe(0);
  });

  it('reaches the max level when everything is expanded', () => {
    expect(getExpandedLevel(items, ROOT, ['a', 'b', 'a1'])).toBe(2);
  });
});

describe('nextExpandLevel', () => {
  it('steps one level at a time and wraps back to collapsed', () => {
    const max = getMaxFolderLevel(items, ROOT);
    expect(nextExpandLevel(0, max)).toBe(1);
    expect(nextExpandLevel(1, max)).toBe(2);
    expect(nextExpandLevel(2, max)).toBe(0);
  });

  it('collapses immediately from a hand-expanded level past the max', () => {
    expect(nextExpandLevel(5, 2)).toBe(0);
  });

  it('stays collapsed when there is nothing to expand', () => {
    expect(nextExpandLevel(0, 0)).toBe(0);
  });
});

describe('expandToggleLabelFor', () => {
  it('names the level the next click reveals', () => {
    expect(expandToggleLabelFor(0, 3)).toBe('Expand Level 1');
    expect(expandToggleLabelFor(1, 3)).toBe('Expand Level 2');
    expect(expandToggleLabelFor(2, 3)).toBe('Expand Level 3');
  });

  it('says "Collapse All" once the deepest level is showing', () => {
    expect(expandToggleLabelFor(3, 3)).toBe('Collapse All');
  });

  it('says "Expand All" for a single-level tree', () => {
    expect(expandToggleLabelFor(0, 1)).toBe('Expand All');
    expect(expandToggleLabelFor(0, 0)).toBe('Expand All');
  });
});
