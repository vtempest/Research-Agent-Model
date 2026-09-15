/**
 * Trading Agents Graph
 * Main orchestrator for the multi-agent trading system
 */

import {
  AgentState,
  InvestDebateState,
  RiskDebateState,
  TradingConfig,
  TradeSignal,
  AnalystType
} from '../types'
import { createLLM, UnifiedLLMClient } from '../utils/llm-client'
import { FinancialSituationMemory } from '../utils/memory'
import { MarketAnalyst } from '../agents/market-analyst'
import { BullResearcher, BearResearcher, InvestmentJudge } from '../agents/researchers'
import { Trader } from '../agents/trader'
import { NewsAnalyst } from '../agents/news-analyst'

const DEFAULT_CONFIG: TradingConfig = {
  llmProvider: 'groq',
  deepThinkLLM: 'llama3-70b-8192',
  quickThinkLLM: 'llama3-8b-8192',
  temperature: 0.3,
  projectDir: './data',
  apiKeys: {
    groq: process.env.GROQ_API_KEY || ''
  }
}

export class TradingAgentsGraph {
  private config: TradingConfig
  private deepThinkingLLM: UnifiedLLMClient
  private quickThinkingLLM: UnifiedLLMClient
  private selectedAnalysts: AnalystType[]
  private debug: boolean

  // Memories
  private bullMemory: FinancialSituationMemory
  private bearMemory: FinancialSituationMemory
  private traderMemory: FinancialSituationMemory
  private investJudgeMemory: FinancialSituationMemory
  private riskManagerMemory: FinancialSituationMemory

  // Agents
  private marketAnalyst: MarketAnalyst
  private bullResearcher: BullResearcher
  private bearResearcher: BearResearcher
  private investmentJudge: InvestmentJudge
  private trader: Trader
  private newsAnalyst: NewsAnalyst

  // State tracking
  private currentState: AgentState | null = null
  private ticker: string | null = null
  private logStatesDict: Record<string, any> = {}

  constructor(
    selectedAnalysts: AnalystType[] = ['market', 'social', 'news', 'fundamentals'],
    debug: boolean = false,
    config?: TradingConfig
  ) {
    this.selectedAnalysts = selectedAnalysts
    this.debug = debug
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Initialize LLMs
    this.deepThinkingLLM = createLLM(this.config, this.config.deepThinkLLM)
    this.quickThinkingLLM = createLLM(this.config, this.config.quickThinkLLM)

    // Initialize memories
    this.bullMemory = new FinancialSituationMemory('bull_memory', this.config)
    this.bearMemory = new FinancialSituationMemory('bear_memory', this.config)
    this.traderMemory = new FinancialSituationMemory('trader_memory', this.config)
    this.investJudgeMemory = new FinancialSituationMemory('invest_judge_memory', this.config)
    this.riskManagerMemory = new FinancialSituationMemory('risk_manager_memory', this.config)

    // Initialize agents
    this.marketAnalyst = new MarketAnalyst(this.deepThinkingLLM)
    this.bullResearcher = new BullResearcher(this.deepThinkingLLM, this.bullMemory)
    this.bearResearcher = new BearResearcher(this.deepThinkingLLM, this.bearMemory)
    this.investmentJudge = new InvestmentJudge(this.quickThinkingLLM, this.investJudgeMemory)
    this.trader = new Trader(this.quickThinkingLLM, this.traderMemory)
    this.newsAnalyst = new NewsAnalyst(this.deepThinkingLLM)
  }

  /**
   * Run the trading agents graph for a company on a specific date
   */
  async propagate(companyName: string, tradeDate: string): Promise<{
    state: AgentState
    signal: TradeSignal
  }> {
    this.ticker = companyName

    // Initialize state
    const initialState = this.createInitialState(companyName, tradeDate)

    if (this.debug) {
      console.log(`\n=== Starting Analysis for ${companyName} on ${tradeDate} ===\n`)
    }

    // Step 1: Market Analysis (if selected)
    let state = initialState
    if (this.selectedAnalysts.includes('market')) {
      if (this.debug) console.log('Running Market Analyst...')
      const marketUpdate = await this.marketAnalyst.analyze(state)
      state = { ...state, ...marketUpdate }
    }

    // For this initial implementation, we'll focus on market analysis
    // Other analysts (social, news, fundamentals) can be added similarly
    if (!state.sentimentReport) state.sentimentReport = 'No social media analysis performed.'

    if (this.selectedAnalysts.includes('news')) {
      if (this.debug) console.log('Running News Analyst...')
      const newsUpdate = await this.newsAnalyst.analyze(state)
      state = { ...state, ...newsUpdate }
    } else {
      if (!state.newsReport) state.newsReport = 'No news analysis performed.'
    }

    if (!state.fundamentalsReport) state.fundamentalsReport = 'No fundamentals analysis performed.'

    // Step 2: Investment Debate (Bull vs Bear)
    if (this.debug) console.log('\n=== Investment Debate ===')

    // Initialize debate state
    state.investmentDebateState = {
      bullHistory: '',
      bearHistory: '',
      history: '',
      currentResponse: '',
      judgeDecision: '',
      count: 0
    }

    // Run debate rounds (3 rounds)
    for (let round = 0; round < 3; round++) {
      if (this.debug) console.log(`\nDebate Round ${round + 1}`)

      // Bull speaks
      const bullUpdate = await this.bullResearcher.analyze(state)
      state = { ...state, ...bullUpdate }

      // Bear responds
      const bearUpdate = await this.bearResearcher.analyze(state)
      state = { ...state, ...bearUpdate }
    }

    // Judge makes decision
    if (this.debug) console.log('\nInvestment Judge making decision...')
    const judgeUpdate = await this.investmentJudge.makeDecision(state)
    state = { ...state, ...judgeUpdate }

    // Step 3: Trader makes final decision
    if (this.debug) console.log('\nTrader making final decision...')
    const traderUpdate = await this.trader.makeDecision(state)
    state = { ...state, ...traderUpdate }

    // Extract final decision
    const finalDecision = this.extractDecision(state.traderInvestmentPlan || '')
    state.finalTradeDecision = finalDecision

    // Store current state
    this.currentState = state

    // Log state
    this.logState(tradeDate, state)

    // Process signal
    const signal = this.processSignal(finalDecision)

    if (this.debug) {
      console.log(`\n=== Final Decision: ${signal.action} (Confidence: ${signal.confidence}) ===\n`)
    }

    return { state, signal }
  }

  /**
   * Create initial state for the graph
   */
  private createInitialState(companyName: string, tradeDate: string): AgentState {
    return {
      companyOfInterest: companyName,
      tradeDate,
      messages: [],
      sender: '',
      marketReport: '',
      sentimentReport: '',
      newsReport: '',
      fundamentalsReport: '',
      investmentDebateState: {
        bullHistory: '',
        bearHistory: '',
        history: '',
        currentResponse: '',
        judgeDecision: '',
        count: 0
      },
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
        count: 0
      },
      finalTradeDecision: ''
    }
  }

  /**
   * Extract trading decision from text
   */
  private extractDecision(text: string): string {
    const upperText = text.toUpperCase()
    if (upperText.includes('BUY') && !upperText.includes('NOT BUY')) {
      return 'BUY'
    } else if (upperText.includes('SELL') && !upperText.includes('NOT SELL')) {
      return 'SELL'
    } else {
      return 'HOLD'
    }
  }

  /**
   * Process a trading signal
   */
  private processSignal(decision: string): TradeSignal {
    const action = decision as 'BUY' | 'SELL' | 'HOLD'
    return {
      action,
      confidence: 0.75, // Can be enhanced with more sophisticated confidence scoring
      reasoning: `Based on multi-agent analysis and debate`,
      timestamp: new Date()
    }
  }

  /**
   * Log the final state
   */
  private logState(tradeDate: string, state: AgentState): void {
    this.logStatesDict[tradeDate] = {
      companyOfInterest: state.companyOfInterest,
      tradeDate: state.tradeDate,
      marketReport: state.marketReport,
      sentimentReport: state.sentimentReport,
      newsReport: state.newsReport,
      fundamentalsReport: state.fundamentalsReport,
      investmentDebateState: {
        bullHistory: state.investmentDebateState.bullHistory,
        bearHistory: state.investmentDebateState.bearHistory,
        history: state.investmentDebateState.history,
        currentResponse: state.investmentDebateState.currentResponse,
        judgeDecision: state.investmentDebateState.judgeDecision
      },
      traderInvestmentDecision: state.traderInvestmentPlan,
      finalTradeDecision: state.finalTradeDecision
    }
  }

  /**
   * Reflect on decisions and update memory
   */
  async reflectAndRemember(returnsLosses: number): Promise<void> {
    if (!this.currentState) return

    const situation = `${this.currentState.marketReport}\n${this.currentState.newsReport}`
    const decision = this.currentState.finalTradeDecision
    const recommendation = `Decision: ${decision}, Outcome: ${returnsLosses > 0 ? 'Positive' : 'Negative'} (${returnsLosses.toFixed(2)}%)`

    // Add memories to all agents
    const memory = {
      situation,
      decision,
      outcome: returnsLosses,
      recommendation,
      timestamp: new Date()
    }

    await this.bullMemory.addMemory(memory)
    await this.bearMemory.addMemory(memory)
    await this.traderMemory.addMemory(memory)
    await this.investJudgeMemory.addMemory(memory)
  }

  /**
   * Get all logged states
   */
  getLogStates(): Record<string, any> {
    return this.logStatesDict
  }

  /**
   * Get the current state
   */
  getCurrentState(): AgentState | null {
    return this.currentState
  }
}
