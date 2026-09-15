/**
 * @module moveDocument
 * @description Pure reordering helper behind the file tree's drag-and-drop.
 * The editor keeps documents as one flat, depth-first ordered list where a
 * node's parent is recorded on `parentId` and sibling order is the order of
 * the list itself, so a move has to relocate the dragged node *and* the block
 * of descendants that follows it.
 */
import type { Document } from "react-reason-editor-sidebar";

export type MovePosition = "before" | "after" | "child";

/** Ids of every descendant of `id`, in the list's own order. */
export function collectDescendantIds(
  documents: Document[],
  id: string,
): string[] {
  const descendants: string[] = [];
  const walk = (parentId: string) => {
    for (const doc of documents) {
      if (doc.parentId === parentId) {
        descendants.push(doc.id);
        walk(doc.id);
      }
    }
  };
  walk(id);
  return descendants;
}

/**
 * Index just past the given document and everything nested under it, so an
 * "after" drop clears the target's whole subtree instead of landing inside it.
 */
function endOfSubtree(documents: Document[], id: string): number {
  const subtree = new Set([id, ...collectDescendantIds(documents, id)]);
  let end = documents.findIndex((doc) => doc.id === id);
  if (end === -1) return documents.length;
  for (let i = end; i < documents.length; i++) {
    if (subtree.has(documents[i].id)) end = i;
  }
  return end + 1;
}

/**
 * Moves `draggedId` (with its subtree) relative to `targetId`.
 *
 * Returns the original list unchanged when the move is a no-op or would put a
 * document inside its own subtree; callers can compare identity to tell.
 *
 * @param documents - The flat, depth-first ordered document list.
 * @param draggedId - Document being dragged.
 * @param targetId - Drop anchor, or `null` for the root level.
 * @param position - Placement relative to the anchor.
 */
export function moveDocumentInList(
  documents: Document[],
  draggedId: string,
  targetId: string | null,
  position: MovePosition,
): Document[] {
  const dragged = documents.find((doc) => doc.id === draggedId);
  if (!dragged || draggedId === targetId) return documents;
  if (targetId && !documents.some((doc) => doc.id === targetId)) return documents;

  const movingIds = new Set([draggedId, ...collectDescendantIds(documents, draggedId)]);
  // Dropping a node into its own subtree would orphan the whole branch.
  if (targetId && movingIds.has(targetId)) return documents;

  const targetDoc = targetId ? documents.find((doc) => doc.id === targetId) : undefined;
  const newParentId =
    position === "child" ? targetId : (targetDoc?.parentId ?? null);

  // The subtree travels as one contiguous block so the list stays depth-first.
  const block = documents
    .filter((doc) => movingIds.has(doc.id))
    .map((doc) => (doc.id === draggedId ? { ...doc, parentId: newParentId } : doc));
  const rest = documents.filter((doc) => !movingIds.has(doc.id));

  let insertIndex: number;
  if (position === "before") {
    insertIndex = rest.findIndex((doc) => doc.id === targetId);
  } else if (position === "after") {
    insertIndex = endOfSubtree(rest, targetId!);
  } else if (targetId) {
    // Dropped onto a folder: append after its existing children, matching how
    // the tree library itself appends to a drop target's child list.
    insertIndex = endOfSubtree(rest, targetId);
  } else {
    // Dropped onto the root: append at the end of the top level.
    insertIndex = rest.length;
  }
  if (insertIndex < 0) insertIndex = rest.length;

  return [...rest.slice(0, insertIndex), ...block, ...rest.slice(insertIndex)];
}
