import {
  fetchLeaderboard,
  fetchTopTraders,
  fetchTraderPositions,
} from "../api/leaderboard";
import {
  saveLeaders,
  saveLeaderboardData,
} from "../db/leaderboard";
import { savePositions } from "../db/positions";
import { analyzeCategories, saveCategories } from "../analysis/categories";

// Define Position type for type safety
interface Position {
  market_id?: string;
  id?: string;
  market_title?: string;
  title?: string;
  cashPnl?: number;
  cash_pnl?: number;
  realizedPnl?: number;
  realized_pnl?: number;
  tags?: string[];
  market_tags?: string[];
}

/**
 * Syncs leaderboard data from Polymarket API to the database.
 * @param options - Sync configuration options
 * @param options.timePeriod - Time period filter: "all", "1d", "7d", or "30d"
 * @param options.orderBy - Sort order: "VOL" for volume or "PNL" for profit/loss
 * @param options.limit - Maximum number of entries to sync
 * @returns Object with count of synced leaderboard entries
 */
export async function syncLeaderboard(
  options: {
    timePeriod?: "all" | "1d" | "7d" | "30d";
    orderBy?: "VOL" | "PNL";
    limit?: number;
  } = {},
) {
  console.log("Starting Polymarket leaderboard sync...");

  const leaderboard: any = await fetchLeaderboard(options);
  await saveLeaderboardData(leaderboard);
  console.log(`Saved ${leaderboard.length} leaderboard entries`);

  return { leaders: leaderboard.length };
}

/**
 * Syncs top traders, their positions, and category analytics from Polymarket.
 * Fetches top 50 traders, retrieves all their positions, and calculates category performance.
 * @returns Object with counts of synced leaders and positions
 */
export async function syncLeadersAndCategories() {
  console.log("Starting Polymarket sync...");

  const leaders = await fetchTopTraders(50);
  await saveLeaders(leaders);
  console.log(`Saved ${leaders.length} leaders`);

  const allPositions = [];
  for (const trader of leaders) {
    const traderId = trader.trader;
    const positions = (await fetchTraderPositions(traderId)) as Position[];
    await savePositions(traderId, positions);
    allPositions.push(...positions);
    console.log(`Saved positions for trader ${traderId}`);
  }

  const categories = analyzeCategories(allPositions);
  await saveCategories([...categories.best, ...categories.worst]);
  console.log(
    `Saved ${categories.best.length + categories.worst.length} categories`,
  );

  return { leaders: leaders.length, positions: allPositions.length };
}
