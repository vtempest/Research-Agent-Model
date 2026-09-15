/**
 * @fileoverview Turns raw caption cues into readable sentences.
 *
 * YouTube's caption tracks are cut for on-screen display, not for reading: a
 * cue is a couple of seconds long and breaks mid-clause ("powers aligning
 * with each other to" / "balance between United States and China."). Rendered
 * one cue per row, next to a timestamp, the transcript reads as a column of
 * fragments. Regrouping the cues into sentences gives back the prose while
 * keeping every sentence seekable, since each one still carries the start
 * time of the cue its first word came from.
 *
 * Framework-free on purpose — no React import — so it can be unit tested and
 * reused by non-UI callers.
 */

/** One timed caption cue (or, after grouping, one timed sentence). */
export interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

/** A word ending a sentence, allowing a trailing quote or bracket. */
const SENTENCE_END = /[.!?…]["')\]]*$/;

/**
 * Words that end in a period without ending a sentence: single-letter
 * initials, dotted initialisms ("U.S."), and the common title/abbreviation
 * set. Without this, "the U.S. and China" becomes two "sentences".
 */
const ABBREVIATION = /^(?:[A-Za-z]\.)+$|^(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|approx|e\.g|i\.e)\.$/i;

/**
 * Auto-generated captions frequently carry no punctuation at all, which would
 * make the whole video one unreadable sentence. A run that never terminates
 * is broken at a word boundary once it reaches this many characters.
 */
const MAX_SENTENCE_CHARS = 220;

/**
 * Regroups caption cues into sentences.
 *
 * Each returned entry has the same `{ text, start, duration }` shape as the
 * cues going in, so callers can keep treating the list as snippets: `start`
 * is when the sentence's first word is spoken and `duration` runs to the end
 * of its last word, which keeps click-to-seek and the active-line highlight
 * working unchanged.
 *
 * @param snippets - Caption cues in playback order.
 * @returns One entry per sentence, in playback order.
 */
export function groupIntoSentences(snippets: TranscriptSnippet[]): TranscriptSnippet[] {
  const sentences: TranscriptSnippet[] = [];

  let words: string[] = [];
  let chars = 0;
  let start = 0;
  let end = 0;

  const flush = () => {
    if (words.length === 0) return;
    sentences.push({ text: words.join(' '), start, duration: Math.max(0, end - start) });
    words = [];
    chars = 0;
  };

  for (const snippet of snippets) {
    const cueWords = snippet.text.split(/\s+/).filter(Boolean);
    if (cueWords.length === 0) continue;

    // Words don't carry their own timestamps, so spread the cue's duration
    // evenly across them — that way a sentence boundary falling mid-cue still
    // gets a start time close to when it is actually spoken.
    const perWord = snippet.duration > 0 ? snippet.duration / cueWords.length : 0;

    cueWords.forEach((word, index) => {
      if (words.length === 0) start = snippet.start + perWord * index;
      words.push(word);
      chars += word.length + 1;
      end = snippet.start + perWord * (index + 1);

      const endsSentence = SENTENCE_END.test(word) && !ABBREVIATION.test(word);
      if (endsSentence || chars >= MAX_SENTENCE_CHARS) flush();
    });
  }

  flush();
  return sentences;
}
