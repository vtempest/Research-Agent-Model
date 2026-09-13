/**
 * @fileoverview Mastra Agent Factory
 *
 * Creates typed Mastra agents with tool-calling, model selection,
 * and optional memory integration.
 */
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
export interface MastraAgentConfig {
    id: string;
    name: string;
    instructions: string;
    model: any;
    tools?: Record<string, any>;
    maxSteps?: number;
    memory?: {
        enabled: boolean;
        threadId?: string;
        userId?: string;
    };
}
/**
 * Create a Mastra agent with full configuration.
 * Supports tool-calling, multi-step reasoning, and memory.
 *
 * @example
 * ```ts
 * import { createMastraAgent } from "chat-agent-toolkit/mastra";
 * import { openai } from "@ai-sdk/openai";
 *
 * const agent = createMastraAgent({
 *   id: "research-assistant",
 *   name: "Research Assistant",
 *   instructions: "Help users research topics thoroughly.",
 *   model: openai("gpt-4o"),
 *   tools: { webSearch, extractPage },
 * });
 *
 * const result = await agent.generate("What is RAG?");
 * ```
 */
export declare function createMastraAgent(config: MastraAgentConfig): Agent;
/**
 * Create a Mastra agent with inline tool definitions using Zod schemas.
 * Convenience wrapper for quick prototyping.
 *
 * @example
 * ```ts
 * const agent = createToolAgent({
 *   id: "calculator",
 *   name: "Calculator",
 *   instructions: "Perform math operations.",
 *   model: openai("gpt-4o"),
 *   toolDefs: [{
 *     id: "add",
 *     description: "Add two numbers",
 *     inputSchema: z.object({ a: z.number(), b: z.number() }),
 *     outputSchema: z.object({ result: z.number() }),
 *     execute: async ({ context }) => ({ result: context.a + context.b }),
 *   }],
 * });
 * ```
 */
export declare function createToolAgent(config: {
    id: string;
    name: string;
    instructions: string;
    model: any;
    toolDefs: Array<{
        id: string;
        description: string;
        inputSchema: z.ZodType;
        outputSchema: z.ZodType;
        execute: (params: {
            context: any;
        }) => Promise<any>;
    }>;
}): Agent;
