/**
 * @fileoverview Integration test for the admin usage counters, run against a
 * real in-memory SQLite database rather than a query-builder double.
 *
 * The counters are correlated subqueries over eight tables that all have an
 * `id` column of their own, so an unqualified column reference binds to the
 * wrong table and silently counts zero for every account. Only executing the
 * SQL catches that, which is what this file does.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '@/lib/database/schema'
import type { AdminDB } from '../db'
import { USAGE_KEYS, loadSiteUsageTotals, loadUserUsagePage } from '../user-usage'

/**
 * Builds `create table` from the drizzle definition itself, so the fixture
 * database can never drift from the schema the queries are written against —
 * a renamed column fails here instead of quietly counting nothing.
 */
function createTableSql(table: SQLiteTable): string {
  const config = getTableConfig(table)
  const columns = config.columns.map((column) => {
    const parts = [`"${column.name}"`, column.getSQLType()]
    if (column.primary) parts.push('primary key')
    else if (column.notNull) parts.push('not null')
    return parts.join(' ')
  })
  return `create table "${config.name}" (${columns.join(', ')})`
}

/** Every table the usage counters read. */
const FIXTURE_TABLES: SQLiteTable[] = [
  schema.user,
  schema.session,
  schema.documents,
  schema.chats,
  schema.messages,
  schema.favorites,
  schema.uploads,
  schema.googleDocsSync,
  schema.userAgentSkills,
]

let db: AdminDB

/** Unix seconds — the storage format drizzle's `mode: "timestamp"` uses. */
const JAN_2024 = 1_704_067_200

async function seed() {
  const client = createClient({ url: ':memory:' })
  for (const table of FIXTURE_TABLES) await client.execute(createTableSql(table))
  db = drizzle(client, { schema }) as unknown as AdminDB

  await db.insert(schema.user).values([
    {
      id: 'busy',
      name: 'Busy Person',
      email: 'busy@example.com',
      emailVerified: true,
      trialAllowed: 6,
      createdAt: new Date(JAN_2024 * 1000),
      updatedAt: new Date(JAN_2024 * 1000),
      isAnonymous: false,
    },
    {
      id: 'quiet',
      name: 'Quiet Person',
      email: 'quiet@example.com',
      emailVerified: true,
      trialAllowed: 6,
      createdAt: new Date((JAN_2024 + 86_400) * 1000),
      updatedAt: new Date((JAN_2024 + 86_400) * 1000),
      isAnonymous: false,
    },
    {
      id: 'ghost',
      name: 'Anonymous',
      email: 'ghost@example.com',
      emailVerified: false,
      trialAllowed: 6,
      createdAt: new Date((JAN_2024 + 172_800) * 1000),
      updatedAt: new Date((JAN_2024 + 172_800) * 1000),
      isAnonymous: true,
    },
  ])

  await db.insert(schema.session).values([
    {
      id: 's1',
      token: 't1',
      userId: 'busy',
      expiresAt: new Date((JAN_2024 + 999_999) * 1000),
      createdAt: new Date(JAN_2024 * 1000),
      updatedAt: new Date((JAN_2024 + 3600) * 1000),
    },
    {
      id: 's2',
      token: 't2',
      userId: 'busy',
      expiresAt: new Date((JAN_2024 + 999_999) * 1000),
      createdAt: new Date(JAN_2024 * 1000),
      updatedAt: new Date((JAN_2024 + 7200) * 1000),
    },
  ])

  await db.insert(schema.documents).values([
    { name: 'Doc A', userId: 'busy', createdAt: 'now', updatedAt: 'now' },
    { name: 'Doc B', userId: 'busy', createdAt: 'now', updatedAt: 'now' },
    { name: 'Doc C', userId: 'quiet', createdAt: 'now', updatedAt: 'now' },
  ])
  await db
    .insert(schema.chats)
    .values([{ id: 'c1', title: 'Chat', createdAt: 'now', focusMode: 'web', userId: 'busy' }])
  await db.insert(schema.messages).values([
    { id: 1, role: 'user', chatId: 'c1', userId: 'busy', messageId: 'm1', createdAt: 'now' },
    { id: 2, role: 'assistant', chatId: 'c1', userId: 'busy', messageId: 'm2', createdAt: 'now' },
    { id: 3, role: 'user', chatId: 'c1', userId: 'busy', messageId: 'm3', createdAt: 'now' },
  ])
  await db
    .insert(schema.favorites)
    .values([{ id: 1, userId: 'quiet', url: 'https://example.com', title: 'Saved' }])
  await db.insert(schema.uploads).values([
    { fileId: 'f1', userId: 'busy', fileName: 'a.pdf', fileExtension: 'pdf', size: 10 },
  ])
}

beforeEach(seed)

describe('loadUserUsagePage', () => {
  it('counts each feature against the right account', async () => {
    const { users, matchedUsers } = await loadUserUsagePage(db, { page: 1, limit: 25 })
    const byId = Object.fromEntries(users.map((u) => [u.id, u]))

    expect(matchedUsers).toBe(3)
    expect(byId.busy).toMatchObject({ docs: 2, chats: 1, messages: 3, uploads: 1, favorites: 0 })
    expect(byId.quiet).toMatchObject({ docs: 1, favorites: 1, chats: 0, messages: 0 })
    expect(byId.ghost).toMatchObject({ docs: 0, chats: 0, messages: 0, favorites: 0, uploads: 0 })
  })

  it('totals every usage counter but not the session count', async () => {
    const { users } = await loadUserUsagePage(db, { page: 1, limit: 25 })
    const busy = users.find((u) => u.id === 'busy')!

    expect(busy.sessions).toBe(2)
    // 2 docs + 1 chat + 3 messages + 1 upload, and no session rows.
    expect(busy.total).toBe(7)
  })

  it('reports the newest session touch, and null for an account that never signed in', async () => {
    const { users } = await loadUserUsagePage(db, { page: 1, limit: 25 })
    const byId = Object.fromEntries(users.map((u) => [u.id, u]))

    expect(byId.busy.lastActiveAt).toBe(new Date((JAN_2024 + 7200) * 1000).toISOString())
    expect(byId.quiet.lastActiveAt).toBeNull()
  })

  it('sorts by a usage counter across the whole directory', async () => {
    const desc = await loadUserUsagePage(db, { page: 1, limit: 25, sort: 'messages', dir: 'desc' })
    expect(desc.users[0].id).toBe('busy')

    const asc = await loadUserUsagePage(db, { page: 1, limit: 25, sort: 'total', dir: 'asc' })
    expect(asc.users[0].total).toBe(0)
  })

  it('falls back to the default sort for an unknown column', async () => {
    const { users } = await loadUserUsagePage(db, { page: 1, limit: 25, sort: 'nonsense' })

    // Newest account first, which is what sorting by `joined` descending gives.
    expect(users[0].id).toBe('ghost')
  })

  it('searches name, email and id', async () => {
    const byName = await loadUserUsagePage(db, { page: 1, limit: 25, search: 'Busy' })
    expect(byName.users.map((u) => u.id)).toEqual(['busy'])

    const byEmail = await loadUserUsagePage(db, { page: 1, limit: 25, search: 'quiet@' })
    expect(byEmail.users.map((u) => u.id)).toEqual(['quiet'])

    const byId = await loadUserUsagePage(db, { page: 1, limit: 25, search: 'ghost' })
    expect(byId.matchedUsers).toBe(1)
  })

  it('treats a LIKE wildcard in the search as a literal character', async () => {
    const { matchedUsers } = await loadUserUsagePage(db, { page: 1, limit: 25, search: '%' })

    expect(matchedUsers).toBe(0)
  })

  it('drops anonymous accounts when asked, keeping accounts with no flag set', async () => {
    const { users } = await loadUserUsagePage(db, { page: 1, limit: 25, hideAnonymous: true })

    expect(users.map((u) => u.id).sort()).toEqual(['busy', 'quiet'])
  })

  it('pages without repeating or skipping an account', async () => {
    const first = await loadUserUsagePage(db, { page: 1, limit: 2 })
    const second = await loadUserUsagePage(db, { page: 2, limit: 2 })

    expect(first.users).toHaveLength(2)
    expect(second.users).toHaveLength(1)
    expect(new Set([...first.users, ...second.users].map((u) => u.id)).size).toBe(3)
  })

  it('replaces the raw last-active seconds with the ISO field', async () => {
    const { users } = await loadUserUsagePage(db, { page: 1, limit: 25 })

    expect(Object.keys(users[0])).not.toContain('lastActiveSeconds')
    expect(Object.keys(users[0])).toContain('lastActiveAt')
  })
})

describe('loadSiteUsageTotals', () => {
  it('counts every table site-wide and sums the activity', async () => {
    const totals = await loadSiteUsageTotals(db)

    expect(totals).toMatchObject({
      users: 3,
      sessions: 2,
      docs: 3,
      chats: 1,
      messages: 3,
      favorites: 1,
      uploads: 1,
      googleDocs: 0,
      skills: 0,
    })
    expect(totals.activity).toBe(USAGE_KEYS.reduce((sum, key) => sum + totals[key], 0))
    expect(totals.activity).toBe(9)
  })
})
