import fetch from "node-fetch";

/**
 * Fetches historical price data for a specific token/market.
 * @param options - Configuration options for the price history query
 * @param options.market - The token ID of the market outcome
 * @param options.interval - Time interval for data points (e.g., "1h", "1d", "max")
 * @param options.startTs - Optional start timestamp (Unix timestamp in seconds)
 * @param options.endTs - Optional end timestamp (Unix timestamp in seconds)
 * @param options.abs - Optional flag to return absolute prices instead of 0-1 probability scale
 * @returns Object containing history array with { t: timestamp, p: price } entries
 * @throws Error if the API request fails
 *
 * @example
 * // Get entire 1-hour interval history for a token
 * const history = await fetchPriceHistory({ market: "token_id", interval: "1h" });
 *
 * @example
 * // Get history for a specific time range
 * const history = await fetchPriceHistory({
 *   market: "token_id",
 *   interval: "1h",
 *   startTs: 1700000000,
 *   endTs: 1700086400
 * });
 */
export async function fetchPriceHistory(options: {
  market: string;
  interval?: string;
  startTs?: number;
  endTs?: number;
  abs?: boolean;
}) {
  const { market, interval = "1h", startTs, endTs, abs = false } = options;

  const url = new URL("https://clob.polymarket.com/prices-history");
  url.searchParams.set("market", market);
  url.searchParams.set("interval", interval);
  url.searchParams.set("abs", String(abs));

  if (startTs !== undefined) {
    url.searchParams.set("startTs", String(startTs));
  }
  if (endTs !== undefined) {
    url.searchParams.set("endTs", String(endTs));
  }

  const resp = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!resp.ok) {
    // Try to get error details from response body
    let errorDetails = "";
    try {
      const errorBody = await resp.text();
      errorDetails = errorBody ? ` - ${errorBody}` : "";
    } catch (e) {
      // Ignore if we can't read the body
    }

    // For 400 errors, provide more context
    if (resp.status === 400) {
      throw new Error(
        `Invalid token or price history not available for token ${market}${errorDetails}`,
      );
    }

    throw new Error(
      `Price history fetch failed for token ${market}: ${resp.status}${errorDetails}`,
    );
  }

  return await resp.json();
}
