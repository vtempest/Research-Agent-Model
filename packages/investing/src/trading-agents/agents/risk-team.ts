/**
 * Risk Management Team
 * Three perspectives: Risky (aggressive), Neutral (balanced), Safe (conservative)
 */

import { AgentState, RiskDebateState } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'
import { FinancialSituationMemory } from '../utils/memory'

export class RiskyAnalyst {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { riskDebateState, traderInvestmentPlan, investmentDebateState, companyOfInterest } = state

    const prompt = `You are a Risk-Seeking Analyst advocating for high-reward, high-risk investment strategies for ${companyOfInterest}.

**Current Trading Plan:**
${traderInvestmentPlan}

**Investment Debate Summary:**
${investmentDebateState.judgeDecision}

**Debate History:**
${riskDebateState.history}

**Your Role:**
As the risk-seeking perspective, you should:
1. Advocate for maximizing position size to capitalize on opportunities
2. Highlight the potential for outsized returns
3. Minimize conservative constraints that might limit gains
4. Push back against overly cautious risk management
5. Engage with other risk perspectives to defend your aggressive stance

**Key Points:**
- Emphasize asymmetric upside potential
- Challenge conservative stop-loss levels as too tight
- Advocate for conviction-weighted sizing
- Use data to show that risk-averse approaches underperform

Present your argument conversationally, engaging with the other analysts' concerns while making a compelling case for higher risk tolerance.`

    const response = await this.llm.invoke(prompt)
    const argument = `Risky Analyst: ${response.content}`

    const newRiskDebateState: RiskDebateState = {
      history: riskDebateState.history + '\n\n' + argument,
      riskyHistory: riskDebateState.riskyHistory + '\n\n' + argument,
      safeHistory: riskDebateState.safeHistory,
      neutralHistory: riskDebateState.neutralHistory,
      latestSpeaker: 'risky',
      currentRiskyResponse: argument,
      currentSafeResponse: riskDebateState.currentSafeResponse,
      currentNeutralResponse: riskDebateState.currentNeutralResponse,
      judgeDecision: riskDebateState.judgeDecision,
      count: riskDebateState.count + 1
    }

    return {
      riskDebateState: newRiskDebateState
    }
  }
}

export class SafeAnalyst {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { riskDebateState, traderInvestmentPlan, investmentDebateState, companyOfInterest } = state

    const prompt = `You are a Risk-Conservative Analyst emphasizing capital preservation and risk mitigation for ${companyOfInterest}.

**Current Trading Plan:**
${traderInvestmentPlan}

**Investment Debate Summary:**
${investmentDebateState.judgeDecision}

**Debate History:**
${riskDebateState.history}

**Last Risky Analyst Argument:**
${riskDebateState.currentRiskyResponse}

**Your Role:**
As the conservative perspective, you should:
1. Prioritize capital preservation over maximum returns
2. Advocate for strict stop-losses and position sizing limits
3. Highlight downside risks and worst-case scenarios
4. Counter aggressive strategies with prudent risk management
5. Ensure the firm's assets are protected from excessive exposure

**Key Points:**
- Emphasize tail risks and maximum drawdown scenarios
- Advocate for diversification and hedging
- Reference historical losses from overleveraged positions
- Push for conservative position sizing (e.g., Kelly Criterion * 0.5)
- Highlight liquidity and execution risks

Engage conversationally with the risky analyst's arguments, providing counterpoints grounded in risk management principles.`

    const response = await this.llm.invoke(prompt)
    const argument = `Safe Analyst: ${response.content}`

    const newRiskDebateState: RiskDebateState = {
      history: riskDebateState.history + '\n\n' + argument,
      riskyHistory: riskDebateState.riskyHistory,
      safeHistory: riskDebateState.safeHistory + '\n\n' + argument,
      neutralHistory: riskDebateState.neutralHistory,
      latestSpeaker: 'safe',
      currentRiskyResponse: riskDebateState.currentRiskyResponse,
      currentSafeResponse: argument,
      currentNeutralResponse: riskDebateState.currentNeutralResponse,
      judgeDecision: riskDebateState.judgeDecision,
      count: riskDebateState.count + 1
    }

    return {
      riskDebateState: newRiskDebateState
    }
  }
}

export class NeutralAnalyst {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { riskDebateState, traderInvestmentPlan, investmentDebateState, companyOfInterest } = state

    const prompt = `You are a Neutral Risk Analyst providing a balanced perspective on risk management for ${companyOfInterest}.

**Current Trading Plan:**
${traderInvestmentPlan}

**Investment Debate Summary:**
${investmentDebateState.judgeDecision}

**Debate History:**
${riskDebateState.history}

**Risky Perspective:**
${riskDebateState.currentRiskyResponse}

**Safe Perspective:**
${riskDebateState.currentSafeResponse}

**Your Role:**
As the neutral perspective, you should:
1. Find the optimal balance between risk and reward
2. Acknowledge valid points from both risky and safe analysts
3. Propose pragmatic middle-ground solutions
4. Use quantitative frameworks (Sharpe ratio, risk-adjusted returns)
5. Focus on expected value and probability-weighted outcomes

**Key Points:**
- Balance conviction sizing with prudent risk limits
- Advocate for dynamic position sizing based on confidence
- Propose tiered entry/exit strategies
- Consider both opportunity cost and downside protection
- Use objective metrics to mediate between extremes

Provide a balanced perspective that synthesizes the best elements from both aggressive and conservative approaches.`

    const response = await this.llm.invoke(prompt)
    const argument = `Neutral Analyst: ${response.content}`

    const newRiskDebateState: RiskDebateState = {
      history: riskDebateState.history + '\n\n' + argument,
      riskyHistory: riskDebateState.riskyHistory,
      safeHistory: riskDebateState.safeHistory,
      neutralHistory: riskDebateState.neutralHistory + '\n\n' + argument,
      latestSpeaker: 'neutral',
      currentRiskyResponse: riskDebateState.currentRiskyResponse,
      currentSafeResponse: riskDebateState.currentSafeResponse,
      currentNeutralResponse: argument,
      judgeDecision: riskDebateState.judgeDecision,
      count: riskDebateState.count + 1
    }

    return {
      riskDebateState: newRiskDebateState
    }
  }
}
