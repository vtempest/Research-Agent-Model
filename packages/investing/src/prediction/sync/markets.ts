import { db } from "../../db";
import { polymarketMarkets } from "../../db/schema";
import { fetchMarkets, fetchAllMarkets } from "../api/markets";
import { saveMarkets } from "../db/markets";
import { syncPriceHistory } from "./prices";

/**
 * Syncs markets from Polymarket API to the database.
 * Clears existing markets and fetches fresh data sorted by 24h volume.
 * Also fetches and stores price history for markets with token IDs.
 * @param limit - Maximum number of markets to sync (default: 200)
 * @param syncPriceHistoryFlag - Whether to also fetch price history (default: true)
 * @returns Object with count of synced markets and price history data points
 */
export async function syncMarkets(limit = 200, syncPriceHistoryFlag = true) {
  try {
    console.log("Starting Polymarket markets sync...");

    try {
      await db.delete(polymarketMarkets);
    } catch (error: any) {
      console.error("Failed to clear existing markets:", error.message);
      // Continue anyway
    }

    const markets: any = await fetchMarkets(limit, "volume24hr");
    await saveMarkets(markets);
    console.log(`Saved ${markets.length} markets`);

    let totalPricePoints = 0;

    // Fetch price history for markets with token IDs
    if (syncPriceHistoryFlag) {
      console.log("Fetching price history for markets...");
      for (const market of markets) {
        if (market.clobTokenIds && market.clobTokenIds.length > 0) {
          try {
            // Fetch history for the first token (typically "Yes" outcome)
            const tokenId = market.clobTokenIds[0];

            // Validate token ID before fetching
            // Valid token IDs should be alphanumeric strings of reasonable length
            if (
              !tokenId ||
              typeof tokenId !== "string" ||
              tokenId.trim().length < 10 ||
              !/^[a-zA-Z0-9_-]+$/.test(tokenId)
            ) {
              console.log(
                `Skipping market ${market.id} - Invalid token ID: ${tokenId}`,
              );
              continue;
            }

            const result = await syncPriceHistory(tokenId, { interval: "1h" });
            totalPricePoints += result.pricePoints;
          } catch (error: any) {
            // Only log details for unexpected errors (not 400s which are common for invalid tokens)
            if (
              error.message?.includes("400") ||
              error.message?.includes("Invalid token")
            ) {
              console.log(`Skipping market ${market.id} - ${error.message}`);
            } else {
              console.error(
                `Error syncing price history for market ${market.id}:`,
                error.message,
              );
            }
          }
        }
      }
      console.log(
        `Saved ${totalPricePoints} price data points across all markets`,
      );
    }

    return { markets: markets.length, pricePoints: totalPricePoints };
  } catch (error: any) {
    console.error("Fatal error in syncMarkets:", error.message);
    throw error;
  }
}

/**
 * Syncs all active markets from Polymarket API to the database.
 * Clears existing markets and fetches all available data sorted by 24h volume.
 * Also fetches and stores price history for markets with token IDs.
 * @param maxMarkets - Maximum total number of markets to sync (default: 0 for unlimited, fetches ALL active markets)
 * @param syncPriceHistoryFlag - Whether to also fetch price history (default: true)
 * @returns Object with count of synced markets and price history data points
 */
export async function syncAllMarkets(
  maxMarkets = 0,
  syncPriceHistoryFlag = true,
) {
  try {
    console.log("Starting Polymarket all markets sync...");

    try {
      await db.delete(polymarketMarkets);
    } catch (error: any) {
      console.error("Failed to clear existing markets:", error.message);
      // Continue anyway
    }

    const markets: any = await fetchAllMarkets("volume24hr", maxMarkets);
    await saveMarkets(markets);
    console.log(`Saved ${markets.length} markets`);

    let totalPricePoints = 0;

    // Fetch price history for markets with token IDs
    if (syncPriceHistoryFlag) {
      console.log("Fetching price history for markets...");
      for (const market of markets) {
        if (market.clobTokenIds && market.clobTokenIds.length > 0) {
          try {
            // Fetch history for the first token (typically "Yes" outcome)
            const tokenId = market.clobTokenIds[0];

            // Validate token ID before fetching
            // Valid token IDs should be alphanumeric strings of reasonable length
            if (
              !tokenId ||
              typeof tokenId !== "string" ||
              tokenId.trim().length < 10 ||
              !/^[a-zA-Z0-9_-]+$/.test(tokenId)
            ) {
              console.log(
                `Skipping market ${market.id} - Invalid token ID: ${tokenId}`,
              );
              continue;
            }

            const result = await syncPriceHistory(tokenId, { interval: "1h" });
            totalPricePoints += result.pricePoints;
          } catch (error: any) {
            // Only log details for unexpected errors (not 400s which are common for invalid tokens)
            if (
              error.message?.includes("400") ||
              error.message?.includes("Invalid token")
            ) {
              console.log(`Skipping market ${market.id} - ${error.message}`);
            } else {
              console.error(
                `Error syncing price history for market ${market.id}:`,
                error.message,
              );
            }
          }
        }
      }
      console.log(
        `Saved ${totalPricePoints} price data points across all markets`,
      );
    }

    return { markets: markets.length, pricePoints: totalPricePoints };
  } catch (error: any) {
    console.error("Fatal error in syncAllMarkets:", error.message);
    throw error;
  }
}
