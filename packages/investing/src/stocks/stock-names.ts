/**
 * Stock Names Data Export
 *
 * This module provides access to the stock names database.
 * Data format: [symbol, name, industryId, marketCap, cik]
 */

import stockNamesData from "../stock-names-data/stock-names.json";

export type StockNameEntry = [
  symbol: string,
  name: string,
  industryId: number,
  marketCap: number,
  cik: number,
];

/**
 * Array of all US stock symbols and their metadata.
 * Each entry contains: [symbol, name, industryId, marketCap, cik]
 */
export const stockNames: StockNameEntry[] = stockNamesData as StockNameEntry[];

/**
 * Common suffixes to remove from company names for cleaner display
 */
const COMPANY_NAME_SUFFIXES = [
  // Corporate entity types
  " Inc.",
  " Inc",
  " Incorporated",
  " Corporation",
  " Corp.",
  " Corp",
  " Company",
  " Limited",
  " Ltd.",
  " Ltd",
  " LLC",
  " L.L.C.",
  " PLC",
  " P.L.C.",
  " LP",
  " L.P.",

  // Share classes and types
  " Class A",
  " Class B",
  " Class C",
  " Class D",
  " Class E",
  " Common Stock",
  " Common Shares",
  " Common Share",
  " Ordinary Shares",
  " Ordinary Share",
  " Capital Stock",
  " Depositary Shares",
  " Depositary Share",
  " American Depositary Shares",
  " American Depositary Share",
  " ADS",

  // Securities types
  " Warrants",
  " Warrant",
  " Rights",
  " Preferred Stock",
  " Preferred Shares",
  " Units",

  // Public company indicators
  " Public Company",
  " Publicly Traded",
  " S.A.",
  " SA",
  " N.V.",
  " NV",
  " AB",
  " AG",
  " AS",
  " ASA",
];

/**
 * Cleans a company name by removing common suffixes
 * @param name - The company name to clean
 * @returns The cleaned company name
 */
export function cleanCompanyName(name: string): string {
  if (!name) return name;

  let cleaned = name.trim();

  // Sort suffixes by length (longest first) to match more specific suffixes first
  const sortedSuffixes = [...COMPANY_NAME_SUFFIXES].sort(
    (a, b) => b.length - a.length,
  );

  for (const suffix of sortedSuffixes) {
    // Case insensitive match, allowing for anything after the suffix
    const regex = new RegExp(suffix.replace(/\./g, "\\.") + ".*$", "i");
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, "").trim();
      break; // Stop after first match
    }
  }

  // Remove trailing commas and periods
  cleaned = cleaned.replace(/[,.]$/, "").trim();

  return cleaned;
}

export default stockNames;
