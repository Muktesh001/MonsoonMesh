import { describe, expect, it } from 'vitest';
import { calculateRisk } from './risk.js';

describe('calculateRisk', () => {
  it('renormalizes available factors and classifies an illustrative score', () => {
    const result = calculateRisk({ rainfall: 100, history: 50, slope: null, drainage: null, incidents: null });
    expect(result.score).toBe(82);
    expect(result.category).toBe('CRITICAL');
  });
  it('rejects missing and out-of-range values', () => {
    expect(() => calculateRisk({ rainfall: null, history: null, slope: null, drainage: null, incidents: null })).toThrow();
    expect(() => calculateRisk({ rainfall: 101, history: null, slope: null, drainage: null, incidents: null })).toThrow();
  });
});
