import { describe, expect, it } from 'vitest';
import { duplicateScore, textSimilarity } from './duplicates.js';

describe('duplicate candidate scoring', () => {
  it('finds lexical overlap without treating distant or late reports as exact matches', () => {
    const text = textSimilarity('water on road near station', 'road water near station');
    expect(text).toBeGreaterThan(0.5);
    const nearby = duplicateScore(text, 100, 1);
    const distant = duplicateScore(text, 1400, 23);
    expect(nearby.score).toBeGreaterThan(0.7);
    expect(distant.score).toBeLessThan(nearby.score);
  });

  it('scores unrelated reports lower and explains candidate factors', () => {
    const result = duplicateScore(textSimilarity('blocked drain at market', 'bridge closed by construction'), 1400, 23);
    expect(result.score).toBeLessThan(0.3);
    expect(result.reasons).toHaveLength(2);
  });
});
