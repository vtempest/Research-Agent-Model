/**
 * @fileoverview Mastra Workflow Builder
 *
 * Graph-based deterministic workflows with typed steps, chaining,
 * branching, and parallel execution support.
 */
import { z } from "zod";
export interface WorkflowStepConfig<TInput = any, TOutput = any> {
    id: string;
    inputSchema: z.ZodType<TInput>;
    outputSchema: z.ZodType<TOutput>;
    execute: (params: {
        inputData: TInput;
    }) => Promise<TOutput>;
}
/**
 * Create a typed workflow step.
 *
 * @example
 * ```ts
 * const fetchStep = createWorkflowStep({
 *   id: "fetch-sources",
 *   inputSchema: z.object({ query: z.string() }),
 *   outputSchema: z.object({ sources: z.array(z.string()) }),
 *   execute: async ({ inputData }) => {
 *     const sources = await searchWeb(inputData.query);
 *     return { sources };
 *   },
 * });
 * ```
 */
export declare function createWorkflowStep<TInput, TOutput>(config: WorkflowStepConfig<TInput, TOutput>): import("@mastra/core/workflows").Step<string, unknown, TInput, TOutput, unknown, unknown, import("@mastra/core/workflows").DefaultEngineType, unknown>;
/**
 * Create a research workflow: fetch → analyze → summarize.
 * Pre-built pipeline for common research tasks.
 *
 * @example
 * ```ts
 * const workflow = createResearchWorkflow({
 *   fetchFn: async (topic) => fetchSources(topic),
 *   analyzeFn: async (sources) => analyzeContent(sources),
 *   summarizeFn: async (analysis) => generateSummary(analysis),
 * });
 *
 * const run = await workflow.createRunAsync();
 * const result = await run.start({ inputData: { topic: "quantum computing" } });
 * ```
 */
export declare function createResearchWorkflow(handlers: {
    fetchFn: (topic: string) => Promise<string[]>;
    analyzeFn: (sources: string[]) => Promise<string>;
    summarizeFn: (analysis: string) => Promise<string>;
}): import("@mastra/core/workflows").Workflow<import("@mastra/core/workflows").DefaultEngineType, import("@mastra/core/workflows").Step<string, unknown, unknown, unknown, unknown, unknown, any, unknown>[], "research-workflow", unknown, {
    topic: string;
}, {
    summary: string;
}, {
    summary: string;
}, unknown>;
/**
 * Create a RAG workflow: chunk → embed → retrieve → generate.
 * End-to-end retrieval-augmented generation pipeline.
 *
 * @example
 * ```ts
 * const workflow = createRAGWorkflow({
 *   chunkFn: async (doc) => splitIntoChunks(doc),
 *   embedFn: async (chunks) => embedChunks(chunks),
 *   retrieveFn: async (query) => findRelevant(query),
 *   generateFn: async (context, query) => llmGenerate(context, query),
 * });
 * ```
 */
export declare function createRAGWorkflow(handlers: {
    chunkFn: (document: string) => Promise<string[]>;
    embedFn: (chunks: string[]) => Promise<number[][]>;
    retrieveFn: (query: string) => Promise<string[]>;
    generateFn: (context: string[], query: string) => Promise<string>;
}): import("@mastra/core/workflows").Workflow<import("@mastra/core/workflows").DefaultEngineType, import("@mastra/core/workflows").Step<string, unknown, unknown, unknown, unknown, unknown, any, unknown>[], "rag-workflow", unknown, {
    query: string;
}, {
    answer: string;
}, {
    answer: string;
}, unknown>;
