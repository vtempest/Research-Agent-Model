/**
 * @fileoverview Integration test for the database controls, run against a real
 * in-memory SQLite database. The write path (column allowlist, value coercion,
 * integer primary keys) and the maintenance SQL only prove out when executed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { count, eq } from 'drizzle-orm'
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '@/lib/database/schema'
import type { AdminDB } from '../db'
import {
  ADMIN_TABLES,
  ADMIN_TABLE_KEYS,
  InvalidUpdateError,
  MAINTENANCE_ACTIONS,
  deleteTableRow,
  describeTable,
  isAdminTableKey,
  loadTableCounts,
  loadTableRows,
  updateTableRow,
} from '../db-tables'

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

let db: AdminDB

const NOW = new Date('2024-06-01T00:00:00.000Z')
const PAST = new Date('2023-01-01T00:00:00.000Z')
const FUTURE = new Date('2030-01-01T00:00:00.000Z')

async function seed() {
  const client = createClient({ url: ':memory:' })
  // Every registered table has to exist — `loadTableCounts` reads all of them.
  for (const key of ADMIN_TABLE_KEYS) {
    await client.execute(createTableSql(ADMIN_TABLES[key].table))
  }
  db = drizzle(client, { schema }) as unknown as AdminDB

  await db.insert(schema.user).values([
    {
      id: 'u1',
      name: 'First',
      email: 'first@example.com',
      emailVerified: true,
      trialAllowed: 6,
      storageUsedBytes: 999,
      storageQuotaBytes: 1073741824,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'u2',
      name: 'Second',
      email: 'second@example.com',
      emailVerified: false,
      trialAllowed: 6,
      storageUsedBytes: 0,
      storageQuotaBytes: 1073741824,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ])

  await db.insert(schema.session).values([
    { id: 'live', token: 'a', userId: 'u1', expiresAt: FUTURE, createdAt: NOW, updatedAt: NOW },
    { id: 'dead', token: 'b', userId: 'u1', expiresAt: PAST, createdAt: PAST, updatedAt: PAST },
  ])
  await db.insert(schema.verification).values([
    { id: 'v-live', identifier: 'a@example.com', value: 'x', expiresAt: FUTURE },
    { id: 'v-dead', identifier: 'b@example.com', value: 'y', expiresAt: PAST },
  ])
  await db
    .insert(schema.chats)
    .values([{ id: 'c1', title: 'Kept', createdAt: 'now', focusMode: 'web', userId: 'u1' }])
  await db.insert(schema.messages).values([
    { id: 1, role: 'user', chatId: 'c1', messageId: 'm1', createdAt: 'now' },
    { id: 2, role: 'user', chatId: 'gone', messageId: 'm2', createdAt: 'now' },
  ])
  await db.insert(schema.uploads).values([
    { fileId: 'f1', userId: 'u1', fileName: 'a.pdf', fileExtension: 'pdf', size: 100 },
    { fileId: 'f2', userId: 'u1', fileName: 'b.pdf', fileExtension: 'pdf', size: 23 },
  ])
  await db.insert(schema.articleCache).values([
    { id: 1, url: 'https://kept.example', expiresAt: FUTURE },
    { id: 2, url: 'https://stale.example', expiresAt: PAST },
    { id: 3, url: 'https://forever.example', expiresAt: null },
  ])
}

beforeEach(seed)

const rowCount = async (table: SQLiteTable) => {
  const [row] = await db.select({ value: count() }).from(table)
  return row?.value ?? 0
}

describe('the table registry', () => {
  it('only recognises its own keys', () => {
    expect(isAdminTableKey('user')).toBe(true)
    expect(isAdminTableKey('sqlite_master')).toBe(false)
    expect(isAdminTableKey('__proto__')).toBe(false)
  })

  it('describes a table without leaking drizzle objects', () => {
    const described = describeTable('user')

    expect(described).toMatchObject({ key: 'user', primaryKey: 'id', destructive: true })
    expect(described.editable.map((f) => f.name)).toContain('trialAllowed')
    expect(JSON.stringify(described)).toBeTypeOf('string')
  })

  it('marks every editable field as a column the table actually lists', () => {
    for (const key of ADMIN_TABLE_KEYS) {
      const { columns, editable } = describeTable(key)
      for (const field of editable) expect(columns).toContain(field.name)
    }
  })

  it('counts every registered table', async () => {
    const counts = await loadTableCounts(db)

    expect(counts).toHaveLength(ADMIN_TABLE_KEYS.length)
    expect(counts.find((t) => t.key === 'user')?.rows).toBe(2)
    expect(counts.find((t) => t.key === 'uploads')?.rows).toBe(2)
  })
})

describe('loadTableRows', () => {
  it('returns only the columns the registry lists', async () => {
    const { rows } = await loadTableRows(db, 'user', { page: 1, limit: 25 })

    expect(Object.keys(rows[0])).toEqual(describeTable('user').columns)
    expect(Object.keys(rows[0])).not.toContain('apiKey')
  })

  it('searches the registered columns', async () => {
    const { rows, matchedRows } = await loadTableRows(db, 'user', {
      page: 1,
      limit: 25,
      search: 'second@',
    })

    expect(matchedRows).toBe(1)
    expect(rows[0]).toMatchObject({ id: 'u2' })
  })

  it('pages', async () => {
    const first = await loadTableRows(db, 'user', { page: 1, limit: 1 })
    const second = await loadTableRows(db, 'user', { page: 2, limit: 1 })

    expect(first.matchedRows).toBe(2)
    expect(first.rows[0].id).not.toBe(second.rows[0].id)
  })
})

describe('updateTableRow', () => {
  it('writes an allowlisted column', async () => {
    const row = await updateTableRow(db, 'user', 'u1', { name: 'Renamed' })

    expect(row).toMatchObject({ id: 'u1', name: 'Renamed' })
  })

  it('ignores a column the registry does not mark editable', async () => {
    await updateTableRow(db, 'user', 'u1', { name: 'Renamed', storageUsedBytes: 0 })

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, 'u1'))
    expect(row.storageUsedBytes).toBe(999)
  })

  it('coerces a numeric column submitted as a string', async () => {
    await updateTableRow(db, 'user', 'u1', { trialAllowed: '99' })

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, 'u1'))
    expect(row.trialAllowed).toBe(99)
  })

  it('coerces a boolean column submitted as a string', async () => {
    await updateTableRow(db, 'chats', 'c1', { isPublic: 'true' })

    const [row] = await db.select().from(schema.chats).where(eq(schema.chats.id, 'c1'))
    expect(row.isPublic).toBe(true)
  })

  it('rejects a value that cannot be represented', async () => {
    await expect(updateTableRow(db, 'user', 'u1', { trialAllowed: 'lots' })).rejects.toBeInstanceOf(
      InvalidUpdateError,
    )
  })

  it('rejects a write against a read-only table', async () => {
    await expect(updateTableRow(db, 'session', 'live', { userId: 'u2' })).rejects.toBeInstanceOf(
      InvalidUpdateError,
    )
  })

  it('matches an integer primary key given as a string', async () => {
    await db.insert(schema.favorites).values({ id: 7, userId: 'u1', url: 'https://x.example' })

    const updated = await updateTableRow(db, 'favorites', '7', { title: 'Renamed' })

    expect(updated).toMatchObject({ id: 7, title: 'Renamed' })
  })

  it('returns null when the id matched no row', async () => {
    expect(await updateTableRow(db, 'user', 'nobody', { name: 'x' })).toBeNull()
  })
})

describe('deleteTableRow', () => {
  it('deletes by a text primary key', async () => {
    expect(await deleteTableRow(db, 'user', 'u2')).toMatchObject({ id: 'u2' })
    expect(await rowCount(schema.user)).toBe(1)
  })

  it('deletes by an integer primary key given as a string', async () => {
    expect(await deleteTableRow(db, 'articleCache', '2')).toMatchObject({ id: 2 })
    expect(await rowCount(schema.articleCache)).toBe(2)
  })

  it('returns null when the id matched no row', async () => {
    expect(await deleteTableRow(db, 'user', 'nobody')).toBeNull()
  })
})

describe('maintenance actions', () => {
  it('purges only expired sessions', async () => {
    const { affected } = await MAINTENANCE_ACTIONS.purgeExpiredSessions.run(db)

    expect(affected).toBe(1)
    const [row] = await db.select().from(schema.session)
    expect(row.id).toBe('live')
  })

  it('purges only expired verifications', async () => {
    await MAINTENANCE_ACTIONS.purgeExpiredVerifications.run(db)

    const rows = await db.select().from(schema.verification)
    expect(rows.map((r) => r.id)).toEqual(['v-live'])
  })

  it('purges expired article cache but keeps rows with no expiry', async () => {
    await MAINTENANCE_ACTIONS.purgeExpiredArticleCache.run(db)

    const rows = await db.select().from(schema.articleCache)
    expect(rows.map((r) => r.id).sort()).toEqual([1, 3])
  })

  it('purges messages whose chat is gone', async () => {
    await MAINTENANCE_ACTIONS.purgeOrphanMessages.run(db)

    const rows = await db.select().from(schema.messages)
    expect(rows.map((r) => r.id)).toEqual([1])
  })

  it('recomputes storage used from the upload rows', async () => {
    await MAINTENANCE_ACTIONS.recomputeStorageUsed.run(db)

    const rows = await db.select().from(schema.user)
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId.u1.storageUsedBytes).toBe(123)
    // An account with no uploads is zeroed rather than left alone.
    expect(byId.u2.storageUsedBytes).toBe(0)
  })

  it('is a no-op on a second run', async () => {
    await MAINTENANCE_ACTIONS.purgeExpiredSessions.run(db)
    const second = await MAINTENANCE_ACTIONS.purgeExpiredSessions.run(db)

    expect(second.affected).toBe(0)
  })
})
