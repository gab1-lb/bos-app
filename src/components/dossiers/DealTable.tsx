'use client';
import Link from 'next/link';
import { useState } from 'react';
import { relativeTime } from '../../domain/home';
import type { DealRow } from '../../domain/dossiers';
import { can, type Member } from '../../domain/permissions';
import { decisionLabel, phaseLabel, type Decision } from '../../domain/phases';
import { useI18n } from '../../lib/repo-context';
import { CCLS, TAG } from '../project/verdict';
import { Avatar } from '../ui/Avatar';
import { Chip, type Tone } from '../ui/Chip';
import { Icon } from '../ui/Icon';

const COLS = 10;
const DECISION_TONE: Record<Decision, Tone> = { go_dd: 'good', indicative_offer: 'amber', no_go: 'bad' };

type Props = {
  rows: DealRow[];
  members: Member[];
  me: Member | null;
  now: Date;
  busy: string | null;
  onDuplicate(r: DealRow): void;
  onArchive(r: DealRow, v: boolean): void;
  onDelete(r: DealRow): void;
};

/** Tableau de Mes dossiers : indicateurs, avis, phase ou décision, actions selon les droits (suppression confirmée dans la page). */
export function DealTable({ rows, members, me, now, busy, onDuplicate, onArchive, onDelete }: Props) {
  const { t, locale, meur, pc, mx } = useI18n();
  const [confirm, setConfirm] = useState<string | null>(null);
  const dateLoc = locale === 'en' ? 'en-GB' : 'fr-FR';
  const member = (id: string) => members.find((m) => m.id === id) ?? null;

  return (
    <div className="tw">
      <table className="dealtable">
        <thead>
          <tr>
            <th>{t('Dossier')}</th><th>{t('Phase')}</th><th>{t('Responsable')}</th>
            <th className="n">{t('CA')}</th><th className="n">{t('Marge')}</th><th className="n">{t('VE demandée')}</th>
            <th className="n">{t('VE / EBITDA')}</th><th className="n">{t('TRI au prix')}</th><th>{t('Avis')}</th>
            <th><span className="sr-only">{t('Actions')}</span></th>
          </tr>
        </thead>
        {rows.map((r) => {
            const { deal: d, meta, b, sc, irr } = r;
            const name = d.name || t('Sans nom');
            const owner = member(meta.ownerId);
            const canDup = !!me && can(me, 'create');
            const canArch = !!me && can(me, 'archive', meta);
            const canDel = !!me && can(me, 'delete', meta);
            const asking = confirm === meta.id;
            const off = busy === meta.id;
            return (
              <tbody key={meta.id} data-deal-row={meta.id} className={`${meta.archived ? 'archived' : ''} ${asking ? 'asking' : ''}`}>
              <tr>
                <td>
                  <Link className="pipe-name" href={`/projet/${encodeURIComponent(meta.id)}/synthese`}>{name}</Link>
                  {d.example && <span className="tag xs">{t('Exemple')}</span>}
                  {meta.archived && <span className="tag xs">{t('Archivé')}</span>}
                  <span className="mini">{[d.sector, d.country].filter(Boolean).join(' · ') || t('Fiche à compléter')}</span>
                </td>
                <td>
                  {meta.decision ? (
                    <span className="stagecell">
                      <Chip tone={DECISION_TONE[meta.decision]}>{decisionLabel(locale, meta.decision)}</Chip>
                      {meta.decidedAt && <span className="mini">{t('décidé le {0}', new Date(meta.decidedAt).toLocaleDateString(dateLoc, { timeZone: 'Europe/Paris' }))}</span>}
                    </span>
                  ) : <Chip tone="plain">{phaseLabel(locale, meta.phase)}</Chip>}
                </td>
                <td>
                  <span className="person"><Avatar member={owner} name={t('Membre inconnu')} size="sm" decorative />{owner?.name ?? t('Membre inconnu')}</span>
                  <span className="mini">{t('mis à jour {0}', relativeTime(locale, meta.updatedAt, now))}</span>
                </td>
                <td className="n">{meur(b.rev as number)}</td>
                <td className="n">{pc(b.margin as number)}</td>
                <td className="n">{meur(b.ask as number)}</td>
                <td className="n">{mx(b.askEvEbitda as number)}</td>
                <td className="n">
                  {irr != null && Number.isFinite(irr)
                    ? <span className={irr * 100 >= sc.hurdle ? 'up' : 'down'}>{pc(irr * 100)}</span>
                    : <span className="dim">—</span>}
                </td>
                <td><Chip tone={CCLS[sc.code]}>{t(TAG[sc.code])}</Chip></td>
                <td className="n">
                  {!asking && (
                    <span className="rowacts">
                      {canDup && (
                        <button type="button" className="iconbtn" disabled={off} title={t('Dupliquer')} aria-label={t('Dupliquer {0}', name)}
                          onClick={() => onDuplicate(r)}><Icon name="copy" /></button>
                      )}
                      {canArch && (
                        <button type="button" className="iconbtn" disabled={off}
                          title={t(meta.archived ? 'Désarchiver' : 'Archiver')} aria-label={t(meta.archived ? 'Désarchiver {0}' : 'Archiver {0}', name)}
                          onClick={() => onArchive(r, !meta.archived)}><Icon name={meta.archived ? 'repeat' : 'inbox'} /></button>
                      )}
                      {canDel && (
                        <button type="button" className="iconbtn del" disabled={off} title={t('Supprimer')} aria-label={t('Supprimer {0}', name)}
                          onClick={() => setConfirm(meta.id)}><Icon name="x" /></button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
              {asking && (
                <tr className="confirmrow">
                  <td colSpan={COLS}>
                    <span className="confirm" role="group" aria-label={t('Confirmation de suppression')}>
                      <Icon name="info" />
                      <span>{t('Supprimer définitivement ?')} <span className="dim">{t('Le dossier sera effacé pour toute l’équipe. Cette action est irréversible.')}</span></span>
                      <button type="button" className="btn sm danger" aria-label={t('Confirmer la suppression')} disabled={off}
                        onClick={() => { setConfirm(null); onDelete(r); }}>{t('Confirmer')}</button>
                      <button type="button" className="btn sm" autoFocus onClick={() => setConfirm(null)}>{t('Annuler')}</button>
                    </span>
                  </td>
                </tr>
              )}
              </tbody>
            );
          })}
      </table>
    </div>
  );
}
