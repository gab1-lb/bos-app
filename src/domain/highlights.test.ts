import { describe, it, expect } from 'vitest';
import { dealHighlights } from './highlights';
import { demoDeal, blankDeal, DEFAULT_MANDATE } from '../engine/samples';
import { NOW, mkMeta, ago } from './testutil';

const keys = (h: { key: string }[]) => h.map((x) => x.key);

describe('dealHighlights', () => {
  const h = dealHighlights(demoDeal(), mkMeta(), DEFAULT_MANDATE, NOW);
  it('demo: favorable criteria are positives with their value', () => {
    expect(keys(h.positives)).toEqual(expect.arrayContaining(['crit:recurring', 'crit:churn', 'crit:growth']));
    expect(h.positives.find((x) => x.key === 'crit:recurring')).toMatchObject({ raw: 78, unit: '%' });
  });
  it('demo: missing top10 and open decisive questions are to explore', () => {
    expect(keys(h.toExplore)).toContain('crit:top10');
    expect(h.toExplore.find((x) => x.key === 'crit:top10')?.raw).toBeUndefined();
    expect(keys(h.toExplore)).toContain('openQ');
    expect(h.toExplore.find((x) => x.key === 'openQ')!.raw).toBeGreaterThan(0);
  });
  it('late waits are to explore', () => {
    const d = demoDeal();
    d.questions[0].sentAt = ago(10);
    expect(keys(dealHighlights(d, mkMeta(), DEFAULT_MANDATE, NOW).toExplore)).toContain('wait:late');
  });
  it('high asking price gives a negative price item', () => {
    const d = demoDeal();
    d.askPrice = 400;
    const r = dealHighlights(d, mkMeta(), DEFAULT_MANDATE, NOW);
    expect(keys(r.negatives)).toEqual(expect.arrayContaining(['crit:price', 'irr']));
  });
  it('out-of-mandate deal has a negative mandate item', () => {
    const r = dealHighlights(demoDeal(), mkMeta(), { ...DEFAULT_MANDATE, minRev: 1000 }, NOW);
    expect(keys(r.negatives)).toContain('mandate:minRev');
  });
  it('blank deal does not throw and has nothing positive', () => {
    const r = dealHighlights(blankDeal('x'), mkMeta(), DEFAULT_MANDATE, NOW);
    expect(r.positives).toEqual([]);
    expect(r.toExplore.length).toBeGreaterThan(0);
  });
});
