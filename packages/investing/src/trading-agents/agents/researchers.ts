/**
 * Bull and Bear Researcher Agents
 * Debate whether to invest in a stock
 */

import { AgentState, InvestDebateState } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'
import { FinancialSituationMemory } from '../utils/memory'

export class BullResearcher {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { investmentDebateState, marketReport, sentimentReport, newsReport, fundamentalsReport } = state

    const currSituation = `${marketReport}\n\n${sentimentReport}\n\n${newsReport}\n\n${fundamentalsReport}`
    const pastMemories = await this.memory.getMemories(currSituation, 2)

    let pastMemoryStr = ''
    if (pastMemories.length > 0) {
      pastMemoryStr = pastMemories.map(m => m.recommendation).join('\n\n')
    } else {
      pastMemoryStr = 'No past memories found.'
    }

    const prompt = `You are a Bull Analyst advocating for investing in the stock. Your task is to build a strong, evidence-based case emphasizing growth potential, competitive advantages, and positive market indicators. Leverage the provided research and data to address concerns and counter bearish arguments effectively.

Key points to focus on:
- Growth Potential: Highlight the company's market opportunities, revenue projections, and scalability.
- Competitive Advantages: Emphasize factors like unique products, strong branding, or dominant market positioning.
- Positive Indicators: Use financial health, industry trends, and recent positive news as evidence.
- Bear Counterpoints: Critically analyze the bear argument with specific data and sound reasoning, addressing concerns thoroughly and showing why the bull perspective holds stronger merit.
- Engagement: Present your argument in a conversational style, engaging directly with the bear analyst's points and debating effectively rather than just listing data.

Resources available:
Market research report: ${marketReport}
Social media sentiment report: ${sentimentReport}
Latest world affairs news: ${newsReport}
Company fundamentals report: ${fundamentalsReport}
Conversation history of the debate: ${investmentDebateState.history}
Last bear argument: ${investmentDebateState.currentResponse}
Reflections from similar situations and lessons learned: ${pastMemoryStr}

Use this information to deliver a compelling bull argument, refute the bear's concerns, and engage in a dynamic debate that demonstrates the strengths of the bull position. You must also address reflections and learn from lessons and mistakes you made in the past.`

    const response = await this.llm.invoke(prompt)

    const argument = `Bull Analyst: ${response.content}`

    const newInvestmentDebateState: InvestDebateState = {
      history: investmentDebateState.history + '\n' + argument,
      bullHistory: investmentDebateState.bullHistory + '\n' + argument,
      bearHistory: investmentDebateState.bearHistory,
      currentResponse: argument,
      judgeDecision: investmentDebateState.judgeDecision,
      count: investmentDebateState.count + 1
    }

    return {
      investmentDebateState: newInvestmentDebateState
    }
  }
}

export class BearResearcher {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { investmentDebateState, marketReport, sentimentReport, newsReport, fundamentalsReport } = state

    const currSituation = `${marketReport}\n\n${sentimentReport}\n\n${newsReport}\n\n${fundamentalsReport}`
    const pastMemories = await this.memory.getMemories(currSituation, 2)

    let pastMemoryStr = ''
    if (pastMemories.length > 0) {
      pastMemoryStr = pastMemories.map(m => m.recommendation).join('\n\n')
    } else {
      pastMemoryStr = 'No past memories found.'
    }

    const prompt = `You are a Bear Analyst advocating for caution or avoiding investment in the stock. Your task is to build a strong, evidence-based case emphasizing risks, challenges, and negative market indicators. Use the provided research and data to highlight concerns and counter bullish arguments effectively.

Key points to focus on:
- Risk Factors: Identify market risks, competitive threats, regulatory challenges, or economic headwinds.
- Valuation Concerns: Point out if the stock is overvalued based on fundamentals or technical indicators.
- Negative Indicators: Use weak financial metrics, declining trends, or negative news as evidence.
- Bull Counterpoints: Critically analyze the bull argument with specific data and reasoning, showing why the bear perspective is more prudent.
- Engagement: Present your argument conversationally, directly engaging with the bull analyst's points.

Resources available:
Market research report: ${marketReport}
Social media sentiment report: ${sentimentReport}
Latest world affairs news: ${newsReport}
Company fundamentals report: ${fundamentalsReport}
Conversation history of the debate: ${investmentDebateState.history}
Last bull argument: ${investmentDebateState.currentResponse}
Reflections from similar situations and lessons learned: ${pastMemoryStr}

Use this information to deliver a compelling bear argument, highlight risks, and engage in a dynamic debate. Learn from past mistakes reflected in the memories provided.`

    const response = await this.llm.invoke(prompt)

    const argument = `Bear Analyst: ${response.content}`

    const newInvestmentDebateState: InvestDebateState = {
      history: investmentDebateState.history + '\n' + argument,
      bullHistory: investmentDebateState.bullHistory,
      bearHistory: investmentDebateState.bearHistory + '\n' + argument,
      currentResponse: argument,
      judgeDecision: investmentDebateState.judgeDecision,
      count: investmentDebateState.count + 1
    }

    return {
      investmentDebateState: newInvestmentDebateState
    }
  }
}

export class InvestmentJudge {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async makeDecision(state: AgentState): Promise<Partial<AgentState>> {
    const { investmentDebateState, companyOfInterest } = state

    const prompt = `You are an Investment Judge tasked with evaluating the debate between a Bull Analyst and a Bear Analyst regarding ${companyOfInterest}.

Review the complete debate history:
${investmentDebateState.history}

Based on the arguments presented by both sides:
1. Evaluate the strength of each argument
2. Consider the evidence provided
3. Assess the risks and opportunities
4. Make a final decision: Should we INVEST or NOT INVEST?

Provide your reasoning and conclude with a clear decision: "FINAL DECISION: INVEST" or "FINAL DECISION: NOT INVEST"`

    const response = await this.llm.invoke(prompt)

    const decision = response.content.includes('INVEST') && !response.content.includes('NOT INVEST')
      ? 'INVEST'
      : 'NOT INVEST'

    const newInvestmentDebateState: InvestDebateState = {
      ...investmentDebateState,
      judgeDecision: response.content
    }

    return {
      investmentDebateState: newInvestmentDebateState,
      investmentPlan: decision === 'INVEST'
        ? 'Proceed with investment based on bull arguments'
        : 'Avoid investment due to bear concerns'
    }
  }
}
