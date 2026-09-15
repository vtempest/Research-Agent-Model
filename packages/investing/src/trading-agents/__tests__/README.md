# Debate Agents Unit Tests

Comprehensive Vitest unit tests for the debate agents that print detailed stock analysis from all analysts.

## Overview

These tests run all the analyst agents (Market, News, Sentiment, Fundamentals, Bull, Bear) and conduct a complete investment debate, printing all the information gathered and analyzed about a stock.

## Setup

### 1. Install Dependencies

```bash
cd packages/investing
pnpm install
```

### 2. Set Environment Variables

Create a `.env` file in `packages/investing/` with:

```bash
# LLM Configuration
LLM_PROVIDER=openai           # or anthropic, groq, etc.
DEEP_THINK_MODEL=gpt-4       # Model for complex reasoning
QUICK_THINK_MODEL=gpt-3.5-turbo  # Model for quick tasks

# API Keys
OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here  # if using anthropic
# GROQ_API_KEY=your_key_here       # if using groq

# Test Configuration (optional)
TEST_STOCK=AAPL              # Stock ticker to analyze (default: AAPL)
TEST_DATE=2024-01-15         # Trade date (default: today)
```

## Running the Tests

### Run all debate tests

```bash
cd packages/investing
pnpm test debate-agents
```

### Run with specific stock

```bash
TEST_STOCK=TSLA pnpm test debate-agents
```

### Run with verbose output

```bash
pnpm test debate-agents --reporter=verbose
```

### Watch mode (re-run on file changes)

```bash
pnpm test debate-agents --watch
```

## Test Output

The tests will print comprehensive information organized into sections:

### 1. 📊 Market Technical Analysis
- Price action and trends
- Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, VWMA)
- Support and resistance levels
- Volume analysis

### 2. 📰 News Analysis
- Recent news headlines and sentiment
- Key events and announcements
- Market sentiment from news sources
- Impact assessment

### 3. 💭 Sentiment Analysis
- Social media sentiment
- Community discussions
- Positive/negative mentions
- Overall sentiment score

### 4. 📈 Fundamental Analysis
- Financial metrics (P/E, Market Cap, Revenue, etc.)
- Financial health indicators
- Balance sheet strength
- Cash flow analysis

### 5. 🐂 Bull Case
- Growth potential arguments
- Competitive advantages
- Positive indicators and catalysts
- Risk mitigation strategies
- Upside scenarios

### 6. 🐻 Bear Case
- Risk factors and threats
- Valuation concerns
- Negative indicators
- Challenges to bull arguments
- Downside scenarios

### 7. ⚖️ Final Investment Recommendation
- Analysis summary
- Winning arguments
- Risk-reward assessment
- Clear decision (INVEST / NOT INVEST)
- Confidence level

## Test Structure

### Main Test Suite: `Debate Agents - Complete Stock Analysis`

1. **Market Technical Analyst** - Analyzes technical indicators
2. **News Analyst** - Fetches and analyzes recent news
3. **Sentiment Analyst** - Analyzes social sentiment
4. **Fundamentals Analyst** - Evaluates financial fundamentals
5. **Bull vs Bear Debate** - Conducts multi-round debate
6. **Complete Analysis Summary** - Prints all information

### Unit Tests: `Individual Agent Unit Tests`

Tests that each agent class can be instantiated correctly.

## Customization

### Adjust Debate Rounds

In the test file, modify the facilitator initialization:

```typescript
const facilitator = new InvestmentDebateFacilitator(llmClient, 3) // 3 rounds instead of 2
```

### Change Test Timeouts

In `vitest.config.ts`:

```typescript
testTimeout: 300000, // 5 minutes instead of 3
```

### Test Multiple Stocks

Create a loop in your test:

```typescript
const stocks = ['AAPL', 'TSLA', 'NVDA']
for (const stock of stocks) {
  // Run tests for each stock
}
```

## Troubleshooting

### API Rate Limits

If you hit rate limits:
1. Reduce the number of debate rounds
2. Add delays between API calls
3. Use a different LLM provider or model

### Timeout Errors

If tests timeout:
1. Increase `testTimeout` in vitest.config.ts
2. Use faster models (e.g., gpt-3.5-turbo)
3. Reduce debate rounds

### Missing Data

If some sections show "Not available":
1. Check API keys are set correctly
2. Verify internet connection for news/data APIs
3. Check stock ticker is valid

## Output Example

```
================================================================================
📊 MARKET TECHNICAL ANALYSIS FOR AAPL
================================================================================

Recent Price Action for AAPL:
2024-01-10: Close=$185.50, Volume=75000000
...

Technical Indicators (Latest Values):
- 50 SMA: $180.25
- 200 SMA: $175.80
- RSI: 65.3
...

================================================================================

--- ROUND 1: BULL ANALYST ---

## Bull Analyst Report

### 🎯 THOUGHT PROCESS
Based on the technical indicators showing strong upward momentum and recent
positive news about product launches, I'm focusing on growth catalysts...

### 📊 KEY BULL ARGUMENTS
1. **Technical Strength**: The stock is trading above both 50-day and 200-day
   moving averages, indicating a strong uptrend...

...
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Run Debate Agent Tests
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    TEST_STOCK: AAPL
  run: |
    cd packages/investing
    pnpm test debate-agents
```

## Contributing

To add new analyst agents:

1. Create agent class in `src/trading-agents/agents/`
2. Add test in `debate-agents.test.ts`
3. Update this README with new analyst description

## License

See root LICENSE file
