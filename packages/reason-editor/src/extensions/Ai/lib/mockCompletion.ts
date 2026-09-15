/**
 * Default `getCompletion` implementation used when the host app does not
 * configure one. Simulates a streaming model response with a handful of
 * deterministic, offline text transforms so the extension is usable out of
 * the box — the same role `demoObjectUrlUpload` plays for the Image/Video
 * extensions. Real apps should pass their own `Ai.configure({ getCompletion })`
 * backed by an actual LLM call.
 */

import type { AiCompletionFn } from '../types';

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

function transform(commandId: string, instruction: string, selectedText: string): string {
  const lower = `${commandId} ${instruction}`.toLowerCase();
  const text = selectedText.trim();

  if (!text) {
    // Nothing selected: the generate commands ask for fresh content.
    if (lower.includes('outline')) {
      return '- Background\n- What changed\n- Why it matters\n- Next steps';
    }
    return `${instruction.trim() || 'New content'}\n\n(Offline demo response — configure Ai.configure({ getCompletion }) to use a real model.)`;
  }
  if (lower.includes('emoji')) {
    return `${text} \u2728\ud83d\udcdd`;
  }
  if (lower.includes('shorter') || lower.includes('concise')) {
    const words = text.split(/\s+/);
    const half = Math.max(1, Math.ceil(words.length / 2));
    return words.slice(0, half).join(' ');
  }
  if (lower.includes('longer') || lower.includes('expand')) {
    return `${text} In other words, this point matters because it clarifies the reader's understanding and adds useful context.`;
  }
  if (lower.includes('key-points') || lower.includes('action-items') || lower.includes('takeaway')) {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `- ${s.replace(/[.!?]$/, '')}`)
      .join('\n');
  }
  if (lower.includes('simplify')) {
    return text
      .replace(/[;:]/g, '.')
      .split('. ')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('. ');
  }
  // "Fix spelling & grammar" / "Improve writing" / anything else: a light,
  // visible touch-up so the diff view has something to show.
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/\s{2,}/g, ' ');
}

export const mockAiCompletion: AiCompletionFn = async (request, onChunk, signal) => {
  const full = transform(request.commandId, request.instruction, request.selectedText);
  // Split on whitespace but keep it, so multi-line demo output (lists,
  // paragraphs) streams with its line breaks intact.
  const chunks = full.split(/(\s+)/).filter(Boolean);

  let acc = '';
  for (const chunk of chunks) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    acc += chunk;
    onChunk(acc);
    if (chunk.trim()) await wait(35, signal);
  }

  return acc;
};
