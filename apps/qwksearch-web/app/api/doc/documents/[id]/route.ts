/**
 * @fileoverview Single document CRUD endpoint. GET retrieves a document by ID.
 * PUT updates title, content, parent, or metadata. DELETE removes a document.
 * All operations enforce owner-based access control.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/database";
import { documents, documentAccessRequests } from "@/lib/database/schema";
import { eq, and } from "drizzle-orm";
import { initAuth } from "@/lib/auth";
import { AuthSession } from "@/lib/auth/session";

export const runtime = "nodejs";

// GET a single document
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDB();
    const auth = await initAuth();
    const session = (await auth.api.getSession({
      headers: req.headers,
    })) as AuthSession | null;
    const userId = session?.user?.id || null;
    const { id } = await params;

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(id)))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // Check access permissions
    if (document.userId && document.userId !== userId) {
      // Let the caller know whether this user has already sent an access
      // request, so the UI can render "request pending" instead of a
      // fresh "Request access" button on reload.
      let accessRequested = false;
      if (userId) {
        const [existingRequest] = await db
          .select({ id: documentAccessRequests.id })
          .from(documentAccessRequests)
          .where(
            and(
              eq(documentAccessRequests.documentId, document.id),
              eq(documentAccessRequests.requesterUserId, userId),
            ),
          )
          .limit(1);
        accessRequested = Boolean(existingRequest);
      }

      return NextResponse.json(
        { error: "Unauthorized", accessRequested },
        { status: 403 },
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 },
    );
  }
}

// PUT - Update a document
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDB();
    const auth = await initAuth();
    const session = (await auth.api.getSession({
      headers: req.headers,
    })) as AuthSession | null;
    const userId = session?.user?.id || null;
    const { id } = await params;

    const body = await req.json();
    const { title, content, parentId, isExpanded, metadata, name } = body;

    // Check if document exists and user has permission
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(id)))
      .limit(1);

    if (!existingDoc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (existingDoc.userId && existingDoc.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (isExpanded !== undefined) updateData.isExpanded = isExpanded ? 1 : 0;
    if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

    const [updatedDocument] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, parseInt(id)))
      .returning();

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 },
    );
  }
}

// DELETE a document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDB();
    const auth = await initAuth();
    const session = (await auth.api.getSession({
      headers: req.headers,
    })) as AuthSession | null;
    const userId = session?.user?.id || null;
    const { id } = await params;

    // Check if document exists and user has permission
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(id)))
      .limit(1);

    if (!existingDoc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (existingDoc.userId && existingDoc.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(documents).where(eq(documents.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
