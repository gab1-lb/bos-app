/* Shape of a stored deal: defaults for missing sections, arrays where arrays are expected, and a stable id on
   every list item (questions, QoE adjustments, comparables). Rows are written by id, never by position, so two
   people editing the same list cannot overwrite or misdirect each other's changes. */
import type { Deal } from '../engine/types';
import { blankDeal } from '../engine/samples';

export const LISTS = ['questions', 'adjustments', 'comps'] as const;
export type ListName = (typeof LISTS)[number];
export type ListItem<L extends ListName = ListName> = Deal[L][number];

/** Random item id, generated client-side (crypto.randomUUID when available). */
export function newItemId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);

/**
 * Deal with every section present and typed as expected, and a unique id on every list item.
 * `idsAdded` lists the arrays whose ids were generated here: they are not stored yet, and the caller
 * (the project page) saves them once so later writes by id find them.
 */
export function normalizeDeal(raw: unknown): { deal: Deal; idsAdded: ListName[] } {
  const d = isObj(raw) ? raw : {};
  const b = blankDeal();
  const o = (k: keyof Deal) => (isObj(d[k]) ? (d[k] as Record<string, unknown>) : {});
  const deal = {
    ...b, ...d,
    hist: { ...b.hist, ...o('hist') }, kpi: { ...b.kpi, ...o('kpi') }, bs: { ...b.bs, ...o('bs') },
    plan: { ...b.plan, ...o('plan') }, dcf: { ...b.dcf, ...o('dcf') },
    synergies: { ...b.synergies, ...o('synergies') }, financing: { ...b.financing, ...o('financing') },
    refs: { ...o('refs') },
  } as Deal;
  deal.id = typeof d.id === 'string' && d.id ? d.id : b.id;
  deal.hist.years = arr(deal.hist.years, b.hist.years);
  for (const k of ['rev', 'ebitda', 'capex'] as const) deal.hist[k] = arr(deal.hist[k], deal.hist.years.map(() => null));
  deal.plan.growth = arr(deal.plan.growth, b.plan.growth);

  const idsAdded: ListName[] = [];
  for (const list of LISTS) {
    const seen = new Set<string>();
    let added = false;
    const items = arr<unknown>(d[list], []).filter(isObj).map((it) => {
      const item = { ...it };
      if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) {
        item.id = newItemId();
        added = true;
      }
      seen.add(item.id as string);
      if (list === 'questions') {
        item.awaitedFrom = item.awaitedFrom ?? null;
        item.sentAt = item.sentAt ?? null;
        item.answeredAt = item.answeredAt ?? null;
      }
      return item;
    });
    (deal as unknown as Record<string, unknown>)[list] = items;
    if (added) idsAdded.push(list);
  }
  return { deal, idsAdded };
}
