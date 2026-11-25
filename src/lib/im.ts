/* Import d'IM : lecture du PDF dans le navigateur et repérage des indicateurs (port de extract / pdfPages / showExtract de legacy/app.js). */
import type { Deal } from '../engine/types';

export type ImKey = 'rev' | 'ebitda' | 'arr' | 'recurring' | 'churn' | 'top10' | 'netDebt' | 'askPrice';
export type ImUnit = 'M€' | '%';
export type ImValue = { n: number; ref: string; line: string };
export type ImResult = { vals: Partial<Record<ImKey, ImValue>>; year: number | null; sector: string; country: string };

/** [clé, libellé FR, unité, motif du libellé]. */
export const IM_FIELDS: [ImKey, string, ImUnit, RegExp][] = [
  ['rev', 'Chiffre d’affaires', 'M€', /chiffre d.affaires|\brevenue\b|\bca\b|\bsales\b/i],
  ['ebitda', 'EBITDA', 'M€', /\bebitda\b|\bebe\b/i],
  ['arr', 'ARR', 'M€', /\barr\b|annual recurring revenue|revenu récurrent annualisé/i],
  ['recurring', 'Revenus récurrents', '%', /revenus récurrents|part récurrente|recurring revenue/i],
  ['churn', 'Churn clients', '%', /churn|attrition/i],
  ['top10', 'Top 10 clients', '%', /top\s*10|dix premiers clients|concentration/i],
  ['netDebt', 'Dette nette', 'M€', /dette (?:financière )?nette|net debt/i],
  ['askPrice', 'VE demandée (100 %)', 'M€', /valeur d.entreprise|valorisation attendue|enterprise value|prix demandé|asking price/i],
];

const VALUE = /^[^0-9+−-]{0,40}?([+−-]?\d+(?:[   ]\d{3})*(?:[.,]\d+)?)\s*(millions?\s*(?:d[’']euros?|euros?)?|milliards?|milliers?|m\s*€|k\s*€|m€|k€|€\s*m|m(?:n)?\s*eur|k\s*eur|€|euros?|%)/i;

/** Première valeur trouvée pour chaque indicateur, avec sa page et sa ligne ; exercice, secteur et pays en tête de document. */
export function extract(pages: string[]): ImResult {
  const vals: ImResult['vals'] = {};
  for (const [key, , unit, re] of IM_FIELDS) {
    const cands: ImValue[] = [];
    pages.forEach((page, pi) => page.split(/\n/).forEach((line) => {
      const m = re.exec(line);
      if (!m) return;
      const r = line.slice(m.index + m[0].length).match(VALUE);
      if (!r || (unit === '%') !== (r[2] === '%')) return;
      let n = Number(r[1].replace(/[   ]/g, '').replace('−', '-').replace(',', '.'));
      const u = r[2].toLowerCase().replace(/\s/g, '');
      if (unit === 'M€') {
        if (u.startsWith('milliard')) n *= 1000;
        else if (/^k|^millier/.test(u)) n /= 1000;
        else if (u === '€' || u.startsWith('euro')) n /= 1e6;
      }
      if (Number.isFinite(n)) cands.push({ n, ref: 'IM p. ' + (pi + 1), line: line.trim().slice(0, 160) });
    }));
    if (cands.length) vals[key] = cands[0];
  }
  const text = pages.slice(0, 4).join('\n');
  const yr = text.match(/(?:exercice(?:\s+clos)?(?:\s+en)?|fiscal year|FY)\s*[:=]?\s*(20\d{2})/i);
  const sector = text.match(/^(?:secteur(?: d’activité)?|industry|sector)(?:\s*:\s*|\s{2,})(.{2,80})$/im);
  const country = text.match(/^(?:pays(?: du siège)?|country)(?:\s*:\s*|\s{2,})(.{2,60})$/im);
  return { vals, year: yr ? +yr[1] : null, sector: sector ? sector[1].trim() : '', country: country ? country[1].trim() : '' };
}

/** Copie du dossier avec les indicateurs cochés (dernier exercice), leurs sources, l'exercice, le secteur et le pays s'ils manquent. */
export function applyExtract(deal: Deal, r: ImResult, selected: ReadonlySet<ImKey>, fileName = ''): Deal {
  const d = structuredClone(deal);
  const v = (k: ImKey) => (selected.has(k) ? r.vals[k] ?? null : null);
  const L = d.hist.rev.length - 1;
  if (r.year) d.hist.years = d.hist.years.map((_, i) => (r.year as number) - L + i);
  const rev = v('rev'), ebitda = v('ebitda'), netDebt = v('netDebt'), ask = v('askPrice');
  if (rev) { d.hist.rev[L] = rev.n; d.refs.rev = rev.ref; }
  if (ebitda) { d.hist.ebitda[L] = ebitda.n; d.refs.ebitda = ebitda.ref; }
  for (const k of ['arr', 'recurring', 'churn', 'top10'] as const) {
    const x = v(k);
    if (x) { d.kpi[k] = x.n; d.refs[k] = x.ref; }
  }
  if (netDebt) { d.bs.netDebt = netDebt.n; d.refs.netDebt = netDebt.ref; }
  if (ask) { d.askPrice = ask.n; d.refs.askPrice = ask.ref; }
  if (r.sector && !d.sector) d.sector = r.sector;
  if (r.country && !d.country) d.country = r.country;
  if (fileName) d.source = fileName;
  d.example = false;
  return d;
}

/** Nom d'un nouveau dossier à partir du nom de fichier de l'IM. */
export const dealNameFromFile = (fileName: string, fallback: string) =>
  (fileName.replace(/\.(pdf|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || fallback);

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: { data: Uint8Array; isEvalSupported: boolean }): {
    promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }> }>;
  };
};

let pdfjs: Promise<PdfJs> | null = null;

/** pdf.js, bundled with the app (no third-party script) and loaded only when a PDF is read. Its worker is a file of
 *  the app too; if the browser cannot start it, pdf.js falls back to parsing in the page. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= (async () => {
    const mod = (await import('pdfjs-dist/legacy/build/pdf.js')) as unknown as PdfJs & { default?: PdfJs };
    const lib = mod.default ?? mod;
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.js', import.meta.url).toString();
    return lib;
  })().catch((e) => { pdfjs = null; throw e; });
  return pdfjs;
}

/** Texte des 80 premières pages d'un PDF, lu dans le navigateur avec pdf.js. */
/**
 * Rebuilds a page's text from pdf.js items. pdf.js emits explicit space items
 * between words, and many PDF generators split a word into several items, so
 * items are concatenated as-is, with a newline wherever pdf.js signals hasEOL.
 */
export function pageText(items: ReadonlyArray<{ str?: string; hasEOL?: boolean }>): string {
  return items.map((it) => (it.str ?? '') + (it.hasEOL ? '\n' : '')).join('');
}

export async function pdfPages(file: File): Promise<string[]> {
  const lib = await loadPdfJs();
  // isEvalSupported: false — no code generated from the PDF (CVE-2024-4367).
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 80); p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    pages.push(pageText(tc.items));
  }
  return pages;
}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Leaf-level differences between two versions of a deal, as [path, value] patches (arrays of equal length compared per index). */
export function patchesFor(before: unknown, after: unknown, path: string[] = []): [string[], unknown][] {
  if (Object.is(before, after)) return [];
  if (isPlain(before) && isPlain(after)) {
    return Object.keys(after).flatMap((k) => patchesFor(before[k], after[k], [...path, k]));
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    return after.flatMap((v, i) => patchesFor(before[i], v, [...path, String(i)]));
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [[path, after]];
}
