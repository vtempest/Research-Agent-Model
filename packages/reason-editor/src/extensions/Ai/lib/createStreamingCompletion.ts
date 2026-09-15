/**
 * A ready-made `getCompletion` for host apps: POSTs the request to an
 * endpoint and streams the response back into the editor.
 *
 * The extension ships with an offline mock so the menu works out of the box,
 * but every real deployment needs the same twenty lines of fetch-and-decode
 * glue — including the parts that are easy to get wrong (aborting on cancel,
 * surfacing a JSON error body instead of "failed to fetch", handling both a
 * plain text stream and a Server-Sent Events stream). This provides them.
 *
 * @example
 * ```ts
 * Ai.configure({
 *   getCompletion: createStreamingCompletion({ endpoint: '/api/ai' }),
 * });
 * ```
 */

import type { AiCompletionFn, AiCompletionRequest } from '../types';

export interface StreamingCompletionOptions {
  /** URL the completion is POSTed to. Defaults to `/api/ai`. */
  endpoint?: string;
  /** Extra request headers (auth, workspace id, …). */
  headers?: HeadersInit | (() => HeadersInit);
  /**
   * Builds the JSON body. Defaults to sending the whole
   * {@link AiCompletionRequest} — instruction, selection, context window,
   * command id and the system prompt — so the route can prompt as it likes.
   */
  body?: (request: AiCompletionRequest) => unknown;
  /**
   * Response format. `auto` (the default) detects Server-Sent Events from the
   * `Content-Type` header or a leading `data:` line and otherwise treats the
   * body as a plain text stream.
   */
  format?: 'auto' | 'text' | 'sse';
  /**
   * Pulls the text out of one parsed payload — an SSE event, or the whole body
   * for a non-streaming JSON response. Defaults to the OpenAI-compatible
   * shapes (`choices[0].delta.content`, `choices[0].text`, `delta`, `text`,
   * `content`, `rewrittenText`, or a bare string).
   */
  parseEvent?: (payload: unknown) => string;
}

/** Reads the delta from the common OpenAI-compatible event shapes. */
function defaultParseEvent(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';

  const data = payload as Record<string, any>;
  const choice = Array.isArray(data.choices) ? data.choices[0] : undefined;

  const candidates = [
    choice?.delta?.content,
    choice?.text,
    data.delta,
    data.text,
    data.content,
    data.rewrittenText,
    data.completion,
  ];

  return candidates.find((value) => typeof value === 'string') ?? '';
}

/** Turns a failed response into an Error carrying the server's own message when it sent one. */
async function toError(response: Response): Promise<Error> {
  const fallback = `AI request failed (${response.status} ${response.statusText || 'error'}).`;
  try {
    const body: any = await response.json();
    const message = body?.error?.message ?? body?.error ?? body?.message;
    return new Error(typeof message === 'string' && message ? message : fallback);
  } catch {
    return new Error(fallback);
  }
}

export function createStreamingCompletion(
  options: StreamingCompletionOptions = {}
): AiCompletionFn {
  const {
    endpoint = '/api/ai',
    headers,
    body = (request: AiCompletionRequest) => request,
    format = 'auto',
    parseEvent = defaultParseEvent,
  } = options;

  return async (request, onChunk, signal) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(typeof headers === 'function' ? headers() : headers),
      },
      body: JSON.stringify(body(request)),
    });

    if (!response.ok) throw await toError(response);

    // A route that answers with one JSON object rather than a stream — the
    // shape most "rewrite this text" endpoints ship with. Reported as a single
    // chunk so the review panel behaves identically either way.
    if (response.headers.get('content-type')?.includes('application/json')) {
      const text = parseEvent(await response.json());
      if (text) onChunk(text);
      return text;
    }

    if (!response.body) return (await response.text()) ?? '';

    const isSse =
      format === 'sse' ||
      (format === 'auto' && !!response.headers.get('content-type')?.includes('text/event-stream'));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';
    let sse = isSse;
    let sniffed = format !== 'auto' || isSse;

    const flushSseLines = (final: boolean) => {
      const lines = buffer.split('\n');
      // Without a trailing newline the last line may still be partial.
      buffer = final ? '' : (lines.pop() ?? '');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        let delta = '';
        try {
          delta = parseEvent(JSON.parse(payload));
        } catch {
          delta = payload;
        }

        if (delta) {
          accumulated += delta;
          onChunk(accumulated);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });

      if (!sniffed) {
        sse = /^\s*(?:data:|event:)/.test(text);
        sniffed = true;
      }

      if (sse) {
        buffer += text;
        flushSseLines(false);
      } else if (text) {
        accumulated += text;
        onChunk(accumulated);
      }
    }

    const tail = decoder.decode();
    if (sse) {
      buffer += tail;
      flushSseLines(true);
    } else if (tail) {
      accumulated += tail;
      onChunk(accumulated);
    }

    return accumulated;
  };
}
