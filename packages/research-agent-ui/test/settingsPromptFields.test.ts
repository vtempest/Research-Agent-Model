/**
 * @fileoverview Tests for the editable prompt fields in the search settings schema.
 *
 * The prompt text itself lives in `chat-agent-toolkit`, and `search.json` ships
 * these fields with an empty default. `settings/index.ts` splices the live
 * template in so the settings textarea shows the prompt the agent actually
 * runs. These tests pin that wiring — a renamed export or a stale copy of the
 * prompt in JSON would otherwise silently leave the editor blank.
 */
import { describe, it, expect } from 'vitest';
import {
  followUpSuggestionsPrompt,
  webSearchRetrieverPrompt,
} from 'chat-agent-toolkit/prompts/search-prompts';
import { searchSettingsFields } from '../src/settings';

const fieldFor = (key: string) =>
  searchSettingsFields.find((field) => field.key === key);

describe('search settings prompt fields', () => {
  it('exposes the follow-up prompt as an editable textarea seeded with the live template', () => {
    const field = fieldFor('followUpQuestionsPrompt');

    expect(field).toBeDefined();
    expect(field!.type).toBe('textarea');
    expect(field!.scope).toBe('client');
    expect(field!.default).toBe(followUpSuggestionsPrompt);
  });

  it('exposes the query-expansion prompt seeded with the live retriever prompt', () => {
    const field = fieldFor('queryExpansionPrompt');

    expect(field).toBeDefined();
    expect(field!.type).toBe('textarea');
    expect(field!.scope).toBe('client');
    expect(field!.default).toBe(webSearchRetrieverPrompt);
  });

  it('keeps the follow-up template interpolatable from the settings copy', () => {
    // The description tells users about these two placeholders, so the shipped
    // default has to actually contain them.
    const template = String(fieldFor('followUpQuestionsPrompt')!.default);
    expect(template).toContain('{maxQuestions}');
    expect(template).toContain('{chat_history}');
  });

  it('leaves non-prompt fields untouched', () => {
    expect(fieldFor('maxFollowupQuestions')!.default).toBe('4');
  });
});
