/**
 * Market Categorization Utility
 * Assigns a primary category to Polymarket markets based on tags and question text
 */

import { POLYMARKET_CATEGORIES } from "../constants";

// Subcategory keywords mapping - nested within each category
const SUBCATEGORY_KEYWORDS: Record<string, Record<string, string[]>> = {
  Politics: {
    Elections: [
      "election",
      "vote",
      "ballot",
      "primary",
      "electoral",
      "swing state",
      "battleground",
      "polling",
      "voter",
      "campaign",
    ],
    Presidency: [
      "president",
      "presidential",
      "white house",
      "oval office",
      "executive order",
      "trump",
      "biden",
      "administration",
    ],
    Legislature: [
      "senate",
      "congress",
      "house",
      "representative",
      "senator",
      "bill",
      "legislation",
      "legislative",
      "congress",
      "filibuster",
    ],
    Cabinet: [
      "cabinet",
      "secretary of",
      "attorney general",
      "chief of staff",
      "press secretary",
      "advisor",
      "nominee",
      "confirmation",
    ],
    Judicial: [
      "supreme court",
      "justice",
      "judge",
      "ruling",
      "court decision",
      "judicial",
      "scotus",
    ],
    "Foreign Policy": [
      "foreign policy",
      "international",
      "embassy",
      "diplomat",
      "treaty",
      "sanctions",
      "nato",
      "un",
      "united nations",
    ],
  },
  Sports: {
    Football: [
      "nfl",
      "super bowl",
      "quarterback",
      "touchdown",
      "football",
      "patriots",
      "cowboys",
      "chiefs",
    ],
    Basketball: [
      "nba",
      "basketball",
      "lebron",
      "championship",
      "finals",
      "lakers",
      "warriors",
      "celtics",
    ],
    Baseball: ["mlb", "baseball", "world series", "yankees", "dodgers"],
    Soccer: [
      "fifa",
      "world cup",
      "premier league",
      "messi",
      "ronaldo",
      "soccer",
      "uefa",
      "champions league",
    ],
    Hockey: ["nhl", "hockey", "stanley cup"],
    Olympics: ["olympics", "olympic", "gold medal", "winter games", "summer games"],
    Combat: ["ufc", "boxing", "mma", "fight", "fighter", "heavyweight"],
    Racing: ["nascar", "f1", "formula 1", "racing", "grand prix"],
  },
  Crypto: {
    Bitcoin: ["bitcoin", "btc", "satoshi"],
    Ethereum: ["ethereum", "eth", "vitalik", "erc", "gas fees"],
    Altcoins: [
      "solana",
      "cardano",
      "polygon",
      "avalanche",
      "polkadot",
      "chainlink",
      "altcoin",
    ],
    DeFi: [
      "defi",
      "decentralized finance",
      "lending",
      "liquidity",
      "yield",
      "staking",
      "aave",
      "uniswap",
    ],
    NFTs: ["nft", "non-fungible", "opensea", "bored ape", "cryptopunk"],
    Memecoins: ["doge", "dogecoin", "shib", "shiba", "pepe", "memecoin"],
    Exchanges: ["binance", "coinbase", "kraken", "ftx", "exchange"],
    Regulation: ["sec", "regulation", "compliance", "etf", "custody"],
  },
  Culture: {
    Movies: [
      "movie",
      "film",
      "box office",
      "oscar",
      "academy awards",
      "director",
      "actor",
      "cinema",
    ],
    Music: [
      "music",
      "album",
      "song",
      "grammy",
      "billboard",
      "artist",
      "concert",
      "tour",
      "spotify",
    ],
    TV: ["netflix", "tv show", "series", "streaming", "emmy", "hulu", "disney+"],
    Social: [
      "tiktok",
      "instagram",
      "youtube",
      "twitter",
      "influencer",
      "viral",
      "trending",
    ],
    Gaming: ["gaming", "video game", "esports", "twitch", "xbox", "playstation"],
    Awards: ["award", "oscar", "grammy", "emmy", "golden globe"],
  },
  Weather: {
    Temperature: ["temperature", "degrees", "celsius", "fahrenheit", "heat", "cold"],
    Storms: ["hurricane", "storm", "tornado", "cyclone", "typhoon"],
    Precipitation: ["rain", "rainfall", "snow", "snowfall", "precipitation"],
    Climate: ["climate", "global warming", "el nino", "la nina"],
  },
  Economics: {
    "Monetary Policy": [
      "federal reserve",
      "fed",
      "interest rate",
      "rate cut",
      "rate hike",
      "powell",
    ],
    Inflation: ["inflation", "cpi", "pce", "prices", "deflation"],
    Employment: ["unemployment", "jobs", "employment", "payroll", "labor market"],
    Growth: ["gdp", "growth", "recession", "expansion", "contraction"],
    Trade: ["trade", "tariff", "export", "import", "trade war"],
  },
  Tech: {
    "Big Tech": ["apple", "google", "microsoft", "amazon", "meta", "facebook"],
    AI: [
      "ai",
      "artificial intelligence",
      "chatgpt",
      "openai",
      "claude",
      "llm",
      "machine learning",
    ],
    Semiconductors: ["nvidia", "amd", "intel", "chip", "semiconductor", "tsmc"],
    Space: ["spacex", "starship", "rocket", "satellite", "space"],
    Automotive: ["tesla", "electric vehicle", "ev", "autonomous", "self-driving"],
    Software: ["software", "saas", "platform", "app", "application"],
  },
  Finance: {
    Stocks: [
      "stock",
      "equity",
      "shares",
      "nasdaq",
      "s&p",
      "dow",
      "market cap",
      "trading",
    ],
    Banking: ["bank", "banking", "goldman", "jpmorgan", "wells fargo"],
    IPO: ["ipo", "initial public offering", "listing", "debut"],
    Earnings: ["earnings", "revenue", "profit", "eps", "quarterly results"],
    Markets: ["bull market", "bear market", "correction", "crash", "rally"],
  },
};

// Category keywords mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Politics: [
    "election",
    "president",
    "senate",
    "congress",
    "vote",
    "democrat",
    "republican",
    "trump",
    "biden",
    "policy",
    "government",
    "political",
    "politician",
    "cabinet",
    "white house",
    "legislative",
    "bill",
    "law",
    "supreme court",
  ],
  Sports: [
    "nfl",
    "nba",
    "mlb",
    "nhl",
    "fifa",
    "olympics",
    "championship",
    "playoff",
    "super bowl",
    "world cup",
    "champion",
    "athlete",
    "player",
    "team",
    "match",
    "game",
    "sports",
    "tournament",
    "soccer",
    "basketball",
    "football",
    "baseball",
    "hockey",
  ],
  Crypto: [
    "bitcoin",
    "ethereum",
    "btc",
    "eth",
    "crypto",
    "blockchain",
    "defi",
    "nft",
    "token",
    "altcoin",
    "cryptocurrency",
    "binance",
    "coinbase",
    "solana",
    "cardano",
    "polygon",
    "doge",
    "shib",
    "web3",
  ],
  Culture: [
    "entertainment",
    "celebrity",
    "movie",
    "music",
    "artist",
    "album",
    "box office",
    "grammy",
    "oscar",
    "emmy",
    "award",
    "netflix",
    "spotify",
    "tiktok",
    "instagram",
    "youtube",
    "influencer",
    "viral",
    "meme",
  ],
  Weather: [
    "hurricane",
    "temperature",
    "rainfall",
    "snow",
    "storm",
    "climate",
    "tornado",
    "flood",
    "drought",
    "weather",
    "forecast",
    "celsius",
    "fahrenheit",
  ],
  Economics: [
    "gdp",
    "inflation",
    "recession",
    "unemployment",
    "interest rate",
    "federal reserve",
    "fed",
    "economy",
    "economic",
    "market",
    "jobs",
    "employment",
    "cpi",
    "pce",
  ],
  Tech: [
    "apple",
    "google",
    "microsoft",
    "amazon",
    "meta",
    "tesla",
    "nvidia",
    "ai",
    "artificial intelligence",
    "chatgpt",
    "openai",
    "technology",
    "software",
    "hardware",
    "chip",
    "semiconductor",
    "spacex",
    "starship",
    "rocket",
  ],
  Finance: [
    "stock",
    "nasdaq",
    "s&p",
    "dow",
    "ipo",
    "earnings",
    "revenue",
    "profit",
    "market cap",
    "trading",
    "shares",
    "investor",
    "wall street",
    "banking",
    "financial",
  ],
};

/**
 * Categorizes a market based on its tags and question text
 * @param tags - Array of tag strings from the market
 * @param question - The market question text
 * @returns Category string or null if no match found
 */
export function categorizeMarket(
  tags: string[],
  question: string,
): string | null {
  // First, check if any tag directly matches a category
  for (const category of POLYMARKET_CATEGORIES) {
    if (category === "Overall" || category === "Mentions") continue;

    if (tags.some((tag) => tag.toLowerCase() === category.toLowerCase())) {
      return category;
    }
  }

  // Then, check question text against keywords
  const questionLower = question.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (questionLower.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  // Check tags against keywords
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (tagLower.includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }
  }

  // Default to "Overall" if no specific category found
  return "Overall";
}

/**
 * Categorizes a market into a subcategory based on its question text
 * @param category - The primary category (e.g., "Politics", "Sports")
 * @param question - The market question text
 * @param tags - Array of tag strings from the market
 * @returns Subcategory string or null if no match found
 */
export function categorizeMarketSubcategory(
  category: string,
  question: string,
  tags: string[] = [],
): string | null {
  // Check if category has subcategories defined
  const subcategories = SUBCATEGORY_KEYWORDS[category];
  if (!subcategories) return null;

  const questionLower = question.toLowerCase();
  const tagsLower = tags.map((tag) => tag.toLowerCase());

  // Track matches with scores
  const matches: Record<string, number> = {};

  // Check question text against subcategory keywords
  for (const [subcategory, keywords] of Object.entries(subcategories)) {
    let score = 0;
    for (const keyword of keywords) {
      if (questionLower.includes(keyword.toLowerCase())) {
        score += 2; // Higher weight for question matches
      }
    }

    // Check tags against subcategory keywords
    for (const tag of tagsLower) {
      for (const keyword of keywords) {
        if (tag.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
    }

    if (score > 0) {
      matches[subcategory] = score;
    }
  }

  // Return the subcategory with the highest score
  if (Object.keys(matches).length > 0) {
    const sortedMatches = Object.entries(matches).sort((a, b) => b[1] - a[1]);
    return sortedMatches[0][0];
  }

  return null;
}

/**
 * Gets all available subcategories for a given category
 * @param category - The primary category
 * @returns Array of subcategory names
 */
export function getSubcategoriesForCategory(category: string): string[] {
  const subcategories = SUBCATEGORY_KEYWORDS[category];
  if (!subcategories) return [];
  return Object.keys(subcategories);
}

/**
 * Gets all categories and their subcategories
 * @returns Record of category names to their subcategory arrays
 */
export function getAllCategoriesWithSubcategories(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const category of Object.keys(SUBCATEGORY_KEYWORDS)) {
    result[category] = Object.keys(SUBCATEGORY_KEYWORDS[category]);
  }
  return result;
}

/**
 * Parses tags from various formats (string or array)
 * @param tagsData - Tags data that might be a string, array, or already JSON
 * @returns Array of tag strings
 */
export function parseTags(tagsData: any): string[] {
  if (!tagsData) return [];

  if (Array.isArray(tagsData)) return tagsData;

  if (typeof tagsData === "string") {
    try {
      const parsed = JSON.parse(tagsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}
