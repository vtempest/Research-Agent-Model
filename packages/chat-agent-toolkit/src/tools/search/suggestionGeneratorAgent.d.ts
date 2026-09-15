/**
 * @module research/chains/suggestionGeneratorAgent
 * @description Generates follow-up question suggestions from a conversation
 * using the Vercel AI SDK.
 */
import { type LanguageModel } from "ai";
import type { ChatTurnMessage } from "./meta-search-types";
type SuggestionGeneratorInput = {
    chat_history: ChatTurnMessage[];
    maxQuestions?: number;
    /**
     * Optional user-authored replacement for {@link followUpSuggestionsPrompt}
     * (edited in Settings → Search Settings). Blank or whitespace-only values
     * fall back to the built-in template.
     */
    promptTemplate?: string;
};
declare const generateSuggestions: (input: SuggestionGeneratorInput, llm: LanguageModel) => Promise<string[]>;
export default generateSuggestions;
