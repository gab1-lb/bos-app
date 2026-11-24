import { describe, it, expect } from 'vitest';
import { daysSince, waitsFor } from './waits';
import { blankDeal } from '../engine/samples';
import type { DealMeta } from './phases';

const now = new Date('2026-11-24T10:00:00+01:00');
const ago = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
export const mkMeta = (o: Partial<DealMeta> = {}): DealMeta => ({
  id: 'd1', ownerId: 'u1', contributorIds: [], phase: 'analysis', phaseEnteredAt: ago(1), decision: null, decidedAt: null,
  committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: ago(1), updatedBy: 'u1', ...o,
});
const dealWithQ = (sentDaysAgo: number, answered = false) => {
  const d = blankDeal('X');
  d.id = 'd1';
  d.questions = [{ q: 'Churn ?', cat: 'a', priority: 'Décisive', status: 'Envoyée', answer: '', awaitedFrom: 'director', sentAt: ago(sentDaysAgo), answeredAt: answered ? ago(1) : null }];
  return d;
};

describe('daysSince', () => {
  it('counts Paris calendar days', () => {
    expect(daysSince('2026-11-10T22:30:00+01:00', new Date('2026-11-11T08:00:00+01:00'))).toBe(1);
  });
  it('never negative', () => {
    expect(daysSince('2026-12-01T10:00:00+01:00', now)).toBe(0);
  });
});

describe('waitsFor', () => {
  it('levels for questions', () => {
    expect(waitsFor(dealWithQ(7), mkMeta(), now)[0].level).toBe('ok');
    expect(waitsFor(dealWithQ(8), mkMeta(), now)[0].level).toBe('late');
    expect(waitsFor(dealWithQ(15), mkMeta(), now)[0].level).toBe('overdue');
    const w = waitsFor(dealWithQ(8), mkMeta(), now)[0];
    expect(w).toMatchObject({ source: 'question', label: 'Churn ?', from: 'director', questionIndex: 0 });
  });
  it('ignores answered or unsent', () => {
    expect(waitsFor(dealWithQ(8, true), mkMeta(), now)).toEqual([]);
    expect(waitsFor(blankDeal('X'), mkMeta(), now)).toEqual([]);
  });
  it('associate review wait', () => {
    const w = waitsFor(blankDeal('X'), mkMeta({ phase: 'associate_review', phaseEnteredAt: ago(9) }), now);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ source: 'phase', from: 'associate', level: 'late', label: 'Revue associate' });
    expect(waitsFor(blankDeal('X'), mkMeta({ phase: 'associate_review', phaseEnteredAt: ago(9), validatedAt: ago(1) }), now)).toEqual([]);
  });
  it('committee wait', () => {
    const w = waitsFor(blankDeal('X'), mkMeta({ phase: 'committee', phaseEnteredAt: ago(3) }), now);
    expect(w[0]).toMatchObject({ from: 'committee', level: 'ok', label: 'Présentation comité' });
  });
});
