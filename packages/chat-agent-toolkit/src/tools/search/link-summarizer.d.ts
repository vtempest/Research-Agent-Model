/**
 * @module research/search/link-summarizer
 * @description Groups link documents by URL then summarizes each group with an LLM.
 */
import { type LanguageModel } from "ai";
import type { Document } from "./document";
/**
 * Groups fetched link documents by URL (max 10 chunks per URL), then
 * summarizes each group with the LLM in parallel.
 */
export declare function groupAndSummarizeDocs(llm: LanguageModel, linkDocs: Document[], question: string): Promise<Document[]>;
