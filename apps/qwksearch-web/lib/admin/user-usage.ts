import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AdminDB } from "./db";
import {
  chats,
  documents,
  favorites,
  googleDocsSync,
  messages,
  session,
  uploads,
  user,
  userAgentSkills,
} from "@/lib/database/schema";


/**
 * Every account-linked table that represents a user *doing* something, keyed
 * by the name the admin users table's column uses. Each becomes a correlated
 * `count(*)` subquery rather than a join: joining seven one-to-many tables at
 * once would fan out and multiply every counter by the row counts of the
 * others. A subquery can also be referenced from ORDER BY, so the table can
 * be sorted by any usage column across the whole result set instead of only
 * within the page that happened to be fetched.
 */
const USAGE_SOURCES = {
  docs: { table: documents, userId: documents.userId },
  chats: { table: chats, userId: chats.userId },
  messages: { table: messages, userId: messages.userId },
  favorites: { table: favorites, userId: favorites.userId },
  uploads: { table: uploads, userId: uploads.userId },
  googleDocs: { table: googleDocsSync, userId: googleDocsSync.userId },
  skills: { table: userAgentSkills, userId: userAgentSkills.userId },
} as const;

export type UsageKey = keyof typeof USAGE_SOURCES;

export const USAGE_KEYS = Object.keys(USAGE_SOURCES) as UsageKey[];

/**
 * Renders a column as `"table"."column"`. Interpolating a column directly
 * emits it unqualified, which silently binds to the wrong table inside a
 * correlated subquery: `${user.id}` becomes a bare `"id"`, and several of the
 * tables counted below have an `id` column of their own, so the subquery
 * would compare `documents.userId = documents.id` and count zero rows for
 * everyone.
 */
const qualified = (table: SQLiteTable, column: AnySQLiteColumn) =>
  sql`${table}.${sql.identifier(column.name)}`;

const countForUser = ({ table, userId }: { table: SQLiteTable; userId: AnySQLiteColumn }) =>
  sql<number>`(select count(*) from ${table} where ${qualified(table, userId)} = ${qualified(
    user,
    user.id,
  )})`.mapWith(Number);

const usageExpressions = Object.fromEntries(
  USAGE_KEYS.map((key) => [key, countForUser(USAGE_SOURCES[key])]),
) as Record<UsageKey, SQL<number>>;

/** Sessions are logins rather than saved work, so they sit outside `total`. */
const sessionsExpression = countForUser({ table: session, userId: session.userId });

/** One number for "how much has this account actually been used". */
const totalExpression = sql<number>`(${sql.join(
  USAGE_KEYS.map((key) => usageExpressions[key]),
  sql` + `,
)})`.mapWith(Number);

/**
 * Newest session touch — the last sign-in or session refresh. Timestamps are
 * stored as unix seconds (drizzle `mode: "timestamp"`), and raw SQL bypasses
 * drizzle's Date mapping, so callers convert the seconds themselves.
 */
const lastActiveExpression = sql<number | null>`(select max(${qualified(
  session,
  session.updatedAt,
)}) from ${session} where ${qualified(session, session.userId)} = ${qualified(user, user.id)})`;

const SORT_EXPRESSIONS: Record<string, SQL | AnySQLiteColumn> = {
  name: user.name,
  email: user.email,
  joined: user.createdAt,
  storage: user.storageUsedBytes,
  lastActive: lastActiveExpression,
  sessions: sessionsExpression,
  total: totalExpression,
  ...usageExpressions,
};

export const DEFAULT_SORT = "joined";

export interface UserUsageQuery {
  page: number;
  limit: number;
  search?: string;
  hideAnonymous?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
}

/** Narrows the directory to what the admin typed and toggled. */
function buildFilter({ search, hideAnonymous }: Pick<UserUsageQuery, "search" | "hideAnonymous">) {
  const conditions = [];
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(like(user.name, pattern), like(user.email, pattern), like(user.id, pattern)),
    );
  }
  if (hideAnonymous) conditions.push(or(eq(user.isAnonymous, false), sql`${user.isAnonymous} is null`));
  return conditions.length ? and(...conditions) : undefined;
}

/**
 * One page of accounts with a usage counter per feature, plus how many
 * accounts the filter matched in total (for the pager).
 */
export async function loadUserUsagePage(db: AdminDB, options: UserUsageQuery) {
  const where = buildFilter(options);
  const sortExpression = SORT_EXPRESSIONS[options.sort ?? ""] ?? SORT_EXPRESSIONS[DEFAULT_SORT];
  const direction = options.dir === "asc" ? asc : desc;

  const [rows, [matched]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        apiKey: user.apiKey,
        trialAllowed: user.trialAllowed,
        storageUsedBytes: user.storageUsedBytes,
        storageQuotaBytes: user.storageQuotaBytes,
        createdAt: user.createdAt,
        lastActiveSeconds: lastActiveExpression,
        sessions: sessionsExpression,
        total: totalExpression,
        ...usageExpressions,
      })
      .from(user)
      .where(where)
      // `user.id` breaks ties so pagination stays stable when many rows share
      // a sort value — every usage counter is 0 for a brand-new account.
      .orderBy(direction(sortExpression), desc(user.id))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit),
    db.select({ value: count() }).from(user).where(where),
  ]);

  return {
    users: rows.map(({ lastActiveSeconds, ...row }: (typeof rows)[number]) => ({
      ...row,
      lastActiveAt: lastActiveSeconds ? new Date(lastActiveSeconds * 1000).toISOString() : null,
    })),
    matchedUsers: matched?.value ?? 0,
  };
}

/**
 * Site-wide row counts for the summary strip above the table. These
 * deliberately ignore the search and filter, so the headline numbers stay a
 * stable reference while an admin narrows the table underneath them.
 */
export async function loadSiteUsageTotals(db: AdminDB) {
  const sources: Array<[string, SQLiteTable]> = [
    ["users", user],
    ["sessions", session],
    ...USAGE_KEYS.map((key) => [key, USAGE_SOURCES[key].table] as [string, SQLiteTable]),
  ];

  const counts = await Promise.all(
    sources.map(async ([, table]) => {
      const [row] = await db.select({ value: count() }).from(table);
      return row?.value ?? 0;
    }),
  );

  const totals = Object.fromEntries(sources.map(([key], index) => [key, counts[index]])) as Record<
    "users" | "sessions" | UsageKey,
    number
  >;

  return { ...totals, activity: USAGE_KEYS.reduce((sum, key) => sum + totals[key], 0) };
}
