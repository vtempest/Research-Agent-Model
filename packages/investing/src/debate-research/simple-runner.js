#!/usr/bin/env node
/**
 * Simple Analysis Runner
 * Lightweight runner that uses available modules for basic stock analysis
 */

import {
  initialize,
  createQuickThinkingLLM,
  createDeepThinkingLLM,
  getPrompt,
  getFxRate,
  TickerCorrector,
  QuietModeReporter,
  getTracker,
} from './index.js';

import yahooFinance from 'yahoo-finance2';

/**
 * Run a simplified analysis using available modules
 */
async function runSimpleAnalysis({ ticker, quickMode = false }) {
  console.log(`\n=== Starting Analysis for ${ticker} ===\n`);

  try {
    // Initialize system
    await initialize();

    // Correct and validate ticker
    const tickerResult = TickerCorrector.correctAndValidate(ticker);
    const validatedTicker = tickerResult.corrected;
    console.log(`✓ Validated ticker: ${validatedTicker}`);

    // Get quote data
    console.log('Fetching quote data...');
    const quote = await yahooFinance.quote(validatedTicker);

    // Get company info
    const companyInfo = tickerResult.companyInfo || {};
    const companyName = companyInfo.name || quote.shortName || quote.longName || validatedTicker;

    console.log(`✓ Company: ${companyName}`);
    console.log(`✓ Price: $${quote.regularMarketPrice?.toFixed(2) || 'N/A'}`);

    // Select LLM based on mode
    const llm = quickMode ? createQuickThinkingLLM() : createDeepThinkingLLM();
    console.log(`✓ Using ${quickMode ? 'Quick' : 'Deep'} thinking model`);

    // Get market analyst prompt
    const marketPrompt = getPrompt('market_analyst');

    // Prepare analysis context
    const analysisContext = `
Ticker: ${validatedTicker}
Company: ${companyName}
Current Price: $${quote.regularMarketPrice || 'N/A'}
Market Cap: ${quote.marketCap ? `$${(quote.marketCap / 1e9).toFixed(2)}B` : 'N/A'}
Volume: ${quote.regularMarketVolume?.toLocaleString() || 'N/A'}
52-Week High: $${quote.fiftyTwoWeekHigh || 'N/A'}
52-Week Low: $${quote.fiftyTwoWeekLow || 'N/A'}
P/E Ratio: ${quote.trailingPE?.toFixed(2) || 'N/A'}
Dividend Yield: ${quote.dividendYield ? `${(quote.dividendYield * 100).toFixed(2)}%` : 'N/A'}
`;

    console.log('\nAnalyzing market data...');

    // Run basic market analysis
    const marketAnalysis = await llm.invoke([
      { role: 'system', content: marketPrompt.systemMessage },
      { role: 'user', content: `Analyze this stock and provide a brief investment recommendation:\n\n${analysisContext}` }
    ]);

    const analysis = marketAnalysis.content;

    // Extract decision
    let decision = 'HOLD';
    if (analysis.toLowerCase().includes('buy') && !analysis.toLowerCase().includes('sell')) {
      decision = 'BUY';
    } else if (analysis.toLowerCase().includes('sell')) {
      decision = 'SELL';
    }

    // Get token stats
    const tracker = getTracker();
    const stats = tracker.getTotalStats();

    // Create result
    const result = {
      ticker: validatedTicker,
      company: companyName,
      price: quote.regularMarketPrice,
      decision,
      analysis: analysis,
      quote_data: {
        marketCap: quote.marketCap,
        volume: quote.regularMarketVolume,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        trailingPE: quote.trailingPE,
        dividendYield: quote.dividendYield,
      },
      final_trade_decision: `FINAL DECISION: ${decision}\n\n${analysis}`,
      token_usage: {
        total_tokens: stats.total_tokens,
        total_cost_usd: stats.total_cost_usd,
      },
      timestamp: new Date().toISOString(),
    };

    // Generate report if needed
    const reporter = new QuietModeReporter(validatedTicker, companyName);
    const report = reporter.generateReport(result);

    console.log('\n' + '='.repeat(70));
    console.log(report);
    console.log('='.repeat(70));

    console.log('\n✓ Analysis complete');
    console.log(`Tokens used: ${stats.total_tokens}`);
    console.log(`Estimated cost: $${stats.total_cost_usd.toFixed(4)}`);

    return result;

  } catch (error) {
    console.error('\n✗ Analysis failed:', error.message);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  // Parse arguments
  let ticker = null;
  let quickMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ticker' || args[i] === '-t') {
      ticker = args[i + 1];
      i++;
    } else if (args[i] === '--quick' || args[i] === '-q') {
      quickMode = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node simple-runner.js --ticker SYMBOL [--quick]

Options:
  --ticker, -t  Stock ticker symbol (required)
  --quick, -q   Use quick mode (faster, less detailed)
  --help, -h    Show this help message

Examples:
  node simple-runner.js --ticker AAPL
  node simple-runner.js --ticker NVDA --quick
`);
      process.exit(0);
    }
  }

  if (!ticker) {
    console.error('Error: --ticker is required');
    console.log('Run with --help for usage information');
    process.exit(1);
  }

  runSimpleAnalysis({ ticker, quickMode })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runSimpleAnalysis };
