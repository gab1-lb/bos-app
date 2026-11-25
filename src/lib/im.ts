/* Import d'IM : lecture du PDF dans le navigateur et repérage des indicateurs (port de extract / pdfPages / showExtract de
   legacy/app.js), étendu à l'historique pluriannuel, au plan du management, aux retraitements du vendeur et aux autres
   données chiffrées (dette assimilée, BFR, impôt, clients, effectif, NRR, synergies).
   Le texte des PDF générés par Chromium perd souvent les deux-points, les parenthèses et les signes + / − :
   les motifs tolèrent leur absence. */
import { LISTS, newItemId, type ListItem, type ListName } from '../domain/dealShape';
import type { Deal } from '../engine/types';

export type ImKey = 'rev' | 'ebitda' | 'arr' | 'recurring' | 'churn' | 'top10' | 'netDebt' | 'askPrice';
export type ImUnit = 'M€' | '%' | '';
export type ImValue = { n: number; ref: string; line: string };
/** Ligne d'un tableau pluriannuel : une valeur par exercice. */
export type ImRow = { years: number[]; vals: (number | null)[]; ref: string; line: string };
export type ImHistKey = 'rev' | 'ebitda' | 'capex';
export type ImPlanKey = 'growth' | 'targetMargin' | 'capexPct';
export type ImOtherKey = 'debtLike' | 'nwcPct' | 'taxRate' | 'customers' | 'employees' | 'nrr' | 'synCost' | 'synRevenue';
export type ImAdjustment = { label: string; amount: number; included: boolean; ref: string; line: string };
export type ImResult = {
  vals: Partial<Record<ImKey, ImValue>>;
  year: number | null;
  sector: string;
  country: string;
  /** Historique (exercices clos, 5 derniers au plus). */
  hist: Partial<Record<ImHistKey, ImRow>>;
  /** Plan du management (exercices postérieurs au dernier exercice clos), en %. */
  plan: Partial<Record<ImPlanKey, ImRow>>;
  adjustments: ImAdjustment[];
  other: Partial<Record<ImOtherKey, ImValue>>;
};

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
export const IM_HIST_FIELDS: [ImHistKey, string][] = [['rev', 'Chiffre d’affaires'], ['ebitda', 'EBITDA'], ['capex', 'Capex']];
export const IM_PLAN_FIELDS: [ImPlanKey, string][] = [
  ['growth', 'Croissance des ventes'], ['targetMargin', 'Marge d’EBITDA cible'], ['capexPct', 'Capex (% des ventes)'],
];
export const IM_OTHER_FIELDS: [ImOtherKey, string, ImUnit][] = [
  ['debtLike', 'Éléments assimilés à la dette', 'M€'], ['nwcPct', 'BFR (% des ventes)', '%'], ['taxRate', 'Taux d’impôt', '%'],
  ['customers', 'Nombre de clients', ''], ['employees', 'Effectif', ''], ['nrr', 'Rétention nette (NRR)', '%'],
  ['synCost', 'Synergies de coûts', 'M€'], ['synRevenue', 'Synergies de revenus (EBITDA)', 'M€'],
];

const SP = '[ \\u00a0\\u202f]';
/** Nombre : « 2 300 », « 7,9 », « 1,250.5 », « 1.250,5 », « −0,4 ». */
const NUM_ABS = `(?:\\d{1,3}(?:${SP}\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)*)`;
const NUM = `[+−–-]?${NUM_ABS}`;
const UNIT = 'millions?\\s*(?:d[’\']euros?|euros?)?|milliards?|milliers?|m\\s*€|k\\s*€|m€|k€|€\\s*m|m(?:n)?\\s*eur|k\\s*eur|€|euros?';
const VALUE = new RegExp(`^[^0-9+−–-]{0,40}?(${NUM})\\s*(${UNIT}|%)`, 'i');

/** Nombre au format français ou anglais ; une seule virgule (ou un seul point) est décimale. */
export function parseNum(raw: string): number | null {
  let s = raw.trim().replace(/[\s  ]/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^[−–-]/.test(s)) { neg = true; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  const c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c >= 0 && p >= 0) s = c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = (s.match(/,/g) ?? []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

/** Montant converti en M€ selon son unité. */
function toMeur(n: number, unit: string): number {
  const u = unit.toLowerCase().replace(/\s/g, '');
  if (u.startsWith('milliard')) return n * 1000;
  if (/^k|^millier/.test(u)) return n / 1000;
  if (u === '€' || u.startsWith('euro')) return n / 1e6;
  return n;
}

const clip = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 160);
const ref = (pi: number) => 'IM p. ' + (pi + 1);

/* --- Tableaux pluriannuels --- */

/** En-tête de tableau : 2 à 6 exercices consécutifs en fin de ligne (« Exercice 2021 … 2025 », « M€ 2026 … 2030 »). */
const YEAR_HEADER = /^([^\d]{0,40}?)\s*((?:(?:19|20)\d{2}[a-zA-Z]?\s+){1,5}(?:19|20)\d{2}[a-zA-Z]?)\s*$/;
const NULL_CELL = /^(?:n\.?d\.?|n\/a|na|nm|n\.s\.?|—|–|-)$/i;
const NUM_CELL = /^[(+−–-]?\d[\d.,]*\)?%?$/;

function headerYears(line: string): number[] | null {
  const m = YEAR_HEADER.exec(line.trim());
  if (!m) return null;
  const ys = (m[2].match(/\d{4}/g) ?? []).map(Number);
  return ys.every((y, i) => i === 0 || y === ys[i - 1] + 1) ? ys : null;
}

/** Ligne « libellé v1 v2 … vn » ; les milliers séparés par une espace sont regroupés tant qu'il y a trop de valeurs. */
export function parseRow(line: string, n: number): { label: string; vals: (number | null)[]; pct: boolean } | null {
  const toks = line.trim().split(/\s+/);
  let i = toks.length;
  while (i > 0 && (toks[i - 1] === '%' || NUM_CELL.test(toks[i - 1]) || NULL_CELL.test(toks[i - 1]))) i--;
  const cells: string[] = [];
  let pct = false;
  for (const tk of toks.slice(i)) {
    if (tk === '%') { if (cells.length) { cells[cells.length - 1] += '%'; pct = true; } continue; }
    if (tk.endsWith('%')) pct = true;
    cells.push(tk);
  }
  for (let k = 0; cells.length > n && k < cells.length - 1;) {
    if (/^[+−–-]?\d{1,3}$/.test(cells[k]) && /^\d{3}(?:[.,]\d+)?%?$/.test(cells[k + 1])) cells.splice(k, 2, cells[k] + cells[k + 1]);
    else k++;
  }
  if (cells.length < n) return null;
  const extra = cells.splice(0, cells.length - n);
  const label = [...toks.slice(0, i), ...extra].join(' ').trim();
  if (!/\p{L}/u.test(label)) return null;
  const vals = cells.map((c) => (NULL_CELL.test(c) ? null : parseNum(c.replace('%', ''))));
  return { label, vals, pct };
}

type Kind = ImHistKey | 'arr' | ImPlanKey;
const REV_WORD = /chiffre d.affaires|\bventes\b|\bca\b|\brevenues?\b|\bsales\b/;
/** Nature d'une ligne d'après son libellé (et la présence de %). */
function rowKind(label: string, pct: boolean): Kind | null {
  const l = label.toLowerCase().replace(/’/g, "'");
  const ebitdaWord = /\bebitda\b|\bebe\b|excédent brut/.test(l);
  if (pct || /%|croissance|growth|marge|margin|pourcentage/.test(l)) {
    if (/croissance|growth/.test(l)) return REV_WORD.test(l) && !ebitdaWord ? 'growth' : null;
    if (/marge|margin/.test(l)) return ebitdaWord ? 'targetMargin' : null;
    if (/capex|investissements|capital expenditure/.test(l)) return 'capexPct';
    return null;
  }
  if (/\barr\b|revenu récurrent annualisé|annual recurring revenue/.test(l)) return 'arr';
  if (ebitdaWord) return 'ebitda';
  if (/\bcapex\b|investissements|capital expenditure/.test(l)) return 'capex';
  if (REV_WORD.test(l) && !/r[ée]current|recurring|co[uû]ts?\b|cost/.test(l)) return 'rev';
  return null;
}
const ADJUSTED = /retrait|ajust|adjust|normatif|normalis|pro forma/i;

type Table = { pi: number; years: number[]; rows: { kind: Kind; label: string; vals: (number | null)[]; line: string }[] };

function tables(pages: string[]): Table[] {
  const out: Table[] = [];
  pages.forEach((page, pi) => {
    const lines = page.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      const years = headerYears(lines[i]);
      if (!years) continue;
      const t: Table = { pi, years, rows: [] };
      for (let j = i + 1, miss = 0; j < lines.length && miss < 3; j++) {
        if (headerYears(lines[j])) break;
        const r = parseRow(lines[j], years.length);
        if (!r) { if (lines[j].trim()) miss++; continue; }
        miss = 0;
        const kind = rowKind(r.label, r.pct);
        if (kind) t.rows.push({ kind, label: r.label, vals: r.vals, line: clip(lines[j]) });
      }
      if (t.rows.length) out.push(t);
    }
  });
  return out;
}

/* --- Valeurs isolées (texte de la page mis à plat) --- */

type Finder = (flat: string) => { n: number; at: number; len: number } | null;
const find = (re: RegExp, f: (m: RegExpExecArray) => number | null): Finder => (flat) => {
  const m = re.exec(flat);
  if (!m) return null;
  const n = f(m);
  return n == null || !Number.isFinite(n) ? null : { n, at: m.index, len: m[0].length };
};
const G = '[^.\\d%]'; // écart sans chiffre ni fin de phrase entre un libellé et sa valeur
const meur = (m: RegExpExecArray) => { const n = parseNum(m[1]); return n == null ? null : toMeur(n, m[2]); };
const num = (m: RegExpExecArray) => parseNum(m[1]);
/** Effectif, nombre de clients : entier, séparateurs de milliers « 2 300 », « 4,200 », « 4.200 ». */
const count = (m: RegExpExecArray) => Number(m[1].replace(/[\s,.]/g, ''));
const INT = `\\d{1,3}(?:[,.${SP.slice(1, -1)}]\\d{3})+(?!\\d)|\\d+`;
const OTHER: Record<ImOtherKey, Finder[]> = {
  debtLike: [find(new RegExp(`(?:(?:éléments\\s+)?assimilés?\\s+à\\s+(?:de\\s+la\\s+|la\\s+)?dette|debt[- ]like(?:\\s+items)?)${G}{0,40}?(${NUM})\\s*(${UNIT})`, 'i'), meur)],
  nwcPct: [find(new RegExp(`(?:besoin\\s+en\\s+fonds\\s+de\\s+roulement|\\bbfr\\b|working\\s+capital|\\bnwc\\b)(${G}{0,60}?)([+−–-]?)\\s*(\\d+(?:[.,]\\d+)?)\\s*%\\s*(?:du|des|de\\s+la|of)?\\s*(?:chiffre|ventes|ca\\b|revenue|sales)`, 'i'),
    (m) => { const n = parseNum(m[3]); return n == null ? null : (/négati|negative|−|-|–/i.test(m[1] + m[2]) ? -n : n); })],
  taxRate: [find(new RegExp(`(?:taux\\s+d.(?:impôt|imposition)|\\bimpôt\\s+sur\\s+les\\s+sociétés|tax\\s+rate)${G}{0,40}?(\\d+(?:[.,]\\d+)?)\\s*%`, 'i'), num)],
  customers: [
    find(new RegExp(`(?:nombre\\s+de\\s+clients|number\\s+of\\s+customers|customer\\s+count)\\s*:?\\s*(?:de\\s+|of\\s+)?(${INT})`, 'i'), count),
    find(new RegExp(`(?:^|[^\\d.,])(?<!top\\s{0,3})(${INT})\\s+(?:établissements\\s+)?(?:clients|customers|cliniques|établissements)\\b`, 'i'), count),
  ],
  employees: [
    find(new RegExp(`(?:^|[^\\d.,])(${INT})\\s+(?:salariés|collaborateurs|employés|employees|ETP|FTE)\\b`, 'i'), count),
    find(new RegExp(`(?:effectifs?|headcount|nombre\\s+de\\s+salariés)\\s*:?\\s*(?:de\\s+|of\\s+)?(${INT})`, 'i'), count),
  ],
  nrr: [find(new RegExp(`(?:rétention\\s+nette|net\\s+revenue\\s+retention|net\\s+retention|\\bnrr\\b)${G}{0,40}?(\\d+(?:[.,]\\d+)?)\\s*%`, 'i'), num)],
  synCost: [find(new RegExp(`(?:mutualisation|synergies\\s+de\\s+coûts|cost\\s+synergies)${G}{0,120}?(${NUM})\\s*(${UNIT})`, 'i'), meur)],
  synRevenue: [find(new RegExp(`(?:ventes?\\s+croisées?|cross[- ]sell(?:ing)?|synergies\\s+de\\s+revenus|revenue\\s+synergies)${G}{0,120}?(${NUM})\\s*(${UNIT})\\s*(?:d.|of\\s+)?ebitda`, 'i'), meur)],
};

/** Retraitement du vendeur : « libellé : 0,20 M€ (inclus) » ou « (non inclus) », deux-points et parenthèses facultatifs. */
const ADJ = new RegExp(`^\\s*[•·*]?\\s*(.{3,140}?)\\s*:?\\s+([+−–-]?)\\s?(${NUM_ABS})\\s*(${UNIT})\\s*\\(?\\s*(non[\\s-]+inclus|inclus|not\\s+included|excluded|included)\\b`, 'i');

/** Les glyphes sans équivalent Unicode (deux-points, parenthèses, signes des PDF générés par Chromium) arrivent de
 *  pdf.js en zone d'usage privé : ils sont remplacés par une espace, faute de pouvoir les identifier. */
const cleanText = (s: string) => s.replace(/[\uE000-\uF8FF]/g, ' ');

/** Premier exercice « exercice 2025 », hors en-tête de tableau (« Exercice 2021 2022 … »). */
const YEAR = /(?:exercice(?:\s+clos)?(?:\s+en)?|fiscal year|FY)\s*[:=]?\s*(20\d{2})(?![\d\s]*\s(?:19|20)\d{2})/i;

/** Valeurs repérées dans l'IM, avec leur page et leur ligne : chiffres clés, historique, plan, retraitements, autres. */
export function extract(rawPages: string[]): ImResult {
  const pages = rawPages.map(cleanText);
  const vals: ImResult['vals'] = {};
  for (const [key, , unit, re] of IM_FIELDS) {
    const cands: ImValue[] = [];
    pages.forEach((page, pi) => page.split(/\n/).forEach((line) => {
      const m = re.exec(line);
      if (!m) return;
      const r = line.slice(m.index + m[0].length).match(VALUE);
      if (!r || (unit === '%') !== (r[2] === '%')) return;
      let n = parseNum(r[1]);
      if (n == null) return;
      if (unit === 'M€') n = toMeur(n, r[2]);
      if (Number.isFinite(n)) cands.push({ n, ref: ref(pi), line: clip(line) });
    }));
    if (cands.length) vals[key] = cands[0];
  }
  const text = pages.slice(0, 4).join('\n');
  const yr = text.match(YEAR);
  const sector = text.match(/^(?:secteur(?: d’activité)?|industry|sector)(?:\s*:\s*|[ \t]{2,})(.{2,80})$/im);
  const country = text.match(/^(?:pays(?: du siège)?|country)(?:\s*:\s*|[ \t]{2,})(.{2,60})$/im);

  // Tableaux : les exercices jusqu'au dernier exercice clos forment l'historique, les suivants le plan.
  const tbs = tables(pages);
  let year = yr ? +yr[1] : null;
  const firstHist = tbs.find((t) => t.rows.some((r) => ['rev', 'ebitda', 'capex', 'arr'].includes(r.kind)));
  year ??= firstHist ? firstHist.years[firstHist.years.length - 1] : null;
  const hist: ImResult['hist'] = {}, plan: ImResult['plan'] = {};
  const adjusted: Partial<Record<Kind, boolean>> = {};
  for (const t of tbs) {
    for (const r of t.rows) {
      const isPlan = r.kind === 'growth' || r.kind === 'targetMargin' || r.kind === 'capexPct';
      const keep = t.years.map((y) => (isPlan ? year == null || y > year : year == null || y <= year));
      const years = t.years.filter((_, i) => keep[i]).slice(isPlan ? 0 : -5);
      const v = r.vals.filter((_, i) => keep[i]).slice(isPlan ? 0 : -5);
      if (!years.length || v.every((x) => x == null)) continue;
      const row: ImRow = { years, vals: v, ref: ref(t.pi), line: r.line };
      const adj = ADJUSTED.test(r.label);
      if (r.kind === 'arr') {
        const n = year == null ? v[v.length - 1] : v[years.indexOf(year)];
        if (!vals.arr && n != null) vals.arr = { n, ref: row.ref, line: row.line };
        continue;
      }
      const into = (isPlan ? plan : hist) as Partial<Record<Kind, ImRow>>;
      if (into[r.kind] && !(adjusted[r.kind] && !adj)) continue;
      into[r.kind] = row;
      adjusted[r.kind] = adj;
    }
  }

  const adjustments: ImAdjustment[] = [];
  pages.forEach((page, pi) => page.split(/\n/).forEach((line) => {
    const m = ADJ.exec(line);
    if (!m) return;
    const label = m[1].replace(/[\s:–—-]+$/, '').trim();
    const n = parseNum(m[3]);
    if (n == null || !/\p{L}/u.test(label)) return;
    adjustments.push({
      label, amount: (/[−–-]/.test(m[2]) ? -1 : 1) * toMeur(n, m[4]),
      included: !/non|not|excluded/i.test(m[5]), ref: ref(pi), line: clip(line),
    });
  }));

  const other: ImResult['other'] = {};
  const flats = pages.map((p) => p.replace(/\s+/g, ' '));
  for (const [key] of IM_OTHER_FIELDS) {
    for (const f of OTHER[key]) {
      const pi = flats.findIndex((fl) => f(fl));
      if (pi < 0) continue;
      const hit = f(flats[pi])!;
      other[key] = { n: hit.n, ref: ref(pi), line: clip(flats[pi].slice(hit.at, hit.at + hit.len)) };
      break;
    }
  }

  return { vals, year, sector: sector ? clip(sector[1]) : '', country: country ? clip(country[1]) : '', hist, plan, adjustments, other };
}

/** Clés de sélection de tout ce qui a été repéré : chiffres clés (ImKey), `hist.<clé>`, `plan.<clé>`, `adj.<n>`, autres (ImOtherKey). */
export function extractKeys(r: ImResult): string[] {
  return [
    ...IM_FIELDS.filter(([k]) => r.vals[k]).map(([k]) => k),
    ...IM_HIST_FIELDS.filter(([k]) => r.hist[k]).map(([k]) => `hist.${k}`),
    ...IM_PLAN_FIELDS.filter(([k]) => r.plan[k]).map(([k]) => `plan.${k}`),
    ...r.adjustments.map((_, i) => `adj.${i}`),
    ...IM_OTHER_FIELDS.filter(([k]) => r.other[k]).map(([k]) => k),
  ];
}

const lastVal = (row: ImRow) => [...row.vals].reverse().find((v): v is number => v != null) ?? null;

/** Plan : valeurs retenues pour chaque ligne (croissance sur 5 ans, dernière valeur pour la marge et le capex). */
export function planValue(row: ImRow, key: ImPlanKey, slots = 5): number | (number | null)[] | null {
  if (key !== 'growth') return lastVal(row);
  const v = row.vals.slice(0, slots);
  const fill = lastVal({ ...row, vals: v });
  return Array.from({ length: slots }, (_, i) => v[i] ?? (i >= v.length ? fill : null));
}

/** Copie du dossier avec les éléments cochés, leurs sources, l'exercice, le secteur et le pays s'ils manquent.
 *  Les valeurs des chiffres clés priment sur la dernière colonne de l'historique ; les retraitements déjà présents
 *  (même libellé) ne sont pas ajoutés deux fois. */
export function applyExtract(deal: Deal, r: ImResult, selected: ReadonlySet<string>, fileName = ''): Deal {
  const d = structuredClone(deal);
  const v = (k: ImKey) => (selected.has(k) ? r.vals[k] ?? null : null);
  const L = d.hist.years.length - 1;
  if (r.year) d.hist.years = d.hist.years.map((_, i) => (r.year as number) - L + i);
  for (const [k] of IM_HIST_FIELDS) {
    const row = r.hist[k];
    if (!row || !selected.has(`hist.${k}`)) continue;
    row.years.forEach((y, i) => {
      const at = d.hist.years.indexOf(y);
      if (at >= 0 && row.vals[i] != null) d.hist[k][at] = row.vals[i];
    });
    d.refs[k] = row.ref;
  }
  const rev = v('rev'), ebitda = v('ebitda'), netDebt = v('netDebt'), ask = v('askPrice');
  if (rev) { d.hist.rev[L] = rev.n; d.refs.rev = rev.ref; }
  if (ebitda) { d.hist.ebitda[L] = ebitda.n; d.refs.ebitda = ebitda.ref; }
  for (const k of ['arr', 'recurring', 'churn', 'top10'] as const) {
    const x = v(k);
    if (x) { d.kpi[k] = x.n; d.refs[k] = x.ref; }
  }
  if (netDebt) { d.bs.netDebt = netDebt.n; d.refs.netDebt = netDebt.ref; }
  if (ask) { d.askPrice = ask.n; d.refs.askPrice = ask.ref; }

  const pl = (k: ImPlanKey) => (selected.has(`plan.${k}`) ? r.plan[k] ?? null : null);
  const growth = pl('growth'), margin = pl('targetMargin'), capexPct = pl('capexPct');
  if (growth) { d.plan.growth = planValue(growth, 'growth', d.plan.growth.length || 5) as (number | null)[]; d.refs.growth = growth.ref; }
  if (margin) { d.plan.targetMargin = lastVal(margin); d.refs.targetMargin = margin.ref; }
  if (capexPct) { d.plan.capexPct = lastVal(capexPct); d.refs.capexPct = capexPct.ref; }

  const have = new Set(d.adjustments.map((a) => a.label.trim().toLowerCase()));
  r.adjustments.forEach((a, i) => {
    if (!selected.has(`adj.${i}`) || have.has(a.label.toLowerCase())) return;
    have.add(a.label.toLowerCase());
    d.adjustments.push({ id: newItemId(), label: a.label, amount: a.amount, included: a.included, status: 'À confirmer' });
  });

  const o = (k: ImOtherKey) => (selected.has(k) ? r.other[k] ?? null : null);
  const set = (k: ImOtherKey, write: (n: number) => void) => {
    const x = o(k);
    if (x) { write(x.n); d.refs[k] = x.ref; }
  };
  set('debtLike', (n) => { d.bs.debtLike = n; });
  set('nwcPct', (n) => { d.plan.nwcPct = n; });
  set('taxRate', (n) => { d.plan.taxRate = n; });
  set('customers', (n) => { d.kpi.customers = n; });
  set('employees', (n) => { d.kpi.employees = n; });
  set('nrr', (n) => { d.kpi.nrr = n; });
  set('synCost', (n) => { d.synergies.cost = n; });
  set('synRevenue', (n) => { d.synergies.revenue = n; });

  if (r.sector && !d.sector) d.sector = r.sector;
  if (r.country && !d.country) d.country = r.country;
  if (fileName) d.source = fileName;
  d.example = false;
  return d;
}

/** Écritures pour appliquer `after` à un dossier existant : correctifs feuille à feuille (patchesFor) hors listes,
 *  et lignes de liste nouvelles à ajouter une à une (appendItem), pour ne rien écraser des modifications concurrentes. */
export function importWrites(before: Deal, after: Deal): { patches: [string[], unknown][]; items: { list: ListName; item: ListItem }[] } {
  const items = LISTS.flatMap((list) => {
    const ids = new Set((before[list] as ListItem[]).map((x) => x.id));
    return (after[list] as ListItem[]).filter((x) => !ids.has(x.id)).map((item) => ({ list, item }));
  });
  const rest: Record<string, unknown> = { ...after };
  for (const list of LISTS) rest[list] = before[list];
  return { patches: patchesFor(before, rest), items };
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
