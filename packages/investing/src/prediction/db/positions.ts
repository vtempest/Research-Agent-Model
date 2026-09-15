import { db } from "../../db";
import {
  polymarketPositions,
  polymarketMarketPositions,
  polymarketHolders,
} from "../../db/schema";
import { eq, desc, asc } from "drizzle-orm";

/**
 * Saves or updates position data for a specific trader in the database.
 * @param traderId - The unique identifier of the trader
 * @param positionsData - Array of position objects from the API
 */
export async function savePositions(traderId: string, positionsData: any[]) {
  const now = Date.now();

  for (const pos of positionsData) {
    const tags = JSON.stringify(pos.tags || pos.market_tags || []);
    const posId = `${traderId}-${pos.market_id || pos.id || Math.random()}`;

    await db
      .insert(polymarketPositions)
      .values({
        id: posId,
        traderId: traderId,
        marketId: pos.market_id || pos.id,
        marketTitle: pos.market_title || pos.title || "",
        cashPnl: pos.cashPnl || pos.cash_pnl || 0,
        realizedPnl: pos.realizedPnl || pos.realized_pnl || 0,
        tags: tags,
        createdAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: polymarketPositions.id,
        set: {
          cashPnl: pos.cashPnl || pos.cash_pnl || 0,
          realizedPnl: pos.realizedPnl || pos.realized_pnl || 0,
          tags: tags,
        },
      });
  }
}

/**
 * Saves order book positions for a specific market.
 * Clears existing positions and saves new bids and asks.
 * @param marketId - The unique identifier of the market
 * @param orderBookData - Order book object containing bids and asks arrays
 */
export async function saveMarketPositions(
  marketId: string,
  orderBookData: any,
) {
  const now = Date.now();

  // Clear existing positions for this market
  await db
    .delete(polymarketMarketPositions)
    .where(eq(polymarketMarketPositions.marketId, marketId));

  if (!orderBookData || !orderBookData.bids || !orderBookData.asks) {
    return;
  }

  // Save buy orders (bids)
  for (const bid of orderBookData.bids || []) {
    const posId = `${marketId}-buy-${bid.price}-${Date.now()}-${Math.random()}`;
    await db.insert(polymarketMarketPositions).values({
      id: posId,
      marketId: marketId,
      outcome: bid.outcome || "Yes",
      price: bid.price || 0,
      size: bid.size || 0,
      side: "buy",
      totalValue: (bid.price || 0) * (bid.size || 0),
      createdAt: new Date(now),
    });
  }

  // Save sell orders (asks)
  for (const ask of orderBookData.asks || []) {
    const posId = `${marketId}-sell-${
      ask.price
    }-${Date.now()}-${Math.random()}`;
    await db.insert(polymarketMarketPositions).values({
      id: posId,
      marketId: marketId,
      outcome: ask.outcome || "Yes",
      price: ask.price || 0,
      size: ask.size || 0,
      side: "sell",
      totalValue: (ask.price || 0) * (ask.size || 0),
      createdAt: new Date(now),
    });
  }
}

/**
 * Saves top holders for a specific market.
 * @param marketId - The unique identifier of the market
 * @param holdersData - Array of holder objects
 */
export async function saveHolders(marketId: string, holdersData: any[]) {
  const now = Date.now();

  // Clear existing holders for this market to ensure rank accuracy
  await db
    .delete(polymarketHolders)
    .where(eq(polymarketHolders.marketId, marketId));

  for (const [index, holder] of holdersData.entries()) {
    const address = holder.address || holder.user || holder.proxyWallet || "";
    const id = `${marketId}-${address}-${Date.now()}-${index}`;

    await db.insert(polymarketHolders).values({
      id,
      marketId,
      address,
      userName: holder.userName || holder.username || holder.name || null,
      profileImage: holder.profileImage || holder.image || null,
      rank: index + 1,
      outcome: holder.outcome || holder.side || null, // "Yes" or "No"
      balance: parseFloat(holder.balance || holder.shares || 0),
      value: parseFloat(holder.value || holder.volume || holder.usdValue || 0),
      overallGain: holder.overallGain || holder.pnl || holder.gain || null,
      winRate: holder.winRate ?? null,
      totalProfit: holder.totalProfit ?? null,
      totalLoss: holder.totalLoss ?? null,
      totalPositions: holder.totalPositions ?? null,
      updatedAt: new Date(now),
    });
  }
}

/**
 * Retrieves all positions for a specific trader from the database.
 * @param traderId - The unique identifier of the trader
 * @returns Array of position records for the trader
 */
export async function getTraderPositions(traderId: string) {
  return await db
    .select()
    .from(polymarketPositions)
    .where(eq(polymarketPositions.traderId, traderId));
}

/**
 * Retrieves order book positions for a specific market from the database.
 * @param marketId - The unique identifier of the market
 * @returns Array of position records sorted by total value descending
 */
export async function getMarketPositions(marketId: string) {
  return await db
    .select()
    .from(polymarketMarketPositions)
    .where(eq(polymarketMarketPositions.marketId, marketId))
    .orderBy(desc(polymarketMarketPositions.totalValue));
}

/**
 * Retrieves top holders for a specific market from the database.
 * @param marketId - The unique identifier of the market
 * @param limit - Maximum number of holders to retrieve (default: 10)
 * @returns Array of holder records sorted by rank
 */
export async function getMarketHolders(marketId: string, limit = 10) {
  return await db
    .select()
    .from(polymarketHolders)
    .where(eq(polymarketHolders.marketId, marketId))
    .orderBy(asc(polymarketHolders.rank))
    .limit(limit);
}
