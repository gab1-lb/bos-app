/* Mes dossiers : lignes du tableau (indicateurs, avis) et filtres. */
import { base, comps, returns } from '../engine/finance';
import { screen } from '../engine/screen';
import type { Base, Deal, Mandate, Screen } from '../engine/types';
import type { DealMeta, Phase } from './phases';

export type DealRow = { deal: Deal; meta: DealMeta; b: Base; irr: number | null; sc: Screen };

export type StatusFilter = 'current' | 'active' | 'decided' | 'archived' | 'all';
export type Verdict = Screen['code'];
export type Filters = { status: StatusFilter; phase: Phase | ''; owner: string; verdict: Verdict | '' };
export const NO_FILTERS: Filters = { status: 'current', phase: '', owner: '', verdict: '' };

export function dealRows(items: { deal: Deal; meta: DealMeta }[], mandate: Mandate): DealRow[] {
  return items.map(({ deal, meta }) => {
    const ret = returns(deal);
    return { deal, meta, b: base(deal), irr: ret?.irr ?? null, sc: screen(deal, mandate, comps(deal), ret) };
  });
}

const statusOk = (s: StatusFilter, m: DealMeta): boolean => {
  switch (s) {
    case 'current': return !m.archived;
    case 'active': return !m.archived && m.phase !== 'decided';
    case 'decided': return !m.archived && m.phase === 'decided';
    case 'archived': return m.archived;
    case 'all': return true;
  }
};

export function filterRows(rows: DealRow[], f: Filters): DealRow[] {
  return rows.filter((r) => statusOk(f.status, r.meta)
    && (!f.phase || r.meta.phase === f.phase)
    && (!f.owner || r.meta.ownerId === f.owner)
    && (!f.verdict || r.sc.code === f.verdict));
}

/** Compteurs en tête de Mes dossiers (hors archivés). */
export function dossierStats(rows: DealRow[]) {
  const live = rows.filter((r) => !r.meta.archived);
  const n = (k: Verdict) => live.filter((r) => r.sc.code === k).length;
  return {
    active: live.filter((r) => r.meta.phase !== 'decided').length,
    go: n('go'),
    toWork: n('nego') + n('wait'),
    openDecisive: live.reduce((s, r) => s + (r.deal.questions || []).filter((q) => q.priority === 'Décisive' && q.status !== 'Répondue').length, 0),
  };
}
