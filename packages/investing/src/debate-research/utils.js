/**
 * Utility functions for the Multi-Agent Trading System
 * JavaScript port of various Python utility modules
 */

/**
 * Sleep utility (JavaScript equivalent of asyncio.sleep)
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
export async function retryWithBackoff(
  fn,
  {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBase = 2,
    onRetry = null,
  } = {}
) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(
          baseDelay * Math.pow(exponentialBase, attempt),
          maxDelay
        );

        if (onRetry) {
          onRetry(error, attempt + 1, delay);
        }

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Invoke LLM with rate limit handling (JavaScript port of invoke_with_rate_limit_handling)
 */
export async function invokeWithRateLimitHandling(
  runnable,
  inputData,
  {
    maxAttempts = 3,
    context = 'LLM',
    quietMode = false,
  } = {}
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await runnable.invoke(inputData);
    } catch (error) {
      const errorStr = error.message.toLowerCase();

      // Detect rate limit errors
      const isRateLimit = [
        '429',
        'rate limit',
        'quota',
        'resourceexhausted',
        'resource exhausted',
        'too many requests',
      ].some(keyword => errorStr.includes(keyword));

      if (isRateLimit && attempt < maxAttempts - 1) {
        // Extended exponential backoff: 60s, 120s, 180s
        const waitTime = 60000 * (attempt + 1); // ms

        if (!quietMode) {
          console.warn(
            `Rate limit detected for ${context}, ` +
            `attempt ${attempt + 1}/${maxAttempts}, ` +
            `waiting ${waitTime / 1000}s`
          );
        }

        await sleep(waitTime);
        continue; // Retry
      }

      // Not a rate limit error, or final attempt - re-throw
      throw error;
    }
  }
}

/**
 * Filter messages for Gemini (no consecutive HumanMessages)
 */
export function filterMessagesForGemini(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const filtered = [];

  for (const msg of messages) {
    // Skip SystemMessages (Gemini doesn't support them)
    if (msg._getType() === 'system') {
      continue;
    }

    // Merge consecutive HumanMessages
    if (
      msg._getType() === 'human' &&
      filtered.length > 0 &&
      filtered[filtered.length - 1]._getType() === 'human'
    ) {
      const lastMsg = filtered.pop();
      const newContent = `${lastMsg.content}\n\n${msg.content}`;
      filtered.push(new HumanMessage({ content: newContent }));
    } else {
      filtered.push(msg);
    }
  }

  return filtered;
}

/**
 * Extract context from config (LangGraph compatibility)
 */
export function getContextFromConfig(config) {
  try {
    return config?.configurable?.context;
  } catch (error) {
    return null;
  }
}

/**
 * Generate analysis context based on asset type
 */
export function getAnalysisContext(ticker) {
  const etfIndicators = [
    'VTI', 'SPY', 'QQQ', 'IWM', 'VOO', 'VEA', 'VWO',
    'BND', 'AGG', 'EFA', 'EEM', 'TLT', 'GLD', 'DIA',
  ];

  const tickerUpper = ticker.toUpperCase();

  if (
    etfIndicators.some(ind => tickerUpper.includes(ind)) ||
    tickerUpper.includes('ETF')
  ) {
    return 'This is an ETF (Exchange-Traded Fund). Focus on holdings, expense ratio, and liquidity.';
  }

  return 'This is an individual stock. Focus on fundamentals, valuation, and competitive advantage.';
}

/**
 * Sanitize ticker for use in ChromaDB collection names
 */
export function sanitizeTickerForCollection(ticker) {
  // Remove any non-alphanumeric characters except dots, hyphens, underscores
  let cleanBase = ticker.replace(/[^a-zA-Z0-9._-]/g, '');

  // Replace separators with underscores (Chroma safe)
  let sanitized = cleanBase.replace(/[.-]/g, '_');

  // Ensure it starts with alphanumeric (prepend 'T_' if needed)
  if (!sanitized || !/^[a-zA-Z0-9]/.test(sanitized)) {
    sanitized = `T_${sanitized}`;
  }

  // Ensure length requirements (Chroma max 63 chars)
  // We append suffixes like "_risk_manager_memory" (20 chars)
  // So safe base length is 63 - 20 = 43 chars
  if (sanitized.length > 40) {
    sanitized = sanitized.substring(0, 40);
  }

  if (sanitized.length < 3) {
    sanitized = `${sanitized}_mem`;
  }

  return sanitized;
}

/**
 * Parse currency from ticker suffix
 */
export function getCurrencyFromTicker(ticker) {
  const currencyMap = {
    '.HK': 'HKD',
    '.T': 'JPY',
    '.TW': 'TWD',
    '.KS': 'KRW',
    '.KQ': 'KRW',
    '.SS': 'CNY',
    '.SZ': 'CNY',
    '.NS': 'INR',
    '.BO': 'INR',
    '.BK': 'THB',
    '.KL': 'MYR',
    '.SI': 'SGD',
    '.DE': 'EUR',
    '.PA': 'EUR',
    '.SW': 'CHF',
    '.MC': 'EUR',
    '.SA': 'BRL',
    '.MX': 'MXN',
  };

  const tickerUpper = ticker.toUpperCase();

  for (const [suffix, currency] of Object.entries(currencyMap)) {
    if (tickerUpper.endsWith(suffix)) {
      return currency;
    }
  }

  return 'USD'; // Default
}

/**
 * Format number with commas
 */
export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) {
    return 'N/A';
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency
 */
export function formatCurrency(num, currency = 'USD', decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) {
    return 'N/A';
  }

  return num.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Deep clone object (safe alternative to lodash.cloneDeep)
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * Measure execution time
 */
export async function measureTime(fn, label = 'Function') {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  console.log(`${label} took ${duration}ms`);

  return result;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Wait for all promises with progress tracking
 */
export async function waitForAllWithProgress(promises, onProgress = null) {
  let completed = 0;
  const total = promises.length;

  const wrappedPromises = promises.map(async (promise, index) => {
    const result = await promise;
    completed++;

    if (onProgress) {
      onProgress(completed, total, index);
    }

    return result;
  });

  return Promise.all(wrappedPromises);
}

/**
 * Safe JSON parse
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.warn('JSON parse failed:', error.message);
    return defaultValue;
  }
}

/**
 * Truncate string
 */
export function truncateString(str, maxLength = 100, suffix = '...') {
  if (!str || str.length <= maxLength) {
    return str;
  }

  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Get timestamp for filename (YYYYMMDD_HHMMSS)
 */
export function getFilenameTimestamp() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hour}${minute}${second}`;
}

// Re-export for convenience
import { HumanMessage } from '@langchain/core/messages';
export { HumanMessage };
