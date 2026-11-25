'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { importLegacy } from '../../domain/importLegacy';
import { decisionLabel, phaseLabel } from '../../domain/phases';
import type { Locale } from '../../i18n/format';
import { t as tr } from '../../i18n/format';
import { useApp, useI18n } from '../../lib/repo-context';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';

type Report = { done: { name: string; stage: string }[]; errors: string[] };

const MAX_BYTES = 20 * 1024 * 1024;

/** Messages of importLegacy are French keys; "Dossier N : …" is split so the reason is translated too. */
function errorText(locale: Locale, e: string): string {
  const m = e.match(/^Dossier (\d+) : (.*)$/);
  return m ? tr(locale, 'Dossier {0} : {1}', m[1], tr(locale, m[2])) : tr(locale, e);
}

/** Import des dossiers de l'ancienne version (fichier bos-legacy-v1), avec rapport. */
export function ImportDialog({ onClose }: { onClose(): void }) {
  const { repo, me } = useApp();
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  const handle = async (file: File | undefined) => {
    if (!file || !me || busy) return;
    setBusy(true);
    setReport(null);
    const out: Report = { done: [], errors: [] };
    try {
      if (file.size > MAX_BYTES) throw new Error(t('Fichier trop volumineux'));
      const { items, errors } = importLegacy(await file.text(), me, new Date());
      out.errors.push(...errors.map((e) => errorText(locale, e)));
      for (const it of items) {
        const name = it.deal.name || t('Sans nom');
        try {
          await repo.importDeal(it.deal, it.meta);
          out.done.push({ name, stage: it.meta.decision ? decisionLabel(locale, it.meta.decision) : phaseLabel(locale, it.meta.phase) });
        } catch (e) {
          out.errors.push(t('{0} : {1}', name, (e as Error)?.message ?? ''));
        }
      }
    } catch (e) {
      out.errors.push((e as Error)?.message || t('Lecture impossible'));
    }
    setReport(out);
    setBusy(false);
  };

  const n = report?.done.length ?? 0;
  return (
    <dialog ref={ref} className="tooldlg" aria-labelledby={`${uid}-h`} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header>
        <h3 id={`${uid}-h`}>{t('Importer des dossiers')}</h3>
        <button type="button" className="iconbtn" aria-label={t('Fermer')} onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="body">
        <p className="note">
          {t('Fichier exporté depuis la version précédente de BOS (bouton « Exporter mes dossiers (JSON) »). Les étapes sont converties en phases et décisions ; vous devenez responsable des dossiers importés. Le mandat personnel n’est pas importé.')}
        </p>
        <div className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}>
          <span className="pdficon json"><Icon name="file" /></span>
          <span>{t('Déposez le fichier JSON ici')}</span>
          <label className="btn" htmlFor={`${uid}-f`}><Icon name="upload" />{t('Choisir un fichier')}</label>
          <input type="file" id={`${uid}-f`} className="sr-only" accept="application/json,.json" aria-label={t('Fichier JSON')} disabled={busy}
            onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {busy && <p className="note" role="status">{t('Import en cours…')}</p>}
        {report && (
          <div className="report" data-import-report role="status">
            <p className={n ? 'up' : 'down'}>
              <Icon name={n ? 'shield' : 'info'} />
              {n === 0 ? t('Aucun dossier importé') : n === 1 ? t('Un dossier importé') : t('{0} dossiers importés', n)}
            </p>
            {n > 0 && (
              <ul className="replist">
                {report.done.map((d, i) => <li key={i}><span>{d.name}</span><Chip tone="plain">{d.stage}</Chip></li>)}
              </ul>
            )}
            {report.errors.length > 0 && (
              <>
                <p className="down">{t(report.errors.length > 1 ? '{0} éléments ignorés' : '{0} élément ignoré', report.errors.length)}</p>
                <ul className="replist bad">{report.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </div>
      <footer>
        <button type="button" className="btn" onClick={onClose}>{t('Fermer')}</button>
      </footer>
    </dialog>
  );
}
