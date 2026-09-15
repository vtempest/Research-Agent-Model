/**
 * @module research/chains/suggestionGeneratorAgent
 * @description Generates follow-up question suggestions from a conversation
 * using the Vercel AI SDK.
 */
import { generateText, type LanguageModel } from "ai";
import { LineListOutputParser } from "../../utils/outputParser";
import { formatChatHistoryAsString } from "../../utils";
import { followUpSuggestionsPrompt } from "../../prompts/search-prompts";
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

const outputParser = new LineListOutputParser({
  key: "suggestions",
});

const generateSuggestions = async (
  input: SuggestionGeneratorInput,
  llm: LanguageModel,
): Promise<string[]> => {
  const maxQuestions = input.maxQuestions ?? 4;
  const template = input.promptTemplate?.trim()
    ? input.promptTemplate
    : followUpSuggestionsPrompt;

  const prompt = template
    .split("{maxQuestions}")
    .join(String(maxQuestions))
    .split("{chat_history}")
    .join(formatChatHistoryAsString(input.chat_history));

  const { text } = await generateText({
    model: llm,
    temperature: 0,
    prompt,
  });

  return outputParser.parse(text);
};

export default generateSuggestions;
