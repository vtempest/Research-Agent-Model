import { getPriceHistory } from "../db/prices";

/**
 * Calculates price changes for a market based on its price history.
 * @param tokenId - The token ID to get price history for
 * @param currentPrice - The current price of the token
 * @returns Object with daily, weekly, and monthly price changes (in percentage points, 0-100 scale)
 */
export async function calculatePriceChanges(
  tokenId: string,
  currentPrice: number,
): Promise<{
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
}> {
  try {
    // Get price history from database
    const history = await getPriceHistory(tokenId, { interval: "1h" });

    if (!history || history.length === 0) {
      return { daily: null, weekly: null, monthly: null };
    }

    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const oneDay = 24 * 60 * 60;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    // Sort history by timestamp ascending
    const sortedHistory = [...history].sort(
      (a: any, b: any) => a.timestamp - b.timestamp,
    );

    // Find price at different time points
    const findPriceAtTime = (targetTime: number): number | null => {
      // Find the closest price point before or at the target time
      for (let i = sortedHistory.length - 1; i >= 0; i--) {
        if (sortedHistory[i].timestamp <= targetTime) {
          return sortedHistory[i].price;
        }
      }
      return null;
    };

    const dailyPrice = findPriceAtTime(now - oneDay);
    const weeklyPrice = findPriceAtTime(now - oneWeek);
    const monthlyPrice = findPriceAtTime(now - oneMonth);

    return {
      daily: dailyPrice !== null ? (currentPrice - dailyPrice) * 100 : null,
      weekly: weeklyPrice !== null ? (currentPrice - weeklyPrice) * 100 : null,
      monthly:
        monthlyPrice !== null ? (currentPrice - monthlyPrice) * 100 : null,
    };
  } catch (error: any) {
    console.error(
      `Error calculating price changes for token ${tokenId}:`,
      error.message,
    );
    return { daily: null, weekly: null, monthly: null };
  }
}
