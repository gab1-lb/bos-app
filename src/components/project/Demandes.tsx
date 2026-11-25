'use client';
import type { Question, Recipient } from '../../engine/types';
import { can } from '../../domain/permissions';
import { PHASES, decisionLabel, phaseLabel, type Decision } from '../../domain/phases';
import { RECIPIENTS, recipientLabel } from '../../domain/recipients';
import { waitsFor } from '../../domain/waits';
import { useI18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Check, DateInput, Field, Select, TextInput } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { newItemId } from '../../domain/dealShape';
import { missingQuestions, withAnswered, withSent } from './compute';
import { useBind, useBindItem, useProject } from './ProjectContext';

const CATS = ['Financier', 'Commercial', 'Produit', 'Juridique', 'RH', 'Fiscal', 'IT'];
const PRIOS = ['Décisive', 'Importante', 'Normale'];
const STATUSES = ['Ouverte', 'Envoyée', 'Répondue'];
const DECISIONS: Decision[] = ['go_dd', 'indicative_offer', 'no_go'];

const newQuestion = (q: string, cat = 'Financier', priority = 'Importante'): Question => ({
  id: newItemId(), q, cat, priority, status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null,
});

export function Demandes() {
  const { deal: d, meta, c, me, members, editable, act, appendItems, removeItem, updateItem } = useProject();
  const bind = useBind();
  const bindQ = useBindItem();
  const { t, locale } = useI18n();
  const qs = d.questions || [];
  const missing = missingQuestions(d, c.b, t);
  const waits = waitsFor(d, meta, new Date());
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'Europe/Paris' }) : '');
  const validator = members.find((m) => m.id === meta.validatedBy);
  const canDecide = !!me && can(me, 'decide', meta);
  const canValidate = !!me && meta.phase === 'associate_review' && !meta.validatedAt && can(me, 'validateBote', meta);
  const committee = bind(['committeeDate'], t('Date de comité'));
  const senior = me?.role === 'admin' || me?.role === 'associate';
  const canOwner = !!me && can(me, 'setOwner', meta);
  const owner = members.find((m) => m.id === meta.ownerId);
  const active = members.filter((m) => m.status === 'active' && m.role);
  const ownerOptions = active.filter((m) => m.role !== 'reader');
  const contributorOptions = active.filter((m) => m.id !== meta.ownerId);

  const lateness = (q: Question) => {
    if (q.answeredAt) return <Chip tone="good">{t('Répondue le {0}', day(q.answeredAt))}</Chip>;
    const w = waits.find((x) => x.source === 'question' && x.questionId === q.id);
    if (!w) return <span className="dim">—</span>;
    if (w.level === 'ok') return <Chip>{t('{0} j d’attente', w.days)}</Chip>;
    return <Chip tone={w.level === 'late' ? 'amber' : 'bad'}>{t('{0} j de retard', w.days)}</Chip>;
  };
  // Only the date and the status it implies are written, never the whole question.
  const setSent = (q: Question, v: string | null) => {
    updateItem('questions', q.id, { sentAt: v, status: withSent(q, v).status });
  };
  const setAnswered = (q: Question, v: string | null) => {
    updateItem('questions', q.id, { answeredAt: v, status: withAnswered(q, v).status });
  };

  return (
    <>
      <Reveal index={0}>
        <Card title={t('Suivi du dossier')} icon="flag" sub={phaseLabel(locale, meta.phase)}>
          <div className="steps" role="group" aria-label={t('Phase')}>
            {PHASES.filter((p) => p !== 'decided').map((p, i) => {
              const cur = PHASES.indexOf(meta.phase);
              const allowed = !!me && p !== meta.phase && can(me, `setPhase:${p}`, meta);
              return (
                <button key={p} type="button" className={`step ${p === meta.phase ? 'on' : i < cur ? 'done' : ''}`} disabled={!allowed}
                  aria-current={p === meta.phase ? 'step' : undefined} onClick={() => act((r, id) => r.setPhase(id, p))}>
                  <i>{i + 1}</i>{phaseLabel(locale, p)}
                </button>
              );
            })}
            <span className={`step ${meta.phase === 'decided' ? 'on' : ''}`}>
              <i>6</i>{phaseLabel(locale, 'decided')}{meta.decision ? ` · ${decisionLabel(locale, meta.decision)}` : ''}
            </span>
          </div>
          <div className="g2e" style={{ marginTop: 18 }}>
            <div className="kv">
              <span>{t('Validation du BOTe')}</span>
              <span>
                {meta.validatedAt
                  ? <Chip tone="good">{t('Validé par {0} le {1}', validator?.name ?? '—', day(meta.validatedAt))}</Chip>
                  : canValidate
                    ? <button type="button" className="btn sm primary" onClick={() => act((r, id) => r.validateBote(id))}>{t('Valider le BOTe')}</button>
                    : <span className="dim">{t('Non validé')}</span>}
              </span>
              <span>{t('Décision')}</span>
              <span className="actions" style={{ gap: 6 }}>
                {canDecide
                  ? DECISIONS.map((x) => (
                    <button key={x} type="button" className={`btn sm ${meta.decision === x ? 'primary' : ''} ${x === 'no_go' ? 'danger' : ''}`}
                      aria-pressed={meta.decision === x} onClick={() => act((r, id) => r.decide(id, x))}>
                      {decisionLabel(locale, x)}
                    </button>
                  ))
                  : meta.decision ? <Chip>{decisionLabel(locale, meta.decision)}</Chip> : <span className="dim">{t('En attente')}</span>}
                {meta.decidedAt && <span className="mini">{t('le {0}', day(meta.decidedAt))}</span>}
              </span>
            </div>
            <Field label={t('Date de comité')} htmlFor={committee.id}>
              <DateInput id={committee.id} label={committee.label} readOnly={!editable} value={meta.committeeDate}
                onCommit={(v) => act((r, id) => r.setCommitteeDate(id, v))} />
            </Field>
          </div>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card className="mt" title={t('Demandes d’informations au vendeur')} icon="inbox"
          right={editable ? <button type="button" className="btn sm" onClick={() => appendItems('questions', [newQuestion('')])}><Icon name="plus" />{t('Ajouter')}</button> : null}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>{t('Question')}</th><th>{t('Thème')}</th><th>{t('Priorité')}</th><th>{t('Statut')}</th>
                  <th>{t('Destinataire')}</th><th>{t('Envoyée le')}</th><th>{t('Répondue le')}</th><th>{t('Attente')}</th><th />
                </tr>
              </thead>
              <tbody>
                {qs.length ? qs.map((q, i) => {
                  const f = (field: string, label: string) => bindQ('questions', i, q.id, field, label);
                  const sent = f('sentAt', t('Envoyée le'));
                  const ans = f('answeredAt', t('Répondue le'));
                  return (
                    <tr key={q.id} data-question={q.id}>
                      <td className="wrapc">
                        <TextInput {...f('q', t('Question'))} value={q.q} />
                        <div style={{ marginTop: 6 }}><TextInput {...f('answer', t('Réponse'))} value={q.answer} placeholder={t('Réponse du vendeur')} /></div>
                      </td>
                      <td><Select {...f('cat', t('Thème'))} value={q.cat} options={CATS.map((x) => [x, t(x)])} /></td>
                      <td><Select {...f('priority', t('Priorité'))} value={q.priority} options={PRIOS.map((x) => [x, t(x)])} /></td>
                      <td><Select {...f('status', t('Statut'))} value={q.status} options={STATUSES.map((x) => [x, t(x)])} /></td>
                      <td>
                        <Select<Recipient> {...f('awaitedFrom', t('Destinataire'))} value={q.awaitedFrom ?? null}
                          options={[['', '—'], ...RECIPIENTS.map((r): [Recipient, string] => [r, recipientLabel(locale, r)])]} />
                      </td>
                      <td><DateInput {...sent} value={q.sentAt} onCommit={(v) => setSent(q, v)} /></td>
                      <td><DateInput {...ans} value={q.answeredAt} onCommit={(v) => setAnswered(q, v)} /></td>
                      <td>{lateness(q)}</td>
                      <td>{editable && <button type="button" className="iconbtn" aria-label={t('Supprimer')} onClick={() => removeItem('questions', q.id)}><Icon name="x" /></button>}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={9} className="empty">{t('Aucune question.')}</td></tr>}
              </tbody>
            </table>
          </div>
          {missing.length > 0 && (
            <div className="ask" style={{ marginTop: 8 }}>
              <span className="askicon"><Icon name="info" /></span>
              <div><b>{t('{0} données de la grille sans demande associée', missing.length)}</b><span className="mini">{missing.map((m) => t(m[0])).join(', ')}</span></div>
              {editable && (
                <button type="button" className="btn sm end" onClick={() => appendItems('questions', missing.map((m) => newQuestion(m[1], m[2], m[3])))}>{t('Ajouter les questions')}</button>
              )}
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal className="g2e mt" index={2}>
        <Card title={t('Fiche du dossier')} icon="building">
          <div className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="f-owner">{t('Responsable')}</label>
              <select id="f-owner" className="in" value={meta.ownerId} disabled={!canOwner}
                onChange={(e) => act((r, id) => r.setOwner(id, e.target.value))}>
                {!ownerOptions.some((m) => m.id === meta.ownerId) && <option value={meta.ownerId}>{owner?.name || t('Membre inconnu')}</option>}
                {ownerOptions.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
              </select>
              {senior && meta.phase === 'associate_review' && <span className="mini">{t('Le responsable ne change pas pendant la revue associate.')}</span>}
            </div>
            <fieldset className="field contribs">
              <legend>{t('Contributeurs')}</legend>
              <div className="contriblist">
                {contributorOptions.map((m) => (
                  <Check key={m.id} id={`f-contrib-${m.id}`} label={m.name || m.email} readOnly={!editable}
                    checked={meta.contributorIds.includes(m.id)}
                    onCommit={(on) => act((r, id) => r.setContributors(id, on ? [...meta.contributorIds, m.id] : meta.contributorIds.filter((x) => x !== m.id)))}>
                    {m.name || m.email}
                  </Check>
                ))}
                {contributorOptions.length === 0 && <span className="dim">—</span>}
              </div>
            </fieldset>
            {(['name', 'sector', 'country', 'team', 'source'] as const).map((k) => {
              const l = { name: 'Nom de code', sector: 'Secteur', country: 'Pays', team: 'Équipe', source: 'Document source' }[k];
              const bd = bind([k], t(l));
              return <div className="field" key={k}><label htmlFor={bd.id}>{t(l)}</label><TextInput {...bd} value={d[k]} /></div>;
            })}
            {(() => { const bd = bind(['description'], t('Activité')); return <div className="field"><label htmlFor={bd.id}>{t('Activité')}</label><TextInput {...bd} multiline value={d.description} placeholder="" /></div>; })()}
          </div>
        </Card>
        <Card title={t('Thèse d’investissement')} icon="flag">
          <div className="stack" style={{ gap: 12 }}>
            {(() => { const bd = bind(['thesis'], t('Pourquoi acheter')); return <div className="field"><label htmlFor={bd.id}>{t('Pourquoi acheter')}</label><TextInput {...bd} multiline value={d.thesis} placeholder="" /></div>; })()}
            {(() => { const bd = bind(['risks'], t('Ce qui invaliderait la thèse')); return <div className="field"><label htmlFor={bd.id}>{t('Ce qui invaliderait la thèse')}</label><TextInput {...bd} multiline value={d.risks} placeholder="" /></div>; })()}
          </div>
        </Card>
      </Reveal>
    </>
  );
}
