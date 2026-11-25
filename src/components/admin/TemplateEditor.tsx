'use client';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TEMPLATES, type Template, type TemplateKey } from '../../domain/templates';
import type { Locale } from '../../i18n/format';
import { useApp, useI18n } from '../../lib/repo-context';
import { TEMPLATE_KEYS, TEMPLATE_LABEL } from '../messages/MessageDialog';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';

const LOCALES: Locale[] = ['fr', 'en'];
const tid = (k: TemplateKey, l: Locale) => `${k}:${l}`;
const def = (k: TemplateKey, l: Locale) => DEFAULT_TEMPLATES.find((x) => x.key === k && x.locale === l) as Template;
const same = (a: Pick<Template, 'subject' | 'body'>, b: Pick<Template, 'subject' | 'body'>) => a.subject === b.subject && a.body === b.body;

const VARS = ['deal.name', 'author', 'questionsFor', 'openQuestions', 'days', 'rev', 'adjEbitda', 'margin', 'ask', 'askMultiple', 'range', 'irr', 'hurdle', 'maxPrice', 'thesis', 'risks'];

/** Éditeur des 12 modèles de messages (6 modèles × FR / EN), avec retour au modèle livré. */
export function TemplateEditor() {
  const { repo, toast } = useApp();
  const { t } = useI18n();
  const [saved, setSaved] = useState<Record<string, Template> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [cur, setCur] = useState(tid('info_request', 'fr'));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    repo.templates().catch(() => [] as Template[]).then((list) => {
      if (!live) return;
      const out: Record<string, Template> = {};
      for (const k of TEMPLATE_KEYS) for (const l of LOCALES) out[tid(k, l)] = list.find((x) => x.key === k && x.locale === l) ?? def(k, l);
      setSaved(out);
    });
    return () => { live = false; };
  }, [repo]);

  const entries = useMemo(() => TEMPLATE_KEYS.flatMap((k) => LOCALES.map((l) => [k, l] as const)), []);
  if (!saved) return <Card title={t('Modèles de messages')} icon="mail"><div className="loading" aria-busy="true">…</div></Card>;

  const [key, locale] = cur.split(':') as [TemplateKey, Locale];
  const base = saved[cur];
  const draft = drafts[cur] ?? { subject: base.subject, body: base.body };
  const dirty = !same(draft, base);
  const isDefault = same(draft, def(key, locale)) && same(base, def(key, locale));

  const store = async (tpl: Template, msg: string) => {
    setBusy(true);
    try {
      await repo.saveTemplate(tpl);
      setSaved((s) => (s ? { ...s, [tid(tpl.key, tpl.locale)]: tpl } : s));
      setDrafts((d) => { const n = { ...d }; delete n[tid(tpl.key, tpl.locale)]; return n; });
      toast(msg);
    } catch (e) {
      toast(t('Enregistrement impossible : {0}', (e as Error)?.message ?? ''), true);
    } finally {
      setBusy(false);
    }
  };
  const edit = (patch: Partial<{ subject: string; body: string }>) => setDrafts((d) => ({ ...d, [cur]: { ...draft, ...patch } }));

  return (
    <Card title={t('Modèles de messages')} icon="mail" sub={t('6 modèles, en français et en anglais')}>
      <div className="tpl">
        <ul className="tpl-list" aria-label={t('Modèles')}>
          {entries.map(([k, l]) => {
            const id = tid(k, l);
            const changed = !same(saved[id], def(k, l));
            return (
              <li key={id}>
                <button type="button" data-template={id} className={id === cur ? 'on' : ''} aria-current={id === cur || undefined} onClick={() => setCur(id)}>
                  <span>{t(TEMPLATE_LABEL[k])}</span>
                  <span className="tpl-tags">
                    {drafts[id] && !same(drafts[id], saved[id]) && <i className="dot" title={t('Modifications non enregistrées')} />}
                    {changed && <Chip tone="amber">{t('Modifié')}</Chip>}
                    <Chip tone="plain">{l.toUpperCase()}</Chip>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="tpl-edit stack" style={{ gap: 14 }}>
          <div className="eyebrow"><Icon name="mail" />{t(TEMPLATE_LABEL[key])} · {locale.toUpperCase()}</div>
          <div className="field">
            <label htmlFor="tpl-subject">{t('Objet du modèle')}</label>
            <input id="tpl-subject" className="in txt" value={draft.subject} autoComplete="off" onChange={(e) => edit({ subject: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="tpl-body">{t('Texte du modèle')}</label>
            <textarea id="tpl-body" className="in tpl-body" value={draft.body} spellCheck onChange={(e) => edit({ body: e.target.value })} />
          </div>
          <div className="tpl-vars">
            <span className="note">{t('Variables remplies depuis le dossier :')}</span>
            {VARS.map((v) => <code key={v}>{`{{${v}}}`}</code>)}
          </div>
          <div className="actions">
            <button type="button" className="btn primary" disabled={busy || !dirty}
              onClick={() => store({ key, locale, ...draft }, t('Modèle enregistré'))}>{t('Enregistrer le modèle')}</button>
            <button type="button" className="btn" disabled={busy || isDefault}
              onClick={() => store(def(key, locale), t('Modèle par défaut rétabli'))}><Icon name="repeat" />{t('Rétablir le modèle par défaut')}</button>
          </div>
        </div>
      </div>
    </Card>
  );
}
