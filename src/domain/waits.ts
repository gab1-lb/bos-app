import type { Deal, Recipient } from '../engine/types';
import type { DealMeta } from './phases';

export type Wait = {
  dealId: string;
  source: 'question' | 'phase';
  label: string;
  from: Recipient;
  since: string;
  days: number;
  level: 'ok' | 'late' | 'overdue';
  questionIndex?: number;
  questionId?: string;
};

const TZ = 'Europe/Paris';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function parisDayNumber(d: Date): number {
  const parts = fmt.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000;
}

/** Calendar days elapsed in Europe/Paris, never negative. */
export function daysSince(sinceIso: string, now: Date): number {
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) return 0;
  return Math.max(0, Math.round(parisDayNumber(now) - parisDayNumber(since)));
}

const levelOf = (days: number): Wait['level'] => (days > 14 ? 'overdue' : days > 7 ? 'late' : 'ok');

export function waitsFor(deal: Deal, meta: DealMeta, now: Date): Wait[] {
  const out: Wait[] = [];
  (Array.isArray(deal.questions) ? deal.questions : []).forEach((q, i) => {
    if (!q || !q.sentAt || q.answeredAt) return;
    const days = daysSince(q.sentAt, now);
    out.push({
      dealId: deal.id,
      source: 'question',
      label: q.q,
      // Default recipient when a sent question has no explicit awaitedFrom: the target's director.
      from: q.awaitedFrom ?? 'director',
      since: q.sentAt,
      days,
      level: levelOf(days),
      questionIndex: i,
      questionId: q.id,
    });
  });
  if (meta.phase === 'associate_review' && !meta.validatedAt) {
    const days = daysSince(meta.phaseEnteredAt, now);
    out.push({ dealId: deal.id, source: 'phase', label: 'Revue associate', from: 'associate', since: meta.phaseEnteredAt, days, level: levelOf(days) });
  }
  if (meta.phase === 'committee') {
    const days = daysSince(meta.phaseEnteredAt, now);
    out.push({ dealId: deal.id, source: 'phase', label: 'Présentation comité', from: 'committee', since: meta.phaseEnteredAt, days, level: levelOf(days) });
  }
  return out;
}
