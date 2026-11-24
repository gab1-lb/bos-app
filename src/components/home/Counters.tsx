'use client';
import type { homeCounters } from '../../domain/home';
import { useI18n } from '../../lib/repo-context';
import { CountUp } from '../ui/CountUp';
import type { IconName } from '../ui/Icon';
import { Metric } from '../ui/Metric';

type Counts = ReturnType<typeof homeCounters>;

const ITEMS: [keyof Counts, string, IconName, string][] = [
  ['active', 'Deals en cours', 'folder', 'hors décidés et archivés'],
  ['toReview', 'BOTe à relire', 'file', 'rédigés ou en revue associate'],
  ['lateWaits', 'Attentes en retard', 'clock', 'sans réponse depuis plus de 7 jours'],
  ['committeeSoon', 'Comités sous 14 jours', 'cal', 'décisions comité à venir'],
];

/** Les 4 compteurs en tête de l'accueil. */
export function Counters({ counts }: { counts: Counts }) {
  const { t } = useI18n();
  return (
    <div className="g4 counters">
      {ITEMS.map(([k, label, icon, foot]) => (
        <div key={k} data-counter={k} className={k === 'lateWaits' && counts[k] > 0 ? 'alert' : ''}>
          <Metric label={t(label)} icon={icon} naLabel="—" foot={t(foot)}
            value={<CountUp value={counts[k]} format={(n) => String(Math.round(n))} />} />
        </div>
      ))}
    </div>
  );
}
