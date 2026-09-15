/**
 * Greeks Metrics Calculator for Binary Prediction Markets
 * Uses binary options formulas adapted for prediction markets
 * where price = probability and payoff is 0 or 1
 */

import { createChildLogger } from "../../utils/logger";
import { getPool } from "../../db/client";
import type { Enricher, Signal, GreeksMetrics } from "../types";

const logger = createChildLogger("greeks");

// ============================================
// Normal Distribution Helpers
// ============================================

/**
 * Standard normal probability density function (PDF)
 * φ(x) = e^(-x²/2) / √(2π)
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Inverse cumulative normal distribution (probit function)
 * Uses Abramowitz & Stegun rational approximation
 * Accurate to ~10^-8 for 0.0001 < p < 0.9999
 */
function normalCDFInverse(p: number): number {
  // Clamp to avoid infinity at 0 or 1
  const clamped = Math.max(0.0001, Math.min(0.9999, p));

  // Coefficients for rational approximation
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (clamped < pLow) {
    // Lower tail
    q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  } else if (clamped <= pHigh) {
    // Central region
    q = clamped - 0.5;
    r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  } else {
    // Upper tail
    q = Math.sqrt(-2 * Math.log(1 - clamped));
    return (
      -(
        ((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!
      ) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
}

// ============================================
// Greeks Calculations
// ============================================

/**
 * Calculate theta (time decay) for a binary option
 * Theta = -σ * φ(d) / (2√T)
 * where d = Φ⁻¹(P) and T is in years
 *
 * Returns theta in cents per day (negative = decaying value)
 */
function calculateTheta(
  price: number,
  yearsToExpiry: number,
  annualizedVol: number,
): number {
  if (yearsToExpiry <= 0 || annualizedVol <= 0) return 0;

  const d = normalCDFInverse(price);
  const phi = normalPDF(d);

  // Binary option theta formula (in probability units per year)
  const thetaPerYear = (-annualizedVol * phi) / (2 * Math.sqrt(yearsToExpiry));

  // Convert to cents per day: multiply by 100 (to cents) and divide by 365 (per day)
  const thetaPerDay = (thetaPerYear * 100) / 365;

  return thetaPerDay;
}

/**
 * Calculate vega (volatility sensitivity) for a binary option
 * Vega = φ(d) * √T
 *
 * Returns sensitivity of price to 1% change in volatility
 */
function calculateVega(price: number, yearsToExpiry: number): number {
  if (yearsToExpiry <= 0) return 0;

  const d = normalCDFInverse(price);
  const phi = normalPDF(d);

  return phi * Math.sqrt(yearsToExpiry);
}

/**
 * Calculate uncertainty measure P*(1-P)
 * Maximum at P=50%, zero at P=0% or P=100%
 */
function calculateUncertainty(price: number): number {
  return price * (1 - price);
}

/**
 * Fetch and calculate annualized historical volatility from price_snapshots
 * Returns volatility as a decimal (e.g., 0.85 = 85%)
 */
async function calculateHistoricalVolatility(tokenId: string): Promise<number> {
  const client = getPool();

  try {
    // Get price snapshots from last 7 days for volatility calculation
    // Calculate daily returns and annualize
    const result = await client.query(
      `
      WITH daily_prices AS (
        SELECT
          DATE(timestamp) as date,
          AVG(price) as avg_price
        FROM price_snapshots
        WHERE token_id = $1
          AND timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(timestamp)
        ORDER BY date
      ),
      returns AS (
        SELECT
          (avg_price - LAG(avg_price) OVER (ORDER BY date)) /
          NULLIF(LAG(avg_price) OVER (ORDER BY date), 0) as daily_return
        FROM daily_prices
      )
      SELECT
        COALESCE(STDDEV(daily_return), 0) as daily_vol,
        COUNT(*) as sample_count
      FROM returns
      WHERE daily_return IS NOT NULL
    `,
      [tokenId],
    );

    const row = result.rows[0] as
      | { daily_vol: string | number; sample_count: string | number }
      | undefined;
    const dailyVol = Number(row?.daily_vol) || 0;
    const sampleCount = Number(row?.sample_count) || 0;

    // Annualize: multiply by √365
    const annualizedVol = dailyVol * Math.sqrt(365);

    logger.debug(
      { tokenId, dailyVol, annualizedVol, sampleCount },
      "Calculated historical volatility",
    );

    // If we don't have enough data, return a reasonable default (50% annual vol)
    if (sampleCount < 3) {
      return 0.5;
    }

    // Cap at reasonable bounds (10% to 300% annual)
    return Math.max(0.1, Math.min(3.0, annualizedVol));
  } catch (error) {
    logger.error({ err: error, tokenId }, "Failed to calculate volatility");
    return 0.5; // Default to 50% annual vol on error
  }
}

/**
 * Calculate all Greeks metrics for a signal
 */
export async function calculateGreeks(
  currentPrice: number,
  tokenId: string,
  endDate: Date | null,
): Promise<GreeksMetrics> {
  // Calculate time to expiry in years
  const now = new Date();
  const daysToExpiry = endDate
    ? Math.max(0, (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 365; // Default to 1 year if no end date
  const yearsToExpiry = daysToExpiry / 365;

  // Fetch historical volatility
  const impliedVol = await calculateHistoricalVolatility(tokenId);

  // Calculate Greeks
  const theta = calculateTheta(currentPrice, yearsToExpiry, impliedVol);
  const vega = calculateVega(currentPrice, yearsToExpiry);
  const uncertainty = calculateUncertainty(currentPrice);

  return {
    theta,
    vega,
    impliedVol,
    uncertainty,
    daysToExpiry,
  };
}

// ============================================
// Enricher Implementation
// ============================================

/**
 * Greeks Enricher for the enrichment pipeline
 * Calculates binary options-style Greeks for each signal
 */
export const greeksEnricher: Enricher = {
  name: "greeks",

  async enrich(signal: Signal): Promise<Signal> {
    const { movement } = signal;

    try {
      const greeks = await calculateGreeks(
        movement.priceAfter,
        movement.tokenId,
        movement.market.endDate,
      );

      logger.debug(
        {
          marketId: movement.marketId,
          theta: greeks.theta.toFixed(3),
          vega: greeks.vega.toFixed(3),
          impliedVol: (greeks.impliedVol * 100).toFixed(1),
        },
        "Calculated Greeks",
      );

      return {
        ...signal,
        enrichments: {
          ...signal.enrichments,
          greeks,
        },
      };
    } catch (error) {
      logger.error(
        { err: error, marketId: movement.marketId },
        "Failed to calculate Greeks",
      );
      return signal;
    }
  },
};
