/**
 * @fileoverview Route tests for the two engine administration endpoints:
 * `/status`, which reads and writes the enabled-engine list in the config,
 * and `/test`, which probes each named engine with a throwaway query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/config', () => ({
  default: { getConfig: vi.fn(), updateConfig: vi.fn() },
}))

vi.mock('search-web-api/search/search-query-executor.js', () => ({
  Search: vi.fn(),
}))

import configManager from '@/lib/config'
import { Search } from 'search-web-api/search/search-query-executor.js'
import { jsonRequest } from '../../../__tests__/helpers/fake-db'
import { GET as GET_STATUS, POST as POST_STATUS } from '../status/route'
import { POST as POST_TEST } from '../test/route'

const mockGetConfig = configManager.getConfig as unknown as ReturnType<typeof vi.fn>
const mockUpdateConfig = configManager.updateConfig as unknown as ReturnType<typeof vi.fn>
const mockSearch = Search as unknown as ReturnType<typeof vi.fn>

const search = vi.fn()

/**
 * Stand the mocked `Search` class up as a constructor. The implementation
 * has to be a `function` — an arrow implementation makes `new Search()`
 * throw "is not a constructor".
 */
function stubSearch() {
  mockSearch.mockImplementation(function () {
    return { search }
  })
}

const statusRequest = (body: unknown) =>
  POST_STATUS(jsonRequest('http://localhost/api/search/engines/status', 'POST', body))
const testRequest = (body: unknown) =>
  POST_TEST(jsonRequest('http://localhost/api/search/engines/test', 'POST', body))

/** A POST whose body is not valid JSON, to drive the outer catch. */
const brokenBodyRequest = (url: string) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{oops',
  }) as any

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  stubSearch()
  search.mockResolvedValue([{ title: 'a result' }])
})

describe('GET /api/search/engines/status', () => {
  it('returns the enabled engines from the config', async () => {
    mockGetConfig.mockReturnValue(['google', 'brave'])

    const res = await GET_STATUS()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabledEngines: ['google', 'brave'] })
    expect(mockGetConfig).toHaveBeenCalledWith('search.enabledEngines', [])
  })

  it('returns an empty list when nothing is enabled yet', async () => {
    mockGetConfig.mockReturnValue([])

    expect(await (await GET_STATUS()).json()).toEqual({ enabledEngines: [] })
  })

  it('500s when the config read throws', async () => {
    mockGetConfig.mockImplementation(() => {
      throw new Error('config unreadable')
    })

    const res = await GET_STATUS()

    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe('Failed to fetch engine status')
  })
})

describe('POST /api/search/engines/status', () => {
  it('persists the submitted engine list', async () => {
    const res = await statusRequest({ enabledEngines: ['google', 'ddg'] })

    expect(res.status).toBe(200)
    expect(mockUpdateConfig).toHaveBeenCalledWith('search.enabledEngines', ['google', 'ddg'])
    expect((await res.json()).message).toBe('Engine status updated')
  })

  it('accepts an empty list, disabling every engine', async () => {
    const res = await statusRequest({ enabledEngines: [] })

    expect(res.status).toBe(200)
    expect(mockUpdateConfig).toHaveBeenCalledWith('search.enabledEngines', [])
  })

  it('400s when enabledEngines is not an array', async () => {
    const res = await statusRequest({ enabledEngines: 'google' })

    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('enabledEngines must be an array')
    expect(mockUpdateConfig).not.toHaveBeenCalled()
  })

  it('400s when enabledEngines is missing', async () => {
    const res = await statusRequest({})

    expect(res.status).toBe(400)
    expect(mockUpdateConfig).not.toHaveBeenCalled()
  })

  it('500s when the config write throws', async () => {
    mockUpdateConfig.mockImplementation(() => {
      throw new Error('read-only config')
    })

    const res = await statusRequest({ enabledEngines: ['google'] })

    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe('Failed to update engine status')
  })

  it('500s on an unparseable body', async () => {
    const res = await POST_STATUS(brokenBodyRequest('http://localhost/api/search/engines/status'))

    expect(res.status).toBe(500)
  })
})

describe('POST /api/search/engines/test', () => {
  it('reports an engine that returns results as working', async () => {
    const res = await testRequest({ engines: ['google'] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: { google: { working: true } } })
  })

  it('probes each engine by name with a one-page throwaway query', async () => {
    await testRequest({ engines: ['google'] })

    expect(search).toHaveBeenCalledWith('test', 1, ['google'])
  })

  it('reports an engine that returns nothing as not working', async () => {
    search.mockResolvedValue([])

    const { results } = await (await testRequest({ engines: ['google'] })).json()

    expect(results.google).toEqual({ working: false })
  })

  it('reports a non-array result as not working', async () => {
    search.mockResolvedValue(null)

    const { results } = await (await testRequest({ engines: ['google'] })).json()

    expect(results.google).toEqual({ working: false })
  })

  it('records the failure message for an engine that throws', async () => {
    search.mockRejectedValue(new Error('403 from upstream'))

    const { results } = await (await testRequest({ engines: ['google'] })).json()

    expect(results.google).toEqual({ working: false, error: '403 from upstream' })
  })

  it('labels a non-Error rejection as an unknown error', async () => {
    search.mockRejectedValue('just a string')

    const { results } = await (await testRequest({ engines: ['google'] })).json()

    expect(results.google).toEqual({ working: false, error: 'Unknown error' })
  })

  it('keeps probing the remaining engines after one fails', async () => {
    search
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce([{ title: 'a result' }])

    const { results } = await (await testRequest({ engines: ['broken', 'google'] })).json()

    expect(results).toEqual({
      broken: { working: false, error: 'down' },
      google: { working: true },
    })
  })

  it('400s when engines is missing', async () => {
    const res = await testRequest({})

    expect(res.status).toBe(400)
    expect((await res.json()).message).toBe('engines array is required')
    expect(search).not.toHaveBeenCalled()
  })

  it('400s on an empty engines array', async () => {
    const res = await testRequest({ engines: [] })

    expect(res.status).toBe(400)
    expect(search).not.toHaveBeenCalled()
  })

  it('400s when engines is not an array', async () => {
    const res = await testRequest({ engines: 'google' })

    expect(res.status).toBe(400)
    expect(search).not.toHaveBeenCalled()
  })

  it('500s on an unparseable body', async () => {
    const res = await POST_TEST(brokenBodyRequest('http://localhost/api/search/engines/test'))

    expect(res.status).toBe(500)
    expect((await res.json()).message).toBe('Failed to test engines')
  })
})
