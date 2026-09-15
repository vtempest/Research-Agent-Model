/**
 * @module file-tree/expandLevels
 * @description Pure helpers behind the file tree's "expand one level at a
 * time" cycle: which folders live at each nesting depth, how deep the tree
 * is currently expanded, and which level a click should move to next.
 */

/** Minimal shape the level math needs from a tree item. */
export interface FolderLikeItem {
  children?: string[];
  isFolder: boolean;
}

export type FolderItems = Record<string, FolderLikeItem>;

/** Folder ids grouped by nesting depth (index 0 = top-level folders). */
export function getFolderIdsByLevel(items: FolderItems, rootId: string): string[][] {
  const levels: string[][] = [];
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const childId of items[id]?.children ?? []) {
        // Guard against cycles from malformed parent links.
        if (seen.has(childId)) continue;
        seen.add(childId);
        if (items[childId]?.isFolder) next.push(childId);
      }
    }
    if (next.length === 0) break;
    levels.push(next);
    frontier = next;
  }

  return levels;
}

/** Deepest folder nesting level in the tree (0 = no folders at all). */
export function getMaxFolderLevel(items: FolderItems, rootId: string): number {
  return getFolderIdsByLevel(items, rootId).length;
}

/** Folder ids reachable within `level` levels of nesting (1 = top-level folders). */
export function getFolderIdsUpToLevel(
  items: FolderItems,
  rootId: string,
  level: number,
): string[] {
  if (level <= 0) return [];
  return getFolderIdsByLevel(items, rootId).slice(0, level).flat();
}

/**
 * Infers the deepest folder level that is currently fully expanded: the
 * largest depth `L` such that every folder at depth <= L is expanded.
 * Returns 0 when any top-level folder is collapsed.
 */
export function getExpandedLevel(
  items: FolderItems,
  rootId: string,
  expandedItems: readonly string[],
): number {
  const expanded = new Set(expandedItems);
  let level = 0;
  for (const idsAtDepth of getFolderIdsByLevel(items, rootId)) {
    if (!idsAtDepth.every((id) => expanded.has(id))) break;
    level++;
  }
  return level;
}

/**
 * The level one click of the expand/collapse toggle should move to: one
 * level deeper each time, wrapping back to fully collapsed once the
 * deepest level is showing.
 */
export function nextExpandLevel(currentLevel: number, maxLevel: number): number {
  if (maxLevel <= 0) return 0;
  const level = Math.min(Math.max(currentLevel, 0), maxLevel);
  return level >= maxLevel ? 0 : level + 1;
}

/** Tooltip text describing what the next click of the toggle will do. */
export function expandToggleLabelFor(currentLevel: number, maxLevel: number): string {
  if (maxLevel <= 0) return 'Expand All';
  if (currentLevel >= maxLevel) return 'Collapse All';
  if (currentLevel === 0 && maxLevel === 1) return 'Expand All';
  return `Expand Level ${currentLevel + 1}`;
}
