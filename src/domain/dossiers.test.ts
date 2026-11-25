import { describe, expect, it } from 'vitest';
import { DEFAULT_MANDATE, blankDeal, demoDeal } from '../engine/samples';
import { NO_FILTERS, dealRows, dossierStats, filterRows } from './dossiers';
import { mkMeta } from './testutil';

const items = [
  { deal: demoDeal(), meta: mkMeta({ id: 'a', phase: 'analysis', ownerId: 'u1' }) },
  { deal: blankDeal('B'), meta: mkMeta({ id: 'b', phase: 'im_received', ownerId: 'u2' }) },
  { deal: blankDeal('C'), meta: mkMeta({ id: 'c', phase: 'decided', decision: 'go_dd', ownerId: 'u2' }) },
  { deal: blankDeal('D'), meta: mkMeta({ id: 'd', phase: 'analysis', archived: true }) },
];
const rows = dealRows(items, DEFAULT_MANDATE);
const ids = (f: Partial<typeof NO_FILTERS>) => filterRows(rows, { ...NO_FILTERS, ...f }).map((r) => r.meta.id);

describe('Mes dossiers', () => {
  it('status filter: current hides archived, active hides decided', () => {
    expect(ids({})).toEqual(['a', 'b', 'c']);
    expect(ids({ status: 'active' })).toEqual(['a', 'b']);
    expect(ids({ status: 'decided' })).toEqual(['c']);
    expect(ids({ status: 'archived' })).toEqual(['d']);
    expect(ids({ status: 'all' })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('phase, owner and verdict filters combine', () => {
    expect(ids({ phase: 'analysis' })).toEqual(['a']);
    expect(ids({ phase: 'analysis', status: 'all' })).toEqual(['a', 'd']);
    expect(ids({ owner: 'u2' })).toEqual(['b', 'c']);
    expect(ids({ owner: 'u2', phase: 'decided' })).toEqual(['c']);
    expect(ids({ verdict: 'wait' })).toEqual(['b', 'c']);
    expect(rows[1].sc.code).toBe('wait');
  });

  it('stats ignore archived deals', () => {
    const s = dossierStats(rows);
    expect(s.active).toBe(2);
    expect(s.go + s.toWork).toBeLessThanOrEqual(3);
    expect(s.openDecisive).toBe(demoDeal().questions.filter((q) => q.priority === 'Décisive' && q.status !== 'Répondue').length);
  });
});
