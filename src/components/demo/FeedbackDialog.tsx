'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { clearFeedbackDraft, feedbackActions, feedbackEmail, feedbackMailto, feedbackText, getFeedbackDraft, setFeedbackDraft, setFeedbackOpen, useFeedbackOpen, type Feedback } from '../../lib/demo/feedback';
import { markDemo } from '../../lib/demo/signals';
import { useApp, useI18n, useMe } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';

const USE = [['yes', 'Oui'], ['maybe', 'Peut-être'], ['no', 'Non']] as const;

/** Renders the dialog when the demo bar or the checklist asked for it. */
export function FeedbackHost() {
  return useFeedbackOpen() ? <FeedbackDialog onClose={() => setFeedbackOpen(false)} /> : null;
}

/** Démo publique : 3 questions, envoyées par e-mail au fondateur (mailto) ou copiées. Rien n'est stocké. */
function FeedbackDialog({ onClose }: { onClose(): void }) {
  const { t, locale } = useI18n();
  const { toast } = useApp();
  const me = useMe();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const to = feedbackEmail();
  const [init] = useState(getFeedbackDraft);
  const [score, setScore] = useState<Feedback['usefulness']>(init.usefulness);
  const [missing, setMissing] = useState(init.missing);
  const [wouldUse, setWouldUse] = useState<Feedback['wouldUse']>(init.wouldUse);
  const [comment, setComment] = useState(init.comment);
  const done = useRef(false);
  const latest = useRef({ usefulness: score, missing, wouldUse, comment });
  latest.current = { usefulness: score, missing, wouldUse, comment };
  // Closed by accident (Escape, ✕): the answers wait in the store until sent / copied.
  useEffect(() => () => { if (!done.current) setFeedbackDraft(latest.current); }, []);
  const sent = () => { done.current = true; clearFeedbackDraft(); markDemo('feedback'); };

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const role = me?.role === 'analyst' ? 'analyst' : me?.role === 'admin' ? 'admin' : 'associate';
  const fb: Feedback = { usefulness: score, missing, wouldUse, comment, role };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedbackText(fb, locale));
      sent();
      toast(t('Réponses copiées'));
    } catch {
      toast(t('Copie impossible : sélectionnez le texte puis Ctrl+C.'), true);
    }
  };

  return (
    <dialog ref={ref} className="fbdlg" aria-labelledby={`${uid}-h`} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header>
        <h3 id={`${uid}-h`}>{t('Votre avis sur BOS')}</h3>
        <button type="button" className="iconbtn close" aria-label={t('Fermer')} onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="body">
        <fieldset className="fbq">
          <legend>{t('Dans votre process M&A, BOS vous serait-il utile ?')}</legend>
          <div className="fbopts">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button key={n} type="button" className={`fbopt ${score === n ? 'on' : ''}`} aria-pressed={score === n} onClick={() => setScore(n)}>{n}</button>
            ))}
          </div>
          <div className="fbhint"><span>{t('Pas du tout')}</span><span>{t('Indispensable')}</span></div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${uid}-m`}>{t('Qu’est-ce qui manque le plus ?')}</label>
          <textarea id={`${uid}-m`} className="in" rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} />
        </div>
        <fieldset className="fbq">
          <legend>{t('L’utiliseriez-vous sur un vrai dossier ?')}</legend>
          <div className="fbopts">
            {USE.map(([v, label]) => (
              <button key={v} type="button" className={`fbopt wide ${wouldUse === v ? 'on' : ''}`} aria-pressed={wouldUse === v} onClick={() => setWouldUse(v)}>{t(label)}</button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor={`${uid}-c`}>{t('Un commentaire ?')}</label>
          <textarea id={`${uid}-c`} className="in" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      </div>
      <footer>
        {to && feedbackActions(to).includes('mail') && <a className="btn" href={feedbackMailto(fb, to, locale)} onClick={sent}><Icon name="mail" />{t('Envoyer par e-mail')}</a>}
        <button type="button" className="btn primary" onClick={() => { void copy(); }}><Icon name="copy" />{t('Copier mes réponses')}</button>
      </footer>
    </dialog>
  );
}
