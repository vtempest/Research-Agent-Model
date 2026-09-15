/**
 * Yahoo Finance 2 Wrapper
 * Full-featured wrapper around yahoo-finance2 library
 * Supports: quote, quoteSummary, chart, historical, search, options, recommendations, and more
 */

import YahooFinance from "yahoo-finance2";

// Create singleton instance of YahooFinance
const yf = new YahooFinance();

/**
 * A single row of historical price data, shaped like the rows the deprecated
 * `yahooFinance.historical()` helper used to return.
 */
export interface HistoricalRow {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Convert `chart()` quotes into historical-style rows.
 *
 * Yahoo regularly returns rows where only some of the OHLCV fields are
 * populated (the in-progress session, halted symbols, dividend/split
 * timestamps). The deprecated `historical()` helper throws on those rows;
 * here we drop rows with no usable price at all and backfill the remaining
 * gaps from the fields that are present.
 */
export function normalizeChartQuotes(quotes: any[] | undefined): HistoricalRow[] {
  if (!Array.isArray(quotes)) return [];

  const rows: HistoricalRow[] = [];

  for (const quote of quotes) {
    if (!quote) continue;

    const date =
      quote.date instanceof Date ? quote.date : new Date(quote.date as any);
    if (Number.isNaN(date.getTime())) continue;

    const close = toFiniteNumber(quote.close);
    const open = toFiniteNumber(quote.open);
    const high = toFiniteNumber(quote.high);
    const low = toFiniteNumber(quote.low);
    const adjClose = toFiniteNumber(quote.adjclose ?? quote.adjClose);

    // Fall back to any price we do have, so a partially filled row is still
    // usable rather than being dropped entirely.
    const reference = close ?? open ?? adjClose ?? high ?? low;
    if (reference === null) continue; // No usable price data in this row

    rows.push({
      date,
      open: open ?? reference,
      high: high ?? Math.max(open ?? reference, close ?? reference),
      low: low ?? Math.min(open ?? reference, close ?? reference),
      close: close ?? reference,
      adjClose: adjClose ?? close ?? reference,
      volume: toFiniteNumber(quote.volume) ?? 0,
    });
  }

  return rows;
}

/**
 * Yahoo Finance Wrapper Class
 * Provides a comprehensive API for stock market data
 */
export class YahooFinanceWrapper {
  constructor() {
    // Using the singleton yf instance created above
  }

  /**
   * Get real-time quote for a symbol
   * @param symbol - Stock symbol (e.g., "AAPL", "TSLA")
   * @param options - Additional quote options
   */
  async getQuote(symbol: string, options?: any) {
    try {
      const quote = await yf.quoteCombine(symbol, options);
      return {
        success: true,
        data: quote,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance quote error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch quote",
      };
    }
  }

  /**
   * Get multiple quotes at once
   * @param symbols - Array of stock symbols
   */
  async getQuotes(symbols: string[]) {
    try {
      const quotes = await Promise.all(
        symbols.map((symbol) => yf.quoteCombine(symbol)),
      );
      return {
        success: true,
        data: quotes,
      };
    } catch (error: any) {
      console.error("Yahoo Finance quotes error:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch quotes",
      };
    }
  }

  /**
   * Get historical price data
   *
   * Implemented on top of `chart()` rather than the deprecated `historical()`
   * helper. `historical()` throws ("Historical returned a result with SOME
   * (but not all) null values") whenever Yahoo returns a partially populated
   * row - which happens regularly for the in-progress trading session, for
   * halted symbols and around dividend/split timestamps. We normalize those
   * rows here instead of failing the whole request.
   *
   * @param symbol - Stock symbol
   * @param options - Historical data options (period1, period2, interval)
   */
  async getHistorical(
    symbol: string,
    options?: {
      period1: Date | string | number;
      period2?: Date | string | number;
      interval?: "1d" | "1wk" | "1mo";
    },
  ) {
    try {
      const period1 =
        options?.period1 ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const period2 = options?.period2 ?? new Date();
      const interval = options?.interval || "1d";

      const chart = await yf.chart(
        symbol,
        { period1, period2, interval },
        { validateResult: false },
      );

      const data = normalizeChartQuotes(chart?.quotes);

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(
        `Yahoo Finance historical error for ${symbol}:`,
        error?.message || error,
      );
      return {
        success: false,
        error: error.message || "Failed to fetch historical data",
      };
    }
  }

  /**
   * Get chart data (more flexible than historical)
   * @param symbol - Stock symbol
   * @param options - Chart options
   */
  async getChart(
    symbol: string,
    options?: {
      period1: Date | string | number;
      period2?: Date | string | number;
      interval?: "1m" | "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo";
    },
  ) {
    try {
      const data = await yf.chart(symbol, {
        period1:
          options?.period1 || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        period2: options?.period2 || new Date(),
        interval: options?.interval || "1d",
      });
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance chart error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch chart data",
      };
    }
  }

  /**
   * Get comprehensive quote summary with modules
   * Modules: assetProfile, balanceSheetHistory, cashflowStatementHistory,
   * defaultKeyStatistics, earnings, financialData, incomeStatementHistory, etc.
   */
  async getQuoteSummary(symbol: string, modules?: string[]) {
    try {
      const defaultModules = modules || [
        "assetProfile",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "calendarEvents",
        "recommendationTrend",
        "earnings",
        "earningsTrend",
      ];

      const data = await yf.quoteSummary(symbol, {
        modules: defaultModules as any,
      });

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance quoteSummary error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch quote summary",
      };
    }
  }

  /**
   * Search for stocks by query
   * @param query - Search query (company name or symbol)
   */
  async search(
    query: string,
    options?: { quotesCount?: number; newsCount?: number },
  ) {
    try {
      const data = await yf.search(query, {
        quotesCount: options?.quotesCount || 10,
        newsCount: options?.newsCount || 5,
      });
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance search error for "${query}":`, error);
      return {
        success: false,
        error: error.message || "Failed to search",
      };
    }
  }

  /**
   * Get options data (calls and puts)
   * @param symbol - Stock symbol
   * @param date - Expiration date (optional)
   */
  async getOptions(symbol: string, date?: Date) {
    try {
      const data = await yf.options(symbol, date ? { date } : undefined);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance options error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch options data",
      };
    }
  }

  /**
   * Get analyst recommendations
   * @param symbol - Stock symbol
   */
  async getRecommendations(symbol: string) {
    try {
      const data = await yf.recommendationsBySymbol(symbol);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(
        `Yahoo Finance recommendations error for ${symbol}:`,
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to fetch recommendations",
      };
    }
  }

  /**
   * Get trending symbols
   * @param region - Region code (e.g., "US", "GB", "JP")
   */
  async getTrending(region: string = "US") {
    try {
      const data = await yf.trendingSymbols(region);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance trending error for ${region}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch trending symbols",
      };
    }
  }

  /**
   * Get insights (company insights and recommendations)
   * @param symbol - Stock symbol
   */
  async getInsights(symbol: string) {
    try {
      const data = await yf.insights(symbol);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance insights error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch insights",
      };
    }
  }

  /**
   * Get fundamentals time series data
   * @param symbol - Stock symbol
   * @param options - Fundamentals options
   */
  async getFundamentalsTimeSeries(
    symbol: string,
    options?: {
      period1?: Date | string;
      period2?: Date | string;
      type?: string;
    },
  ) {
    try {
      const data = await yf.fundamentalsTimeSeries(symbol, options as any);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error(
        `Yahoo Finance fundamentalsTimeSeries error for ${symbol}:`,
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to fetch fundamentals time series",
      };
    }
  }

  /**
   * Use stock screener to find stocks matching criteria
   * @param options - Screener options
   */
  async screener(options: any) {
    try {
      const data = await yf.screener(options);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error("Yahoo Finance screener error:", error);
      return {
        success: false,
        error: error.message || "Failed to run screener",
      };
    }
  }

  /**
   * Get company profile and financial data
   * @param symbol - Stock symbol
   */
  async getCompanyProfile(symbol: string) {
    try {
      const data = await yf.quoteSummary(symbol, {
        modules: ["assetProfile", "summaryProfile"] as any,
      });
      return {
        success: true,
        data: {
          assetProfile: data.assetProfile,
          summaryProfile: data.summaryProfile,
        },
      };
    } catch (error: any) {
      console.error(
        `Yahoo Finance company profile error for ${symbol}:`,
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to fetch company profile",
      };
    }
  }

  /**
   * Get financial statements
   * @param symbol - Stock symbol
   */
  async getFinancialStatements(symbol: string) {
    try {
      const data = await yf.quoteSummary(symbol, {
        modules: [
          "incomeStatementHistory",
          "incomeStatementHistoryQuarterly",
          "balanceSheetHistory",
          "balanceSheetHistoryQuarterly",
          "cashflowStatementHistory",
          "cashflowStatementHistoryQuarterly",
        ] as any,
      });
      return {
        success: true,
        data: {
          incomeStatement: data.incomeStatementHistory,
          incomeStatementQuarterly: data.incomeStatementHistoryQuarterly,
          balanceSheet: data.balanceSheetHistory,
          balanceSheetQuarterly: data.balanceSheetHistoryQuarterly,
          cashFlow: data.cashflowStatementHistory,
          cashFlowQuarterly: data.cashflowStatementHistoryQuarterly,
        },
      };
    } catch (error: any) {
      console.error(
        `Yahoo Finance financial statements error for ${symbol}:`,
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to fetch financial statements",
      };
    }
  }

  /**
   * Get key statistics
   * @param symbol - Stock symbol
   */
  async getKeyStatistics(symbol: string) {
    try {
      const data = await yf.quoteSummary(symbol, {
        modules: ["defaultKeyStatistics", "summaryDetail"] as any,
      });
      return {
        success: true,
        data: {
          keyStatistics: data.defaultKeyStatistics,
          summaryDetail: data.summaryDetail,
        },
      };
    } catch (error: any) {
      console.error(`Yahoo Finance key statistics error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch key statistics",
      };
    }
  }

  /**
   * Get earnings data
   * @param symbol - Stock symbol
   */
  async getEarnings(symbol: string) {
    try {
      const data = await yf.quoteSummary(symbol, {
        modules: [
          "earnings",
          "earningsHistory",
          "earningsTrend",
          "calendarEvents",
        ] as any,
      });
      return {
        success: true,
        data: {
          earnings: data.earnings,
          earningsHistory: data.earningsHistory,
          earningsTrend: data.earningsTrend,
          calendarEvents: data.calendarEvents,
        },
      };
    } catch (error: any) {
      console.error(`Yahoo Finance earnings error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch earnings data",
      };
    }
  }

  /**
   * Get ownership data (institutional and insider)
   * @param symbol - Stock symbol
   */
  async getOwnership(symbol: string) {
    try {
      const data = await yf.quoteSummary(symbol, {
        modules: [
          "institutionOwnership",
          "fundOwnership",
          "insiderHolders",
          "insiderTransactions",
          "majorHoldersBreakdown",
        ] as any,
      });
      return {
        success: true,
        data: {
          institutionOwnership: data.institutionOwnership,
          fundOwnership: data.fundOwnership,
          insiderHolders: data.insiderHolders,
          insiderTransactions: data.insiderTransactions,
          majorHoldersBreakdown: data.majorHoldersBreakdown,
        },
      };
    } catch (error: any) {
      console.error(`Yahoo Finance ownership error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch ownership data",
      };
    }
  }

  /**
   * Get SEC filings
   * @param symbol - Stock symbol
   */
  async getSECFilings(symbol: string) {
    try {
      const data = await yf.quoteSummary(symbol, {
        modules: ["secFilings"] as any,
      });
      return {
        success: true,
        data: data.secFilings,
      };
    } catch (error: any) {
      console.error(`Yahoo Finance SEC filings error for ${symbol}:`, error);
      return {
        success: false,
        error: error.message || "Failed to fetch SEC filings",
      };
    }
  }

  /**
   * Get multiple data points at once for comprehensive analysis
   * @param symbol - Stock symbol
   */
  async getComprehensiveData(symbol: string) {
    try {
      const [quote, quoteSummary, historical, recommendations] =
        await Promise.all([
          this.getQuote(symbol),
          this.getQuoteSummary(symbol),
          this.getHistorical(symbol, {
            period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          }),
          this.getRecommendations(symbol),
        ]);

      return {
        success: true,
        data: {
          quote: quote.data,
          summary: quoteSummary.data,
          historical: historical.data,
          recommendations: recommendations.data,
        },
      };
    } catch (error: any) {
      console.error(
        `Yahoo Finance comprehensive data error for ${symbol}:`,
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to fetch comprehensive data",
      };
    }
  }
}

// Export singleton instance
export const yahooFinanceWrapper = new YahooFinanceWrapper();

// Export alias for convenience
export const yahooFinance = yahooFinanceWrapper;

// Export default
export default yahooFinanceWrapper;
