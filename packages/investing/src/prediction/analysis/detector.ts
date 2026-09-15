/**
 * Price Movement Detection Engine
 * Detects unusual price movements using batch queries for efficiency
 */

import { createChildLogger } from "../../utils/logger";
import {
  getConfig,
  getPriceWindowsBatch,
  getMarketsInCooldown,
} from "../../db/client";
import { getCachedMarkets, getMarketById } from "../sync";
import { isMarketBlocked } from "../api/gamma";
import type { Market, PriceMovement, PriceWindow, Side } from "../types";

const logger = createChildLogger("detector");

/**
 * Detect price movements across all cached markets
 * Uses batch queries for efficiency
 */
export async function detectMovements(): Promise<PriceMovement[]> {
  const startTime = Date.now();
  const config = await getConfig();

  if (config.alertsPaused) {
    logger.debug("Alerts are paused, skipping detection");
    return [];
  }

  const markets = getCachedMarkets();

  // Filter markets by volume, days to resolution, and blocklist
  const eligibleMarkets = markets.filter((market) => {
    // Volume filter (already filtered at sync, but double-check)
    if (market.volumeNum < config.minVolumeUsd) {
      return false;
    }

    // Days to resolution filter
    if (market.endDate) {
      const daysToResolution = Math.ceil(
        (market.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysToResolution < config.minDaysToResolution) {
        return false;
      }
    }

    // Blocklist filter (safety net for cached markets)
    const blockResult = isMarketBlocked(
      market.question,
      market.category,
      config.blocklistCategories,
      config.blocklistKeywords,
    );
    if (blockResult.blocked) {
      return false;
    }

    return true;
  });

  if (eligibleMarkets.length === 0) {
    return [];
  }

  // Get all market IDs in cooldown (single query)
  const marketIds = eligibleMarkets.map((m) => m.id);
  const marketsInCooldown = await getMarketsInCooldown(
    marketIds,
    config.cooldownMinutes,
  );

  // Filter out markets in cooldown
  const marketsToCheck = eligibleMarkets.filter(
    (m) => !marketsInCooldown.has(m.id),
  );

  if (marketsToCheck.length === 0) {
    return [];
  }

  // Collect all token IDs we need to query
  const allTokenIds: string[] = [];
  for (const market of marketsToCheck) {
    if (market.tokenYes) allTokenIds.push(market.tokenYes);
    if (market.tokenNo) allTokenIds.push(market.tokenNo);
  }

  const movements: PriceMovement[] = [];

  // For each trigger, get price windows in batch and check for movements
  for (const trigger of config.triggers) {
    // Get all price windows for this time window (single query)
    const priceWindows = await getPriceWindowsBatch(
      allTokenIds,
      trigger.minutes,
    );

    // Check each market
    for (const market of marketsToCheck) {
      // Skip if we already found a movement for this market
      if (movements.some((m) => m.marketId === market.id)) {
        continue;
      }

      // Check YES token
      if (market.tokenYes) {
        const priceWindow = priceWindows.get(market.tokenYes);
        const movement = checkPriceWindow(
          market,
          market.tokenYes,
          "YES",
          priceWindow,
          trigger.cents,
          trigger.minutes,
        );
        if (movement) {
          movements.push(movement);
          continue; // One alert per market
        }
      }

      // Check NO token
      if (market.tokenNo) {
        const priceWindow = priceWindows.get(market.tokenNo);
        const movement = checkPriceWindow(
          market,
          market.tokenNo,
          "NO",
          priceWindow,
          trigger.cents,
          trigger.minutes,
        );
        if (movement) {
          movements.push(movement);
        }
      }
    }
  }

  const duration = Date.now() - startTime;
  if (movements.length > 0) {
    logger.info(
      { count: movements.length, durationMs: duration },
      "Detected price movements",
    );
  } else {
    logger.debug(
      { marketsChecked: marketsToCheck.length, durationMs: duration },
      "Detection complete, no movements",
    );
  }

  return movements;
}

/**
 * Check a specific market for price movements (for manual /test command)
 */
export async function checkMarket(marketId: string): Promise<PriceMovement[]> {
  const market = getMarketById(marketId);
  if (!market) {
    logger.warn({ marketId }, "Market not found in cache");
    return [];
  }

  const config = await getConfig();
  const movements: PriceMovement[] = [];

  // Collect token IDs
  const tokenIds: string[] = [];
  if (market.tokenYes) tokenIds.push(market.tokenYes);
  if (market.tokenNo) tokenIds.push(market.tokenNo);

  for (const trigger of config.triggers) {
    const priceWindows = await getPriceWindowsBatch(tokenIds, trigger.minutes);

    if (market.tokenYes) {
      const movement = checkPriceWindow(
        market,
        market.tokenYes,
        "YES",
        priceWindows.get(market.tokenYes),
        trigger.cents,
        trigger.minutes,
      );
      if (movement) {
        movements.push(movement);
        break;
      }
    }

    if (market.tokenNo) {
      const movement = checkPriceWindow(
        market,
        market.tokenNo,
        "NO",
        priceWindows.get(market.tokenNo),
        trigger.cents,
        trigger.minutes,
      );
      if (movement) {
        movements.push(movement);
        break;
      }
    }
  }

  return movements;
}

/**
 * Check a price window for movement that exceeds threshold
 */
function checkPriceWindow(
  market: Market,
  tokenId: string,
  side: Side,
  priceWindow: PriceWindow | undefined,
  thresholdCents: number,
  windowMinutes: number,
): PriceMovement | null {
  if (
    !priceWindow ||
    priceWindow.oldest === null ||
    priceWindow.latest === null
  ) {
    return null;
  }

  // Calculate absolute change in cents (price is 0-1, so multiply by 100)
  const changeCents = (priceWindow.latest - priceWindow.oldest) * 100;

  // Display change as absolute cents (1¢ = 1% of $1, not relative % change)
  const changePercent = changeCents;

  // Check if absolute change in cents exceeds threshold
  if (Math.abs(changeCents) >= thresholdCents) {
    logger.debug(
      {
        marketId: market.id,
        side,
        changeCents: changeCents.toFixed(1),
        windowMinutes,
        threshold: thresholdCents,
      },
      "Movement detected",
    );

    return {
      marketId: market.id,
      market,
      tokenId,
      side,
      priceBefore: priceWindow.oldest,
      priceAfter: priceWindow.latest,
      changePercent,
      timeWindowMinutes: windowMinutes,
      detectedAt: new Date(),
    };
  }

  return null;
}

/**
 * Format trigger type string for logging/storage
 */
export function formatTriggerType(
  changePercent: number,
  windowMinutes: number,
): string {
  const direction = changePercent >= 0 ? "UP" : "DOWN";
  return `${direction}_${windowMinutes}m`;
}
