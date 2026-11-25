import { describe, expect, it } from 'vitest';
import { demoDeal } from '../engine/samples';
import { LISTS, newItemId, normalizeDeal } from './dealShape';

describe('newItemId', () => {
  it('returns distinct non-empty strings', () => {
    const ids = new Set(Array.from({ length: 50 }, newItemId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[\w-]{8,}$/);
  });
});

describe('normalizeDeal', () => {
  it('leaves a well-formed deal unchanged and reports nothing to save', () => {
    const d = demoDeal();
    const { deal, idsAdded } = normalizeDeal(structuredClone(d));
    expect(deal).toEqual(d);
    expect(idsAdded).toEqual([]);
  });

  it('gives every list item without an id (or with a duplicate one) a fresh id', () => {
    const raw = {
      id: 'x', name: 'X',
      questions: [{ q: 'a' }, { id: 'k', q: 'b' }, { id: 'k', q: 'c' }, { id: '', q: 'd' }],
      adjustments: [{ label: 'l' }],
      comps: [{ id: 'c1', target: 't' }],
    };
    const { deal, idsAdded } = normalizeDeal(raw);
    const qids = deal.questions.map((q) => q.id);
    expect(qids[1]).toBe('k');
    expect(new Set(qids).size).toBe(4);
    expect(qids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(deal.adjustments[0].id).toBeTruthy();
    expect(deal.comps[0].id).toBe('c1');
    expect(idsAdded).toEqual(['questions', 'adjustments']);
    expect(deal.questions[0]).toMatchObject({ awaitedFrom: null, sentAt: null, answeredAt: null });
  });

  it('coerces malformed sections so screens never crash (null lists, missing hist)', () => {
    const { deal, idsAdded } = normalizeDeal({ id: 'y', name: 'Y', questions: null, adjustments: 'x', comps: [null, 3], hist: null, kpi: 4 });
    for (const l of LISTS) expect(deal[l]).toEqual([]);
    expect(deal.hist.years).toHaveLength(5);
    expect(deal.hist.rev).toHaveLength(5);
    expect(deal.kpi.arr).toBeNull();
    expect(idsAdded).toEqual([]);
    expect(deal.id).toBe('y');
  });

  it('coerces array fields inside sections', () => {
    const { deal } = normalizeDeal({ id: 'z', hist: { years: [2024], rev: 'bad' }, plan: { growth: null } });
    expect(deal.hist.years).toEqual([2024]);
    expect(Array.isArray(deal.hist.rev)).toBe(true);
    expect(Array.isArray(deal.plan.growth)).toBe(true);
  });

  it('does not mutate its input', () => {
    const raw = { id: 'a', questions: [{ q: 'a' }] };
    normalizeDeal(raw);
    expect(raw.questions[0]).toEqual({ q: 'a' });
  });
});
