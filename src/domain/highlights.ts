import type { Deal, Mandate } from '../engine/types';
import { base, comps, returns } from '../engine/finance';
import { screen } from '../engine/screen';
import { MKEY } from '../components/project/verdict';
import type { DealMeta } from './phases';
import { waitsFor } from './waits';

export type Highlight = { key: string; labelKey: string; value?: string; raw?: number; unit?: '%' | '×' | 'M€' };
export type Highlights = { positives: Highlight[]; negatives: Highlight[]; toExplore: Highlight[] };

/** Short card labels (French keys, translated in en.ts) per scorecard criterion. */
const CRIT_LABEL: Record<string, string> = {
  growth: 'Croissance',
  margin: 'Marge',
  recurring: 'Récurrence',
  churn: 'Churn',
  top10: 'Top 10 clients',
  leverage: 'Levier',
  price: 'Prix / médiane comparables',
};

/** Strengths, weaknesses and open points of a deal, from the scorecard, mandate, returns, comparables, questions and waits. */
export function dealHighlights(deal: Deal, meta: DealMeta, mandate: Mandate, now: Date): Highlights {
  const ret = returns(deal);
  const cp = comps(deal);
  const s = screen(deal, mandate, cp, ret);
  const positives: Highlight[] = [];
  const negatives: Highlight[] = [];
  const toExplore: Highlight[] = [];

  for (const c of s.crit) {
    const h: Highlight = { key: `crit:${c.k}`, labelKey: CRIT_LABEL[c.k] ?? c.label };
    if (c.v != null && Number.isFinite(c.v)) { h.raw = c.v; h.unit = c.unit === '%' ? '%' : '×'; }
    (c.pts === 2 ? positives : c.pts === 0 ? negatives : toExplore).push(h);
  }
  for (const m of s.mandate) {
    if (m.state === 'ko') negatives.unshift({ key: `mandate:${m.key}`, labelKey: MKEY[m.key] ?? m.key });
  }
  const irrPct = ret?.irr != null && Number.isFinite(ret.irr) ? ret.irr * 100 : null;
  if (irrPct != null) {
    (irrPct >= s.hurdle ? positives : negatives).unshift({ key: 'irr', labelKey: 'TRI au prix demandé', raw: irrPct, unit: '%' });
  }
  const askMult = base(deal).askEvEbitda;
  if (askMult != null && cp.evEbitda.q3 != null && askMult > cp.evEbitda.q3) {
    negatives.push({ key: 'priceQ3', labelKey: 'VE/EBITDA demandée au-dessus du 3e quartile', raw: askMult, unit: '×' });
  }

  const openQ = (deal.questions || []).filter((q) => q.priority === 'Décisive' && q.status !== 'Répondue').length;
  if (openQ) toExplore.push({ key: 'openQ', labelKey: 'Questions décisives ouvertes', raw: openQ });
  const waits = waitsFor(deal, meta, now);
  const overdue = waits.filter((w) => w.level === 'overdue').length;
  const late = waits.filter((w) => w.level === 'late').length;
  if (overdue) toExplore.push({ key: 'wait:overdue', labelKey: 'Attentes hors délai', raw: overdue });
  if (late) toExplore.push({ key: 'wait:late', labelKey: 'Attentes en retard', raw: late });

  return { positives, negatives, toExplore };
}
