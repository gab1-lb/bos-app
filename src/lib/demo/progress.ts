import { useSyncExternalStore } from 'react';
import type { DealRecord } from '../../data/repo';
import { DEMO_DEAL_IDS } from '../../engine/demoDeals';
import type { DemoRole } from '../session';
import { demoSignals, subscribeDemoSignals, type DemoSignal } from './signals';

export { demoSignals, markDemo, type DemoSignal } from './signals';

export type StepId = 'review_atlas' | 'open_synthese' | 'committee_msg' | 'import_im' | 'fill_missing' | 'write_bote' | 'director_msg' | 'feedback';
export type DemoStep = { id: StepId; done: boolean; href: string | null };

const EMPTY: ReadonlySet<DemoSignal> = new Set();

/** Demo signals, re-rendering on each new one (empty on the server). */
export function useDemoSignals(): ReadonlySet<DemoSignal> {
  return useSyncExternalStore(subscribeDemoSignals, demoSignals, () => EMPTY);
}

const ASSOCIATE: StepId[] = ['review_atlas', 'open_synthese', 'committee_msg', 'import_im', 'feedback'];
const ANALYST: StepId[] = ['import_im', 'fill_missing', 'write_bote', 'director_msg', 'feedback'];

const HREF: Partial<Record<StepId, string>> = {
  review_atlas: '/projet/demo-atlas/synthese',
  committee_msg: '/projet/demo-ceres/synthese',
  import_im: '/dossiers',
};

/** "À essayer" checklist of the public demo: steps for the role, each ticked from the deals or a signal. */
export function demoSteps(role: DemoRole, deals: DealRecord[], signals: ReadonlySet<DemoSignal>): DemoStep[] {
  const atlas = deals.find((r) => r.meta.id === 'demo-atlas')?.meta;
  const isDone: Record<StepId, () => boolean> = {
    review_atlas: () => !!atlas && (atlas.phase !== 'associate_review' || !!atlas.validatedAt),
    open_synthese: () => signals.has('synthese'),
    committee_msg: () => signals.has('msg:committee_note'),
    import_im: () => deals.some((r) => !DEMO_DEAL_IDS.includes(r.meta.id)),
    fill_missing: () => signals.has('edit'),
    write_bote: () => deals.some((r) => r.meta.phase === 'bote_written'),
    director_msg: () => signals.has('msg:director'),
    feedback: () => signals.has('feedback'),
  };
  return (role === 'analyst' ? ANALYST : ASSOCIATE).map((id) => ({ id, done: isDone[id](), href: HREF[id] ?? null }));
}
