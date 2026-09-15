import { db } from "../../db";
import { polymarketCategories } from "../../db/schema";
import { desc, asc } from "drizzle-orm";

/**
 * Saves category data to the database, replacing all existing categories.
 * @param categoriesData - Array of category objects with tag and PnL data
 */
export async function saveCategories(categoriesData: any[]) {
  const now = Date.now();

  await db.delete(polymarketCategories);

  for (const cat of categoriesData) {
    await db.insert(polymarketCategories).values({
      tag: cat.tag,
      pnl: cat.pnl,
      updatedAt: new Date(now),
    });
  }
}

/**
 * Retrieves best and worst performing categories from the database.
 * @returns Object with "best" and "worst" arrays of category records (top 20 each)
 */
export async function getCategories() {
  const best = await db
    .select()
    .from(polymarketCategories)
    .orderBy(desc(polymarketCategories.pnl))
    .limit(20);

  const worst = await db
    .select()
    .from(polymarketCategories)
    .orderBy(asc(polymarketCategories.pnl))
    .limit(20);

  return { best, worst };
}

/**
 * Analyzes positions to calculate aggregated PnL by category tag.
 * @param allPositions - Array of position objects with tags and PnL data
 * @returns Object with "best" and "worst" arrays of category performance (top 20 each)
 */
export function analyzeCategories(allPositions: any[]) {
  const tagPnl = new Map();

  for (const pos of allPositions) {
    const pnl = Number(
      pos.cash_pnl || pos.cashPnl || pos.realized_pnl || pos.realizedPnl || 0,
    );
    if (!pnl) continue;

    let tags = pos.tags || pos.market_tags || [];
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }

    for (const tag of tags) {
      const prev = tagPnl.get(tag) || 0;
      tagPnl.set(tag, prev + pnl);
    }
  }

  const arr = Array.from(tagPnl.entries()).map(([tag, pnl]) => ({ tag, pnl }));
  arr.sort((a, b) => b.pnl - a.pnl);

  const best = arr.slice(0, 20);
  const worst = [...arr].sort((a, b) => a.pnl - b.pnl).slice(0, 20);

  return { best, worst };
}
