import fetch from "node-fetch";

/**
 * Fetches active prediction markets from the Polymarket Gamma API.
 * @param limit - Maximum number of markets to retrieve (default: 50)
 * @param sortBy - Field to sort results by (default: "volume24hr")
 * @param offset - Number of markets to skip for pagination (default: 0)
 * @returns Array of market objects from Polymarket
 * @throws Error if the API request fails
 */
export async function fetchMarkets(
  limit = 50,
  sortBy = "volume24hr",
  offset = 0,
) {
  try {
    const BASE = "https://gamma-api.polymarket.com";
    const url = new URL(`${BASE}/markets`);

    url.searchParams.set("closed", "false");
    url.searchParams.set("active", "true");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("order", sortBy);
    url.searchParams.set("ascending", "false");

    const resp = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      throw new Error(
        `Polymarket API returned ${resp.status} ${resp.statusText}`,
      );
    }

    const data = await resp.json();
    return data;
  } catch (error: any) {
    console.error(
      `Error fetching markets (limit: ${limit}, offset: ${offset}):`,
      error.message,
    );
    throw error;
  }
}

/**
 * Fetches all active prediction markets from the Polymarket Gamma API using pagination.
 * @param sortBy - Field to sort results by (default: "volume24hr")
 * @param maxMarkets - Maximum total number of markets to retrieve (default: 1000, set to 0 for unlimited)
 * @returns Array of all market objects from Polymarket
 * @throws Error if the API request fails
 */
export async function fetchAllMarkets(
  sortBy = "volume24hr",
  maxMarkets = 1000,
) {
  try {
    const allMarkets = [];
    let offset = 0;
    const limit = 100; // Fetch 100 at a time
    let hasMore = true;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    while (hasMore) {
      try {
        const markets = await fetchMarkets(limit, sortBy, offset);

        if (!markets || markets.length === 0) {
          hasMore = false;
          break;
        }

        allMarkets.push(...markets);
        offset += markets.length;
        consecutiveErrors = 0; // Reset error counter on success

        // Stop if we've reached the maximum or if we got fewer results than requested
        if (
          (maxMarkets > 0 && allMarkets.length >= maxMarkets) ||
          markets.length < limit
        ) {
          hasMore = false;
        }
      } catch (error: any) {
        consecutiveErrors++;
        console.error(
          `Error fetching markets batch at offset ${offset} (attempt ${consecutiveErrors}/${maxConsecutiveErrors}):`,
          error.message,
        );

        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error("Too many consecutive errors, stopping pagination");
          hasMore = false;
        } else {
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Trim to maxMarkets if specified
    if (maxMarkets > 0 && allMarkets.length > maxMarkets) {
      return allMarkets.slice(0, maxMarkets);
    }

    return allMarkets;
  } catch (error: any) {
    console.error("Fatal error in fetchAllMarkets:", error.message);
    throw error;
  }
}

/**
 * Searches for active markets matching a query string.
 * @param query - The search query string
 * @param limit - Maximum number of results to return (default: 100)
 * @returns Array of market objects matching the search query
 * @throws Error if the API request fails
 */
export async function searchMarkets(query: string, limit = 100) {
  if (!query || query.trim() === "") {
    return [];
  }

  const searchResults = await searchPublic({
    q: query,
    keep_closed_markets: 0,
    limit_per_type: limit,
    search_tags: true,
    search_profiles: false,
  });

  // Extract markets from search results
  const markets = searchResults.markets || [];

  // Filter to only active markets
  return markets.filter((market: any) => market.active && !market.closed);
}

/**
 * Performs a public search across Polymarket events, markets, and profiles.
 * @param options - Search configuration options
 * @param options.q - The search query string (required)
 * @param options.cache - Whether to use cached results
 * @param options.events_status - Filter by event status
 * @param options.limit_per_type - Maximum results per type
 * @param options.page - Page number for pagination
 * @param options.events_tag - Array of tags to filter events
 * @param options.keep_closed_markets - Include closed markets (0 or 1)
 * @param options.sort - Sort field
 * @param options.ascending - Sort direction
 * @param options.search_tags - Include tags in search
 * @param options.search_profiles - Include profiles in search
 * @param options.recurrence - Recurrence filter
 * @param options.exclude_tag_id - Array of tag IDs to exclude
 * @param options.optimized - Use optimized search
 * @returns Search results object
 * @throws Error if the API request fails
 */
export async function searchPublic(options: {
  q: string;
  cache?: boolean;
  events_status?: string;
  limit_per_type?: number;
  page?: number;
  events_tag?: string[];
  keep_closed_markets?: number;
  sort?: string;
  ascending?: boolean;
  search_tags?: boolean;
  search_profiles?: boolean;
  recurrence?: string;
  exclude_tag_id?: number[];
  optimized?: boolean;
}) {
  const BASE = "https://gamma-api.polymarket.com";
  const url = new URL(`${BASE}/public-search`);

  // Add required query parameter
  url.searchParams.set("q", options.q);

  // Add optional query parameters
  if (options.cache !== undefined)
    url.searchParams.set("cache", String(options.cache));
  if (options.events_status)
    url.searchParams.set("events_status", options.events_status);
  if (options.limit_per_type !== undefined)
    url.searchParams.set("limit_per_type", String(options.limit_per_type));
  if (options.page !== undefined)
    url.searchParams.set("page", String(options.page));
  if (options.events_tag) {
    options.events_tag.forEach((tag) =>
      url.searchParams.append("events_tag", tag),
    );
  }
  if (options.keep_closed_markets !== undefined)
    url.searchParams.set(
      "keep_closed_markets",
      String(options.keep_closed_markets),
    );
  if (options.sort) url.searchParams.set("sort", options.sort);
  if (options.ascending !== undefined)
    url.searchParams.set("ascending", String(options.ascending));
  if (options.search_tags !== undefined)
    url.searchParams.set("search_tags", String(options.search_tags));
  if (options.search_profiles !== undefined)
    url.searchParams.set("search_profiles", String(options.search_profiles));
  if (options.recurrence)
    url.searchParams.set("recurrence", options.recurrence);
  if (options.exclude_tag_id) {
    options.exclude_tag_id.forEach((id) =>
      url.searchParams.append("exclude_tag_id", String(id)),
    );
  }
  if (options.optimized !== undefined)
    url.searchParams.set("optimized", String(options.optimized));

  const resp = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!resp.ok) {
    console.error(`Public search failed: ${resp.status}`);
    throw new Error(`Public search failed: ${resp.status}`);
  }
  return await resp.json();
}
