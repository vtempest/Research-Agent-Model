# Debate Agents Integration Guide

This document describes how the debate-agents-js library has been integrated into the main investment prediction agent application.

## Integration Overview

The debate-agents-js library is now accessible via:

1. **API Endpoint**: `/api/debate-agents`
2. **Dashboard Page**: `/dashboard/debate-agents`
3. **Dashboard Widget**: Featured in the "Agents" tab

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│ Next.js Dashboard │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ /dashboard/debate-agents │ │
│ │ - User interface for stock analysis │ │
│ │ - Ticker input and quick mode toggle │ │
│ │ - Results display │ │
│ └─────────────────┬───────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ /api/debate-agents/route.ts │ │
│ │ - POST endpoint for analysis requests │ │
│ │ - GET endpoint for quick analysis │ │
│ │ - Spawns Node.js subprocess │ │
│ └─────────────────┬───────────────────────────────────┘ │
│ │ │
└────────────────────┼────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ lib/debate-agents-js/ │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ simple-runner.js │ │
│ │ - CLI and programmatic interface │ │
│ │ - Uses available modules: │ │
│ │ • config.js - Environment setup │ │
│ │ • llms.js - Gemini/OpenAI models │ │
│ │ • prompts.js - Agent prompts │ │
│ │ • ticker_corrections.js - Ticker validation │ │
│ │ • report_generator.js - Markdown reports │ │
│ │ • token_tracker.js - Cost tracking │ │
│ │ • yahoo-finance2 - Market data │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## Files Created

### 1. API Endpoint

**File**: `app/api/debate-agents/route.ts`

Provides REST API access to debate agents analysis:

\`\`\`typescript
// POST request
POST /api/debate-agents
{
"ticker": "AAPL",
"quickMode": true,
"quiet": true
}

// GET request (uses quick mode by default)
GET /api/debate-agents?ticker=AAPL
\`\`\`

**Features**:

- Ticker validation
- Subprocess spawning for isolated execution
- Environment variable passing for API keys
- 5-minute timeout protection
- JSON result extraction
- Error handling

### 2. Simple Analysis Runner

**File**: `lib/debate-agents-js/simple-runner.js`

Lightweight runner that uses available debate-agents-js modules:

\`\`\`bash
node simple-runner.js --ticker AAPL
node simple-runner.js --ticker NVDA --quick
\`\`\`

**Features**:

- System initialization
- Ticker correction and validation
- Yahoo Finance quote data fetching
- LLM-based analysis using market analyst prompts
- Decision extraction (BUY/SELL/HOLD)
- Token usage tracking
- Markdown report generation

### 3. Dashboard Component

**File**: `components/investing/debate-agents-analysis.tsx`

React component for user interaction:

**Features**:

- Ticker input with validation
- Quick mode toggle
- Loading states
- Result display with decision badges
- Market data visualization
- Token usage display
- Error handling

### 4. Dashboard Page

**File**: `app/dashboard/debate-agents/page.tsx`

Full page dedicated to debate agents:

**Features**:

- Introduction to the multi-agent system
- Agent role descriptions
- How it works explanation
- Integration of the analysis component

### 5. Dashboard Integration

**File**: `components/investing/agents-tab.tsx` (modified)

Added prominent call-to-action card:

- Featured at top of Agents tab
- Direct link to debate agents page
- Visual distinction with gradient background

## API Usage

### POST Request Example

\`\`\`javascript
const response = await fetch('/api/debate-agents', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
ticker: 'AAPL',
quickMode: true,
quiet: true
})
})

const data = await response.json()

// Response structure:
{
"success": true,
"ticker": "AAPL",
"result": {
"company": "Apple Inc.",
"price": 185.50,
"decision": "BUY",
"analysis": "...",
"quote_data": { ... },
"final_trade_decision": "...",
"token_usage": {
"total_tokens": 1234,
"total_cost_usd": 0.0025
},
"timestamp": "2025-12-21T..."
}
}
\`\`\`

### GET Request Example

\`\`\`javascript
const response = await fetch('/api/debate-agents?ticker=AAPL')
const data = await response.json()
\`\`\`

## Environment Variables Required

The following environment variables must be set for the debate agents to work:

\`\`\`bash

# Required

GOOGLE_API_KEY=your_gemini_api_key
FINNHUB_API_KEY=your_finnhub_key
TAVILY_API_KEY=your_tavily_key

# Optional

EODHD_API_KEY=your_eodhd_key
OPENAI_API_KEY=your_openai_key

# Model Configuration (optional)

DEEP_MODEL=gemini-3-pro-preview
QUICK_MODEL=gemini-2.0-flash
GEMINI_RPM_LIMIT=15
\`\`\`

## How to Use

### From the Dashboard

1. Navigate to `/dashboard`
2. Click the "Agents" tab
3. Click "Try Debate Agents" button
4. Or directly go to `/dashboard/debate-agents`
5. Enter a ticker symbol (e.g., AAPL, NVDA, TSLA)
6. Toggle Quick Mode if desired
7. Click "Analyze"
8. View results with BUY/SELL/HOLD recommendation

### From the API

\`\`\`bash

# Using curl

curl -X POST http://localhost:3000/api/debate-agents \
 -H "Content-Type: application/json" \
 -d '{"ticker": "AAPL", "quickMode": true}'

# Using curl with GET

curl http://localhost:3000/api/debate-agents?ticker=AAPL
\`\`\`

### From Command Line

\`\`\`bash
cd lib/debate-agents-js
node simple-runner.js --ticker AAPL
node simple-runner.js --ticker AAPL --quick
\`\`\`

## Current Capabilities

Based on the available modules, the system can:

✅ **Working Features**:

- Ticker validation and correction
- Real-time quote data fetching
- Company information lookup
- Market data analysis (price, volume, P/E ratio, etc.)
- LLM-based investment analysis
- BUY/SELL/HOLD decision making
- Token usage tracking and cost estimation
- Markdown report generation
- Quick mode (Gemini Flash) and Deep mode (Gemini Pro)

⚠️ **Limited Features** (awaiting full implementation):

- Full multi-agent debate (simplified to single analyst)
- Memory/ChromaDB integration (available but not used)
- Advanced sentiment analysis tools
- News search integration
- Liquidity calculations

## Future Enhancements

To enable the full multi-agent debate system, implement:

1. **agents.js** - Agent factory functions for all roles
2. **graph.js** - LangGraph state machine for debate flow
3. **toolkit.js** - Market data and research tools
4. **main.js** - Full CLI with complete workflow

See [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) for details.

## Troubleshooting

### "Analysis failed" error

- Check that environment variables are set (GOOGLE_API_KEY, etc.)
- Verify API keys are valid
- Check Node.js version (18+ required)

### "Timed out" error

- Use Quick Mode for faster results
- Check network connectivity
- Verify API rate limits

### "Invalid ticker" error

- Use standard US ticker symbols
- International tickers may need format adjustment
- Check ticker exists on Yahoo Finance

### No results displayed

- Check browser console for errors
- Verify API endpoint is accessible
- Check server logs for subprocess errors

## Testing

### Test the API endpoint

\`\`\`bash

# In project root

npm run dev

# In another terminal

curl -X POST http://localhost:3000/api/debate-agents \
 -H "Content-Type: application/json" \
 -d '{"ticker": "AAPL", "quickMode": true}'
\`\`\`

### Test the runner directly

\`\`\`bash
cd lib/debate-agents-js
node simple-runner.js --ticker AAPL --quick
\`\`\`

### Test from dashboard

1. Start dev server: `npm run dev`
2. Navigate to http://localhost:3000/dashboard/debate-agents
3. Enter ticker and analyze

## Performance

- **Quick Mode**: ~5-15 seconds per analysis
- **Deep Mode**: ~30-60 seconds per analysis
- **Token Usage**: ~1,000-5,000 tokens per analysis
- **Cost**: ~$0.002-$0.01 per analysis (varies by model and market data)

## Security Considerations

- API endpoint validates ticker format
- Subprocess execution is isolated
- Environment variables are passed securely
- 5-minute timeout prevents resource exhaustion
- No user input is passed directly to shell

## Support

For issues or questions:

- Check [README.md](README.md) for setup instructions
- Review [QUICKSTART.md](QUICKSTART.md) for basic usage
- See [SETUP.md](SETUP.md) for detailed configuration
- Check logs in console for debugging

---

**Status**: ✅ Core integration complete
**Next Steps**: Implement full multi-agent debate system (agents.js, graph.js, toolkit.js)
