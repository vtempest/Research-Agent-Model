/**
 * @fileoverview Mastra Evals
 *
 * Scorer-based evaluation functions for LLM outputs.
 * Assess factuality, relevance, coherence, and safety.
 */
export interface EvalResult {
    score: number;
    reason: string;
}
export interface EvalSuiteResult {
    overall: number;
    results: Record<string, EvalResult>;
}
/**
 * Evaluate factuality/groundedness of a response.
 * Checks whether the output references sources or evidence.
 *
 * @example
 * ```ts
 * const result = await factualityEval(
 *   "The earth orbits the sun (source: NASA).",
 *   "What does the earth orbit?"
 * );
 * // { score: 0.9, reason: "Response includes source attribution." }
 * ```
 */
export declare function factualityEval(output: string, _query?: string, sources?: string[]): Promise<EvalResult>;
/**
 * Evaluate relevance of a response to the query.
 * Uses keyword overlap and length heuristics.
 */
export declare function relevanceEval(output: string, query: string): Promise<EvalResult>;
/**
 * Evaluate coherence and structure of a response.
 * Checks sentence structure, paragraph flow, and logical markers.
 */
export declare function coherenceEval(output: string): Promise<EvalResult>;
/**
 * Evaluate output for toxic or harmful content.
 * Basic keyword/pattern-based detection.
 */
export declare function toxicityEval(output: string): Promise<EvalResult>;
/**
 * Run a full evaluation suite against a response.
 *
 * @example
 * ```ts
 * const results = await runEvalSuite({
 *   output: agentResponse,
 *   query: "What is photosynthesis?",
 *   sources: ["Biology textbook chapter 3"],
 * });
 *
 * console.log(results.overall); // 0.78
 * console.log(results.results.factuality.score); // 0.85
 * ```
 */
export declare function runEvalSuite(params: {
    output: string;
    query?: string;
    sources?: string[];
}): Promise<EvalSuiteResult>;
