/**
 * @fileoverview Route tests for the detected-location endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cloudflare/ip-geolocation', () => ({ resolveClientLocation: vi.fn() }))

import { resolveClientLocation } from '@/lib/cloudflare/ip-geolocation'
import { GET } from '../route'

const mockResolve = resolveClientLocation as unknown as ReturnType<typeof vi.fn>

const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/geolocation', { headers }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/geolocation', () => {
  it('returns the resolved location', async () => {
    mockResolve.mockResolvedValue({ ip: '203.0.113.7', city: 'Berlin', source: 'edge' })
    const res = await GET(request({ 'x-forwarded-for': '203.0.113.7' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ip: '203.0.113.7', city: 'Berlin', source: 'edge' })
  })

  it('keeps the per-viewer answer off shared caches', async () => {
    mockResolve.mockResolvedValue({ ip: null, source: 'none' })
    const res = await GET(request())
    expect(res.headers.get('cache-control')).toContain('private')
  })

  it('500s when resolution throws', async () => {
    mockResolve.mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(request())
    expect(res.status).toBe(500)
    errorSpy.mockRestore()
  })
})
