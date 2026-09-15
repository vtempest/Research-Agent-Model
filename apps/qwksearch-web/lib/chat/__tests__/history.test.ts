/**
 * @fileoverview Tests for `handleHistorySave`, which persists a human message
 * and its parent chat, and branches the conversation when a prior message is
 * re-sent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/database', () => ({ getDB: vi.fn() }))

import { createFakeDb, type FakeDb } from '../../../app/api/__tests__/helpers/fake-db'
import { handleHistorySave } from '../history'
import type { Message } from '../schemas'

type Db = Parameters<typeof handleHistorySave>[5]

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    chatId: 'chat-1',
    content: 'What is quantum computing?',
    messageId: 'msg-1',
    ...overrides,
  }) as Message

/**
 * A fake db seeded with the relational lookups `handleHistorySave` makes:
 * the parent chat, then the human message.
 */
function fakeDb(seed: { chat?: unknown; message?: unknown } = {}): FakeDb {
  return createFakeDb({
    query: {
      chats: { findFirst: seed.chat },
      messages: { findFirst: seed.message },
    },
  })
}

const save = (db: FakeDb | undefined, userId: string | null, msg = message(), humanId = 'msg-1') =>
  handleHistorySave(msg, humanId, 'webSearch', [], userId, db as unknown as Db)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('handleHistorySave', () => {
  it('writes nothing for a guest (no userId)', async () => {
    const db = fakeDb()

    await save(db, null)

    expect(db.calls).toEqual({})
  })

  it('writes nothing when the database is unavailable', async () => {
    await expect(save(undefined, 'user-1')).resolves.toBeUndefined()
  })

  it('creates the chat and inserts the message when neither exists', async () => {
    const db = fakeDb()

    await save(db, 'user-1')

    expect(db.calls.insert).toHaveLength(2)
    const [chatValues] = db.calls.values[0] as [Record<string, unknown>]
    expect(chatValues).toMatchObject({
      id: 'chat-1',
      title: 'What is quantum computing?',
      focusMode: 'webSearch',
      userId: 'user-1',
      thinkingTimeLimit: 0,
    })
  })

  it('guards the new-chat insert against a concurrent duplicate', async () => {
    const db = fakeDb()

    await save(db, 'user-1')

    expect(db.calls.onConflictDoNothing).toHaveLength(1)
  })

  it('records the caller-supplied thinking time limit on a new chat', async () => {
    const db = fakeDb()

    await handleHistorySave(message(), 'msg-1', 'webSearch', [], 'user-1', db as unknown as Db, 45)

    const [chatValues] = db.calls.values[0] as [Record<string, unknown>]
    expect(chatValues.thinkingTimeLimit).toBe(45)
  })

  it('inserts the human message with the human message id, not the message id', async () => {
    const db = fakeDb()

    await save(db, 'user-1', message({ messageId: 'client-generated' }), 'human-42')

    const [messageValues] = db.calls.values[1] as [Record<string, unknown>]
    expect(messageValues).toMatchObject({
      messageId: 'human-42',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'user',
      content: 'What is quantum computing?',
    })
  })

  it('skips the chat insert when the chat already belongs to this user', async () => {
    const db = fakeDb({ chat: { id: 'chat-1', userId: 'user-1' } })

    await save(db, 'user-1')

    // One insert only — the message; the chat is already there.
    expect(db.calls.insert).toHaveLength(1)
    const [messageValues] = db.calls.values[0] as [Record<string, unknown>]
    expect(messageValues).toMatchObject({ messageId: 'msg-1' })
  })

  it('refuses to touch a chat id owned by another account', async () => {
    const db = fakeDb({ chat: { id: 'chat-1', userId: 'someone-else' } })

    await save(db, 'user-1')

    expect(db.calls.insert).toBeUndefined()
    expect(db.calls.delete).toBeUndefined()
  })

  it('branches the conversation when the human message is re-sent', async () => {
    const db = fakeDb({
      chat: { id: 'chat-1', userId: 'user-1' },
      message: { id: 7, messageId: 'msg-1' },
    })

    await save(db, 'user-1')

    // Re-send deletes the later messages instead of inserting a duplicate.
    expect(db.calls.insert).toBeUndefined()
    expect(db.calls.delete).toHaveLength(1)
    expect(db.calls.where).toHaveLength(1)
  })

  it('creates a missing chat even when the human message already exists', async () => {
    const db = fakeDb({ message: { id: 7, messageId: 'msg-1' } })

    await save(db, 'user-1')

    expect(db.calls.insert).toHaveLength(1)
    expect(db.calls.delete).toHaveLength(1)
  })

  it('stores createdAt as an ISO string', async () => {
    const db = fakeDb()

    await save(db, 'user-1')

    const [chatValues] = db.calls.values[0] as [Record<string, unknown>]
    const [messageValues] = db.calls.values[1] as [Record<string, unknown>]
    expect(() => new Date(chatValues.createdAt as string).toISOString()).not.toThrow()
    expect(typeof chatValues.createdAt).toBe('string')
    expect(typeof messageValues.createdAt).toBe('string')
  })
})
