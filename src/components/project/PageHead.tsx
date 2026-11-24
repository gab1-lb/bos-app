'use client';
import Link from 'next/link';
import { decisionLabel, phaseLabel } from '../../domain/phases';
import { useI18n } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';
import { useProject } from './ProjectContext';

export function PageHead() {
  const { deal: d, meta, members } = useProject();
  const { t, locale } = useI18n();
  const owner = members.find((m) => m.id === meta.ownerId);
  return (
    <>
      <div className="crumb">
        <Icon name="folder" /><Link href="/dossiers">{t('Mes dossiers')}</Link><Icon name="chev" /><strong>{d.name}</strong>
      </div>
      <div className="pagehead">
        <div>
          <div className="titleline">
            <h1>{d.name}</h1>
            {d.example && <span className="tag">{t('Dossier exemple')}</span>}
          </div>
          <div className="meta">
            <span><Icon name="building" />{d.sector || t('Secteur à préciser')}</span><i className="sep">·</i>
            <span><Icon name="pin" />{d.country || t('Pays à préciser')}</span><i className="sep">·</i>
            <span><Icon name="layers" /><span className={`tag ${meta.phase === 'decided' ? '' : 'amber'}`}>
              {phaseLabel(locale, meta.phase)}{meta.decision ? ` · ${decisionLabel(locale, meta.decision)}` : ''}
            </span></span>
            {owner && <><i className="sep">·</i><span><Icon name="user" />{t('Responsable')} : {owner.name}</span></>}
          </div>
        </div>
      </div>
    </>
  );
}
