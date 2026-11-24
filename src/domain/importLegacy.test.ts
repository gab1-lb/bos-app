import { describe, it, expect } from 'vitest';
import { importLegacy } from './importLegacy';
import { blankDeal } from '../engine/samples';
import type { Member } from './permissions';
import { NOW } from './testutil';

const me: Member = { id: 'u9', email: 'a@b.c', name: 'A', avatarUrl: null, role: 'associate', status: 'active', locale: 'fr' };
const wrap = (...deals: unknown[]) => ({ format: 'bos-legacy-v1', exportedAt: 'x', deals });
const withStage = (stage: string) => ({ ...blankDeal('X'), stage, team: 'T1' });

describe('importLegacy', () => {
  const cases: [string, string, string | null][] = [
    ['Présélection', 'im_received', null], ['IM reçu', 'im_received', null],
    ['Offre indicative', 'decided', 'indicative_offer'], ['Due diligence', 'decided', 'go_dd'],
    ['Offre ferme', 'decided', 'go_dd'], ['Signé', 'decided', 'go_dd'], ['Abandonné', 'decided', 'no_go'],
    ['???', 'im_received', null],
  ];
  it.each(cases)('stage %s', (stage, phase, decision) => {
    const r = importLegacy(wrap(withStage(stage)), me, NOW);
    expect(r.errors).toEqual([]);
    const { meta, deal } = r.items[0];
    expect(meta.phase).toBe(phase);
    expect(meta.decision).toBe(decision);
    expect(meta.ownerId).toBe('u9');
    expect(meta.updatedBy).toBe('u9');
    expect(meta.decidedAt).toBe(decision ? NOW.toISOString() : null);
    expect(meta.phaseEnteredAt).toBe(NOW.toISOString());
    expect(meta.archived).toBe(false);
    expect(deal.team).toBe('T1');
  });
  it('rejects invalid input', () => {
    for (const j of [null, 'x', {}, { format: 'other', deals: [] }, { format: 'bos-legacy-v1' }]) {
      const r = importLegacy(j, me, NOW);
      expect(r.items).toEqual([]);
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });
  it('accepts JSON string', () => {
    expect(importLegacy(JSON.stringify(wrap(withStage('Signé'))), me, NOW).items).toHaveLength(1);
    expect(importLegacy('{bad', me, NOW).errors.length).toBeGreaterThan(0);
  });
  it('completes missing sections and question fields', () => {
    const r = importLegacy(wrap({ id: 'z', name: 'Z', stage: 'IM reçu', kpi: { arr: 3 }, questions: [{ q: 'a', cat: 'c', priority: 'p', status: 's', answer: '' }] }, 42), me, NOW);
    expect(r.items).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    const d = r.items[0].deal;
    expect(d.id).toBe('z');
    expect(d.hist.years).toHaveLength(5);
    expect(d.kpi.arr).toBe(3);
    expect(d.kpi.churn).toBeNull();
    expect(d.plan.taxRate).toBe(25);
    expect(d.questions[0]).toMatchObject({ awaitedFrom: null, sentAt: null, answeredAt: null });
  });
});
