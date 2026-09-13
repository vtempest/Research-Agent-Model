/**
 * @fileoverview Mastra Model Routing
 *
 * Multi-provider model routing with strategy selection:
 * cost-optimized, latency-optimized, capability-based, or round-robin.
 */
import { Agent } from "@mastra/core/agent";
export type RoutingStrategy = "cost" | "latency" | "capability" | "round-robin";
export interface ModelRouterConfig {
    providers: Array<{
        id: string;
        model: any;
        costPer1kTokens?: number;
        avgLatencyMs?: number;
        capabilities?: string[];
        priority?: number;
    }>;
    strategy: RoutingStrategy;
    fallbackProviderId?: string;
}
/**
 * Model router that selects providers based on configurable strategies.
 *
 * @example
 * ```ts
 * import { createModelRouter } from "chat-agent-toolkit/mastra";
 * import { openai } from "@ai-sdk/openai";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const router = createModelRouter({
 *   providers: [
 *     { id: "openai", model: openai("gpt-4o"), costPer1kTokens: 0.005 },
 *     { id: "anthropic", model: anthropic("claude-sonnet-4-20250514"), costPer1kTokens: 0.003 },
 *     { id: "fast", model: openai("gpt-4o-mini"), costPer1kTokens: 0.0002, avgLatencyMs: 200 },
 *   ],
 *   strategy: "cost",
 * });
 *
 * const model = router.select(); // cheapest provider
 * const model2 = router.select({ capabilities: ["vision"] }); // capability match
 * ```
 */
export declare function createModelRouter(config: ModelRouterConfig): {
    select(options?: {
        capabilities?: string[];
        maxCost?: number;
        maxLatency?: number;
    }): any;
    createAgent(agentConfig: {
        id: string;
        name: string;
        instructions: string;
        tools?: Record<string, any>;
    }, routingOptions?: {
        capabilities?: string[];
        maxCost?: number;
        maxLatency?: number;
    }): Agent;
};
/**
 * Load a Mastra-compatible model from a provider string.
 * Convenience wrapper around Vercel AI SDK provider imports.
 *
 * @example
 * ```ts
 * const model = await loadMastraModel("openai", "gpt-4o");
 * const model2 = await loadMastraModel("anthropic", "claude-sonnet-4-20250514");
 * const model3 = await loadMastraModel("groq", "llama-3.3-70b-versatile");
 * ```
 */
export declare function loadMastraModel(provider: "openai" | "anthropic" | "groq" | "google", modelId: string): Promise<any>;
