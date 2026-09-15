/**
 * Polymarket Gamma API Client
 * Fetches market metadata and prices
 */

import axios from "axios";
import { createChildLogger } from "../../utils/logger";
import type { Market } from "../types";

const logger = createChildLogger("gamma");

const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
const REQUEST_TIMEOUT_MS = 30000;
const PAGE_SIZE = 100;

export interface GammaMarketWithPrices {
  market: Market;
  yesPrice: number;
  noPrice: number;
}

export interface BlocklistResult {
  blocked: boolean;
  reason?: "category" | "keyword";
  matchedValue?: string;
}

/**
 * Check if a market should be blocked based on category or keywords
 */
export function isMarketBlocked(
  question: string,
  category: string,
  blocklistCategories: string[],
  blocklistKeywords: string[],
): BlocklistResult {
  // Check category (case-insensitive)
  const categoryLower = category.toLowerCase();
  for (const blocked of blocklistCategories) {
    if (categoryLower === blocked.toLowerCase()) {
      return { blocked: true, reason: "category", matchedValue: blocked };
    }
  }

  // Check keywords in question (case-insensitive)
  const questionLower = question.toLowerCase();
  for (const keyword of blocklistKeywords) {
    if (questionLower.includes(keyword.toLowerCase())) {
      return { blocked: true, reason: "keyword", matchedValue: keyword };
    }
  }

  return { blocked: false };
}

/**
 * Fetch all active events and their markets with prices
 * Events contain the category info that markets lack
 * Applies blocklist filtering if provided
 */
export async function fetchActiveMarketsWithPrices(
  blocklistCategories: string[] = [],
  blocklistKeywords: string[] = [],
): Promise<GammaMarketWithPrices[]> {
  logger.debug("Fetching active events from Gamma API");

  const results: GammaMarketWithPrices[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get(`${GAMMA_BASE_URL}/events`, {
      params: {
        active: true,
        closed: false,
        limit: PAGE_SIZE,
        offset,
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const events = response.data as RawGammaEvent[];

    if (!events || events.length === 0) {
      hasMore = false;
    } else {
      for (const event of events) {
        // Get category from tags (first tag) or fallback to category field
        let category = "Unknown";
        if (event.tags && event.tags.length > 0) {
          category = event.tags[0]?.label || "Unknown";
        } else if (event.category) {
          category = event.category;
        }

        // Each event can have multiple markets
        if (event.markets && Array.isArray(event.markets)) {
          for (const rawMarket of event.markets) {
            // Check blocklist before parsing
            const blockResult = isMarketBlocked(
              rawMarket.question,
              category,
              blocklistCategories,
              blocklistKeywords,
            );
            if (blockResult.blocked) {
              logger.debug(
                {
                  marketId: rawMarket.id,
                  reason: blockResult.reason,
                  match: blockResult.matchedValue,
                },
                "Market blocked by filter",
              );
              continue;
            }

            const result = parseGammaMarket(
              rawMarket,
              category,
              event.slug ?? "",
            );
            if (result) {
              results.push(result);
            }
          }
        }
      }

      if (events.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }

      // Safety limit
      if (offset > 5000) {
        logger.warn("Reached safety limit of 5000 events, stopping pagination");
        hasMore = false;
      }
    }
  }

  logger.info({ count: results.length }, "Fetched active markets with prices");

  return results;
}

/**
 * Fetch a single market by ID
 */
export async function fetchMarket(marketId: string): Promise<Market | null> {
  try {
    const response = await axios.get(`${GAMMA_BASE_URL}/markets/${marketId}`, {
      timeout: REQUEST_TIMEOUT_MS,
    });

    const result = parseGammaMarket(response.data, "Unknown", "");
    return result?.market ?? null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if the Gamma API is responding
 */
export async function checkGammaHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${GAMMA_BASE_URL}/events`, {
      params: { limit: 1 },
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// Raw API response types
interface RawGammaTag {
  label?: string;
  slug?: string;
}

interface RawGammaEvent {
  id: string;
  title: string;
  slug?: string;
  category?: string;
  tags?: RawGammaTag[];
  markets?: RawGammaMarket[];
}

interface RawGammaMarket {
  id: string;
  conditionId?: string;
  question: string;
  slug?: string;
  endDate?: string;
  endDateIso?: string;
  active?: boolean;
  closed?: boolean;
  volumeNum?: number;
  volume24hr?: number;
  clobTokenIds?: string;
  outcomePrices?: string;
  outcomes?: string;
}

const MIN_VOLUME_USD = 50000;

/**
 * Parse Gamma API market response to internal types
 */
function parseGammaMarket(
  raw: RawGammaMarket,
  category: string,
  eventSlug: string,
): GammaMarketWithPrices | null {
  // Skip closed markets
  if (raw.closed) {
    return null;
  }

  // Skip low-volume markets early (before parsing tokens/prices)
  const volume = raw.volumeNum ?? raw.volume24hr ?? 0;
  if (volume < MIN_VOLUME_USD) {
    return null;
  }

  // Parse clobTokenIds - it's a JSON string
  let tokenYes = "";
  let tokenNo = "";

  if (raw.clobTokenIds) {
    try {
      const tokenIds = JSON.parse(raw.clobTokenIds) as string[];
      tokenYes = tokenIds[0] ?? "";
      tokenNo = tokenIds[1] ?? "";
    } catch {
      // Skip silently
    }
  }

  // Parse outcomePrices
  let yesPrice = 0;
  let noPrice = 0;

  if (raw.outcomePrices) {
    try {
      const prices = JSON.parse(raw.outcomePrices) as string[];
      yesPrice = parseFloat(prices[0] ?? "0") || 0;
      noPrice = parseFloat(prices[1] ?? "0") || 0;
    } catch {
      // Skip silently
    }
  }

  // Skip markets without valid tokens
  if (!tokenYes && !tokenNo) {
    return null;
  }

  // Parse end date
  let endDate: Date | null = null;
  if (raw.endDate) {
    endDate = new Date(raw.endDate);
  } else if (raw.endDateIso) {
    endDate = new Date(raw.endDateIso);
  }

  const market: Market = {
    id: raw.id,
    conditionId: raw.conditionId ?? "",
    question: raw.question,
    slug: raw.slug ?? "",
    eventSlug,
    category,
    endDate,
    active: raw.active ?? true,
    volumeNum: raw.volumeNum ?? raw.volume24hr ?? 0,
    tokenYes,
    tokenNo,
  };

  return { market, yesPrice, noPrice };
}
