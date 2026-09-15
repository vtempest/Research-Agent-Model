/**
 * Entry point for the Ai extension that re-exports the extension, its React
 * components, and the helpers host apps need to wire a real model in. Lets
 * the app import the AI writing assistant from a single, stable module path.
 */

export * from './Ai';
export * from './components/AiMenu';
export * from './components/RichTextAi';
export { mockAiCompletion } from './lib/mockCompletion';
export { createStreamingCompletion } from './lib/createStreamingCompletion';
export { createRewriteCompletion, DEFAULT_AI_ENDPOINT } from './lib/rewriteEndpoint';
export type { StreamingCompletionOptions } from './lib/createStreamingCompletion';
export {
  buildAiInstruction,
  buildAiUserPrompt,
  clampContext,
  commandRequiresSelection,
  commandsForSelection,
  groupCommands,
} from './lib/prompt';
export { sanitizeCompletion } from './lib/sanitizeCompletion';
export { completionToContent, completionToHtml, needsRichInsert } from './lib/completionToContent';
