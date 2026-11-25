'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { blankDeal } from '../../engine/samples';
import type { Deal } from '../../engine/types';
import { can } from '../../domain/permissions';
import {
  IM_FIELDS, IM_HIST_FIELDS, IM_OTHER_FIELDS, IM_PLAN_FIELDS, applyExtract, dealNameFromFile, extract, extractKeys, importWrites,
  pdfPages, planValue, type ImResult,
} from '../../lib/im';
import { useApp, useI18n } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';

const MAX_PDF = 30 * 1024 * 1024;
const MAX_TEXT = 5 * 1024 * 1024;

type Props = {
  /** Dossier ouvert : propose « Appliquer au dossier ouvert ». */
  target?: { id: string; deal: Deal; editable: boolean };
  onClose(): void;
};

/** Import d'un mémorandum d'information : PDF lu dans le navigateur ou texte collé, indicateurs repérés à vérifier puis appliquer. */
export function ImDialog({ target, onClose }: Props) {
  const { repo, me, toast } = useApp();
  const { t, pc, meur, nf, unitM } = useI18n();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  const [state, setState] = useState<'idle' | 'reading' | 'failed' | 'pdfTooBig' | 'textTooBig'>('idle');
  const [res, setRes] = useState<ImResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  const show = (pages: string[]) => {
    const r = extract(pages);
    setRes(r);
    setSelected(new Set(extractKeys(r)));
    setState('idle');
  };

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setRes(null);
    const pdf = file.name.toLowerCase().endsWith('.pdf');
    if (file.size > (pdf ? MAX_PDF : MAX_TEXT)) { setState(pdf ? 'pdfTooBig' : 'textTooBig'); return; }
    setState('reading');
    try {
      setFileName(file.name);
      show(pdf ? await pdfPages(file) : [await file.text()]);
    } catch {
      setState('failed');
    }
  };

  const apply = async (mode: 'open' | 'new') => {
    if (!res || busy) return;
    setBusy(true);
    try {
      if (mode === 'open' && target) {
        // Leaf patches and list rows appended by id: edits made meanwhile by others are kept.
        const { patches, items } = importWrites(target.deal, applyExtract(target.deal, res, selected, fileName));
        for (const [path, value] of patches) await repo.patchDeal(target.id, path, value);
        for (const { list, item } of items) await repo.appendItem(target.id, list, item);
        onClose();
        router.push(`/projet/${encodeURIComponent(target.id)}/financiers`);
      } else {
        const deal = applyExtract(blankDeal(dealNameFromFile(fileName, t('Nouveau dossier'))), res, selected, fileName);
        const id = await repo.createDeal(deal);
        onClose();
        router.push(`/projet/${encodeURIComponent(id)}/financiers`);
      }
      toast([...selected].some((k) => k.startsWith('hist.')) ? t('Données importées. Vérifiez-les dans l’onglet Données financières.') : t('Données importées. Complétez l’historique.'));
    } catch (e) {
      toast(t('Enregistrement impossible : {0}', (e as Error)?.message ?? ''), true);
      setBusy(false);
    }
  };

  const groups = res ? lines(res) : [];
  const found = groups.flatMap((g) => g.lines);
  const canNew = !!me && can(me, 'create');
  const toggle = (keys: string[], on: boolean) => setSelected((s) => {
    const n = new Set(s);
    for (const k of keys) { if (on) n.add(k); else n.delete(k); }
    return n;
  });

  /** Everything found, by group, with the selection key of each line. */
  function lines(r: ImResult): { id: string; title: string; lines: { key: string; label: string; aria: string; value: string; src: string }[] }[] {
    const src = (v: { ref: string; line: string }) => `${v.ref} · « ${v.line} »`;
    const byUnit = (n: number, unit: string) => (unit === '%' ? pc(n) : unit === 'M€' ? meur(n, 2) : nf(n, 0));
    const series = (years: number[], vals: (number | null)[], f: (n: number) => string) =>
      years.map((y, i) => `${y} ${vals[i] == null ? '—' : f(vals[i] as number)}`).join(' · ');
    const hist = t('Historique'), plan = t('Plan d’affaires');
    return [
      { id: 'key', title: t('Chiffres clés'), lines: IM_FIELDS.filter(([k]) => r.vals[k]).map(([k, label, unit]) => {
        const v = r.vals[k]!;
        return { key: k, label: t(label), aria: t(label), value: byUnit(v.n, unit), src: src(v) };
      }) },
      { id: 'hist', title: hist, lines: IM_HIST_FIELDS.filter(([k]) => r.hist[k]).map(([k, label]) => {
        const row = r.hist[k]!;
        return { key: `hist.${k}`, label: `${t(label)} (${unitM()})`, aria: `${t(label)} · ${hist}`, value: series(row.years, row.vals, (n) => nf(n, 1)), src: src(row) };
      }) },
      { id: 'plan', title: plan, lines: IM_PLAN_FIELDS.filter(([k]) => r.plan[k]).map(([k, label]) => {
        const row = r.plan[k]!;
        const v = planValue(row, k);
        const value = Array.isArray(v) ? v.map((x) => (x == null ? '—' : pc(x, 1))).join(' · ') : `${pc(v as number, 1)} (${row.years[row.years.length - 1]})`;
        return { key: `plan.${k}`, label: t(label), aria: `${t(label)} · ${plan}`, value, src: src(row) };
      }) },
      { id: 'adj', title: t('Retraitements'), lines: r.adjustments.map((a, i) => ({
        key: `adj.${i}`, label: a.label, aria: a.label,
        value: `${meur(a.amount, 2)} · ${a.included ? t('inclus par le vendeur') : t('non inclus par le vendeur')}`, src: src(a),
      })) },
      { id: 'other', title: t('Autres'), lines: IM_OTHER_FIELDS.filter(([k]) => r.other[k]).map(([k, label, unit]) => {
        const v = r.other[k]!;
        return { key: k, label: t(label), aria: t(label), value: byUnit(v.n, unit), src: src(v) };
      }) },
    ].filter((g) => g.lines.length > 0);
  }

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
          {state === 'pdfTooBig' && <p className="note down" role="alert">{t('PDF trop volumineux : 30 Mo au maximum. Collez plutôt les extraits utiles ci-dessus.')}</p>}
          {state === 'textTooBig' && <p className="note down" role="alert">{t('Fichier texte trop volumineux : 5 Mo au maximum.')}</p>}
          {state === 'failed' && <p className="note down">{t('Lecture impossible. Copiez le texte de l’IM et collez-le ci-dessus.')}</p>}
          {res && found.length === 0 && (
            <p className="note">{t('Aucun indicateur reconnu. Le texte doit contenir des libellés comme « Chiffre d’affaires : 12,4 M€ ».')}</p>
          )}
          {res && found.length > 0 && (
            <div className="stack" style={{ gap: 12 }}>
              <div className="tw">
                <table>
                  <thead><tr><th /><th>{t('Indicateur')}</th><th className="n">{t('Valeur')}</th><th>{t('Source')}</th></tr></thead>
                  {groups.map((g) => {
                    const keys = g.lines.map((l) => l.key);
                    const on = keys.filter((k) => selected.has(k)).length;
                    return (
                      <tbody key={g.id} data-extract-group={g.id}>
                        <tr className="grp">
                          <td><input type="checkbox" checked={on === keys.length} aria-label={g.title}
                            ref={(el) => { if (el) el.indeterminate = on > 0 && on < keys.length; }}
                            onChange={(e) => toggle(keys, e.target.checked)} /></td>
                          <th colSpan={3} scope="colgroup">{g.title}</th>
                        </tr>
                        {g.lines.map((l) => (
                          <tr key={l.key} data-extract-row={l.key}>
                            <td><input type="checkbox" checked={selected.has(l.key)} aria-label={l.aria} onChange={(e) => toggle([l.key], e.target.checked)} /></td>
                            <td>{l.label}</td>
                            <td className="n">{l.value}</td>
                            <td className="wrapc mini">{l.src}</td>
                          </tr>
                        ))}
                      </tbody>
                    );
                  })}
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
