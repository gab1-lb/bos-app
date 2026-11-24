import { describe, it, expect } from 'vitest';
import { comps, returns } from './finance';
import { screen } from './screen';
import { demoDeal, blankDeal, DEFAULT_MANDATE } from './samples';

describe('screen', () => {
  it('demo deal is go', () => {
    const d = demoDeal();
    const s = screen(d, DEFAULT_MANDATE, comps(d), returns(d));
    expect([s.score, s.lowS, s.highS, s.code]).toEqual([91, 78, 93, 'go']);
    expect(s.reasons[0][0]).toBe('go');
  });
  it('blank deal waits for a price', () => {
    const d = blankDeal();
    const s = screen(d, DEFAULT_MANDATE, comps(d), returns(d));
    expect(s.code).toBe('wait');
    expect(s.sub).toBe('price');
  });
  it('new question fields are initialised', () => {
    const q = demoDeal().questions[0];
    expect(q.awaitedFrom).toBeNull();
    expect(q.sentAt).toBeNull();
    expect(q.answeredAt).toBeNull();
  });
});
