import { fetchPriceHistory } from "../api/prices";
import { savePriceHistory } from "../db/prices";

/**
 * Fetches and saves historical price data for a specific token.
 * Convenience function that combines fetchPriceHistory and savePriceHistory.
 * @param tokenId - The unique identifier of the market token
 * @param options - Configuration options for the price history query
 * @param options.interval - Time interval for data points (default: "1h")
 * @param options.startTs - Optional start timestamp (Unix timestamp in seconds)
 * @param options.endTs - Optional end timestamp (Unix timestamp in seconds)
 * @param options.abs - Optional flag to return absolute prices instead of 0-1 probability scale
 * @returns Object with count of saved price points
 *
 * @example
 * // Fetch and save 1-hour interval history for a token
 * const result = await syncPriceHistory("token_id");
 * console.log(`Saved ${result.pricePoints} price points`);
 */
export async function syncPriceHistory(
  tokenId: string,
  options: {
    interval?: string;
    startTs?: number;
    endTs?: number;
    abs?: boolean;
  } = {},
) {
  const { interval = "1h", startTs, endTs, abs = false } = options;

  // Fetch price history (removed verbose logging)
  const priceHistory = await fetchPriceHistory({
    market: tokenId,
    interval,
    startTs,
    endTs,
    abs,
  });

  await savePriceHistory(tokenId, priceHistory, interval);

  const pricePoints = priceHistory.history?.length || 0;

  return { pricePoints };
}
