/**
 * @fileoverview Route tests for the account endpoints: the profile
 * (read / update / delete), the password change, and the storage quota
 * readout. All three are session-gated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn(), getUserId: vi.fn() }))
vi.mock('@/lib/database', () => ({ getDB: vi.fn() }))
vi.mock('@/lib/auth', () => ({ initAuth: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/storage/quota', () => ({ getUserStorageStats: vi.fn() }))

import { getSession, getUserId } from '@/lib/auth/session'
import { getDB } from '@/lib/database'
import { initAuth } from '@/lib/auth'
import { getUserStorageStats } from '@/lib/storage/quota'
import { createFakeDb, jsonRequest, type FakeDb } from '../../__tests__/helpers/fake-db'
import { GET, PATCH, DELETE } from '../route'
import { POST as CHANGE_PASSWORD } from '../password/route'
import { GET as GET_STORAGE } from '../storage/route'

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>
const mockGetUserId = getUserId as unknown as ReturnType<typeof vi.fn>
const mockGetDB = getDB as unknown as ReturnType<typeof vi.fn>
const mockInitAuth = initAuth as unknown as ReturnType<typeof vi.fn>
const mockStorageStats = getUserStorageStats as unknown as ReturnType<typeof vi.fn>

const deleteUser = vi.fn()
const changePassword = vi.fn()

const storedUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  image: null,
  apiKey: 'qwk_existing',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

function setup(options: Parameters<typeof createFakeDb>[0] = {}): FakeDb {
  const db = createFakeDb(options)
  mockGetDB.mockReturnValue(db)
  mockGetSession.mockResolvedValue({ user: { id: 'user-1' } })
  mockGetUserId.mockResolvedValue('user-1')
  return db
}

const patch = (body: unknown) => PATCH(jsonRequest('http://localhost/api/user', 'PATCH', body))
const changePasswordRequest = (body: unknown) =>
  CHANGE_PASSWORD(jsonRequest('http://localhost/api/user/password', 'POST', body))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockInitAuth.mockResolvedValue({ api: { deleteUser, changePassword } })
  deleteUser.mockResolvedValue({ success: true })
  changePassword.mockResolvedValue({})
})

describe('GET /api/user', () => {
  it('401s without a session', async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect((await res.json()).message).toBe('Unauthorized')
  })

  it('returns the stored profile', async () => {
    setup({ select: [storedUser()] })

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'user-1', name: 'Ada', email: 'ada@example.com' })
  })

  it('404s when the session user has no row', async () => {
    setup({ select: [] })

    const res = await GET()

    expect(res.status).toBe(404)
    expect((await res.json()).message).toBe('User not found')
  })

  it('mints and persists an API key when the profile has none', async () => {
    const db = setup({ select: [storedUser({ apiKey: null })] })

    const res = await GET()

    const body = await res.json()
    expect(body.apiKey).toMatch(/^qwk_[0-9a-f]{32}$/)
    // The freshly minted key is written back, not just returned.
    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update.apiKey).toBe(body.apiKey)
  })

  it('leaves an existing API key alone', async () => {
    const db = setup({ select: [storedUser({ apiKey: 'qwk_existing' })] })

    const res = await GET()

    expect((await res.json()).apiKey).toBe('qwk_existing')
    expect(db.calls.update).toBeUndefined()
  })
})

describe('PATCH /api/user', () => {
  it('401s without a session', async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await patch({ name: 'Ada' })

    expect(res.status).toBe(401)
  })

  it('updates the name', async () => {
    const db = setup()

    const res = await patch({ name: 'Grace' })

    expect(res.status).toBe(200)
    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update.name).toBe('Grace')
    expect(update.updatedAt).toBeInstanceOf(Date)
  })

  it('rejects a name longer than 32 characters', async () => {
    const db = setup()

    const res = await patch({ name: 'x'.repeat(33) })

    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/32 characters/)
    expect(db.calls.update).toBeUndefined()
  })

  it('accepts a name of exactly 32 characters', async () => {
    const db = setup()

    const res = await patch({ name: 'x'.repeat(32) })

    expect(res.status).toBe(200)
    expect(db.calls.update).toHaveLength(1)
  })

  it('rejects a non-string name', async () => {
    const db = setup()

    const res = await patch({ name: 42 })

    expect(res.status).toBe(400)
    expect(db.calls.update).toBeUndefined()
  })

  it('rejects a malformed email', async () => {
    const db = setup()

    const res = await patch({ email: 'not-an-email' })

    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/valid email/)
    expect(db.calls.update).toBeUndefined()
  })

  it('updates a well-formed email', async () => {
    const db = setup()

    const res = await patch({ email: 'grace@example.com' })

    expect(res.status).toBe(200)
    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update.email).toBe('grace@example.com')
  })

  it('updates the avatar image', async () => {
    const db = setup()

    await patch({ image: 'https://cdn.example.com/a.png' })

    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update.image).toBe('https://cdn.example.com/a.png')
  })

  it('clears the avatar when image is explicitly null', async () => {
    const db = setup()

    await patch({ image: null })

    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update).toHaveProperty('image', null)
  })

  it('regenerates the API key on request', async () => {
    const db = setup()

    const res = await patch({ regenerateApiKey: true })

    expect(res.status).toBe(200)
    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update.apiKey).toMatch(/^qwk_[0-9a-f]{32}$/)
  })

  it('leaves the API key alone when regeneration is not requested', async () => {
    const db = setup()

    await patch({ name: 'Grace' })

    const [update] = db.calls.set[0] as [Record<string, unknown>]
    expect(update).not.toHaveProperty('apiKey')
  })

  it('touches only updatedAt for an empty body', async () => {
    const db = setup()

    const res = await patch({})

    expect(res.status).toBe(200)
    expect(Object.keys(db.calls.set[0][0] as object)).toEqual(['updatedAt'])
  })
})

describe('DELETE /api/user', () => {
  it('401s without a session', async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await DELETE()

    expect(res.status).toBe(401)
  })

  it('deletes the account through better-auth', async () => {
    setup()

    const res = await DELETE()

    expect(res.status).toBe(200)
    expect(deleteUser).toHaveBeenCalledTimes(1)
    expect((await res.json()).message).toMatch(/deleted successfully/i)
  })

  it('400s with the auth message when better-auth reports failure', async () => {
    setup()
    deleteUser.mockResolvedValue({ success: false, message: 'Re-authenticate first.' })

    const res = await DELETE()

    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Re-authenticate first.')
  })

  it('surfaces a client-side auth error message on a 403', async () => {
    setup()
    deleteUser.mockRejectedValue(Object.assign(new Error('Not allowed'), { status: 403 }))

    const res = await DELETE()

    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe('Not allowed')
  })

  it('hides the detail of an unexpected server error', async () => {
    setup()
    deleteUser.mockRejectedValue(new Error('postgres exploded at 10.0.0.4'))

    const res = await DELETE()

    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe('Failed to delete account.')
  })
})

describe('POST /api/user/password', () => {
  it('401s without a session', async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await changePasswordRequest({ currentPassword: 'a', newPassword: 'longenough' })

    expect(res.status).toBe(401)
  })

  it('rejects a new password shorter than 8 characters', async () => {
    setup()

    const res = await changePasswordRequest({ currentPassword: 'old', newPassword: 'short' })

    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/at least 8 characters/)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('rejects a missing new password', async () => {
    setup()

    const res = await changePasswordRequest({ currentPassword: 'old' })

    expect(res.status).toBe(400)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('accepts a new password of exactly 8 characters', async () => {
    setup()

    const res = await changePasswordRequest({ currentPassword: 'old', newPassword: '12345678' })

    expect(res.status).toBe(200)
  })

  it('changes the password without revoking the other sessions', async () => {
    setup()

    const res = await changePasswordRequest({ currentPassword: 'old', newPassword: 'new-password' })

    expect(res.status).toBe(200)
    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { currentPassword: 'old', newPassword: 'new-password', revokeOtherSessions: false },
      }),
    )
  })

  it('400s with the auth error when the current password is wrong', async () => {
    setup()
    changePassword.mockRejectedValue(new Error('Invalid password'))

    const res = await changePasswordRequest({ currentPassword: 'wrong', newPassword: 'new-password' })

    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Invalid password')
  })

  it('falls back to a generic message when the auth error has none', async () => {
    setup()
    changePassword.mockRejectedValue({})

    const res = await changePasswordRequest({ currentPassword: 'old', newPassword: 'new-password' })

    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('Failed to change password.')
  })
})

describe('GET /api/user/storage', () => {
  it('401s without a session', async () => {
    mockGetUserId.mockResolvedValue(null)

    const res = await GET_STORAGE()

    expect(res.status).toBe(401)
  })

  it('returns the raw byte figures alongside rounded megabytes', async () => {
    setup()
    mockStorageStats.mockResolvedValue({
      used: 5 * 1024 * 1024,
      quota: 20 * 1024 * 1024,
      remaining: 15 * 1024 * 1024,
      allowed: true,
    })

    const res = await GET_STORAGE()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      used: 5242880,
      quota: 20971520,
      remaining: 15728640,
      allowed: true,
      usedMB: 5,
      quotaMB: 20,
      remainingMB: 15,
      percentage: 25,
    })
  })

  it('reports 100 percent for a full quota', async () => {
    setup()
    mockStorageStats.mockResolvedValue({
      used: 1024,
      quota: 1024,
      remaining: 0,
      allowed: false,
    })

    const { percentage, allowed } = await (await GET_STORAGE()).json()

    expect(percentage).toBe(100)
    expect(allowed).toBe(false)
  })

  it('500s when the quota lookup fails', async () => {
    setup()
    mockStorageStats.mockRejectedValue(new Error('db down'))

    const res = await GET_STORAGE()

    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe('Failed to fetch storage stats')
  })
})
