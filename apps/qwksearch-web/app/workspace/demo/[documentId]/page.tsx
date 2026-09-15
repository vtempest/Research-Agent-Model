import { redirect } from 'next/navigation';

/**
 * `/workspace/demo/:id` — a document id with no engine specified. Plate is the
 * default Reason Editor engine, so this redirects there; the Tiptap control
 * version stays reachable at `/workspace/demo/tiptap/:id`.
 */
export default async function DemoDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;

  redirect(`/workspace/demo/plate/${documentId}`);
}
