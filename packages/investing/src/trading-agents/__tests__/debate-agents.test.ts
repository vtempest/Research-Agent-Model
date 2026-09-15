/**
 * Vitest Unit Tests for Debate Agents
 * Tests all analyst agents and prints comprehensive stock analysis output
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { MarketAnalyst } from '../agents/market-analyst'
import { NewsAnalyst } from '../agents/news-analyst'
import { ImprovedBullResearcher, ImprovedBearResearcher } from '../agents/improved-researchers'
import { InvestmentDebateFacilitator } from '../agents/debate-facilitator'
import { UnifiedLLMClient } from '../utils/llm-client'
import { FinancialSituationMemory } from '../utils/memory'
import type { AgentState, InvestDebateState } from '../types'

// Test configuration
const TEST_STOCK = process.env.TEST_STOCK || 'AAPL'
const TEST_DATE = process.env.TEST_DATE || new Date().toISOString().split('T')[0]
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'
const DEEP_THINK_MODEL = process.env.DEEP_THINK_MODEL || 'gpt-4'

// The full analysis below drives real LLM calls. Without a provider key every
// agent request fails with 401, so run it only when a key is configured.
const hasLLMKey = Boolean(process.env[`${LLM_PROVIDER.toUpperCase()}_API_KEY`])

describe.runIf(hasLLMKey)('Debate Agents - Complete Stock Analysis', () => {
  let llmClient: UnifiedLLMClient
  let memory: FinancialSituationMemory
  let initialState: AgentState

  beforeAll(() => {
    // Initialize LLM client with environment variables
    llmClient = new UnifiedLLMClient(
      {
        llmProvider: LLM_PROVIDER,
        deepThinkLLM: DEEP_THINK_MODEL,
        quickThinkLLM: process.env.QUICK_THINK_MODEL || 'gpt-3.5-turbo',
        temperature: 0.7,
      },
      DEEP_THINK_MODEL
    )

    // Initialize memory
    memory = new FinancialSituationMemory()

    // Initialize agent state
    const emptyDebateState: InvestDebateState = {
      bullHistory: '',
      bearHistory: '',
      history: '',
      currentResponse: '',
      judgeDecision: '',
      count: 0,
    }

    initialState = {
      companyOfInterest: TEST_STOCK,
      tradeDate: TEST_DATE,
      messages: [],
      sender: '',
      marketReport: '',
      sentimentReport: '',
      newsReport: '',
      fundamentalsReport: '',
      investmentDebateState: emptyDebateState,
      investmentPlan: '',
      traderInvestmentPlan: '',
      riskDebateState: {
        riskyHistory: '',
        safeHistory: '',
        neutralHistory: '',
        history: '',
        latestSpeaker: '',
        currentRiskyResponse: '',
        currentSafeResponse: '',
        currentNeutralResponse: '',
        judgeDecision: '',
        count: 0,
      },
      finalTradeDecision: '',
    }
  })

  describe('Market Technical Analyst', () => {
    it('should analyze market technical indicators for the stock', async () => {
      console.log('\n' + '='.repeat(80))
      console.log(`📊 MARKET TECHNICAL ANALYSIS FOR ${TEST_STOCK}`)
      console.log('='.repeat(80) + '\n')

      const marketAnalyst = new MarketAnalyst(llmClient)
      const result = await marketAnalyst.analyze(initialState)

      console.log(result.marketReport)
      console.log('\n' + '='.repeat(80) + '\n')

      expect(result.marketReport).toBeDefined()
      expect(result.marketReport).toContain(TEST_STOCK)
      expect(result.sender).toBe('MarketAnalyst')

      // Update state for next tests
      initialState.marketReport = result.marketReport!
    }, 60000) // 60 second timeout for API calls
  })

  describe('News Analyst', () => {
    it('should analyze recent news and events for the stock', async () => {
      console.log('\n' + '='.repeat(80))
      console.log(`📰 NEWS ANALYSIS FOR ${TEST_STOCK}`)
      console.log('='.repeat(80) + '\n')

      const newsAnalyst = new NewsAnalyst(llmClient)
      const result = await newsAnalyst.analyze(initialState)

      console.log(result.newsReport)
      console.log('\n' + '='.repeat(80) + '\n')

      expect(result.newsReport).toBeDefined()
      expect(result.sender).toBe('NewsAnalyst')

      // Update state for next tests
      initialState.newsReport = result.newsReport!
    }, 60000)
  })

  describe('Sentiment Analyst', () => {
    it('should provide sentiment analysis placeholder', async () => {
      console.log('\n' + '='.repeat(80))
      console.log(`💭 SENTIMENT ANALYSIS FOR ${TEST_STOCK}`)
      console.log('='.repeat(80) + '\n')

      // Placeholder sentiment report for now
      const sentimentReport = `Social Media Sentiment Analysis for ${TEST_STOCK}:\n\nPositive mentions: Trending discussions about innovation and growth\nNeutral sentiment: Standard trading volume discussions\nNegative mentions: Some concerns about market volatility\n\nOverall Sentiment: Moderately Positive`

      console.log(sentimentReport)
      console.log('\n' + '='.repeat(80) + '\n')

      initialState.sentimentReport = sentimentReport
      expect(initialState.sentimentReport).toBeDefined()
    })
  })

  describe('Fundamentals Analyst', () => {
    it('should provide fundamentals analysis placeholder', async () => {
      console.log('\n' + '='.repeat(80))
      console.log(`📈 FUNDAMENTAL ANALYSIS FOR ${TEST_STOCK}`)
      console.log('='.repeat(80) + '\n')

      // Placeholder fundamentals report
      const fundamentalsReport = `Fundamental Analysis for ${TEST_STOCK}:\n\n## Key Metrics\n- Market Cap: Strong positioning in sector\n- P/E Ratio: Within industry standards\n- Revenue Growth: Consistent year-over-year growth\n- Profit Margins: Healthy and sustainable\n\n## Financial Health\n- Balance Sheet: Strong cash position\n- Debt Levels: Manageable\n- Cash Flow: Positive and growing`

      console.log(fundamentalsReport)
      console.log('\n' + '='.repeat(80) + '\n')

      initialState.fundamentalsReport = fundamentalsReport
      expect(initialState.fundamentalsReport).toBeDefined()
    })
  })

  describe('Bull vs Bear Debate', () => {
    it('should conduct a comprehensive investment debate', async () => {
      console.log('\n' + '='.repeat(80))
      console.log(`🐂 vs 🐻 INVESTMENT DEBATE FOR ${TEST_STOCK}`)
      console.log('='.repeat(80) + '\n')

      const bullResearcher = new ImprovedBullResearcher(llmClient, memory)
      const bearResearcher = new ImprovedBearResearcher(llmClient, memory)
      const facilitator = new InvestmentDebateFacilitator(llmClient, 2) // 2 rounds

      // Round 1: Bull presents first
      console.log('\n--- ROUND 1: BULL ANALYST ---\n')
      let result = await bullResearcher.analyze(initialState)
      initialState = { ...initialState, ...result }
      console.log(result.investmentDebateState?.currentResponse)

      // Round 1: Bear responds
      console.log('\n--- ROUND 1: BEAR ANALYST ---\n')
      result = await bearResearcher.analyze(initialState)
      initialState = { ...initialState, ...result }
      console.log(result.investmentDebateState?.currentResponse)

      // Round 2: Bull counter-argues
      console.log('\n--- ROUND 2: BULL ANALYST ---\n')
      result = await bullResearcher.analyze(initialState)
      initialState = { ...initialState, ...result }
      console.log(result.investmentDebateState?.currentResponse)

      // Round 2: Bear counter-argues
      console.log('\n--- ROUND 2: BEAR ANALYST ---\n')
      result = await bearResearcher.analyze(initialState)
      initialState = { ...initialState, ...result }
      console.log(result.investmentDebateState?.currentResponse)

      // Facilitator makes final decision
      console.log('\n--- DEBATE FACILITATOR DECISION ---\n')
      result = await facilitator.makeDecision(initialState)
      initialState = { ...initialState, ...result }
      console.log(result.investmentPlan)

      console.log('\n' + '='.repeat(80))
      console.log('📊 DEBATE SUMMARY')
      console.log('='.repeat(80) + '\n')

      console.log('Bull Arguments:')
      console.log(initialState.investmentDebateState.bullHistory)
      console.log('\nBear Arguments:')
      console.log(initialState.investmentDebateState.bearHistory)
      console.log('\nFinal Decision:')
      console.log(initialState.investmentPlan)

      console.log('\n' + '='.repeat(80) + '\n')

      expect(initialState.investmentDebateState.bullHistory).toBeDefined()
      expect(initialState.investmentDebateState.bearHistory).toBeDefined()
      expect(initialState.investmentPlan).toBeDefined()
      expect(initialState.investmentDebateState.count).toBeGreaterThan(0)
    }, 180000) // 3 minute timeout for full debate
  })

  describe('Complete Analysis Summary', () => {
    it('should print complete analysis for the stock', async () => {
      console.log('\n' + '='.repeat(80))
      console.log(`📋 COMPLETE INVESTMENT ANALYSIS SUMMARY FOR ${TEST_STOCK}`)
      console.log(`Trade Date: ${TEST_DATE}`)
      console.log('='.repeat(80) + '\n')

      console.log('## 1. TECHNICAL ANALYSIS')
      console.log(initialState.marketReport || 'Not available')

      console.log('\n## 2. NEWS ANALYSIS')
      console.log(initialState.newsReport || 'Not available')

      console.log('\n## 3. SENTIMENT ANALYSIS')
      console.log(initialState.sentimentReport || 'Not available')

      console.log('\n## 4. FUNDAMENTAL ANALYSIS')
      console.log(initialState.fundamentalsReport || 'Not available')

      console.log('\n## 5. BULL CASE')
      console.log(initialState.investmentDebateState.bullHistory || 'Not available')

      console.log('\n## 6. BEAR CASE')
      console.log(initialState.investmentDebateState.bearHistory || 'Not available')

      console.log('\n## 7. FINAL INVESTMENT RECOMMENDATION')
      console.log(initialState.investmentPlan || 'Not available')

      console.log('\n' + '='.repeat(80))
      console.log('✅ ANALYSIS COMPLETE')
      console.log('='.repeat(80) + '\n')

      // Verify all sections have content
      expect(initialState.marketReport).toBeTruthy()
      expect(initialState.newsReport).toBeTruthy()
      expect(initialState.sentimentReport).toBeTruthy()
      expect(initialState.fundamentalsReport).toBeTruthy()
      expect(initialState.investmentDebateState.bullHistory).toBeTruthy()
      expect(initialState.investmentDebateState.bearHistory).toBeTruthy()
      expect(initialState.investmentPlan).toBeTruthy()
    })
  })
})

describe('Individual Agent Unit Tests', () => {
  let llmClient: UnifiedLLMClient

  beforeAll(() => {
    llmClient = new UnifiedLLMClient(
      {
        llmProvider: 'openai',
        deepThinkLLM: 'gpt-4',
        quickThinkLLM: 'gpt-3.5-turbo',
      },
      'gpt-4'
    )
  })

  it('should create MarketAnalyst instance', () => {
    const analyst = new MarketAnalyst(llmClient)
    expect(analyst).toBeDefined()
  })

  it('should create NewsAnalyst instance', () => {
    const analyst = new NewsAnalyst(llmClient)
    expect(analyst).toBeDefined()
  })

  it('should create ImprovedBullResearcher instance', () => {
    const memory = new FinancialSituationMemory()
    const researcher = new ImprovedBullResearcher(llmClient, memory)
    expect(researcher).toBeDefined()
  })

  it('should create ImprovedBearResearcher instance', () => {
    const memory = new FinancialSituationMemory()
    const researcher = new ImprovedBearResearcher(llmClient, memory)
    expect(researcher).toBeDefined()
  })

  it('should create InvestmentDebateFacilitator instance', () => {
    const facilitator = new InvestmentDebateFacilitator(llmClient)
    expect(facilitator).toBeDefined()
  })
})
