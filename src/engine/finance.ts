/* ===== BOS · modèle financier (fonctions pures) — port de legacy/model.js ===== */
import type {
  Base, CompRow, CompsResult, Dcf, DcfRow, Deal, PlanRow, Returns, ReturnsOpts, ReturnsRow, Stats,
} from './types';

export const N = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(+(v as number)) ? null : +(v as number);
export const sum = (a: (number | null | undefined)[]): number => a.reduce<number>((s, x) => s + (x || 0), 0);
export const last = <T>(a: T[] | null | undefined): T | null => (a && a.length ? a[a.length - 1] : null);
/** `x > 0` du JS d'origine : faux pour null. */
const pos = (x: number | null | undefined): x is number => x != null && x > 0;

export function quantile(arr: (number | null | undefined)[], p: number): number | null {
  const a = (arr.filter((x) => Number.isFinite(x)) as number[]).sort((x, y) => x - y);
  if (!a.length) return null;
  const n = (a.length - 1) * p, i = Math.floor(n);
  return a[i] + (n - i) * ((a[Math.ceil(n)] ?? a[i]) - a[i]);
}

export function irr(flows: number[]): number | null {
  // bisection sur [-99 %, +1000 %]
  const npv = (r: number) => flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 10, flo = npv(lo);
  const fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) { hi = mid; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/* --- Données de base --- */
export function base(d: Deal): Base {
  const h = d.hist, n = h.years.length;
  const rev = N(last(h.rev)), revPrev = n > 1 ? N(h.rev[n - 2]) : null;
  const ebitda = N(last(h.ebitda)), ebitdaPrev = n > 1 ? N(h.ebitda[n - 2]) : null;
  let adjNet = 0;
  for (const a of d.adjustments || []) {
    const amt = N(a.amount) || 0;
    const kept = a.status === 'Accepté';
    if (kept && !a.included) adjNet += amt;
    if (!kept && a.included) adjNet -= amt;
  }
  const adjEbitda = ebitda == null ? null : ebitda + adjNet;
  const growth = rev != null && pos(revPrev) ? 100 * (rev / revPrev - 1) : null;
  const margin = adjEbitda != null && pos(rev) ? 100 * adjEbitda / rev : null;
  const marginPrev = ebitdaPrev != null && pos(revPrev) ? 100 * ebitdaPrev / revPrev : null;
  const cagr = (() => {
    const f = N(h.rev[0]);
    if (!pos(f) || !pos(rev) || n < 2) return null;
    return 100 * (Math.pow(rev / f, 1 / (n - 1)) - 1);
  })();
  const netDebt = N(d.bs.netDebt), debtLike = N(d.bs.debtLike) || 0;
  const ask = N(d.askPrice);
  return {
    year: last(h.years), rev, revPrev, ebitda, adjNet, adjEbitda, growth, cagr, margin, marginPrev,
    arr: N(d.kpi.arr), recurring: N(d.kpi.recurring), churn: N(d.kpi.churn), nrr: N(d.kpi.nrr),
    top10: N(d.kpi.top10), netDebt, debtLike, ask,
    leverage: netDebt != null && pos(adjEbitda) ? netDebt / adjEbitda : null,
    askEvEbitda: ask != null && pos(adjEbitda) ? ask / adjEbitda : null,
    askEvRev: ask != null && pos(rev) ? ask / rev : null,
    rule40: growth != null && margin != null ? growth + margin : null,
  };
}

/* --- Plan d'affaires autonome (5 ans, prolongé si besoin) --- */
export function plan(
  d: Deal, years: number, opts: { growthShift?: number; marginShift?: number } = {},
): PlanRow[] | null {
  const b = base(d), p = d.plan, out: PlanRow[] = [];
  if (!pos(b.rev) || b.adjEbitda == null) return null;
  const gArr = p.growth.map(N);
  const m0 = b.adjEbitda / b.rev;
  const mT = (N(p.targetMargin) ?? m0 * 100) / 100 + (opts.marginShift || 0) / 100;
  let rev = b.rev, nwcPrev = (N(p.nwcPct) || 0) / 100 * b.rev;
  for (let t = 1; t <= years; t++) {
    const g = (t <= gArr.length ? (gArr[t - 1] ?? 0) : (N(p.longGrowth) ?? 3)) + (opts.growthShift || 0);
    const prevRev = rev; rev = rev * (1 + g / 100);
    const m = t >= gArr.length ? mT : m0 + (mT - m0) * t / gArr.length;
    const ebitda = rev * m;
    const da = rev * (N(p.daPct) || 0) / 100;
    const capex = rev * (N(p.capexPct) || 0) / 100;
    const nwc = rev * (N(p.nwcPct) || 0) / 100, dNwc = nwc - nwcPrev; nwcPrev = nwc;
    out.push({ t, year: (b.year ?? 0) + t, g, rev, ebitda, margin: 100 * m, da, capex, dNwc, prevRev });
  }
  return out;
}

/* --- DCF --- */
export function dcf(d: Deal, wacc: number | null = N(d.dcf.wacc), g: number | null = N(d.dcf.g)): Dcf | null {
  const yrs = d.plan.growth.length, pl = plan(d, yrs), tax = (N(d.plan.taxRate) || 0) / 100;
  if (!pl || wacc == null || g == null || wacc <= g) return null;
  const w = wacc / 100, gg = g / 100;
  let pv = 0;
  const rows: DcfRow[] = pl.map((r) => {
    const ebit = r.ebitda - r.da, taxes = Math.max(0, ebit) * tax;
    const fcf = r.ebitda - taxes - r.capex - r.dNwc;
    const df = 1 / Math.pow(1 + w, r.t - 0.5); // convention mi-année
    pv += fcf * df;
    return { ...r, ebit, taxes, fcf, df, pv: fcf * df };
  });
  const lastRow = rows[rows.length - 1];
  const tv = lastRow.fcf * (1 + gg) / (w - gg), pvTv = tv / Math.pow(1 + w, yrs - 0.5);
  const ev = pv + pvTv;
  return { rows, pv, tv, pvTv, ev, tvShare: pvTv / ev, impliedExit: tv / lastRow.ebitda };
}

/* --- Comparables --- */
export function comps(d: Deal): CompsResult {
  const rows: CompRow[] = (d.comps || []).map((c) => {
    const ev = N(c.ev), rev = N(c.rev), eb = N(c.ebitda);
    return { ...c, evRev: ev != null && pos(rev) ? ev / rev : null, evEbitda: ev != null && pos(eb) ? ev / eb : null };
  });
  const sel = rows.filter((r) => r.include);
  const s = (k: 'evRev' | 'evEbitda'): Stats => ({
    q1: quantile(sel.map((r) => r[k]), .25),
    med: quantile(sel.map((r) => r[k]), .5),
    q3: quantile(sel.map((r) => r[k]), .75),
    n: sel.filter((r) => Number.isFinite(r[k])).length,
  });
  return { rows, evRev: s('evRev'), evEbitda: s('evEbitda') };
}

/* --- Modèle de rendement acquéreur / LBO --- */
export function returns(d: Deal, o: ReturnsOpts = {}): Returns | null {
  const b = base(d), f = d.financing, s = d.synergies;
  const H = o.hold ?? (N(f.hold) || 7);
  const ev = o.ev ?? N(f.entryEv) ?? b.ask;
  if (!pos(ev) || !pos(b.adjEbitda)) return null;
  const adjE = b.adjEbitda;
  const pl = plan(d, H, { growthShift: o.growthShift, marginShift: o.marginShift });
  if (!pl) return null;
  const tax = (N(d.plan.taxRate) || 0) / 100;
  const fees = ev * (N(f.feesPct) || 0) / 100;
  const debt0 = (o.leverage ?? (N(f.leverage) || 0)) * adjE;
  const debtLike = b.debtLike || 0;
  const uses = ev + fees + debtLike; // VE (titres + refinancement dette nette) + frais + éléments assimilés
  const equity = uses - debt0;
  const rate = (N(f.rate) || 0) / 100, amortY = N(f.amortYears) || 0;
  const ramp = Math.max(1, N(s.rampYears) || 1);
  const synRun = (N(s.cost) || 0) + (N(s.revenue) || 0);
  const synMult = o.synergyMult ?? 1;
  let debt = debt0, cum = -equity, payback: number | null = null;
  const rows: ReturnsRow[] = [];
  const flows = [-equity];
  for (const r of pl) {
    const syn = synRun * synMult * Math.min(1, r.t / ramp);
    const integ = r.t === 1 ? (N(s.integrationCost) || 0) : 0;
    const ebitda = r.ebitda + syn;
    const interest = debt * rate;
    const ebt = ebitda - r.da - interest - integ;
    const taxes = Math.max(0, ebt) * tax;
    const fcfPre = ebitda - integ - taxes - r.capex - r.dNwc; // flux avant service de la dette
    const amort = amortY > 0 ? Math.min(debt, debt0 / amortY) : 0;
    let fcfe = fcfPre - interest - amort;
    let sweep = 0;
    if (f.sweep && fcfe > 0) { sweep = Math.min(debt - amort, fcfe); fcfe -= sweep; }
    const debtEnd = debt - amort - sweep;
    const nopat = (ebitda - r.da) * (1 - tax);
    const roic = nopat / (uses + (N(s.integrationCost) || 0));
    rows.push({
      ...r, syn, integ, ebitdaTot: ebitda, interest, taxes, fcfPre, amort, sweep, fcfe, debtStart: debt, debtEnd,
      lev: ebitda > 0 ? debtEnd / ebitda : null, cover: interest > 0 ? ebitda / interest : null, roic, cashYield: fcfPre / uses,
    });
    debt = debtEnd;
    flows.push(fcfe);
    cum += fcfe; if (payback == null && cum >= 0) payback = r.t;
  }
  const lastRow = rows[rows.length - 1];
  const exitMult = o.exitMult ?? N(f.exitMultiple) ?? (ev / adjE);
  const exitEv = lastRow.ebitdaTot * exitMult;
  const exitEq = exitEv - lastRow.debtEnd;
  flows[flows.length - 1] += exitEq;
  const totalIn = sum(flows.slice(1));
  return {
    H, ev, fees, debt0, debtLike, uses, equity, rows, exitMult, exitEv, exitEq, flows,
    irr: irr(flows), mom: totalIn / equity, payback,
    entryMult: ev / adjE,
    entryMultSyn: ev / (adjE + synRun),
    roic5: rows[Math.min(4, rows.length - 1)].roic,
    cashYield1: rows[0].cashYield,
    maxLev: Math.max(...rows.map((r) => r.lev ?? 0), debt0 / adjE),
    minCover: Math.min(...rows.filter((r) => r.cover != null).map((r) => r.cover as number), Infinity),
  };
}

// Prix maximum (VE) respectant le TRI cible
export function maxPrice(d: Deal, hurdle: number): number | null {
  const b = base(d);
  if (!pos(b.adjEbitda)) return null;
  let lo = 2 * b.adjEbitda, hi = 60 * b.adjEbitda;
  const f = (ev: number): number | null => {
    const r = returns(d, { ev });
    return r && r.irr != null ? r.irr - hurdle / 100 : null;
  };
  const flo = f(lo), fhi = f(hi);
  if (flo == null || fhi == null || flo < 0) return null;
  if (fhi > 0) return hi;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2, fm = f(m);
    if (fm == null) return null;
    if (fm > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
