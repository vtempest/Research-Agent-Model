/**
 * `/workspace/demo/playground/:id` — the default Reason Editor demo.
 *
 * The same Plate editor as `/workspace/demo/plate/:id`, reading the same
 * document through the same API and syncing through the same
 * `reason-editor:plate:<id>` room, but wearing the Plate playground's toolbar:
 * every button the registered plugin set supports, restyled to `ReasonToolbar`'s
 * look. Switch between the two to compare the toolbars over one document.
 */

'use client';

import { use, useEffect, useMemo, useState } from 'react';

import {
  htmlToPlateValue,
  ReasonPlaygroundEditor,
} from 'react-reason-editor/docs-agent';

import { DemoShell } from '@/components/reason-demo/DemoShell';
import {
  loadDemoDocument,
  loadDemoUser,
  type ReasonDemoDocument,
  type ReasonDemoUser,
} from '@/lib/reason-demo/document-api';

export default function PlaygroundDemoPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);

  const [document, setDocument] = useState<ReasonDemoDocument | null>(null);
  const [user, setUser] = useState<ReasonDemoUser | null>(null);

  useEffect(() => {
    setDocument(loadDemoDocument(documentId));
    setUser(loadDemoUser());
  }, [documentId]);

  // Seeds an empty room only; once the room has content Yjs is authoritative.
  const initialValue = useMemo(
    () => (document ? htmlToPlateValue(document.html) : undefined),
    [document],
  );

  const authToken = useMemo(
    () => (process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ? user?.id : undefined),
    [user],
  );

  if (!document || !user || !initialValue) return null;

  return (
    <DemoShell
      collaborative={Boolean(authToken)}
      documentId={documentId}
      surface="playground"
      title={document.title}
    >
      <ReasonPlaygroundEditor
        authToken={authToken}
        documentId={documentId}
        initialValue={initialValue}
        user={user}
      />
    </DemoShell>
  );
}
