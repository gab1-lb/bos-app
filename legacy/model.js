/* ===== BOS · modèle financier (fonctions pures) ===== */
const BOS = (() => {
  const N = v => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? null : +v;
  const sum = a => a.reduce((s, x) => s + (x || 0), 0);
  const last = a => a && a.length ? a[a.length - 1] : null;

  function quantile(arr, p) {
    const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return null;
    const n = (a.length - 1) * p, i = Math.floor(n);
    return a[i] + (n - i) * ((a[Math.ceil(n)] ?? a[i]) - a[i]);
  }

  function irr(flows) {
    // bisection sur [-99 %, +1000 %]
    const npv = r => flows.reduce((s, f, t) => s + f / Math.pow(1 + r, t), 0);
    let lo = -0.99, hi = 10, flo = npv(lo), fhi = npv(hi);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, fm = npv(mid);
      if (Math.abs(fm) < 1e-9) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }

  /* --- Données de base --- */
  function base(d) {
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
    const growth = rev != null && revPrev > 0 ? 100 * (rev / revPrev - 1) : null;
    const margin = adjEbitda != null && rev > 0 ? 100 * adjEbitda / rev : null;
    const marginPrev = ebitdaPrev != null && revPrev > 0 ? 100 * ebitdaPrev / revPrev : null;
    const cagr = (() => {
      const f = N(h.rev[0]); if (!(f > 0) || !(rev > 0) || n < 2) return null;
      return 100 * (Math.pow(rev / f, 1 / (n - 1)) - 1);
    })();
    const netDebt = N(d.bs.netDebt), debtLike = N(d.bs.debtLike) || 0;
    const ask = N(d.askPrice);
    return {
      year: last(h.years), rev, revPrev, ebitda, adjNet, adjEbitda, growth, cagr, margin, marginPrev,
      arr: N(d.kpi.arr), recurring: N(d.kpi.recurring), churn: N(d.kpi.churn), nrr: N(d.kpi.nrr),
      top10: N(d.kpi.top10), netDebt, debtLike, ask,
      leverage: netDebt != null && adjEbitda > 0 ? netDebt / adjEbitda : null,
      askEvEbitda: ask != null && adjEbitda > 0 ? ask / adjEbitda : null,
      askEvRev: ask != null && rev > 0 ? ask / rev : null,
      rule40: growth != null && margin != null ? growth + margin : null
    };
  }

  /* --- Plan d'affaires autonome (5 ans, prolongé si besoin) --- */
  function plan(d, years, opts = {}) {
    const b = base(d), p = d.plan, out = [];
    if (!(b.rev > 0) || b.adjEbitda == null) return null;
    const gArr = p.growth.map(N), H = Math.max(years, gArr.length);
    const m0 = b.adjEbitda / b.rev, mT = (N(p.targetMargin) ?? m0 * 100) / 100 + (opts.marginShift || 0) / 100;
    let rev = b.rev, nwcPrev = (N(p.nwcPct) || 0) / 100 * b.rev;
    for (let t = 1; t <= years; t++) {
      let g = (t <= gArr.length ? (gArr[t - 1] ?? 0) : (N(p.longGrowth) ?? 3)) + (opts.growthShift || 0);
      const prevRev = rev; rev = rev * (1 + g / 100);
      const m = t >= gArr.length ? mT : m0 + (mT - m0) * t / gArr.length;
      const ebitda = rev * m;
      const da = rev * (N(p.daPct) || 0) / 100;
      const capex = rev * (N(p.capexPct) || 0) / 100;
      const nwc = rev * (N(p.nwcPct) || 0) / 100, dNwc = nwc - nwcPrev; nwcPrev = nwc;
      out.push({ t, year: b.year + t, g, rev, ebitda, margin: 100 * m, da, capex, dNwc, prevRev });
    }
    return out;
  }

  /* --- DCF --- */
  function dcf(d, wacc = N(d.dcf.wacc), g = N(d.dcf.g)) {
    const yrs = d.plan.growth.length, pl = plan(d, yrs), tax = (N(d.plan.taxRate) || 0) / 100;
    if (!pl || wacc == null || g == null || wacc <= g) return null;
    const w = wacc / 100, gg = g / 100;
    let pv = 0;
    const rows = pl.map(r => {
      const ebit = r.ebitda - r.da, taxes = Math.max(0, ebit) * tax;
      const fcf = r.ebitda - taxes - r.capex - r.dNwc;
      const df = 1 / Math.pow(1 + w, r.t - 0.5); // convention mi-année
      pv += fcf * df;
      return { ...r, ebit, taxes, fcf, df, pv: fcf * df };
    });
    const lastF = last(rows).fcf, tv = lastF * (1 + gg) / (w - gg), pvTv = tv / Math.pow(1 + w, yrs - 0.5);
    const ev = pv + pvTv;
    return { rows, pv, tv, pvTv, ev, tvShare: pvTv / ev, impliedExit: tv / last(rows).ebitda };
  }

  /* --- Comparables --- */
  function comps(d) {
    const rows = (d.comps || []).map(c => {
      const ev = N(c.ev), rev = N(c.rev), eb = N(c.ebitda);
      return { ...c, evRev: ev != null && rev > 0 ? ev / rev : null, evEbitda: ev != null && eb > 0 ? ev / eb : null };
    });
    const sel = rows.filter(r => r.include);
    const s = k => ({ q1: quantile(sel.map(r => r[k]), .25), med: quantile(sel.map(r => r[k]), .5), q3: quantile(sel.map(r => r[k]), .75), n: sel.filter(r => Number.isFinite(r[k])).length });
    return { rows, evRev: s('evRev'), evEbitda: s('evEbitda') };
  }

  /* --- Modèle de rendement acquéreur / LBO --- */
  function returns(d, o = {}) {
    const b = base(d), f = d.financing, s = d.synergies;
    const H = o.hold ?? (N(f.hold) || 7);
    const ev = o.ev ?? N(f.entryEv) ?? b.ask;
    if (!(ev > 0) || !(b.adjEbitda > 0)) return null;
    const pl = plan(d, H, { growthShift: o.growthShift, marginShift: o.marginShift });
    if (!pl) return null;
    const tax = (N(d.plan.taxRate) || 0) / 100;
    const fees = ev * (N(f.feesPct) || 0) / 100;
    const debt0 = (o.leverage ?? (N(f.leverage) || 0)) * b.adjEbitda;
    const debtLike = b.debtLike || 0;
    const uses = ev + fees + debtLike;            // VE (titres + refinancement dette nette) + frais + éléments assimilés
    const equity = uses - debt0;
    const rate = (N(f.rate) || 0) / 100, amortY = N(f.amortYears) || 0;
    const ramp = Math.max(1, N(s.rampYears) || 1);
    const synRun = (N(s.cost) || 0) + (N(s.revenue) || 0);
    const synMult = o.synergyMult ?? 1;
    let debt = debt0, cum = -equity, payback = null;
    const rows = [];
    const flows = [-equity];
    for (const r of pl) {
      const syn = synRun * synMult * Math.min(1, r.t / ramp);
      const integ = r.t === 1 ? (N(s.integrationCost) || 0) : 0;
      const ebitda = r.ebitda + syn;
      const interest = debt * rate;
      const ebt = ebitda - r.da - interest - integ;
      const taxes = Math.max(0, ebt) * tax;
      const fcfPre = ebitda - integ - taxes - r.capex - r.dNwc;        // flux avant service de la dette
      const amort = amortY > 0 ? Math.min(debt, debt0 / amortY) : 0;
      let fcfe = fcfPre - interest - amort;
      let sweep = 0;
      if (f.sweep && fcfe > 0) { sweep = Math.min(debt - amort, fcfe); fcfe -= sweep; }
      const debtEnd = debt - amort - sweep;
      const nopat = (ebitda - r.da) * (1 - tax);
      const roic = nopat / (uses + (N(s.integrationCost) || 0));
      rows.push({ ...r, syn, integ, ebitdaTot: ebitda, interest, taxes, fcfPre, amort, sweep, fcfe, debtStart: debt, debtEnd,
        lev: ebitda > 0 ? debtEnd / ebitda : null, cover: interest > 0 ? ebitda / interest : null, roic, cashYield: fcfPre / uses });
      debt = debtEnd;
      flows.push(fcfe);
      cum += fcfe; if (payback == null && cum >= 0) payback = r.t;
    }
    const lastRow = last(rows);
    const exitMult = o.exitMult ?? N(f.exitMultiple) ?? (ev / b.adjEbitda);
    const exitEv = lastRow.ebitdaTot * exitMult;
    const exitEq = exitEv - lastRow.debtEnd;
    flows[flows.length - 1] += exitEq;
    const totalIn = sum(flows.slice(1));
    return {
      H, ev, fees, debt0, debtLike, uses, equity, rows, exitMult, exitEv, exitEq, flows,
      irr: irr(flows), mom: totalIn / equity, payback,
      entryMult: ev / b.adjEbitda,
      entryMultSyn: ev / (b.adjEbitda + synRun),
      roic5: rows[Math.min(4, rows.length - 1)].roic,
      cashYield1: rows[0].cashYield,
      maxLev: Math.max(...rows.map(r => r.lev ?? 0), debt0 / b.adjEbitda),
      minCover: Math.min(...rows.filter(r => r.cover != null).map(r => r.cover), Infinity)
    };
  }

  // Prix maximum (VE) respectant le TRI cible
  function maxPrice(d, hurdle) {
    const b = base(d); if (!(b.adjEbitda > 0)) return null;
    let lo = 2 * b.adjEbitda, hi = 60 * b.adjEbitda;
    const f = ev => { const r = returns(d, { ev }); return r && r.irr != null ? r.irr - hurdle / 100 : null; };
    let flo = f(lo), fhi = f(hi);
    if (flo == null || fhi == null || flo < 0) return null;
    if (fhi > 0) return hi;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2, fm = f(m); if (fm == null) return null; if (fm > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /* --- Grille de présélection & verdict --- */
  function screen(d, mandate, cp, ret) {
    const b = base(d);
    const crit = [
      ['growth', 'Croissance du CA', b.growth, '%', 12, 'Croissance annuelle dernier exercice', v => v >= 10 ? 2 : v >= 3 ? 1 : 0],
      ['margin', 'Marge d’EBITDA retenue', b.margin, '%', 15, 'Après retraitements acceptés', v => v >= 20 ? 2 : v >= 10 ? 1 : 0],
      ['recurring', 'Part de revenus récurrents', b.recurring, '%', 18, 'Abonnements et maintenance / CA', v => v >= 70 ? 2 : v >= 45 ? 1 : 0],
      ['churn', 'Churn clients annuel', b.churn, '%', 15, 'Perte de clients en nombre', v => v <= 7 ? 2 : v <= 12 ? 1 : 0],
      ['top10', 'Poids des 10 premiers clients', b.top10, '%', 15, 'Concentration du CA', v => v <= 30 ? 2 : v <= 50 ? 1 : 0],
      ['leverage', 'Dette nette / EBITDA', b.leverage, '×', 10, 'Endettement à la clôture', v => v <= 1.5 ? 2 : v <= 3 ? 1 : 0],
      ['price', 'Prix demandé / médiane comparables', b.askEvEbitda != null && cp.evEbitda.med ? b.askEvEbitda / cp.evEbitda.med : null, '×', 15, 'VE/EBITDA demandée rapportée à la médiane', v => v <= 1 ? 2 : v <= 1.25 ? 1 : 0]
    ].map(([k, label, v, unit, w, hint, rate]) => ({ k, label, v, unit, w, hint, pts: v == null ? null : rate(v) }));
    const totW = sum(crit.map(c => c.w));
    const known = crit.filter(c => c.pts != null);
    const kw = sum(known.map(c => c.w));
    const got = sum(known.map(c => c.w * c.pts / 2));
    const coverage = kw / totW;
    const score = kw ? Math.round(100 * got / kw) : null;
    const lowS = Math.round(100 * got / totW), highS = Math.round(100 * (got + totW - kw) / totW);
    // mandat
    const mc = [];
    const m = mandate;
    const chk = (key, param, actual, ok) => mc.push({ key, param, actual, state: actual == null || actual === '' ? 'inconnu' : ok ? 'ok' : 'ko' });
    const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (m.geos) chk('geo', null, d.country, m.geos.split(',').map(norm).filter(Boolean).some(g => norm(d.country).includes(g)));
    if (m.sectors) chk('sector', null, d.sector, m.sectors.split(',').map(norm).filter(Boolean).some(g => norm(d.sector).includes(g)));
    if (N(m.minRev) != null) chk('minRev', N(m.minRev), b.rev, b.rev >= N(m.minRev));
    if (N(m.maxRev) != null) chk('maxRev', N(m.maxRev), b.rev, b.rev <= N(m.maxRev));
    if (N(m.minRecurring) != null) chk('minRecurring', N(m.minRecurring), b.recurring, b.recurring >= N(m.minRecurring));
    if (N(m.minMargin) != null) chk('minMargin', N(m.minMargin), b.margin, b.margin >= N(m.minMargin));

    const hurdle = N(m.hurdle) ?? 15;
    const reasons = [];
    let code, sub;
    const ko = mc.filter(c => c.state === 'ko');
    const decisiveOpen = (d.questions || []).filter(q => q.priority === 'Décisive' && q.status !== 'Répondue');
    const irrPct = ret && ret.irr != null ? ret.irr * 100 : null;
    if (ko.length) { code = 'stop'; sub = 'mandate'; reasons.push(['ko', ko.map(c => c.key)]); }
    else if (b.ask == null && N(d.financing.entryEv) == null) { code = 'wait'; sub = 'price'; reasons.push(['noPrice']); }
    else if (coverage < 0.7) { code = 'wait'; sub = 'coverage'; reasons.push(['coverage', Math.round(coverage * 100)]); }
    else if (irrPct != null && irrPct >= hurdle && score >= 60) { code = 'go'; sub = 'go'; reasons.push(['go', irrPct, hurdle]); }
    else if (irrPct != null && score >= 50) { code = 'nego'; sub = 'nego'; reasons.push(['nego', irrPct, hurdle]); }
    else { code = 'stop'; sub = 'weak'; reasons.push(['weak']); }
    if (decisiveOpen.length && code !== 'stop') reasons.push(['openQ', decisiveOpen.length]);
    if (mc.some(c => c.state === 'inconnu')) reasons.push(['unknown', mc.filter(c => c.state === 'inconnu').map(c => c.key)]);
    return { crit, score, coverage, lowS, highS, provisional: coverage < 1, mandate: mc, code, sub, reasons, hurdle };
  }

  return { N, quantile, irr, base, plan, dcf, comps, returns, maxPrice, screen, sum, last };
})();
if (typeof module !== 'undefined') module.exports = BOS;
