/**
 * Fund Manager Agent
 * Final approval authority for all trading decisions
 */

import { AgentState } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'

export class FundManager {
  private llm: UnifiedLLMClient

  constructor(llm: UnifiedLLMClient) {
    this.llm = llm
  }

  /**
   * Review all analysis and make final approval decision
   */
  async makeDecision(state: AgentState): Promise<Partial<AgentState>> {
    const {
      companyOfInterest,
      investmentDebateState,
      riskDebateState,
      traderInvestmentPlan,
      finalRiskAdjustedPlan
    } = state

    const prompt = `You are the **Fund Manager** with final approval authority for all trading decisions for **${companyOfInterest}**.

## INVESTMENT DEBATE OUTCOME
${investmentDebateState.judgeDecision}

## RISK MANAGEMENT ASSESSMENT
${riskDebateState.judgeDecision}

## TRADER'S RECOMMENDATION
${traderInvestmentPlan}

## RISK-ADJUSTED PLAN
${finalRiskAdjustedPlan}

## YOUR RESPONSIBILITY
As Fund Manager, you must:
1. Review all team recommendations and risk assessments
2. Ensure alignment with fund objectives and risk tolerance
3. Make the final GO/NO-GO decision
4. Specify exact execution parameters if approved

## DECISION FRAMEWORK
Consider:
- **Conviction Level**: How strong is the evidence across all teams?
- **Risk-Reward**: Does the setup justify the capital allocation?
- **Timing**: Is now the right time to enter this position?
- **Portfolio Fit**: How does this fit with current holdings?
- **Downside Protection**: Are risk controls adequate?

Provide your decision in this structured format:

### EXECUTIVE SUMMARY
[2-3 sentence high-level assessment]

### DECISION
**[APPROVE/REJECT/MODIFY]**

### RATIONALE
[Key factors influencing your decision]

### EXECUTION PARAMETERS (if APPROVE or MODIFY)
- Position Size: [% of portfolio or $ amount]
- Entry Strategy: [market order, limit order at $X, etc.]
- Stop Loss: [price level or % from entry]
- Target Exit: [price targets or conditions]
- Maximum Hold Period: [time limit if applicable]

### ADDITIONAL INSTRUCTIONS
[Any special instructions for execution or monitoring]

**Note**: Your decision is final. All trades must have your explicit approval.`

    const response = await this.llm.invoke(prompt)
    const content = response.content

    // Extract decision
    const decisionMatch = content.match(/DECISION[\s\S]*?\*\*\[(APPROVE|REJECT|MODIFY)\]\*\*/i)
    const decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'REJECT'

    // Extract position size if approved
    let positionSize = null
    if (decision === 'APPROVE' || decision === 'MODIFY') {
      const positionMatch = content.match(/Position Size:[\s]*([^\n]+)/i)
      if (positionMatch) {
        positionSize = positionMatch[1].trim()
      }
    }

    return {
      fundManagerDecision: content,
      finalApproval: decision,
      approvedPositionSize: positionSize,
      finalTradeDecision: decision === 'APPROVE' || decision === 'MODIFY' ? 'BUY' : 'HOLD'
    }
  }
}
