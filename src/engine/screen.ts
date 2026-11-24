/* ===== BOS · grille de présélection & verdict — port de legacy/model.js (screen) ===== */
import { N, base, sum } from './finance';
import type {
  CompsResult, Criterion, Deal, Mandate, MandateCheck, Returns, Screen, ScreenCode, ScreenReason, ScreenSub,
} from './types';

type CritDef = [string, string, number | null, string, number, string, (v: number) => number];

export function screen(d: Deal, mandate: Mandate, cp: CompsResult, ret: Returns | null): Screen {
  const b = base(d);
  const defs: CritDef[] = [
    ['growth', 'Croissance du CA', b.growth, '%', 12, 'Croissance annuelle dernier exercice', (v) => v >= 10 ? 2 : v >= 3 ? 1 : 0],
    ['margin', 'Marge d’EBITDA retenue', b.margin, '%', 15, 'Après retraitements acceptés', (v) => v >= 20 ? 2 : v >= 10 ? 1 : 0],
    ['recurring', 'Part de revenus récurrents', b.recurring, '%', 18, 'Abonnements et maintenance / CA', (v) => v >= 70 ? 2 : v >= 45 ? 1 : 0],
    ['churn', 'Churn clients annuel', b.churn, '%', 15, 'Perte de clients en nombre', (v) => v <= 7 ? 2 : v <= 12 ? 1 : 0],
    ['top10', 'Poids des 10 premiers clients', b.top10, '%', 15, 'Concentration du CA', (v) => v <= 30 ? 2 : v <= 50 ? 1 : 0],
    ['leverage', 'Dette nette / EBITDA', b.leverage, '×', 10, 'Endettement à la clôture', (v) => v <= 1.5 ? 2 : v <= 3 ? 1 : 0],
    ['price', 'Prix demandé / médiane comparables', b.askEvEbitda != null && cp.evEbitda.med ? b.askEvEbitda / cp.evEbitda.med : null, '×', 15, 'VE/EBITDA demandée rapportée à la médiane', (v) => v <= 1 ? 2 : v <= 1.25 ? 1 : 0],
  ];
  const crit: Criterion[] = defs.map(([k, label, v, unit, w, hint, rate]) => ({
    k, label, v, unit, w, hint, pts: v == null ? null : rate(v),
  }));
  const totW = sum(crit.map((c) => c.w));
  const known = crit.filter((c) => c.pts != null);
  const kw = sum(known.map((c) => c.w));
  const got = sum(known.map((c) => c.w * (c.pts as number) / 2));
  const coverage = kw / totW;
  const score = kw ? Math.round(100 * got / kw) : null;
  const lowS = Math.round(100 * got / totW), highS = Math.round(100 * (got + totW - kw) / totW);
  // mandat
  const mc: MandateCheck[] = [];
  const m = mandate;
  const chk = (key: string, param: number | null, actual: string | number | null, ok: boolean) =>
    mc.push({ key, param, actual, state: actual == null || actual === '' ? 'inconnu' : ok ? 'ok' : 'ko' });
  const norm = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  // Comparaisons : un null se comporte comme 0 (JS d'origine) ; l'état « inconnu » est tranché par chk.
  const v0 = (x: number | null) => x ?? 0;
  if (m.geos) chk('geo', null, d.country, m.geos.split(',').map(norm).filter(Boolean).some((g) => norm(d.country).includes(g)));
  if (m.sectors) chk('sector', null, d.sector, m.sectors.split(',').map(norm).filter(Boolean).some((g) => norm(d.sector).includes(g)));
  const minRev = N(m.minRev), maxRev = N(m.maxRev), minRec = N(m.minRecurring), minMar = N(m.minMargin);
  if (minRev != null) chk('minRev', minRev, b.rev, v0(b.rev) >= minRev);
  if (maxRev != null) chk('maxRev', maxRev, b.rev, v0(b.rev) <= maxRev);
  if (minRec != null) chk('minRecurring', minRec, b.recurring, v0(b.recurring) >= minRec);
  if (minMar != null) chk('minMargin', minMar, b.margin, v0(b.margin) >= minMar);

  const hurdle = N(m.hurdle) ?? 15;
  const reasons: ScreenReason[] = [];
  let code: ScreenCode, sub: ScreenSub;
  const ko = mc.filter((c) => c.state === 'ko');
  const decisiveOpen = (d.questions || []).filter((q) => q.priority === 'Décisive' && q.status !== 'Répondue');
  const irrPct = ret && ret.irr != null ? ret.irr * 100 : null;
  const sc = score ?? 0; // null >= n est faux pour n > 0
  if (ko.length) { code = 'stop'; sub = 'mandate'; reasons.push(['ko', ko.map((c) => c.key)]); }
  else if (b.ask == null && N(d.financing.entryEv) == null) { code = 'wait'; sub = 'price'; reasons.push(['noPrice']); }
  else if (coverage < 0.7) { code = 'wait'; sub = 'coverage'; reasons.push(['coverage', Math.round(coverage * 100)]); }
  else if (irrPct != null && irrPct >= hurdle && sc >= 60) { code = 'go'; sub = 'go'; reasons.push(['go', irrPct, hurdle]); }
  else if (irrPct != null && sc >= 50) { code = 'nego'; sub = 'nego'; reasons.push(['nego', irrPct, hurdle]); }
  else { code = 'stop'; sub = 'weak'; reasons.push(['weak']); }
  if (decisiveOpen.length && code !== 'stop') reasons.push(['openQ', decisiveOpen.length]);
  const unknown = mc.filter((c) => c.state === 'inconnu');
  if (unknown.length) reasons.push(['unknown', unknown.map((c) => c.key)]);
  return { crit, score, coverage, lowS, highS, provisional: coverage < 1, mandate: mc, code, sub, reasons, hurdle };
}
