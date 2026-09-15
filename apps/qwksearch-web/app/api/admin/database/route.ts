import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getAdminDB } from "@/lib/admin/db";
import { describeMaintenanceActions, loadTableCounts } from "@/lib/admin/db-tables";

export const runtime = "nodejs";

/**
 * The database control surface: every table an admin may browse, with its row
 * count and the columns that are writable, plus the one-click cleanups.
 */
export async function GET() {
  const guard = await assertAdmin();
  if (guard) return guard;

  const tables = await loadTableCounts(getAdminDB());

  return NextResponse.json({
    tables,
    maintenance: describeMaintenanceActions(),
  });
}
