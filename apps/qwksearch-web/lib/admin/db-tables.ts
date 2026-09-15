import { and, count, desc, eq, like, lt, or, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AdminDB } from "./db";
import {
  account,
  articleCache,
  articleQA,
  chats,
  documentAccessRequests,
  documents,
  favorites,
  googleDocsSync,
  messages,
  researchQuotes,
  session,
  shareTokens,
  uploads,
  user,
  userAgentSkills,
  verification,
} from "@/lib/database/schema";


/** How a value coming back from the browser is coerced before it is written. */
export type FieldType = "string" | "number" | "boolean";

export interface EditableField {
  /** Drizzle property name; also the key used in the PATCH body. */
  name: string;
  label: string;
  type: FieldType;
  /** Shown under the input as a hint about what the column means. */
  hint?: string;
}

export interface AdminTable {
  label: string;
  description: string;
  table: SQLiteTable;
  /** Row identity for PATCH/DELETE. Composite keys are not supported. */
  primaryKey: AnySQLiteColumn;
  /** Columns rendered in the browser, in order. */
  columns: Array<{ name: string; column: AnySQLiteColumn; truncate?: boolean }>;
  /** Columns the `q` parameter matches with LIKE. */
  searchable: AnySQLiteColumn[];
  /** Default ordering — newest-first wherever the table records a time. */
  orderBy: AnySQLiteColumn;
  /** Subset of `columns` an admin may write. Empty means read-and-delete only. */
  editable: EditableField[];
  /**
   * Deleting a row here cascades or orphans a lot of user-visible data, so the
   * UI asks for the row id to be typed before it will send the request.
   */
  destructive?: boolean;
}

const col = (name: string, column: AnySQLiteColumn, truncate = false) => ({
  name,
  column,
  truncate,
});

/**
 * The tables an admin may browse and edit, keyed by the slug that appears in
 * the route. This registry is the entire attack surface of the database
 * controls: a table absent from it cannot be read, written or deleted through
 * the admin API, and within a listed table only the columns in `editable` can
 * be written. Credential-bearing columns (`account.password`, OAuth tokens,
 * `session.token`) are deliberately absent from every `columns` list so they
 * are never serialised to the browser.
 */
export const ADMIN_TABLES = {
  user: {
    label: "Users",
    description:
      "Accounts. Editing quota or trial credits here takes effect on the user's next request.",
    table: user,
    primaryKey: user.id,
    columns: [
      col("id", user.id),
      col("name", user.name),
      col("email", user.email),
      col("emailVerified", user.emailVerified),
      col("isAnonymous", user.isAnonymous),
      col("trialAllowed", user.trialAllowed),
      col("storageUsedBytes", user.storageUsedBytes),
      col("storageQuotaBytes", user.storageQuotaBytes),
      col("createdAt", user.createdAt),
    ],
    searchable: [user.id, user.name, user.email],
    orderBy: user.createdAt,
    editable: [
      { name: "name", label: "Display name", type: "string" },
      { name: "email", label: "Email", type: "string" },
      { name: "emailVerified", label: "Email verified", type: "boolean" },
      {
        name: "trialAllowed",
        label: "Trial credits",
        type: "number",
        hint: "Remaining free requests before a subscription is required.",
      },
      {
        name: "storageQuotaBytes",
        label: "Storage quota (bytes)",
        type: "number",
        hint: "1 GB = 1073741824.",
      },
    ],
    destructive: true,
  },
  session: {
    label: "Sessions",
    description: "Active logins. Deleting a row signs that device out immediately.",
    table: session,
    primaryKey: session.id,
    columns: [
      col("id", session.id),
      col("userId", session.userId),
      col("ipAddress", session.ipAddress),
      col("city", session.city),
      col("state", session.state),
      col("isVpn", session.isVpn),
      col("expiresAt", session.expiresAt),
      col("createdAt", session.createdAt),
    ],
    searchable: [session.id, session.userId, session.ipAddress],
    orderBy: session.createdAt,
    editable: [],
  },
  account: {
    label: "Auth accounts",
    description:
      "Linked sign-in providers. Tokens and password hashes are never sent to the browser.",
    table: account,
    primaryKey: account.id,
    columns: [
      col("id", account.id),
      col("userId", account.userId),
      col("providerId", account.providerId),
      col("accountId", account.accountId),
      col("scope", account.scope, true),
      col("createdAt", account.createdAt),
    ],
    searchable: [account.id, account.userId, account.providerId],
    orderBy: account.createdAt,
    editable: [],
  },
  verification: {
    label: "Verifications",
    description: "Pending email/reset tokens. Safe to purge once expired.",
    table: verification,
    primaryKey: verification.id,
    columns: [
      col("id", verification.id),
      col("identifier", verification.identifier),
      col("expiresAt", verification.expiresAt),
      col("createdAt", verification.createdAt),
    ],
    searchable: [verification.id, verification.identifier],
    orderBy: verification.expiresAt,
    editable: [],
  },
  documents: {
    label: "Documents",
    description: "REASON editor documents and folders.",
    table: documents,
    primaryKey: documents.id,
    columns: [
      col("id", documents.id),
      col("userId", documents.userId),
      col("name", documents.name),
      col("title", documents.title),
      col("isFolder", documents.isFolder),
      col("url", documents.url, true),
      col("updatedAt", documents.updatedAt),
    ],
    searchable: [documents.name, documents.title, documents.userId],
    orderBy: documents.updatedAt,
    editable: [
      { name: "name", label: "Name", type: "string" },
      { name: "title", label: "Title", type: "string" },
      { name: "isFolder", label: "Is folder (0/1)", type: "number" },
    ],
    destructive: true,
  },
  chats: {
    label: "Chats",
    description: "Saved chat threads. Deleting one leaves its messages orphaned — purge after.",
    table: chats,
    primaryKey: chats.id,
    columns: [
      col("id", chats.id),
      col("userId", chats.userId),
      col("title", chats.title),
      col("focusMode", chats.focusMode),
      col("isPublic", chats.isPublic),
      col("createdAt", chats.createdAt),
    ],
    searchable: [chats.id, chats.title, chats.userId],
    orderBy: chats.createdAt,
    editable: [
      { name: "title", label: "Title", type: "string" },
      { name: "isPublic", label: "Publicly shared", type: "boolean" },
    ],
  },
  messages: {
    label: "Messages",
    description: "Individual chat turns.",
    table: messages,
    primaryKey: messages.id,
    columns: [
      col("id", messages.id),
      col("chatId", messages.chatId),
      col("userId", messages.userId),
      col("role", messages.role),
      col("content", messages.content, true),
      col("createdAt", messages.createdAt),
    ],
    searchable: [messages.chatId, messages.userId, messages.content],
    orderBy: messages.createdAt,
    editable: [],
  },
  uploads: {
    label: "Uploads",
    description:
      "Uploaded file records. Deleting a row frees the user's quota but not the stored object.",
    table: uploads,
    primaryKey: uploads.fileId,
    columns: [
      col("fileId", uploads.fileId),
      col("userId", uploads.userId),
      col("fileName", uploads.fileName),
      col("fileExtension", uploads.fileExtension),
      col("size", uploads.size),
      col("createdAt", uploads.createdAt),
    ],
    searchable: [uploads.fileId, uploads.fileName, uploads.userId],
    orderBy: uploads.createdAt,
    editable: [{ name: "fileName", label: "File name", type: "string" }],
  },
  favorites: {
    label: "Favorites",
    description: "Saved articles.",
    table: favorites,
    primaryKey: favorites.id,
    columns: [
      col("id", favorites.id),
      col("userId", favorites.userId),
      col("title", favorites.title),
      col("url", favorites.url, true),
      col("source", favorites.source),
      col("createdAt", favorites.createdAt),
    ],
    searchable: [favorites.title, favorites.url, favorites.userId],
    orderBy: favorites.createdAt,
    editable: [{ name: "title", label: "Title", type: "string" }],
  },
  articleCache: {
    label: "Article cache",
    description:
      "Extracted article bodies. Rows are regenerated on demand, so deleting is always safe.",
    table: articleCache,
    primaryKey: articleCache.id,
    columns: [
      col("id", articleCache.id),
      col("url", articleCache.url, true),
      col("title", articleCache.title),
      col("source", articleCache.source),
      col("wordCount", articleCache.word_count),
      col("hitCount", articleCache.hitCount),
      col("expiresAt", articleCache.expiresAt),
    ],
    searchable: [articleCache.url, articleCache.title, articleCache.source],
    orderBy: articleCache.lastAccessed,
    editable: [],
  },
  articleQA: {
    label: "Article Q&A",
    description: "Cached answers about a cached article.",
    table: articleQA,
    primaryKey: articleQA.id,
    columns: [
      col("id", articleQA.id),
      col("articleUrl", articleQA.articleUrl, true),
      col("question", articleQA.question, true),
      col("createdAt", articleQA.createdAt),
    ],
    searchable: [articleQA.articleUrl, articleQA.question],
    orderBy: articleQA.createdAt,
    editable: [],
  },
  researchQuotes: {
    label: "Research quotes",
    description: "Quotes clipped into a document.",
    table: researchQuotes,
    primaryKey: researchQuotes.id,
    columns: [
      col("id", researchQuotes.id),
      col("documentId", researchQuotes.documentId),
      col("text", researchQuotes.text, true),
      col("source", researchQuotes.source),
      col("createdAt", researchQuotes.createdAt),
    ],
    searchable: [researchQuotes.documentId, researchQuotes.text, researchQuotes.source],
    orderBy: researchQuotes.createdAt,
    editable: [],
  },
  shareTokens: {
    label: "Share tokens",
    description: "Public links to a document. Deleting a row revokes the link.",
    table: shareTokens,
    primaryKey: shareTokens.id,
    columns: [
      col("id", shareTokens.id),
      col("documentId", shareTokens.documentId),
      col("expiresAt", shareTokens.expiresAt),
      col("createdAt", shareTokens.createdAt),
    ],
    searchable: [shareTokens.id, shareTokens.documentId],
    orderBy: shareTokens.createdAt,
    editable: [],
  },
  documentAccessRequests: {
    label: "Access requests",
    description: "Requests to open someone else's document.",
    table: documentAccessRequests,
    primaryKey: documentAccessRequests.id,
    columns: [
      col("id", documentAccessRequests.id),
      col("documentId", documentAccessRequests.documentId),
      col("requesterUserId", documentAccessRequests.requesterUserId),
      col("ownerUserId", documentAccessRequests.ownerUserId),
      col("status", documentAccessRequests.status),
      col("createdAt", documentAccessRequests.createdAt),
    ],
    searchable: [documentAccessRequests.requesterUserId, documentAccessRequests.ownerUserId],
    orderBy: documentAccessRequests.createdAt,
    editable: [],
  },
  googleDocsSync: {
    label: "Google Docs sync",
    description: "Links between a document and a Google Doc.",
    table: googleDocsSync,
    primaryKey: googleDocsSync.id,
    columns: [
      col("id", googleDocsSync.id),
      col("documentId", googleDocsSync.documentId),
      col("googleDocId", googleDocsSync.googleDocId, true),
      col("userId", googleDocsSync.userId),
      col("lastSyncedAt", googleDocsSync.lastSyncedAt),
    ],
    searchable: [googleDocsSync.documentId, googleDocsSync.userId],
    orderBy: googleDocsSync.lastSyncedAt,
    editable: [],
  },
  userAgentSkills: {
    label: "Agent skills",
    description: "Per-user agent skill toggles.",
    table: userAgentSkills,
    primaryKey: userAgentSkills.id,
    columns: [
      col("id", userAgentSkills.id),
      col("userId", userAgentSkills.userId),
      col("skillId", userAgentSkills.skillId),
      col("enabled", userAgentSkills.enabled),
      col("updatedAt", userAgentSkills.updatedAt),
    ],
    searchable: [userAgentSkills.userId, userAgentSkills.skillId],
    orderBy: userAgentSkills.updatedAt,
    editable: [{ name: "enabled", label: "Enabled", type: "boolean" }],
  },
} satisfies Record<string, AdminTable>;

export type AdminTableKey = keyof typeof ADMIN_TABLES;

export const ADMIN_TABLE_KEYS = Object.keys(ADMIN_TABLES) as AdminTableKey[];

export function isAdminTableKey(value: string): value is AdminTableKey {
  return Object.prototype.hasOwnProperty.call(ADMIN_TABLES, value);
}

/** The shape the browser needs to render a table's controls, minus the drizzle objects. */
export function describeTable(key: AdminTableKey) {
  const config = ADMIN_TABLES[key];
  return {
    key,
    label: config.label,
    description: config.description,
    primaryKey: config.primaryKey.name,
    columns: config.columns.map((entry) => entry.name),
    truncated: config.columns.filter((entry) => entry.truncate).map((entry) => entry.name),
    editable: config.editable,
    destructive: Boolean((config as AdminTable).destructive),
  };
}

/** Row counts for every registered table, for the overview grid. */
export async function loadTableCounts(db: AdminDB) {
  const entries = await Promise.all(
    ADMIN_TABLE_KEYS.map(async (key) => {
      const [row] = await db.select({ value: count() }).from(ADMIN_TABLES[key].table);
      return { ...describeTable(key), rows: row?.value ?? 0 };
    }),
  );
  return entries;
}

function buildSearch(config: AdminTable, search: string | undefined): SQL | undefined {
  if (!search || config.searchable.length === 0) return undefined;
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  return or(...config.searchable.map((column) => like(column, pattern)));
}

export interface TableRowsQuery {
  page: number;
  limit: number;
  search?: string;
}

/** One page of rows from a registered table, restricted to its listed columns. */
export async function loadTableRows(db: AdminDB, key: AdminTableKey, options: TableRowsQuery) {
  const config: AdminTable = ADMIN_TABLES[key];
  const where = buildSearch(config, options.search);
  const projection = Object.fromEntries(
    config.columns.map((entry) => [entry.name, entry.column]),
  ) as Record<string, AnySQLiteColumn>;

  const [rows, [matched]] = await Promise.all([
    db
      .select(projection)
      .from(config.table)
      .where(where)
      .orderBy(desc(config.orderBy), desc(config.primaryKey))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    db.select({ value: count() }).from(config.table).where(where),
  ]);

  return { rows, matchedRows: matched?.value ?? 0 };
}

/**
 * Coerces one submitted value to the column's type. Returns `undefined` when
 * the value cannot be represented, so the caller can reject the whole write
 * rather than silently storing a `NaN` or the string `"false"`.
 */
function coerce(field: EditableField, value: unknown): unknown | undefined {
  if (value === null) return null;
  switch (field.type) {
    case "number": {
      const parsed = typeof value === "number" ? value : Number(String(value).trim());
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (value === "true" || value === 1 || value === "1") return true;
      if (value === "false" || value === 0 || value === "0") return false;
      return undefined;
    }
    default:
      return typeof value === "string" ? value : String(value);
  }
}

export class InvalidUpdateError extends Error {}

/**
 * Applies a patch to one row, keeping only the columns the registry marks
 * editable. Anything else in the body — including a primary key — is dropped
 * rather than written, so a crafted request cannot repoint a row at another
 * user or reach a column the registry never exposed.
 */
export async function updateTableRow(
  db: AdminDB,
  key: AdminTableKey,
  id: string,
  body: Record<string, unknown>,
) {
  const config: AdminTable = ADMIN_TABLES[key];
  if (config.editable.length === 0) {
    throw new InvalidUpdateError(`${config.label} rows are read-only`);
  }

  const updates: Record<string, unknown> = {};
  for (const field of config.editable) {
    if (!(field.name in body)) continue;
    const value = coerce(field, body[field.name]);
    if (value === undefined) {
      throw new InvalidUpdateError(`Invalid value for ${field.label}`);
    }
    updates[field.name] = value;
  }

  if (Object.keys(updates).length === 0) {
    throw new InvalidUpdateError("No editable fields in request");
  }

  const rows = await db
    .update(config.table)
    .set(updates)
    .where(eq(config.primaryKey, castId(config, id)))
    .returning();

  return rows[0] ?? null;
}

export async function deleteTableRow(db: AdminDB, key: AdminTableKey, id: string) {
  const config: AdminTable = ADMIN_TABLES[key];
  const rows = await db
    .delete(config.table)
    .where(eq(config.primaryKey, castId(config, id)))
    .returning();
  return rows[0] ?? null;
}

/**
 * Route params arrive as strings; integer primary keys have to be numbers or
 * the comparison silently matches nothing on SQLite.
 */
function castId(config: AdminTable, id: string): string | number {
  return config.primaryKey.columnType === "SQLiteInteger" ? Number(id) : id;
}

export interface MaintenanceAction {
  label: string;
  description: string;
  run: (db: AdminDB) => Promise<{ affected: number; detail?: string }>;
}

const affectedRows = (result: unknown): number => {
  const meta = result as { rowsAffected?: number; meta?: { changes?: number } } | undefined;
  return meta?.rowsAffected ?? meta?.meta?.changes ?? 0;
};

/**
 * One-click cleanups. Each is idempotent and scoped to rows that are already
 * dead — expired, or pointing at a parent that no longer exists — so running
 * one twice is a no-op rather than a second round of deletions.
 */
export const MAINTENANCE_ACTIONS = {
  purgeExpiredSessions: {
    label: "Purge expired sessions",
    description: "Deletes session rows whose expiry has already passed.",
    async run(db) {
      const result = await db.delete(session).where(lt(session.expiresAt, new Date()));
      return { affected: affectedRows(result) };
    },
  },
  purgeExpiredVerifications: {
    label: "Purge expired verifications",
    description: "Deletes email-verification and password-reset tokens that can no longer be used.",
    async run(db) {
      const result = await db.delete(verification).where(lt(verification.expiresAt, new Date()));
      return { affected: affectedRows(result) };
    },
  },
  purgeExpiredArticleCache: {
    label: "Purge expired article cache",
    description: "Drops cached article bodies past their expiry. They are re-extracted on demand.",
    async run(db) {
      const result = await db
        .delete(articleCache)
        .where(and(sql`${articleCache.expiresAt} is not null`, lt(articleCache.expiresAt, new Date())));
      return { affected: affectedRows(result) };
    },
  },
  purgeOrphanMessages: {
    label: "Purge orphaned messages",
    description: "Deletes chat turns whose parent chat no longer exists.",
    async run(db) {
      const result = await db
        .delete(messages)
        .where(sql`${messages.chatId} not in (select ${chats.id} from ${chats})`);
      return { affected: affectedRows(result) };
    },
  },
  recomputeStorageUsed: {
    label: "Recompute storage used",
    description:
      "Rewrites every account's storage_used_bytes from the size of its upload rows, fixing drift from failed deletes.",
    async run(db) {
      const result = await db.update(user).set({
        storageUsedBytes: sql`(select coalesce(sum(${uploads.size}), 0) from ${uploads} where ${uploads.userId} = ${user.id})`,
        updatedAt: new Date(),
      });
      return { affected: affectedRows(result), detail: "All accounts recalculated" };
    },
  },
} satisfies Record<string, MaintenanceAction>;

export type MaintenanceActionKey = keyof typeof MAINTENANCE_ACTIONS;

export const MAINTENANCE_ACTION_KEYS = Object.keys(
  MAINTENANCE_ACTIONS,
) as MaintenanceActionKey[];

export function isMaintenanceActionKey(value: string): value is MaintenanceActionKey {
  return Object.prototype.hasOwnProperty.call(MAINTENANCE_ACTIONS, value);
}

export function describeMaintenanceActions() {
  return MAINTENANCE_ACTION_KEYS.map((key) => ({
    key,
    label: MAINTENANCE_ACTIONS[key].label,
    description: MAINTENANCE_ACTIONS[key].description,
  }));
}
