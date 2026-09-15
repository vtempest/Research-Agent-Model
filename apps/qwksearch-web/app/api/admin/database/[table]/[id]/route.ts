import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getAdminDB } from "@/lib/admin/db";
import {
  InvalidUpdateError,
  deleteTableRow,
  isAdminTableKey,
  updateTableRow,
} from "@/lib/admin/db-tables";

export const runtime = "nodejs";

type Params = { params: Promise<{ table: string; id: string }> };

/** Writes the registry-approved columns of one row. Everything else in the body is dropped. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { table, id } = await params;
  if (!isAdminTableKey(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const row = await updateTableRow(getAdminDB(), table, id, body as Record<string, unknown>);
    if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
    return NextResponse.json({ row });
  } catch (err) {
    if (err instanceof InvalidUpdateError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { table, id } = await params;
  if (!isAdminTableKey(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  const row = await deleteTableRow(getAdminDB(), table, id);
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  return NextResponse.json({ ok: true, row });
}
