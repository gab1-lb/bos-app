import type { Deal, Mandate, Screen } from '../engine/types';
import { comps, returns } from '../engine/finance';
import { screen } from '../engine/screen';
import type { DealMeta } from './phases';
import { parisDayNumber, waitsFor, type Wait } from './waits';
import { t, type Locale } from '../i18n/format';

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
  const card = (deal: Deal, meta: DealMeta): HomeCard => {
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
  };
  return items
    .filter(({ meta }) => meta.phase !== 'decided' && !meta.archived)
    .flatMap(({ deal, meta }): HomeCard[] => {
      // One malformed deal must not take the whole board down for everyone: it is left out
      // (it stays reachable from Mes dossiers).
      try {
        return [card(deal, meta)];
      } catch {
        return [];
      }
    })
    .sort(
      (a, b) =>
        count(b.waits, 'overdue') - count(a.waits, 'overdue') ||
        count(b.waits, 'late') - count(a.waits, 'late') ||
        Date.parse(b.meta.updatedAt) - Date.parse(a.meta.updatedAt),
    );
}

export function homeCounters(cards: HomeCard[], now: Date) {
  return {
    active: cards.length,
    // "BOTe à relire": written but not yet reviewed, or in associate review awaiting validation.
    toReview: cards.filter(
      (c) => c.meta.phase === 'bote_written' || (c.meta.phase === 'associate_review' && !c.meta.validatedAt),
    ).length,
    lateWaits: cards.reduce((n, c) => n + c.waits.filter((w) => w.level !== 'ok').length, 0),
    committeeSoon: cards.filter((c) => {
      if (!c.meta.committeeDate) return false;
      const days = parisDayNumber(new Date(c.meta.committeeDate)) - parisDayNumber(now);
      return days >= 0 && days <= 14;
    }).length,
  };
}

/** « il y a 2 h » : à l'instant, minutes, heures (même jour à Paris), hier, puis jours calendaires. */
export function relativeTime(locale: Locale, iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const mins = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (mins < 1) return t(locale, 'à l’instant');
  if (mins < 60) return t(locale, 'il y a {0} min', mins);
  const days = parisDayNumber(now) - parisDayNumber(at);
  if (days <= 0) return t(locale, 'il y a {0} h', Math.floor(mins / 60));
  if (days === 1) return t(locale, 'hier');
  return t(locale, 'il y a {0} j', days);
}
