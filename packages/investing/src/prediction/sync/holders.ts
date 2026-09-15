import { fetchMarketDetails, fetchMarketsDashboard } from "../api/analytics";
import { saveHolders } from "../db/positions";

/**
 * Syncs top holders for a specific market.
 * Fetches dashboard data which includes holder information.
 * @param marketId - The unique identifier of the market
 * @param eventId - The event ID required for the dashboard API (optional, can be derived if not provided, but better if provided)
 */
export async function syncMarketHolders(marketId: string, eventId?: string) {
  // If eventId is not provided, we might need to look it up or fetch market details first.
  let targetEventId = eventId;

  if (!targetEventId) {
    // Try to find market in DB to get eventSlug or fetch details
    const market = await fetchMarketDetails(marketId);
    if (market && market.events && market.events.length > 0) {
      targetEventId = market.events[0].id;
    }
  }

  if (!targetEventId) {
    console.warn(
      `Could not determine event ID for market ${marketId}, skipping holders sync.`,
    );
    return { holders: 0 };
  }

  try {
    const dashboard = await fetchMarketsDashboard(targetEventId);

    if (dashboard && dashboard.holders && Array.isArray(dashboard.holders)) {
      await saveHolders(marketId, dashboard.holders);
      return { holders: dashboard.holders.length };
    }

    return { holders: 0 };
  } catch (error) {
    console.error(`Error syncing holders for market ${marketId}:`, error);
    return { holders: 0 };
  }
}
