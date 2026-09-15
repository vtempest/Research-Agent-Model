/**
 * Chrome shared by the demo routes: the document sidebar, the title, the
 * surface switcher, and the collaboration status line. Deliberately thin —
 * everything that is part of the *editor* (toolbar included) comes from
 * `react-reason-editor/docs-agent`, so the only visible difference between the
 * routes is the editor itself. The sidebar is the same
 * `react-reason-editor/docs-agent` `ReasonSidebar` mounted here rather than
 * inside any editor, so switching surfaces never remounts it.
 *
 * Three surfaces, two engines: `playground` and `plate` are both the Plate
 * editor and share its Yjs room, differing only in toolbar, so a document
 * carries across the switcher between them. `tiptap` stores a ProseMirror
 * document in a room of its own and does not.
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ReactNode } from 'react';

import { type EditorEngine, ReasonSidebar } from 'react-reason-editor/docs-agent';

export type DemoSurface = 'playground' | 'plate' | 'tiptap';

const SURFACES: { id: DemoSurface; engine: EditorEngine; label: string }[] = [
  { engine: 'plate', id: 'playground', label: 'playground' },
  { engine: 'plate', id: 'plate', label: 'plate' },
  { engine: 'tiptap', id: 'tiptap', label: 'tiptap' },
];

export function DemoShell({
  children,
  documentId,
  surface,
  title,
  collaborative,
}: {
  children: ReactNode;
  documentId: string;
  surface: DemoSurface;
  title: string;
  collaborative: boolean;
}) {
  const router = useRouter();
  const engine = SURFACES.find((s) => s.id === surface)?.engine ?? 'plate';

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-2 dark:border-slate-700">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-slate-800 dark:text-gray-300">
          {surface}
        </span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {collaborative
            ? `room reason-editor:${engine}:${documentId}`
            : 'collaboration off — set NEXT_PUBLIC_HOCUSPOCUS_URL'}
        </span>
        <nav className="ml-auto flex items-center gap-1">
          {SURFACES.filter((s) => s.id !== surface).map((s) => (
            <Link
              className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
              href={`/workspace/demo/${s.id}/${documentId}`}
              key={s.id}
            >
              Open {s.label} version
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1">
        <ReasonSidebar
          activeDocumentId={documentId}
          linkForDocument={(id) => `/workspace/demo/${surface}/${id}`}
          onNavigate={(id) => router.push(`/workspace/demo/${surface}/${id}`)}
        />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
