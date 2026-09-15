import { fetchAllMarkets } from "../api/markets";
import { fetchMarketDetails, fetchMarketsDashboard } from "../api/analytics";
import { saveMarkets } from "../db/markets";
import { saveHolders } from "../db/positions";
import { syncPriceHistory } from "./prices";

/**
 * Incrementally syncs markets from Polymarket API to the database.
 * Updates existing markets and adds new ones without deleting the entire table.
 * This is ideal for cron jobs that run frequently.
 *
 * @param maxMarkets - Maximum number of markets to sync (default: 1000)
 * @param syncPriceHistoryFlag - Whether to also fetch price history (default: true)
 * @param syncHoldersFlag - Whether to also fetch top holders (default: true)
 * @returns Object with count of synced markets, price points, and holders
 */
export async function syncMarketsIncremental(
  maxMarkets = 1000,
  syncPriceHistoryFlag = true,
  syncHoldersFlag = true,
) {
  try {
    console.log(`Starting incremental Polymarket markets sync (max: ${maxMarkets})...`);

    // Fetch top markets by volume
    const markets: any = await fetchAllMarkets("volume24hr", maxMarkets);

    // Save/update markets in database (saveMarkets uses upsert)
    await saveMarkets(markets);
    console.log(`Synced ${markets.length} markets (upsert)`);

    let totalPricePoints = 0;
    let successfulPriceUpdates = 0;

    // Fetch price history for markets with token IDs
    if (syncPriceHistoryFlag && markets.length > 0) {
      console.log("Fetching price history for markets...");

      // Process in batches to avoid overwhelming the API
      const batchSize = 50;
      for (let i = 0; i < markets.length; i += batchSize) {
        const batch = markets.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async (market: any) => {
            if (market.clobTokenIds && market.clobTokenIds.length > 0) {
              try {
                // Fetch history for the first token (typically "Yes" outcome)
                const tokenId = market.clobTokenIds[0];

                // Validate token ID before fetching
                if (
                  !tokenId ||
                  typeof tokenId !== "string" ||
                  tokenId.trim().length < 10 ||
                  !/^[a-zA-Z0-9_-]+$/.test(tokenId)
                ) {
                  return;
                }

                const result = await syncPriceHistory(tokenId, { interval: "1h" });
                totalPricePoints += result.pricePoints;
                successfulPriceUpdates++;
              } catch (error: any) {
                // Silently skip failed price history fetches
                if (
                  !error.message?.includes("400") &&
                  !error.message?.includes("Invalid token")
                ) {
                  console.error(
                    `Error syncing price history for market ${market.id}:`,
                    error.message,
                  );
                }
              }
            }
          })
        );

        // Log progress
        const processed = Math.min(i + batchSize, markets.length);
        console.log(`Processed ${processed}/${markets.length} markets for price history`);
      }

      console.log(
        `Saved ${totalPricePoints} price data points across ${successfulPriceUpdates} markets`,
      );
    }

    let totalHolders = 0;
    let successfulHolderUpdates = 0;

    // Fetch holders for markets
    if (syncHoldersFlag && markets.length > 0) {
      console.log("Fetching top holders for markets...");

      // Process in smaller batches to avoid rate limiting (holders API is more expensive)
      const holderBatchSize = 20;
      for (let i = 0; i < markets.length; i += holderBatchSize) {
        const batch = markets.slice(i, i + holderBatchSize);

        await Promise.allSettled(
          batch.map(async (market: any) => {
            try {
              // Get event ID - first try from the market data
              let eventId = market.events && market.events.length > 0
                ? market.events[0].id
                : null;

              // If no event ID in market data, fetch market details
              if (!eventId) {
                const details = await fetchMarketDetails(market.id);
                if (details && details.events && details.events.length > 0) {
                  eventId = details.events[0].id;
                }
              }

              if (!eventId) {
                // Skip markets without event IDs
                return;
              }

              // Fetch dashboard data which includes holders
              const dashboard = await fetchMarketsDashboard(eventId);

              if (dashboard && dashboard.holders && Array.isArray(dashboard.holders)) {
                await saveHolders(market.id, dashboard.holders);
                totalHolders += dashboard.holders.length;
                successfulHolderUpdates++;
              }
            } catch (error: any) {
              // Silently skip failed holder fetches (API rate limits are common)
              if (
                !error.message?.includes("400") &&
                !error.message?.includes("404") &&
                !error.message?.includes("429")
              ) {
                console.error(
                  `Error syncing holders for market ${market.id}:`,
                  error.message,
                );
              }
            }
          })
        );

        // Log progress
        const processed = Math.min(i + holderBatchSize, markets.length);
        console.log(`Processed ${processed}/${markets.length} markets for holders`);

        // Add delay between batches to respect rate limits
        if (i + holderBatchSize < markets.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      console.log(
        `Saved ${totalHolders} holders across ${successfulHolderUpdates} markets`,
      );
    }

    return {
      markets: markets.length,
      pricePoints: totalPricePoints,
      priceHistoryUpdates: successfulPriceUpdates,
      holders: totalHolders,
      holderUpdates: successfulHolderUpdates
    };
  } catch (error: any) {
    console.error("Fatal error in syncMarketsIncremental:", error.message);
    throw error;
  }
}
