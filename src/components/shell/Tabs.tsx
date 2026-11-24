'use client';
import Link from 'next/link';
import { useI18n } from '../../lib/repo-context';
import { Icon, type IconName } from '../ui/Icon';

export const TABS = ['synthese', 'financiers', 'valorisation', 'rendement', 'demandes', 'activite'] as const;
export type TabKey = (typeof TABS)[number];

const DEF: Record<TabKey, [string, IconName]> = {
  synthese: ['Synthèse', 'grid'],
  financiers: ['Données financières', 'chart'],
  valorisation: ['Valorisation', 'coins'],
  rendement: ['Rendement & LBO', 'activity'],
  demandes: ['Demandes d’infos', 'inbox'],
  activite: ['Activité', 'clock'],
};

export function tabLabel(t: (k: string) => string, locale: string, k: TabKey): string {
  // « Activité » sert déjà de libellé « Business description » (fiche) : traduction propre à l'onglet.
  if (k === 'activite') return locale === 'en' ? 'Activity' : 'Activité';
  return t(DEF[k][0]);
}

export function Tabs({ dealId, current, openCount }: { dealId: string; current: string; openCount: number }) {
  const { t, locale } = useI18n();
  return (
    <nav className="tabs" aria-label={t('Sections')}>
      {TABS.map((k) => (
        <Link key={k} href={`/projet/${encodeURIComponent(dealId)}/${k}`} className={current === k ? 'on' : ''} aria-current={current === k ? 'page' : undefined}>
          <Icon name={DEF[k][1]} />
          {tabLabel(t, locale, k)}
          {k === 'demandes' && openCount > 0 && <span className="count">{openCount}</span>}
        </Link>
      ))}
    </nav>
  );
}
