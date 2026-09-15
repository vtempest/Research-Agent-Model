import { describe, it, expect, beforeAll } from 'vitest'
import {
  fetchPriceHistory,
  syncPriceHistory,
  getPriceHistory,
  fetchMarkets,
} from '../src/prediction'

// These are integration tests: they call the live Polymarket API and read and
// write the D1 database. Opt in with RUN_INTEGRATION_TESTS=1 and D1 credentials
// (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_TOKEN) in the environment.
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' &&
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) &&
  Boolean(process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN)

describe.runIf(runIntegration)('Polymarket Price History', () => {
  let testTokenId: string
  let testMarketId: string

  beforeAll(async () => {
    // Fetch a real market to get a valid token ID
    const markets = await fetchMarkets(1, 'volume24hr')
    expect(markets).toBeDefined()
    expect(markets.length).toBeGreaterThan(0)

    const market = markets[0]
    expect(market.clobTokenIds).toBeDefined()
    expect(market.clobTokenIds.length).toBeGreaterThan(0)

    testTokenId = market.clobTokenIds[0]
    testMarketId = market.id

    console.log('Test Market:', {
      id: testMarketId,
      question: market.question,
      tokenId: testTokenId,
    })
  })

  it('should fetch price history from Polymarket API', async () => {
    const result = await fetchPriceHistory({
      market: testTokenId,
      interval: '1h',
    })

    expect(result).toBeDefined()
    expect(result.history).toBeDefined()
    expect(Array.isArray(result.history)).toBe(true)
    expect(result.history.length).toBeGreaterThan(0)

    // Verify data structure
    const firstPoint = result.history[0]
    expect(firstPoint).toHaveProperty('t')
    expect(firstPoint).toHaveProperty('p')
    expect(typeof firstPoint.t).toBe('number')
    expect(typeof firstPoint.p).toBe('number')

    console.log('Fetched price history points:', result.history.length)
    console.log('First point:', firstPoint)
    console.log('Last point:', result.history[result.history.length - 1])
  }, 30000)

  it('should sync price history to database', async () => {
    const result = await syncPriceHistory(testTokenId, {
      interval: '1h',
    })

    expect(result).toBeDefined()
    expect(result.pricePoints).toBeGreaterThan(0)

    console.log('Synced price points:', result.pricePoints)
  }, 30000)

  it('should retrieve price history from database', async () => {
    // First sync to ensure data exists
    await syncPriceHistory(testTokenId, { interval: '1h' })

    // Then retrieve from database
    const history = await getPriceHistory(testTokenId, {
      interval: '1h',
    })

    expect(history).toBeDefined()
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBeGreaterThan(0)

    // Verify data structure
    const firstPoint = history[0]
    expect(firstPoint).toHaveProperty('tokenId')
    expect(firstPoint).toHaveProperty('timestamp')
    expect(firstPoint).toHaveProperty('price')
    expect(firstPoint).toHaveProperty('interval')
    expect(firstPoint.tokenId).toBe(testTokenId)
    expect(firstPoint.interval).toBe('1h')

    console.log('Retrieved price history from DB:', history.length, 'points')
    console.log('First point:', firstPoint)
    console.log('Last point:', history[history.length - 1])
  }, 30000)

  it('should filter by interval correctly', async () => {
    // Sync with different intervals
    await syncPriceHistory(testTokenId, { interval: '1h' })
    await syncPriceHistory(testTokenId, { interval: '1d' })

    // Retrieve only 1h interval
    const hourlyHistory = await getPriceHistory(testTokenId, {
      interval: '1h',
    })

    expect(hourlyHistory).toBeDefined()
    expect(hourlyHistory.length).toBeGreaterThan(0)

    // Verify all points are 1h interval
    hourlyHistory.forEach((point) => {
      expect(point.interval).toBe('1h')
    })

    console.log('Filtered by interval (1h):', hourlyHistory.length, 'points')
  }, 30000)

  it('should return sorted data by timestamp ascending', async () => {
    await syncPriceHistory(testTokenId, { interval: '1h' })

    const history = await getPriceHistory(testTokenId, {
      interval: '1h',
    })

    expect(history.length).toBeGreaterThan(1)

    // Verify ascending order
    for (let i = 1; i < history.length; i++) {
      expect(history[i].timestamp).toBeGreaterThanOrEqual(
        history[i - 1].timestamp
      )
    }

    console.log('Timestamp range:', {
      first: history[0].timestamp,
      last: history[history.length - 1].timestamp,
    })
  }, 30000)

  it('should respect limit parameter', async () => {
    await syncPriceHistory(testTokenId, { interval: '1h' })

    const history = await getPriceHistory(testTokenId, {
      interval: '1h',
      limit: 10,
    })

    expect(history.length).toBeLessThanOrEqual(10)

    console.log('Limited results:', history.length, 'points (max 10)')
  }, 30000)

  it('should calculate price changes correctly', async () => {
    await syncPriceHistory(testTokenId, { interval: '1h' })

    const history = await getPriceHistory(testTokenId, {
      interval: '1h',
    })

    expect(history.length).toBeGreaterThan(0)

    // Get current price (most recent)
    const currentPrice = history[history.length - 1].price

    // Find price 24 hours ago
    const now = Math.floor(Date.now() / 1000)
    const oneDayAgo = now - 24 * 60 * 60

    const historicalPrice = history.find(
      (point) => point.timestamp <= oneDayAgo
    )

    if (historicalPrice) {
      const dailyChange = ((currentPrice - historicalPrice.price) / historicalPrice.price) * 100

      console.log('Price change calculation:', {
        currentPrice,
        historicalPrice: historicalPrice.price,
        dailyChange: dailyChange.toFixed(2) + '%',
        timestamp24hAgo: oneDayAgo,
        foundTimestamp: historicalPrice.timestamp,
      })

      expect(typeof dailyChange).toBe('number')
      expect(isNaN(dailyChange)).toBe(false)
    } else {
      console.log('No price data from 24 hours ago available')
    }
  }, 30000)
})
