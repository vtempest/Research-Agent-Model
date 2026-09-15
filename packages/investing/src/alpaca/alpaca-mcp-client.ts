/**
 * Alpaca MCP Client
 * Client for interacting with Alpaca Model Context Protocol server
 * Provides trading, market data, and strategy tools
 */

const ALPACA_MCP_URL = process.env.NEXT_PUBLIC_ALPACA_MCP_URL || 'http://localhost:3001'

// Trading Strategy Types
export interface TradingStrategy {
  id?: string
  name: string
  description: string
  rules: StrategyRule[]
  riskManagement: RiskManagement
  symbols: string[]
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface StrategyRule {
  id: string
  type: 'entry' | 'exit' | 'position_sizing'
  condition: RuleCondition
  action: RuleAction
}

export interface RuleCondition {
  indicator: string
  operator: 'greater_than' | 'less_than' | 'crosses_above' | 'crosses_below' | 'equals'
  value: number | string
  timeframe?: string
}

export interface RuleAction {
  type: 'buy' | 'sell' | 'close' | 'hold'
  quantity?: number
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit'
  limitPrice?: number
  stopPrice?: number
}

export interface RiskManagement {
  maxPositionSize: number  // as percentage of portfolio
  stopLoss: number         // percentage
  takeProfit: number       // percentage
  maxDailyLoss: number     // percentage
  trailingStop?: number    // percentage
}

// Chat Message Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  suggestions?: string[]
}

// MCP Tool Call Interface
export interface MCPToolCall {
  tool: string
  arguments: Record<string, any>
}

export interface MCPToolResponse {
  success: boolean
  data?: any
  error?: string
  isText?: boolean
}

/**
 * Alpaca MCP Client Class
 */
export class AlpacaMCPClient {
  private baseURL: string
  private apiKey?: string
  private apiSecret?: string

  constructor(config?: {
    baseURL?: string
    apiKey?: string
    apiSecret?: string
  }) {
    this.baseURL = config?.baseURL || ALPACA_MCP_URL
    this.apiKey = config?.apiKey
    this.apiSecret = config?.apiSecret
  }

  // Helper method for MCP tool calls
  private async callTool<T>(
    tool: string,
    args: Record<string, any> = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}/mcp/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'X-API-Key': this.apiKey }),
        ...(this.apiSecret && { 'X-API-Secret': this.apiSecret }),
      },
      body: JSON.stringify({
        tool,
        arguments: args,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `MCP call failed: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Tool call failed')
    }

    return result.data as T
  }

  // =========================================================================
  // Account & Portfolio Methods
  // =========================================================================

  async getAccount() {
    return this.callTool('get_account', {})
  }

  async getPositions() {
    return this.callTool('get_all_positions', {})
  }

  async getPosition(symbol: string) {
    return this.callTool('get_position', { symbol })
  }

  async getPortfolioHistory(params?: {
    period?: string
    timeframe?: string
    start?: string
    end?: string
  }) {
    return this.callTool('get_portfolio_history', params || {})
  }

  // =========================================================================
  // Order Management Methods
  // =========================================================================

  async placeOrder(params: {
    symbol: string
    qty?: number
    notional?: number
    side: 'buy' | 'sell'
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop'
    time_in_force?: 'day' | 'gtc' | 'ioc' | 'fok'
    limit_price?: number
    stop_price?: number
    trail_percent?: number
  }) {
    return this.callTool('place_order', params)
  }

  async getOrders(params?: {
    status?: 'open' | 'closed' | 'all'
    limit?: number
    symbols?: string
  }) {
    return this.callTool('get_orders', params || {})
  }

  async getOrder(orderId: string) {
    return this.callTool('get_order', { order_id: orderId })
  }

  async cancelOrder(orderId: string) {
    return this.callTool('cancel_order', { order_id: orderId })
  }

  async closePosition(symbol: string, qty?: number) {
    return this.callTool('close_position', {
      symbol,
      ...(qty && { qty }),
    })
  }

  async closeAllPositions() {
    return this.callTool('close_all_positions', {})
  }

  // =========================================================================
  // Market Data Methods
  // =========================================================================

  async getQuote(symbol: string) {
    return this.callTool('get_latest_quote', { symbol })
  }

  async getBars(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }) {
    return this.callTool('get_bars', params)
  }

  async getLatestBar(symbol: string) {
    return this.callTool('get_latest_bar', { symbol })
  }

  async getSnapshot(symbol: string) {
    return this.callTool('get_snapshot', { symbol })
  }

  async searchAssets(params?: {
    status?: 'active' | 'inactive'
    asset_class?: 'us_equity' | 'crypto'
  }) {
    return this.callTool('search_assets', params || {})
  }

  // =========================================================================
  // Options Trading Methods
  // =========================================================================

  async getOptionChain(params: {
    underlying_symbol: string
    expiration_date?: string
    expiration_date_gte?: string
    expiration_date_lte?: string
    type?: 'call' | 'put'
    strike_price_gte?: number
    strike_price_lte?: number
  }) {
    return this.callTool('get_option_chain', params)
  }

  async placeOptionOrder(params: {
    symbol: string
    side: 'buy' | 'sell'
    qty: number
    type?: 'market' | 'limit'
    limit_price?: number
    time_in_force?: 'day' | 'gtc'
  }) {
    return this.callTool('place_option_order', params)
  }

  // =========================================================================
  // Crypto Trading Methods
  // =========================================================================

  async getCryptoBars(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }) {
    return this.callTool('get_crypto_bars', params)
  }

  async getCryptoQuote(symbol: string) {
    return this.callTool('get_latest_crypto_quote', { symbol })
  }

  async placeCryptoOrder(params: {
    symbol: string
    qty?: number
    notional?: number
    side: 'buy' | 'sell'
    type?: 'market' | 'limit'
    limit_price?: number
    time_in_force?: 'day' | 'gtc' | 'ioc'
  }) {
    return this.callTool('place_crypto_order', params)
  }

  // =========================================================================
  // Watchlist Methods
  // =========================================================================

  async getWatchlists() {
    return this.callTool('get_watchlists', {})
  }

  async createWatchlist(name: string, symbols: string[]) {
    return this.callTool('create_watchlist', { name, symbols })
  }

  async addToWatchlist(watchlistId: string, symbol: string) {
    return this.callTool('add_to_watchlist', {
      watchlist_id: watchlistId,
      symbol,
    })
  }

  async deleteWatchlist(watchlistId: string) {
    return this.callTool('delete_watchlist', { watchlist_id: watchlistId })
  }

  // =========================================================================
  // Calendar & Corporate Actions
  // =========================================================================

  async getMarketCalendar(params?: {
    start?: string
    end?: string
  }) {
    return this.callTool('get_market_calendar', params || {})
  }

  async getCorporateActions(params: {
    symbol: string
    types?: string
    start?: string
    end?: string
  }) {
    return this.callTool('get_corporate_actions', params)
  }

  // =========================================================================
  // Strategy Chat Methods
  // =========================================================================

  async chatWithAI(messages: ChatMessage[]): Promise<ChatMessage> {
    try {
      const response = await fetch('/api/alpaca/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      })

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        role: 'assistant',
        content: data.content,
        timestamp: new Date(data.timestamp),
        suggestions: data.suggestions || [],
      }
    } catch (error: any) {
      console.error('Chat error:', error)
      return {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}\n\nPlease try again or check your GROQ API key configuration.`,
        timestamp: new Date(),
        suggestions: [
          'What is a momentum trading strategy?',
          'How do I set stop loss and take profit?',
          'Explain technical indicators for trading',
        ],
      }
    }
  }

  async generateStrategyFromDescription(description: string): Promise<TradingStrategy> {
    // This could call an LLM to parse the description and generate a strategy
    // For now, return a template strategy
    return {
      name: 'AI Generated Strategy',
      description,
      symbols: ['AAPL', 'MSFT', 'GOOGL'],
      active: false,
      rules: [
        {
          id: '1',
          type: 'entry',
          condition: {
            indicator: 'price',
            operator: 'crosses_above',
            value: 'sma_20',
            timeframe: '1D',
          },
          action: {
            type: 'buy',
            orderType: 'market',
          },
        },
        {
          id: '2',
          type: 'exit',
          condition: {
            indicator: 'price',
            operator: 'crosses_below',
            value: 'sma_20',
            timeframe: '1D',
          },
          action: {
            type: 'sell',
            orderType: 'market',
          },
        },
      ],
      riskManagement: {
        maxPositionSize: 10,
        stopLoss: 5,
        takeProfit: 15,
        maxDailyLoss: 2,
        trailingStop: 3,
      },
      createdAt: new Date().toISOString(),
    }
  }
}

// Singleton instance (lazy-loaded to avoid build-time errors)
let _alpacaMCPClient: AlpacaMCPClient | null = null

export function getAlpacaMCPClient(): AlpacaMCPClient {
  if (!_alpacaMCPClient) {
    _alpacaMCPClient = new AlpacaMCPClient()
  }
  return _alpacaMCPClient
}

// For backwards compatibility
export const alpacaMCPClient = {
  get instance() {
    return getAlpacaMCPClient()
  }
}

// Convenience functions
export async function getAccount() {
  return getAlpacaMCPClient().getAccount()
}

export async function placeOrder(params: Parameters<AlpacaMCPClient['placeOrder']>[0]) {
  return getAlpacaMCPClient().placeOrder(params)
}

export async function getQuote(symbol: string) {
  return getAlpacaMCPClient().getQuote(symbol)
}

export async function chatWithAI(messages: ChatMessage[]) {
  return getAlpacaMCPClient().chatWithAI(messages)
}
