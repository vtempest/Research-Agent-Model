/**
 * Stock Prediction Agents API Client
 * Connects to unified API gateway and individual agent services
 */

// API Configuration
const API_BASE_URL = '/api'

// Top stocks lists
export const TOP_STOCKS = {
  sp500Top: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK.B', 'LLY', 'V'],
  tech: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'TSLA', 'ORCL', 'CRM', 'ADBE', 'NFLX'],
  faang: ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL'],
  mag7: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'],
  mostActive: ['TSLA', 'NVDA', 'AAPL', 'AMD', 'PLTR', 'SOFI', 'F', 'NIO', 'LCID', 'RIVN']
}

// Types
export interface NewsResearcherAnalysisRequest {
  symbols: string[]
  date?: string
}

export interface NewsResearcherAnalysisResponse {
  success: boolean
  symbols: string[]
  date: string
  result: {
    data_collection_results?: any
    technical_analysis_results?: any
    news_intelligence_results?: any
    portfolio_manager_results?: {
      decision: 'BUY' | 'SELL' | 'HOLD'
      confidence: number
      reasoning: string
    }
  }
  timestamp: string
}

export interface DebateAnalystAnalysisRequest {
  symbol: string
  date?: string
  deep_think_llm?: string
  quick_think_llm?: string
  max_debate_rounds?: number
}

// ... (keep existing types) ...

export interface DebateAnalystAnalysisResponse {
  success: boolean
  symbol: string
  date: string
  decision: {
    action: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    position_size: number
    reasoning: string
    debate_summary?: {
      bull_arguments: string[]
      bear_arguments: string[]
      risk_assessment: string
    }
  }
  timestamp: string
}

export interface BacktestRequest {
  symbol: string
  data_dir?: string
  printlog?: boolean
}

export interface BacktestResponse {
  success: boolean
  symbol: string
  primo_results: {
    'Starting Portfolio Value [$]': number
    'Final Portfolio Value [$]': number
    'Cumulative Return [%]': number
    'Annual Return [%]': number
    'Annual Volatility [%]': number
    'Sharpe Ratio': number
    'Max Drawdown [%]': number
    'Total Trades': number
    'Win Rate [%]': number
  }
  buyhold_results: any
  comparison: {
    relative_return: number
    outperformed: boolean
    metrics: {
      cumulative_return_diff: number
      volatility_diff: number
      max_drawdown_diff: number
      sharpe_diff: number
    }
  }
  timestamp: string
}

export interface BatchAnalysisRequest {
  symbols: string[]
  start_date: string
  end_date: string
}

// API Client Class
export class StockAgentsAPI {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  // Helper method for API calls
  private async fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `API error: ${response.statusText}`)
    }

    return response.json()
  }

  // Health Check
  async getHealth() {
    // Map to trading-agents GET which returns system info
    const info = await this.fetchAPI<any>('/trading-agents')
    return {
      status: 'online',
      timestamp: new Date().toISOString(),
      services: {
        news_researcher: 'online',
        debate_analyst: 'online'
      },
      ...info
    }
  }

  // Get Agent Execution Logs
  async getAgentLogs(limit = 50) {
    return this.fetchAPI<any[]>(`/trading-agents?action=history&limit=${limit}`)
  }

  // News Researcher (Adapted to TradingAgents) Methods
  async analyzeWithNewsResearcher(
    request: NewsResearcherAnalysisRequest
  ): Promise<NewsResearcherAnalysisResponse> {
    // Adapter: Call trading-agents with news focus
    const symbol = request.symbols[0] // TradingAgents only supports single symbol for now
    
    const response = await this.fetchAPI<any>('/trading-agents', {
      method: 'POST',
      body: JSON.stringify({
        symbol,
        date: request.date,
        analysts: ['news', 'fundamentals', 'market']
      }),
    })

    // Transform response to match NewsResearcherAnalysisResponse interface
    return {
      success: response.success,
      symbols: [response.symbol],
      date: response.date,
      timestamp: new Date().toISOString(),
      result: {
        portfolio_manager_results: {
          decision: response.signal.action,
          confidence: response.signal.confidence,
          reasoning: response.signal.reasoning
        },
        news_intelligence_results: {
          summary: response.analysis.newsReport
        },
        technical_analysis_results: {
          summary: response.analysis.marketReport
        },
        data_collection_results: {
           summary: response.analysis.fundamentalsReport
        }
      }
    }
  }

  async batchAnalyzeWithNewsResearcher(request: BatchAnalysisRequest) {
    // Not implemented in internal API yet, throw error or stub
    throw new Error('Batch analysis not supported in this version')
  }

  // Debate Analyst (TradingAgents) Methods
  async analyzeWithDebateAnalyst(
    request: DebateAnalystAnalysisRequest
  ): Promise<DebateAnalystAnalysisResponse> {
    // Map directly to trading-agents endpoint
    const response = await this.fetchAPI<any>('/trading-agents', {
      method: 'POST',
      body: JSON.stringify({
        symbol: request.symbol,
        date: request.date,
        config: {
          deepThinkLLM: request.deep_think_llm,
          quickThinkLLM: request.quick_think_llm
        }
      }),
    })

    return {
       success: response.success,
       symbol: response.symbol,
       date: response.date,
       timestamp: new Date().toISOString(),
       decision: {
         action: response.signal.action,
         confidence: response.signal.confidence,
         position_size: 1.0, // Default as not in TradingAgentsResponse
         reasoning: response.signal.reasoning,
         debate_summary: response.analysis.investmentDebate ? {
            bull_arguments: [response.analysis.investmentDebate.bullArguments],
            bear_arguments: [response.analysis.investmentDebate.bearArguments],
            risk_assessment: "See full analysis for risk details"
         } : undefined
       }
    }
  }

  async reflectOnTrade(positionReturns: number) {
    // Not implemented in internal API yet
    return { success: true }
  }

  async getDebateAnalystConfig() {
     // Not needed for internal API or can verify via GET /trading-agents
    return { success: true }
  }

  // Backtesting Methods
  async runBacktest(request: BacktestRequest): Promise<BacktestResponse> {
    const response = await this.fetchAPI<any>('/backtest', {
      method: 'POST',
      body: JSON.stringify({
        symbol: request.symbol,
        startDate: '2023-01-01', // Default dates if needed
        endDate: new Date().toISOString().split('T')[0],
        strategy: 'momentum'
      }),
    })
    
    // Transform BacktestResult to BacktestResponse
    // Note: Internal API response format is slightly different
    return {
        success: response.success,
        symbol: response.symbol,
        timestamp: new Date().toISOString(),
        primo_results: {
            'Starting Portfolio Value [$]': response.initialCapital,
            'Final Portfolio Value [$]': response.finalValue,
            'Cumulative Return [%]': response.totalReturnPercent,
            'Annual Return [%]': 0, // Not calc
            'Annual Volatility [%]': 0, // Not calc
            'Sharpe Ratio': response.metrics.sharpeRatio || 0,
            'Max Drawdown [%]': response.metrics.maxDrawdown,
            'Total Trades': response.metrics.totalTrades,
            'Win Rate [%]': response.metrics.winRate
        },
        buyhold_results: {
             'Cumulative Return [%]': 0, // Needs fetch
             'Annual Return [%]': 0,
             'Sharpe Ratio': 0,
             'Max Drawdown [%]': 0
        },
        comparison: {
            relative_return: 0,
            outperformed: response.totalReturn > 0,
            metrics: {
                cumulative_return_diff: 0,
                volatility_diff: 0,
                max_drawdown_diff: 0,
                sharpe_diff: 0
            }
        }
    }
  }

  async getAvailableStocks(dataDir: string = './output/csv') {
    return { success: true, files: [] } // Stub
  }

  // Batch Methods for Multiple Stocks
  async analyzeTopStocks(
    stockList: keyof typeof TOP_STOCKS = 'mag7',
    agent: 'news-researcher' | 'debate-analyst' = 'news-researcher'
  ) {
    const symbols = TOP_STOCKS[stockList]

    if (agent === 'news-researcher') {
       const results = await Promise.allSettled(
        symbols.map(symbol =>
          this.analyzeWithNewsResearcher({ symbols: [symbol] })
        )
      )
      return results
    } else {
      // For debate analyst, analyze each stock individually
      const results = await Promise.allSettled(
        symbols.map(symbol =>
          this.analyzeWithDebateAnalyst({ symbol })
        )
      )
      return results
    }
  }

  async batchBacktest(symbols: string[]) {
    const results = await Promise.allSettled(
      symbols.map(symbol => this.runBacktest({ symbol }))
    )
    return results
  }
}

// Singleton instance
export const stockAgentsAPI = new StockAgentsAPI()

// Convenience functions
export async function analyzeStock(
  symbol: string,
  agent: 'news-researcher' | 'debate-analyst' = 'debate-analyst'
) {
  if (agent === 'news-researcher') {
    return stockAgentsAPI.analyzeWithNewsResearcher({ symbols: [symbol] })
  } else {
    return stockAgentsAPI.analyzeWithDebateAnalyst({ symbol })
  }
}

// ... (keep rest) ...

export async function analyzeTopStocks(
  list: keyof typeof TOP_STOCKS = 'mag7',
  agent: 'news-researcher' | 'debate-analyst' = 'news-researcher'
) {
  return stockAgentsAPI.analyzeTopStocks(list, agent)
}

export async function backtestStock(symbol: string) {
  return stockAgentsAPI.runBacktest({ symbol })
}

export async function getServiceHealth() {
  return stockAgentsAPI.getHealth()
}

// React Query hooks helpers (for use with @tanstack/react-query)
export const queryKeys = {
  health: ['health'] as const,
  newsResearcher: (symbols: string[]) => ['news-researcher', ...symbols] as const,
  debateAnalyst: (symbol: string) => ['debate-analyst', symbol] as const,
  backtest: (symbol: string) => ['backtest', symbol] as const,
  availableStocks: ['available-stocks'] as const,
  topStocks: (list: string, agent: string) => ['top-stocks', list, agent] as const,
}
