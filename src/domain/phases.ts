import { t, type Locale } from '../i18n/format';
import type { Screen } from '../engine/types';

export type Phase = 'im_received' | 'analysis' | 'bote_written' | 'associate_review' | 'committee' | 'decided';
export type Decision = 'go_dd' | 'indicative_offer' | 'no_go';

export const PHASES: Phase[] = ['im_received', 'analysis', 'bote_written', 'associate_review', 'committee', 'decided'];

const PHASE_FR: Record<Phase, string> = {
  im_received: 'IM reçu',
  analysis: 'Analyse en cours',
  bote_written: 'BOTe rédigé',
  associate_review: 'Revue associate',
  committee: 'Présentation comité',
  decided: 'Décision',
};
const DECISION_FR: Record<Decision, string> = {
  go_dd: 'Go DD',
  indicative_offer: 'Offre indicative',
  no_go: 'No-go',
};

export const phaseLabel = (locale: Locale, p: Phase): string => t(locale, PHASE_FR[p]);
export const decisionLabel = (locale: Locale, d: Decision): string => t(locale, DECISION_FR[d]);

export type DealMeta = {
  id: string;
  ownerId: string;
  contributorIds: string[];
  phase: Phase;
  phaseEnteredAt: string;
  decision: Decision | null;
  decidedAt: string | null;
  committeeDate: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  archived: boolean;
  updatedAt: string;
  updatedBy: string;
};

/** analysis -> bote_written once coverage >= 70 % and a price exists (screen did not stop on missing price). */
export function suggestNextPhase(meta: DealMeta, s: Screen): Phase | null {
  if (meta.phase === 'analysis' && s.coverage >= 0.7 && s.sub !== 'price') return 'bote_written';
  return null;
}
