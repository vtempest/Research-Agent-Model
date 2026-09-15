#!/usr/bin/env tsx
/**
 * Demo script for the Unified Quote Service.
 *
 * This is an executable example, not a unit test: it hits live quote
 * providers and reports what it gets back.
 *
 * Run with: tsx examples/unified-quote-demo.ts
 */

import { pathToFileURL } from "node:url";

import {
  getQuote,
  getQuotes,
  unifiedQuoteService,
} from "../src/stocks/unified-quote-service";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSingleQuote() {
  log("\n=== Test 1: Single Quote (AAPL) ===", "cyan");

  try {
    const result = await getQuote("AAPL");

    if (result.success && result.data) {
      log("✓ Success!", "green");
      log(`Symbol: ${result.data.symbol}`, "blue");
      log(`Price: $${result.data.price.toFixed(2)}`, "blue");
      log(`Change: ${result.data.change?.toFixed(2) || "N/A"}`, "blue");
      log(
        `Change %: ${result.data.changePercent?.toFixed(2) || "N/A"}%`,
        "blue",
      );
      log(`Source: ${result.data.source}`, "yellow");
      log(`Name: ${result.data.name}`, "blue");
      log(`Exchange: ${result.data.exchange}`, "blue");
    } else {
      log(`✗ Failed: ${result.error}`, "red");
    }
  } catch (error: any) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testMultipleQuotes() {
  log("\n=== Test 2: Multiple Quotes ===", "cyan");

  const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA"];

  try {
    const result = await getQuotes(symbols);

    if (result.success && result.data) {
      log(
        `✓ Fetched ${result.data.quotes.length}/${symbols.length} quotes`,
        "green",
      );
      log(`Source: ${result.data.source}`, "yellow");

      result.data.quotes.forEach((quote) => {
        log(
          `  ${quote.symbol}: $${quote.price.toFixed(2)} (${quote.source})`,
          "blue",
        );
      });
    } else {
      log(`✗ Failed: ${result.error}`, "red");
    }
  } catch (error: any) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function testSourceSelection() {
  log("\n=== Test 3: Source Selection (AAPL) ===", "cyan");

  const symbol = "AAPL";
  const sources = ["yfinance", "finnhub", "alpaca"] as const;

  for (const source of sources) {
    try {
      const result = await unifiedQuoteService.getQuoteFromSource(
        symbol,
        source,
      );

      if (result.success && result.data) {
        log(`✓ ${source}: $${result.data.price.toFixed(2)}`, "green");
      } else {
        log(`✗ ${source}: ${result.error}`, "red");
      }
    } catch (error: any) {
      log(`✗ ${source}: ${error.message}`, "red");
    }
  }
}

async function testErrorHandling() {
  log("\n=== Test 4: Error Handling (Invalid Symbol) ===", "cyan");

  try {
    const result = await getQuote("INVALID_SYMBOL_XYZ123");

    if (!result.success) {
      log("✓ Error handled gracefully", "green");
      log(`Error: ${result.error}`, "yellow");
    } else {
      log("✗ Expected error but got success", "red");
    }
  } catch (error: any) {
    log(`✗ Unexpected exception: ${error.message}`, "red");
  }
}

async function testPerformance() {
  log("\n=== Test 5: Performance Test ===", "cyan");

  const symbols = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "TSLA",
    "AMZN",
    "META",
    "NVDA",
    "AMD",
  ];

  try {
    const startTime = Date.now();
    const result = await getQuotes(symbols);
    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      log(
        `✓ Fetched ${result.data.quotes.length} quotes in ${duration}ms`,
        "green",
      );
      log(
        `Average: ${(duration / result.data.quotes.length).toFixed(0)}ms per quote`,
        "yellow",
      );
    } else {
      log(`✗ Failed: ${result.error}`, "red");
    }
  } catch (error: any) {
    log(`✗ Error: ${error.message}`, "red");
  }
}

async function runAllTests() {
  log("================================================", "cyan");
  log("        Unified Quote Service Tests", "cyan");
  log("================================================", "cyan");

  await testSingleQuote();
  await testMultipleQuotes();
  await testSourceSelection();
  await testErrorHandling();
  await testPerformance();

  log("\n================================================", "cyan");
  log("           Tests Complete!", "cyan");
  log("================================================", "cyan");
}

// Run when executed directly (the package is ESM, so require.main is unavailable)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAllTests().catch((error) => {
    log(`\nFatal error: ${error.message}`, "red");
    console.error(error);
    process.exit(1);
  });
}

export { runAllTests };
