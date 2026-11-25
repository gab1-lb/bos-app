/* ===== BOS · données manquantes d'un dossier (fonctions pures) ===== */
import { N, comps } from '../engine/finance';
import { DEFAULT_MANDATE } from '../engine/samples';
import { screen } from '../engine/screen';
import type { Deal, Question } from '../engine/types';
import type { DealMeta } from './phases';

export type MissingGroup = 'grid' | 'key' | 'hist' | 'plan' | 'val' | 'thesis' | 'sheet';
/** Groupes dans l'ordre d'affichage ; une donnée n'apparaît que dans le premier groupe qui la demande. */
export const MISSING_GROUPS: MissingGroup[] = ['grid', 'key', 'hist', 'plan', 'val', 'thesis', 'sheet'];
export const GROUP_LABEL: Record<MissingGroup, string> = {
  grid: 'Grille d’analyse', key: 'Chiffres clés', hist: 'Historique', plan: 'Plan',
  val: 'Valorisation', thesis: 'Thèse', sheet: 'Fiche',
};

export type MissingTab = 'financiers' | 'valorisation' | 'demandes';
/** meur : montant en M€ ; pctRev : % du CA ; fte : effectif. */
export type MissingUnit = 'meur' | '%' | 'pctRev' | 'fte' | 'count';
export type SellerTopic = 'top10' | 'netDebt' | 'askPrice' | 'churn' | 'recurring' | 'history';

export interface MissingItem {
  /** Identifiant stable de la donnée (chemin pour un champ simple). */
  key: string;
  group: MissingGroup;
  labelKey: string;
  labelArgs?: (string | number)[];
  /** Chemin du champ dans le deal (saisie en ligne). */
  path?: string[];
  unit?: MissingUnit;
  decimals?: number;
  kind: 'number' | 'text' | 'link';
  /** Onglet et élément à atteindre pour compléter. */
  tab?: MissingTab;
  anchor?: string;
  askSeller?: boolean;
  /** Sujet de la question au vendeur (quand askSeller). */
  topic?: SellerTopic;
  /** Critère de la grille qui attend cette donnée (libellé). */
  crit?: string;
}

/** Questions types au vendeur (FR, traduites à l'affichage) : texte, thème, priorité. */
export const SELLER_QUESTIONS: Record<SellerTopic | 'arr', { q: string; cat: string; priority: string }> = {
  top10: { q: 'Quelle part du CA représentent les dix premiers clients ?', cat: 'Commercial', priority: 'Décisive' },
  netDebt: { q: 'Montant et détail de la dette financière nette à la clôture', cat: 'Financier', priority: 'Décisive' },
  askPrice: { q: 'Quelle valeur d’entreprise le vendeur attend-il pour 100 % du capital ?', cat: 'Financier', priority: 'Décisive' },
  churn: { q: 'Taux annuel de perte de clients sur trois exercices', cat: 'Commercial', priority: 'Importante' },
  recurring: { q: 'Répartition du CA : abonnements, maintenance, licences, services', cat: 'Financier', priority: 'Importante' },
  arr: { q: 'Revenu récurrent annualisé à la clôture et sa formation', cat: 'Financier', priority: 'Normale' },
  history: { q: 'Comptes de résultat des cinq derniers exercices : CA, EBITDA et capex', cat: 'Financier', priority: 'Importante' },
};

const PREFIX = 25;
/** Une question proche existe déjà (même début de texte, en français ou dans la langue affichée). */
export function hasSimilarQuestion(questions: Question[] | null | undefined, text: string, tr: (k: string) => string = (k) => k): boolean {
  const heads = [text, tr(text)].map((s) => s.toLowerCase().slice(0, PREFIX));
  return (questions || []).some((q) => {
    const have = (q.q || '').toLowerCase();
    return heads.some((h) => have.includes(h));
  });
}

const empty = (s: string | null | undefined) => !(s || '').trim();

export function missingItems(deal: Deal, meta: DealMeta): MissingItem[] {
  const d = deal, h = d.hist, L = h.years.length - 1;
  const canAsk = meta.phase !== 'decided';
  const out: MissingItem[] = [];
  const seen = new Set<string>();
  const add = (it: MissingItem) => {
    if (seen.has(it.key)) return;
    seen.add(it.key);
    out.push(it.topic && canAsk ? { ...it, askSeller: true } : { ...it, topic: undefined });
  };

  // Champs simples, réutilisés par plusieurs groupes.
  const num = (path: string[], labelKey: string, unit: MissingUnit, o: Partial<MissingItem> = {}): MissingItem =>
    ({ key: path.join('.'), group: 'key', labelKey, path, unit, kind: 'number', tab: 'financiers', anchor: `f-${path.join('.')}`, ...o });
  const histCell = (row: 'rev' | 'ebitda' | 'capex', i: number) => num(['hist', row, String(i)],
    row === 'rev' ? 'Chiffre d’affaires {0}' : row === 'ebitda' ? 'EBITDA {0}' : 'Capex {0}', 'meur',
    { labelArgs: [h.years[i]], decimals: row === 'rev' ? 1 : 2, topic: 'history' });
  const F = {
    rev: () => histCell('rev', L),
    revPrev: () => histCell('rev', L - 1),
    ebitda: () => histCell('ebitda', L),
    arr: () => num(['kpi', 'arr'], 'ARR', 'meur'),
    recurring: () => num(['kpi', 'recurring'], 'Revenus récurrents', '%', { decimals: 0, topic: 'recurring' }),
    churn: () => num(['kpi', 'churn'], 'Churn clients', '%', { topic: 'churn' }),
    nrr: () => num(['kpi', 'nrr'], 'Rétention nette (NRR)', '%', { decimals: 0 }),
    top10: () => num(['kpi', 'top10'], 'Top 10 clients', 'pctRev', { decimals: 0, topic: 'top10' }),
    customers: () => num(['kpi', 'customers'], 'Nombre de clients', 'count', { decimals: 0 }),
    employees: () => num(['kpi', 'employees'], 'Effectif', 'fte', { decimals: 0 }),
    netDebt: () => num(['bs', 'netDebt'], 'Dette nette', 'meur', { topic: 'netDebt' }),
    debtLike: () => num(['bs', 'debtLike'], 'Éléments assimilés à la dette', 'meur'),
    askPrice: () => num(['askPrice'], 'VE demandée (100 %)', 'meur', { topic: 'askPrice' }),
  };
  const isNull = (v: unknown) => N(v) == null;
  const cp = comps(d);
  const noComps = cp.evEbitda.n === 0;
  const compsItem = (group: MissingGroup, crit?: string): MissingItem => ({
    key: 'comps', group, labelKey: 'Transactions comparables', kind: 'link', tab: 'valorisation', anchor: 'comps', crit,
  });

  // 1. Grille d'analyse : critères sans note, rattachés aux données qui manquent.
  const crit = screen(d, DEFAULT_MANDATE, cp, null).crit;
  for (const k of crit) {
    if (k.pts != null) continue;
    const need: MissingItem[] = [];
    const rev = isNull(h.rev[L]), ebitda = isNull(h.ebitda[L]);
    if (k.k === 'growth') {
      if (rev) need.push(F.rev());
      if (L > 0 && isNull(h.rev[L - 1])) need.push(F.revPrev());
    } else if (k.k === 'margin') {
      if (rev) need.push(F.rev());
      if (ebitda) need.push(F.ebitda());
    } else if (k.k === 'leverage') {
      if (isNull(d.bs.netDebt)) need.push(F.netDebt());
      if (ebitda) need.push(F.ebitda());
    } else if (k.k === 'price') {
      if (isNull(d.askPrice)) need.push(F.askPrice());
      if (ebitda) need.push(F.ebitda());
      if (noComps) need.push(compsItem('grid'));
    } else if (k.k in F) {
      need.push(F[k.k as keyof typeof F]());
    }
    // Données présentes mais critère incalculable (CA ou EBITDA négatif…) : renvoi vers les chiffres.
    if (!need.length) need.push({ key: `crit.${k.k}`, group: 'grid', labelKey: k.label, kind: 'link', tab: k.k === 'price' ? 'valorisation' : 'financiers' });
    for (const it of need) add({ ...it, group: 'grid', crit: k.label });
  }

  // 2. Chiffres clés.
  const keys: [keyof typeof F, unknown][] = [
    ['rev', h.rev[L]], ['ebitda', h.ebitda[L]], ['arr', d.kpi.arr], ['recurring', d.kpi.recurring], ['churn', d.kpi.churn],
    ['top10', d.kpi.top10], ['nrr', d.kpi.nrr], ['netDebt', d.bs.netDebt], ['debtLike', d.bs.debtLike], ['askPrice', d.askPrice],
    ['customers', d.kpi.customers], ['employees', d.kpi.employees],
  ];
  for (const [k, v] of keys) if (isNull(v)) add(F[k]());

  // 3. Historique : une ligne par série incomplète (les cellules déjà listées plus haut sont exclues).
  const ROWS = [['rev', 'Chiffre d’affaires : {0}'], ['ebitda', 'EBITDA : {0}'], ['capex', 'Capex : {0}']] as const;
  for (const [row, labelKey] of ROWS) {
    const idx = h.years.map((_, i) => i).filter((i) => isNull(h[row][i]) && !seen.has(`hist.${row}.${i}`));
    if (!idx.length) continue;
    add({
      key: `hist.${row}`, group: 'hist', labelKey, labelArgs: [idx.map((i) => h.years[i]).join(', ')], kind: 'link',
      tab: 'financiers', anchor: `f-hist.${row}.${idx[0]}`, topic: 'history',
    });
  }

  // 4. Plan.
  if (isNull(d.plan.targetMargin)) add(num(['plan', 'targetMargin'], 'Marge d’EBITDA cible', '%', { group: 'plan' }));
  d.plan.growth.forEach((g, i) => {
    if (isNull(g)) add(num(['plan', 'growth', String(i)], 'Croissance an {0}', '%', { group: 'plan', labelArgs: [i + 1] }));
  });

  // 5. Valorisation.
  if (noComps) add(compsItem('val'));
  const w = N(d.dcf.wacc), g = N(d.dcf.g);
  if (w == null || g == null || w <= g) {
    add({ key: 'dcf', group: 'val', labelKey: 'Paramètres du DCF (WACC supérieur à g)', kind: 'link', tab: 'valorisation', anchor: 'f-dcf.wacc' });
  }

  // 6. Thèse.
  if (empty(d.thesis)) add({ key: 'thesis', group: 'thesis', labelKey: 'Pourquoi acheter', kind: 'link', tab: 'demandes', anchor: 'f-thesis' });
  if (empty(d.risks)) add({ key: 'risks', group: 'thesis', labelKey: 'Ce qui invaliderait la thèse', kind: 'link', tab: 'demandes', anchor: 'f-risks' });

  // 7. Fiche.
  if (empty(d.sector)) add({ key: 'sector', group: 'sheet', labelKey: 'Secteur', path: ['sector'], kind: 'text', tab: 'demandes', anchor: 'f-sector' });
  if (empty(d.country)) add({ key: 'country', group: 'sheet', labelKey: 'Pays', path: ['country'], kind: 'text', tab: 'demandes', anchor: 'f-country' });

  return out;
}

/** Question à ajouter pour cette donnée, ou null (rien à demander, ou question proche déjà posée). */
export function sellerQuestion(deal: Deal, item: MissingItem, tr: (k: string) => string = (k) => k): { q: string; cat: string; priority: string } | null {
  if (!item.askSeller || !item.topic) return null;
  const s = SELLER_QUESTIONS[item.topic];
  if (hasSimilarQuestion(deal.questions, s.q, tr)) return null;
  return { q: tr(s.q), cat: s.cat, priority: s.priority };
}
