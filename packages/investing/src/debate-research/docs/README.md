# Multi-Agent Trading System - JavaScript Port

JavaScript implementation of the Multi-Agent Trading System, ported from Python. This system uses LangGraph and Google Gemini for multi-agent investment analysis of value-to-growth ex-US equities.

## Overview

This is a **JavaScript/Node.js port** of the Python debate-agents system located in `../`. The core logic, prompts, and agent architecture are preserved to maintain consistency across implementations.

## Architecture

The system implements a multi-agent architecture with specialized roles
## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Create a `.env` file based on `.env.example`:

\`\`\`bash
# Required API Keys
GOOGLE_API_KEY=your_gemini_api_key
FINNHUB_API_KEY=your_finnhub_key
TAVILY_API_KEY=your_tavily_key

# Optional
EODHD_API_KEY=your_eodhd_key
OPENAI_API_KEY=your_openai_key  # For consultant cross-validation

# Model Configuration
DEEP_MODEL=gemini-3-pro-preview
QUICK_MODEL=gemini-2.0-flash

# Rate Limiting (Free tier: 15, Paid: 360+)
GEMINI_RPM_LIMIT=15

# Features
ENABLE_MEMORY=true
ENABLE_CONSULTANT=true
\`\`\`

## Usage

### Basic Analysis

\`\`\`javascript
import { runAnalysis } from './main.js';

const result = await runAnalysis({
  ticker: 'AAPL',
  quickMode: false,
});

console.log(result.final_trade_decision);
\`\`\`

### CLI Usage

\`\`\`bash
# Basic analysis
node main.js --ticker AAPL

# Quick mode (faster, less detailed)
node main.js --ticker NVDA --quick

# Quiet mode (markdown report only)
node main.js --ticker AAPL --quiet
\`\`\`

### Health Check

\`\`\`bash
npm run health-check
\`\`\`

## Key Differences from Python Version

1. **Module System**: Uses ES6 modules (`import`/`export`) instead of Python imports
2. **Async/Await**: JavaScript async patterns replace Python's `asyncio`
3. **Rate Limiting**: Custom token bucket implementation (no native equivalent to Python's `InMemoryRateLimiter`)
4. **Logging**: Uses Winston/console instead of structlog
5. **Type System**: Optional TypeScript support (Python uses type hints)

## Module Structure

\`\`\`
debate-agents-js/
├── config.js           # Configuration and env management
├── llms.js             # LLM initialization (Gemini & OpenAI)
├── prompts.js          # Agent prompt registry
├── memory.js           # ChromaDB vector memory
├── agents.js           # Agent node factories
├── graph.js            # LangGraph state graph
├── toolkit.js          # Tool implementations
├── utils.js            # Utility functions
├── main.js             # CLI entry point
├── health_check.js     # System health check
└── package.json        # Dependencies
\`\`\`

## Prompts Compatibility

**Important**: The JavaScript version uses the **same prompts** as the Python version. Prompts are loaded from:

1. Default prompts (embedded in `prompts.js`)
2. Custom JSON prompts from `../prompts/` directory
3. Environment variable overrides (`PROMPT_MARKET_ANALYST`, etc.)

To ensure consistency, the Python `prompts.py` file is the source of truth. You can:

- **Use shared JSON prompts**: Both Python and JavaScript load from `../prompts/*.json`
- **Export Python prompts to JSON**: Run `python -c "from prompts import export_prompts; export_prompts()"`
- **Validate consistency**: Compare exported JSON with JS defaults

## Data Flow

\`\`\`
User Input (Ticker)
  ↓
Market Analyst → tools → report
  ↓
Sentiment Analyst → tools → report
  ↓
News Analyst → tools → report
  ↓
Fundamentals Analyst → tools → DATA_BLOCK
  ↓
Financial Validator → red flags → routing
  ↓
Bull/Bear Debate → arguments
  ↓
Research Manager → synthesis
  ↓
[Optional] Consultant → cross-validation
  ↓
Trader → execution plan
  ↓
Risk Team → sizing debate
  ↓
Portfolio Manager → FINAL DECISION
\`\`\`

## Memory System

The system uses ChromaDB for vector-based memory storage:

- **Ticker-specific isolation**: Separate collections per ticker (e.g., `0005_HK_bull_memory`)
- **Embedding model**: Google `text-embedding-004`
- **Persistence**: `./chroma_db/` directory
- **Cleanup**: Automatic old memory deletion

## Testing

\`\`\`bash
npm test
\`\`\`

Run specific test:

\`\`\`bash
npm test -- agents.test.js
\`\`\`

## Development

### Watch Mode

\`\`\`bash
npm run dev
\`\`\`

### Linting

\`\`\`bash
npm run lint
npm run format
\`\`\`

## Python Interoperability

This JavaScript version is designed to work alongside the Python version:

- **Shared prompts**: Load from `../prompts/` JSON files
- **Shared data**: Results saved to `./results/` (both systems)
- **ChromaDB**: Can read memories created by Python version
- **API compatibility**: Same external APIs (yfinance, Finnhub, Tavily)

## Migration from Python

If migrating from Python:

1. **Dependencies**: Run `npm install` (equivalent to `poetry install`)
2. **Environment**: Copy `.env` from Python project
3. **Prompts**: Python prompts auto-loaded from shared directory
4. **Memory**: Existing ChromaDB collections work without migration
5. **Results**: JSON output format matches Python version

## Known Limitations

1. **Rate limiting**: Simpler implementation than Python's LangChain rate limiter
2. **Type safety**: Optional (add TypeScript for stricter typing)
3. **Async patterns**: Different error handling semantics
4. **Some tools**: May need JavaScript-specific implementations

## Contributing

When contributing:

1. **Keep prompts in sync**: Update both Python and JavaScript
2. **Maintain compatibility**: JSON output should match Python version
3. **Follow conventions**: ES6 modules, async/await, JSDoc comments
4. **Test**: Ensure health check passes

## License

MIT

## References

- **Python version**: `../` (source of truth for prompts and logic)
- **LangChain JS**: https://js.langchain.com/
- **LangGraph JS**: https://langchain-ai.github.io/langgraphjs/
- **Gemini API**: https://ai.google.dev/

---

**Note**: This is a **faithful port** of the Python system. For the most up-to-date prompts and thesis logic, refer to the Python `prompts.py` file.
