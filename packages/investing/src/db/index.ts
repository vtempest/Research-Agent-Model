import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import * as relations from "./relations";
import { createD1HttpDriver, getD1HttpCredentials } from "./d1-http";

const fullSchema = { ...schema, ...relations };

type Database = ReturnType<typeof drizzleD1<typeof fullSchema>>;

let _db: Database | null = null;

/**
 * Resolve the Cloudflare D1 connection for the current runtime.
 *
 * - On Workers: the `DB` binding, through `drizzle-orm/d1`.
 * - Anywhere else (scripts, CI): the same D1 database over its REST API,
 *   through `drizzle-orm/sqlite-proxy`.
 *
 * Cloudflare D1 is the only supported database. The binding is read off
 * globalThis rather than imported from `cloudflare:workers` so this package
 * still builds standalone (vite lib build) and stays usable from plain Node
 * scripts and browser bundles. The web app's Worker entry
 * (apps/ai-broker-web/worker/index.ts) publishes it.
 */
function resolveDb(): Database {
  if (_db) return _db;

  const env = (globalThis as { __CLOUDFLARE_ENV__?: { DB?: unknown } }).__CLOUDFLARE_ENV__;
  if (env?.DB) {
    _db = drizzleD1(env.DB as never, { schema: fullSchema });
    return _db;
  }

  const credentials = getD1HttpCredentials();
  if (!credentials) {
    throw new Error(
      "No Cloudflare D1 connection available. On Workers this needs the `DB` " +
        "binding from wrangler.jsonc; elsewhere set CLOUDFLARE_ACCOUNT_ID and " +
        "CLOUDFLARE_D1_TOKEN (and optionally CLOUDFLARE_DATABASE_ID) to reach " +
        "D1 over its REST API.",
    );
  }

  _db = drizzleProxy(createD1HttpDriver(credentials), {
    schema: fullSchema,
  }) as unknown as Database;
  return _db;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = resolveDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as CallableFunction).bind(real) : value;
  },
  has(_target, prop) {
    return prop in (resolveDb() as object);
  },
});

export { DEFAULT_D1_DATABASE_ID, getD1HttpCredentials } from "./d1-http";
