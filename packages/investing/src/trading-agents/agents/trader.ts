/**
 * Trader Agent
 * Makes final trading decisions based on research and analysis
 */

import { AgentState, Message } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'
import { FinancialSituationMemory } from '../utils/memory'

export class Trader {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async makeDecision(state: AgentState): Promise<Partial<AgentState>> {
    const {
      companyOfInterest,
      investmentPlan,
      marketReport,
      sentimentReport,
      newsReport,
      fundamentalsReport
    } = state

    const currSituation = `${marketReport}\n\n${sentimentReport}\n\n${newsReport}\n\n${fundamentalsReport}`
    const pastMemories = await this.memory.getMemories(currSituation, 2)

    let pastMemoryStr = ''
    if (pastMemories.length > 0) {
      pastMemoryStr = pastMemories.map(m => m.recommendation).join('\n\n')
    } else {
      pastMemoryStr = 'No past memories found.'
    }

    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a trading agent analyzing market data to make investment decisions. Based on your analysis, provide a specific recommendation to buy, sell, or hold. End with a firm decision and always conclude your response with 'FINAL TRANSACTION PROPOSAL: **BUY/HOLD/SELL**' to confirm your recommendation.

Do not forget to utilize lessons from past decisions to learn from your mistakes. Here is some reflections from similar situations you traded in and the lessons learned:

${pastMemoryStr}`
      },
      {
        role: 'user',
        content: `Based on a comprehensive analysis by a team of analysts, here is an investment plan tailored for ${companyOfInterest}. This plan incorporates insights from current technical market trends, macroeconomic indicators, and social media sentiment. Use this plan as a foundation for evaluating your next trading decision.

Proposed Investment Plan: ${investmentPlan}

Leverage these insights to make an informed and strategic decision.`
      }
    ]

    const response = await this.llm.invoke(messages)

    return {
      traderInvestmentPlan: response.content,
      messages: [...state.messages, { role: 'assistant', content: response.content }],
      sender: 'Trader'
    }
  }
}
