import fetch from "node-fetch";

// Polymarket Data API types
export interface PolymarketHolder {
  proxyWallet: string;
  pseudonym?: string;
  name?: string;
  amount: number;
  outcomeIndex: number;
  asset?: string;
  bio?: string;
  profileImage?: string;
  profileImageOptimized?: string;
  displayUsernamePublic?: boolean;
}

export interface PolymarketHoldersResponse {
  token: string;
  holders: PolymarketHolder[];
}

/**
 * Fetches top holders for a market from Polymarket Data API.
 * @param conditionId - The condition ID of the market (0x-prefixed hex string)
 * @param limit - Maximum holders per token (max 20)
 * @returns Array of holders grouped by token (Yes/No outcomes)
 */
export async function fetchMarketHolders(
  conditionId: string,
  limit = 20,
): Promise<PolymarketHoldersResponse[]> {
  if (!conditionId) {
    console.error("No conditionId provided for holders fetch");
    return [];
  }

  const url = new URL("https://data-api.polymarket.com/holders");
  url.searchParams.set("market", conditionId);
  url.searchParams.set("limit", String(Math.min(limit, 20)));
  url.searchParams.set("minBalance", "1");

  try {
    const resp = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      console.error(`Holders fetch failed: ${resp.status}`);
      return [];
    }

    const data = (await resp.json()) as PolymarketHoldersResponse[];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching market holders:", error);
    return [];
  }
}

/**
 * Fetches the order book for a specific market from Polymarket Gamma API.
 * @param marketId - The unique identifier of the market
 * @returns Order book object with bids and asks, or null if fetch fails
 */
export async function fetchMarketOrderBook(marketId: string) {
  const BASE = "https://gamma-api.polymarket.com";
  const url = new URL(`${BASE}/markets/${marketId}/order-book`);

  const resp = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!resp.ok) {
    console.error(
      `Order book fetch failed for market ${marketId}: ${resp.status}`,
    );
    return null;
  }
  return await resp.json();
}

/**
 * Fetches detailed information for a specific market from Polymarket Gamma API.
 * @param marketId - The unique identifier of the market
 * @returns Market details object, or null if fetch fails
 */
export async function fetchMarketDetails(marketId: string) {
  const BASE = "https://gamma-api.polymarket.com";
  const url = new URL(`${BASE}/markets/${marketId}`);

  const resp = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!resp.ok) {
    console.error(
      `Market details fetch failed for market ${marketId}: ${resp.status}`,
    );
    return null;
  }
  return await resp.json();
}

/**
 * Fetch market summary analytics from Polymarket Analytics API
 * Provides volume, liquidity, and open interest data for a specific event
 */
export async function fetchMarketSummary(eventId: string) {
  const resp = await fetch(
    "https://polymarketanalytics.com/api/market-summary",
    {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
      },
      body: JSON.stringify({ eventId }),
      cache: "no-store",
    },
  );

  if (!resp.ok) {
    console.error(`Market summary fetch failed: ${resp.status}`);
    throw new Error(`Market summary API error: ${resp.status}`);
  }
  return await resp.json();
}

/**
 * Fetch dashboard data from Polymarket Analytics API
 * Provides charts, holder information, and historical data for a specific event
 */
export async function fetchMarketsDashboard(eventId: string) {
  const resp = await fetch(
    "https://polymarketanalytics.com/api/markets-dashboard",
    {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
      },
      body: JSON.stringify({ eventId }),
      cache: "no-store",
    },
  );

  if (!resp.ok) {
    console.error(`Markets dashboard fetch failed: ${resp.status}`);
    throw new Error(`Dashboard API error: ${resp.status}`);
  }
  return await resp.json();
}
