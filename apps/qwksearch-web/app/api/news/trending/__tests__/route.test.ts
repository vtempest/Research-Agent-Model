import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cloudflare/context', () => ({
  getCloudflareContext: vi.fn(),
}))

// Only the request handler is stubbed: the route's cache keys are built with
// the package's real `parseTopicLimit`, which is the point of that normalising.
vi.mock('trending-news-api/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('trending-news-api/server')>()),
  handleTrendingNewsRequest: vi.fn(),
}))

import { getCloudflareContext } from '@/lib/cloudflare/context'
import { handleTrendingNewsRequest } from 'trending-news-api/server'
import { GET } from '../route'

const mockContext = getCloudflareContext as ReturnType<typeof vi.fn>
const mockHandle = handleTrendingNewsRequest as ReturnType<typeof vi.fn>

/** A KV binding that records what the route stores. */
function fakeKV(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
  }
}

function stubEnv(env: Record<string, unknown>) {
  mockContext.mockReturnValue({ env, cf: undefined, ctx: null })
}

/** A fresh Response per call — a Response body can only be read once. */
function upstream(body: unknown, status = 200) {
  mockHandle.mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }),
  )
}

const request = (query = '') =>
  new Request(`https://qwksearch.com/api/news/trending${query}`)

const TOPICS = { source: 'wikipedia_daily_top', date: '2024-01-01', topics: [{ topic: 'Eclipse' }] }

describe('GET /api/news/trending', () => {
  beforeEach(() => {
    delete process.env.THENEWSAPI_API_KEY
  })

  it('serves the trending list with the server-held API key', async () => {
    stubEnv({ THENEWSAPI_API_KEY: 'worker-secret' })
    upstream(TOPICS)

    const response = await GET(request('?limit=6'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(TOPICS)
    expect(mockHandle).toHaveBeenCalledWith(expect.any(Request), { apiKey: 'worker-secret' })
  })

  it('falls back to process.env when there is no Worker binding', async () => {
    mockContext.mockImplementation(() => {
      throw new Error('no cloudflare runtime')
    })
    process.env.THENEWSAPI_API_KEY = 'env-secret'
    upstream(TOPICS)

    await GET(request())

    expect(mockHandle).toHaveBeenCalledWith(expect.any(Request), { apiKey: 'env-secret' })
  })

  it('never leaks the API key to the caller', async () => {
    stubEnv({ THENEWSAPI_API_KEY: 'worker-secret' })
    upstream(TOPICS)

    const response = await GET(request('?limit=6'))

    expect(await response.text()).not.toContain('worker-secret')
  })

  it('caches a successful answer in KV for the next visitor', async () => {
    const kv = fakeKV()
    stubEnv({ THENEWSAPI_API_KEY: 'k', KV: kv })
    upstream(TOPICS)

    const first = await GET(request('?limit=6'))
    expect(first.headers.get('X-Trending-News-Cache')).toBe('MISS')
    expect(kv.put).toHaveBeenCalledWith(
      'trending-news:v1:top:6',
      JSON.stringify(TOPICS),
      { expirationTtl: 600 },
    )

    const second = await GET(request('?limit=6'))
    expect(second.headers.get('X-Trending-News-Cache')).toBe('HIT')
    expect(await second.json()).toEqual(TOPICS)
    // The cached answer is served without asking Wikipedia or The News API again.
    expect(mockHandle).toHaveBeenCalledTimes(1)
  })

  it('keys the cache by topic, so one topic never answers another', async () => {
    const kv = fakeKV()
    stubEnv({ THENEWSAPI_API_KEY: 'k', KV: kv })
    upstream({ topic: 'Eclipse', news_count: 0, articles: [] })

    await GET(request('?topic=Eclipse'))
    await GET(request('?topic=Elections'))

    expect([...kv.store.keys()]).toEqual([
      'trending-news:v1:topic:eclipse',
      'trending-news:v1:topic:elections',
    ])
  })

  it('normalises the limit so one answer gets one cache entry', async () => {
    const kv = fakeKV()
    stubEnv({ THENEWSAPI_API_KEY: 'k', KV: kv })
    upstream(TOPICS)

    await GET(request('?limit=6'))
    await GET(request('?limit=06'))
    // Beyond the server's cap, so it answers with the same 50 topics as any
    // other oversized request.
    await GET(request('?limit=99999'))
    await GET(request('?limit=50'))

    expect([...kv.store.keys()]).toEqual(['trending-news:v1:top:6', 'trending-news:v1:top:50'])
  })

  it('does not cache a failure', async () => {
    const kv = fakeKV()
    stubEnv({ THENEWSAPI_API_KEY: 'k', KV: kv })
    upstream({ error: 'Failed to fetch Wikipedia trends' }, 500)

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(kv.put).not.toHaveBeenCalled()
  })

  it('still answers when KV is unavailable', async () => {
    stubEnv({ THENEWSAPI_API_KEY: 'k' })
    upstream(TOPICS)

    const response = await GET(request())

    expect(response.headers.get('X-Trending-News-Cache')).toBe('BYPASS')
    expect(await response.json()).toEqual(TOPICS)
  })

  it('survives a KV read that throws', async () => {
    const kv = fakeKV()
    kv.get.mockRejectedValue(new Error('KV unavailable'))
    stubEnv({ THENEWSAPI_API_KEY: 'k', KV: kv })
    upstream(TOPICS)

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(TOPICS)
  })

  it('passes an unconfigured key through as the handler’s own error', async () => {
    stubEnv({})
    upstream({ error: 'THENEWSAPI_API_KEY is not configured' }, 500)

    const response = await GET(request())

    expect(mockHandle).toHaveBeenCalledWith(expect.any(Request), { apiKey: undefined })
    expect(response.status).toBe(500)
  })
})
