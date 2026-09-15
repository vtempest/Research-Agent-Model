import { NextResponse } from "next/server";
import { count, desc } from "drizzle-orm";
import { assertAdmin, getAdminEmails } from "@/lib/auth/admin";
import { getAdminDB } from "@/lib/admin/db";
import { chats, documents, session, uploads, user } from "@/lib/database/schema";

export const runtime = "nodejs";

/** Compact administrative telemetry; no session tokens or API keys are exposed. */
export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const db = getAdminDB();
  const [[users], [sessions], [docs], [threads], [files], recentUsers, admins] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(session),
    db.select({ value: count() }).from(documents),
    db.select({ value: count() }).from(chats),
    db.select({ value: count() }).from(uploads),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
        isAnonymous: user.isAnonymous,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(12),
    getAdminEmails(),
  ]);

  return NextResponse.json({
    stats: {
      users: users?.value ?? 0,
      sessions: sessions?.value ?? 0,
      documents: docs?.value ?? 0,
      chats: threads?.value ?? 0,
      uploads: files?.value ?? 0,
    },
    recentUsers,
    adminEmails: admins,
  });
}
