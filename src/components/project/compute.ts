/* Calculs partagés par les onglets du projet (port de compute / ffRows / missingQuestions de legacy/app.js). */
import { N, base, comps, dcf, maxPrice, returns } from '../../engine/finance';
import { screen } from '../../engine/screen';
import type { Base, CompsResult, Dcf, Deal, Mandate, Question, Returns, Screen } from '../../engine/types';

export type ValKind = 'evEbitda' | 'evRev' | 'dcf' | 'maxPrice';
export type ValRow = { kind: ValKind; lo: number; mid: number; hi: number };

export type Computed = {
  b: Base; cp: CompsResult; dc: Dcf | null; ret: Returns | null; sc: Screen; hurdle: number;
  rows: ValRow[]; mp: number | null;
};

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

export function compute(d: Deal, mandate: Mandate): Computed {
  const b = base(d), cp = comps(d), dc = dcf(d), ret = returns(d);
  const hurdle = N(mandate.hurdle) ?? 15;
  const sc = screen(d, mandate, cp, ret);
  const rows: ValRow[] = [];
  const ae = b.adjEbitda, rev = b.rev;
  if (cp.evEbitda.n && ae != null && ae > 0) {
    rows.push({ kind: 'evEbitda', lo: cp.evEbitda.q1! * ae, mid: cp.evEbitda.med! * ae, hi: cp.evEbitda.q3! * ae });
  }
  if (cp.evRev.n && rev != null && rev > 0) {
    rows.push({ kind: 'evRev', lo: cp.evRev.q1! * rev, mid: cp.evRev.med! * rev, hi: cp.evRev.q3! * rev });
  }
  const w = N(d.dcf.wacc), g = N(d.dcf.g);
  if (dc && w != null && g != null) {
    const vs = ([[w + 1, g - 0.5], [w + 1, g + 0.5], [w - 1, g - 0.5], [w - 1, g + 0.5]] as const)
      .map(([a, z]) => dcf(d, a, z)?.ev).filter(ok);
    if (vs.length) rows.push({ kind: 'dcf', lo: Math.min(...vs), mid: dc.ev, hi: Math.max(...vs) });
  }
  const mp = maxPrice(d, hurdle);
  if (mp != null) {
    const a = maxPrice(d, hurdle + 3), z = maxPrice(d, Math.max(1, hurdle - 3));
    rows.push({ kind: 'maxPrice', lo: a ?? mp, mid: mp, hi: z ?? mp });
  }
  return { b, cp, dc, ret, sc, hurdle, rows, mp };
}

type Fx = { t(k: string, ...a: (string | number)[]): string; mx(n: number, d?: number): string; pc(n: number, d?: number): string; nf(n: number, d?: number): string };

/** Libellés des jauges (méthode + détail), selon la langue. */
export function gaugeLabels(row: ValRow, c: Computed, d: Deal, f: Fx): { label: string; sub: string } {
  const { cp } = c;
  switch (row.kind) {
    case 'evEbitda':
      return { label: f.t('Transactions · VE / EBITDA'), sub: `${f.mx(cp.evEbitda.q1!)} – ${f.mx(cp.evEbitda.q3!)} · ${cp.evEbitda.n} ${f.t('opérations')}` };
    case 'evRev':
      return { label: f.t('Transactions · VE / CA'), sub: `${f.mx(cp.evRev.q1!)} – ${f.mx(cp.evRev.q3!)}` };
    case 'dcf':
      return { label: 'DCF', sub: `WACC ${f.pc(N(d.dcf.wacc)!)} ± 1 · g ${f.pc(N(d.dcf.g)!)} ± ${f.nf(0.5)}` };
    case 'maxPrice':
      return { label: f.t('Prix max · rendement cible'), sub: f.t('TRI {0} ± 3 pts', f.pc(c.hurdle, 0)) };
  }
}

/** Données de la grille sans question associée : [libellé, question FR, thème, priorité]. */
export function missingQuestions(d: Deal, b: Base, tr: (k: string) => string): [string, string, string, string][] {
  const have = (d.questions || []).map((q) => (q.q || '').toLowerCase());
  const list: [string, boolean, string, string, string][] = [
    ['Top 10 clients', b.top10 == null, 'Quelle part du CA représentent les dix premiers clients ?', 'Commercial', 'Décisive'],
    ['Dette nette', b.netDebt == null, 'Montant et détail de la dette financière nette à la clôture', 'Financier', 'Décisive'],
    ['Prix demandé', b.ask == null, 'Quelle valeur d’entreprise le vendeur attend-il pour 100 % du capital ?', 'Financier', 'Décisive'],
    ['Churn clients', b.churn == null, 'Taux annuel de perte de clients sur trois exercices', 'Commercial', 'Importante'],
    ['Revenus récurrents', b.recurring == null, 'Répartition du CA : abonnements, maintenance, licences, services', 'Financier', 'Importante'],
    ['ARR', b.arr == null, 'Revenu récurrent annualisé à la clôture et sa formation', 'Financier', 'Normale'],
  ];
  return list
    .filter((x) => x[1] && !have.some((h) => h.includes(tr(x[2]).toLowerCase().slice(0, 25))))
    .map((x) => [x[0], tr(x[2]), x[3], x[4]]);
}

/** Copie de `obj` avec la valeur au chemin donné (mise à jour optimiste). */
export function setIn<T>(obj: T, path: string[], value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  const src = obj as unknown as Record<string, unknown>;
  const copy = (Array.isArray(obj) ? [...(obj as unknown[])] : { ...src }) as Record<string, unknown>;
  copy[k] = setIn(src?.[k], rest, value);
  return copy as T;
}

/** Question with a new sent date; the status follows (Ouverte ↔ Envoyée) unless already answered. */
export function withSent(q: Question, sentAt: string | null): Question {
  const status = q.answeredAt ? q.status : sentAt ? (q.status === 'Ouverte' ? 'Envoyée' : q.status) : 'Ouverte';
  return { ...q, sentAt, status };
}

/** Question with a new answer date; clearing it falls back to Envoyée (sent) or Ouverte. */
export function withAnswered(q: Question, answeredAt: string | null): Question {
  const status = answeredAt ? 'Répondue' : q.sentAt ? 'Envoyée' : 'Ouverte';
  return { ...q, answeredAt, status };
}
