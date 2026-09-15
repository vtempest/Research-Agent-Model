/**
 * Multi-Agent Trading System - Main Export Module
 * JavaScript port of the Python debate-agents system
 *
 * This module exports all core functionality for easy consumption
 */

// Configuration
export { config, Config, validateEnvironmentVariables } from './config.js';

// LLM Models
export {
  createGeminiModel,
  createQuickThinkingLLM,
  createDeepThinkingLLM,
  createConsultantLLM,
  getConsultantLLM,
  quickThinkingLlm,
  deepThinkingLlm,
  GLOBAL_RATE_LIMITER,
} from './llms.js';

// Prompts
export {
  AgentPrompt,
  PromptRegistry,
  getRegistry,
  getPrompt,
  getAllPrompts,
  exportPrompts,
} from './prompts.js';

// Utilities
export {
  sleep,
  retryWithBackoff,
  invokeWithRateLimitHandling,
  filterMessagesForGemini,
  getContextFromConfig,
  getAnalysisContext,
  sanitizeTickerForCollection,
  getCurrencyFromTicker,
  formatNumber,
  formatCurrency,
  deepClone,
  measureTime,
  chunkArray,
  waitForAllWithProgress,
  safeJsonParse,
  truncateString,
  getCurrentTimestamp,
  getFilenameTimestamp,
} from './utils.js';

// Memory System
export {
  FinancialSituationMemory,
  createMemoryInstances,
  cleanupAllMemories,
  getAllMemoryStats,
} from './memory.js';

// Token Tracking
export {
  TokenUsage,
  AgentTokenStats,
  TokenTracker,
  TokenTrackingCallback,
  getTracker,
} from './token_tracker.js';

// FX Normalization
export {
  getFxRateYahooFinance,
  getFxRateFallback,
  getFxRate,
  normalizeToUsd,
  normalizeMarketCap,
  normalizeVolume,
} from './fx_normalization.js';

// Ticker Corrections
export {
  TickerCorrector,
  REUTERS_CORRECTIONS,
  ALTERNATIVE_FORMATS,
  KNOWN_VALID_TICKERS,
} from './ticker_corrections.js';

// Report Generation
export {
  QuietModeReporter,
} from './report_generator.js';

// Health Check
export {
  runHealthCheck,
} from './health_check.js';

// Version info
export const VERSION = '1.0.0';
export const PYTHON_SOURCE_VERSION = '7.0';

/**
 * Initialize the system (call this before using any functionality)
 */
export async function initialize() {
  try {
    validateEnvironmentVariables();
    console.log('Multi-Agent Trading System initialized successfully');
    console.log(`JavaScript version: ${VERSION}`);
    console.log(`Based on Python version: ${PYTHON_SOURCE_VERSION}`);
    return true;
  } catch (error) {
    console.error('Initialization failed:', error.message);
    throw error;
  }
}

/**
 * System information
 */
export function getSystemInfo() {
  return {
    version: VERSION,
    pythonSourceVersion: PYTHON_SOURCE_VERSION,
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.ENVIRONMENT || 'dev',
    llmProvider: process.env.LLM_PROVIDER || 'google',
    deepModel: process.env.DEEP_MODEL || 'gemini-3-pro-preview',
    quickModel: process.env.QUICK_MODEL || 'gemini-2.0-flash',
    memoryEnabled: (process.env.ENABLE_MEMORY || 'true').toLowerCase() === 'true',
    consultantEnabled: (process.env.ENABLE_CONSULTANT || 'true').toLowerCase() === 'true',
  };
}

// Default export
export default {
  initialize,
  getSystemInfo,
  VERSION,
  PYTHON_SOURCE_VERSION,
};
