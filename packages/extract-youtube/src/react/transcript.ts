/**
 * @fileoverview Transcript loading shared by `extract-youtube/react`'s UI
 * components (the popout modal and the floating player's subtitles panel).
 *
 * None of this talks to YouTube directly — browsers can't reach YouTube's
 * caption endpoints, and the whole point of this package's main entry is that
 * fetching happens server-side. The components ask *your* endpoint instead,
 * via `transcriptUrl` or a custom `fetchTranscript`.
 */

'use client';

import { useEffect, useState } from 'react';

import type { TranscriptSnippet } from './sentences';

// Re-exported so `./transcript` stays the one import site for the transcript
// types, even though the snippet shape itself lives with the sentence
// grouping that produces it.
export type { TranscriptSnippet };

export interface TranscriptResponse {
  snippets?: TranscriptSnippet[];
  error?: string;
}

/** How a component is told where to get captions from. */
export interface TranscriptSource {
  /**
   * URL of your own backend endpoint returning `{ snippets }` (or `{ error }`)
   * for a video, e.g. `/api/transcript`. The `videoId` query param is appended
   * automatically when it isn't already part of the URL.
   */
  transcriptUrl?: string;
  /** Custom loader, if you'd rather not hit a URL directly. Wins over `transcriptUrl`. */
  fetchTranscript?: (videoId: string) => Promise<TranscriptResponse>;
}

/** `mm:ss`, or `h:mm:ss` once the video runs past an hour. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, '0') : m.toString();
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Append `videoId` to the endpoint URL unless the caller already put it there. */
function withVideoId(url: string, videoId: string): string {
  if (url.includes('videoId=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}videoId=${encodeURIComponent(videoId)}`;
}

/**
 * In-flight and completed requests, keyed by video id. The modal and the
 * floating player's subtitles panel can ask for the same video at the same
 * time, and each remount would otherwise fire its own request.
 */
const cache = new Map<string, Promise<TranscriptSnippet[]>>();

/** How long a failed lookup is remembered before another request is allowed. */
const FAILURE_TTL_MS = 60_000;

/** Fetch `videoId`'s captions through `source`, sharing one request per video. */
export function loadTranscript(videoId: string, source: TranscriptSource): Promise<TranscriptSnippet[]> {
  const { transcriptUrl, fetchTranscript } = source;

  // A custom loader is opaque to us (it may close over per-render state), so
  // only the shared URL path is cached.
  if (fetchTranscript) return fetchTranscript(videoId).then(unwrap);

  if (!transcriptUrl) {
    return Promise.reject(new Error('No transcriptUrl or fetchTranscript provided'));
  }

  const cached = cache.get(videoId);
  if (cached) return cached;

  const request = fetch(withVideoId(transcriptUrl, videoId))
    .then((res) => res.json() as Promise<TranscriptResponse>)
    .then(unwrap)
    .catch((error: unknown) => {
      // Let a failure expire so the user can retry, but not on every remount.
      setTimeout(() => {
        if (cache.get(videoId) === request) cache.delete(videoId);
      }, FAILURE_TTL_MS);
      throw error;
    });

  cache.set(videoId, request);
  return request;
}

/** Endpoints report "no captions" as an `error` field on a 200, not a throw. */
function unwrap(data: TranscriptResponse | null): TranscriptSnippet[] {
  if (!data || data.error) throw new Error(data?.error || 'Failed to load transcript');
  return data.snippets ?? [];
}

export interface UseTranscriptResult {
  snippets: TranscriptSnippet[] | null;
  loading: boolean;
  error: string | null;
}

/** Loads `videoId`'s captions while `enabled` is true; resets when either changes. */
export function useTranscript(
  videoId: string | null,
  enabled: boolean,
  source: TranscriptSource,
): UseTranscriptResult {
  const [snippets, setSnippets] = useState<TranscriptSnippet[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { transcriptUrl, fetchTranscript } = source;

  useEffect(() => {
    if (!enabled || !videoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSnippets(null);

    loadTranscript(videoId, { transcriptUrl, fetchTranscript })
      .then((result) => {
        if (!cancelled) setSnippets(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load transcript');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, videoId, transcriptUrl, fetchTranscript]);

  return { snippets, loading, error };
}
