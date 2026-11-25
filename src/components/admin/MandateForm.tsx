'use client';
import { useEffect, useId, useState } from 'react';
import type { Mandate } from '../../engine/types';
import { parseNum } from '../../i18n/format';
import { useApp, useI18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

type TextKey = 'name' | 'sectors' | 'geos';
type NumKey = 'minRev' | 'maxRev' | 'minRecurring' | 'minMargin' | 'hurdle';
const NUM_KEYS: NumKey[] = ['minRev', 'maxRev', 'minRecurring', 'minMargin', 'hurdle'];

/** Mandat acquéreur unique de l'équipe (champs de openMandate de legacy/app.js). */
export function MandateForm() {
  const { repo, toast } = useApp();
  const { t, locale, unitM } = useI18n();
  const uid = useId();
  const [form, setForm] = useState<Record<TextKey | NumKey, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const num = (v: number | null) => (v == null ? '' : v.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 2, useGrouping: false }));
  useEffect(() => {
    let live = true;
    repo.mandate().then((m) => {
      if (live) setForm({ name: m.name ?? '', sectors: m.sectors ?? '', geos: m.geos ?? '', ...Object.fromEntries(NUM_KEYS.map((k) => [k, num(m[k])])) } as Record<TextKey | NumKey, string>);
    }).catch(() => toast(t('Chargement impossible. Réessayez dans un instant.'), true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formatted once per load; a locale switch keeps the typed text
  }, [repo]);

  const save = async () => {
    if (!form) return;
    const m: Mandate = { name: form.name.trim(), sectors: form.sectors.trim(), geos: form.geos.trim(), minRev: null, maxRev: null, minRecurring: null, minMargin: null, hurdle: null };
    for (const k of NUM_KEYS) {
      const v = parseNum(locale, form[k]);
      if (v === 'invalid') { toast(t('Valeur non reconnue : saisissez un nombre.'), true); document.getElementById(`${uid}-${k}`)?.focus(); return; }
      m[k] = v;
    }
    setBusy(true);
    try {
      await repo.setMandate(m);
      toast(t('Mandat enregistré'));
    } catch (e) {
      toast(t('Enregistrement impossible : {0}', (e as Error)?.message ?? ''), true);
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, k: TextKey | NumKey, text = false) => (
    <div className="field" key={k}>
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      <input id={`${uid}-${k}`} className={`in ${text ? 'txt' : 'wide'}`} value={form?.[k] ?? ''} inputMode={text ? 'text' : 'decimal'} autoComplete="off"
        onChange={(e) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f))} />
    </div>
  );

  return (
    <Card title={t('Mandat acquéreur')} icon="target">
      {!form ? <div className="loading" aria-busy="true">…</div> : (
        <form className="stack" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <p className="note">{t('Ces critères s’appliquent à tous les dossiers de l’équipe : grille de notation, avis préliminaire et prix maximum au TRI cible.')}</p>
          {field(t('Nom du profil'), 'name', true)}
          <div className="form">
            {field(t('Secteurs acceptés (séparés par des virgules)'), 'sectors', true)}
            {field(t('Zones acceptées'), 'geos', true)}
          </div>
          <div className="form">
            {field(t('CA minimum ({0})', unitM()), 'minRev')}
            {field(t('CA maximum ({0})', unitM()), 'maxRev')}
            {field(t('Récurrence minimale (%)'), 'minRecurring')}
            {field(t('Marge d’EBITDA minimale (%)'), 'minMargin')}
            {field(t('TRI cible (%)'), 'hurdle')}
          </div>
          <div className="actions">
            <button type="submit" className="btn primary" disabled={busy}><Icon name="shield" />{t('Enregistrer le mandat')}</button>
          </div>
        </form>
      )}
    </Card>
  );
}
