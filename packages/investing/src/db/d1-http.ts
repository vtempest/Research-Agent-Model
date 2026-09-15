/**
 * Cloudflare D1 over the HTTP (REST) API.
 *
 * The app runs on Cloudflare Workers, where D1 is reached through the `DB`
 * binding. Outside of workerd — maintenance scripts, one-off jobs, CI — there
 * is no binding, so the *same* D1 database is reached through Cloudflare's
 * REST API instead. This keeps a single database (Cloudflare D1) for every
 * runtime: no libsql/Turso, no Postgres, no local sqlite file.
 *
 * Required environment variables outside Workers:
 *   CLOUDFLARE_ACCOUNT_ID   Cloudflare account id
 *   CLOUDFLARE_DATABASE_ID  D1 database id (defaults to the app's database)
 *   CLOUDFLARE_D1_TOKEN     API token with D1 edit permission
 */

/** Default D1 database id for this monorepo (`ai-broker-db`). */
export const DEFAULT_D1_DATABASE_ID = "37dbe79c-2687-4127-ad02-2372e15ac077";

export interface D1HttpCredentials {
  accountId: string;
  databaseId: string;
  token: string;
}

/**
 * Read D1 REST credentials from the environment.
 * Returns null when the account id or API token is missing.
 */
export function getD1HttpCredentials(): D1HttpCredentials | null {
  // This module is also reachable from browser bundles, where `process` may not
  // exist at all.
  const vars = typeof process !== "undefined" ? process.env : undefined;
  if (!vars) return null;

  const accountId = vars.CLOUDFLARE_ACCOUNT_ID;
  const token = vars.CLOUDFLARE_D1_TOKEN || vars.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return null;

  return {
    accountId,
    databaseId: vars.CLOUDFLARE_DATABASE_ID || DEFAULT_D1_DATABASE_ID,
    token,
  };
}

interface D1QueryResult {
  results?: Record<string, unknown>[];
  success?: boolean;
  meta?: Record<string, unknown>;
}

interface D1ApiResponse {
  success: boolean;
  result?: D1QueryResult[];
  errors?: { code: number; message: string }[];
}

/** Run one statement against D1's REST API and return the raw result rows. */
async function queryD1(
  credentials: D1HttpCredentials,
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}` +
    `/d1/database/${credentials.databaseId}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const body = (await response.json()) as D1ApiResponse;

  if (!response.ok || !body.success) {
    const message =
      body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ||
      `${response.status} ${response.statusText}`;
    throw new Error(`Cloudflare D1 HTTP query failed — ${message}`);
  }

  return body.result?.[0]?.results ?? [];
}

/**
 * Callback for `drizzle-orm/sqlite-proxy`.
 *
 * drizzle's proxy driver expects rows as positional value arrays, while the D1
 * REST API returns row objects. Object key order matches the statement's
 * column order, so `Object.values` restores the positional shape drizzle maps
 * back onto the schema.
 */
export function createD1HttpDriver(credentials: D1HttpCredentials) {
  return async (
    sql: string,
    params: unknown[],
    method: "run" | "all" | "values" | "get",
  ): Promise<{ rows: unknown[] | unknown[][] }> => {
    const rows = await queryD1(credentials, sql, params);

    if (method === "run") return { rows: [] };

    const values = rows.map((row) => Object.values(row));
    return method === "get" ? { rows: values[0] ?? [] } : { rows: values };
  };
}
