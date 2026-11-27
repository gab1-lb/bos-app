import type { Locale } from '../../i18n/format';
import type { DemoRole } from '../session';
import { isDemo } from '../mode';
import { useSyncExternalStore } from 'react';

/* Demo only: the "Donner mon avis" answers, as text to copy or a mailto: to the founder. No server. */
export type Feedback = {
  usefulness: 1 | 2 | 3 | 4 | 5 | null;
  missing: string;
  wouldUse: 'yes' | 'maybe' | 'no' | null;
  comment: string;
  role: DemoRole;
};

const L = {
  fr: {
    subject: 'Avis sur BOS (démo)', role: 'Profil testé', q1: 'Utilité dans mon process M&A', q2: 'Ce qui manque le plus',
    q3: 'L’utiliserais-je sur un vrai dossier', q4: 'Commentaire',
    roles: { associate: 'Associé', analyst: 'Analyste', admin: 'Administrateur' },
    use: { yes: 'Oui', maybe: 'Peut-être', no: 'Non' },
  },
  en: {
    subject: 'BOS feedback (demo)', role: 'Role tested', q1: 'Usefulness in my M&A process', q2: 'What is missing most',
    q3: 'Would I use it on a real deal', q4: 'Comment',
    roles: { associate: 'Associate', analyst: 'Analyst', admin: 'Administrator' },
    use: { yes: 'Yes', maybe: 'Maybe', no: 'No' },
  },
} as const;

export function feedbackText(f: Feedback, locale: Locale): string {
  const l = L[locale];
  const free = (s: string) => s.trim() || '—';
  return [
    `${l.role} : ${l.roles[f.role]}`,
    `${l.q1} : ${f.usefulness ? `${f.usefulness} / 5` : '—'}`,
    `${l.q2} : ${free(f.missing)}`,
    `${l.q3} : ${f.wouldUse ? l.use[f.wouldUse] : '—'}`,
    `${l.q4} : ${free(f.comment)}`,
  ].join('\n');
}

export function feedbackMailto(f: Feedback, to: string, locale: Locale): string {
  return `mailto:${to}?subject=${encodeURIComponent(L[locale].subject)}&body=${encodeURIComponent(feedbackText(f, locale).replace(/\n/g, '\r\n'))}`;
}

/** The founder's address, base64-encoded at build time (never written in the repo). Null when absent or invalid. */
export function feedbackEmail(): string | null {
  const b64 = process.env.NEXT_PUBLIC_FEEDBACK_B64;
  if (!b64) return null;
  try {
    const s = atob(b64).trim();
    return s.includes('@') ? s : null;
  } catch { return null; }
}

/** Which actions the dialog offers: the mail link only when an address is configured. */
export const feedbackActions = (email: string | null): ('mail' | 'copy')[] => (email ? ['mail', 'copy'] : ['copy']);

/* Draft kept while the dialog is closed by accident; cleared once sent/copied (module state: a reload drops it). */
export type FeedbackDraft = Omit<Feedback, 'role'>;
export const EMPTY_DRAFT: FeedbackDraft = { usefulness: null, missing: '', wouldUse: null, comment: '' };
let draft: FeedbackDraft = EMPTY_DRAFT;
export const getFeedbackDraft = (): FeedbackDraft => draft;
export const setFeedbackDraft = (d: FeedbackDraft): void => { draft = d; };
export const clearFeedbackDraft = (): void => { draft = EMPTY_DRAFT; };

/* Open/close state shared by the demo bar and the checklist (module state, like the other demo stores). */
let open = false;
const listeners = new Set<() => void>();
export function setFeedbackOpen(v: boolean): void {
  if (!isDemo() || open === v) return;
  open = v;
  listeners.forEach((l) => l());
}
export function useFeedbackOpen(): boolean {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => open, () => false);
}
