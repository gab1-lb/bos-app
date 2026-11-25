/* Export Excel du dossier (port de exportXlsx de legacy/app.js) ; SheetJS (paquet npm xlsx) chargé à la demande. */
import { N } from '../../engine/finance';
import type { Deal } from '../../engine/types';
import type { DealMeta } from '../../domain/phases';
import { fmt, t as tr, type Locale } from '../../i18n/format';
import type { Computed } from '../../components/project/compute';
import { TAG } from '../../components/project/verdict';
import { download, slug } from './download';
import { stageText } from './memo';

export type Cell = string | number | boolean | null;
export type Sheet = { name: string; aoa: Cell[][]; cols: number[] };

const r2 = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

/** Feuilles du classeur : synthèse, données financières, comparables, DCF, rendement, demandes. */
export function xlsxSheets(d: Deal, meta: DealMeta, c: Computed, locale: Locale): Sheet[] {
  const t = (k: string, ...a: (string | number)[]) => tr(locale, k, ...a);
  const UM = fmt(locale).unitM();
  const U = ` (${UM})`;
  const { b, cp, dc, ret, sc, mp } = c;
  const out: Sheet[] = [];
  const add = (name: string, aoa: Cell[][], cols: number[]) => out.push({ name: name.slice(0, 31), aoa, cols });
  add(t('Synthèse'), [
    [d.name], [[d.sector, d.country, stageText(locale, meta)].filter(Boolean).join(' · ')], [],
    [t('Avis préliminaire'), t(TAG[sc.code])], [t('Note'), sc.score, sc.provisional ? t('provisoire') : ''], [],
    [t('Chiffre d’affaires') + U, r2(b.rev)], [t('EBITDA publié') + U, r2(b.ebitda)], [t('EBITDA retenu') + U, r2(b.adjEbitda)],
    [t('Marge d’EBITDA') + ' (%)', r2(b.margin)], [t('Croissance') + ' (%)', r2(b.growth)], [t('Revenus récurrents') + ' (%)', b.recurring],
    [t('Churn clients') + ' (%)', b.churn], [t('Top 10 clients') + ' (%)', b.top10], [t('Dette nette') + U, b.netDebt], [t('VE demandée (100 %)') + U, b.ask], [],
    [t('VE d’entrée') + U, ret && r2(ret.ev)], [t('TRI'), ret && r2(ret.irr)], [t('Multiple du capital'), ret && r2(ret.mom)],
    [t('ROIC année 5'), ret && r2(ret.roic5)], [t('Prix max au TRI cible') + U, r2(mp)], [],
    [t('Pourquoi acheter'), d.thesis], [t('Ce qui invaliderait la thèse'), d.risks],
  ], [36, 18, 30]);
  add(t('Données financières'), [
    [UM, ...d.hist.years], [t('Chiffre d’affaires'), ...d.hist.rev], [t('EBITDA publié'), ...d.hist.ebitda], ['Capex', ...d.hist.capex], [],
    [t('Retraitement'), t('Montant'), t('Inclus vendeur'), t('Statut')],
    ...d.adjustments.map((a): Cell[] => [a.label, a.amount, a.included ? t('Oui') : t('Non'), t(a.status)]),
    [t('EBITDA retenu'), r2(b.adjEbitda)],
  ], [34, 12, 12, 12, 12, 12]);
  add(t('Comparables'), [
    [t('Retenir'), t('Cible'), t('Acquéreur'), t('Année'), t('Zone'), t('Niche'), t('CA'), 'EBITDA', t('VE'), t('VE / CA'), t('VE / EBITDA')],
    ...cp.rows.map((r): Cell[] => [r.include ? t('Oui') : t('Non'), r.target, r.buyer, r.year, r.geo, r.niche, r.rev, r.ebitda, r.ev, r2(r.evRev), r2(r.evEbitda)]),
    [], [t('Médiane'), '', '', '', '', '', '', '', '', r2(cp.evRev.med), r2(cp.evEbitda.med)],
  ], [8, 24, 20, 8, 12, 24, 8, 8, 8, 8, 10]);
  if (dc) {
    add('DCF', [
      ['WACC (%)', N(d.dcf.wacc)], ['g (%)', N(d.dcf.g)], [], [UM, ...dc.rows.map((r) => r.year)],
      [t('Flux de trésorerie disponible'), ...dc.rows.map((r) => r2(r.fcf))], [t('Valeur actualisée'), ...dc.rows.map((r) => r2(r.pv))], [],
      [t('VE · DCF'), r2(dc.ev)],
    ], [30, 10, 10, 10, 10, 10]);
  }
  if (ret) {
    const lines: [string, 'rev' | 'ebitdaTot' | 'fcfPre' | 'interest' | 'fcfe' | 'debtEnd' | 'roic'][] = [
      ['Chiffre d’affaires', 'rev'], ['EBITDA total', 'ebitdaTot'], ['Flux avant service de la dette', 'fcfPre'], ['Intérêts', 'interest'],
      ['Flux disponible pour l’acquéreur', 'fcfe'], ['Dette en fin d’année', 'debtEnd'], ['ROIC', 'roic'],
    ];
    add(t('Rendement'), [
      [UM, ...ret.rows.map((r) => r.year)], ...lines.map(([l, k]): Cell[] => [t(l), ...ret.rows.map((r) => r2(r[k]))]), [],
      [t('Fonds propres'), r2(ret.equity)], [t('TRI'), r2(ret.irr)], [t('Multiple du capital'), r2(ret.mom)],
    ], [32, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  }
  add(t('Demandes'), [
    [t('Question'), t('Thème'), t('Priorité'), t('Statut'), t('Réponse')],
    ...(d.questions || []).map((q): Cell[] => [q.q, t(q.cat), t(q.priority), t(q.status), q.answer]),
  ], [60, 12, 12, 12, 40]);
  return out;
}

export const xlsxFileName = (d: Deal) => `BOS_${slug(d.name)}.xlsx`;

/** Construit et télécharge le classeur ; renvoie le nom du fichier. SheetJS est livré avec l'application. */
export async function exportXlsx(d: Deal, meta: DealMeta, c: Computed, locale: Locale): Promise<string> {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  for (const s of xlsxSheets(d, meta, c, locale)) {
    const ws = X.utils.aoa_to_sheet(s.aoa);
    ws['!cols'] = s.cols.map((wch) => ({ wch }));
    X.utils.book_append_sheet(wb, ws, s.name);
  }
  const name = xlsxFileName(d);
  const data = X.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  download(name, new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  return name;
}
