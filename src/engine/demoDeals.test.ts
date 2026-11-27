import { describe, expect, it } from 'vitest';
import { DEMO_DEAL_IDS, demoSeed } from './demoDeals';
import { DEFAULT_MANDATE, demoDeal } from './samples';
import { missingItems } from '../domain/missing';
import { homeCards, homeCounters } from '../domain/home';
import { createMemoryRepo } from '../data/memoryRepo';
import { admin, associate } from '../data/personas';
import type { DealMeta } from '../domain/phases';

const NOWS = ['2026-11-27T10:00:00Z', '2027-03-02T10:00:00Z'];

const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};

describe.each(NOWS)('demoSeed @ %s', (iso) => {
  const now = new Date(iso);
  const seed = demoSeed(now);

  it('ids and order', () => {
    expect(seed.map((s) => s.meta.id)).toEqual(['demo-atlas', 'demo-boree', 'demo-ceres', 'demo-dune']);
    for (const s of seed) expect(s.deal.id).toBe(s.meta.id);
    expect(DEMO_DEAL_IDS).toEqual(['demo-helios', ...seed.map((s) => s.meta.id)]);
  });

  it('1 to 2 missing items each', () => {
    for (const s of seed) {
      const n = missingItems(s.deal, s.meta).length;
      expect(n, s.deal.name).toBeGreaterThanOrEqual(1);
      expect(n, s.deal.name).toBeLessThanOrEqual(2);
    }
  });

  it('home cards and counters', () => {
    const helios = demoDeal();
    const hMeta: DealMeta = {
      id: helios.id, ownerId: admin.id, contributorIds: [], phase: 'analysis', phaseEnteredAt: now.toISOString(), decision: null,
      decidedAt: null, committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: now.toISOString(), updatedBy: admin.id,
    };
    const cards = homeCards([{ deal: helios, meta: hMeta }, ...seed], DEFAULT_MANDATE, now, () => null);
    const names = cards.map((c) => c.name);
    for (const n of ['Atlas', 'Borée', 'Cérès', 'Hélios']) expect(names.some((x) => x.includes(n)), n).toBe(true);
    expect(names.some((x) => x.includes('Dune'))).toBe(false);
    const c = homeCounters(cards, now);
    expect(c.toReview).toBe(1);
    expect(c.committeeSoon).toBe(1);
    expect(c.lateWaits).toBeGreaterThanOrEqual(3);
  });

  it('memory repo with extraDeals', async () => {
    const repo = createMemoryRepo({ me: associate, extraDeals: demoSeed(now) });
    expect(await repo.listDeals()).toHaveLength(5);
    await expect(repo.validateBote('demo-atlas')).resolves.toBeUndefined();
    const plain = createMemoryRepo();
    expect((await plain.listDeals()).map((r) => r.meta.id)).toEqual(['demo-helios']);
  });

  it('dates and states', () => {
    const DAY = 86400000;
    const by = (id: string) => seed.find((x) => x.meta.id === id)!;
    for (const q of by('demo-boree').deal.questions) {
      expect(q.sentAt).toBe(new Date(now.getTime() - 9 * DAY).toISOString());
      expect(q.answeredAt).toBeNull();
    }
    const cm = by('demo-ceres').meta;
    expect(cm.committeeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cm.committeeDate).toBe(new Date(now.getTime() + 5 * DAY).toISOString().slice(0, 10));
    expect(cm.validatedAt).toBeTruthy();
    expect(by('demo-dune').meta.decidedAt).toBeTruthy();
  });

  it('no TSS and all flagged example', () => {
    for (const s of seed) {
      expect(strings(s.deal).some((x) => /TSS/.test(x))).toBe(false);
      expect(s.deal.example).toBe(true);
      expect(s.deal.source).toMatch(/\(exemple fictif\)$/);
    }
  });
});
