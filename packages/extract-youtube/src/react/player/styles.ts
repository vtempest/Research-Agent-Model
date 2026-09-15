/**
 * @fileoverview Scoped, framework-agnostic styles for the floating player.
 *
 * Same approach as the transcript modal: no Tailwind, no CSS-in-JS, no design
 * system — one `<style>` block with an `eytp-` prefix, injected once per
 * document. Colours come from CSS custom properties so a host app can retheme
 * the widget without forking it, and the defaults follow the page's
 * `prefers-color-scheme`.
 */

/** Injected once per document (and again into the PiP window, which is its own document). */
export const PLAYER_STYLE_ID = 'extract-youtube-floating-player-styles';

export const PLAYER_STYLES = `
.eytp-root {
  --eytp-bg: #ffffff;
  --eytp-fg: #111827;
  --eytp-muted: #6b7280;
  --eytp-bar: #f3f4f6;
  --eytp-border: #e5e7eb;
  --eytp-accent: #3b82f6;
  --eytp-danger: #dc2626;
  position: fixed;
  z-index: 9999;
  bottom: 24px;
  right: 16px;
  width: 380px;
  max-width: calc(100vw - 2rem);
  background: var(--eytp-bg);
  color: var(--eytp-fg);
  border: 1px solid var(--eytp-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  transition: width 0.3s ease, height 0.3s ease;
}
@media (prefers-color-scheme: dark) {
  .eytp-root {
    --eytp-bg: #0b0f19;
    --eytp-fg: #f3f4f6;
    --eytp-muted: #9ca3af;
    --eytp-bar: #161b26;
    --eytp-border: #2a3040;
  }
}
.eytp-root.eytp-minimized { width: 260px; }
/* The width transition is for the minimize/expand toggle. During a resize it
   would make the widget rubber-band behind the pointer, so it's off mid-gesture. */
.eytp-root.eytp-interacting { transition: none; }

.eytp-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: var(--eytp-bar);
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.eytp-bar.eytp-grabbing { cursor: grabbing; }
.eytp-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; overflow: hidden; }
.eytp-title-text { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.eytp-controls { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.eytp-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--eytp-muted);
  cursor: pointer;
  line-height: 0;
}
.eytp-btn:hover { color: var(--eytp-fg); background: rgba(127, 127, 127, 0.18); }
.eytp-btn-active { color: var(--eytp-accent); background: rgba(59, 130, 246, 0.14); }
.eytp-btn-count { font-size: 10px; font-variant-numeric: tabular-nums; line-height: 1; }

.eytp-video { position: relative; width: 100%; padding-top: 56.25%; background: #000; }
.eytp-video.eytp-hidden { display: none; }
.eytp-video.eytp-pip { position: absolute; inset: 0; width: 100%; height: 100%; padding-top: 0; }
.eytp-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

.eytp-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  background: var(--eytp-bg);
}
.eytp-error-text { font-size: 12px; color: var(--eytp-muted); margin: 0; }
.eytp-error-actions { display: flex; gap: 8px; }
.eytp-link {
  border: 1px solid var(--eytp-border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.eytp-link:hover { background: rgba(127, 127, 127, 0.14); }

.eytp-queue { border-top: 1px solid var(--eytp-border); background: var(--eytp-bar); padding: 6px 10px; }
.eytp-queue-heading {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--eytp-muted);
  margin-bottom: 2px;
}
.eytp-queue-next { font-size: 12px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.eytp-queue-rest { font-size: 10px; color: var(--eytp-muted); margin: 2px 0 0; }

.eytp-subtitles { max-height: 190px; overflow-y: auto; border-bottom: 1px solid var(--eytp-border); padding: 6px; }

.eytp-line {
  display: block;
  width: 100%;
  line-height: 1.5;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  color: inherit;
  cursor: pointer;
}
.eytp-line:hover { background: rgba(127, 127, 127, 0.14); }
.eytp-line-active { background: rgba(59, 130, 246, 0.14); }
.eytp-word-active { background: rgba(59, 130, 246, 0.3); border-radius: 3px; padding: 0 2px; font-weight: 500; }

.eytp-handle { position: absolute; }
.eytp-handle:hover { background: rgba(59, 130, 246, 0.2); }
.eytp-handle-left { left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.eytp-handle-right { right: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
.eytp-handle-bl { left: 0; bottom: 0; width: 12px; height: 12px; cursor: nesw-resize; z-index: 1; }
.eytp-handle-br { right: 0; bottom: 0; width: 12px; height: 12px; cursor: nwse-resize; z-index: 1; }
/* Swallows pointer events over the iframe mid-resize, which would otherwise
   capture the drag and freeze the gesture. */
.eytp-resize-shield { position: absolute; inset: 0; z-index: 10; }
`;

/** Add the stylesheet to `doc` once. Safe to call on every render. */
export function ensureStyles(doc: Document | null | undefined): void {
  if (!doc || doc.getElementById(PLAYER_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = PLAYER_STYLE_ID;
  style.textContent = PLAYER_STYLES;
  doc.head.appendChild(style);
}
