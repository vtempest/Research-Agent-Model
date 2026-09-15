// Utility functions for Finnhub API Wrapper

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

/**
 * Map interval from various formats to Finnhub format
 */
export function mapInterval(interval?: string): string {
  const mapping: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "60m": "60",
    "1h": "60",
    "1d": "D",
    "1wk": "W",
    "1mo": "M",
    D: "D",
    W: "W",
    M: "M",
  };
  return mapping[interval || "1d"] || "D";
}

/**
 * Convert date to Unix timestamp
 */
export function toUnixTimestamp(date: string | Date): number {
  if (typeof date === "string") {
    return Math.floor(new Date(date).getTime() / 1000);
  }
  return Math.floor(date.getTime() / 1000);
}

/**
 * Generic fetch function for Finnhub API
 */
export async function finnhubFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
  url.searchParams.set("token", FINNHUB_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `Finnhub API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Map interval to Alpaca timeframe format
 */
export function mapIntervalToAlpacaTimeframe(interval: string): string {
  const mapping: Record<string, string> = {
    "1": "1Min",
    "5": "5Min",
    "15": "15Min",
    "30": "30Min",
    "60": "1Hour",
    "1m": "1Min",
    "5m": "5Min",
    "15m": "15Min",
    "30m": "30Min",
    "1h": "1Hour",
    D: "1Day",
    W: "1Week",
    M: "1Month",
    "1d": "1Day",
    "1wk": "1Week",
    "1mo": "1Month",
  };
  return mapping[interval] || "1Day";
}

/**
 * Map interval to Yahoo Finance's historical() interval format.
 * Yahoo's historical endpoint only supports daily/weekly/monthly bars, so
 * intraday intervals (1m/5m/15m/30m/60m) have no equivalent and return null.
 */
export function mapIntervalToYahoo(
  interval?: string,
): "1d" | "1wk" | "1mo" | null {
  const mapping: Record<string, "1d" | "1wk" | "1mo"> = {
    D: "1d",
    W: "1wk",
    M: "1mo",
    "1d": "1d",
    "1wk": "1wk",
    "1mo": "1mo",
  };
  return mapping[interval || "1d"] || null;
}

/**
 * Get Alpaca API credentials from environment
 */
export function getAlpacaCredentials(): {
  apiKey: string;
  secretKey: string;
} {
  const apiKey =
    process.env.ALPACA_API_KEY ||
    process.env.ALPACA_KEY_ID ||
    process.env.APCA_API_KEY_ID ||
    "";
  const secretKey =
    process.env.ALPACA_SECRET ||
    process.env.ALPACA_SECRET_KEY ||
    process.env.APCA_API_SECRET_KEY ||
    "";

  return { apiKey, secretKey };
}

/**
 * Format date as RFC-3339 (ISO 8601)
 */
export function formatDateRFC3339(date: Date): string {
  return date.toISOString();
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get Finnhub API key
 */
export function getFinnhubApiKey(): string {
  return FINNHUB_API_KEY;
}
