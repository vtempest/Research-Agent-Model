/**
 * Default quick-commands shown in the Ai extension's "Ask AI anything…"
 * menu and in the toolbar's AI dropdown. Overridable via
 * `Ai.configure({ commands })`.
 *
 * Prompt wording matters more than it looks: every prompt names the unit it
 * operates on ("the text"), states what must be preserved, and — for anything
 * that reshapes the content — says what the output should be, so the model
 * returns a drop-in replacement rather than a commentary on one. The shared
 * "return only the replacement" framing lives in `lib/prompt.ts` and is sent
 * as the system message, so it is not repeated in each prompt here.
 */

import {
  ArrowRightLeft,
  Baby,
  Briefcase,
  CheckCheck,
  Coffee,
  Feather,
  FileText,
  Languages,
  ListChecks,
  ListTree,
  Minus,
  PenLine,
  Plus,
  Quote,
  SmilePlus,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

import type { AiCommandDefinition, AiCommandOption } from './types';

/** Target languages offered by the Translate command. */
export const DEFAULT_AI_LANGUAGES: AiCommandOption[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'zh', label: 'Chinese (Simplified)' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ar', label: 'Arabic' },
  { id: 'ru', label: 'Russian' },
];

export const DEFAULT_AI_COMMANDS: AiCommandDefinition[] = [
  // ── Edit: same content, better prose ──
  {
    id: 'improve',
    label: 'Improve writing',
    description: 'Clearer, tighter, same meaning',
    icon: Sparkles,
    group: 'edit',
    prompt:
      'Improve the clarity, flow and word choice of the text. Keep the author\'s meaning, voice, facts and level of formality exactly as they are, and keep roughly the same length.',
  },
  {
    id: 'fix',
    label: 'Fix spelling & grammar',
    description: 'Correct mistakes only',
    icon: CheckCheck,
    group: 'edit',
    prompt:
      'Correct spelling, grammar, punctuation and obvious typos in the text. Change nothing else: keep the original wording, sentence structure, tone and formatting. If the text is already correct, return it unchanged.',
  },
  {
    id: 'shorter',
    label: 'Make shorter',
    description: 'Trim to the essentials',
    icon: Minus,
    group: 'edit',
    prompt:
      'Rewrite the text roughly half as long. Cut redundancy, filler and hedging, but keep every claim, figure, name and qualifier that carries meaning.',
  },
  {
    id: 'longer',
    label: 'Make longer',
    description: 'Expand with more detail',
    icon: Plus,
    group: 'edit',
    prompt:
      'Expand the text with useful detail, explanation and structure, staying on the same topic and in the same voice. Do not invent facts, statistics, quotations or sources — expand only on what the text already implies.',
  },
  {
    id: 'simplify',
    label: 'Simplify language',
    description: 'Plainer words, shorter sentences',
    icon: Feather,
    group: 'edit',
    prompt:
      'Rewrite the text in plain, direct language: common words, shorter sentences, active voice. Keep all of the original meaning, including any technical terms that have no plain equivalent.',
  },
  {
    id: 'rephrase',
    label: 'Rephrase',
    description: 'Same point, fresh wording',
    icon: ArrowRightLeft,
    group: 'edit',
    prompt:
      'Rewrite the text with different wording and sentence structure while preserving its meaning, tone and approximate length. Avoid reusing the original phrasing.',
  },

  // ── Tone ──
  {
    id: 'professional',
    label: 'Professional tone',
    description: 'Polished and businesslike',
    icon: Briefcase,
    group: 'tone',
    prompt:
      'Rewrite the text in a polished, professional tone: precise, courteous, free of slang and exclamation marks. Do not change the meaning or add new claims.',
  },
  {
    id: 'casual',
    label: 'Casual tone',
    description: 'Relaxed and conversational',
    icon: Coffee,
    group: 'tone',
    prompt:
      'Rewrite the text in a relaxed, conversational tone, as if explaining it to a colleague. Keep it clear and keep the meaning unchanged; do not add jokes or filler.',
  },
  {
    id: 'confident',
    label: 'More confident',
    description: 'Drop the hedging',
    icon: PenLine,
    group: 'tone',
    prompt:
      'Rewrite the text so it reads more decisively: remove hedges such as "maybe", "I think" and "sort of", and use active voice. Keep any genuine uncertainty that the text explicitly states.',
  },
  {
    id: 'emojify',
    label: 'Emojify',
    description: 'Add relevant emoji',
    icon: SmilePlus,
    group: 'tone',
    prompt:
      'Add a small number of relevant emoji to the text, at most one per sentence. Do not change any of the wording.',
  },

  // ── Transform: reshape the selection into something else ──
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Condense into a short paragraph',
    icon: FileText,
    group: 'transform',
    prompt:
      'Summarize the text in one short paragraph that captures its main point and the reasoning behind it. Use only information present in the text.',
  },
  {
    id: 'key-points',
    label: 'Key takeaways',
    description: 'Turn it into a bullet list',
    icon: ListTree,
    group: 'transform',
    prompt:
      'Rewrite the text as a list of the key takeaways, one per line, each starting with "- ". Keep each line to a single sentence and use only information present in the text.',
  },
  {
    id: 'action-items',
    label: 'Extract action items',
    description: 'Who does what, next',
    icon: ListChecks,
    group: 'transform',
    prompt:
      'List the concrete action items implied by the text, one per line, each starting with "- " and written as an imperative with the owner named when the text names one. If the text contains no action items, return "- No action items.".',
  },
  {
    id: 'explain',
    label: 'Explain this',
    description: 'Plain-English explanation',
    icon: Baby,
    group: 'transform',
    prompt:
      'Explain what the text means in plain English, in one short paragraph a non-expert can follow. Explain the text; do not rewrite or evaluate it.',
  },
  {
    id: 'translate',
    label: 'Translate',
    description: 'Into another language',
    icon: Languages,
    group: 'transform',
    options: DEFAULT_AI_LANGUAGES,
    prompt:
      'Translate the text accurately, preserving tone, formatting, line breaks, names, URLs, code and numbers. Target language:',
  },

  // ── Generate: works from the caret, no selection needed ──
  {
    id: 'continue',
    label: 'Continue writing',
    description: 'Pick up where the text stops',
    icon: WandSparkles,
    group: 'generate',
    requiresSelection: false,
    prompt:
      'Continue the document from where it stops, in the same voice, tense and formatting. Write one or two paragraphs that follow naturally. Do not repeat what has already been written and do not invent sources or statistics.',
  },
  {
    id: 'outline',
    label: 'Draft an outline',
    description: 'Headings for this document',
    icon: ListTree,
    group: 'generate',
    requiresSelection: false,
    prompt:
      'Draft a working outline for this document, one heading per line, each starting with "- ". Base it on what the document is already about.',
  },
  {
    id: 'counterpoint',
    label: 'Counterpoint',
    description: 'The strongest objection',
    icon: Quote,
    group: 'transform',
    prompt:
      'State the strongest good-faith objection to the argument in the text, in one short paragraph. Name the assumption it challenges. Do not invent evidence, sources or statistics.',
  },
];

/** Order the menu renders groups in, with the heading shown above each. */
export const AI_COMMAND_GROUP_LABELS: Record<string, string> = {
  edit: 'Edit',
  tone: 'Tone',
  transform: 'Transform',
  generate: 'Generate',
};

export const AI_COMMAND_GROUP_ORDER = ['edit', 'tone', 'transform', 'generate'] as const;
