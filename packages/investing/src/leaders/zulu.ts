import { db } from "../db";
import { zuluTraders, zuluCurrencyStats } from "../db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";

// ============================================================================
// Fetching Functions
// ============================================================================

export async function fetchZuluTraders() {
  const resp = await fetch(
    "https://www.zulutrade.com/zulutrade-gateway/api/providers/performance/topTraders/75932/search?flavorId=1&accessingFlavorId=1",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
    }
  );

  if (!resp.ok) throw new Error(`Zulu fetch failed: ${resp.status}`);
  const data = await resp.json();
  return data.result || [];
}

export async function fetchZuluTraderDetail(providerId: number) {
  const resp = await fetch(
    `https://www.zulutrade.com/zulutrade-gateway/v2/api/providers/${providerId}/thi/init?accessingFlavorId=1&flavor=global`,
    {
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
    }
  );

  if (!resp.ok)
    throw new Error(`Zulu trader detail fetch failed: ${resp.status}`);
  return await resp.json();
}

// ============================================================================
// Database Operations
// ============================================================================

export async function saveZuluTraders(traders: any[]) {
  const now = Date.now();

  for (const t of traders) {
    const trader = t.trader;
    const profile = trader.profile;
    const stats = trader.overallStats;

    const timeframeStats = stats.timeframeStats || {};
    const latestTimeframe = Object.values(timeframeStats)[0] || {};

    await db
      .insert(zuluTraders)
      .values({
        providerId: trader.providerId,
        name: profile.name,
        strategyDesc: profile.strategyDesc || null,
        countryCode: profile.countryIsoCode,
        countryName: profile.countryName,
        brokerName: profile.brokerName,
        balance: stats.balance || 0,
        equity: stats.equity || 0,
        followers: stats.followers || 0,
        liveFollowers: stats.liveFollowers || 0,
        roiAnnualized: stats.roiAnnualized || 0,
        roiProfit: stats.roiProfit || 0,
        zuluRank: stats.zuluRank || 0,
        bestTrade: stats.bestTrade || 0,
        worstTrade: stats.worstTrade || 0,
        profitableTrades: stats.profitableTrades || 0,
        losingTrades: stats.losingTrades || 0,
        avgDrawdown: stats.avgDrawdown || 0,
        maxDrawdown: stats.overallDrawDownInMoney || 0,
        maxDrawdownPercent: (latestTimeframe as any).maxDrawDownPercent || 0,
        leverage: profile.leverage || 0,
        isEa: trader.badges?.ea ? 1 : 0,
        currencies: stats.providerCurrencies || "",
        weeks: stats.weeks || 0,
        demo: profile.demo ? 1 : 0,
        avgTradeSeconds: (latestTimeframe as any).avgTradeSeconds || 0,
        avgPnlPerTrade: (latestTimeframe as any).avgPnlPerTrade || 0,
        winRate: (latestTimeframe as any).winTrades || 0,
        totalTrades: (latestTimeframe as any).trades || 0,
        pageVisits: profile.pageVisits || 0,
        includedInWatchlist: stats.includedInWatchlist || 0,
        registrationDate: profile.registrationDate
          ? new Date(profile.registrationDate)
          : null,
        lastOpenTradeDate: stats.lastOpenTradeDate
          ? new Date(stats.lastOpenTradeDate)
          : null,
        updatedAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: zuluTraders.providerId,
        set: {
          name: profile.name,
          strategyDesc: profile.strategyDesc || null,
          countryCode: profile.countryIsoCode,
          countryName: profile.countryName,
          brokerName: profile.brokerName,
          balance: stats.balance || 0,
          equity: stats.equity || 0,
          followers: stats.followers || 0,
          liveFollowers: stats.liveFollowers || 0,
          roiAnnualized: stats.roiAnnualized || 0,
          roiProfit: stats.roiProfit || 0,
          zuluRank: stats.zuluRank || 0,
          bestTrade: stats.bestTrade || 0,
          worstTrade: stats.worstTrade || 0,
          profitableTrades: stats.profitableTrades || 0,
          losingTrades: stats.losingTrades || 0,
          avgDrawdown: stats.avgDrawdown || 0,
          maxDrawdown: stats.overallDrawDownInMoney || 0,
          maxDrawdownPercent: (latestTimeframe as any).maxDrawDownPercent || 0,
          leverage: profile.leverage || 0,
          isEa: trader.badges?.ea ? 1 : 0,
          currencies: stats.providerCurrencies || "",
          weeks: stats.weeks || 0,
          demo: profile.demo ? 1 : 0,
          avgTradeSeconds: (latestTimeframe as any).avgTradeSeconds || 0,
          avgPnlPerTrade: (latestTimeframe as any).avgPnlPerTrade || 0,
          winRate: (latestTimeframe as any).winTrades || 0,
          totalTrades: (latestTimeframe as any).trades || 0,
          pageVisits: profile.pageVisits || 0,
          includedInWatchlist: stats.includedInWatchlist || 0,
          registrationDate: profile.registrationDate
            ? new Date(profile.registrationDate)
            : null,
          lastOpenTradeDate: stats.lastOpenTradeDate
            ? new Date(stats.lastOpenTradeDate)
            : null,
          updatedAt: new Date(now),
        },
      });

    if (trader.currencyStats && trader.currencyStats.length > 0) {
      await saveZuluCurrencyStats(trader.providerId, trader.currencyStats);
    }
  }
}

export async function saveZuluCurrencyStats(providerId: number, stats: any[]) {
  const now = Date.now();

  for (const stat of stats) {
    const id = `${providerId}-${stat.currencyName}`;

    await db
      .insert(zuluCurrencyStats)
      .values({
        id,
        providerId,
        currencyName: stat.currencyName,
        totalCount: stat.totalCurrencyCount || 0,
        winCount: stat.currencyWinCount || 0,
        winPercent: stat.currencyWinPercent || 0,
        totalBuyCount: stat.totalCurrencyBuyCount || 0,
        totalSellCount: stat.totalCurrencySellCount || 0,
        pips: stat.pips || 0,
        createdAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: zuluCurrencyStats.id,
        set: {
          totalCount: stat.totalCurrencyCount || 0,
          winCount: stat.currencyWinCount || 0,
          winPercent: stat.currencyWinPercent || 0,
          totalBuyCount: stat.totalCurrencyBuyCount || 0,
          totalSellCount: stat.totalCurrencySellCount || 0,
          pips: stat.pips || 0,
        },
      });
  }
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getZuluTraders(limit = 50) {
  return await db
    .select()
    .from(zuluTraders)
    .orderBy(desc(zuluTraders.roiAnnualized))
    .limit(limit);
}

export async function getZuluTraderById(providerId: number) {
  const trader = await db
    .select()
    .from(zuluTraders)
    .where(eq(zuluTraders.providerId, providerId))
    .limit(1);

  if (trader.length === 0) return null;

  const currencies = await db
    .select()
    .from(zuluCurrencyStats)
    .where(eq(zuluCurrencyStats.providerId, providerId));

  return {
    ...trader[0],
    currencyStats: currencies,
  };
}

export async function getZuluTopByRank(limit = 50) {
  return await db
    .select()
    .from(zuluTraders)
    .orderBy(asc(zuluTraders.zuluRank))
    .limit(limit);
}

export async function searchZuluTraders(filters: any) {
  let query = db.select().from(zuluTraders);

  if (filters.minRoi) {
    query = query.where(
      sql`${zuluTraders.roiAnnualized} >= ${filters.minRoi}`
    ) as any;
  }
  if (filters.minWinRate) {
    query = query.where(
      sql`${zuluTraders.winRate} >= ${filters.minWinRate}`
    ) as any;
  }
  if (filters.maxDrawdown) {
    query = query.where(
      sql`${zuluTraders.maxDrawdownPercent} <= ${filters.maxDrawdown}`
    ) as any;
  }
  if (filters.isEa !== undefined) {
    query = query.where(eq(zuluTraders.isEa, filters.isEa ? 1 : 0)) as any;
  }

  return await query
    .orderBy(desc(zuluTraders.roiAnnualized))
    .limit(filters.limit || 50);
}

// ============================================================================
// Main Sync Functions
// ============================================================================

export async function syncZuluTraders() {
  console.log("Starting Zulu sync...");

  const traders = await fetchZuluTraders();
  await saveZuluTraders(traders);

  console.log(`Saved ${traders.length} Zulu traders`);

  return { traders: traders.length };
}

export async function syncZuluTraderDetails(providerIds: number[]) {
  console.log(`Syncing details for ${providerIds.length} traders...`);

  const details = [];
  for (const id of providerIds) {
    try {
      const detail = await fetchZuluTraderDetail(id);
      details.push(detail);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`Failed to fetch trader ${id}:`, error.message);
    }
  }

  if (details.length > 0) {
    await saveZuluTraders(details.map((d) => ({ trader: d.trader.stats })));
  }

  console.log(`Saved ${details.length} trader details`);
  return { details: details.length };
}
