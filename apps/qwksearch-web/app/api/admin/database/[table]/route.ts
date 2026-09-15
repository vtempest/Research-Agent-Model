import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getAdminDB } from "@/lib/admin/db";
import { describeTable, isAdminTableKey, loadTableRows } from "@/lib/admin/db-tables";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function intParam(raw: string | null, fallback: number): number {
  const parsed = parseInt(raw ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

type Params = { params: Promise<{ table: string }> };

/** One page of rows from a registered table, projected to its listed columns. */
export async function GET(req: NextRequest, { params }: Params) {
  const guard = await assertAdmin();
  if (guard) return guard;

  const { table } = await params;
  if (!isAdminTableKey(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  // `|| fallback` would turn an explicit `0` into the default instead of
  // clamping it, so unparseable input is caught with Number.isNaN.
  const page = Math.max(1, intParam(searchParams.get("page"), 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, intParam(searchParams.get("limit"), DEFAULT_LIMIT)));

  const { rows, matchedRows } = await loadTableRows(getAdminDB(), table, {
    page,
    limit,
    search: searchParams.get("q")?.trim() || undefined,
  });

  return NextResponse.json({
    table: describeTable(table),
    rows,
    page,
    limit,
    matchedRows,
    pageCount: Math.max(Math.ceil(matchedRows / limit), 1),
  });
}
