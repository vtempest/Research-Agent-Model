/**
 * @module useDocumentAccessRequest
 * @description Resolves a document ID that isn't in the locally-cached
 * document list (e.g. restored from a shared `?docs=` URL on a browser that
 * has never loaded it) by fetching it from the server, and exposes a
 * one-shot "request access" action for when the server reports the caller
 * can't open it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Document } from 'react-reason-editor-sidebar';

export type DocumentAccessState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied'; accessRequested: boolean; requesting: boolean }
  | { status: 'not-found' }
  | { status: 'sign-in-required' }
  | { status: 'error' };

/**
 * @param docId - Document ID to resolve (typically a host-supplied
 *   `initialDocId` restored from a URL param), or `null` when there is none.
 * @param documents - The current locally-cached document list; if `docId`
 *   already appears here, nothing is fetched.
 * @param onResolved - Called with the fetched document once the server
 *   confirms the caller can access it, so the host can merge it into its
 *   local document list and select it.
 */
export function useDocumentAccessRequest(
  docId: string | null,
  documents: Document[],
  onResolved: (doc: Document) => void,
) {
  const [state, setState] = useState<DocumentAccessState>({ status: 'idle' });
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  // Tracks which docId this hook has already attempted to resolve, so a
  // parent re-render (which hands back a new `documents` array reference
  // from useLocalStorage) never re-triggers the fetch.
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!docId || documentsRef.current.some((doc) => doc.id === docId)) {
      setState({ status: 'idle' });
      return;
    }
    if (attemptedRef.current === docId) return;
    attemptedRef.current = docId;

    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      try {
        const res = await fetch(`/api/doc/documents/${docId}`, {
          credentials: 'include',
        });
        if (cancelled) return;

        if (res.ok) {
          const doc = await res.json();
          onResolvedRef.current({
            id: doc.id.toString(),
            title: doc.title || doc.name || 'Untitled',
            content: doc.content || '',
            parentId: doc.parentId ? doc.parentId.toString() : null,
            children: [],
            isExpanded: doc.isExpanded === 1,
            isFolder: doc.isFolder === 1,
            tags: doc.metadata ? JSON.parse(doc.metadata).tags || [] : [],
          } as Document);
          setState({ status: 'idle' });
          return;
        }

        if (res.status === 401) {
          setState({ status: 'sign-in-required' });
          return;
        }

        if (res.status === 403) {
          const body = await res.json().catch(() => ({}) as any);
          setState({
            status: 'denied',
            accessRequested: Boolean(body?.accessRequested),
            requesting: false,
          });
          return;
        }

        if (res.status === 404) {
          setState({ status: 'not-found' });
          return;
        }

        setState({ status: 'error' });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  const requestAccess = useCallback(async () => {
    if (!docId) return;
    setState((prev) =>
      prev.status === 'denied' ? { ...prev, requesting: true } : prev,
    );
    try {
      const res = await fetch(`/api/doc/documents/${docId}/access-request`, {
        method: 'POST',
        credentials: 'include',
      });
      // 201 (sent now) and 409 (already sent, e.g. a race with another tab)
      // both resolve to the same "sent" UI — either way, no further request
      // can go out for this document.
      if (res.ok || res.status === 409) {
        setState({ status: 'denied', accessRequested: true, requesting: false });
      } else {
        setState((prev) =>
          prev.status === 'denied' ? { ...prev, requesting: false } : prev,
        );
      }
    } catch {
      setState((prev) =>
        prev.status === 'denied' ? { ...prev, requesting: false } : prev,
      );
    }
  }, [docId]);

  const dismiss = useCallback(() => setState({ status: 'idle' }), []);

  return { state, requestAccess, dismiss };
}
