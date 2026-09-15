# Unified Quote Service

A comprehensive stock quote service that combines **yfinance**, **finnhub**, and **alpaca** APIs with automatic fallback for maximum reliability.

## Features

- **Automatic Fallback**: Tries yfinance → finnhub → alpaca in order
- **Batch Requests**: Fetch multiple quotes efficiently
- **Normalized Data**: Consistent data structure across all sources
- **Source Selection**: Choose a specific data source when needed
- **Error Handling**: Graceful fallback on failures

## Installation

The service is already included in the investing package. No additional installation required.

## Configuration

Set the following environment variables for API access:

```bash
# Alpaca API credentials
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET=your_alpaca_secret_key

# Finnhub API key (optional)
FINNHUB_API_KEY=your_finnhub_api_key
```

## Usage

### Basic Usage

```typescript
import { getQuote, getQuotes } from './stocks/unified-quote-service';

// Get a single quote
const quote = await getQuote('AAPL');
if (quote.success) {
  console.log(`${quote.data.symbol}: $${quote.data.price}`);
  console.log(`Source: ${quote.data.source}`); // yfinance, finnhub, or alpaca
}

// Get multiple quotes
const quotes = await getQuotes(['AAPL', 'MSFT', 'GOOGL']);
if (quotes.success) {
  quotes.data.quotes.forEach(q => {
    console.log(`${q.symbol}: $${q.price} (${q.source})`);
  });
}
```

### Advanced Usage

```typescript
import { unifiedQuoteService } from './stocks/unified-quote-service';

// Get quote from a specific source
const yfinanceQuote = await unifiedQuoteService.getQuoteFromSource('AAPL', 'yfinance');
const finnhubQuote = await unifiedQuoteService.getQuoteFromSource('AAPL', 'finnhub');
const alpacaQuote = await unifiedQuoteService.getQuoteFromSource('AAPL', 'alpaca');

// Compare prices across sources
console.log('Price comparison:');
console.log('yfinance:', yfinanceQuote.data?.price);
console.log('finnhub:', finnhubQuote.data?.price);
console.log('alpaca:', alpacaQuote.data?.price);
```

## API Reference

### `getQuote(symbol: string)`

Fetches a single stock quote with automatic fallback.

**Parameters:**
- `symbol` (string): Stock ticker symbol (e.g., "AAPL")

**Returns:** `Promise<QuoteServiceResponse>`

```typescript
interface QuoteServiceResponse {
  success: boolean;
  data?: NormalizedQuote;
  error?: string;
}
```

### `getQuotes(symbols: string[])`

Fetches multiple stock quotes efficiently.

**Parameters:**
- `symbols` (string[]): Array of stock ticker symbols

**Returns:** `Promise<QuotesServiceResponse>`

```typescript
interface QuotesServiceResponse {
  success: boolean;
  data?: NormalizedQuotes;
  error?: string;
}
```

### `getQuoteFromSource(symbol: string, source: 'yfinance' | 'finnhub' | 'alpaca')`

Fetches a quote from a specific data source.

**Parameters:**
- `symbol` (string): Stock ticker symbol
- `source` (string): Data source to use

**Returns:** `Promise<QuoteServiceResponse>`

## Data Structure

### NormalizedQuote

All quotes are normalized to this structure:

```typescript
interface NormalizedQuote {
  symbol: string;              // Ticker symbol
  price: number;               // Current price
  change: number | null;       // Price change
  changePercent: number | null; // Price change percentage
  open: number | null;         // Opening price
  high: number | null;         // Day high
  low: number | null;          // Day low
  previousClose: number | null; // Previous close
  volume: number | null;       // Trading volume
  marketCap: number | null;    // Market capitalization
  currency: string | null;     // Currency (e.g., "USD")
  name: string | null;         // Company name
  exchange: string | null;     // Exchange name
  timestamp: Date;             // Data timestamp
  source: "yfinance" | "finnhub" | "alpaca"; // Data source
}
```

## Fallback Logic

The service tries data sources in the following order:

1. **yfinance** (Yahoo Finance)
   - Primary source
   - Free, no API key required
   - Most comprehensive data

2. **finnhub** (Finnhub API)
   - Secondary fallback
   - Requires API key (free tier available)
   - Good for real-time quotes

3. **alpaca** (Alpaca Markets)
   - Final fallback
   - Requires API credentials
   - Reliable for US equities

## Error Handling

The service handles errors gracefully:

```typescript
const result = await getQuote('INVALID_SYMBOL');

if (!result.success) {
  console.error('Error:', result.error);
  // Error: Failed to fetch quote for INVALID_SYMBOL from all sources
}
```

## Batch Requests

For multiple symbols, use `getQuotes()`:

```typescript
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'];
const result = await getQuotes(symbols);

if (result.success) {
  console.log(`Fetched ${result.data.quotes.length}/${symbols.length} quotes`);
  console.log(`Source: ${result.data.source}`); // 'yfinance', 'mixed', etc.
}
```

The service will:
1. Try to fetch all quotes from yfinance in one batch
2. For any failed symbols, try finnhub individually
3. For still-failed symbols, try alpaca as final fallback

## Examples

See [unified-quote-example.ts](./unified-quote-example.ts) for comprehensive examples:

- Single quote with automatic fallback
- Multiple quotes with batch processing
- Specific source selection
- Error handling
- Source comparison

Run the examples:

```bash
tsx packages/investing/src/stocks/unified-quote-example.ts
```

## Performance Tips

1. **Batch requests**: Use `getQuotes()` for multiple symbols instead of multiple `getQuote()` calls
2. **Cache results**: Stock data doesn't change every millisecond, consider caching
3. **Specific source**: If you know which source works best for your use case, use `getQuoteFromSource()`

## Troubleshooting

### No API credentials configured

If you see errors about missing credentials:

```
Failed to fetch quote from all sources
```

Make sure you've set the environment variables:

```bash
export ALPACA_API_KEY=your_key
export ALPACA_SECRET=your_secret
export FINNHUB_API_KEY=your_key
```

### yfinance not working

If yfinance fails (rate limits, etc.), the service will automatically try finnhub and alpaca.

### All sources failing

If all sources fail for a symbol:
1. Check the symbol is valid
2. Check your API credentials
3. Check your network connection
4. Try the symbol on each source individually using `getQuoteFromSource()`

## License

MIT
