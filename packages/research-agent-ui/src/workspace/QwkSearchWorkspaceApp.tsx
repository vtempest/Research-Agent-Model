'use client';

/**
 * @fileoverview The full QwkSearch app: the same provider stack and chrome as
 * the chat-only build, wrapped around the REASON workspace — documents,
 * editor, and file sidebar alongside the conversation.
 */
import {
  QwkSearchProviders,
  type QwkSearchProvidersProps,
} from '../app/QwkSearchProviders';
import { ResearchWorkspaceView } from './ResearchWorkspaceView';

export type QwkSearchWorkspaceAppProps = Omit<
  QwkSearchProvidersProps,
  'children' | 'docsEnabled'
>;

export function QwkSearchWorkspaceApp(props: QwkSearchWorkspaceAppProps) {
  return (
    <QwkSearchProviders {...props} docsEnabled>
      <ResearchWorkspaceView />
    </QwkSearchProviders>
  );
}

export default QwkSearchWorkspaceApp;
