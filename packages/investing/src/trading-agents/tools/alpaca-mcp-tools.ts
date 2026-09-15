/**
 * Alpaca MCP Tools for LangChain
 * Provides trading tools that can be used by LLMs via the Alpaca MCP server
 */

import { Tool } from './langchain-tools'

const ALPACA_MCP_URL = process.env.NEXT_PUBLIC_ALPACA_MCP_URL || 'http://localhost:3001'

/**
 * Helper function to call Alpaca MCP tools
 */
async function callAlpacaMCP<T>(tool: string, args: Record<string, any> = {}): Promise<T> {
  const response = await fetch(`${ALPACA_MCP_URL}/mcp/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

/**
 * Get account information
 */
export const getAccountTool: Tool = {
  name: 'get_alpaca_account',
  description: 'Get Alpaca trading account information including buying power, portfolio value, and account status. Use this to check available capital before placing trades.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  func: async (input: any) => {
    try {
      const data = await callAlpacaMCP('get_account', {})
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error fetching account: ${error.message}`
    }
  }
}

/**
 * Get current positions
 */
export const getPositionsTool: Tool = {
  name: 'get_positions',
  description: 'Get all current open positions in the Alpaca account. Returns details about held stocks including quantity, market value, and unrealized P&L.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  func: async (input: any) => {
    try {
      const data = await callAlpacaMCP('get_all_positions', {})
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error fetching positions: ${error.message}`
    }
  }
}

/**
 * Get latest quote for a symbol
 */
export const getQuoteTool: Tool = {
  name: 'get_quote',
  description: 'Get the latest real-time quote for a stock symbol including bid, ask, and last trade price. Use this to check current market prices.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)'
      }
    },
    required: ['symbol']
  },
  func: async (input: { symbol: string }) => {
    try {
      const data = await callAlpacaMCP('get_latest_quote', { symbol: input.symbol })
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error fetching quote: ${error.message}`
    }
  }
}

/**
 * Get historical bars/candles
 */
export const getBarsTool: Tool = {
  name: 'get_bars',
  description: 'Get historical OHLCV (Open, High, Low, Close, Volume) bar data for a symbol. Useful for technical analysis and backtesting strategies.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock ticker symbol'
      },
      timeframe: {
        type: 'string',
        description: 'Bar timeframe (1Min, 5Min, 15Min, 1Hour, 1Day)'
      },
      limit: {
        type: 'number',
        description: 'Number of bars to retrieve (default: 100)'
      }
    },
    required: ['symbol', 'timeframe']
  },
  func: async (input: { symbol: string; timeframe: string; limit?: number }) => {
    try {
      const data = await callAlpacaMCP('get_bars', {
        symbol: input.symbol,
        timeframe: input.timeframe,
        limit: input.limit || 100
      })
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error fetching bars: ${error.message}`
    }
  }
}

/**
 * Place an order
 */
export const placeOrderTool: Tool = {
  name: 'place_order',
  description: 'Place a trading order on Alpaca. Can buy or sell stocks with various order types (market, limit, stop). IMPORTANT: Always confirm with user before placing real orders.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock ticker symbol'
      },
      qty: {
        type: 'number',
        description: 'Quantity of shares to trade'
      },
      side: {
        type: 'string',
        description: 'Order side: "buy" or "sell"',
        enum: ['buy', 'sell']
      },
      type: {
        type: 'string',
        description: 'Order type: "market", "limit", "stop", "stop_limit"',
        enum: ['market', 'limit', 'stop', 'stop_limit']
      },
      time_in_force: {
        type: 'string',
        description: 'Time in force: "day" (good for day), "gtc" (good til canceled)',
        enum: ['day', 'gtc', 'ioc', 'fok']
      },
      limit_price: {
        type: 'number',
        description: 'Limit price (required for limit orders)'
      }
    },
    required: ['symbol', 'qty', 'side', 'type']
  },
  func: async (input: any) => {
    try {
      const data = await callAlpacaMCP('place_order', input)
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error placing order: ${error.message}`
    }
  }
}

/**
 * Get open orders
 */
export const getOrdersTool: Tool = {
  name: 'get_orders',
  description: 'Get all orders (open, filled, or cancelled). Useful for tracking order status and order history.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status: "open", "closed", or "all"',
        enum: ['open', 'closed', 'all']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of orders to return'
      }
    },
    required: []
  },
  func: async (input: any) => {
    try {
      const data = await callAlpacaMCP('get_orders', input)
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error fetching orders: ${error.message}`
    }
  }
}

/**
 * Cancel an order
 */
export const cancelOrderTool: Tool = {
  name: 'cancel_order',
  description: 'Cancel a pending order by order ID. Only works for open orders that have not been filled.',
  inputSchema: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'The order ID to cancel'
      }
    },
    required: ['order_id']
  },
  func: async (input: { order_id: string }) => {
    try {
      const data = await callAlpacaMCP('cancel_order', { order_id: input.order_id })
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error cancelling order: ${error.message}`
    }
  }
}

/**
 * Close a position
 */
export const closePositionTool: Tool = {
  name: 'close_position',
  description: 'Close an existing position (sell all shares of a symbol). Useful for exiting trades and taking profits or stopping losses.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock ticker symbol to close'
      },
      qty: {
        type: 'number',
        description: 'Optional: partial quantity to close (default: close entire position)'
      }
    },
    required: ['symbol']
  },
  func: async (input: { symbol: string; qty?: number }) => {
    try {
      const data = await callAlpacaMCP('close_position', input)
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error closing position: ${error.message}`
    }
  }
}

/**
 * Get market calendar
 */
export const getMarketCalendarTool: Tool = {
  name: 'get_market_calendar',
  description: 'Get market calendar showing when the stock market is open or closed. Useful for planning trades around market hours.',
  inputSchema: {
    type: 'object',
    properties: {
      start: {
        type: 'string',
        description: 'Start date in YYYY-MM-DD format'
      },
      end: {
        type: 'string',
        description: 'End date in YYYY-MM-DD format'
      }
    },
    required: []
  },
  func: async (input: any) => {
    try {
      const data = await callAlpacaMCP('get_market_calendar', input)
      return JSON.stringify(data, null, 2)
    } catch (error: any) {
      return `Error fetching calendar: ${error.message}`
    }
  }
}

/**
 * All Alpaca MCP tools
 */
export const alpacaMCPTools: Tool[] = [
  getAccountTool,
  getPositionsTool,
  getQuoteTool,
  getBarsTool,
  placeOrderTool,
  getOrdersTool,
  cancelOrderTool,
  closePositionTool,
  getMarketCalendarTool
]

/**
 * Get safe tools (read-only, no order placement)
 */
export const safeAlpacaTools: Tool[] = [
  getAccountTool,
  getPositionsTool,
  getQuoteTool,
  getBarsTool,
  getOrdersTool,
  getMarketCalendarTool
]
