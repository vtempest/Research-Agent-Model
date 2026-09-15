/**
 * @fileoverview Decides when the homepage is still in its *landing* state —
 * the only state that gets the marketing features slab stacked underneath the
 * research workspace.
 *
 * The workspace never leaves `/` (chats and REASON documents are tabs within
 * this one route), so a route check alone would leave a screen of marketing
 * copy scrollable underneath an active conversation. Kept as a plain function
 * outside the component so it can be unit tested without a DOM.
 */

/** Everything the landing check needs, read from the router and chat stores. */
export interface HomeLandingState {
  /** Current pathname from `usePathname()`. */
  pathname: string | null;
  /** Active workspace view from `useMainView()` — `research`, `docs`, … */
  activeView: string;
  /** Number of user/assistant turns in the current chat. */
  chatTurnCount: number;
}

/**
 * True only on the homepage's untouched landing screen: the research view with
 * nothing submitted yet. Any submitted chat turn — or switching to another
 * workspace view — takes the features slab (and its scroll cue) away.
 */
export function isHomeLandingState({
  pathname,
  activeView,
  chatTurnCount,
}: HomeLandingState): boolean {
  return pathname === '/' && activeView === 'research' && chatTurnCount === 0;
}
