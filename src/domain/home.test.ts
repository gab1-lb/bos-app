import { describe, it, expect } from 'vitest';
import { homeCards, homeCounters } from './home';
import { blankDeal, DEFAULT_MANDATE } from '../engine/samples';
import { mkMeta } from './waits.test';
import type { Deal } from '../engine/types';

const now = new Date('2026-11-24T10:00:00+01:00');
const ago = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
const none = () => null;
const withQs = (id: string, days: number[]): Deal => {
  const d = blankDeal(id);
  d.id = id;
  d.questions = days.map((n, i) => ({ q: `q${i}`, cat: 'a', priority: 'Décisive', status: 'Envoyée', answer: '', awaitedFrom: 'director', sentAt: ago(n), answeredAt: null }));
  return d;
};

describe('homeCards', () => {
  it('excludes decided and archived, builds blank card', () => {
    const items = [
      { deal: blankDeal('a'), meta: mkMeta({ id: 'a' }) },
      { deal: blankDeal('b'), meta: mkMeta({ id: 'b', phase: 'decided' }) },
      { deal: blankDeal('c'), meta: mkMeta({ id: 'c', archived: true }) },
    ];
    const cards = homeCards(items, DEFAULT_MANDATE, now, none);
    expect(cards).toHaveLength(1);
    expect(cards[0].irr).toBeNull();
    expect(cards[0].coverage).toEqual({ known: 0, total: 7 });
    expect(cards[0].suggestion).toBeNull();
  });
  it('sorts 1 overdue before 2 late, passes suggest through', () => {
    const items = [
      { deal: withQs('late', [8, 9]), meta: mkMeta({ id: 'late' }) },
      { deal: withQs('over', [15]), meta: mkMeta({ id: 'over' }) },
    ];
    const cards = homeCards(items, DEFAULT_MANDATE, now, () => 'tpl');
    expect(cards.map((c) => c.meta.id)).toEqual(['over', 'late']);
    expect(cards[0].suggestion).toBe('tpl');
  });
  it('tie-breaks by updatedAt desc', () => {
    const items = [
      { deal: blankDeal('o'), meta: mkMeta({ id: 'o', updatedAt: ago(5) }) },
      { deal: blankDeal('n'), meta: mkMeta({ id: 'n', updatedAt: ago(1) }) },
    ];
    expect(homeCards(items, DEFAULT_MANDATE, now, none).map((c) => c.meta.id)).toEqual(['n', 'o']);
  });
});

describe('homeCounters', () => {
  it('counts', () => {
    const items = [
      { deal: withQs('a', [8]), meta: mkMeta({ id: 'a', committeeDate: new Date(now.getTime() + 5 * 86400000).toISOString() }) },
      { deal: blankDeal('b'), meta: mkMeta({ id: 'b', phase: 'associate_review', phaseEnteredAt: ago(2), committeeDate: new Date(now.getTime() + 30 * 86400000).toISOString() }) },
    ];
    expect(homeCounters(homeCards(items, DEFAULT_MANDATE, now, none), now)).toEqual({ active: 2, toReview: 1, lateWaits: 1, committeeSoon: 1 });
  });
});
