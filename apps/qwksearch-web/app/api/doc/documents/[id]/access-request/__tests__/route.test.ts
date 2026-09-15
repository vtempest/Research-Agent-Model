/**
 * @fileoverview Route tests for requesting access to a document owned by
 * someone else — in particular, that a second request for the same
 * document+requester never sends a second email (the "no spam" contract).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/database', () => ({ getDB: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requireUserId: vi.fn() }))
vi.mock('@/lib/cloudflare/context', () => ({ getCloudflareContext: vi.fn() }))

import { getDB } from '@/lib/database'
import { requireUserId } from '@/lib/auth/session'
import { getCloudflareContext } from '@/lib/cloudflare/context'
import { createFakeDb, routeContext, type FakeDb } from '../../../../../__tests__/helpers/fake-db'
import { POST } from '../route'

const mockGetDB = getDB as unknown as ReturnType<typeof vi.fn>
const mockRequireUserId = requireUserId as unknown as ReturnType<typeof vi.fn>
const mockGetCloudflareContext = getCloudflareContext as unknown as ReturnType<typeof vi.fn>

const send = vi.fn().mockResolvedValue({ id: 'email-1' })

function setup(options: Parameters<typeof createFakeDb>[0] = {}, requesterId = 'requester-1'): FakeDb {
  const db = createFakeDb(options)
  mockGetDB.mockReturnValue(db)
  mockRequireUserId.mockResolvedValue(requesterId)
  mockGetCloudflareContext.mockReturnValue({ env: { EMAIL: { send } }, cf: undefined, ctx: null })
  return db
}

const post = (id = '1') =>
  POST(new Request(`http://localhost/api/doc/documents/${id}/access-request`, { method: 'POST' }) as any, routeContext({ id }))

beforeEach(() => {
  vi.clearAllMocks()
  send.mockClear()
})

describe('POST /api/doc/documents/[id]/access-request', () => {
  it('401s for an unauthenticated caller', async () => {
    mockGetDB.mockReturnValue(createFakeDb())
    mockRequireUserId.mockRejectedValue(new Error('Unauthorized'))

    expect((await post()).status).toBe(401)
  })

  it('404s for a missing document', async () => {
    setup({ select: (i) => (i === 0 ? [] : []) })

    expect((await post('99')).status).toBe(404)
  })

  it("400s when the document doesn't require access (no owner)", async () => {
    setup({ select: (i) => (i === 0 ? [{ id: 1, userId: null, title: 'Open' }] : []) })

    const res = await post()
    expect(res.status).toBe(400)
  })

  it('400s when the requester already owns the document', async () => {
    setup({ select: (i) => (i === 0 ? [{ id: 1, userId: 'requester-1', title: 'Mine' }] : []) }, 'requester-1')

    expect((await post()).status).toBe(400)
  })

  it('sends one notification email and records the request', async () => {
    const db = setup(
      {
        select: (i) => {
          if (i === 0) return [{ id: 1, userId: 'owner-1', title: 'Doc', name: 'Doc' }]
          if (i === 1) return [] // no existing request yet
          if (i === 2) return [{ id: 'owner-1', email: 'owner@test.com', name: 'Owner' }]
          return [{ id: 'requester-1', email: 'req@test.com', name: 'Requester' }]
        },
        insert: [{ id: 5, documentId: 1, requesterUserId: 'requester-1' }],
      },
      'requester-1',
    )

    const res = await post()

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ success: true, accessRequested: true })
    expect(db.calls.values[0][0]).toMatchObject({
      documentId: 1,
      requesterUserId: 'requester-1',
      ownerUserId: 'owner-1',
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].to).toBe('owner@test.com')
  })

  it('409s without sending another email when a request already exists', async () => {
    setup({
      select: (i) => {
        if (i === 0) return [{ id: 1, userId: 'owner-1', title: 'Doc' }]
        return [{ id: 42 }] // existing request found on the very next select
      },
    })

    const res = await post()

    expect(res.status).toBe(409)
    expect((await res.json()).accessRequested).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })

  it('409s when a concurrent request wins the unique-index race on insert', async () => {
    const db = createFakeDb({
      select: (i) => {
        if (i === 0) return [{ id: 1, userId: 'owner-1', title: 'Doc' }]
        return [] // no existing request seen by this request's own check
      },
    })
    db.insert = () => {
      throw new Error('UNIQUE constraint failed: document_access_requests.documentId, document_access_requests.requesterUserId')
    }
    mockGetDB.mockReturnValue(db)
    mockRequireUserId.mockResolvedValue('requester-1')
    mockGetCloudflareContext.mockReturnValue({ env: { EMAIL: { send } }, cf: undefined, ctx: null })

    const res = await post()

    expect(res.status).toBe(409)
    expect(send).not.toHaveBeenCalled()
  })
})
