import { describe, it, expect } from 'vitest';
import { base, returns, maxPrice, dcf, comps, quantile, irr } from './finance';
import { demoDeal, blankDeal } from './samples';

describe('finance engine', () => {
  const d = demoDeal();
  it('base', () => {
    const b = base(d);
    expect(b.adjEbitda).toBeCloseTo(2.9, 2);
    expect(b.margin).toBeCloseTo(23.39, 1);
  });
  it('returns', () => {
    expect(returns(d)!.irr!).toBeCloseTo(0.1591, 3);
    expect(returns(d)!.mom).toBeCloseTo(2.58, 2);
  });
  it('maxPrice', () => expect(maxPrice(d, 15)!).toBeCloseTo(43.93, 1));
  it('dcf', () => expect(dcf(d)!.ev).toBeCloseTo(39.2, 1));
  it('comps', () => expect(comps(d).evEbitda.med).toBeCloseTo(13.46, 2));
  it('blank deal', () => {
    expect(base(blankDeal()).adjEbitda).toBeNull();
    expect(returns(blankDeal())).toBeNull();
  });
  it('quantile and irr', () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(irr([-100, 110])!).toBeCloseTo(0.1, 6);
    expect(irr([100, 110])).toBeNull();
  });
});
