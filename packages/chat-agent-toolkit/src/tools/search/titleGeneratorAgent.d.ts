/**
 * @module research/chains/titleGeneratorAgent
 * @description Generates a short, human-friendly title summarising a chat
 * conversation using the Vercel AI SDK. Used to give conversations with
 * multiple turns a meaningful title instead of the truncated first message.
 */
import { type LanguageModel } from "ai";
import type { ChatTurnMessage } from "./meta-search-types";
type TitleGeneratorInput = {
    chat_history: ChatTurnMessage[];
};
declare const generateTitle: (input: TitleGeneratorInput, llm: LanguageModel) => Promise<string>;
export default generateTitle;
