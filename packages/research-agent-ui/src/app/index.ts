/**
 * @fileoverview The QwkSearch general app shell, minus the REASON editor: the
 * provider stack, the app dock, the cookie banner, the research/docs view
 * switch, and chat-tab bookkeeping.
 *
 * Everything here is editor-free, so importing it never pulls the Tiptap/Plate
 * dependency tree into a consuming bundle. The editor-bearing counterparts live
 * in `research-agent-ui/workspace`.
 */
export { QwkSearchApp, type QwkSearchAppProps } from './QwkSearchApp';
export {
  QwkSearchProviders,
  type QwkSearchProvidersProps,
} from './QwkSearchProviders';
export { CategoryDock } from './CategoryDock';
export { CookieConsent } from './CookieConsent';
export {
  MainViewProvider,
  useMainView,
  type MainViewMode,
} from './MainViewProvider';
export { useChatTabs, type ChatTab } from './useChatTabs';
export { useChunkErrorReload } from './useChunkErrorReload';
