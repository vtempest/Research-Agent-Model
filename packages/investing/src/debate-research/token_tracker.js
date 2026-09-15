/**
 * Token usage tracking and cost estimation module
 * JavaScript port of Python token_tracker.py
 *
 * Provides comprehensive logging of LLM token consumption across all agents
 */

/**
 * Token usage data for a single LLM call
 */
export class TokenUsage {
  constructor({
    timestamp,
    agentName,
    modelName,
    promptTokens,
    completionTokens,
    totalTokens,
  }) {
    this.timestamp = timestamp;
    this.agentName = agentName;
    this.modelName = modelName;
    this.promptTokens = promptTokens;
    this.completionTokens = completionTokens;
    this.totalTokens = totalTokens;
  }

  /**
   * Estimate cost in USD assuming paid tier
   * IMPORTANT: If your GCP project has billing enabled, ALL API calls cost money
   */
  get estimatedCostUsd() {
    // LLM pricing (per 1M tokens) - Dec 2025
    // Order matters! More specific models must come before general ones
    const pricing = {
      // OpenAI GPT-4 models
      'gpt-4o-mini': {
        prompt: 0.15,
        completion: 0.60,
      },
      'gpt-4o': {
        prompt: 2.50,
        completion: 10.00,
      },
      'gpt-4-turbo': {
        prompt: 10.00,
        completion: 30.00,
      },
      'gpt-4': {
        prompt: 30.00,
        completion: 60.00,
      },
      // Gemini 2.0 Flash variants
      'gemini-2.0-flash-thinking-exp': {
        prompt: 0.30,
        completion: 2.50,
      },
      'gemini-2.0-flash-exp': {
        prompt: 0.30,
        completion: 2.50,
      },
      // Gemini 2.5 Flash variants
      'gemini-2.5-flash-lite': {
        prompt: 0.10,
        completion: 0.40,
      },
      'gemini-2.5-flash': {
        prompt: 0.30,
        completion: 2.50,
      },
      // Gemini 3 Pro variants
      'gemini-3-pro-preview': {
        prompt: 2.00,
        completion: 12.00,
      },
      'gemini-3-pro': {
        prompt: 2.00,
        completion: 12.00,
      },
    };

    // Default pricing for unknown models
    const defaultPricing = { prompt: 0.30, completion: 2.50 };

    // Find pricing for this model (match by prefix)
    let modelPricing = defaultPricing;
    for (const [modelKey, prices] of Object.entries(pricing)) {
      if (this.modelName.startsWith(modelKey)) {
        modelPricing = prices;
        break;
      }
    }

    const promptCost = (this.promptTokens / 1000000) * modelPricing.prompt;
    const completionCost = (this.completionTokens / 1000000) * modelPricing.completion;

    return promptCost + completionCost;
  }
}

/**
 * Aggregate token statistics for a single agent
 */
export class AgentTokenStats {
  constructor(agentName) {
    this.agentName = agentName;
    this.totalCalls = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalTokens = 0;
    this.totalCostUsd = 0.0;
    this.calls = [];
  }

  /**
   * Add a token usage record to this agent's stats
   */
  addUsage(usage) {
    this.calls.push(usage);
    this.totalCalls += 1;
    this.totalPromptTokens += usage.promptTokens;
    this.totalCompletionTokens += usage.completionTokens;
    this.totalTokens += usage.totalTokens;
    this.totalCostUsd += usage.estimatedCostUsd;
  }
}

/**
 * Global token tracker singleton
 * Thread-safe tracking of LLM token consumption
 */
export class TokenTracker {
  static _instance = null;
  static _quietMode = false;

  constructor() {
    if (TokenTracker._instance) {
      return TokenTracker._instance;
    }

    this.agentStats = new Map();
    this.allUsages = [];
    this.sessionStart = new Date().toISOString();

    // Only log if quiet mode is not enabled
    if (!TokenTracker._quietMode && !this._quietMode) {
      console.log(`Token tracker initialized: ${this.sessionStart}`);
    }

    TokenTracker._instance = this;
  }

  /**
   * Enable or disable quiet mode to suppress logging
   */
  static setQuietMode(quiet = true) {
    TokenTracker._quietMode = quiet;
  }

  /**
   * Record token usage for a specific agent
   */
  recordUsage(agentName, modelName, promptTokens, completionTokens) {
    const usage = new TokenUsage({
      timestamp: new Date().toISOString(),
      agentName,
      modelName,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });

    // Add to agent-specific stats
    if (!this.agentStats.has(agentName)) {
      this.agentStats.set(agentName, new AgentTokenStats(agentName));
    }

    this.agentStats.get(agentName).addUsage(usage);
    this.allUsages.push(usage);

    if (!this._quietMode && !TokenTracker._quietMode) {
      console.log(
        `Token usage: ${agentName} | ${modelName} | ` +
        `prompt: ${promptTokens}, completion: ${completionTokens}, ` +
        `total: ${usage.totalTokens}, cost: $${usage.estimatedCostUsd.toFixed(6)}`
      );
    }
  }

  /**
   * Get statistics for a specific agent
   */
  getAgentStats(agentName) {
    return this.agentStats.get(agentName) || null;
  }

  /**
   * Get aggregate statistics across all agents
   */
  getTotalStats() {
    const totalPrompt = Array.from(this.agentStats.values())
      .reduce((sum, stats) => sum + stats.totalPromptTokens, 0);

    const totalCompletion = Array.from(this.agentStats.values())
      .reduce((sum, stats) => sum + stats.totalCompletionTokens, 0);

    const totalCost = Array.from(this.agentStats.values())
      .reduce((sum, stats) => sum + stats.totalCostUsd, 0);

    const agents = {};
    for (const [name, stats] of this.agentStats) {
      agents[name] = {
        calls: stats.totalCalls,
        prompt_tokens: stats.totalPromptTokens,
        completion_tokens: stats.totalCompletionTokens,
        total_tokens: stats.totalTokens,
        cost_usd: stats.totalCostUsd,
      };
    }

    return {
      total_calls: this.allUsages.length,
      total_agents: this.agentStats.size,
      total_prompt_tokens: totalPrompt,
      total_completion_tokens: totalCompletion,
      total_tokens: totalPrompt + totalCompletion,
      total_cost_usd: totalCost,
      session_start: this.sessionStart,
      agents,
    };
  }

  /**
   * Reset all tracking data (useful for new analysis runs)
   */
  reset() {
    this.agentStats.clear();
    this.allUsages = [];
    this.sessionStart = new Date().toISOString();

    if (!this._quietMode && !TokenTracker._quietMode) {
      console.log(`Token tracker reset: ${this.sessionStart}`);
    }
  }

  /**
   * Print a formatted summary of token usage
   */
  printSummary() {
    if (this._quietMode || TokenTracker._quietMode) {
      return;
    }

    const stats = this.getTotalStats();

    console.log('='.repeat(80));
    console.log('TOKEN USAGE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Session Start: ${stats.session_start}`);
    console.log(`Total LLM Calls: ${stats.total_calls}`);
    console.log(`Total Agents: ${stats.total_agents}`);
    console.log(`Total Prompt Tokens: ${stats.total_prompt_tokens.toLocaleString()}`);
    console.log(`Total Completion Tokens: ${stats.total_completion_tokens.toLocaleString()}`);
    console.log(`Total Tokens: ${stats.total_tokens.toLocaleString()}`);
    console.log(`Projected Cost (Paid Tier): $${stats.total_cost_usd.toFixed(4)} USD`);
    console.log('  (Note: Actual cost = $0 if using free tier without billing enabled)');
    console.log('\nPer-Agent Breakdown:');
    console.log('-'.repeat(80));

    // Sort agents by cost (descending)
    const sortedAgents = Object.entries(stats.agents)
      .sort((a, b) => b[1].cost_usd - a[1].cost_usd);

    for (const [agentName, agentStats] of sortedAgents) {
      console.log(`\n${agentName}:`);
      console.log(`  Calls: ${agentStats.calls}`);
      console.log(`  Prompt Tokens: ${agentStats.prompt_tokens.toLocaleString()}`);
      console.log(`  Completion Tokens: ${agentStats.completion_tokens.toLocaleString()}`);
      console.log(`  Total Tokens: ${agentStats.total_tokens.toLocaleString()}`);
      console.log(`  Cost: $${agentStats.cost_usd.toFixed(4)}`);
    }

    console.log('='.repeat(80));
  }
}

/**
 * LangChain callback handler that tracks token usage per agent
 */
export class TokenTrackingCallback {
  constructor(agentName, tracker = null) {
    this.agentName = agentName;
    this.tracker = tracker || getTracker();
  }

  /**
   * Called when LLM completes a generation
   */
  handleLLMEnd(output, runId, parentRunId) {
    try {
      // Extract token usage from output
      let usageMetadata = {};
      let modelName = 'unknown';

      // Try to get usage from generations (Gemini structure)
      if (output.generations && output.generations.length > 0) {
        const firstGenerationList = output.generations[0];
        if (firstGenerationList && firstGenerationList.length > 0) {
          const firstGeneration = firstGenerationList[0];

          // Check for usage_metadata in message
          if (firstGeneration.message?.usageMetadata) {
            usageMetadata = firstGeneration.message.usageMetadata;
          }

          // Get model name
          if (firstGeneration.generationInfo?.model_name) {
            modelName = firstGeneration.generationInfo.model_name;
          } else if (firstGeneration.message?.responseMetadata?.model_name) {
            modelName = firstGeneration.message.responseMetadata.model_name;
          }
        }
      }

      // Fallback to llmOutput (for other LLM providers)
      if (Object.keys(usageMetadata).length === 0 && output.llmOutput) {
        usageMetadata = output.llmOutput.usage_metadata || output.llmOutput.token_usage || {};
        if (modelName === 'unknown') {
          modelName = output.llmOutput.model_name || 'unknown';
        }
      }

      if (Object.keys(usageMetadata).length > 0) {
        const promptTokens = usageMetadata.input_tokens || usageMetadata.prompt_tokens || 0;
        const completionTokens = usageMetadata.output_tokens || usageMetadata.completion_tokens || 0;

        if (promptTokens > 0 || completionTokens > 0) {
          this.tracker.recordUsage(
            this.agentName,
            modelName,
            promptTokens,
            completionTokens
          );
        }
      }
    } catch (error) {
      console.warn(`Token tracking callback error: ${error.message}`);
    }
  }
}

// Global singleton instance (lazy initialization)
let _globalTracker = null;

/**
 * Get the global TokenTracker singleton
 */
export function getTracker() {
  if (_globalTracker === null) {
    _globalTracker = new TokenTracker();
  }
  return _globalTracker;
}
