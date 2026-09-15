/**
 * @fileoverview Unit tests for regrouping display-cut caption cues into
 * readable sentences.
 */

import { groupIntoSentences } from '../src/react/sentences';

function cue(text: string, start: number, duration = 2) {
  return { text, start, duration };
}

describe('groupIntoSentences', () => {
  it('joins cues that break mid-clause into one sentence', () => {
    const result = groupIntoSentences([
      cue('powers aligning with each other to', 10),
      cue('balance between United States and China.', 12),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(
      'powers aligning with each other to balance between United States and China.'
    );
  });

  it('keeps the start of the sentence and runs the duration to its last word', () => {
    const [sentence] = groupIntoSentences([cue('one two', 10, 2), cue('three four.', 12, 2)]);

    expect(sentence.start).toBe(10);
    expect(sentence.duration).toBeCloseTo(4);
  });

  it('splits a cue that carries the end of one sentence and the start of the next', () => {
    const result = groupIntoSentences([cue('the first one. And then the', 10, 4), cue('second one.', 14, 2)]);

    expect(result.map((s) => s.text)).toEqual(['the first one.', 'And then the second one.']);
    // The second sentence starts partway through the first cue, not at 14.
    expect(result[1].start).toBeCloseTo(12);
  });

  it('does not treat abbreviations or initials as sentence ends', () => {
    const result = groupIntoSentences([cue('policy in the U.S. and Dr. Smith agrees.', 0, 4)]);

    expect(result.map((s) => s.text)).toEqual(['policy in the U.S. and Dr. Smith agrees.']);
  });

  it('breaks unpunctuated auto-captions into readable chunks', () => {
    const cues = Array.from({ length: 40 }, (_, i) => cue('word '.repeat(5).trim(), i * 2));
    const result = groupIntoSentences(cues);

    expect(result.length).toBeGreaterThan(1);
    for (const sentence of result) {
      expect(sentence.text.length).toBeLessThanOrEqual(240);
    }
  });

  it('ignores blank cues and returns nothing for an empty transcript', () => {
    expect(groupIntoSentences([])).toEqual([]);
    expect(groupIntoSentences([cue('   ', 0)])).toEqual([]);
  });

  it('emits a trailing run that never gets punctuation', () => {
    const result = groupIntoSentences([cue('so anyway that is the plan', 0, 3)]);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('so anyway that is the plan');
  });
});
