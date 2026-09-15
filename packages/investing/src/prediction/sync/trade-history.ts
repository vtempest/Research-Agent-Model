import {
  fetchLeaderboard,
  fetchAllTraderActivity,
  type TraderActivity,
} from "../api/leaderboard";
import {
  saveTradeHistory,
  updateTradeSyncStatus,
  getTradeSyncStatus,
  getLatestTradeTimestamp,
  getSyncStatusStats,
} from "../db/trade-history";
import { saveLeaderboardData } from "../db/leaderboard";

/**
 * Options for syncing trade history
 */
export interface SyncTradeHistoryOptions {
  /** Number of top traders to sync (default: 1000) */
  limit?: number;
  /** Time period for leaderboard ranking: "all", "1d", "7d", "30d" */
  timePeriod?: "all" | "1d" | "7d" | "30d";
  /** Sort order for leaderboard: "VOL" or "PNL" */
  orderBy?: "VOL" | "PNL";
  /** Batch size for processing traders (default: 10) */
  batchSize?: number;
  /** Delay between batches in ms (default: 1000) */
  batchDelay?: number;
  /** Delay between individual traders in ms (default: 200) */
  traderDelay?: number;
  /** Only sync trades newer than this timestamp */
  sinceTimestamp?: number;
  /** Skip traders that have been synced within this many hours (default: 24) */
  skipRecentlysynced?: number;
  /** Progress callback */
  onProgress?: (progress: SyncProgress) => void;
}

/**
 * Progress information for sync operations
 */
export interface SyncProgress {
  currentTrader: number;
  totalTraders: number;
  currentTraderAddress: string;
  tradesFetched: number;
  traderName?: string;
  status: "fetching_leaderboard" | "syncing_trader" | "completed" | "error";
  error?: string;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  tradersProcessed: number;
  tradersSkipped: number;
  tradersFailed: number;
  totalTradesSynced: number;
  duration: number;
  errors: Array<{ traderId: string; error: string }>;
}

/**
 * Fetches and stores the top N traders from the leaderboard.
 * @param limit - Number of traders to fetch
 * @param options - Leaderboard options
 * @returns Array of trader addresses
 */
export async function fetchAndStoreTopTraders(
  limit: number,
  options: {
    timePeriod?: "all" | "1d" | "7d" | "30d";
    orderBy?: "VOL" | "PNL";
  } = {},
): Promise<string[]> {
  const { timePeriod = "all", orderBy = "VOL" } = options;
  const traders: any[] = [];

  // Fetch in batches of 100 (API max is probably limited)
  const batchSize = 100;
  let offset = 0;

  while (traders.length < limit) {
    const batch = await fetchLeaderboard({
      timePeriod,
      orderBy,
      limit: Math.min(batchSize, limit - traders.length),
      offset,
    });

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    traders.push(...batch);
    offset += batchSize;

    // Small delay between fetches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Save leaderboard data to database
  if (traders.length > 0) {
    await saveLeaderboardData(traders);
  }

  // Extract trader addresses
  return traders
    .map(
      (t) =>
        t.trader || t.proxyWallet || t.proxy_wallet || t.address || t.user,
    )
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Syncs trade history for a single trader.
 * @param traderId - The trader wallet address
 * @param options - Sync options
 * @returns Number of trades synced
 */
export async function syncTraderTradeHistory(
  traderId: string,
  options: {
    sinceTimestamp?: number;
    onProgress?: (fetched: number) => void;
  } = {},
): Promise<number> {
  // Update status to in_progress
  await updateTradeSyncStatus(traderId, { syncStatus: "in_progress" });

  try {
    // Get the latest trade timestamp for incremental sync
    let sinceTimestamp = options.sinceTimestamp;
    if (!sinceTimestamp) {
      const latestTimestamp = await getLatestTradeTimestamp(traderId);
      if (latestTimestamp) {
        // Add 1 second to avoid duplicates
        sinceTimestamp = latestTimestamp + 1;
      }
    }

    // Fetch all activity for the trader
    const activities = await fetchAllTraderActivity(
      traderId,
      {
        type: ["TRADE"], // Only fetch actual trades
        start: sinceTimestamp,
      },
      options.onProgress,
    );

    // Save to database
    const savedCount = await saveTradeHistory(traderId, activities);

    // Get total count for status update
    const existingStatus = await getTradeSyncStatus(traderId);
    const totalTrades =
      (existingStatus?.totalTradesSynced || 0) + savedCount;

    // Update status to completed
    await updateTradeSyncStatus(traderId, {
      syncStatus: "completed",
      totalTradesSynced: totalTrades,
      lastSyncedTimestamp: new Date(),
      errorMessage: null,
    });

    return savedCount;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await updateTradeSyncStatus(traderId, {
      syncStatus: "error",
      errorMessage,
    });

    throw error;
  }
}

/**
 * Syncs trade history for the top N leaderboard traders.
 * This is the main entry point for the trade history scraper.
 * @param options - Sync options
 * @returns Sync result with statistics
 */
export async function syncTopTradersTradeHistory(
  options: SyncTradeHistoryOptions = {},
): Promise<SyncResult> {
  const {
    limit = 1000,
    timePeriod = "all",
    orderBy = "VOL",
    batchSize = 10,
    batchDelay = 1000,
    traderDelay = 200,
    sinceTimestamp,
    skipRecentlysynced = 24,
    onProgress,
  } = options;

  const startTime = Date.now();
  const result: SyncResult = {
    tradersProcessed: 0,
    tradersSkipped: 0,
    tradersFailed: 0,
    totalTradesSynced: 0,
    duration: 0,
    errors: [],
  };

  console.log(`Starting trade history sync for top ${limit} traders...`);

  // Step 1: Fetch top traders from leaderboard
  onProgress?.({
    currentTrader: 0,
    totalTraders: limit,
    currentTraderAddress: "",
    tradesFetched: 0,
    status: "fetching_leaderboard",
  });

  const traderAddresses = await fetchAndStoreTopTraders(limit, {
    timePeriod,
    orderBy,
  });

  console.log(`Fetched ${traderAddresses.length} traders from leaderboard`);

  if (traderAddresses.length === 0) {
    console.warn("No traders found in leaderboard");
    result.duration = Date.now() - startTime;
    return result;
  }

  // Step 2: Initialize sync status for all traders
  const recentSyncThreshold = Date.now() - skipRecentlysynced * 60 * 60 * 1000;

  for (const traderId of traderAddresses) {
    const existingStatus = await getTradeSyncStatus(traderId);

    if (!existingStatus) {
      await updateTradeSyncStatus(traderId, { syncStatus: "pending" });
    }
  }

  // Step 3: Process traders in batches
  for (let i = 0; i < traderAddresses.length; i += batchSize) {
    const batch = traderAddresses.slice(i, i + batchSize);

    for (let j = 0; j < batch.length; j++) {
      const traderId = batch[j];
      const traderIndex = i + j;

      // Check if recently synced
      const status = await getTradeSyncStatus(traderId);
      if (
        status?.syncStatus === "completed" &&
        status.lastSyncAttempt &&
        status.lastSyncAttempt.getTime() > recentSyncThreshold
      ) {
        console.log(
          `Skipping ${traderId} - synced within last ${skipRecentlysynced} hours`,
        );
        result.tradersSkipped++;
        continue;
      }

      onProgress?.({
        currentTrader: traderIndex + 1,
        totalTraders: traderAddresses.length,
        currentTraderAddress: traderId,
        tradesFetched: 0,
        status: "syncing_trader",
      });

      try {
        console.log(
          `[${traderIndex + 1}/${traderAddresses.length}] Syncing trades for ${traderId}...`,
        );

        const tradesSynced = await syncTraderTradeHistory(traderId, {
          sinceTimestamp,
          onProgress: (fetched) => {
            onProgress?.({
              currentTrader: traderIndex + 1,
              totalTraders: traderAddresses.length,
              currentTraderAddress: traderId,
              tradesFetched: fetched,
              status: "syncing_trader",
            });
          },
        });

        result.tradersProcessed++;
        result.totalTradesSynced += tradesSynced;

        console.log(`  -> Synced ${tradesSynced} trades for ${traderId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(`  -> Error syncing ${traderId}: ${errorMessage}`);

        result.tradersFailed++;
        result.errors.push({ traderId, error: errorMessage });
      }

      // Delay between traders
      if (j < batch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, traderDelay));
      }
    }

    // Delay between batches
    if (i + batchSize < traderAddresses.length) {
      console.log(`Batch complete. Waiting ${batchDelay}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  result.duration = Date.now() - startTime;

  onProgress?.({
    currentTrader: traderAddresses.length,
    totalTraders: traderAddresses.length,
    currentTraderAddress: "",
    tradesFetched: result.totalTradesSynced,
    status: "completed",
  });

  console.log(`\nTrade history sync completed in ${result.duration}ms`);
  console.log(`  Traders processed: ${result.tradersProcessed}`);
  console.log(`  Traders skipped: ${result.tradersSkipped}`);
  console.log(`  Traders failed: ${result.tradersFailed}`);
  console.log(`  Total trades synced: ${result.totalTradesSynced}`);

  return result;
}

/**
 * Resumes syncing for traders that failed or are pending.
 * @param options - Sync options
 * @returns Sync result
 */
export async function resumeTradeHistorySync(
  options: Omit<SyncTradeHistoryOptions, "limit"> & { limit?: number } = {},
): Promise<SyncResult> {
  const stats = await getSyncStatusStats();

  console.log("Current sync status:");
  console.log(`  Pending: ${stats.pending}`);
  console.log(`  In Progress: ${stats.in_progress}`);
  console.log(`  Completed: ${stats.completed}`);
  console.log(`  Error: ${stats.error}`);

  // Re-run sync with skipRecentlySynced to only process pending/failed
  return syncTopTradersTradeHistory({
    ...options,
    limit: options.limit || stats.pending + stats.error + stats.in_progress,
    skipRecentlysynced: 0, // Don't skip any - let the status check handle it
  });
}

/**
 * Quick utility to get sync progress.
 * @returns Sync status statistics
 */
export async function getTradeHistorySyncProgress() {
  return getSyncStatusStats();
}
