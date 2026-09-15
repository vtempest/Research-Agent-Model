/**
 * Prompt construction and command resolution for the Ai extension.
 *
 * Everything here is pure so it can be unit-tested without an editor: the
 * system message that keeps completions paste-ready, how a command plus an
 * optional submenu choice becomes one instruction, and which commands are
 * offered for the current selection.
 */

import { AI_COMMAND_GROUP_ORDER } from '../commands';

import type { AiCommandDefinition, AiCommandGroup, AiSuggestionMode } from '../types';

/**
 * System message sent with every request. It exists because a chat-tuned model
 * left to itself answers *about* the edit ("Sure! Here's a tighter version:")
 * — and in an editor that preamble is what lands in the document.
 */
export const AI_SYSTEM_PROMPT = [
  'You are a writing assistant inside a rich-text editor.',
  'Return only the text that should appear in the document — nothing else.',
  'Never add a preamble, sign-off, explanation, or commentary about what you changed.',
  'Never wrap the answer in Markdown code fences or quotation marks unless the original text was itself fenced or quoted.',
  'Preserve the original language of the text unless asked to translate.',
  'Preserve quotations, citations, URLs, code, numbers and proper nouns exactly, unless the instruction is explicitly about changing them.',
  'Never invent facts, statistics, sources, citations or links.',
  'Match the surrounding formatting: plain paragraphs separated by blank lines, and one item per line for lists.',
].join('\n');

/** Whether a command needs a non-empty selection (the default for everything that rewrites text). */
export function commandRequiresSelection(command: AiCommandDefinition): boolean {
  return command.requiresSelection !== false;
}

/**
 * Commands offered for the current selection state: with the caret collapsed,
 * the rewrite commands are hidden rather than left to misfire on no input.
 */
export function commandsForSelection(
  commands: AiCommandDefinition[],
  hasSelection: boolean
): AiCommandDefinition[] {
  return hasSelection ? commands : commands.filter((c) => !commandRequiresSelection(c));
}

/** Groups commands for rendering, in `AI_COMMAND_GROUP_ORDER`, dropping empty groups. */
export function groupCommands(
  commands: AiCommandDefinition[]
): { group: AiCommandGroup; commands: AiCommandDefinition[] }[] {
  return AI_COMMAND_GROUP_ORDER.map((group) => ({
    group: group as AiCommandGroup,
    commands: commands.filter((command) => (command.group ?? 'edit') === group),
  })).filter((section) => section.commands.length > 0);
}

/** Joins a command's prompt with the submenu choice it was run with, if any. */
export function buildAiInstruction(command: AiCommandDefinition, option?: string): string {
  const prompt = command.prompt.trim();
  if (!option) return prompt;
  return prompt.endsWith(':') ? `${prompt} ${option}.` : `${prompt} (${option})`;
}

/**
 * Trims a context window to `max` characters, cutting from the start so the
 * text nearest the selection — the part that actually informs the completion —
 * is what survives.
 */
export function clampContext(text: string, max: number): string {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  return `…${text.slice(text.length - max)}`;
}

/**
 * Renders the request as a single user message, for completion functions that
 * only take one string (a plain `/api/ai` route, an OpenAI-compatible
 * endpoint). Sent alongside {@link AI_SYSTEM_PROMPT}.
 */
export function buildAiUserPrompt(request: {
  instruction: string;
  selectedText: string;
  documentText: string;
  mode: AiSuggestionMode;
}): string {
  const sections = [`Instruction:\n${request.instruction}`];

  if (request.documentText.trim()) {
    sections.push(`Surrounding document (context only, do not rewrite):\n${request.documentText}`);
  }

  sections.push(
    request.mode === 'replace'
      ? `Text to act on:\n${request.selectedText}`
      : 'No text is selected. Write new content for the caret position, using the context above.'
  );

  return sections.join('\n\n');
}
