import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { getDB } from "@/lib/database";

/**
 * `getDB()` returns a union of the D1 and libsql drizzle handles, and calling
 * a method on a union of two differently-parameterised signatures does not
 * type-check — `db.select({ ... })` reports "expected 0 arguments" across the
 * app. Both handles extend the same async SQLite base, so the admin modules
 * take that base type and keep full inference on the query builder.
 */
export type AdminDB = BaseSQLiteDatabase<"async", unknown, Record<string, never>>;

export const getAdminDB = (): AdminDB => getDB() as unknown as AdminDB;
