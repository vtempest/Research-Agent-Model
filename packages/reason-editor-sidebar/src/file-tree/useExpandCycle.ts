/**
 * @module file-tree/useExpandCycle
 * @description Shared state and behaviour behind the file tree's
 * "expand one folder level per click" toggle.
 *
 * The cycle used to live inline in {@link Sidebar}, which tied it to the left
 * sidebar's toolbar. That left the toggle dead whenever the Files panel was
 * not in that sidebar — turned off in the view menu, or moved to the right
 * panel — because there was no mounted tree behind the ref, and it left the
 * Files panel itself without any expand control of its own. Keeping the logic
 * here lets both the toolbar and the Files panel header drive the same cycle,
 * and lets each of them tell whether there is a tree to drive at all.
 */
import { useCallback, useState } from 'react';
import type { RefObject } from 'react';

import type { DocumentTreeHandle } from './filetree';
import { expandToggleLabelFor, nextExpandLevel } from './expandLevels';

/** Expansion depth of a file tree: `level` of `maxLevel` folder levels shown. */
export interface ExpandState {
  level: number;
  maxLevel: number;
}

export interface ExpandCycle {
  /** True while there is a mounted tree with at least one folder to cycle. */
  canCycle: boolean;
  /** True once every folder level is showing, so the next click collapses. */
  isFullyExpanded: boolean;
  /** Describes the action the next click performs, for tooltip and label. */
  label: string;
  /** Hand this to the tree's `onExpandStateChange`. */
  onExpandStateChange: (next: ExpandState) => void;
  /** The depth the tree last reported. */
  state: ExpandState;
  /** Steps one folder level deeper, wrapping back to fully collapsed. */
  toggle: () => void;
}

const COLLAPSED: ExpandState = { level: 0, maxLevel: 0 };

/**
 * Drives the expand/collapse cycle of the tree behind `treeRef`.
 *
 * @param treeRef - Ref to the file tree being cycled. May be empty; the
 *   returned `canCycle` is false until a tree with folders reports in.
 * @param onStateChange - Optional passthrough, so a host that renders the
 *   control somewhere else (the sidebar toolbar) can mirror the same depth.
 */
export function useExpandCycle(
  treeRef: RefObject<DocumentTreeHandle | null>,
  onStateChange?: (next: ExpandState) => void,
): ExpandCycle {
  // Sourced from the tree rather than counted from clicks, so the label stays
  // honest when folders are opened by hand or restored from persisted state.
  const [state, setState] = useState<ExpandState>(COLLAPSED);

  const onExpandStateChange = useCallback(
    (next: ExpandState) => {
      setState((prev) =>
        prev.level === next.level && prev.maxLevel === next.maxLevel ? prev : next,
      );
      onStateChange?.(next);
    },
    [onStateChange],
  );

  const toggle = useCallback(() => {
    const tree = treeRef.current;
    if (!tree) return;
    // Read the live depth off the tree: folders may have been expanded or
    // collapsed by hand since the last click, so a counter would drift.
    const currentLevel = tree.getExpandLevel?.() ?? state.level;
    const maxLevel = tree.getMaxExpandLevel?.() ?? state.maxLevel;
    if (maxLevel === 0) return;
    const next = nextExpandLevel(currentLevel, maxLevel);
    if (next === 0) {
      tree.collapseAll();
    } else {
      tree.expandToLevel(next);
    }
  }, [state.level, state.maxLevel, treeRef]);

  return {
    canCycle: state.maxLevel > 0,
    isFullyExpanded: state.maxLevel > 0 && state.level >= state.maxLevel,
    label: expandToggleLabelFor(state.level, state.maxLevel),
    onExpandStateChange,
    state,
    toggle,
  };
}
