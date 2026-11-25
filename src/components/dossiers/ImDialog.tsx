'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { blankDeal } from '../../engine/samples';
import type { Deal } from '../../engine/types';
import { can } from '../../domain/permissions';
import { IM_FIELDS, applyExtract, dealNameFromFile, extract, patchesFor, pdfPages, type ImKey, type ImResult } from '../../lib/im';
import { useApp, useI18n } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';

type Props = {
  /** Dossier ouvert : propose « Appliquer au dossier ouvert ». */
  target?: { id: string; deal: Deal; editable: boolean };
  onClose(): void;
};

/** Import d'un mémorandum d'information : PDF lu dans le navigateur ou texte collé, indicateurs repérés à vérifier puis appliquer. */
export function ImDialog({ target, onClose }: Props) {
  const { repo, me, toast } = useApp();
  const { t, pc, meur } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  const [state, setState] = useState<'idle' | 'reading' | 'failed'>('idle');
  const [res, setRes] = useState<ImResult | null>(null);
  const [selected, setSelected] = useState<Set<ImKey>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  const show = (pages: string[]) => {
    const r = extract(pages);
    setRes(r);
    setSelected(new Set(Object.keys(r.vals) as ImKey[]));
    setState('idle');
  };

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setState('reading');
    setRes(null);
    try {
      setFileName(file.name);
      show(file.name.toLowerCase().endsWith('.pdf') ? await pdfPages(file) : [await file.text()]);
    } catch {
      setState('failed');
    }
  };

  const apply = async (mode: 'open' | 'new') => {
    if (!res || busy) return;
    setBusy(true);
    try {
      if (mode === 'open' && target) {
        const next = applyExtract(target.deal, res, selected, fileName);
        for (const [path, value] of patchesFor(target.deal, next)) await repo.patchDeal(target.id, path, value);
        onClose();
        router.push(`/projet/${encodeURIComponent(target.id)}/financiers`);
      } else {
        const deal = applyExtract(blankDeal(dealNameFromFile(fileName, t('Nouveau dossier'))), res, selected, fileName);
        const id = await repo.createDeal(deal);
        onClose();
        router.push(`/projet/${encodeURIComponent(id)}/financiers`);
      }
      toast(t('Données importées. Complétez l’historique.'));
    } catch (e) {
      toast(t('Enregistrement impossible : {0}', (e as Error)?.message ?? ''), true);
      setBusy(false);
    }
  };

  const found = res ? IM_FIELDS.filter(([k]) => res.vals[k]) : [];
  const canNew = !!me && can(me, 'create');
  const toggle = (k: ImKey, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; });

  return (
    <dialog ref={ref} className="tooldlg" aria-labelledby={`${uid}-h`} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header>
        <h3 id={`${uid}-h`}>{t('Importer un mémorandum d’information')}</h3>
        <button type="button" className="iconbtn" aria-label={t('Fermer')} onClick={onClose}><Icon name="x" /></button>
      </header>
      <div className="body">
        <div className={`drop ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}>
          <span className="pdficon"><Icon name="file" /></span>
          <span>{fileName || t('Déposez le PDF de l’IM ici')}</span>
          <label className="btn" htmlFor={`${uid}-f`}><Icon name="upload" />{t('Choisir un fichier')}</label>
          <input type="file" id={`${uid}-f`} className="sr-only" accept="application/pdf,.pdf,.txt"
            onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
          <span className="note">{t('Le fichier est lu dans votre navigateur et n’est envoyé nulle part.')}</span>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-t`}>{t('Ou collez des extraits de l’IM')}</label>
          <textarea id={`${uid}-t`} className="in" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={`${t('Chiffre d’affaires : 12,4 M€')}\nEBITDA : 3,1 M€`} />
        </div>
        <div aria-live="polite">
          {state === 'reading' && <p className="note">{t('Lecture du document…')}</p>}
          {state === 'failed' && <p className="note down">{t('Lecture impossible. Copiez le texte de l’IM et collez-le ci-dessus.')}</p>}
          {res && found.length === 0 && (
            <p className="note">{t('Aucun indicateur reconnu. Le texte doit contenir des libellés comme « Chiffre d’affaires : 12,4 M€ ».')}</p>
          )}
          {res && found.length > 0 && (
            <div className="stack" style={{ gap: 12 }}>
              <div className="tw">
                <table>
                  <thead><tr><th /><th>{t('Indicateur')}</th><th className="n">{t('Valeur')}</th><th>{t('Source')}</th></tr></thead>
                  <tbody>
                    {found.map(([k, label, unit]) => {
                      const v = res.vals[k]!;
                      return (
                        <tr key={k} data-extract-row={k}>
                          <td><input type="checkbox" checked={selected.has(k)} aria-label={t(label)} onChange={(e) => toggle(k, e.target.checked)} /></td>
                          <td>{t(label)}</td>
                          <td className="n">{unit === '%' ? pc(v.n) : meur(v.n, 2)}</td>
                          <td className="wrapc mini">{v.ref} · « {v.line} »</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="note">{res.year ? t('Exercice détecté : {0}.', res.year) + ' ' : ''}{t('Vérifiez chaque valeur avant de l’appliquer.')}</p>
              <div className="actions">
                {target?.editable && (
                  <button type="button" className="btn" disabled={busy || selected.size === 0} onClick={() => apply('open')}>{t('Appliquer au dossier ouvert')}</button>
                )}
                {canNew && (
                  <button type="button" className="btn primary" disabled={busy} onClick={() => apply('new')}>{t('Créer un nouveau dossier')}</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <footer>
        <button type="button" className="btn" onClick={onClose}>{t('Fermer')}</button>
        <button type="button" className="btn" disabled={!text.trim()} onClick={() => { setFileName(''); show([text]); }}>{t('Analyser le texte')}</button>
      </footer>
    </dialog>
  );
}
