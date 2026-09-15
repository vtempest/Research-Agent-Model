/**
 * Unified Quote Service
 * Combines yfinance and alpaca APIs with automatic fallback
 * Priority: cache -> alpaca (10s timeout) -> yfinance
 * Caches all fetched quotes to database
 *
 * Note: alpaca is preferred for faster response times
 */

// Helper to add timeout to a promise
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
  ]);
}

import { yahooFinanceWrapper as yahooFinance } from "./yahoo-finance-wrapper";
import { finnhub } from "./finnhub-wrapper";
import { getAlpacaMCPClient } from "../alpaca/alpaca-mcp-client";
import { quoteCacheService, type HistoricalQuote } from "./quote-cache-service";

// Historical data response interface
export interface HistoricalDataResponse {
  success: boolean;
  symbol?: string;
  data?: {
    quotes: HistoricalQuote[];
    meta?: {
      symbol: string;
      cachedCount: number;
      fetchedCount: number;
      source: "cache" | "alpaca" | "mixed";
    };
  };
  error?: string;
}

// Number of recent days that should have TTL applied (recent data may need refresh)
const RECENT_DAYS_TTL = 2;

// Normalized quote structure
export interface NormalizedQuote {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: string | null;
  name: string | null;
  exchange: string | null;
  timestamp: Date;
  source: "yfinance" | "finnhub" | "alpaca";
}

// Normalized quotes structure (for batch requests)
export interface NormalizedQuotes {
  quotes: NormalizedQuote[];
  source: "yfinance" | "finnhub" | "alpaca" | "mixed";
  timestamp: Date;
}

export interface QuoteServiceResponse {
  success: boolean;
  data?: NormalizedQuote;
  error?: string;
}

export interface QuotesServiceResponse {
  success: boolean;
  data?: NormalizedQuotes;
  error?: string;
}

/**
 * Unified Quote Service Class
 */
export class UnifiedQuoteService {
  /**
   * Get a single stock quote with automatic fallback
   * Tries: cache -> alpaca (10s timeout) -> yfinance
   * @param symbol - Stock symbol to fetch
   * @param options - Options object with useCache flag (default: true) and cacheTTL in milliseconds
   */
  async getQuote(symbol: string, options: { useCache?: boolean; cacheTTL?: number } = {}): Promise<QuoteServiceResponse> {
    const { useCache = true, cacheTTL } = options;
    console.log(`[UnifiedQuote] Fetching quote for ${symbol} (useCache: ${useCache}${cacheTTL ? `, cacheTTL: ${cacheTTL}ms` : ''})`);

    // Check cache first (unless bypassed)
    if (useCache) {
      try {
        const cached = await quoteCacheService.getCachedQuote(symbol, cacheTTL);
        if (cached) {
          console.log(`[UnifiedQuote] ✓ Returning cached quote for ${symbol}`);
          return { success: true, data: cached };
        }
      } catch (error: any) {
        console.log(`[UnifiedQuote] Cache check failed for ${symbol}: ${error.message}`);
      }
    } else {
      console.log(`[UnifiedQuote] Skipping cache for ${symbol} (live data requested)`);
    }

    // Try alpaca first with 10s timeout
    try {
      console.log(`[UnifiedQuote] Trying alpaca for ${symbol}...`);
      const alpacaClient = getAlpacaMCPClient();
      const alpacaResult = await withTimeout(
        alpacaClient.getQuote(symbol),
        10000,
        `alpaca timeout after 10s for ${symbol}`
      );

      if (alpacaResult) {
        // Alpaca returns quote data directly
        const quote = alpacaResult as any;
        const normalized: NormalizedQuote = {
          symbol,
          price: quote.ap || quote.bp || 0, // ask price or bid price
          change: null,
          changePercent: null,
          open: null,
          high: null,
          low: null,
          previousClose: null,
          volume: quote.as || quote.bs || null, // ask size or bid size
          marketCap: null,
          currency: "USD",
          name: symbol,
          exchange: quote.x || null,
          timestamp: quote.t ? new Date(quote.t) : new Date(),
          source: "alpaca",
        };

        console.log(`[UnifiedQuote] ✓ alpaca succeeded for ${symbol}`);

        // Save to cache
        await quoteCacheService.saveQuoteToCache(normalized);

        return { success: true, data: normalized };
      }
    } catch (error: any) {
      console.log(`[UnifiedQuote] ✗ alpaca failed for ${symbol}: ${error.message}`);
    }

    // Try yfinance as fallback
    try {
      console.log(`[UnifiedQuote] Trying yfinance for ${symbol}...`);
      const yfinanceResult = await withTimeout(
        yahooFinance.getQuote(symbol),
        10000,
        `yfinance timeout after 10s for ${symbol}`
      );

      if (yfinanceResult.success && yfinanceResult.data) {
        const data = yfinanceResult.data as any;
        const normalized: NormalizedQuote = {
          symbol,
          price: data.regularMarketPrice || data.currentPrice || 0,
          change: data.regularMarketChange || null,
          changePercent: data.regularMarketChangePercent || null,
          open: data.regularMarketOpen || data.open || null,
          high: data.regularMarketDayHigh || data.dayHigh || null,
          low: data.regularMarketDayLow || data.dayLow || null,
          previousClose: data.regularMarketPreviousClose || data.previousClose || null,
          volume: data.volume || null,
          marketCap: data.marketCap || null,
          currency: data.currency || "USD",
          name: data.longName || data.shortName || symbol,
          exchange: data.exchange || data.fullExchangeName || null,
          timestamp: data.regularMarketTime ? new Date(data.regularMarketTime) : new Date(),
          source: "yfinance",
        };

        console.log(`[UnifiedQuote] ✓ yfinance succeeded for ${symbol}`);

        // Save to cache
        await quoteCacheService.saveQuoteToCache(normalized);

        return { success: true, data: normalized };
      }
    } catch (error: any) {
      console.log(`[UnifiedQuote] ✗ yfinance failed for ${symbol}: ${error.message}`);
    }

    console.error(`[UnifiedQuote] All sources failed for ${symbol}`);
    return {
      success: false,
      error: `Failed to fetch quote for ${symbol} from all sources (alpaca, yfinance)`,
    };
  }

  /**
   * Get multiple stock quotes with automatic fallback
   * Tries: cache -> individual fetch (alpaca -> yfinance)
   * @param symbols - Array of stock symbols to fetch
   * @param options - Options object with useCache flag (default: true) and cacheTTL in milliseconds
   */
  async getQuotes(symbols: string[], options: { useCache?: boolean; cacheTTL?: number } = {}): Promise<QuotesServiceResponse> {
    const { useCache = true, cacheTTL } = options;
    console.log(`[UnifiedQuotes] Fetching quotes for ${symbols.length} symbols (useCache: ${useCache}${cacheTTL ? `, cacheTTL: ${cacheTTL}ms` : ''})`);

    if (symbols.length === 0) {
      return {
        success: false,
        error: "No symbols provided",
      };
    }

    // Check cache for all symbols first (unless bypassed)
    const cachedQuotes: NormalizedQuote[] = [];
    const uncachedSymbols: string[] = [];

    if (useCache) {
      try {
        for (const symbol of symbols) {
          const cached = await quoteCacheService.getCachedQuote(symbol, cacheTTL);
          if (cached) {
            cachedQuotes.push(cached);
          } else {
            uncachedSymbols.push(symbol);
          }
        }

        console.log(
          `[UnifiedQuotes] Found ${cachedQuotes.length}/${symbols.length} quotes in cache`
        );

        // If all quotes are cached, return them
        if (uncachedSymbols.length === 0) {
          return {
            success: true,
            data: {
              quotes: cachedQuotes,
              source: "mixed", // Could be from any source
              timestamp: new Date(),
            },
          };
        }
      } catch (error: any) {
        console.log(`[UnifiedQuotes] Cache check failed: ${error.message}`);
      }
    } else {
      console.log(`[UnifiedQuotes] Skipping cache for all symbols (live data requested)`);
      uncachedSymbols.push(...symbols);
    }

    // Fetch uncached symbols individually (alpaca -> yfinance priority)
    const symbolsToFetch = uncachedSymbols.length > 0 ? uncachedSymbols : symbols;
    console.log(`[UnifiedQuotes] Fetching ${symbolsToFetch.length} symbols individually...`);

    const quotes: NormalizedQuote[] = [...cachedQuotes];

    for (const symbol of symbolsToFetch) {
      const result = await this.getQuote(symbol, { useCache, cacheTTL });
      if (result.success && result.data) {
        quotes.push(result.data);
      }
    }

    if (quotes.length > 0) {
      return {
        success: true,
        data: {
          quotes,
          source: "mixed",
          timestamp: new Date(),
        },
      };
    }

    console.error(`[UnifiedQuotes] Failed to fetch any quotes`);
    return {
      success: false,
      error: `Failed to fetch quotes for any of the ${symbols.length} symbols`,
    };
  }

  /**
   * Get historical quotes with smart caching
   * Strategy:
   * 1. Fetch all cached historical data for the date range
   * 2. Identify missing dates (gaps in the cache)
   * 3. Only fetch missing dates from Alpaca API
   * 4. Cache policy: Historical data is permanent, only recent days (last 2 trading days) may need refresh
   *
   * @param symbol - Stock symbol to fetch
   * @param startDate - Start date (YYYY-MM-DD or Date)
   * @param endDate - End date (YYYY-MM-DD or Date)
   * @param options - Options object with forceRefreshRecent flag to refresh last N days
   */
  async getHistoricalQuotes(
    symbol: string,
    startDate: string | Date,
    endDate: string | Date,
    options: { forceRefreshRecent?: boolean } = {}
  ): Promise<HistoricalDataResponse> {
    const { forceRefreshRecent = true } = options;
    const symbolUpper = symbol.toUpperCase();

    // Normalize dates to YYYY-MM-DD strings
    const start = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
    const end = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];

    console.log(`[UnifiedHistorical] Fetching historical data for ${symbolUpper} from ${start} to ${end}`);

    // Step 1: Get all cached historical data for this symbol in the date range
    let cachedQuotes: HistoricalQuote[] = [];
    try {
      cachedQuotes = await quoteCacheService.getCachedHistoricalQuotes(symbolUpper, start, end);
      console.log(`[UnifiedHistorical] Found ${cachedQuotes.length} cached quotes for ${symbolUpper}`);
    } catch (error: any) {
      console.log(`[UnifiedHistorical] Cache read failed: ${error.message}`);
    }

    // Step 2: Generate all expected trading dates in the range
    const expectedDates = this.generateTradingDates(start, end);
    console.log(`[UnifiedHistorical] Expected ~${expectedDates.length} trading days in range`);

    // Step 3: Find which dates are missing from cache
    const cachedDatesSet = new Set(cachedQuotes.map(q => q.date));
    let missingDates = expectedDates.filter(date => !cachedDatesSet.has(date));

    // Step 4: If forceRefreshRecent, also refresh the most recent N days
    if (forceRefreshRecent && cachedQuotes.length > 0) {
      const today = new Date();
      const recentCutoff = new Date(today);
      recentCutoff.setDate(recentCutoff.getDate() - RECENT_DAYS_TTL);
      const recentCutoffStr = recentCutoff.toISOString().split('T')[0];

      // Add recent dates to missing dates (force refresh)
      const recentDatesToRefresh = expectedDates.filter(date => date >= recentCutoffStr);
      for (const date of recentDatesToRefresh) {
        if (!missingDates.includes(date)) {
          missingDates.push(date);
        }
      }
      // Remove recent dates from cached quotes (they'll be re-fetched)
      cachedQuotes = cachedQuotes.filter(q => q.date < recentCutoffStr);
    }

    console.log(`[UnifiedHistorical] Missing ${missingDates.length} dates to fetch`);

    // Step 5: If no missing dates, return cached data
    if (missingDates.length === 0) {
      console.log(`[UnifiedHistorical] ✓ All data found in cache for ${symbolUpper}`);
      return {
        success: true,
        symbol: symbolUpper,
        data: {
          quotes: cachedQuotes.sort((a, b) => a.date.localeCompare(b.date)),
          meta: {
            symbol: symbolUpper,
            cachedCount: cachedQuotes.length,
            fetchedCount: 0,
            source: "cache",
          },
        },
      };
    }

    // Step 6: Fetch missing dates from Alpaca
    let fetchedQuotes: HistoricalQuote[] = [];

    // Find the date range to fetch (min and max of missing dates)
    missingDates.sort();
    const fetchStart = missingDates[0];
    const fetchEnd = missingDates[missingDates.length - 1];

    try {
      console.log(`[UnifiedHistorical] Fetching from Alpaca: ${fetchStart} to ${fetchEnd}...`);
      const alpacaClient = getAlpacaMCPClient();

      const barsResult = await withTimeout(
        alpacaClient.getBars({
          symbol: symbolUpper,
          timeframe: "1Day",
          start: fetchStart,
          end: fetchEnd,
        }),
        30000,
        `Alpaca historical timeout after 30s for ${symbolUpper}`
      );

      if (barsResult && Array.isArray(barsResult)) {
        fetchedQuotes = (barsResult as any[]).map((bar: any) => ({
          date: bar.t ? bar.t.split('T')[0] : new Date(bar.Timestamp || bar.t).toISOString().split('T')[0],
          open: bar.o ?? bar.OpenPrice ?? 0,
          high: bar.h ?? bar.HighPrice ?? 0,
          low: bar.l ?? bar.LowPrice ?? 0,
          close: bar.c ?? bar.ClosePrice ?? 0,
          volume: bar.v ?? bar.Volume ?? undefined,
        }));

        console.log(`[UnifiedHistorical] ✓ Alpaca returned ${fetchedQuotes.length} bars`);

        // Save fetched quotes to cache
        if (fetchedQuotes.length > 0) {
          await quoteCacheService.saveHistoricalQuotes(symbolUpper, fetchedQuotes);
          console.log(`[UnifiedHistorical] Saved ${fetchedQuotes.length} quotes to cache`);
        }
      }
    } catch (error: any) {
      console.log(`[UnifiedHistorical] ✗ Alpaca failed: ${error.message}`);

      // Try finnhub as fallback
      try {
        console.log(`[UnifiedHistorical] Trying finnhub fallback...`);
        const finnhubResult = await finnhub.getHistoricalData({
          symbol: symbolUpper,
          period1: fetchStart,
          period2: fetchEnd,
          interval: "D",
        });

        if (finnhubResult.success && finnhubResult.data?.quotes) {
          fetchedQuotes = finnhubResult.data.quotes.map((q: any) => ({
            date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : q.date,
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume,
          }));

          console.log(`[UnifiedHistorical] ✓ Finnhub returned ${fetchedQuotes.length} bars`);

          // Save to cache
          if (fetchedQuotes.length > 0) {
            await quoteCacheService.saveHistoricalQuotes(symbolUpper, fetchedQuotes);
          }
        }
      } catch (fallbackError: any) {
        console.log(`[UnifiedHistorical] ✗ Finnhub fallback also failed: ${fallbackError.message}`);
      }
    }

    // Step 7: Combine cached and fetched quotes
    const allQuotes = [...cachedQuotes, ...fetchedQuotes];

    // Deduplicate by date (prefer fetched data for recent dates)
    const quotesMap = new Map<string, HistoricalQuote>();
    for (const quote of allQuotes) {
      quotesMap.set(quote.date, quote);
    }

    const combinedQuotes = Array.from(quotesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (combinedQuotes.length === 0) {
      return {
        success: false,
        symbol: symbolUpper,
        error: `Failed to fetch historical data for ${symbolUpper}`,
      };
    }

    return {
      success: true,
      symbol: symbolUpper,
      data: {
        quotes: combinedQuotes,
        meta: {
          symbol: symbolUpper,
          cachedCount: cachedQuotes.length,
          fetchedCount: fetchedQuotes.length,
          source: fetchedQuotes.length > 0 ? (cachedQuotes.length > 0 ? "mixed" : "alpaca") : "cache",
        },
      },
    };
  }

  /**
   * Generate approximate trading dates between start and end
   * Excludes weekends (Saturday and Sunday)
   * Note: Does not account for holidays - API will return fewer days
   */
  private generateTradingDates(start: string, end: string): string[] {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get quote with explicit source preference
   */
  async getQuoteFromSource(
    symbol: string,
    source: "yfinance" | "finnhub" | "alpaca"
  ): Promise<QuoteServiceResponse> {
    console.log(`[UnifiedQuote] Fetching quote for ${symbol} from ${source}`);

    try {
      if (source === "yfinance") {
        const result = await yahooFinance.getQuote(symbol);
        if (result.success && result.data) {
          const data = result.data as any;
          return {
            success: true,
            data: {
              symbol,
              price: data.regularMarketPrice || data.currentPrice || 0,
              change: data.regularMarketChange || null,
              changePercent: data.regularMarketChangePercent || null,
              open: data.regularMarketOpen || data.open || null,
              high: data.regularMarketDayHigh || data.dayHigh || null,
              low: data.regularMarketDayLow || data.dayLow || null,
              previousClose: data.regularMarketPreviousClose || data.previousClose || null,
              volume: data.volume || null,
              marketCap: data.marketCap || null,
              currency: data.currency || "USD",
              name: data.longName || data.shortName || symbol,
              exchange: data.exchange || data.fullExchangeName || null,
              timestamp: data.regularMarketTime ? new Date(data.regularMarketTime) : new Date(),
              source: "yfinance",
            },
          };
        }
      } else if (source === "finnhub") {
        const result = await finnhub.getQuote({ symbol });
        if (result.success && result.data) {
          const data = result.data;
          return {
            success: true,
            data: {
              symbol,
              price: data.price?.regularMarketPrice || 0,
              change: data.price?.regularMarketChange || null,
              changePercent: data.price?.regularMarketChangePercent || null,
              open: data.summaryDetail?.open || null,
              high: data.summaryDetail?.dayHigh || null,
              low: data.summaryDetail?.dayLow || null,
              previousClose: data.summaryDetail?.previousClose || null,
              volume: data.summaryDetail?.regularMarketVolume || null,
              marketCap: data.price?.marketCap || null,
              currency: data.price?.currency || "USD",
              name: data.price?.longName || data.price?.shortName || symbol,
              exchange: data.price?.exchange || null,
              timestamp: data.price?.regularMarketTime || new Date(),
              source: "finnhub",
            },
          };
        }
      } else if (source === "alpaca") {
        const alpacaClient = getAlpacaMCPClient();
        const alpacaResult = await alpacaClient.getQuote(symbol);
        if (alpacaResult) {
          const quote = alpacaResult as any;
          return {
            success: true,
            data: {
              symbol,
              price: quote.ap || quote.bp || 0,
              change: null,
              changePercent: null,
              open: null,
              high: null,
              low: null,
              previousClose: null,
              volume: quote.as || quote.bs || null,
              marketCap: null,
              currency: "USD",
              name: symbol,
              exchange: quote.x || null,
              timestamp: quote.t ? new Date(quote.t) : new Date(),
              source: "alpaca",
            },
          };
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to fetch quote from ${source}: ${error.message}`,
      };
    }

    return {
      success: false,
      error: `No data returned from ${source}`,
    };
  }
}

// Export singleton instance
export const unifiedQuoteService = new UnifiedQuoteService();

// Export convenience functions
export async function getQuote(symbol: string, options: { useCache?: boolean } = {}): Promise<QuoteServiceResponse> {
  return unifiedQuoteService.getQuote(symbol, options);
}

export async function getQuotes(symbols: string[], options: { useCache?: boolean } = {}): Promise<QuotesServiceResponse> {
  return unifiedQuoteService.getQuotes(symbols, options);
}

export async function getQuoteFromSource(
  symbol: string,
  source: "yfinance" | "finnhub" | "alpaca"
): Promise<QuoteServiceResponse> {
  return unifiedQuoteService.getQuoteFromSource(symbol, source);
}

export async function getHistoricalQuotes(
  symbol: string,
  startDate: string | Date,
  endDate: string | Date,
  options: { forceRefreshRecent?: boolean } = {}
): Promise<HistoricalDataResponse> {
  return unifiedQuoteService.getHistoricalQuotes(symbol, startDate, endDate, options);
}

export default unifiedQuoteService;
