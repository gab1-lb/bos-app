import { describe, it, expect } from 'vitest';
import { homeCards, homeCounters, relativeTime } from './home';
import { blankDeal, DEFAULT_MANDATE } from '../engine/samples';
import { NOW, ago, mkMeta } from './testutil';
import type { Deal } from '../engine/types';

const now = NOW;
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
  it('committeeSoon uses Paris calendar days', () => {
    const at = (iso: string) => homeCounters(homeCards([{ deal: blankDeal('a'), meta: mkMeta({ committeeDate: iso }) }], DEFAULT_MANDATE, now, none), now).committeeSoon;
    expect(at('2026-11-24T08:00:00+01:00')).toBe(1); // today
    expect(at('2026-12-08T23:00:00+01:00')).toBe(1); // +14
    expect(at('2026-12-09T00:30:00+01:00')).toBe(0); // +15
    expect(at('2026-11-23T23:00:00+01:00')).toBe(0); // yesterday
  });
  it('toReview counts bote_written and unvalidated associate_review', () => {
    const items = [
      { deal: blankDeal('a'), meta: mkMeta({ id: 'a', phase: 'bote_written' }) },
      { deal: blankDeal('b'), meta: mkMeta({ id: 'b', phase: 'associate_review' }) },
      { deal: blankDeal('c'), meta: mkMeta({ id: 'c', phase: 'associate_review', validatedAt: ago(1) }) },
      { deal: blankDeal('d'), meta: mkMeta({ id: 'd', phase: 'analysis' }) },
    ];
    expect(homeCounters(homeCards(items, DEFAULT_MANDATE, now, none), now).toReview).toBe(2);
  });
});

describe('relativeTime', () => {
  const at = (iso: string, locale: 'fr' | 'en' = 'fr') => relativeTime(locale, iso, now);
  it('FR', () => {
    expect(at('2026-11-24T09:59:40+01:00')).toBe('à l’instant');
    expect(at('2026-11-24T09:55:00+01:00')).toBe('il y a 5 min');
    expect(at('2026-11-24T08:00:00+01:00')).toBe('il y a 2 h');
    expect(at('2026-11-23T20:00:00+01:00')).toBe('hier');
    expect(at('2026-11-21T12:00:00+01:00')).toBe('il y a 3 j');
  });
  it('EN', () => {
    expect(at('2026-11-24T09:59:40+01:00', 'en')).toBe('just now');
    expect(at('2026-11-24T09:55:00+01:00', 'en')).toBe('5 min ago');
    expect(at('2026-11-24T08:00:00+01:00', 'en')).toBe('2 h ago');
    expect(at('2026-11-23T20:00:00+01:00', 'en')).toBe('yesterday');
    expect(at('2026-11-21T12:00:00+01:00', 'en')).toBe('3 d ago');
  });
  it('future or invalid timestamps read as now / empty', () => {
    expect(at('2026-11-24T11:00:00+01:00')).toBe('à l’instant');
    expect(at('nope')).toBe('');
  });
});
