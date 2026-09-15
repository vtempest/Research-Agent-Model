import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// is-vpn is imported by the module under test; mock it so we control the verdict.
const checkMock = vi.fn()
vi.mock('is-vpn', () => ({
  default: { check: (...args: any[]) => checkMock(...args) },
  check: (...args: any[]) => checkMock(...args),
}))

import {
  detectVpnAndLocation,
  getClientIp,
  locationFromEdgeHeaders,
  lookupIpLocation,
  resolveClientLocation,
} from '../ip-geolocation'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  checkMock.mockReset()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectVpnAndLocation', () => {
  it('returns a neutral result when no IP is given', async () => {
    expect(await detectVpnAndLocation(null)).toEqual({ city: undefined, isVpn: false })
    expect(await detectVpnAndLocation(undefined)).toEqual({ city: undefined, isVpn: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports the city and vpn status on success', async () => {
    checkMock.mockResolvedValue(true)
    fetchMock.mockResolvedValue({ json: async () => ({ city: 'Berlin' }) })
    const result = await detectVpnAndLocation('1.2.3.4')
    expect(result).toEqual({ city: 'Berlin', isVpn: true })
  })

  it('treats a non-true vpn verdict as not-a-vpn', async () => {
    checkMock.mockResolvedValue(false)
    fetchMock.mockResolvedValue({ json: async () => ({ city: 'Paris' }) })
    const result = await detectVpnAndLocation('5.6.7.8')
    expect(result.isVpn).toBe(false)
    expect(result.city).toBe('Paris')
  })

  it('coerces a missing city to undefined', async () => {
    checkMock.mockResolvedValue(false)
    fetchMock.mockResolvedValue({ json: async () => ({}) })
    const result = await detectVpnAndLocation('9.9.9.9')
    expect(result.city).toBeUndefined()
  })

  it('recovers from a vpn check rejection', async () => {
    checkMock.mockRejectedValue(new Error('vpn service down'))
    fetchMock.mockResolvedValue({ json: async () => ({ city: 'Tokyo' }) })
    const result = await detectVpnAndLocation('2.2.2.2')
    expect(result).toEqual({ city: 'Tokyo', isVpn: false })
  })

  it('recovers from a geolocation fetch rejection', async () => {
    checkMock.mockResolvedValue(true)
    fetchMock.mockRejectedValue(new Error('geo down'))
    const result = await detectVpnAndLocation('3.3.3.3')
    expect(result).toEqual({ city: undefined, isVpn: true })
  })
})

describe('getClientIp', () => {
  it('takes the leftmost x-forwarded-for hop', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })
    expect(getClientIp(headers)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip and then cf-connecting-ip', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '203.0.113.8' }))).toBe('203.0.113.8')
    expect(getClientIp(new Headers({ 'cf-connecting-ip': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('rejects private, loopback and CGNAT addresses', () => {
    for (const ip of ['127.0.0.1', '::1', '10.0.0.4', '192.168.1.5', '172.20.0.1', '169.254.1.1', '100.64.0.1', 'fd00::1']) {
      expect(getClientIp(new Headers({ 'x-forwarded-for': ip }))).toBeNull()
    }
  })

  it('returns null when no proxy header is present', () => {
    expect(getClientIp(new Headers())).toBeNull()
  })
})

describe('locationFromEdgeHeaders', () => {
  it('reads Cloudflare geo headers', () => {
    const headers = new Headers({
      'cf-ipcity': 'Berlin',
      'cf-region': 'Berlin',
      'cf-ipcountry': 'DE',
      'cf-timezone': 'Europe/Berlin',
      'cf-iplatitude': '52.52',
      'cf-iplongitude': '13.40',
    })
    expect(locationFromEdgeHeaders(headers)).toEqual({
      city: 'Berlin',
      region: 'Berlin',
      countryCode: 'DE',
      timezone: 'Europe/Berlin',
      latitude: 52.52,
      longitude: 13.4,
    })
  })

  it('decodes the percent-encoded Vercel city header', () => {
    const headers = new Headers({
      'x-vercel-ip-city': 'San%20Francisco',
      'x-vercel-ip-country-region': 'CA',
      'x-vercel-ip-country': 'US',
    })
    expect(locationFromEdgeHeaders(headers)?.city).toBe('San Francisco')
  })

  it('returns null when no edge city is present', () => {
    expect(locationFromEdgeHeaders(new Headers({ 'cf-ipcountry': 'DE' }))).toBeNull()
  })

  it('drops unparseable coordinates', () => {
    const headers = new Headers({ 'cf-ipcity': 'Berlin', 'cf-iplatitude': 'n/a' })
    expect(locationFromEdgeHeaders(headers)?.latitude).toBeUndefined()
  })
})

describe('lookupIpLocation', () => {
  it('maps an ipapi.co payload', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        city: 'Paris',
        region: 'Ile-de-France',
        country_name: 'France',
        country_code: 'FR',
        timezone: 'Europe/Paris',
        latitude: 48.85,
        longitude: 2.35,
      }),
    })
    expect(await lookupIpLocation('203.0.113.7')).toEqual({
      city: 'Paris',
      region: 'Ile-de-France',
      country: 'France',
      countryCode: 'FR',
      timezone: 'Europe/Paris',
      latitude: 48.85,
      longitude: 2.35,
    })
  })

  it('returns null on an ipapi.co error payload or a missing city', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, reason: 'quota' }) })
    expect(await lookupIpLocation('203.0.113.7')).toBeNull()
    fetchMock.mockResolvedValue({ json: async () => ({ country_name: 'France' }) })
    expect(await lookupIpLocation('203.0.113.7')).toBeNull()
  })

  it('returns null when the lookup rejects', async () => {
    fetchMock.mockRejectedValue(new Error('geo down'))
    expect(await lookupIpLocation('203.0.113.7')).toBeNull()
  })
})

describe('resolveClientLocation', () => {
  it('prefers edge headers over an outbound lookup', async () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.7',
      'cf-ipcity': 'Berlin',
      'cf-ipcountry': 'DE',
    })
    const result = await resolveClientLocation(headers)
    expect(result).toMatchObject({ ip: '203.0.113.7', city: 'Berlin', source: 'edge' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to ipapi.co when the edge supplied no city', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ city: 'Paris', country_name: 'France' }) })
    const result = await resolveClientLocation(new Headers({ 'x-forwarded-for': '203.0.113.7' }))
    expect(result).toMatchObject({ ip: '203.0.113.7', city: 'Paris', source: 'ipapi' })
  })

  it('reports source "none" without a usable IP', async () => {
    const result = await resolveClientLocation(new Headers({ 'x-forwarded-for': '127.0.0.1' }))
    expect(result).toEqual({ ip: null, source: 'none' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the IP when the lookup resolves nothing', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true }) })
    const result = await resolveClientLocation(new Headers({ 'x-real-ip': '203.0.113.7' }))
    expect(result).toEqual({ ip: '203.0.113.7', source: 'none' })
  })
})
