/**
 * Yahoo Finance Wrapper - Uses official yahoo-finance2 library
 * This is the main entry point for Yahoo Finance data
 */

// Re-export everything from the new Yahoo Finance wrapper
export * from './yahoo-finance-wrapper';

// Import and re-export the singleton instance as 'yfinance' for backward compatibility
import { yahooFinance as _yahooFinance } from './yahoo-finance-wrapper';
export const yfinance = _yahooFinance;

// Re-export the class
export { YahooFinanceWrapper } from './yahoo-finance-wrapper';

// Default export
export default _yahooFinance;
