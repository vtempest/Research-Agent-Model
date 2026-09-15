import { db } from "../../db";
import { polymarketPriceHistory } from "../../db/schema";
import { eq, asc, and } from "drizzle-orm";

/**
 * Saves historical price data for a specific token/market.
 * Stores each price point as a separate record.
 * @param tokenId - The unique identifier of the market token
 * @param priceHistory - Price history object containing history array with { t: timestamp, p: price } entries
 * @param interval - The interval used for the price data (e.g., "1h", "1d")
 */
export async function savePriceHistory(
  tokenId: string,
  priceHistory: { history: Array<{ t: number; p: number }> },
  interval: string = "1h",
) {
  try {
    const now = Date.now();

    if (!priceHistory.history || priceHistory.history.length === 0) {
      console.log(`No price history data to save for token ${tokenId}`);
      return;
    }

    // Save each price point
    for (const point of priceHistory.history) {
      try {
        const id = `${tokenId}-${point.t}-${interval}`;

        await db
          .insert(polymarketPriceHistory)
          .values({
            id: id,
            tokenId: tokenId,
            timestamp: point.t,
            price: point.p,
            interval: interval,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: polymarketPriceHistory.id,
            set: {
              price: point.p,
            },
          });
      } catch (pointError: any) {
        console.error(
          `Failed to save price point for token ${tokenId} at timestamp ${point.t}:`,
          pointError.message,
        );
        // Continue with next point even if one fails
      }
    }
  } catch (error: any) {
    console.error(
      `Error saving price history for token ${tokenId}:`,
      error.message,
    );
    throw error; // Re-throw to let caller know something went wrong
  }
}

/**
 * Retrieves historical price data for a specific token from the database.
 * @param tokenId - The unique identifier of the market token
 * @param options - Query configuration options
 * @param options.interval - Optional interval filter (e.g., "1h", "1d")
 * @param options.startTimestamp - Optional start timestamp to filter from
 * @param options.endTimestamp - Optional end timestamp to filter to
 * @param options.limit - Maximum number of records to retrieve
 * @returns Array of price history records sorted by timestamp ascending
 */
export async function getPriceHistory(
  tokenId: string,
  options: {
    interval?: string;
    startTimestamp?: number;
    endTimestamp?: number;
    limit?: number;
  } = {},
) {
  const { interval, startTimestamp, endTimestamp, limit } = options;

  // Build where conditions
  const conditions = [eq(polymarketPriceHistory.tokenId, tokenId)];

  if (interval) {
    conditions.push(eq(polymarketPriceHistory.interval, interval));
  }

  let query = db
    .select()
    .from(polymarketPriceHistory)
    .where(and(...conditions))
    .orderBy(asc(polymarketPriceHistory.timestamp));

  // Apply limit if specified
  if (limit) {
    query = query.limit(limit) as any;
  }

  const results = await query;

  // Filter by timestamp range if specified
  let filteredResults = results;
  if (startTimestamp !== undefined || endTimestamp !== undefined) {
    filteredResults = results.filter((record: any) => {
      if (startTimestamp !== undefined && record.timestamp < startTimestamp) {
        return false;
      }
      if (endTimestamp !== undefined && record.timestamp > endTimestamp) {
        return false;
      }
      return true;
    });
  }

  return filteredResults;
}
