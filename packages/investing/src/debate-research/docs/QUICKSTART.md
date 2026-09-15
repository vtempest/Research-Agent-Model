# Quick Start Guide

Get up and running with the JavaScript Multi-Agent Trading System in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm 9+ installed
- API keys ready (see below)

## Step 1: Install Dependencies (30 seconds)

\`\`\`bash
cd lib/debate-agents/debate-agents-js
npm install
\`\`\`

## Step 2: Configure API Keys (2 minutes)

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` and add **at minimum**:

\`\`\`bash
GOOGLE_API_KEY=your_gemini_api_key_here
FINNHUB_API_KEY=your_finnhub_key_here
TAVILY_API_KEY=your_tavily_key_here
\`\`\`

### Get Free API Keys

1. **Google Gemini**: https://ai.google.dev/ (Free tier: 15 RPM)
2. **Finnhub**: https://finnhub.io/ (Free tier: 60 calls/min)
3. **Tavily**: https://tavily.com/ (Free tier: 1000/month)

## Step 3: Test Installation (30 seconds)

\`\`\`bash
node health_check.js
\`\`\`

You should see:
\`\`\`
✓ Overall health check: PASSED
System is ready to run analyses.
\`\`\`

## Step 4: Try the System (1 minute)

Create a test file `test.js`:

\`\`\`javascript
import {
  initialize,
  createQuickThinkingLLM,
  getPrompt,
  getFxRate,
  TickerCorrector,
  getTracker,
} from './index.js';

async function test() {
  // Initialize
  await initialize();

  // Test LLM
  const llm = createQuickThinkingLLM();
  console.log('✓ LLM created:', llm.modelName);

  // Test prompts
  const prompt = getPrompt('market_analyst');
  console.log('✓ Prompt loaded:', prompt.agentName);

  // Test FX conversion
  const [rate, source] = await getFxRate('JPY', 'USD');
  console.log(`✓ FX rate: 1 JPY = $${rate} USD (source: ${source})`);

  // Test ticker correction
  const result = TickerCorrector.correctAndValidate('AAPL');
  console.log('✓ Ticker validated:', result.corrected);

  // Test token tracking
  const tracker = getTracker();
  console.log('✓ Token tracker ready');

  console.log('\n✅ All systems operational!');
}

test().catch(console.error);
\`\`\`

Run it:

\`\`\`bash
node test.js
\`\`\`

Expected output:
\`\`\`
Multi-Agent Trading System initialized successfully
JavaScript version: 1.0.0
Based on Python version: 7.0
✓ LLM created: gemini-2.0-flash
✓ Prompt loaded: Market Analyst
✓ FX rate: 1 JPY = $0.0067 USD (source: yfinance)
✓ Ticker validated: AAPL
✓ Token tracker ready

✅ All systems operational!
\`\`\`

## What You Can Do Now

### 1. Use Individual Modules

\`\`\`javascript
import {
  createQuickThinkingLLM,
  getPrompt,
  FinancialSituationMemory,
  getFxRate,
} from './index.js';

// Create an LLM and ask it something
const llm = createQuickThinkingLLM();
const response = await llm.invoke('Explain P/E ratio');

// Load agent prompts
const marketPrompt = getPrompt('market_analyst');
console.log(marketPrompt.systemMessage);

// Convert currency
const [jpyToUsd] = await getFxRate('JPY', 'USD');
const usdValue = 10000 * jpyToUsd; // ¥10,000 -> USD

// Store memories
const memory = new FinancialSituationMemory('my_memory');
await memory.addSituations(['Market analysis from 2024-12-19']);
\`\`\`

### 2. Track Token Usage

\`\`\`javascript
import { getTracker } from './index.js';

const tracker = getTracker();

// After some LLM calls...
const stats = tracker.getTotalStats();
console.log(`Total tokens: ${stats.total_tokens}`);
console.log(`Estimated cost: $${stats.total_cost_usd}`);

tracker.printSummary(); // Pretty print
\`\`\`

### 3. Generate Reports

\`\`\`javascript
import { QuietModeReporter } from './index.js';

const reporter = new QuietModeReporter('AAPL', 'Apple Inc.');

const analysisResult = {
  final_trade_decision: 'FINAL DECISION: BUY\n\nRationale: Strong fundamentals...',
};

const markdown = reporter.generateReport(analysisResult);
console.log(markdown);
\`\`\`

## Next Steps

### Learn More

- **Full documentation**: [README.md](README.md)
- **Setup guide**: [SETUP.md](SETUP.md)
- **Architecture**: [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)
- **Completion status**: [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)

### Complete the System

To run full stock analyses, you'll need to implement:

1. **agents.js** - Agent factory functions
2. **graph.js** - LangGraph state machine
3. **toolkit.js** - Market data tools
4. **main.js** - CLI entry point

See [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) for details.

### Use with Python Version

The JavaScript version can work alongside Python:

\`\`\`bash
# Share prompts
cd ../
python -c "from prompts import export_prompts; export_prompts()"

# JavaScript will auto-load from ../prompts/*.json
\`\`\`

Both versions can:
- Share ChromaDB memory collections
- Read each other's JSON results
- Use the same prompt files

## Troubleshooting

### "Missing required environment variable"

Copy `.env.example` to `.env` and add your API keys.

### "Module not found"

Run `npm install` in the `debate-agents-js` directory.

### "Rate limit exceeded"

Lower `GEMINI_RPM_LIMIT` in `.env` or wait a moment.

### "Health check failed"

Check API keys are valid and have correct format.

## Common Use Cases

### 1. Quick LLM Test

\`\`\`javascript
import { createQuickThinkingLLM } from './index.js';

const llm = createQuickThinkingLLM();
const answer = await llm.invoke('What is the capital of France?');
console.log(answer.content);
\`\`\`

### 2. Check System Info

\`\`\`javascript
import { getSystemInfo } from './index.js';

const info = getSystemInfo();
console.log(JSON.stringify(info, null, 2));
\`\`\`

### 3. Validate Configuration

\`\`\`javascript
import { config, validateEnvironmentVariables } from './index.js';

try {
  validateEnvironmentVariables();
  console.log('✓ Configuration valid');
  console.log('Deep model:', config.deepThinkLlm);
  console.log('Quick model:', config.quickThinkLlm);
} catch (error) {
  console.error('✗ Configuration error:', error.message);
}
\`\`\`

## Get Help

- **Health check**: `node health_check.js`
- **Python version**: `../` (parent directory)
- **Issues**: Report in GitHub

---

**Ready to build? Start with the examples above!** 🚀
