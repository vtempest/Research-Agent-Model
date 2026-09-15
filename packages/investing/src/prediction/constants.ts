/**
 * Polymarket prediction market categories
 * Separated from main polymarket.ts to avoid importing database client in client components
 */
export const POLYMARKET_CATEGORIES = [
  "Overall",
  "Politics",
  "Sports",
  "Crypto",
  "Culture",
  "Mentions",
  "Weather",
  "Economics",
  "Tech",
  "Finance"
] as const;

export type PolymarketCategory = typeof POLYMARKET_CATEGORIES[number];
