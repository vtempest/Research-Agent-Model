/**
 * @fileoverview Route tests for the OAuth provider discovery endpoint the
 * sign-in page uses to decide which social buttons to render. A provider is
 * only advertised when both halves of its credential pair are configured,
 * and Google additionally has to not be the placeholder from `.env.example`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/config/env', () => ({ getEnv: vi.fn() }))

import { getEnv } from '@/lib/config/env'
import { GET } from '../route'

const mockGetEnv = getEnv as unknown as ReturnType<typeof vi.fn>

const GOOGLE_PLACEHOLDER_ID = 'your-google-client-id.apps.googleusercontent.com'
const GOOGLE_PLACEHOLDER_SECRET = 'your-google-client-secret'

/** Serves the given env map to the route, and undefined for anything else. */
function env(values: Record<string, string | undefined>) {
  mockGetEnv.mockImplementation((key: string) => values[key])
}

const providers = async () => (await (await GET()).json()).providers as string[]

const ALL_CONFIGURED = {
  GOOGLE_CLIENT_ID: 'real-google-id',
  GOOGLE_CLIENT_SECRET: 'real-google-secret',
  AUTH_DISCORD_ID: 'discord-id',
  AUTH_DISCORD_SECRET: 'discord-secret',
  AUTH_LINKEDIN_ID: 'linkedin-id',
  AUTH_LINKEDIN_SECRET: 'linkedin-secret',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/auth/providers', () => {
  it('advertises nothing when no provider is configured', async () => {
    env({})

    expect(await providers()).toEqual([])
  })

  it('advertises every configured provider', async () => {
    env(ALL_CONFIGURED)

    expect(await providers()).toEqual(['google', 'discord', 'linkedin'])
  })

  it('advertises Google when both halves are real', async () => {
    env({ GOOGLE_CLIENT_ID: 'real-google-id', GOOGLE_CLIENT_SECRET: 'real-google-secret' })

    expect(await providers()).toEqual(['google'])
  })

  it('hides Google when only the client id is set', async () => {
    env({ GOOGLE_CLIENT_ID: 'real-google-id' })

    expect(await providers()).toEqual([])
  })

  it('hides Google when only the client secret is set', async () => {
    env({ GOOGLE_CLIENT_SECRET: 'real-google-secret' })

    expect(await providers()).toEqual([])
  })

  it('hides Google when the client id is still the example placeholder', async () => {
    env({ GOOGLE_CLIENT_ID: GOOGLE_PLACEHOLDER_ID, GOOGLE_CLIENT_SECRET: 'real-google-secret' })

    expect(await providers()).toEqual([])
  })

  it('hides Google when the client secret is still the example placeholder', async () => {
    env({ GOOGLE_CLIENT_ID: 'real-google-id', GOOGLE_CLIENT_SECRET: GOOGLE_PLACEHOLDER_SECRET })

    expect(await providers()).toEqual([])
  })

  it('hides a provider whose credentials are empty strings', async () => {
    env({ AUTH_DISCORD_ID: '', AUTH_DISCORD_SECRET: '' })

    expect(await providers()).toEqual([])
  })

  it('advertises Discord independently of the others', async () => {
    env({ AUTH_DISCORD_ID: 'discord-id', AUTH_DISCORD_SECRET: 'discord-secret' })

    expect(await providers()).toEqual(['discord'])
  })

  it('hides Discord when only one half is set', async () => {
    env({ AUTH_DISCORD_ID: 'discord-id' })

    expect(await providers()).toEqual([])
  })

  it('advertises LinkedIn independently of the others', async () => {
    env({ AUTH_LINKEDIN_ID: 'linkedin-id', AUTH_LINKEDIN_SECRET: 'linkedin-secret' })

    expect(await providers()).toEqual(['linkedin'])
  })

  it('hides LinkedIn when only one half is set', async () => {
    env({ AUTH_LINKEDIN_SECRET: 'linkedin-secret' })

    expect(await providers()).toEqual([])
  })

  it('answers with JSON under a providers key', async () => {
    env(ALL_CONFIGURED)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ providers: ['google', 'discord', 'linkedin'] })
  })
})
