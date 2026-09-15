import { db } from "../../db";
import {
  polymarketTradeHistory,
  polymarketTradeSyncStatus,
} from "../../db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { TraderActivity } from "../api/leaderboard";

/**
 * Saves trade activity records to the database.
 * Uses upsert to handle duplicates.
 * @param traderId - The trader wallet address
 * @param activities - Array of activity records from the API
 * @returns Number of trades saved
 */
export async function saveTradeHistory(
  traderId: string,
  activities: TraderActivity[],
): Promise<number> {
  const now = new Date();
  let savedCount = 0;

  for (const activity of activities) {
    // Create unique ID from transaction hash and outcome index
    const id = `${activity.transactionHash}-${activity.outcomeIndex ?? 0}`;

    try {
      await db
        .insert(polymarketTradeHistory)
        .values({
          id,
          traderId: activity.proxyWallet || traderId,
          transactionHash: activity.transactionHash,
          conditionId: activity.conditionId,
          marketTitle: activity.title || null,
          marketSlug: activity.slug || null,
          eventSlug: activity.eventSlug || null,
          type: activity.type,
          side: activity.side || null,
          outcome: activity.outcome || null,
          outcomeIndex: activity.outcomeIndex ?? null,
          size: parseFloat(activity.size) || 0,
          usdcSize: parseFloat(activity.usdcSize) || 0,
          price: activity.price ? parseFloat(activity.price) : null,
          traderName: activity.pseudonym || null,
          traderBio: activity.bio || null,
          traderProfileImage: activity.profileImage || null,
          timestamp: new Date(activity.timestamp * 1000), // Convert Unix timestamp to Date
          syncedAt: now,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: polymarketTradeHistory.id,
          set: {
            marketTitle: activity.title || null,
            marketSlug: activity.slug || null,
            eventSlug: activity.eventSlug || null,
            traderName: activity.pseudonym || null,
            traderBio: activity.bio || null,
            traderProfileImage: activity.profileImage || null,
            syncedAt: now,
          },
        });

      savedCount++;
    } catch (error) {
      console.error(`Error saving trade ${id}:`, error);
    }
  }

  return savedCount;
}

/**
 * Updates the sync status for a trader.
 * @param traderId - The trader wallet address
 * @param status - Status update fields
 */
export async function updateTradeSyncStatus(
  traderId: string,
  status: {
    syncStatus?: "pending" | "in_progress" | "completed" | "error";
    lastSyncedTimestamp?: Date;
    totalTradesSynced?: number;
    errorMessage?: string | null;
  },
): Promise<void> {
  const now = new Date();

  await db
    .insert(polymarketTradeSyncStatus)
    .values({
      traderId,
      syncStatus: status.syncStatus || "pending",
      lastSyncedTimestamp: status.lastSyncedTimestamp || null,
      totalTradesSynced: status.totalTradesSynced || 0,
      errorMessage: status.errorMessage || null,
      lastSyncAttempt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: polymarketTradeSyncStatus.traderId,
      set: {
        ...(status.syncStatus && { syncStatus: status.syncStatus }),
        ...(status.lastSyncedTimestamp && {
          lastSyncedTimestamp: status.lastSyncedTimestamp,
        }),
        ...(status.totalTradesSynced !== undefined && {
          totalTradesSynced: status.totalTradesSynced,
        }),
        ...(status.errorMessage !== undefined && {
          errorMessage: status.errorMessage,
        }),
        lastSyncAttempt: now,
        updatedAt: now,
      },
    });
}

/**
 * Gets the sync status for a trader.
 * @param traderId - The trader wallet address
 * @returns Sync status record or null if not found
 */
export async function getTradeSyncStatus(traderId: string) {
  const results = await db
    .select()
    .from(polymarketTradeSyncStatus)
    .where(eq(polymarketTradeSyncStatus.traderId, traderId))
    .limit(1);

  return results[0] || null;
}

/**
 * Gets all traders that need syncing (pending or error status).
 * @param limit - Maximum number of traders to return
 * @returns Array of trader IDs
 */
export async function getTradersNeedingSync(limit = 100): Promise<string[]> {
  const results = await db
    .select({ traderId: polymarketTradeSyncStatus.traderId })
    .from(polymarketTradeSyncStatus)
    .where(
      sql`${polymarketTradeSyncStatus.syncStatus} IN ('pending', 'error')`,
    )
    .limit(limit);

  return results.map((r) => r.traderId);
}

/**
 * Gets trade history for a specific trader.
 * @param traderId - The trader wallet address
 * @param options - Query options
 * @returns Array of trade history records
 */
export async function getTraderTradeHistory(
  traderId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {},
) {
  const { limit = 100, offset = 0, type, startDate, endDate } = options;

  const conditions = [eq(polymarketTradeHistory.traderId, traderId)];

  if (type) {
    conditions.push(eq(polymarketTradeHistory.type, type));
  }
  if (startDate) {
    conditions.push(gte(polymarketTradeHistory.timestamp, startDate));
  }
  if (endDate) {
    conditions.push(lte(polymarketTradeHistory.timestamp, endDate));
  }

  return await db
    .select()
    .from(polymarketTradeHistory)
    .where(and(...conditions))
    .orderBy(desc(polymarketTradeHistory.timestamp))
    .limit(limit)
    .offset(offset);
}

/**
 * Gets trade statistics for a trader.
 * @param traderId - The trader wallet address
 * @returns Trade statistics object
 */
export async function getTraderTradeStats(traderId: string) {
  const result = await db
    .select({
      totalTrades: sql<number>`count(*)`,
      totalVolume: sql<number>`sum(${polymarketTradeHistory.usdcSize})`,
      buyCount: sql<number>`sum(case when ${polymarketTradeHistory.side} = 'BUY' then 1 else 0 end)`,
      sellCount: sql<number>`sum(case when ${polymarketTradeHistory.side} = 'SELL' then 1 else 0 end)`,
      firstTradeDate: sql<Date>`min(${polymarketTradeHistory.timestamp})`,
      lastTradeDate: sql<Date>`max(${polymarketTradeHistory.timestamp})`,
      uniqueMarkets: sql<number>`count(distinct ${polymarketTradeHistory.conditionId})`,
    })
    .from(polymarketTradeHistory)
    .where(eq(polymarketTradeHistory.traderId, traderId));

  return result[0] || null;
}

/**
 * Gets the most recent trade timestamp for a trader.
 * Used for incremental syncing.
 * @param traderId - The trader wallet address
 * @returns Unix timestamp of most recent trade or null
 */
export async function getLatestTradeTimestamp(
  traderId: string,
): Promise<number | null> {
  const result = await db
    .select({
      timestamp: sql<number>`max(strftime('%s', ${polymarketTradeHistory.timestamp}))`,
    })
    .from(polymarketTradeHistory)
    .where(eq(polymarketTradeHistory.traderId, traderId));

  return result[0]?.timestamp || null;
}

/**
 * Gets aggregate sync status statistics.
 * @returns Object with sync progress counts
 */
export async function getSyncStatusStats() {
  const result = await db
    .select({
      status: polymarketTradeSyncStatus.syncStatus,
      count: sql<number>`count(*)`,
    })
    .from(polymarketTradeSyncStatus)
    .groupBy(polymarketTradeSyncStatus.syncStatus);

  const stats = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    error: 0,
    total: 0,
  };

  for (const row of result) {
    stats[row.status as keyof typeof stats] = row.count;
    stats.total += row.count;
  }

  return stats;
}
