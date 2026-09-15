'use client';

/**
 * @fileoverview The chat-only QwkSearch app: the full provider stack and app
 * chrome around the conversation surface, without the REASON editor or its
 * sidebar. Hosts that want documents too should mount `QwkSearchWorkspaceApp`
 * from `research-agent-ui/workspace` instead.
 */
import ChatWindow from '../components/ChatConversation/ChatWindow';
import { QwkSearchProviders, type QwkSearchProvidersProps } from './QwkSearchProviders';

export type QwkSearchAppProps = Omit<
  QwkSearchProvidersProps,
  'children' | 'docsEnabled'
>;

export function QwkSearchApp(props: QwkSearchAppProps) {
  return (
    <QwkSearchProviders {...props} docsEnabled={false}>
      <ChatWindow />
    </QwkSearchProviders>
  );
}

export default QwkSearchApp;
