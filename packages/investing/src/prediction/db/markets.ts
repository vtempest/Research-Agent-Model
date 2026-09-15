import { db } from "../../db";
import { polymarketMarkets } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  categorizeMarket,
  categorizeMarketSubcategory,
  parseTags,
} from "../utils/categorizer";

/**
 * Helper function to ensure a value is a JSON string
 * Polymarket API returns some fields as JSON strings already,
 * so we need to avoid double-stringifying them
 */
function ensureJsonString(value: any): string {
  // If it's null or undefined, return empty array as JSON
  if (value === null || value === undefined) {
    return JSON.stringify([]);
  }

  // If it's already a string, check if it's valid JSON
  if (typeof value === "string") {
    try {
      // Try to parse it - if it works, it's already valid JSON
      JSON.parse(value);
      return value; // Return as-is, it's already a JSON string
    } catch {
      // If parsing fails, it's a plain string, so stringify it
      return JSON.stringify([value]);
    }
  }

  // If it's an array or object, stringify it
  return JSON.stringify(value);
}

/**
 * Saves or updates market data in the database.
 * Handles outcomes, prices, tags, and other market metadata.
 * @param marketsData - Array of market objects from the API
 */
export async function saveMarkets(marketsData: any[]) {
  const now = Date.now();
  let savedCount = 0;
  let failedCount = 0;

  for (const market of marketsData) {
    try {
      // Extract event slug from the events array (if available)
      const eventSlug =
        market.events && market.events.length > 0
          ? market.events[0].slug
          : null;

      // Categorize the market based on tags and question
      const tags = parseTags(market.tags);
      const category = categorizeMarket(tags, market.question);

      // Determine subcategory if category is assigned
      const subcategory = category
        ? categorizeMarketSubcategory(category, market.question, tags)
        : null;

      await db
        .insert(polymarketMarkets)
        .values({
          id: market.id,
          conditionId: market.conditionId || null,
          question: market.question,
          slug: market.slug,
          eventSlug: eventSlug,
          description: market.description || null,
          image: market.imageUrl || market.image || null,
          volume24hr: market.volume24hr || 0,
          volumeTotal: market.volumeNum || market.volumeTotal || 0,
          active: market.active ?? true,
          closed: market.closed ?? false,
          outcomes: ensureJsonString(market.outcomes),
          outcomePrices: ensureJsonString(market.outcomePrices),
          clobTokenIds: ensureJsonString(market.clobTokenIds),
          tags: ensureJsonString(market.tags),
          category: category,
          subcategory: subcategory,
          endDate: market.endDate || null,
          groupItemTitle: market.groupItemTitle || null,
          enableOrderBook: market.enableOrderBook ?? false,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
        .onConflictDoUpdate({
          target: polymarketMarkets.id,
          set: {
            conditionId: market.conditionId || null,
            question: market.question,
            eventSlug: eventSlug,
            description: market.description || null,
            image: market.imageUrl || market.image || null,
            volume24hr: market.volume24hr || 0,
            volumeTotal: market.volumeNum || market.volumeTotal || 0,
            active: market.active ?? true,
            closed: market.closed ?? false,
            outcomes: ensureJsonString(market.outcomes),
            outcomePrices: ensureJsonString(market.outcomePrices),
            clobTokenIds: ensureJsonString(market.clobTokenIds),
            tags: ensureJsonString(market.tags),
            category: category,
            subcategory: subcategory,
            endDate: market.endDate || null,
            groupItemTitle: market.groupItemTitle || null,
            enableOrderBook: market.enableOrderBook ?? false,
            updatedAt: new Date(now),
          },
        });
      savedCount++;
    } catch (error: any) {
      failedCount++;
      console.error(
        `Failed to save market ${market.id} (${market.question}):`,
        error.message,
      );
      // Continue with next market even if one fails
    }
  }

  if (failedCount > 0) {
    console.log(
      `Saved ${savedCount}/${marketsData.length} markets (${failedCount} failed)`,
    );
  }
}

/**
 * Retrieves markets from the database with filtering and sorting options.
 * @param options - Query configuration options
 * @param options.limit - Maximum number of markets to retrieve (default: 50)
 * @param options.sortBy - Sort field: "volume24hr", "volumeTotal", or "createdAt" (default: "volume24hr")
 * @param options.category - Optional category tag to filter by
 * @param options.activeOnly - Only include active markets (default: true)
 * @returns Array of market records matching the criteria
 */
export async function getMarkets(
  options: {
    limit?: number;
    offset?: number;
    sortBy?: "volume24hr" | "volumeTotal" | "createdAt";
    category?: string;
    activeOnly?: boolean;
  } = {},
) {
  const {
    limit = 50,
    offset = 0,
    sortBy = "volume24hr",
    category,
    activeOnly = true,
  } = options;

  let query = db.select().from(polymarketMarkets);

  // Build where conditions
  const conditions = [];
  if (activeOnly) {
    conditions.push(eq(polymarketMarkets.active, true));
  }
  if (category && category !== "Overall" && category !== "all") {
    conditions.push(eq(polymarketMarkets.category, category));
  }

  // Apply where conditions
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Sort
  const orderByColumn =
    sortBy === "volume24hr"
      ? polymarketMarkets.volume24hr
      : sortBy === "volumeTotal"
        ? polymarketMarkets.volumeTotal
        : polymarketMarkets.createdAt;

  query = query.orderBy(desc(orderByColumn)) as any;

  // Apply limit and offset
  query = query.limit(limit).offset(offset) as any;

  const results = await query;

  return results;
}

/**
 * Searches markets in the database by question text.
 * @param searchTerm - The search term to match against market questions
 * @param options - Query configuration options
 * @param options.limit - Maximum number of markets to retrieve (default: 50)
 * @param options.sortBy - Sort field: "volume24hr", "volumeTotal", or "createdAt" (default: "volume24hr")
 * @param options.category - Optional category tag to filter by
 * @param options.activeOnly - Only include active markets (default: true)
 * @returns Array of market records matching the search term
 */
export async function searchMarketsInDB(
  searchTerm: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: "volume24hr" | "volumeTotal" | "createdAt";
    category?: string;
    activeOnly?: boolean;
  } = {},
) {
  const { limit = 50, offset = 0, sortBy = "volume24hr", category, activeOnly = true } = options;

  if (!searchTerm || searchTerm.trim() === "") {
    return [];
  }

  let query = db.select().from(polymarketMarkets);

  // Build where conditions
  const conditions = [];
  if (activeOnly) {
    conditions.push(eq(polymarketMarkets.active, true));
  }
  if (category && category !== "Overall" && category !== "all") {
    conditions.push(eq(polymarketMarkets.category, category));
  }

  // Apply where conditions
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Sort
  const orderByColumn =
    sortBy === "volume24hr"
      ? polymarketMarkets.volume24hr
      : sortBy === "volumeTotal"
        ? polymarketMarkets.volumeTotal
        : polymarketMarkets.createdAt;

  query = query.orderBy(desc(orderByColumn)) as any;

  const results = await query;

  // Filter by search term (case-insensitive)
  const searchLower = searchTerm.toLowerCase();
  const filteredResults = results.filter((market: any) => {
    return market.question.toLowerCase().includes(searchLower);
  });

  // Apply offset and limit
  return filteredResults.slice(offset, offset + limit);
}

/**
 * Retrieves active markets grouped by their category tags.
 * @returns Object with category tags as keys and arrays of market records as values
 */
export async function getMarketsByCategory() {
  const markets = await db
    .select()
    .from(polymarketMarkets)
    .where(eq(polymarketMarkets.active, true))
    .orderBy(desc(polymarketMarkets.volume24hr))
    .limit(100);

  const categorized: Record<string, any[]> = {};

  for (const market of markets) {
    try {
      const tags = JSON.parse(market.tags || "[]");
      for (const tag of tags) {
        if (!categorized[tag]) {
          categorized[tag] = [];
        }
        categorized[tag].push(market);
      }
    } catch {
      // Skip markets with invalid tags
    }
  }

  return categorized;
}
