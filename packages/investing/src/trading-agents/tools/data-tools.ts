/**
 * Data Tools for TradingAgents
 * Functions to fetch stock data, indicators, news, and fundamentals
 */

import {
  StockData,
  TechnicalIndicators,
  FundamentalsData,
  NewsItem,
} from "../types";
import { yahooFinance } from "../../stocks/yahoo-finance-wrapper";

/**
 * Get historical stock data for a symbol
 */
export async function getStockData(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<StockData[]> {
  try {
    const result = await yahooFinance.getHistorical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!result.success || !result.data) {
      throw new Error(`Failed to fetch stock data for ${symbol}`);
    }

    // Handle both data.quotes array format (from Finnhub/Alpaca) and direct array format
    const quotes = Array.isArray(result.data)
      ? result.data
      : result.data.quotes;

    if (!quotes || !Array.isArray(quotes)) {
      throw new Error(`Invalid data format returned for ${symbol}`);
    }

    return quotes.map((d: any) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));
  } catch (error) {
    console.error("Error fetching stock data:", error);
    throw error;
  }
}

/**
 * Calculate technical indicators from stock data
 */
export async function getIndicators(
  stockData: StockData[],
  indicators: string[]
): Promise<TechnicalIndicators> {
  const result: TechnicalIndicators = {};

  const closes = stockData.map((d) => d.close);
  const highs = stockData.map((d) => d.high);
  const lows = stockData.map((d) => d.low);
  const volumes = stockData.map((d) => d.volume);

  for (const indicator of indicators) {
    switch (indicator.toLowerCase()) {
      case "close_50_sma":
      case "sma50":
        result.sma50 = calculateSMA(closes, 50);
        break;
      case "close_200_sma":
      case "sma200":
        result.sma200 = calculateSMA(closes, 200);
        break;
      case "close_10_ema":
      case "ema10":
        result.ema10 = calculateEMA(closes, 10);
        break;
      case "rsi":
        result.rsi = calculateRSI(closes, 14);
        break;
      case "macd":
        const macdData = calculateMACD(closes);
        result.macd = macdData.macd;
        result.macdSignal = macdData.signal;
        result.macdHistogram = macdData.histogram;
        break;
      case "boll":
      case "bollinger":
        const bollData = calculateBollingerBands(closes, 20, 2);
        result.bollingerUpper = bollData.upper;
        result.bollingerMiddle = bollData.middle;
        result.bollingerLower = bollData.lower;
        break;
      case "atr":
        result.atr = calculateATR(highs, lows, closes, 14);
        break;
      case "vwma":
        result.vwma = calculateVWMA(closes, volumes, 20);
        break;
    }
  }

  return result;
}

/**
 * Get fundamentals data for a symbol
 */
export async function getFundamentals(
  symbol: string
): Promise<FundamentalsData> {
  try {
    const response = await fetch(`/api/stocks/quote/${symbol}`);
    if (!response.ok) {
      throw new Error("Failed to fetch fundamentals");
    }

    const data = await response.json();
    return {
      marketCap: data.marketCap,
      peRatio: data.peRatio,
      dividendYield: data.dividendYield,
      eps: data.eps,
      revenue: data.revenue,
      profitMargin: data.profitMargin,
    };
  } catch (error) {
    console.error("Error fetching fundamentals:", error);
    throw error;
  }
}

/**
 * Get news articles for a symbol
 */
export async function getNews(
  symbol: string,
  limit: number = 10
): Promise<NewsItem[]> {
  try {
    // This would integrate with a news API
    // For now, return empty array as placeholder
    return [];
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

// ============================================================================
// Technical Indicator Calculation Functions
// ============================================================================

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for the first value
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(...Array(period - 1).fill(NaN));
  result.push(ema);

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

function calculateRSI(data: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const avgGain =
        gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss =
        losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      result.push(rsi);
    }
  }

  result.unshift(NaN); // Add NaN for the first price point
  return result;
}

function calculateMACD(data: number[]): {
  macd: number[];
  signal: number[];
  histogram: number[];
} {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const macd = ema12.map((val, i) => val - ema26[i]);
  const signal = calculateEMA(
    macd.filter((v) => !isNaN(v)),
    9
  );

  // Pad signal to match macd length
  const paddedSignal = [
    ...Array(macd.length - signal.length).fill(NaN),
    ...signal,
  ];
  const histogram = macd.map((val, i) => val - paddedSignal[i]);

  return { macd, signal: paddedSignal, histogram };
}

function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const middle = calculateSMA(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const highLow = highs[i] - lows[i];
    const highClose = Math.abs(highs[i] - closes[i - 1]);
    const lowClose = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(highLow, highClose, lowClose));
  }

  result.push(NaN); // First value is always NaN

  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const atr =
        trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) /
        period;
      result.push(atr);
    }
  }

  return result;
}

function calculateVWMA(
  prices: number[],
  volumes: number[],
  period: number = 20
): number[] {
  const result: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const priceSlice = prices.slice(i - period + 1, i + 1);
      const volumeSlice = volumes.slice(i - period + 1, i + 1);
      const sumPriceVolume = priceSlice.reduce(
        (sum, price, idx) => sum + price * volumeSlice[idx],
        0
      );
      const sumVolume = volumeSlice.reduce((a, b) => a + b, 0);
      result.push(sumPriceVolume / sumVolume);
    }
  }

  return result;
}
