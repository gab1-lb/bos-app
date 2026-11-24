import type { Deal, Mandate, Screen } from '../engine/types';
import { comps, returns } from '../engine/finance';
import { screen } from '../engine/screen';
import type { DealMeta } from './phases';
import { waitsFor, type Wait } from './waits';

export type HomeCard = {
  meta: DealMeta;
  name: string;
  screen: Screen;
  irr: number | null;
  waits: Wait[];
  coverage: { known: number; total: number };
  suggestion: string | null;
};

const count = (w: Wait[], level: Wait['level']) => w.filter((x) => x.level === level).length;

export function homeCards(
  items: { deal: Deal; meta: DealMeta }[],
  mandate: Mandate,
  now: Date,
  suggest: (meta: DealMeta, waits: Wait[]) => string | null,
): HomeCard[] {
  return items
    .filter(({ meta }) => meta.phase !== 'decided' && !meta.archived)
    .map(({ deal, meta }): HomeCard => {
      const ret = returns(deal);
      const s = screen(deal, mandate, comps(deal), ret);
      const waits = waitsFor(deal, meta, now);
      return {
        meta,
        name: deal.name,
        screen: s,
        irr: ret?.irr ?? null,
        waits,
        coverage: { known: s.crit.filter((c) => c.pts != null).length, total: s.crit.length },
        suggestion: suggest(meta, waits),
      };
    })
    .sort(
      (a, b) =>
        count(b.waits, 'overdue') - count(a.waits, 'overdue') ||
        count(b.waits, 'late') - count(a.waits, 'late') ||
        b.meta.updatedAt.localeCompare(a.meta.updatedAt),
    );
}

export function homeCounters(cards: HomeCard[], now: Date) {
  const limit = now.getTime() + 14 * 86400000;
  return {
    active: cards.length,
    toReview: cards.filter((c) => c.meta.phase === 'associate_review' && !c.meta.validatedAt).length,
    lateWaits: cards.reduce((n, c) => n + c.waits.filter((w) => w.level !== 'ok').length, 0),
    committeeSoon: cards.filter((c) => {
      if (!c.meta.committeeDate) return false;
      const t = new Date(c.meta.committeeDate).getTime();
      return t >= now.getTime() - 86400000 && t <= limit;
    }).length,
  };
}
