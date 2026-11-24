import { describe, expect, it } from 'vitest';
import { gaugeScale } from './gaugeScale';

describe('gaugeScale', () => {
  it('covers rows and marks with round, evenly spaced ticks', () => {
    const s = gaugeScale([{ lo: 34, mid: 39, hi: 46 }], [42]);
    expect(s.min).toBeLessThanOrEqual(34);
    expect(s.max).toBeGreaterThanOrEqual(46);
    expect(s.x(s.min)).toBe(0);
    expect(s.x(s.max)).toBe(100);
    expect(s.ticks.length).toBeGreaterThan(2);
    const steps = s.ticks.slice(1).map((v, i) => v - s.ticks[i]);
    steps.forEach((st) => {
      expect(st).toBeGreaterThan(0);
      expect(st).toBeCloseTo(steps[0], 9);
    });
    expect(s.ticks[0]).toBe(s.min);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
  });

  it('uses the legacy football-field steps (1, 2, 5 × 10^n)', () => {
    const s = gaugeScale([{ lo: 34, mid: 39, hi: 46 }], [42]);
    expect(s.ticks).toEqual([30, 32, 34, 36, 38, 40, 42, 44, 46, 48]);
  });

  it('includes marks outside the rows', () => {
    const s = gaugeScale([{ lo: 34, mid: 39, hi: 46 }], [60, Number.NaN]);
    expect(s.max).toBeGreaterThanOrEqual(60);
  });

  it('never starts below zero', () => {
    const s = gaugeScale([{ lo: 1, mid: 2, hi: 3 }], []);
    expect(s.min).toBeGreaterThanOrEqual(0);
  });

  it('handles a degenerate range', () => {
    const s = gaugeScale([{ lo: 0, mid: 0, hi: 0 }], []);
    expect(s.max).toBeGreaterThan(s.min);
    expect(Number.isFinite(s.x(0))).toBe(true);
  });

  it('returns no ticks for no rows, without throwing', () => {
    const s = gaugeScale([], [42]);
    expect(s.ticks).toEqual([]);
    expect(Number.isFinite(s.x(10))).toBe(true);
  });
});
