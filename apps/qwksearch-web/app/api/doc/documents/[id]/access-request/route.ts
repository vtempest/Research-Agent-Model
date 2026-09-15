/**
 * @fileoverview Requests access to a document owned by someone else. Sends
 * one email notification to the document's owner and records the request so
 * the same requester can never trigger a second email for the same document
 * (enforced by a unique index on documentId+requesterUserId, not just this
 * check — see lib/database/schema.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/database";
import { documents, documentAccessRequests, user } from "@/lib/database/schema";
import { eq, and } from "drizzle-orm";
import { requireUserId } from "@/lib/auth/session";
import { getCloudflareContext } from "@/lib/cloudflare/context";
import { config } from "@/lib/config/site";
import type { Env } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDB();
    const requesterUserId = await requireUserId();
    const { id } = await params;
    const documentId = parseInt(id);

    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (!document.userId) {
      return NextResponse.json(
        { error: "This document does not require access" },
        { status: 400 },
      );
    }

    if (document.userId === requesterUserId) {
      return NextResponse.json(
        { error: "You already have access to this document" },
        { status: 400 },
      );
    }

    const [existingRequest] = await db
      .select({ id: documentAccessRequests.id })
      .from(documentAccessRequests)
      .where(
        and(
          eq(documentAccessRequests.documentId, documentId),
          eq(documentAccessRequests.requesterUserId, requesterUserId),
        ),
      )
      .limit(1);

    if (existingRequest) {
      return NextResponse.json(
        { error: "Access request already sent", accessRequested: true },
        { status: 409 },
      );
    }

    // Insert first so a duplicate click (or a second tab) races into the
    // unique index instead of sending a second email.
    let inserted;
    try {
      [inserted] = await db
        .insert(documentAccessRequests)
        .values({
          documentId,
          requesterUserId,
          ownerUserId: document.userId,
          status: "sent",
        })
        .returning();
    } catch {
      // Unique constraint violation from a concurrent request.
      return NextResponse.json(
        { error: "Access request already sent", accessRequested: true },
        { status: 409 },
      );
    }

    const [[owner], [requester]] = await Promise.all([
      db.select().from(user).where(eq(user.id, document.userId)).limit(1),
      db.select().from(user).where(eq(user.id, requesterUserId)).limit(1),
    ]);

    try {
      const ctx = getCloudflareContext();
      const env = ctx.env as Env;
      if (!env.EMAIL) throw new Error("EMAIL binding not configured");
      if (!owner?.email) throw new Error("Document owner has no email on file");

      const docTitle = document.title || document.name || "Untitled";
      const requesterLabel = requester?.name || requester?.email || "Someone";
      const docUrl = `${config.baseUrl}/?docs=${document.id}`;

      await env.EMAIL.send({
        from: config.appEmail || "noreply@example.com",
        to: owner.email,
        subject: `${requesterLabel} requested access to "${docTitle}"`,
        html: `<p>${requesterLabel}${requester?.email ? ` (${requester.email})` : ""} requested access to your ${config.appName} document "${docTitle}".</p><p><a href="${docUrl}">Open the document</a> to review and share it with them.</p>`,
      });
    } catch (error) {
      console.error("[access-request] Failed to send notification email:", error);
      await db
        .update(documentAccessRequests)
        .set({ status: "failed" })
        .where(eq(documentAccessRequests.id, inserted.id));
    }

    return NextResponse.json({ success: true, accessRequested: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    console.error("Error creating access request:", error);
    return NextResponse.json(
      { error: "Failed to send access request" },
      { status: 500 },
    );
  }
}
