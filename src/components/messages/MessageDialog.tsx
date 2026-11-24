'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DealRecord } from '../../data/repo';
import type { Mandate, Recipient } from '../../engine/types';
import type { Member } from '../../domain/permissions';
import { RECIPIENTS, recipientLabel } from '../../domain/recipients';
import {
  DEFAULT_TEMPLATES, defaultRecipient, mailtoHref, renderTemplate,
  type Template, type TemplateKey,
} from '../../domain/templates';
import type { Wait } from '../../domain/waits';
import { useI18n, useMe } from '../../lib/repo-context';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';

export const TEMPLATE_KEYS: TemplateKey[] = ['info_request', 'reminder', 'bote_review', 'committee_note', 'no_go', 'go_dd'];

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  info_request: 'Demande d’informations',
  reminder: 'Relance',
  bote_review: 'BOTe prêt à relire',
  committee_note: 'Note au comité',
  no_go: 'No-go au banquier conseil',
  go_dd: 'Passage en due diligence',
};

/** Libellés des variables signalées « [à compléter] ». */
const VAR_LABEL: Record<string, string> = {
  'deal.name': 'Nom du projet',
  rev: 'Chiffre d’affaires',
  adjEbitda: 'EBITDA ajusté',
  margin: 'Marge d’EBITDA',
  ask: 'Prix demandé',
  askMultiple: 'Multiple demandé',
  range: 'Fourchette de valeur',
  irr: 'TRI au prix demandé',
  maxPrice: 'Prix maximum',
  hurdle: 'Seuil de rendement',
  thesis: 'Thèse d’investissement',
  risks: 'Risques',
  author: 'Auteur',
  days: 'Jours d’attente',
};

const PER_RECIPIENT: TemplateKey[] = ['info_request', 'reminder'];
/** Internal templates carrying price / hurdle figures. */
const INTERNAL: TemplateKey[] = ['bote_review', 'committee_note'];
/** Beyond this, mail clients may truncate or refuse a mailto: link. */
const MAILTO_MAX = 1900;
const ANYONE: Member = { id: '', email: '', name: '', avatarUrl: null, role: null, status: 'active', locale: 'fr' };

type Props = {
  rec: DealRecord;
  waits: Wait[];
  mandate: Mandate;
  templates: Template[];
  initialKey: TemplateKey;
  onClose(): void;
};

/** Message pré-rempli depuis le dossier : modèle, destinataire, texte modifiable, Copier / Ouvrir dans la messagerie. */
export function MessageDialog({ rec, waits, mandate, templates, initialKey, onClose }: Props) {
  const { t, locale } = useI18n();
  const me = useMe();
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const uid = useId();
  const placeholder = locale === 'en' ? '[to complete]' : '[à compléter]';

  // Rendered from the deal as it is when the template / recipient is chosen; later edits stay the user's.
  const render = (key: TemplateKey, recipient: Recipient | '') => {
    const tpl = templates.find((x) => x.key === key && x.locale === locale)
      ?? DEFAULT_TEMPLATES.find((x) => x.key === key && x.locale === locale) as Template;
    return renderTemplate(tpl, {
      deal: rec.deal, meta: rec.meta, mandate, author: me ?? ANYONE, locale, now: new Date(),
      recipient: PER_RECIPIENT.includes(key) && recipient ? recipient : undefined,
    });
  };
  const [state, setState] = useState(() => {
    const recipient = defaultRecipient(initialKey, rec.deal, waits) ?? '';
    return { key: initialKey, recipient, ...render(initialKey, recipient) };
  });
  const [copied, setCopied] = useState<'' | 'body' | 'subject' | 'failed'>('');

  useEffect(() => {
    const d = ref.current;
    // No close() on cleanup: under StrictMode it would fire `close` and unmount the dialog; removal from the DOM ends it anyway.
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(''), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const choose = (key: TemplateKey, recipient: Recipient | '') => setState({ key, recipient, ...render(key, recipient) });
  const pickTemplate = (key: TemplateKey) => choose(key, defaultRecipient(key, rec.deal, waits) ?? '');

  const left = useMemo(
    () => (state.subject + '\n' + state.body).split(placeholder).length - 1,
    [state.subject, state.body, placeholder],
  );

  const copy = async (text: string, what: 'body' | 'subject') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      return;
    } catch { /* fall back to selecting the text */ }
    const el = bodyRef.current;
    if (what === 'body' && el) {
      el.focus();
      el.select();
      try { if (document.execCommand('copy')) { setCopied('body'); return; } } catch { /* ignore */ }
    }
    setCopied('failed');
  };

  const mailto = mailtoHref(state.subject, state.body);
  const status = copied === 'body' ? t('Message copié') : copied === 'subject' ? t('Objet copié')
    : copied === 'failed' ? t('Copie impossible : sélectionnez le texte puis Ctrl+C.') : '';

  return (
    <dialog ref={ref} className="msgdlg" aria-labelledby={`${uid}-h`} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header>
        <div>
          <div className="eyebrow"><Icon name="mail" />{t('Message pré-rempli')}</div>
          <h3 id={`${uid}-h`}>{rec.deal.name || t('Sans nom')}</h3>
        </div>
        <button type="button" className="iconbtn close" aria-label={t('Fermer')} onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="body">
        <div className="msgpick">
          <div className="field">
            <label htmlFor={`${uid}-tpl`}>{t('Modèle')}</label>
            <select id={`${uid}-tpl`} className="in" value={state.key} onChange={(e) => pickTemplate(e.target.value as TemplateKey)}>
              {TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{t(TEMPLATE_LABEL[k])}</option>)}
            </select>
          </div>
          {INTERNAL.includes(state.key) && (
            <div className="internal" data-internal><Chip tone="bad">{t('Usage interne — contient des chiffres confidentiels')}</Chip></div>
          )}
          {PER_RECIPIENT.includes(state.key) && (
            <div className="field">
              <label htmlFor={`${uid}-to`}>{t('Destinataire')}</label>
              <select id={`${uid}-to`} className="in" value={state.recipient} onChange={(e) => choose(state.key, e.target.value as Recipient | '')}>
                <option value="">{t('Tous les destinataires')}</option>
                {RECIPIENTS.map((r) => <option key={r} value={r}>{recipientLabel(locale, r)}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${uid}-sub`}>{t('Objet')}</label>
          <div className="ib">
            <input id={`${uid}-sub`} className="in txt" value={state.subject} autoComplete="off"
              onChange={(e) => setState((s) => ({ ...s, subject: e.target.value }))} />
            <button type="button" className="iconbtn" aria-label={t('Copier l’objet')} title={t('Copier l’objet')}
              onClick={() => copy(state.subject, 'subject')}><Icon name="copy" /></button>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-body`}>{t('Message')}</label>
          <textarea id={`${uid}-body`} ref={bodyRef} className="in msgbody" value={state.body} spellCheck
            onChange={(e) => setState((s) => ({ ...s, body: e.target.value }))} />
        </div>
        {state.missing.length > 0 ? (
          <div className="missing" data-missing>
            <span className="mhead"><Icon name="info" />{left > 0 ? t('{0} × « {1} » à remplacer avant envoi', left, placeholder) : t('Variables complétées à la main')}</span>
            <span className="mlist">
              {state.missing.map((m) => <Chip key={m} tone="amber">{t(VAR_LABEL[m] ?? m)}</Chip>)}
            </span>
          </div>
        ) : (
          <div className="missing ok"><span className="mhead"><Icon name="shield" />{t('Toutes les variables sont renseignées depuis le dossier.')}</span></div>
        )}
      </div>
      <footer>
        <span className={`copied ${copied === 'failed' ? 'bad' : ''}`} role="status" aria-live="polite">{status}</span>
        {mailto.length > MAILTO_MAX && <span className="mailhint" data-mailto-long>{t('Message trop long pour la messagerie : utilisez Copier')}</span>}
        <a className="btn" href={mailto}><Icon name="mail" />{t('Ouvrir dans la messagerie')}</a>
        <button type="button" className="btn primary" onClick={() => copy(state.body, 'body')}><Icon name="copy" />{t('Copier')}</button>
      </footer>
    </dialog>
  );
}
