/**
 * Ticker Symbol Corrections Database
 * JavaScript port of Python ticker_corrections.py
 *
 * Maintains a database of known ticker symbol corrections for different data providers
 */

// Known corrections: Reuters/Bloomberg codes to actual trading symbols
const REUTERS_CORRECTIONS = {
  // Swiss Securities (SIX Swiss Exchange)
  'NOV.N-CH': ['NOVN', 'SW', 'Novartis AG'],
  'NOV.S-CH': ['NOVN', 'SW', 'Novartis AG'],
  'ROG.N-CH': ['ROG', 'SW', 'Roche Holding AG'],
  'ROG.S-CH': ['ROG', 'SW', 'Roche Holding AG'],
  'NESN.S-CH': ['NESN', 'SW', 'Nestlé S.A.'],
  'NESN.N-CH': ['NESN', 'SW', 'Nestlé S.A.'],
  'UBSG.S-CH': ['UBSG', 'SW', 'UBS Group AG'],
  'CSGN.S-CH': ['CSGN', 'SW', 'Credit Suisse Group AG'],
  'ZURN.S-CH': ['ZURN', 'SW', 'Zurich Insurance Group AG'],
  'ABB.N-CH': ['ABBN', 'SW', 'ABB Ltd'],
  'LONN.S-CH': ['LONN', 'SW', 'Lonza Group AG'],

  // German Securities
  'SAPG.DE': ['SAP', 'DE', 'SAP SE'],
  'SIE.DE': ['SIE', 'DE', 'Siemens AG'],
  'DAI.DE': ['DAI', 'DE', 'Daimler AG'],
  'VOW3.DE': ['VOW3', 'DE', 'Volkswagen AG'],
  'BAYN.DE': ['BAYN', 'DE', 'Bayer AG'],

  // UK Securities
  'BP.L': ['BP.', 'L', 'BP plc'],
  'HSBA.L': ['HSBA', 'L', 'HSBC Holdings plc'],
  'ULVR.L': ['ULVR', 'L', 'Unilever PLC'],
  'AZN.L': ['AZN', 'L', 'AstraZeneca PLC'],
  'GSK.L': ['GSK', 'L', 'GlaxoSmithKline plc'],

  // Japanese Securities
  '7203.T': ['7203', 'T', 'Toyota Motor Corporation'],
  '6758.T': ['6758', 'T', 'Sony Group Corporation'],
  '9984.T': ['9984', 'T', 'SoftBank Group Corp.'],
};

// Alternative ticker formats
const ALTERNATIVE_FORMATS = {
  'NOVN:SWX': 'NOVN.SW',
  'NOVN:VX': 'NOVN.SW',
  'NOVN.VX': 'NOVN.SW',
  'ROG:SWX': 'ROG.SW',
  'NESN:SWX': 'NESN.SW',
};

// Known valid tickers
const KNOWN_VALID_TICKERS = {
  // Swiss Securities
  'NOVN.SW': { name: 'Novartis AG', exchange: 'SIX Swiss Exchange', country: 'Switzerland' },
  'ROG.SW': { name: 'Roche Holding AG', exchange: 'SIX Swiss Exchange', country: 'Switzerland' },
  'NESN.SW': { name: 'Nestlé S.A.', exchange: 'SIX Swiss Exchange', country: 'Switzerland' },

  // US Securities
  'AAPL': { name: 'Apple Inc.', exchange: 'NASDAQ', country: 'United States' },
  'MSFT': { name: 'Microsoft Corporation', exchange: 'NASDAQ', country: 'United States' },
  'GOOGL': { name: 'Alphabet Inc.', exchange: 'NASDAQ', country: 'United States' },
  'AMZN': { name: 'Amazon.com Inc.', exchange: 'NASDAQ', country: 'United States' },
  'TSLA': { name: 'Tesla Inc.', exchange: 'NASDAQ', country: 'United States' },
  'META': { name: 'Meta Platforms Inc.', exchange: 'NASDAQ', country: 'United States' },
  'NVDA': { name: 'NVIDIA Corporation', exchange: 'NASDAQ', country: 'United States' },

  // German Securities
  'SAP.DE': { name: 'SAP SE', exchange: 'XETRA', country: 'Germany' },
  'SIE.DE': { name: 'Siemens AG', exchange: 'XETRA', country: 'Germany' },

  // UK Securities
  'BP.L': { name: 'BP plc', exchange: 'London Stock Exchange', country: 'United Kingdom' },
  'HSBA.L': { name: 'HSBC Holdings plc', exchange: 'London Stock Exchange', country: 'United Kingdom' },

  // Japanese Securities
  '7203.T': { name: 'Toyota Motor Corporation', exchange: 'Tokyo Stock Exchange', country: 'Japan' },
  '6758.T': { name: 'Sony Group Corporation', exchange: 'Tokyo Stock Exchange', country: 'Japan' },
};

/**
 * TickerCorrector class - handles ticker symbol corrections and validations
 */
export class TickerCorrector {
  /**
   * Apply known corrections to a ticker symbol
   * @returns {[string, boolean, string|null]} [correctedTicker, wasCorrected, companyName]
   */
  static applyCorrection(ticker) {
    ticker = ticker.trim().toUpperCase();

    // Check Reuters corrections
    if (ticker in REUTERS_CORRECTIONS) {
      const [symbol, suffix, name] = REUTERS_CORRECTIONS[ticker];
      const corrected = `${symbol}.${suffix}`;

      console.log(
        `Ticker corrected: ${ticker} -> ${corrected} (${name}) [reuters_database]`
      );

      return [corrected, true, name];
    }

    // Check alternative formats
    if (ticker in ALTERNATIVE_FORMATS) {
      const corrected = ALTERNATIVE_FORMATS[ticker];

      console.log(
        `Ticker format normalized: ${ticker} -> ${corrected} [alternative_formats]`
      );

      return [corrected, true, null];
    }

    // No correction needed
    return [ticker, false, null];
  }

  /**
   * Check if ticker is in the known valid list
   * @returns {[boolean, object|null]} [isValid, metadata]
   */
  static isKnownValid(ticker) {
    ticker = ticker.trim().toUpperCase();

    if (ticker in KNOWN_VALID_TICKERS) {
      return [true, KNOWN_VALID_TICKERS[ticker]];
    }

    return [false, null];
  }

  /**
   * Get company information if available
   */
  static getCompanyInfo(ticker) {
    ticker = ticker.trim().toUpperCase();

    // Try known valid tickers first
    if (ticker in KNOWN_VALID_TICKERS) {
      return KNOWN_VALID_TICKERS[ticker];
    }

    // Try Reuters corrections
    if (ticker in REUTERS_CORRECTIONS) {
      const [symbol, suffix, name] = REUTERS_CORRECTIONS[ticker];
      const correctedTicker = `${symbol}.${suffix}`;

      if (correctedTicker in KNOWN_VALID_TICKERS) {
        return {
          ...KNOWN_VALID_TICKERS[correctedTicker],
          original_ticker: ticker,
        };
      }

      return { name, original_ticker: ticker };
    }

    return null;
  }

  /**
   * Full correction pipeline: apply corrections and validate
   * @returns {object} Correction result with metadata
   */
  static correctAndValidate(ticker) {
    const [correctedTicker, wasCorrected, companyName] = this.applyCorrection(ticker);
    const [isValid, metadata] = this.isKnownValid(correctedTicker);

    return {
      original: ticker,
      corrected: correctedTicker,
      was_corrected: wasCorrected,
      is_known_valid: isValid,
      company_name: companyName || metadata?.name || null,
      metadata: metadata,
    };
  }
}

// Export constants for external use
export { REUTERS_CORRECTIONS, ALTERNATIVE_FORMATS, KNOWN_VALID_TICKERS };
