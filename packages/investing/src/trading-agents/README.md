# TradingAgents - Multi-Agent Trading System

A JavaScript/TypeScript implementation of the TradingAgents framework, converted from the original Python implementation. This system uses multiple AI agents that debate and collaborate to generate trading signals.

## Architecture

### Core Components

1. **TradingAgentsGraph** - Main orchestrator that coordinates all agents
2. **Analyst Agents** - Gather and analyze different types of data:
   - MarketAnalyst: Technical analysis with indicators
   - SocialMediaAnalyst: Social sentiment analysis (placeholder)
   - NewsAnalyst: News and events analysis (placeholder)
   - FundamentalsAnalyst: Company fundamentals (placeholder)

3. **Researcher Agents** - Debate investment decisions:
   - BullResearcher: Advocates for buying/holding
   - BearResearcher: Advocates for selling/avoiding
   - InvestmentJudge: Makes final investment decision

4. **Trader Agent** - Makes final trading decision based on all analyses

5. **Memory System** - Learns from past decisions to improve future performance

## Features

- ✅ Multi-agent debate system for robust decision making
- ✅ Technical indicator analysis (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWMA)
- ✅ Memory-based learning from past trades
- ✅ Support for multiple LLM providers (OpenAI, Anthropic)
- ✅ Configurable analyst selection
- ✅ TypeScript type safety
- ✅ Next.js API route integration

## Usage

### API Endpoint

\`\`\`
POST /api/trading-agents

Request Body:
{
  "symbol": "AAPL",
  "date": "2024-12-11",  // optional, defaults to today
  "analysts": ["market", "news"],  // optional, defaults to all
  "config": {  // optional
    "llmProvider": "openai",
    "deepThinkLLM": "gpt-4o",
    "quickThinkLLM": "gpt-4o-mini",
    "temperature": 0.3
  }
}

Response:
{
  "success": true,
  "symbol": "AAPL",
  "date": "2024-12-11",
  "signal": {
    "action": "BUY",  // BUY, SELL, or HOLD
    "confidence": 0.75,
    "reasoning": "Based on multi-agent analysis and debate",
    "timestamp": "2024-12-11T10:30:00.000Z"
  },
  "analysis": {
    "marketReport": "...",
    "investmentDebate": {
      "bullArguments": "...",
      "bearArguments": "...",
      "judgeDecision": "..."
    },
    "traderDecision": "..."
  }
}
\`\`\`

### Programmatic Usage

\`\`\`
import { TradingAgentsGraph } from '@/lib/trading-agents'

// Initialize the graph
const graph = new TradingAgentsGraph(
  ['market', 'news'],  // selected analysts
  false,  // debug mode
  {  // config
    llmProvider: 'openai',
    deepThinkLLM: 'gpt-4o',
    quickThinkLLM: 'gpt-4o-mini',
    temperature: 0.3,
    apiKeys: {
      openai: process.env.OPENAI_API_KEY
    }
  }
)

// Run analysis
const { state, signal } = await graph.propagate('AAPL', '2024-12-11')

console.log('Trading Signal:', signal.action)
console.log('Confidence:', signal.confidence)
console.log('Market Report:', state.marketReport)

// Learn from the outcome
await graph.reflectAndRemember(5.2)  // 5.2% return
\`\`\`

## Technical Indicators

The system supports the following technical indicators:

- **Moving Averages**: SMA (50, 200), EMA (10)
- **Momentum**: RSI (14)
- **Trend**: MACD (12, 26, 9)
- **Volatility**: Bollinger Bands (20, 2), ATR (14)
- **Volume**: VWMA (20)

Indicators are automatically calculated from historical price data.

## Memory System

The system maintains memories for each agent type:
- Bull Researcher Memory
- Bear Researcher Memory
- Trader Memory
- Investment Judge Memory
- Risk Manager Memory

Memories store:
- Previous market situations
- Decisions made
- Outcomes (returns/losses)
- Lessons learned

The system uses similarity matching to retrieve relevant past experiences.

## Configuration

### Environment Variables

\`\`\`bash
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key  # if using Anthropic
\`\`\`

### Default Configuration

\`\`\`
{
  llmProvider: 'openai',
  deepThinkLLM: 'gpt-4o',  // For complex analysis
  quickThinkLLM: 'gpt-4o-mini',  // For simple tasks
  temperature: 0.3,
  projectDir: './data'
}
\`\`\`

## Workflow

1. **Data Collection**: Market analyst fetches historical data and calculates indicators
2. **Analysis**: Selected analysts generate reports
3. **Investment Debate**: Bull and bear researchers debate (3 rounds)
4. **Judge Decision**: Investment judge evaluates arguments
5. **Trading Decision**: Trader makes final BUY/SELL/HOLD decision
6. **Memory Update**: System learns from outcomes

## Differences from Python Version

- Uses TypeScript for type safety
- Integrated with Next.js API routes
- Simplified graph execution (no LangGraph dependency)
- Built-in technical indicator calculations
- Memory system uses in-memory storage (can be enhanced with persistence)

## Future Enhancements

- [ ] Social media sentiment analysis
- [ ] News sentiment analysis with real APIs
- [ ] Fundamental analysis with financial APIs
- [ ] Risk management debate (conservative/neutral/aggressive)
- [ ] Persistent memory storage (database)
- [ ] Backtesting framework
- [ ] Portfolio management
- [ ] Real-time market data streaming
- [ ] Advanced similarity matching with embeddings

## Examples

See `/app/api/trading-agents/route.ts` for the API implementation.

## License

MIT
