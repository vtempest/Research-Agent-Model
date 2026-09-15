import { db } from "../../db";
import { polymarketDebates } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Saves or updates AI-generated debate analysis for a market.
 * @param marketId - The unique identifier of the market
 * @param debateData - Debate analysis data object
 */
export async function saveDebate(
  marketId: string,
  debateData: {
    question: string;
    yesArguments: string[];
    noArguments: string[];
    yesSummary: string;
    noSummary: string;
    keyFactors: string[];
    uncertainties: string[];
    currentYesPrice: number;
    currentNoPrice: number;
    llmProvider?: string;
    model?: string;
  },
) {
  const now = Date.now();
  const debateId = `debate-${marketId}`;

  await db
    .insert(polymarketDebates)
    .values({
      id: debateId,
      marketId: marketId,
      question: debateData.question,
      yesArguments: JSON.stringify(debateData.yesArguments),
      noArguments: JSON.stringify(debateData.noArguments),
      yesSummary: debateData.yesSummary,
      noSummary: debateData.noSummary,
      keyFactors: JSON.stringify(debateData.keyFactors),
      uncertainties: JSON.stringify(debateData.uncertainties),
      currentYesPrice: debateData.currentYesPrice,
      currentNoPrice: debateData.currentNoPrice,
      llmProvider: debateData.llmProvider || null,
      model: debateData.model || null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
    .onConflictDoUpdate({
      target: polymarketDebates.marketId,
      set: {
        question: debateData.question,
        yesArguments: JSON.stringify(debateData.yesArguments),
        noArguments: JSON.stringify(debateData.noArguments),
        yesSummary: debateData.yesSummary,
        noSummary: debateData.noSummary,
        keyFactors: JSON.stringify(debateData.keyFactors),
        uncertainties: JSON.stringify(debateData.uncertainties),
        currentYesPrice: debateData.currentYesPrice,
        currentNoPrice: debateData.currentNoPrice,
        llmProvider: debateData.llmProvider || null,
        model: debateData.model || null,
        updatedAt: new Date(now),
      },
    });
}

/**
 * Retrieves the debate analysis for a specific market from the database.
 * @param marketId - The unique identifier of the market
 * @returns Debate record if found, or null if no debate exists for the market
 */
export async function getMarketDebate(marketId: string) {
  const results = await db
    .select()
    .from(polymarketDebates)
    .where(eq(polymarketDebates.marketId, marketId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}
