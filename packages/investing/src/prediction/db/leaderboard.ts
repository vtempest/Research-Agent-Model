import { db } from "../../db";
import { polymarketLeaders } from "../../db/schema";
import { desc } from "drizzle-orm";

/**
 * Saves or updates leader data in the database.
 * Uses upsert to update existing records or insert new ones.
 * @param leadersData - Array of leader objects from the API
 */
export async function saveLeaders(leadersData: any[]) {
  const now = Date.now();

  for (const leader of leadersData) {
    await db
      .insert(polymarketLeaders)
      .values({
        trader: leader.trader,
        userName: leader.trader_name || null,
        overallGain: leader.overall_gain || 0,
        winRate: leader.win_rate || 0,
        activePositions: leader.active_positions || 0,
        totalPositions: leader.total_positions || 0,
        currentValue: leader.current_value || 0,
        winAmount: leader.win_amount || 0,
        lossAmount: leader.loss_amount || 0,
        updatedAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: polymarketLeaders.trader,
        set: {
          userName: leader.trader_name || null,
          overallGain: leader.overall_gain || 0,
          winRate: leader.win_rate || 0,
          activePositions: leader.active_positions || 0,
          totalPositions: leader.total_positions || 0,
          currentValue: leader.current_value || 0,
          winAmount: leader.win_amount || 0,
          lossAmount: leader.loss_amount || 0,
          updatedAt: new Date(now),
        },
      });
  }
}

/**
 * Saves or updates leaderboard data in the database.
 * Includes user profile information like username and verification status.
 * @param leaderboardData - Array of leaderboard entries from the API
 */
export async function saveLeaderboardData(leaderboardData: any[]) {
  const now = Date.now();

  for (const entry of leaderboardData) {
    await db
      .insert(polymarketLeaders)
      .values({
        trader: entry.proxyWallet,
        rank: parseInt(entry.rank),
        userName: entry.userName || null,
        xUsername: entry.xUsername || null,
        verifiedBadge: entry.verifiedBadge || false,
        profileImage: entry.profileImage || null,
        vol: entry.vol || 0,
        pnl: entry.pnl || 0,
        updatedAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: polymarketLeaders.trader,
        set: {
          rank: parseInt(entry.rank),
          userName: entry.userName || null,
          xUsername: entry.xUsername || null,
          verifiedBadge: entry.verifiedBadge || false,
          profileImage: entry.profileImage || null,
          vol: entry.vol || 0,
          pnl: entry.pnl || 0,
          updatedAt: new Date(now),
        },
      });
  }
}

/**
 * Retrieves leaders from the database sorted by specified metric.
 * @param orderBy - Sort metric: "vol" for volume, "pnl" for profit/loss, or "overallGain" (default: "vol")
 * @param limit - Maximum number of leaders to retrieve (default: 50)
 * @returns Array of leader records from the database
 */
export async function getLeaders(
  orderBy: "vol" | "pnl" | "overallGain" = "vol",
  limit = 50,
) {
  const orderByColumn =
    orderBy === "vol"
      ? polymarketLeaders.vol
      : orderBy === "pnl"
        ? polymarketLeaders.pnl
        : polymarketLeaders.overallGain;

  return await db
    .select()
    .from(polymarketLeaders)
    .orderBy(desc(orderByColumn))
    .limit(limit);
}
