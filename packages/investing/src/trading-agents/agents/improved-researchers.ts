/**
 * Improved Bull and Bear Researcher Agents
 * with Structured Communication Protocol and ReAct-style Prompting
 */

import { AgentState, InvestDebateState, StructuredReport } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'
import { FinancialSituationMemory } from '../utils/memory'

/**
 * Generate a structured analyst report
 */
function formatAnalystReport(
  marketReport: string,
  sentimentReport: string,
  newsReport: string,
  fundamentalsReport: string
): string {
  return `## ANALYST REPORTS

### Market Technical Analysis
${marketReport}

### Social Media Sentiment Analysis
${sentimentReport}

### News & Macro Analysis
${newsReport}

### Fundamental Analysis
${fundamentalsReport}`
}

export class ImprovedBullResearcher {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { investmentDebateState, marketReport, sentimentReport, newsReport, fundamentalsReport, companyOfInterest } = state

    // Format structured analyst reports
    const analystReports = formatAnalystReport(marketReport, sentimentReport, newsReport, fundamentalsReport)

    // Get past memories for learning
    const currSituation = `${marketReport}\n\n${newsReport}`
    const pastMemories = await this.memory.getMemories(currSituation, 2)
    const pastMemoryStr = pastMemories.length > 0
      ? pastMemories.map(m => `Past Decision: ${m.recommendation}`).join('\n\n')
      : 'No relevant past experiences found.'

    const prompt = `You are a **Bull Analyst** tasked with evaluating the investment potential of **${companyOfInterest}**.

## YOUR ROLE
Build a compelling, evidence-based case for **WHY to INVEST** in this company. Focus on:
- **Growth Potential**: Market opportunities, revenue expansion, scalability
- **Competitive Advantages**: Unique products, brand strength, market dominance
- **Positive Indicators**: Strong financials, favorable trends, catalysts
- **Risk Mitigation**: How identified risks can be managed or are overstated

## AVAILABLE RESEARCH
${analystReports}

## DEBATE CONTEXT
**Debate History:**
${investmentDebateState.history || 'Debate just starting...'}

**Bear's Last Argument:**
${investmentDebateState.currentResponse || 'Bear has not yet presented arguments.'}

## PAST LEARNINGS
${pastMemoryStr}

## YOUR TASK
Provide a structured bull case using this format:

### 🎯 THOUGHT PROCESS
[Briefly outline your reasoning approach - what evidence weighs most heavily?]

### 📊 KEY BULL ARGUMENTS
1. **[Theme]**: [2-3 sentences with specific data points]
2. **[Theme]**: [2-3 sentences with specific data points]
3. **[Theme]**: [2-3 sentences with specific data points]

### 🛡️ ADDRESSING BEAR CONCERNS
[Directly counter the bear's main objections with evidence]

### 💡 INVESTMENT THESIS
[2-3 sentence summary of why this is a strong investment opportunity]

### 📈 UPSIDE SCENARIO
[What could drive exceptional returns?]

**Guidelines:**
- Be specific with numbers, dates, and sources
- Engage conversationally with the bear's arguments
- Ground arguments in the analyst reports provided
- Learn from past mistakes in memory
- Focus on probability-weighted outcomes, not just best case`

    const response = await this.llm.invoke(prompt)
    const content = response.content

    const argument = `## Bull Analyst Report\n\n${content}`

    const newInvestmentDebateState: InvestDebateState = {
      history: investmentDebateState.history + '\n\n' + argument,
      bullHistory: investmentDebateState.bullHistory + '\n\n' + argument,
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

export class ImprovedBearResearcher {
  private llm: UnifiedLLMClient
  private memory: FinancialSituationMemory

  constructor(llm: UnifiedLLMClient, memory: FinancialSituationMemory) {
    this.llm = llm
    this.memory = memory
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { investmentDebateState, marketReport, sentimentReport, newsReport, fundamentalsReport, companyOfInterest } = state

    // Format structured analyst reports
    const analystReports = formatAnalystReport(marketReport, sentimentReport, newsReport, fundamentalsReport)

    // Get past memories
    const currSituation = `${marketReport}\n\n${newsReport}`
    const pastMemories = await this.memory.getMemories(currSituation, 2)
    const pastMemoryStr = pastMemories.length > 0
      ? pastMemories.map(m => `Past Decision: ${m.recommendation}`).join('\n\n')
      : 'No relevant past experiences found.'

    const prompt = `You are a **Bear Analyst** tasked with assessing the risks of investing in **${companyOfInterest}**.

## YOUR ROLE
Build a rigorous, evidence-based case for **WHY NOT to INVEST** or **WAIT**. Focus on:
- **Risk Factors**: Market risks, competitive threats, regulatory challenges
- **Valuation Concerns**: Overvaluation relative to fundamentals or peers
- **Negative Indicators**: Weak metrics, declining trends, red flags
- **Bull Case Weaknesses**: Flaws in the optimistic scenario

## AVAILABLE RESEARCH
${analystReports}

## DEBATE CONTEXT
**Debate History:**
${investmentDebateState.history || 'Debate just starting...'}

**Bull's Last Argument:**
${investmentDebateState.currentResponse || 'Bull has not yet presented arguments.'}

## PAST LEARNINGS
${pastMemoryStr}

## YOUR TASK
Provide a structured bear case using this format:

### 🎯 THOUGHT PROCESS
[Briefly outline your reasoning approach - which risks are most material?]

### ⚠️ KEY BEAR ARGUMENTS
1. **[Risk Theme]**: [2-3 sentences with specific evidence]
2. **[Risk Theme]**: [2-3 sentences with specific evidence]
3. **[Risk Theme]**: [2-3 sentences with specific evidence]

### 🔍 CHALLENGING BULL ASSUMPTIONS
[Identify and question optimistic assumptions in the bull case]

### 🚨 BASE CASE CONCERNS
[Why the risk-reward is unfavorable or asymmetric to the downside]

### 📉 DOWNSIDE SCENARIO
[What could lead to significant losses?]

**Guidelines:**
- Be specific with data, not just general concerns
- Directly engage with the bull's arguments point-by-point
- Use analyst reports to support your risk assessment
- Learn from past errors reflected in memory
- Consider both high-probability and high-impact risks`

    const response = await this.llm.invoke(prompt)
    const content = response.content

    const argument = `## Bear Analyst Report\n\n${content}`

    const newInvestmentDebateState: InvestDebateState = {
      history: investmentDebateState.history + '\n\n' + argument,
      bullHistory: investmentDebateState.bullHistory,
      bearHistory: investmentDebateState.bearHistory + '\n\n' + argument,
      currentResponse: argument,
      judgeDecision: investmentDebateState.judgeDecision,
      count: investmentDebateState.count + 1
    }

    return {
      investmentDebateState: newInvestmentDebateState
    }
  }
}
