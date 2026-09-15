/**
 * LLM configuration and initialization module
 * JavaScript port of Python llms.py
 * Updated for Google Gemini 3 with Safety Settings and Rate Limiting
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { config } from './config.js';

/**
 * Safety settings for Gemini models
 * Relax safety settings slightly for financial/market analysis context
 */
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

/**
 * Check if a Gemini model name is version 3.0 or greater
 */
function isGeminiV3OrGreater(modelName) {
  if (!modelName.startsWith('gemini-')) {
    return false;
  }

  const match = modelName.match(/gemini-([0-9.]+)/);
  if (!match) {
    return false;
  }

  const versionStr = match[1];
  try {
    const majorVersion = parseInt(versionStr.split('.')[0], 10);
    return majorVersion >= 3;
  } catch (error) {
    return false;
  }
}

/**
 * Create a rate limiter from RPM (requests per minute) setting
 * Note: LangChain JS doesn't have built-in InMemoryRateLimiter like Python
 * We'll use a simple token bucket implementation
 */
class SimpleRateLimiter {
  constructor(rpm) {
    const safetyFactor = 0.8;
    this.rps = (rpm / 60.0) * safetyFactor;
    this.maxBucket = Math.max(5, Math.floor(rpm * 0.1));
    this.tokens = this.maxBucket;
    this.lastRefill = Date.now();

    console.log(
      `Rate limiter configured: ${rpm} RPM → ${this.rps.toFixed(2)} RPS ` +
      `(80% of limit, bucket size: ${this.maxBucket})`
    );
  }

  async acquire() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.rps;

    this.tokens = Math.min(this.maxBucket, this.tokens + tokensToAdd);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.rps * 1000; // ms
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

const GLOBAL_RATE_LIMITER = new SimpleRateLimiter(config.geminiRpmLimit);

/**
 * Generic factory for Gemini models
 */
export function createGeminiModel({
  modelName,
  temperature,
  timeout,
  maxRetries,
  streaming = false,
  callbacks = [],
  thinkingLevel = null,
}) {
  const options = {
    modelName,
    temperature,
    timeout,
    maxRetries,
    safetySettings: SAFETY_SETTINGS,
    streaming,
    callbacks,
    maxOutputTokens: 32768,
    apiKey: config.getGoogleApiKey(),
  };

  if (thinkingLevel && isGeminiV3OrGreater(modelName)) {
    options.thinkingLevel = thinkingLevel;
    console.log(`Applying thinking_level=${thinkingLevel} to ${modelName}`);
  }

  return new ChatGoogleGenerativeAI(options);
}

/**
 * Create a quick thinking LLM
 */
export function createQuickThinkingLLM({
  temperature = 0.3,
  model = null,
  timeout = null,
  maxRetries = null,
  callbacks = [],
} = {}) {
  const modelName = model || config.quickThinkLlm;
  const finalTimeout = timeout !== null ? timeout : config.apiTimeout;
  const finalRetries = maxRetries !== null ? maxRetries : config.apiRetryAttempts;

  let thinkingLevel = null;
  if (isGeminiV3OrGreater(modelName)) {
    thinkingLevel = 'low';
    console.log(`Quick LLM (${modelName}) is Gemini 3+ - applying thinking_level=low`);
  }

  console.log(`Initializing Quick LLM: ${modelName} (timeout=${finalTimeout}, retries=${finalRetries})`);

  return createGeminiModel({
    modelName,
    temperature,
    timeout: finalTimeout,
    maxRetries: finalRetries,
    callbacks,
    thinkingLevel,
  });
}

/**
 * Create a deep thinking LLM
 */
export function createDeepThinkingLLM({
  temperature = 0.1,
  model = null,
  timeout = null,
  maxRetries = null,
  callbacks = [],
} = {}) {
  const modelName = model || config.deepThinkLlm;
  const finalTimeout = timeout !== null ? timeout : config.apiTimeout;
  const finalRetries = maxRetries !== null ? maxRetries : config.apiRetryAttempts;

  let thinkingLevel = null;
  if (isGeminiV3OrGreater(modelName)) {
    thinkingLevel = 'high';
    console.log(`Deep LLM (${modelName}) is Gemini 3+ - applying thinking_level=high`);
  }

  console.log(`Initializing Deep LLM: ${modelName} (timeout=${finalTimeout}, retries=${finalRetries})`);

  return createGeminiModel({
    modelName,
    temperature,
    timeout: finalTimeout,
    maxRetries: finalRetries,
    callbacks,
    thinkingLevel,
  });
}

/**
 * Create consultant LLM (OpenAI for cross-validation)
 */
export function createConsultantLLM({
  temperature = 0.3,
  model = null,
  timeout = 120000, // ms
  maxRetries = 3,
  quickMode = false,
  callbacks = [],
} = {}) {
  // Check if consultant is enabled
  const enableConsultant = (process.env.ENABLE_CONSULTANT || 'true').toLowerCase();
  if (enableConsultant === 'false') {
    throw new Error('Consultant LLM is disabled. Set ENABLE_CONSULTANT=true to enable.');
  }

  // Get OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY not found in environment. ' +
      'The consultant node requires an OpenAI API key for cross-validation. ' +
      'Add OPENAI_API_KEY to your .env file or set ENABLE_CONSULTANT=false.'
    );
  }

  // Get model name
  let modelName;
  if (model) {
    modelName = model;
  } else if (quickMode) {
    modelName = process.env.CONSULTANT_QUICK_MODEL || 'gpt-4o-mini';
  } else {
    modelName = process.env.CONSULTANT_MODEL || 'gpt-4o';
  }

  console.log(
    `Initializing Consultant LLM (OpenAI): ${modelName} ` +
    `(timeout=${timeout}ms, retries=${maxRetries})`
  );

  return new ChatOpenAI({
    modelName,
    temperature,
    timeout,
    maxRetries,
    openAIApiKey: apiKey,
    callbacks,
    maxTokens: 4096,
    streaming: false,
  });
}

/**
 * Get or create consultant LLM instance (lazy initialization)
 */
let _consultantLlmInstance = null;

export function getConsultantLLM({ callbacks = [], quickMode = false } = {}) {
  // Check if consultant is enabled
  const enableConsultant = (process.env.ENABLE_CONSULTANT || 'true').toLowerCase();
  if (enableConsultant === 'false') {
    console.log('Consultant LLM disabled via ENABLE_CONSULTANT=false');
    return null;
  }

  // Check if API key exists
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      'OPENAI_API_KEY not found - consultant node will be skipped. ' +
      'To enable consultant cross-validation, add OPENAI_API_KEY to .env'
    );
    return null;
  }

  // Lazy initialization
  if (_consultantLlmInstance === null) {
    try {
      _consultantLlmInstance = createConsultantLLM({ callbacks, quickMode });
    } catch (error) {
      console.error(`Failed to initialize consultant LLM: ${error.message}`);
      return null;
    }
  }

  return _consultantLlmInstance;
}

// Initialize default instances
export const quickThinkingLlm = createQuickThinkingLLM();
export const deepThinkingLlm = createDeepThinkingLLM();

export { GLOBAL_RATE_LIMITER };
