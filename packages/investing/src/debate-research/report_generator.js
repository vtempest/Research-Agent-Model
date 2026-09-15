/**
 * Quiet Mode Report Generator for Multi-Agent Trading System
 * JavaScript port of Python report_generator.py
 *
 * Generates clean markdown reports with minimal output
 */

/**
 * QuietModeReporter class - generates markdown reports
 */
export class QuietModeReporter {
  constructor(ticker, companyName = null, quickMode = false) {
    this.ticker = ticker.toUpperCase();
    this.companyName = companyName;
    this.timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    this.quickMode = quickMode;
  }

  /**
   * Safely convert content to string, handling lists from LangGraph
   */
  _normalizeString(content) {
    if (content === null || content === undefined) {
      return '';
    }

    if (Array.isArray(content)) {
      // Deduplication logic
      const seen = new Set();
      const uniqueItems = [];

      for (const item of content) {
        if (!item) continue;

        const itemStr = String(item).trim();
        // Simple hash check for duplicates
        const key = itemStr.substring(0, 100);

        if (!seen.has(key)) {
          seen.add(key);
          uniqueItems.push(itemStr);
        }
      }

      return uniqueItems.join('\n\n');
    }

    return String(content);
  }

  /**
   * Extract BUY/SELL/HOLD decision from final decision text
   */
  extractDecision(finalDecision) {
    finalDecision = this._normalizeString(finalDecision);
    const upperDecision = finalDecision.toUpperCase();

    // 1. "Action:" in FINAL EXECUTION PARAMETERS
    let match = upperDecision.match(/\bACTION\s*:\s*\*?\*?([A-Z]+)\*?\*?/);
    if (match && ['BUY', 'SELL', 'HOLD'].includes(match[1])) {
      return match[1];
    }

    // 2. "FINAL DECISION:"
    match = upperDecision.match(/\bFINAL\s+DECISION\s*:\s*\*?\*?([A-Z]+)\*?\*?/);
    if (match && ['BUY', 'SELL', 'HOLD'].includes(match[1])) {
      return match[1];
    }

    // 3. "Decision:" fallback
    match = upperDecision.match(/\bDECISION\s*:\s*\*?\*?([A-Z]+)\*?\*?/);
    if (match && ['BUY', 'SELL', 'HOLD'].includes(match[1])) {
      return match[1];
    }

    // 4. Generic keyword search
    match = upperDecision.match(/\b(BUY|SELL|HOLD)\b/);
    if (match) {
      return match[1];
    }

    return 'HOLD'; // Default
  }

  /**
   * Extract decision rationale section
   */
  _extractDecisionRationale(finalDecision) {
    finalDecision = this._normalizeString(finalDecision);

    // Try to find rationale section
    const rationalePatterns = [
      /(?:DECISION\s+)?RATIONALE\s*:(.+?)(?:\n\n|\Z)/is,
      /REASONING\s*:(.+?)(?:\n\n|\Z)/is,
      /JUSTIFICATION\s*:(.+?)(?:\n\n|\Z)/is,
    ];

    for (const pattern of rationalePatterns) {
      const match = finalDecision.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: return first 2 paragraphs
    const paragraphs = finalDecision.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 0) {
      return paragraphs.slice(0, 2).join('\n\n');
    }

    return '';
  }

  /**
   * Get final decision text with fallback logic
   */
  _getFinalDecisionText(result) {
    // Try primary field
    let finalDecision = this._normalizeString(result.final_trade_decision || '');
    if (finalDecision.trim()) {
      return finalDecision;
    }

    // Fallback 1: investment_plan
    const investmentPlan = this._normalizeString(result.investment_plan || '');
    if (investmentPlan.trim()) {
      console.warn(`Using investment_plan as fallback for final decision (${this.ticker})`);
      return `⚠️ **Note: Portfolio Manager output missing - using Research Manager synthesis**\n\n${investmentPlan}`;
    }

    // Fallback 2: trader_investment_plan
    const traderPlan = this._normalizeString(result.trader_investment_plan || '');
    if (traderPlan.trim()) {
      console.warn(`Using trader_investment_plan as fallback for final decision (${this.ticker})`);
      return `⚠️ **Note: Portfolio Manager output missing - using Trader proposal**\n\n${traderPlan}`;
    }

    // Complete failure
    console.error(`All decision fields empty for ${this.ticker}`);
    return `## ⚠️ Analysis Error\n\n**Ticker**: ${this.ticker}\n**Issue**: Portfolio Manager failed to produce final decision`;
  }

  /**
   * Generate full markdown report
   */
  generateReport(result, briefMode = false) {
    const finalDecisionText = this._getFinalDecisionText(result);
    const decision = this.extractDecision(finalDecisionText);
    const rationale = this._extractDecisionRationale(finalDecisionText);

    // Build report
    let report = '';

    // Header
    report += `# Investment Analysis Report\n\n`;
    report += `**Ticker**: ${this.ticker}\n`;
    if (this.companyName) {
      report += `**Company**: ${this.companyName}\n`;
    }
    report += `**Date**: ${this.timestamp}\n`;
    report += `**Mode**: ${this.quickMode ? 'Quick' : 'Deep'} Analysis\n\n`;

    // Decision
    report += `## Decision: ${decision}\n\n`;

    // Rationale
    if (rationale) {
      report += `### Rationale\n\n${rationale}\n\n`;
    }

    // Full details (unless brief mode)
    if (!briefMode) {
      report += `---\n\n`;
      report += `## Full Analysis\n\n`;
      report += finalDecisionText;
    }

    return report;
  }
}
