/**
 * Debate Facilitator Agent
 * Moderates debates and determines when to conclude based on diminishing returns
 */

import { AgentState, InvestDebateState, RiskDebateState } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'

export class InvestmentDebateFacilitator {
  private llm: UnifiedLLMClient
  private maxRounds: number

  constructor(llm: UnifiedLLMClient, maxRounds: number = 3) {
    this.llm = llm
    this.maxRounds = maxRounds
  }

  /**
   * Determine if the debate should continue or conclude
   */
  shouldContinue(debateState: InvestDebateState): boolean {
    // Stop if we've reached max rounds
    if (debateState.count >= this.maxRounds * 2) {
      return false
    }

    // Stop if no new substantial points are being made (repetition detected)
    const recentHistory = debateState.history.split('\n').slice(-4).join('\n')
    if (recentHistory.length > 0 && debateState.count > 2) {
      // Simple heuristic: if recent messages are very similar, stop
      const uniqueWords = new Set(recentHistory.toLowerCase().split(/\s+/))
      if (uniqueWords.size < 50) {
        return false
      }
    }

    return true
  }

  /**
   * Synthesize the debate and make a final decision
   */
  async makeDecision(state: AgentState): Promise<Partial<AgentState>> {
    const { investmentDebateState, companyOfInterest } = state

    const prompt = `You are a Debate Facilitator overseeing an investment debate for ${companyOfInterest}.

**Bull Arguments:**
${investmentDebateState.bullHistory}

**Bear Arguments:**
${investmentDebateState.bearHistory}

**Your Task:**
1. Analyze the strength and validity of arguments from both sides
2. Identify which perspective presents more compelling evidence
3. Consider risk-reward balance and probability of outcomes
4. Make a clear decision: INVEST or NOT INVEST

**Decision Framework:**
- INVEST if bull arguments significantly outweigh bear concerns with strong evidence
- NOT INVEST if bear concerns are substantial or bull case lacks strong support
- Consider probability-weighted outcomes, not just best-case scenarios

Provide your analysis in this structured format:

## Analysis Summary
[2-3 sentences on the key points from each side]

## Winning Arguments
[Which side presented stronger evidence and why]

## Risk-Reward Assessment
[Balance of potential upside vs downside]

## FINAL DECISION
[INVEST or NOT INVEST - must be clear and unambiguous]

## Confidence Level
[High/Medium/Low with brief justification]`

    const response = await this.llm.invoke(prompt)
    const content = response.content

    // Extract structured decision
    const decision = content.toUpperCase().includes('INVEST') && !content.toUpperCase().includes('NOT INVEST')
      ? 'INVEST'
      : 'NOT INVEST'

    const confidenceMatch = content.match(/Confidence Level[\s\S]*?(High|Medium|Low)/i)
    const confidence = confidenceMatch ? confidenceMatch[1] : 'Medium'

    const newInvestmentDebateState: InvestDebateState = {
      ...investmentDebateState,
      judgeDecision: content
    }

    return {
      investmentDebateState: newInvestmentDebateState,
      investmentPlan: decision === 'INVEST'
        ? `Recommendation: INVEST in ${companyOfInterest}\nConfidence: ${confidence}\n\n${content}`
        : `Recommendation: DO NOT INVEST in ${companyOfInterest}\nConfidence: ${confidence}\n\n${content}`
    }
  }
}

export class RiskDebateFacilitator {
  private llm: UnifiedLLMClient
  private maxRounds: number

  constructor(llm: UnifiedLLMClient, maxRounds: number = 2) {
    this.llm = llm
    this.maxRounds = maxRounds
  }

  shouldContinue(debateState: RiskDebateState): boolean {
    return debateState.count < this.maxRounds * 3
  }

  /**
   * Synthesize risk debate and adjust trading plan
   */
  async makeDecision(state: AgentState): Promise<Partial<AgentState>> {
    const { riskDebateState, traderInvestmentPlan, companyOfInterest } = state

    const prompt = `You are a Risk Management Facilitator reviewing the trading plan for ${companyOfInterest}.

**Original Trading Plan:**
${traderInvestmentPlan}

**Risk Perspectives:**

**Risk-Seeking Perspective:**
${riskDebateState.riskyHistory}

**Neutral Perspective:**
${riskDebateState.neutralHistory}

**Risk-Conservative Perspective:**
${riskDebateState.safeHistory}

**Your Task:**
Synthesize these perspectives and adjust the trading plan to balance risk and reward appropriately.

Provide your decision in this structured format:

## Risk Assessment Summary
[Key risks identified and their severity]

## Recommended Adjustments
[Specific modifications to position size, entry/exit criteria, stop-loss levels]

## Final Risk-Adjusted Plan
[Clear, actionable trading plan with risk management parameters]

## Risk Level Classification
[Conservative/Moderate/Aggressive]`

    const response = await this.llm.invoke(prompt)
    const content = response.content

    const newRiskDebateState: RiskDebateState = {
      ...riskDebateState,
      judgeDecision: content
    }

    return {
      riskDebateState: newRiskDebateState,
      finalRiskAdjustedPlan: content
    }
  }
}
