/**
 * Market Analyst Agent
 * Analyzes technical market trends using indicators and price action
 */

import { AgentState, Message } from '../types'
import { UnifiedLLMClient } from '../utils/llm-client'
import { getStockData, getIndicators } from '../tools/data-tools'

export class MarketAnalyst {
  private llm: UnifiedLLMClient

  constructor(llm: UnifiedLLMClient) {
    this.llm = llm
  }

  async analyze(state: AgentState): Promise<Partial<AgentState>> {
    const { companyOfInterest: ticker, tradeDate } = state

    const systemMessage = `You are a trading assistant tasked with analyzing financial markets. Your role is to select the **most relevant indicators** for a given market condition or trading strategy from the following list. The goal is to choose up to **8 indicators** that provide complementary insights without redundancy.

Moving Averages:
- close_50_sma: 50 SMA: A medium-term trend indicator. Identify trend direction and support/resistance.
- close_200_sma: 200 SMA: A long-term trend benchmark. Confirm overall market trend and golden/death cross.
- close_10_ema: 10 EMA: A responsive short-term average. Capture quick momentum shifts.

MACD Related:
- macd: MACD: Momentum via EMA differences. Look for crossovers and divergence.
- macds: MACD Signal: EMA smoothing of MACD line. Use crossovers to trigger trades.
- macdh: MACD Histogram: Gap between MACD and signal. Visualize momentum strength.

Momentum Indicators:
- rsi: RSI: Measures overbought/oversold conditions using 70/30 thresholds.

Volatility Indicators:
- boll: Bollinger Middle: 20 SMA basis for Bollinger Bands.
- boll_ub: Bollinger Upper: 2 std devs above middle, signals overbought.
- boll_lb: Bollinger Lower: 2 std devs below middle, signals oversold.
- atr: ATR: Measures volatility for stop-loss and position sizing.

Volume-Based Indicators:
- vwma: VWMA: Volume-weighted moving average confirms trends.

Select indicators that provide diverse information and explain why they're suitable. Write a detailed report of trends observed.
Make sure to append a Markdown table at the end of the report to organize key points.

For your reference, the current date is ${tradeDate}. The company we want to analyze is ${ticker}.`

    try {
      // Fetch stock data
      const endDate = new Date(tradeDate)
      const startDate = new Date(endDate)
      startDate.setMonth(startDate.getMonth() - 6) // 6 months of history

      const stockData = await getStockData(ticker, startDate, endDate)

      // Calculate key indicators
      const selectedIndicators = [
        'close_50_sma',
        'close_200_sma',
        'close_10_ema',
        'rsi',
        'macd',
        'boll',
        'atr',
        'vwma'
      ]

      const indicators = await getIndicators(stockData, selectedIndicators)

      // Prepare context for LLM
      const latestData = stockData.slice(-20) // Last 20 days
      const dataContext = `
Recent Price Action for ${ticker}:
${latestData.map(d => `${d.date}: Close=$${d.close.toFixed(2)}, Volume=${d.volume}`).join('\n')}

Technical Indicators (Latest Values):
- 50 SMA: ${indicators.sma50?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- 200 SMA: ${indicators.sma200?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- 10 EMA: ${indicators.ema10?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- RSI: ${indicators.rsi?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- MACD: ${indicators.macd?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- Bollinger Upper: ${indicators.bollingerUpper?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- Bollinger Middle: ${indicators.bollingerMiddle?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- Bollinger Lower: ${indicators.bollingerLower?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- ATR: ${indicators.atr?.slice(-1)[0]?.toFixed(2) || 'N/A'}
- VWMA: ${indicators.vwma?.slice(-1)[0]?.toFixed(2) || 'N/A'}

Please analyze these indicators and provide a comprehensive market analysis report.`

      const messages: Message[] = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: dataContext }
      ]

      const response = await this.llm.invoke(messages)

      return {
        marketReport: response.content,
        messages: [...state.messages, { role: 'assistant', content: response.content }],
        sender: 'MarketAnalyst'
      }
    } catch (error) {
      console.error('Market Analyst error:', error)
      return {
        marketReport: `Error analyzing market data for ${ticker}: ${error}`,
        sender: 'MarketAnalyst'
      }
    }
  }
}
