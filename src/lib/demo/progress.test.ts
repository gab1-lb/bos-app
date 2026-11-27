import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoSeed } from '../../engine/demoDeals';
import { blankDeal, demoDeal } from '../../engine/samples';
import { admin } from '../../data/personas';
import type { DealRecord } from '../../data/repo';
import type { DealMeta } from '../../domain/phases';
import { demoSignals, demoSteps, markDemo, type DemoSignal } from './progress';

const NOW = new Date('2026-11-27T10:00:00Z');
const T = NOW.toISOString();
const metaOf = (id: string, o: Partial<DealMeta> = {}): DealMeta => ({
  id, ownerId: admin.id, contributorIds: [], phase: 'analysis', phaseEnteredAt: T, decision: null, decidedAt: null,
  committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: T, updatedBy: admin.id, ...o,
});
/** Hélios (always seeded by the memory repo) followed by the demo seed. */
const records = (): DealRecord[] => [{ deal: demoDeal(), meta: metaOf('demo-helios') }, ...demoSeed(NOW)];
const withMeta = (recs: DealRecord[], id: string, o: Partial<DealMeta>) =>
  recs.map((r) => (r.meta.id === id ? { ...r, meta: { ...r.meta, ...o } } : r));
const done = (steps: { id: string; done: boolean }[]) => steps.filter((s) => s.done).map((s) => s.id);
const none = new Set<DemoSignal>();

describe('demoSteps', () => {
  it('associate, untouched: five steps in order, none done', () => {
    const steps = demoSteps('associate', records(), none);
    expect(steps.map((s) => s.id)).toEqual(['review_atlas', 'open_synthese', 'committee_msg', 'import_im', 'feedback']);
    expect(done(steps)).toEqual([]);
    expect(Object.fromEntries(steps.map((s) => [s.id, s.href]))).toEqual({
      review_atlas: '/projet/demo-atlas/synthese', open_synthese: null, committee_msg: '/projet/demo-ceres/synthese',
      import_im: '/dossiers', feedback: null,
    });
  });

  it('admin uses the associate list', () => {
    expect(demoSteps('admin', records(), none)).toEqual(demoSteps('associate', records(), none));
  });

  it('analyst, untouched: five steps in order, none done', () => {
    const steps = demoSteps('analyst', records(), none);
    expect(steps.map((s) => s.id)).toEqual(['import_im', 'fill_missing', 'write_bote', 'director_msg', 'feedback']);
    expect(done(steps)).toEqual([]);
  });

  it('Atlas sent back or validated ticks review_atlas', () => {
    expect(done(demoSteps('associate', withMeta(records(), 'demo-atlas', { phase: 'analysis' }), none))).toEqual(['review_atlas']);
    expect(done(demoSteps('associate', withMeta(records(), 'demo-atlas', { validatedAt: T, validatedBy: 'u-associate' }), none)))
      .toEqual(['review_atlas']);
    // No Atlas at all (list not loaded yet): not done.
    expect(done(demoSteps('associate', [], none))).toEqual([]);
  });

  it('a deal outside the demo seed ticks import_im for both roles', () => {
    const recs = [...records(), { deal: { ...blankDeal('Projet Kepler'), id: 'x1' }, meta: metaOf('x1', { phase: 'im_received' }) }];
    expect(done(demoSteps('associate', recs, none))).toEqual(['import_im']);
    expect(done(demoSteps('analyst', recs, none))).toEqual(['import_im']);
  });

  it('analyst: signals and a deal in bote_written', () => {
    const recs = withMeta(records(), 'demo-boree', { phase: 'bote_written' });
    const steps = demoSteps('analyst', recs, new Set<DemoSignal>(['edit', 'msg:director']));
    expect(done(steps)).toEqual(['fill_missing', 'write_bote', 'director_msg']);
  });

  it('associate signals', () => {
    const steps = demoSteps('associate', records(), new Set<DemoSignal>(['synthese', 'msg:committee_note', 'feedback']));
    expect(done(steps)).toEqual(['open_synthese', 'committee_msg', 'feedback']);
  });
});

describe('markDemo', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('is a no-op outside the demo', () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_MODE', 'memory');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    markDemo('edit');
    markDemo('synthese');
    expect([...demoSignals()]).toEqual([]);
  });

  it('records each signal once in the demo, with a new snapshot on change', () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_MODE', 'memory');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    const before = demoSignals();
    markDemo('edit');
    const after = demoSignals();
    expect(after).not.toBe(before);
    expect([...after]).toEqual(['edit']);
    markDemo('edit');
    expect(demoSignals()).toBe(after);
  });
});
