/**
 * @fileoverview Scrollable, playback-synced captions panel shown above the
 * video when subtitles are toggled on. Sentences are shown as prose (no
 * timestamps) — clicking one seeks the player to where it starts, and the
 * active one auto-scrolls and gets an approximate karaoke-style per-word
 * sweep.
 *
 * The transcript itself is loaded by the player, which only offers the
 * subtitles control for videos that turned out to have one — so this panel
 * has no loading or error state of its own: given nothing to show, it
 * renders nothing.
 */

'use client';

import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { TranscriptSnippet } from '../transcript';

interface PlayerSubtitlesProps {
  /** The video's transcript, already regrouped into sentences. */
  sentences: TranscriptSnippet[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

const SubtitleLine = forwardRef<
  HTMLButtonElement,
  { snippet: TranscriptSnippet; isActive: boolean; currentTime: number; onSeek: () => void }
>(function SubtitleLine({ snippet, isActive, currentTime, onSeek }, ref) {
  const words = useMemo(() => snippet.text.split(/\s+/).filter(Boolean), [snippet.text]);

  // Words don't carry their own timestamps — approximate a sweep by spreading
  // the snippet's duration evenly across its words.
  const activeWordIndex =
    isActive && snippet.duration > 0
      ? Math.min(
          words.length - 1,
          Math.max(0, Math.floor(((currentTime - snippet.start) / snippet.duration) * words.length)),
        )
      : -1;

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSeek();
      }}
      className={`eytp-line${isActive ? ' eytp-line-active' : ''}`}
    >
      {words.map((word, i) => (
        <span key={i} className={i === activeWordIndex ? 'eytp-word-active' : undefined}>
          {word}{' '}
        </span>
      ))}
    </button>
  );
});

export function PlayerSubtitles({ sentences, currentTime, onSeek }: PlayerSubtitlesProps) {
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].start <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [sentences, currentTime]);

  // Keep the active line in view as playback advances.
  useEffect(() => {
    if (activeIndex < 0) return;
    lineRefs.current[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  if (sentences.length === 0) return null;

  return (
    <div className="eytp-subtitles">
      {sentences.map((snippet, index) => (
        <SubtitleLine
          key={index}
          ref={(el) => {
            lineRefs.current[index] = el;
          }}
          snippet={snippet}
          isActive={index === activeIndex}
          currentTime={currentTime}
          onSeek={() => onSeek(snippet.start)}
        />
      ))}
    </div>
  );
}
