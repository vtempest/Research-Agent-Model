/**
 * Pragmatic Currency Normalization for International Stock Analysis
 * JavaScript port of Python fx_normalization.py
 *
 * PHILOSOPHY:
 * - Only normalize metrics that are COMPARED across borders
 * - Leave ratios and percentages alone
 * - Use simple, robust fallback chain
 * - Don't try to be a forex platform - just good enough for research
 */

import yahooFinance from 'yahoo-finance2';

// Fallback rates to USD (updated Dec 2025)
const FALLBACK_RATES_TO_USD = {
  // Major Asian currencies
  JPY: 0.0067,   // ¥150 = $1
  HKD: 0.128,    // HK$7.80 = $1
  TWD: 0.032,    // NT$31 = $1
  KRW: 0.00075,  // ₩1,330 = $1
  CNY: 0.14,     // ¥7.2 = $1
  INR: 0.012,    // ₹83 = $1
  SGD: 0.74,     // S$1.35 = $1

  // European currencies
  EUR: 1.09,
  GBP: 1.27,
  CHF: 1.13,

  // Other major currencies
  CAD: 0.72,
  AUD: 0.64,
  NZD: 0.60,
  MXN: 0.049,
  BRL: 0.20,

  // Identity
  USD: 1.0,
};

/**
 * Get live FX rate from yahoo-finance2
 */
export async function getFxRateYahooFinance(fromCurrency, toCurrency = 'USD') {
  if (fromCurrency === toCurrency) {
    return 1.0;
  }

  // yahoo-finance2 forex ticker format: "JPYUSD=X"
  const fxTicker = `${fromCurrency}${toCurrency}=X`;

  try {
    const quote = await yahooFinance.quote(fxTicker, {
      timeout: 3000,
    });

    const rate = quote.regularMarketPrice || quote.previousClose;

    if (rate && rate > 0) {
      console.debug(`FX rate fetched: ${fxTicker} = ${rate} (yfinance)`);
      return parseFloat(rate);
    }

    console.debug(`FX rate invalid: ${fxTicker}, rate: ${rate}`);
    return null;
  } catch (error) {
    console.debug(`FX rate fetch error: ${fxTicker}, ${error.message}`);
    return null;
  }
}

/**
 * Get FX rate from hardcoded fallback table
 */
export function getFxRateFallback(fromCurrency, toCurrency = 'USD') {
  if (fromCurrency === toCurrency) {
    return 1.0;
  }

  const rate = FALLBACK_RATES_TO_USD[fromCurrency];
  if (rate) {
    console.warn(
      `FX rate using fallback: ${fromCurrency} -> ${toCurrency} = ${rate} ` +
      `(Fallback rate may be stale - update FALLBACK_RATES_TO_USD quarterly)`
    );
    return rate;
  }

  return null;
}

/**
 * Get FX rate with smart fallback chain
 *
 * Fallback order:
 * 1. yahoo-finance2 (live rate, preferred)
 * 2. Hardcoded fallback (if allowFallback=true)
 * 3. null (graceful failure)
 *
 * @returns {Promise<[number|null, string]>} [rate, source]
 */
export async function getFxRate(fromCurrency, toCurrency = 'USD', allowFallback = true) {
  // Normalize currency codes
  fromCurrency = fromCurrency.trim().toUpperCase();
  toCurrency = toCurrency.trim().toUpperCase();

  // Identity case
  if (fromCurrency === toCurrency) {
    return [1.0, 'identity'];
  }

  // Try yahoo-finance2 first
  const rate = await getFxRateYahooFinance(fromCurrency, toCurrency);
  if (rate !== null) {
    return [rate, 'yfinance'];
  }

  // Try fallback rates if allowed
  if (allowFallback) {
    const fallbackRate = getFxRateFallback(fromCurrency, toCurrency);
    if (fallbackRate !== null) {
      return [fallbackRate, 'fallback'];
    }
  }

  // Total failure
  console.warn(
    `FX rate unavailable: ${fromCurrency} -> ${toCurrency} ` +
    `(tried: ${allowFallback ? 'yfinance, fallback' : 'yfinance'})`
  );
  return [null, 'unavailable'];
}

/**
 * Normalize a value to USD
 */
export async function normalizeToUsd(value, currency, metricName = 'value') {
  if (value === null || value === undefined) {
    return null;
  }

  if (currency === 'USD' || !currency) {
    return value;
  }

  const [rate, source] = await getFxRate(currency, 'USD');

  if (rate === null) {
    console.warn(`Cannot normalize ${metricName}: ${currency} rate unavailable`);
    return null;
  }

  const normalized = value * rate;
  console.debug(
    `Normalized ${metricName}: ${value} ${currency} -> $${normalized.toFixed(2)} (source: ${source})`
  );

  return normalized;
}

/**
 * Normalize market cap to USD
 */
export async function normalizeMarketCap(marketCap, currency) {
  return normalizeToUsd(marketCap, currency, 'market_cap');
}

/**
 * Normalize trading volume value to USD
 */
export async function normalizeVolume(volumeValue, currency) {
  return normalizeToUsd(volumeValue, currency, 'volume_value');
}
