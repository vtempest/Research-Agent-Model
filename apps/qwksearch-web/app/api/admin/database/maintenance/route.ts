import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getAdminDB } from "@/lib/admin/db";
import {
  MAINTENANCE_ACTIONS,
  isMaintenanceActionKey,
} from "@/lib/admin/db-tables";

export const runtime = "nodejs";

/** Runs one named cleanup. The action name is matched against the registry, never interpolated. */
export async function POST(req: NextRequest) {
  const guard = await assertAdmin();
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = (body as { action?: unknown } | null)?.action;
  if (typeof action !== "string" || !isMaintenanceActionKey(action)) {
    return NextResponse.json({ error: "Unknown maintenance action" }, { status: 400 });
  }

  try {
    const result = await MAINTENANCE_ACTIONS[action].run(getAdminDB());
    return NextResponse.json({ action, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Maintenance action failed", details: message }, { status: 500 });
  }
}
