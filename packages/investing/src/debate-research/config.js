/**
 * Configuration module for Multi-Agent Trading System
 * JavaScript port of Python config.py
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables early
dotenvConfig();

/**
 * Logging configuration
 */
export function configureLogging(level = 'info') {
  // In a production app, configure winston or pino here
  console.log(`Logging configured at ${level} level`);
}

/**
 * Get environment variable with validation
 */
function getEnvVar(varName, required = true, defaultValue = null) {
  const value = process.env[varName] ?? defaultValue;
  if (required && !value) {
    console.error(`Missing required environment variable: ${varName}`);
    return '';
  }
  return value || '';
}

/**
 * Configure LangSmith tracing
 */
export function configureLangSmithTracing() {
  if (getEnvVar('LANGSMITH_API_KEY', false)) {
    process.env.LANGSMITH_TRACING = process.env.LANGSMITH_TRACING || 'true';
    process.env.LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT || 'Deep-Trading-System-Gemini3-JS';

    if (!process.env.LANGSMITH_ENDPOINT) {
      process.env.LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
    }

    console.log(`LangSmith configured for project: ${process.env.LANGSMITH_PROJECT}`);
  }
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentVariables() {
  const requiredVars = ['GOOGLE_API_KEY', 'FINNHUB_API_KEY', 'TAVILY_API_KEY'];

  // Check for EODHD key (Optional but recommended)
  if (!getEnvVar('EODHD_API_KEY', false)) {
    console.warn('EODHD_API_KEY missing - High quality international data will be disabled.');
  }

  const missingVars = requiredVars.filter(varName => !getEnvVar(varName, true));

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  configureLangSmithTracing();
  console.log('Environment variables validated');
}

/**
 * Configuration class
 */
export class Config {
  constructor() {
    this.resultsDir = path.resolve(process.env.RESULTS_DIR || './results');
    this.dataCacheDir = path.resolve(process.env.DATA_CACHE_DIR || './data_cache');

    this.llmProvider = process.env.LLM_PROVIDER || 'google';
    this.deepThinkLlm = process.env.DEEP_MODEL || 'gemini-3-pro-preview';
    this.quickThinkLlm = process.env.QUICK_MODEL || 'gemini-2.0-flash';

    this.maxDebateRounds = parseInt(process.env.MAX_DEBATE_ROUNDS || '2', 10);
    this.maxRiskDiscussRounds = parseInt(process.env.MAX_RISK_DISCUSS_ROUNDS || '1', 10);

    this.onlineTools = (process.env.ONLINE_TOOLS || 'true').toLowerCase() === 'true';
    this.enableMemory = (process.env.ENABLE_MEMORY || 'true').toLowerCase() === 'true';

    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE || '0.1');
    this.maxDailyTrades = parseInt(process.env.MAX_DAILY_TRADES || '5', 10);
    this.riskFreeRate = parseFloat(process.env.RISK_FREE_RATE || '0.03');
    this.defaultTicker = process.env.DEFAULT_TICKER || 'AAPL';

    this.logLevel = process.env.LOG_LEVEL || 'INFO';

    this.apiTimeout = parseInt(process.env.API_TIMEOUT || '300', 10) * 1000; // Convert to ms
    this.apiRetryAttempts = parseInt(process.env.API_RETRY_ATTEMPTS || '10', 10);

    // Free tier: 15 RPM | Paid tier (Tier 1): 360 RPM | Tier 2: 1000+ RPM
    this.geminiRpmLimit = parseInt(process.env.GEMINI_RPM_LIMIT || '15', 10);

    this.chromaPersistDirectory = process.env.CHROMA_PERSIST_DIR || './chroma_db';
    this.environment = process.env.ENVIRONMENT || 'dev';

    this.langsmithTracingEnabled = (process.env.LANGSMITH_TRACING || 'true').toLowerCase() === 'true';

    // Create directories
    this._createDirectories();
  }

  _createDirectories() {
    [this.resultsDir, this.dataCacheDir, this.chromaPersistDirectory].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getGoogleApiKey() {
    return process.env.GOOGLE_API_KEY || '';
  }
}

// Export singleton instance
export const config = new Config();

// Initialize logging
configureLogging(config.logLevel.toLowerCase());
