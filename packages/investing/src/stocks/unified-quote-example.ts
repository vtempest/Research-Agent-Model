/**
 * Example usage of the Unified Quote Service
 * Demonstrates how to use the combined yfinance, finnhub, and alpaca APIs
 */

import { unifiedQuoteService, getQuote, getQuotes } from "./unified-quote-service";

/**
 * Example 1: Get a single quote with automatic fallback
 */
async function exampleSingleQuote() {
  console.log("\n=== Example 1: Single Quote ===");

  const result = await getQuote("AAPL");

  if (result.success && result.data) {
    console.log("✓ Quote fetched successfully!");
    console.log(`Symbol: ${result.data.symbol}`);
    console.log(`Price: $${result.data.price.toFixed(2)}`);
    console.log(`Change: ${result.data.change?.toFixed(2) || "N/A"}`);
    console.log(`Change %: ${result.data.changePercent?.toFixed(2) || "N/A"}%`);
    console.log(`Source: ${result.data.source}`);
    console.log(`Name: ${result.data.name}`);
  } else {
    console.error("✗ Failed to fetch quote:", result.error);
  }
}

/**
 * Example 2: Get multiple quotes with batch request and fallback
 */
async function exampleMultipleQuotes() {
  console.log("\n=== Example 2: Multiple Quotes ===");

  const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"];
  const result = await getQuotes(symbols);

  if (result.success && result.data) {
    console.log(`✓ Fetched ${result.data.quotes.length}/${symbols.length} quotes`);
    console.log(`Source: ${result.data.source}`);

    result.data.quotes.forEach(quote => {
      console.log(
        `${quote.symbol}: $${quote.price.toFixed(2)} (${quote.source})`
      );
    });
  } else {
    console.error("✗ Failed to fetch quotes:", result.error);
  }
}

/**
 * Example 3: Get quote from specific source
 */
async function exampleSpecificSource() {
  console.log("\n=== Example 3: Specific Source ===");

  const symbol = "AAPL";

  // Try yfinance
  const yfinanceResult = await unifiedQuoteService.getQuoteFromSource(symbol, "yfinance");
  console.log("yfinance:", yfinanceResult.success ? "✓" : "✗");

  // Try finnhub
  const finnhubResult = await unifiedQuoteService.getQuoteFromSource(symbol, "finnhub");
  console.log("finnhub:", finnhubResult.success ? "✓" : "✗");

  // Try alpaca
  const alpacaResult = await unifiedQuoteService.getQuoteFromSource(symbol, "alpaca");
  console.log("alpaca:", alpacaResult.success ? "✓" : "✗");
}

/**
 * Example 4: Handle failures gracefully
 */
async function exampleErrorHandling() {
  console.log("\n=== Example 4: Error Handling ===");

  // Try an invalid symbol
  const result = await getQuote("INVALID_SYMBOL_XYZ");

  if (!result.success) {
    console.log("✓ Error handled gracefully");
    console.log("Error message:", result.error);
  }
}

/**
 * Example 5: Real-time data comparison across sources
 */
async function exampleSourceComparison() {
  console.log("\n=== Example 5: Source Comparison ===");

  const symbol = "AAPL";

  const [yfinance, finnhub, alpaca] = await Promise.all([
    unifiedQuoteService.getQuoteFromSource(symbol, "yfinance"),
    unifiedQuoteService.getQuoteFromSource(symbol, "finnhub"),
    unifiedQuoteService.getQuoteFromSource(symbol, "alpaca"),
  ]);

  console.log(`\nPrice comparison for ${symbol}:`);

  if (yfinance.success && yfinance.data) {
    console.log(`yfinance: $${yfinance.data.price.toFixed(2)}`);
  }

  if (finnhub.success && finnhub.data) {
    console.log(`finnhub:  $${finnhub.data.price.toFixed(2)}`);
  }

  if (alpaca.success && alpaca.data) {
    console.log(`alpaca:   $${alpaca.data.price.toFixed(2)}`);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log("=".repeat(50));
  console.log("Unified Quote Service Examples");
  console.log("=".repeat(50));

  try {
    await exampleSingleQuote();
    await exampleMultipleQuotes();
    await exampleSpecificSource();
    await exampleErrorHandling();
    await exampleSourceComparison();

    console.log("\n" + "=".repeat(50));
    console.log("All examples completed!");
    console.log("=".repeat(50));
  } catch (error: any) {
    console.error("Error running examples:", error.message);
  }
}

// Export for use in other modules
export {
  exampleSingleQuote,
  exampleMultipleQuotes,
  exampleSpecificSource,
  exampleErrorHandling,
  exampleSourceComparison,
  runAllExamples,
};

// Run if called directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
