// Finnhub API Wrapper for TypeScript
// Uses Finnhub as primary source with Alpaca API as fallback for historical data

import { createAlpacaClient } from "../alpaca/client";
import { yahooFinance } from "./yahoo-finance-wrapper";
import type {
  HistoricalDataOptions,
  QuoteOptions,
  FinnhubQuote,
  FinnhubCandle,
  FinnhubProfile,
  FinnhubMetrics,
  HistoricalDataResponse,
  FinnhubQuoteSummaryResponse,
  FinnhubSearchResponse,
  PeersResponse,
  RecommendationsResponse,
  FinancialsResponse,
  NewsResponse,
  ForexResponse,
  FinnhubQuoteData,
  FinnhubQuoteResponse,
} from "./types";
import {
  mapInterval,
  toUnixTimestamp,
  finnhubFetch,
  mapIntervalToAlpacaTimeframe,
  mapIntervalToYahoo,
  getAlpacaCredentials,
  formatDateRFC3339,
  formatDateYYYYMMDD,
  getFinnhubApiKey,
} from "./finnhub-utils";

export type { HistoricalDataOptions, QuoteOptions };

export class FinnhubWrapper {
  /**
   * Get historical price data for a symbol (candles)
   * Uses Finnhub as primary source, falls back to Alpaca API if Finnhub fails
   */
  async getHistoricalData(
    options: HistoricalDataOptions,
  ): Promise<HistoricalDataResponse> {
    const { symbol, period1, period2, interval = "1d" } = options;

    console.log(
      `[Historical] Fetching data for ${symbol}, interval: ${interval}, period: ${period1} to ${period2}`,
    );

    // Try Finnhub first (if API key is configured)
    if (getFinnhubApiKey()) {
      try {
        const resolution = mapInterval(interval);
        const from = toUnixTimestamp(period1);
        const to = toUnixTimestamp(period2);

        console.log(
          `[Finnhub] Requesting candles for ${symbol}, resolution: ${resolution}, from: ${from}, to: ${to}`,
        );

        const candles = await finnhubFetch<FinnhubCandle>("/stock/candle", {
          symbol: symbol.toUpperCase(),
          resolution,
          from: String(from),
          to: String(to),
        });

        if (candles.s === "no_data") {
          console.log(
            `[Finnhub] Returned no_data for ${symbol}, trying Alpaca...`,
          );
        } else if (candles.t && candles.t.length > 0) {
          // Transform to standard format
          const quotes: FinnhubQuoteData[] = candles.t.map((timestamp, i) => ({
            date: new Date(timestamp * 1000),
            open: candles.o[i],
            high: candles.h[i],
            low: candles.l[i],
            close: candles.c[i],
            volume: candles.v[i],
          }));

          console.log(
            `[Finnhub] Successfully fetched ${quotes.length} candles for ${symbol}`,
          );

          return {
            success: true,
            symbol,
            source: "finnhub",
            data: {
              quotes,
              meta: {
                symbol,
                exchangeName: "US",
                regularMarketPrice:
                  quotes.length > 0 ? quotes[quotes.length - 1].close : null,
              },
            },
            meta: {
              symbol,
              regularMarketPrice:
                quotes.length > 0 ? quotes[quotes.length - 1].close : null,
            },
          };
        } else {
          console.log(
            `[Finnhub] Returned empty data for ${symbol} (status: ${candles.s}), trying Alpaca...`,
          );
        }
      } catch (finnhubError: any) {
        console.log(
          `[Finnhub] API failed for ${symbol}: ${finnhubError.message}, trying Alpaca...`,
        );
      }
    } else {
      console.log("[Finnhub] API key not configured, skipping to Alpaca...");
    }

    // Fallback to Alpaca API
    try {
      console.log(
        `[Alpaca] Attempting to fetch historical data for ${symbol}...`,
      );
      const result = await this.getHistoricalDataFromAlpaca(
        symbol,
        period1,
        period2,
        interval,
      );
      if (
        result.success &&
        result.data?.quotes &&
        result.data.quotes.length > 0
      ) {
        console.log(
          `[Alpaca] Successfully fetched ${result.data.quotes.length} bars for ${symbol}`,
        );
        return {
          ...result,
          source: "alpaca",
        };
      }
      console.log(`[Alpaca] Returned no data for ${symbol}`);
    } catch (alpacaError: any) {
      console.log(
        `[Alpaca] API fallback failed for ${symbol}: ${alpacaError.message}`,
      );
    }

    // Final fallback: Yahoo Finance requires no API key, so this keeps
    // historical data working even when Finnhub/Alpaca aren't configured.
    // Yahoo's historical() endpoint only supports daily/weekly/monthly bars.
    const yahooInterval = mapIntervalToYahoo(interval);
    if (yahooInterval) {
      try {
        console.log(`[Yahoo] Attempting to fetch historical data for ${symbol}...`);
        const result = await yahooFinance.getHistorical(symbol, {
          period1,
          period2,
          interval: yahooInterval,
        });

        if (result.success && result.data && result.data.length > 0) {
          const quotes: FinnhubQuoteData[] = result.data.map((bar: any) => ({
            date: new Date(bar.date),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
          }));

          console.log(
            `[Yahoo] Successfully fetched ${quotes.length} bars for ${symbol}`,
          );

          return {
            success: true,
            symbol,
            source: "yahoo",
            data: {
              quotes,
              meta: {
                symbol,
                exchangeName: "US",
                regularMarketPrice: quotes[quotes.length - 1].close,
              },
            },
            meta: {
              symbol,
              regularMarketPrice: quotes[quotes.length - 1].close,
            },
          };
        }
        console.log(`[Yahoo] Returned no data for ${symbol}`);
      } catch (yahooError: any) {
        console.log(`[Yahoo] API fallback failed for ${symbol}: ${yahooError.message}`);
      }
    }

    console.error(
      `[Historical] Failed to fetch data for ${symbol} from Finnhub, Alpaca, and Yahoo Finance`,
    );

    return {
      success: false,
      error:
        "Failed to fetch historical data from Finnhub, Alpaca, and Yahoo Finance.",
    };
  }

  /**
   * Get historical data from Alpaca API (fallback)
   * Tries direct HTTP API first (more reliable), then falls back to SDK
   */
  private async getHistoricalDataFromAlpaca(
    symbol: string,
    period1: string | Date,
    period2: string | Date,
    interval: string = "1d",
  ): Promise<HistoricalDataResponse> {
    // Map interval to Alpaca timeframe format
    const timeframe = mapIntervalToAlpacaTimeframe(interval);

    const startDate = typeof period1 === "string" ? new Date(period1) : period1;
    const endDate = typeof period2 === "string" ? new Date(period2) : period2;

    // Try direct HTTP API first (more reliable than SDK)
    try {
      const result = await this.getHistoricalDataFromAlpacaHttp(
        symbol,
        startDate,
        endDate,
        timeframe,
      );
      if (
        result.success &&
        result.data?.quotes &&
        result.data.quotes.length > 0
      ) {
        console.log(
          `Alpaca HTTP API succeeded for ${symbol}: ${result.data.quotes.length} bars`,
        );
        return result;
      }
      console.log(`Alpaca HTTP API returned no data for ${symbol}`);
    } catch (httpError: any) {
      console.log(`Alpaca HTTP API failed for ${symbol}: ${httpError.message}`);
    }

    // Fallback to SDK method
    try {
      const alpaca = createAlpacaClient();

      console.log(
        `Trying Alpaca SDK for ${symbol} from ${formatDateYYYYMMDD(startDate)} to ${formatDateYYYYMMDD(endDate)}`,
      );

      const bars = alpaca.getBarsV2(symbol.toUpperCase(), {
        start: formatDateYYYYMMDD(startDate),
        end: formatDateYYYYMMDD(endDate),
        timeframe,
        feed: "iex",
      });

      const quotes: FinnhubQuoteData[] = [];
      for await (const bar of bars) {
        // Handle both SDK format (PascalCase) and raw format (lowercase)
        const barData = bar as any;
        const timestamp = barData.Timestamp || barData.t;
        const open = barData.OpenPrice ?? barData.o;
        const high = barData.HighPrice ?? barData.h;
        const low = barData.LowPrice ?? barData.l;
        const close = barData.ClosePrice ?? barData.c;
        const volume = barData.Volume ?? barData.v;

        if (timestamp && open !== undefined) {
          quotes.push({
            date: new Date(timestamp),
            open,
            high,
            low,
            close,
            volume,
          });
        }
      }

      if (quotes.length > 0) {
        console.log(
          `Alpaca SDK succeeded for ${symbol}: ${quotes.length} bars`,
        );
        return {
          success: true,
          symbol,
          data: {
            quotes,
            meta: {
              symbol,
              exchangeName: "US",
              regularMarketPrice: quotes[quotes.length - 1].close,
            },
          },
          meta: {
            symbol,
            exchangeName: "US",
            regularMarketPrice: quotes[quotes.length - 1].close,
          },
        };
      }
      console.log(`Alpaca SDK returned no data for ${symbol}`);
    } catch (sdkError: any) {
      console.log(`Alpaca SDK failed for ${symbol}: ${sdkError.message}`);
    }

    return {
      success: false,
      symbol,
      data: { quotes: [], meta: { symbol } },
    };
  }

  /**
   * Direct HTTP API call to Alpaca Market Data API
   * Supports pagination for large date ranges (e.g., 5 years of data)
   */
  private async getHistoricalDataFromAlpacaHttp(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string,
  ): Promise<HistoricalDataResponse> {
    // Check multiple environment variable names for API credentials
    const { apiKey, secretKey } = getAlpacaCredentials();

    if (!apiKey || !secretKey) {
      throw new Error(
        "Alpaca API credentials not configured. Set ALPACA_API_KEY and ALPACA_SECRET environment variables.",
      );
    }

    // Collect all bars with pagination support
    const allBars: any[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;
    const maxPages = 50; // Safety limit to prevent infinite loops

    // Try 'sip' feed first (more historical data), fallback to 'iex' if not available
    const feeds = ["iex", "sip"];
    let lastError: Error | null = null;

    for (const feed of feeds) {
      allBars.length = 0; // Reset bars for each feed attempt
      nextPageToken = null;
      pageCount = 0;

      try {
        do {
          const url = new URL(
            `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars`,
          );
          url.searchParams.set("start", formatDateRFC3339(startDate));
          url.searchParams.set("end", formatDateRFC3339(endDate));
          url.searchParams.set("timeframe", timeframe);
          url.searchParams.set("feed", feed);
          url.searchParams.set("limit", "10000");
          url.searchParams.set("adjustment", "split"); // Adjust for stock splits

          if (nextPageToken) {
            url.searchParams.set("page_token", nextPageToken);
          }

          if (pageCount === 0) {
            console.log(
              `[Alpaca HTTP] Requesting ${symbol} with ${feed} feed: ${url.toString().replace(/apikey=[^&]+/gi, "apikey=***")}`,
            );
          }

          const response = await fetch(url.toString(), {
            headers: {
              "APCA-API-KEY-ID": apiKey,
              "APCA-API-SECRET-KEY": secretKey,
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            const errorText = await response.text();
            // If subscription issue (403), try next feed
            if (response.status === 403 && feed === "sip") {
              console.log(
                `[Alpaca HTTP] SIP feed not available (subscription required), trying IEX...`,
              );
              throw new Error("SIP_NOT_AVAILABLE");
            }
            console.error(
              `[Alpaca HTTP] Error response: ${response.status} ${response.statusText} - ${errorText}`,
            );
            throw new Error(
              `Alpaca API error: ${response.status} ${response.statusText} - ${errorText}`,
            );
          }

          const data = await response.json();
          //@ts-ignore
          const bars = data.bars || [];

          if (Array.isArray(bars)) {
            allBars.push(...bars);
          }
          //@ts-ignore
          nextPageToken = data.next_page_token || null;
          pageCount++;

          if (nextPageToken) {
            console.log(
              `[Alpaca HTTP] Page ${pageCount}: fetched ${bars.length} bars, more pages available...`,
            );
          }
        } while (nextPageToken && pageCount < maxPages);

        // If we got data, break out of feed loop
        if (allBars.length > 0) {
          console.log(
            `[Alpaca HTTP] Successfully fetched ${allBars.length} bars for ${symbol} using ${feed} feed (${pageCount} page(s))`,
          );
          break;
        }
      } catch (feedError: any) {
        if (feedError.message === "SIP_NOT_AVAILABLE") {
          continue; // Try next feed
        }
        lastError = feedError;
        console.log(
          `[Alpaca HTTP] ${feed} feed failed for ${symbol}: ${feedError.message}`,
        );
      }
    }

    if (allBars.length === 0) {
      console.log(`[Alpaca HTTP] No data returned for ${symbol} from any feed`);
      if (lastError) {
        throw lastError;
      }
      return {
        success: true,
        symbol,
        data: { quotes: [], meta: { symbol } },
        meta: { symbol },
      };
    }

    const quotes = allBars.map((bar: any) => ({
      date: new Date(bar.t),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));

    // Sort quotes by date (oldest first)
    quotes.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      success: true,
      symbol,
      data: {
        quotes,
        meta: {
          symbol,
          exchangeName: "US",
          regularMarketPrice:
            quotes.length > 0 ? quotes[quotes.length - 1].close : null,
        },
      },
      meta: {
        symbol,
        exchangeName: "US",
        regularMarketPrice:
          quotes.length > 0 ? quotes[quotes.length - 1].close : null,
      },
    };
  }

  /**
   * Get quote summary for a symbol
   */
  async getQuote(options: QuoteOptions): Promise<FinnhubQuoteSummaryResponse> {
    const { symbol } = options;

    try {
      // Fetch quote, profile, and metrics in parallel
      const [quote, profile, metrics] = await Promise.all([
        finnhubFetch<FinnhubQuote>("/quote", { symbol: symbol.toUpperCase() }),
        finnhubFetch<FinnhubProfile>("/stock/profile2", {
          symbol: symbol.toUpperCase(),
        }).catch(() => null),
        finnhubFetch<FinnhubMetrics>("/stock/metric", {
          symbol: symbol.toUpperCase(),
          metric: "all",
        }).catch(() => null),
      ]);

      // Transform to Yahoo Finance-like structure
      const data: FinnhubQuoteResponse = {
        price: {
          regularMarketPrice: quote.c,
          regularMarketChange: quote.d,
          regularMarketChangePercent: quote.dp,
          regularMarketDayHigh: quote.h,
          regularMarketDayLow: quote.l,
          regularMarketOpen: quote.o,
          regularMarketPreviousClose: quote.pc,
          regularMarketTime: new Date(quote.t * 1000),
        },
        summaryDetail: {
          previousClose: quote.pc,
          open: quote.o,
          dayHigh: quote.h,
          dayLow: quote.l,
          regularMarketVolume:
            metrics?.metric?.["10DayAverageTradingVolume"] || null,
          fiftyTwoWeekHigh: metrics?.metric?.["52WeekHigh"] || null,
          fiftyTwoWeekLow: metrics?.metric?.["52WeekLow"] || null,
          trailingPE: metrics?.metric?.peBasicExclExtraTTM || null,
          dividendYield: metrics?.metric?.dividendYieldIndicatedAnnual
            ? metrics.metric.dividendYieldIndicatedAnnual / 100
            : null,
          beta: metrics?.metric?.beta || null,
        },
        defaultKeyStatistics: {
          priceToBook: metrics?.metric?.pbAnnual || null,
          enterpriseValue: null,
          forwardPE: null,
          pegRatio: null,
          beta: metrics?.metric?.beta || null,
          sharesOutstanding: profile?.shareOutstanding
            ? profile.shareOutstanding * 1e6
            : null,
        },
        financialData: {
          currentPrice: quote.c,
          targetHighPrice: null,
          targetLowPrice: null,
          targetMeanPrice: null,
          targetMedianPrice: null,
          recommendationMean: null,
          recommendationKey: null,
          numberOfAnalystOpinions: null,
          totalCash: null,
          totalDebt: null,
          totalRevenue: null,
          returnOnEquity: metrics?.metric?.roeTTM
            ? metrics.metric.roeTTM / 100
            : null,
          returnOnAssets: metrics?.metric?.roaeTTM
            ? metrics.metric.roaeTTM / 100
            : null,
          profitMargins: metrics?.metric?.netProfitMarginTTM
            ? metrics.metric.netProfitMarginTTM / 100
            : null,
          operatingMargins: metrics?.metric?.operatingMarginTTM
            ? metrics.metric.operatingMarginTTM / 100
            : null,
          grossMargins: metrics?.metric?.grossMarginTTM
            ? metrics.metric.grossMarginTTM / 100
            : null,
          freeCashflow: null,
          operatingCashflow: null,
          revenueGrowth: metrics?.metric?.revenueGrowthTTMYoy
            ? metrics.metric.revenueGrowthTTMYoy / 100
            : null,
          earningsGrowth: metrics?.metric?.epsGrowthTTMYoy
            ? metrics.metric.epsGrowthTTMYoy / 100
            : null,
          currentRatio: metrics?.metric?.currentRatio || null,
          debtToEquity: metrics?.metric?.totalDebtToEquity || null,
        },
        summaryProfile: profile
          ? {
              industry: profile.finnhubIndustry,
              sector: profile.finnhubIndustry,
              website: profile.weburl,
              country: profile.country,
              fullTimeEmployees: null,
              longBusinessSummary: null,
            }
          : null,
      };

      // Add profile data
      if (profile) {
        data.price.currency = profile.currency;
        data.price.longName = profile.name;
        data.price.shortName = profile.name;
        data.price.marketCap = profile.marketCapitalization
          ? profile.marketCapitalization * 1e6
          : null;
        data.price.exchange = profile.exchange;
        data.summaryDetail.marketCap = profile.marketCapitalization
          ? profile.marketCapitalization * 1e6
          : null;
      }

      return {
        success: true,
        symbol,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch quote",
      };
    }
  }

  /**
   * Search for stocks by query
   */
  async search(query: string): Promise<FinnhubSearchResponse> {
    try {
      const result = await finnhubFetch<{ count: number; result: any[] }>(
        "/search",
        { q: query },
      );

      return {
        success: true,
        query,
        results: result.result.map((item: any) => ({
          symbol: item.symbol,
          shortname: item.description,
          exchange: item.type,
          quoteType: item.type,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to search",
      };
    }
  }

  /**
   * Get peer companies for a symbol
   */
  async getPeers(symbol: string): Promise<PeersResponse> {
    try {
      const peers = await finnhubFetch<string[]>("/stock/peers", {
        symbol: symbol.toUpperCase(),
      });

      return {
        success: true,
        symbol,
        peers: peers || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch peers",
      };
    }
  }

  /**
   * Get analyst recommendations for a symbol
   */
  async getRecommendations(symbol: string): Promise<RecommendationsResponse> {
    try {
      const recommendations = await finnhubFetch<any[]>(
        "/stock/recommendation",
        {
          symbol: symbol.toUpperCase(),
        },
      );

      // Transform to Yahoo Finance-like structure
      const data = {
        recommendationTrend: {
          trend: recommendations.map((rec) => ({
            period: rec.period,
            strongBuy: rec.strongBuy,
            buy: rec.buy,
            hold: rec.hold,
            sell: rec.sell,
            strongSell: rec.strongSell,
          })),
        },
      };

      return {
        success: true,
        symbol,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch recommendations",
      };
    }
  }

  /**
   * Get basic financials (metrics) for a symbol
   */
  async getFinancials(symbol: string): Promise<FinancialsResponse> {
    try {
      const metrics = await finnhubFetch<FinnhubMetrics>("/stock/metric", {
        symbol: symbol.toUpperCase(),
        metric: "all",
      });

      // Transform to Yahoo Finance-like structure
      const data = {
        earnings: {
          earningsChart: {},
          financialsChart: {},
        },
        incomeStatementHistory: {},
        balanceSheetHistory: {},
        cashflowStatementHistory: {},
        metrics: metrics.metric,
        series: metrics.series,
      };

      return {
        success: true,
        symbol,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch financials",
      };
    }
  }

  /**
   * Get company news
   */
  async getNews(
    symbol: string,
    from?: string,
    to?: string,
  ): Promise<NewsResponse> {
    try {
      const today = new Date();
      const defaultFrom = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const news = await finnhubFetch<any[]>("/company-news", {
        symbol: symbol.toUpperCase(),
        from: from || defaultFrom.toISOString().split("T")[0],
        to: to || today.toISOString().split("T")[0],
      });

      return {
        success: true,
        symbol,
        news: news.map((item) => ({
          title: item.headline,
          link: item.url,
          publisher: item.source,
          publishedAt: new Date(item.datetime * 1000),
          summary: item.summary,
          image: item.image,
          category: item.category,
          related: item.related,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch news",
      };
    }
  }

  /**
   * Get forex rates
   */
  async getForexRate(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<ForexResponse> {
    try {
      // Finnhub uses different endpoint for forex
      const rates = await finnhubFetch<{
        base: string;
        quote: { [key: string]: number };
      }>("/forex/rates", {
        base: baseCurrency.toUpperCase(),
      });

      const rate = rates.quote[quoteCurrency.toUpperCase()];

      return {
        success: true,
        baseCurrency,
        quoteCurrency,
        rate: rate || null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to fetch forex rate",
      };
    }
  }
}

// Export singleton instance
export const finnhub = new FinnhubWrapper();
