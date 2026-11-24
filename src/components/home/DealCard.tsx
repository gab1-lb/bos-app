'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import type { Deal } from '../../engine/types';
import type { HomeCard } from '../../domain/home';
import { relativeTime } from '../../domain/home';
import type { Member } from '../../domain/permissions';
import { phaseLabel } from '../../domain/phases';
import { recipientLabel } from '../../domain/recipients';
import type { TemplateKey } from '../../domain/templates';
import { useI18n } from '../../lib/repo-context';
import { CCLS, TAG } from '../project/Synthese';
import { Avatar } from '../ui/Avatar';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';

/** Bouton de la prochaine action, par modèle suggéré. */
const ACTION: Record<TemplateKey, string> = {
  info_request: 'Envoyer les questions',
  reminder: 'Relancer',
  bote_review: 'Envoyer le BOTe pour revue',
  committee_note: 'Préparer la note au comité',
  no_go: 'Rédiger le no-go',
  go_dd: 'Lancer la due diligence',
};

type Props = {
  card: HomeCard;
  deal: Deal;
  members: Member[];
  now: Date;
  onMessage(key: TemplateKey | null): void;
};

export function DealCard({ card, deal, members, now, onMessage }: Props) {
  const f = useI18n();
  const { t, locale, pc } = f;
  const [open, setOpen] = useState(true);
  const uid = useId();
  const { meta, screen: sc, waits, coverage, irr } = card;
  const member = (id: string) => members.find((m) => m.id === id) ?? null;
  const owner = member(meta.ownerId);
  const contributors = meta.contributorIds.filter((id) => id !== meta.ownerId).map((id) => member(id) ?? { name: '?', avatarUrl: null });
  const editor = member(meta.updatedBy);
  const name = card.name || t('Sans nom');
  const href = `/projet/${encodeURIComponent(meta.id)}/synthese`;
  const late = waits.filter((w) => w.level === 'late').length;
  const overdue = waits.filter((w) => w.level === 'overdue').length;
  const missing = coverage.total - coverage.known;
  const unsent = deal.questions.filter((q) => q.status !== 'Répondue' && !q.sentAt).length;
  const oldest = waits.filter((w) => w.source === 'question').sort((a, b) => b.days - a.days)[0];
  const key = card.suggestion as TemplateKey | null;
  const hint = key === 'reminder' && oldest ? t('{0} sans réponse depuis {1} j', recipientLabel(locale, oldest.from), oldest.days)
    : key === 'info_request' ? (unsent > 1 ? t('{0} questions pas encore envoyées', unsent) : t('Une question pas encore envoyée'))
    : key === 'bote_review' ? t('BOTe rédigé, à transmettre à l’associate')
    : key === 'committee_note' ? t('BOTe validé, note à préparer pour le comité')
    : key === 'no_go' ? t('Décision à communiquer au banquier conseil')
    : key === 'go_dd' ? t('Sujets de due diligence à lister')
    : t('Aucune action suggérée pour l’instant');
  const irrOk = irr != null && Number.isFinite(irr) ? irr * 100 >= sc.hurdle : null;

  return (
    <article className="card hcard" data-deal-card={meta.id}>
      <div className="hc-head">
        <button type="button" className="toggle" aria-expanded={open} aria-controls={`${uid}-p`}
          aria-label={t(open ? 'Replier {0}' : 'Déplier {0}', name)} onClick={() => setOpen((o) => !o)}>
          <Icon name="chev" />
        </button>
        <Link className="hc-name" href={href}>{name}</Link>
        {(deal.sector || deal.country) && <span className="hc-sub">{[deal.sector, deal.country].filter(Boolean).join(' · ')}</span>}
        <span className="hc-flags">
          {overdue > 0 && <Chip tone="bad">{t(overdue > 1 ? '{0} attentes hors délai' : '{0} attente hors délai', overdue)}</Chip>}
          {late > 0 && <Chip tone="orange">{t(late > 1 ? '{0} attentes en retard' : '{0} attente en retard', late)}</Chip>}
          {!open && <Chip>{phaseLabel(locale, meta.phase)}</Chip>}
        </span>
      </div>
      <ul className="hc-props" id={`${uid}-p`} hidden={!open}>
        <li>
          <span className="hc-k"><Icon name="users" />{t('Phase et équipe')}</span>
          <span className="hc-v">
            <Chip>{phaseLabel(locale, meta.phase)}</Chip>
            <span className="person"><Avatar member={owner} name={t('Membre inconnu')} size="sm" decorative />{owner?.name ?? t('Membre inconnu')}<small>{t('responsable')}</small></span>
            {contributors.length > 0 && (
              <span className="person">
                <span className="people">{contributors.map((m, i) => <Avatar key={i} member={m} size="sm" />)}</span>
                <small>{t(contributors.length > 1 ? '{0} contributeurs' : '{0} contributeur', contributors.length)}</small>
              </span>
            )}
          </span>
        </li>
        <li>
          <span className="hc-k"><Icon name="clock" />{t('À jour')}</span>
          <span className="hc-v">
            <span>{t('mis à jour par {0} {1}', editor?.name ?? t('Membre inconnu'), relativeTime(locale, meta.updatedAt, now))}</span>
            <span className="cov" title={t('Couverture de la grille')}>
              <span className="progress"><i style={{ width: `${coverage.total ? Math.round((100 * coverage.known) / coverage.total) : 0}%` }} /></span>
              <span className="num">{t('{0} / {1} indicateurs', coverage.known, coverage.total)}</span>
              {missing > 0 && <span className="dim">· {t(missing > 1 ? '{0} manquants' : '{0} manquant', missing)}</span>}
            </span>
          </span>
        </li>
        <li>
          <span className="hc-k"><Icon name="inbox" />{t('En attente')}</span>
          <span className="hc-v">
            {waits.length === 0 ? <span className="dim">{t('Rien en attente')}</span> : (
              <ul className="waits">
                {waits.map((w, i) => (
                  <li key={i} data-wait data-level={w.level}>
                    <i className={`wdot ${w.level}`} aria-hidden="true" />
                    <span className="wl" title={w.label}>{w.source === 'phase' ? t(w.label) : w.label}</span>
                    <Chip tone="plain">{recipientLabel(locale, w.from)}</Chip>
                    <span className={`wd ${w.level}`} title={w.level === 'overdue' ? t('Plus de 14 jours') : w.level === 'late' ? t('Plus de 7 jours') : undefined}>
                      {t('{0} j', w.days)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </span>
        </li>
        <li>
          <span className="hc-k"><Icon name="send" />{t('Prochaine action')}</span>
          <span className="hc-v">
            <span>{hint}</span>
            {key
              ? <button type="button" className="btn sm primary" onClick={() => onMessage(key)}><Icon name="mail" />{t(ACTION[key])}</button>
              : <button type="button" className="btn sm" onClick={() => onMessage(null)}><Icon name="mail" />{t('Rédiger un message')}</button>}
          </span>
        </li>
        <li>
          <span className="hc-k"><Icon name="target" />{t('Avis')}</span>
          <span className="hc-v">
            <Chip tone={CCLS[sc.code]}>{t(TAG[sc.code])}</Chip>
            <span>
              {t('TRI au prix demandé')}{' '}
              <b className={irrOk == null ? 'dim' : irrOk ? 'up' : 'down'}>{irr != null && Number.isFinite(irr) ? pc(irr * 100) : t('à obtenir')}</b>
            </span>
            {sc.score != null && <span className="dim">· {t('Note')} {Math.round(sc.score)} / 100{sc.provisional ? ' · ' + t('provisoire') : ''}</span>}
          </span>
        </li>
      </ul>
    </article>
  );
}
