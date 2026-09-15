import { grab, log } from "grab-url";
import fs from "fs/promises";
import { db } from "../db";
import { nvstlyLeaders, nvstlyTrades } from "../db/schema";
import { eq } from "drizzle-orm";

const LEADERS_FILE = "./data/leaders.json";

interface Trader {
  /** The unique identifier of the trader. */
  id: string;
  /** The name of the trader. */
  name: string;
  /** The rank of the trader among others. */
  rank: number;
  /** The reputation score of the trader. */
  rep: number;
  /** The total number of trades executed by the trader. */
  trades: number;
  /** The win rate percentage of the trader. */
  winRate: number;
  /** The total gain accumulated by the trader. */
  totalGain: number;
  /** The average return per trade for the trader. */
  avgReturn: number;
  /** An array of trades associated with the trader. */
  orders: Trade[];
  /** The broker associated with the trader. */
  broker: string;
}

interface Trade {
  /** The stock symbol of the trade. */
  symbol: string;
  /** The type of trade: 'buy', 'sell', or 'short'. */
  type: "buy" | "sell" | "short";
  /** The price at which the trade was executed. */
  price: number;
  /** The timestamp of the trade in ISO 8601 format. */
  time: string;
  /** The profit on close in percentage, if the trade is closed. */
  gain?: number;
  /** The previous price on open, relevant for closed or short trades. */
  previousPrice?: number;
}

/**
 * NVSTLY API client for fetching trader rankings and trades.
 */
class LeadersAPI {
  api: any;
  constructor() {
    this.api = grab.instance({
      baseURL: "https://db.nvstly.com/api",
      post: true,
      compress: false,
    });
  }

  /**
   * Fetches trader rankings from the NVSTLY API.
   *
   * @param {string} [time='1mo'] - The time frame for the rankings (e.g., '1mo', '3mo', '1y').
   * @param {number} [limit=100] - Maximum number of traders to fetch
   * @returns {Promise<Trader[]>} A promise that resolves to the trader rankings data.
   */
  getTraderRankings = async (time = "1mo", limit = 100): Promise<Trader[]> => {
    try {
      const response = await this.api(`/market/ranks`, {
        time,
        engines: ["stocks"],
        limit, // Request more traders
      });

      console.log(
        `NVSTLY API Response: Fetched ${
          response?.data?.data?.length || 0
        } traders`
      );

      if (!response?.data?.data) {
        console.error("Invalid response from NVSTLY API:", response);
        return [];
      }

      const traders = response.data.data.map((trader: any) => ({
        id: trader.id,
        name: trader.name,
        rank: trader.rank,
        rep: trader.rep,
        trades: trader.trades,
        winRate: Math.floor(trader.winRate),
        totalGain: Math.floor(trader.totalGain),
        avgReturn: Math.floor(trader.avgReturn),
      }));

      console.log(
        `Successfully parsed ${traders.length} traders from NVSTLY API`
      );
      return traders;
    } catch (error) {
      console.error("Error fetching trader rankings:", error);
      return [];
    }
  };

  /**
   * Fetches trader order flow from the NVSTLY API.
   *
   * @param {string} traderId - The ID of the trader to fetch trades for.
   * @param {string} [time='1mo'] - The time frame for the trades (e.g., '1mo', '3mo', '1y').
   * @returns {Promise<Trade[]>} A promise that resolves to the trader rankings data.
   */
  getTraderTrades = async (
    traderId: string,
    time: string = "1mo"
  ): Promise<Trade[]> => {
    try {
      const response = await this.api("/accounts/trades", {
        id: traderId,
        filter: {
          frame: time,
          engines: ["options", "stocks", "crypto", "forex"],
        },
      });

      if (!response?.data?.data) {
        console.warn(`No trades data for trader ${traderId}`);
        return [];
      }

      return response.data.data.map((trade: any) => {
        return {
          symbol: trade.symbol,
          type: trade.type == "short" ? "short" : trade.closed ? "sell" : "buy",
          time: new Date(trade.lastModified).toISOString(),
          price: Number(trade.price.toFixed(2)),
          ...((trade.type == "short" || trade.closed) && {
            previousPrice: Number(trade.previousEntryPrice.toFixed(2)),
          }),
          ...(trade.closed && { gain: Math.floor(trade.gain) }),
        };
      }) as Trade[];
    } catch (error) {
      console.error(`Error fetching trades for trader ${traderId}:`, error);
      return [];
    }
  };
}

export const myLeadersAPI = new LeadersAPI();

export async function syncCopyTradingLeadersOrders() {
  // Fetch up to 100 traders to get all available leaders
  console.log("Starting NVSTLY sync - fetching all available leaders...");
  const traders = await myLeadersAPI.getTraderRankings("1mo", 100);

  if (!traders || traders.length === 0) {
    console.log("Warning: No traders found from NVSTLY API");
    return [];
  }

  console.log(`Found ${traders.length} NVSTLY traders to process`);

  for (let i = 0; i < traders.length; i++) {
    const trader = traders[i];
    const traderId = trader.id;

    console.log(
      `Processing trader ${i + 1}/${traders.length}: ${trader.name} (Rank #${
        trader.rank
      })`
    );

    try {
      // Fetch trader's trades
      const trades = await myLeadersAPI.getTraderTrades(traderId);
      traders[i].orders = trades;
      console.log(`  ✓ Fetched ${trades.length} trades for ${trader.name}`);

      // Save trader to database
      await db
        .insert(nvstlyLeaders)
        .values({
          id: trader.id,
          name: trader.name,
          rank: trader.rank,
          rep: trader.rep,
          trades: trader.trades,
          winRate: trader.winRate,
          totalGain: trader.totalGain,
          avgReturn: trader.avgReturn,
          broker: trader.broker || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: nvstlyLeaders.id,
          set: {
            name: trader.name,
            rank: trader.rank,
            rep: trader.rep,
            trades: trader.trades,
            winRate: trader.winRate,
            totalGain: trader.totalGain,
            avgReturn: trader.avgReturn,
            broker: trader.broker || null,
            updatedAt: new Date(),
          },
        });

      // Delete old trades for this trader
      await db.delete(nvstlyTrades).where(eq(nvstlyTrades.traderId, trader.id));

      // Insert new trades
      if (trades.length > 0) {
        await db.insert(nvstlyTrades).values(
          trades.map((trade, index) => ({
            id: `${trader.id}-${trade.symbol}-${trade.time}-${index}`,
            traderId: trader.id,
            symbol: trade.symbol,
            type: trade.type,
            price: trade.price,
            previousPrice: trade.previousPrice || null,
            gain: trade.gain || null,
            time: new Date(trade.time),
            createdAt: new Date(),
          }))
        );
      }

      console.log(`  ✓ Saved ${trader.name} to database`);
    } catch (error) {
      console.error(`  ✗ Error processing trader ${trader.name}:`, error);
      // Continue with next trader even if this one fails
      traders[i].orders = [];
    }

    // Rate limiting - wait 1 second between each trader to avoid API throttling
    if (i < traders.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Save to JSON for backward compatibility
  try {
    await fs.writeFile(LEADERS_FILE, JSON.stringify(traders, null, 2));
    console.log(`✓ Saved ${traders.length} traders to ${LEADERS_FILE}`);
  } catch (error) {
    console.error("Error saving to JSON file:", error);
  }

  console.log(
    `\n✓ Successfully synced ${traders.length} NVSTLY traders to database`
  );
  return traders;
}
