import { syncMarkets } from "./markets";
import { syncLeaderboard, syncLeadersAndCategories } from "./leaderboard";

/**
 * Performs a full synchronization of all Polymarket data.
 * Syncs markets, leaderboard, leaders, positions, and categories.
 * @returns Object with counts of all synced data types
 */
export async function syncAll() {
  console.log("Starting full Polymarket sync...");

  const marketsResult = await syncMarkets();
  const leaderboardResult = await syncLeaderboard({
    limit: 100,
    orderBy: "VOL",
  });
  const leadersResult = await syncLeadersAndCategories();

  return {
    markets: marketsResult.markets,
    leaderboard: leaderboardResult.leaders,
    leaders: leadersResult.leaders,
    positions: leadersResult.positions,
  };
}
