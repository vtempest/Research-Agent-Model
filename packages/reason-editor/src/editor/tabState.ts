/**
 * @module tabState
 * @description Pure tab-list arithmetic behind the Open Tabs panel's close
 * actions. Kept out of {@link useReasonDocsState} so the multi-tab cases
 * ("Close Tabs Below", "Close Other Tabs") can be reasoned about — and
 * tested — without a React tree.
 */

/** Outcome of closing one or more tabs. */
export interface CloseTabsResult {
  /** The tab list with every closed tab removed. */
  openTabs: string[];
  /** The tab that should be active afterwards — unchanged unless the active tab was closed. */
  activeTabId: string | null;
  /** The subset of the requested IDs that were actually open. */
  closed: string[];
}

/**
 * Closes `tabIds` in one step and picks the tab to activate next.
 *
 * The whole batch is resolved against a single starting list, which is the
 * point: applying closes one at a time against state read from the same
 * render makes every close start over from the pre-close list, so all but the
 * last one is lost. When the active tab is among those closed, focus moves to
 * the nearest surviving tab — scanning left from its old position first, then
 * right, so closing a tab lands you on its neighbour rather than jumping to
 * the top of the list.
 *
 * @param openTabs - Currently open tab IDs, in display order.
 * @param activeTabId - The currently active tab, if any.
 * @param tabIds - Tab IDs to close; IDs that are not open are ignored.
 */
export function closeTabs(
  openTabs: string[],
  activeTabId: string | null,
  tabIds: string[],
): CloseTabsResult {
  const closing = new Set(tabIds.filter((id) => openTabs.includes(id)));

  if (closing.size === 0) {
    return { openTabs, activeTabId, closed: [] };
  }

  const remaining = openTabs.filter((id) => !closing.has(id));
  const closed = openTabs.filter((id) => closing.has(id));

  if (!activeTabId || !closing.has(activeTabId)) {
    return { openTabs: remaining, activeTabId, closed };
  }

  const activeIndex = openTabs.indexOf(activeTabId);
  let nextActive: string | null = null;
  for (let i = activeIndex - 1; i >= 0 && nextActive === null; i--) {
    if (!closing.has(openTabs[i])) nextActive = openTabs[i];
  }
  for (let i = activeIndex + 1; i < openTabs.length && nextActive === null; i++) {
    if (!closing.has(openTabs[i])) nextActive = openTabs[i];
  }

  return { openTabs: remaining, activeTabId: nextActive, closed };
}
