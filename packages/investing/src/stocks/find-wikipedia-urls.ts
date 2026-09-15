/**
 * Script to find Wikipedia URLs for each stock symbol's company
 * Uses the Wikipedia Search API to find the most relevant page
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// https://finnhub.io/docs/api/stock-uspto-patent

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StockEntry {
  name: string;
  wikiTitle: string | null;
  error?: string;
}

type StockResults = Record<string, StockEntry>;

interface WikiSearchResult {
  query?: {
    search: Array<{
      title: string;
      pageid: number;
      snippet: string;
    }>;
  };
}

interface WikiParseResult {
  parse?: {
    title: string;
    wikitext?: {
      "*": string;
    };
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Patterns that indicate ETFs, indexes, funds, or non-company securities
const ETF_PATTERNS = [
  /\bETF\b/i,
  /\bIndex\b/i,
  /\bFund\b/i,
  /\bTrust\b/i,
  /\bShares\b/i,
  /\bProShares\b/i,
  /\bDirexion\b/i,
  /\biShares\b/i,
  /\bSPDR\b/i,
  /\bVanguard\b/i,
  /\bInvesco\b/i,
  /\bWisdomTree\b/i,
  /\bFirst Trust\b/i,
  /\bGlobal X\b/i,
  /\bVanEck\b/i,
  /\bSchwab\b/i,
  /\bState Street\b/i,
  /\bARK\b/,
  /\bLeverage\b/i,
  /\bUltra\b/i,
  /\bBear\b/i,
  /\bBull\b/i,
  /\b2[Xx]\b/,
  /\b3[Xx]\b/,
  /\bShort\b/i,
  /\bInverse\b/i,
  /\bNotes?\b/i,
  /\bWarrants?\b/i,
  /\bUnits?\b/i,
  /\bDebentures?\b/i,
  /\bPreferred\b/i,
  /\bClass [A-Z]\b/i,
  /\bSeries [A-Z]\b/i,
  /\bADR\b/i,
  /\bADS\b/i,
  /\bSPAC\b/i,
  /Acquisition Corp/i,
  /Holdings? (?:Ltd|LLC|LP|Inc)/i,
];

/**
 * Check if a stock name looks like an ETF or non-company security
 */
function isETFOrFund(name: string, symbol: string): boolean {
  // Name equals symbol (no real name)
  if (name === symbol) return true;

  // Name too short
  if (name.length <= 4) return true;

  // Check against ETF patterns
  for (const pattern of ETF_PATTERNS) {
    if (pattern.test(name)) return true;
  }

  return false;
}

/**
 * Check if a Wikipedia page has a stock symbol infobox
 */
async function hasStockInfobox(pageTitle: string): Promise<boolean> {
  const encodedTitle = encodeURIComponent(pageTitle);
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=wikitext&section=0&format=json`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as WikiParseResult;
    const wikitext = data.parse?.wikitext?.["*"] ?? "";

    // Check for stock-related infobox patterns
    const hasInfobox =
      /\{\{Infobox company/i.test(wikitext) ||
      /\|[\s]*traded_as[\s]*=/i.test(wikitext) ||
      /\|[\s]*symbol[\s]*=/i.test(wikitext) ||
      /\|[\s]*stock[\s]*=/i.test(wikitext) ||
      /NYSE[:|\s]/i.test(wikitext) ||
      /NASDAQ[:|\s]/i.test(wikitext) ||
      /\{\{NYSE\|/i.test(wikitext) ||
      /\{\{NASDAQ\|/i.test(wikitext);

    return hasInfobox;
  } catch {
    return false;
  }
}

/**
 * Search Wikipedia for a company and return the page title with validation
 */
async function searchWikipedia(
  companyName: string,
  symbol: string,
  maxRetries = 3,
): Promise<{ title: string; verified: boolean } | null> {
  // Skip ETFs and non-company securities
  if (isETFOrFund(companyName, symbol)) {
    return null;
  }

  const searchQuery = encodeURIComponent(`${companyName} company`);
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=1`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "StockWikiLookup/1.0 (educational project)",
        },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") || "5",
          10,
        );
        const waitTime = Math.max(retryAfter * 1000, attempt * 2000);
        console.log(
          `Rate limited for ${companyName}, waiting ${waitTime}ms (attempt ${attempt}/${maxRetries})`,
        );
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        console.error(`Failed to fetch for ${companyName}: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as WikiSearchResult;

      if (data.query && data.query.search.length > 0) {
        const firstResult = data.query.search[0];
        const pageTitle = firstResult.title;

        // Verify the page has stock infobox
        await sleep(200); // Small delay before verification request
        const verified = await hasStockInfobox(pageTitle);

        return { title: pageTitle, verified };
      }

      return null;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Error searching for ${companyName}:`, error);
        return null;
      }
      await sleep(attempt * 1000);
    }
  }

  return null;
}

/**
 * Save current progress to file
 */
function saveProgress(results: StockResults, outputPath: string): void {
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
}

/**
 * Process stocks sequentially with rate limiting to avoid 429 errors
 */
async function processStocks(
  stocks: Array<[string, string, ...unknown[]]>,
  outputPath: string,
  delayMs = 500,
  startIndex = 0,
  existingResults: StockResults = {},
): Promise<StockResults> {
  const results: StockResults = { ...existingResults };

  for (let i = startIndex; i < stocks.length; i++) {
    const [symbol, name] = stocks[i];
    const wikiResult = await searchWikipedia(name, symbol);

    const entry: StockEntry = {
      name,
      wikiTitle: wikiResult?.title ?? null,
    };

    // Add error if page found but no stock infobox
    if (wikiResult && !wikiResult.verified) {
      entry.error = "potential miss";
    }

    results[symbol] = entry;

    // Print progress and save every 10 stocks
    if ((i + 1) % 10 === 0 || i === stocks.length - 1) {
      const values = Object.values(results);
      const foundCount = values.filter((r) => r.wikiTitle !== null).length;
      const verifiedCount = values.filter(
        (r) => r.wikiTitle !== null && !r.error,
      ).length;
      const status = wikiResult ? (wikiResult.verified ? "✓" : "?") : "✗";
      console.log(
        `[${i + 1}/${stocks.length}] ${verifiedCount} verified, ${foundCount - verifiedCount} potential miss. Last: ${symbol} ${status} ${wikiResult?.title ?? "not found"}`,
      );
      saveProgress(results, outputPath);
    }

    // Rate limiting delay between requests
    if (i < stocks.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

async function main() {
  console.log("Loading stock names...");
  const stockNamesPath = join(__dirname, "stock-names.json");
  const stockData: Array<[string, string, ...unknown[]]> = JSON.parse(
    readFileSync(stockNamesPath, "utf-8"),
  );

  console.log(`Found ${stockData.length} total entries`);

  // Filter out ETFs, funds, and non-company securities
  const validStocks = stockData.filter(
    ([symbol, name]) => !isETFOrFund(name, symbol),
  );
  const skippedCount = stockData.length - validStocks.length;
  console.log(`Skipping ${skippedCount} ETFs/funds/non-company securities`);
  console.log(`Processing ${validStocks.length} company stocks`);

  // Output file path
  const outputPath = join(__dirname, "stock-wikipedia-urls.json");

  // Check for existing results to resume from
  let existingResults: StockResults = {};
  let startIndex = 0;

  if (existsSync(outputPath)) {
    try {
      existingResults = JSON.parse(
        readFileSync(outputPath, "utf-8"),
      ) as StockResults;
      startIndex = Object.keys(existingResults).length;
      console.log(
        `Resuming from index ${startIndex} (${startIndex} already processed)`,
      );
    } catch {
      console.log("Could not parse existing results, starting fresh");
    }
  }

  // Process sequentially with 500ms delay to avoid rate limiting
  const results = await processStocks(
    validStocks,
    outputPath,
    500,
    startIndex,
    existingResults,
  );

  // Count how many were found
  const values = Object.values(results);
  const foundCount = values.filter((r) => r.wikiTitle !== null).length;
  const verifiedCount = values.filter(
    (r) => r.wikiTitle !== null && !r.error,
  ).length;
  const potentialMissCount = values.filter((r) => r.error).length;
  const totalCount = Object.keys(results).length;
  console.log(`\nResults for ${totalCount} stocks:`);
  console.log(`  - ${verifiedCount} verified (has stock infobox)`);
  console.log(`  - ${potentialMissCount} potential misses (no stock infobox)`);
  console.log(`  - ${totalCount - foundCount} not found`);

  // Final save
  saveProgress(results, outputPath);
  console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
