/* ===== BOS · interface ===== */
(() => {
const { N } = BOS;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- langue ---------- */
let LANG = 'fr';
const T = (s, ...a) => { let o = LANG === 'en' ? (EN[s] ?? s) : s; a.forEach((v, i) => { o = o.split('{' + i + '}').join(v); }); return o; };
const loc = () => LANG === 'en' ? 'en-GB' : 'fr-FR';
const ok = n => n != null && Number.isFinite(n);
const nf = (n, d = 1) => ok(n) ? n.toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const meur = (n, d = 1) => ok(n) ? (LANG === 'en' ? (n < 0 ? '−€' : '€') + nf(Math.abs(n), d) + 'm' : nf(n, d) + ' M€') : '—';
const pc = (n, d = 1) => ok(n) ? nf(n, d) + (LANG === 'en' ? '%' : ' %') : '—';
const mx = (n, d = 1) => ok(n) ? nf(n, d) + '×' : '—';
const sg = (n, d = 1, u) => ok(n) ? (n > 0 ? '+' : '') + nf(n, d) + (u ?? (LANG === 'en' ? '%' : ' %')) : '—';
const UM = () => LANG === 'en' ? '€m' : 'M€';
const parseNum = s => { if (s == null) return null; let t = String(s).replace(/[\s  ]/g, '').replace('−', '-').replace(/[%×x€m]|M€/gi, ''); t = LANG === 'en' ? t.replace(/,/g, '') : t.replace(',', '.'); if (t === '') return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]]; a[ks[ks.length - 1]] = v; };

/* ---------- icônes (jeu d'origine BOS) ---------- */
const P = {
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>', folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  chev: '<path d="m9 6 6 6-6 6"/>', pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>', layers: '<path d="m3 7 9-4 9 4-9 5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>', plus: '<path d="M12 5v14M5 12h14"/>', activity: '<path d="M2 12h4l3-7 5 14 3-8 2 1h3"/>',
  file: '<path d="M6 3h8l5 5v13H6zM14 3v6h5M9 13h7m-7 4h5"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
  chart: '<path d="M3 3v18h18M7 16v-4m5 4V8m5 8V5"/>', inbox: '<path d="m3 14 4-9h10l4 9v5H3zM3 14h6l1 2h4l1-2h6"/>', coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v5c0 4 16 4 16 0V6M4 11v5c0 4 16 4 16 0v-5"/>',
  percent: '<path d="m5 19 14-14"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>', repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  scale: '<path d="M12 3v17m-5 1h10M3 7l9-2 9 2M5 7l-3 7h6zM19 7l-3 7h6z"/>', x: '<path d="m6 6 12 12M18 6 6 18"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 15v5h16v-5"/>', building: '<path d="M4 21V8l9-5v18m0-12h7v12M2 21h20M7 10h2m-2 4h2m-2 4h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>', flag: '<path d="M5 21V4c4-4 9 4 14 0v9c-6 4-10-4-14 0"/>',
  settings: '<path d="M3 7h5m5 0h8M3 17h11m5 0h2"/><circle cx="10" cy="7" r="2.5"/><circle cx="16" cy="17" r="2.5"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>', copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  list: '<path d="m3 6 1 1 2-3m2 2h13M3 12h2m3 0h13M3 18h2m3 0h13"/>'
};
const I = (k, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[k] || ''}</svg>`;
const LOGO = '<svg viewBox="0 0 36 34" aria-hidden="true"><path fill="#3e6cfa" d="M1 28 8 8h7L8 28zM12 28 21 3h7l-9 25zM23 28l6-16h7l-6 16z"/></svg>';

/* ---------- état ---------- */
const S = { deals: [], cur: null, mandate: { ...DEFAULT_MANDATE }, view: 'synthese', mode: 'local', coll: null, saving: 0, dl: null, initials: '' };
const deal = () => S.deals.find(d => d.id === S.cur) || S.deals[0];
const TABS = [['synthese', 'Synthèse', 'grid'], ['financiers', 'Données financières', 'chart'], ['valorisation', 'Valorisation', 'coins'], ['rendement', 'Rendement & LBO', 'activity'], ['diligence', 'Demandes d’infos', 'inbox']];
const VIEWS = ['dossiers', ...TABS.map(t => t[0])];
const STAGES = ['Présélection', 'IM reçu', 'Offre indicative', 'Due diligence', 'Offre ferme', 'Signé', 'Abandonné'];

/* ---------- stockage ---------- */
const LS = 'bos.v2';
function lsRead() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } }
function lsWrite() { try { localStorage.setItem(LS, JSON.stringify({ deals: S.deals, mandate: S.mandate, cur: S.cur })); } catch { } }
function pref(k, v) { try { if (v === undefined) return localStorage.getItem('bos.pref.' + k); localStorage.setItem('bos.pref.' + k, v); } catch { return null; } }
const timers = {};
function persist(d) {
  d.updatedAt = Date.now(); lsWrite();
  if (!S.coll) { paintSave(); return; }
  S.saving++; paintSave(); clearTimeout(timers[d.id]);
  timers[d.id] = setTimeout(async () => {
    try { await S.coll.doc(d.id).set({ type: 'deal', deal: JSON.parse(JSON.stringify(d)) }); }
    catch (e) { toast(T('Enregistrement impossible : {0}', e.message || e.code || '')); }
    S.saving = Math.max(0, S.saving - 1); paintSave();
  }, 700);
}
async function persistMandate() { lsWrite(); if (S.coll) try { await S.coll.doc('mandate').set({ type: 'mandate', mandate: { ...S.mandate } }); } catch (e) { toast(T('Enregistrement impossible : {0}', e.message || e.code || '')); } }
async function removeDeal(id) {
  S.deals = S.deals.filter(d => d.id !== id);
  if (!S.deals.length) S.deals.push(demoDeal());
  if (S.cur === id) S.cur = S.deals[0].id;
  lsWrite();
  if (S.coll) try { await S.coll.doc(id).delete(); } catch { }
}
function paintSave() {
  const el = $('#savestate'); if (!el) return;
  el.textContent = S.saving ? T('Enregistrement…') : S.mode === 'db' ? T('Enregistré · espace privé') : T('Enregistré dans ce navigateur');
}
function migrate(d) { const b = blankDeal(); return { ...b, ...d, hist: { ...b.hist, ...d.hist }, kpi: { ...b.kpi, ...d.kpi }, bs: { ...b.bs, ...d.bs }, plan: { ...b.plan, ...d.plan }, dcf: { ...b.dcf, ...d.dcf }, synergies: { ...b.synergies, ...d.synergies }, financing: { ...b.financing, ...d.financing } }; }

async function boot() {
  LANG = pref('lang') === 'en' ? 'en' : 'fr';
  const local = lsRead();
  if (local && local.deals && local.deals.length) { S.deals = local.deals.map(migrate); S.mandate = { ...DEFAULT_MANDATE, ...(local.mandate || {}) }; }
  else S.deals = [demoDeal()];
  S.cur = pref('cur') || (local && local.cur) || S.deals[0].id;
  if (!S.deals.some(d => d.id === S.cur)) S.cur = S.deals[0].id;
  route(); window.addEventListener('hashchange', route);
  if (!(window.claude && window.claude.use)) return;
  window.claude.use('downloads').then(dl => { S.dl = dl; }).catch(() => { });
  try {
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (user) { try { const me = await user.me(); const nm = (me && me.name) || ''; S.initials = nm.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''); } catch { } }
    const uid = user ? await user.id() : null;
    if (db && uid) {
      const coll = db.collection('data/users/' + uid);
      const snap = await Promise.race([coll.get(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))]);
      S.coll = coll; S.mode = 'db';
      const remote = [];
      snap.docs.forEach(doc => { const v = doc.data(); if (!v) return; if (v.type === 'deal' && v.deal) remote.push(migrate(v.deal)); if (v.type === 'mandate' && v.mandate) S.mandate = { ...DEFAULT_MANDATE, ...v.mandate }; });
      if (remote.length) { S.deals = remote.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); if (!S.deals.some(d => d.id === S.cur)) S.cur = S.deals[0].id; }
      else for (const d of S.deals) if (!d.example) persist(d);
    }
  } catch { }
  render();
}

/* ---------- routage / rendu ---------- */
function route() { const h = (location.hash || '').slice(1); S.view = VIEWS.includes(h) ? h : 'synthese'; render(); }
function render() {
  const keepId = document.activeElement && document.activeElement.id, y = window.scrollY;
  document.documentElement.lang = LANG;
  $('#top').innerHTML = topbar();
  const d = deal();
  const V = { dossiers: vDossiers, synthese: vSynthese, financiers: vFinanciers, valorisation: vValo, rendement: vRendement, diligence: vDiligence };
  $('#main').innerHTML = (V[S.view] || vSynthese)(d);
  paintSave();
  if (keepId) { const el = document.getElementById(keepId); if (el) el.focus({ preventScroll: true }); }
  window.scrollTo(0, y);
}
function topbar() {
  const onDeal = S.view !== 'dossiers';
  return `<div class="wrap"><a class="brand" href="#dossiers" aria-label="BOS">${LOGO}BOS</a><i class="vdiv"></i>
    <nav class="nav"><a href="#dossiers" class="${!onDeal ? 'on' : ''}">${I('folder')}<span>${T('Mes dossiers')}</span></a><a href="#synthese" class="${onDeal ? 'on' : ''}">${I('layout')}<span>${T('Espace d’analyse')}</span></a></nav>
    <div class="right"><span class="savestate" id="savestate"></span>
      <label class="lang">${I('globe')}<select id="langSel" aria-label="${T('Langue')}"><option value="fr" ${LANG === 'fr' ? 'selected' : ''}>Français</option><option value="en" ${LANG === 'en' ? 'selected' : ''}>English</option></select></label>
      <span class="personal">${T('Espace personnel')}</span><span class="avatar">${S.initials ? esc(S.initials) : I('user')}</span></div></div>`;
}

/* ---------- calculs ---------- */
function compute(d) {
  const b = BOS.base(d), cp = BOS.comps(d), dc = BOS.dcf(d), ret = BOS.returns(d);
  const hurdle = N(S.mandate.hurdle) ?? 15;
  return { b, cp, dc, ret, sc: BOS.screen(d, S.mandate, cp, ret), hurdle };
}
const mpCache = new Map();
function maxP(d, h) { const k = JSON.stringify([d, h]); if (!mpCache.has(k)) { if (mpCache.size > 60) mpCache.clear(); mpCache.set(k, BOS.maxPrice(d, h)); } return mpCache.get(k); }
function ffRows(d, c) {
  const { b, cp } = c, rows = [];
  if (cp.evEbitda.n && b.adjEbitda > 0) rows.push({ k: T('Transactions · VE / EBITDA'), s: `${mx(cp.evEbitda.q1)} – ${mx(cp.evEbitda.q3)} · ${cp.evEbitda.n} ${T('opérations')}`, lo: cp.evEbitda.q1 * b.adjEbitda, mid: cp.evEbitda.med * b.adjEbitda, hi: cp.evEbitda.q3 * b.adjEbitda });
  if (cp.evRev.n && b.rev > 0) rows.push({ k: T('Transactions · VE / CA'), s: `${mx(cp.evRev.q1)} – ${mx(cp.evRev.q3)}`, lo: cp.evRev.q1 * b.rev, mid: cp.evRev.med * b.rev, hi: cp.evRev.q3 * b.rev });
  const w = N(d.dcf.wacc), g = N(d.dcf.g);
  if (c.dc) { const vs = [[w + 1, g - .5], [w + 1, g + .5], [w - 1, g - .5], [w - 1, g + .5]].map(([a, z]) => BOS.dcf(d, a, z)?.ev).filter(ok); rows.push({ k: 'DCF', s: `WACC ${pc(w)} ± 1 · g ${pc(g)} ± ${nf(.5)}`, lo: Math.min(...vs), mid: c.dc.ev, hi: Math.max(...vs) }); }
  const mp = maxP(d, c.hurdle);
  if (mp) { const a = maxP(d, c.hurdle + 3), z = maxP(d, Math.max(1, c.hurdle - 3)); rows.push({ k: T('Prix max · rendement cible'), s: T('TRI {0} ± 3 pts', pc(c.hurdle, 0)), lo: a ?? mp, mid: mp, hi: z ?? mp }); }
  return { rows, mp };
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x || 1))), r = x / p; return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p; }

/* ---------- composants ---------- */
const inp = (path, v, o = {}) => `<input class="in ${o.cls || ''}" id="f-${path}" data-k="${path}" ${o.type ? `data-t="${o.type}"` : ''} value="${esc(o.type === 'text' ? (v ?? '') : v == null ? '' : o.raw ? String(v) : nf(v, o.d ?? 1))}" placeholder="${esc(o.ph ?? '—')}" inputmode="${o.type === 'text' ? 'text' : 'decimal'}" aria-label="${esc(o.label || path)}" autocomplete="off">`;
const sel = (path, v, opts, label) => `<select class="in" id="f-${path}" data-k="${path}" data-t="text" aria-label="${esc(label || '')}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(T(o))}</option>`).join('')}</select>`;
const chip = (t, c = '') => `<span class="chip ${c}">${esc(t)}</span>`;
const card = (title, icon, body, o = {}) => `<section class="card panel ${o.cls || ''}"><div class="cardhead"><h2>${icon ? I(icon) : ''}${title}${o.sub ? ` <span class="sub">${o.sub}</span>` : ''}</h2>${o.right || ''}</div>${body}</section>`;
const field = (l, p, v, u, o = {}) => `<div class="field"><label for="f-${p}">${l}${o.ref ? ` <span class="dim">· ${esc(o.ref)}</span>` : ''}</label><div class="ib">${inp(p, v, { label: l, ...o })}${u ? `<span class="unit">${u}</span>` : ''}</div></div>`;
const vcls = { go: '', nego: 'warn', wait: 'warn', stop: 'red' };
const ccls = { go: 'good', nego: 'amber', wait: 'amber', stop: 'bad' };
const HEAD = { go: 'Opportunité à poursuivre', nego: 'Prix à négocier', price: 'Prix à obtenir', coverage: 'Données insuffisantes', mandate: 'Cible hors mandat', weak: 'Réserves fortes' };
const TAG = { go: 'À poursuivre', nego: 'À négocier', wait: 'À compléter', stop: 'Réserves' };
const MKEY = { geo: 'Zone géographique', sector: 'Secteur', minRev: 'CA minimum', maxRev: 'CA maximum', minRecurring: 'Récurrence minimale', minMargin: 'Marge d’EBITDA minimale' };
const mLabel = m => T(MKEY[m.key]) + (m.param != null ? ' · ' + (m.key.includes('Rev') ? meur(m.param, 0) : pc(m.param, 0)) : '');
const headline = sc => sc.code === 'go' ? HEAD.go : sc.code === 'nego' ? HEAD.nego : HEAD[sc.sub] || HEAD.weak;
function reasonText(r) {
  const [k, a, b] = r;
  if (k === 'go') return T('TRI de {0} au prix d’entrée, au-dessus du seuil de {1}.', pc(a), pc(b, 0));
  if (k === 'nego') return T('TRI de {0} au prix d’entrée, sous le seuil de {1}.', pc(a), pc(b, 0));
  if (k === 'noPrice') return T('Sans prix demandé ni VE d’entrée, le rendement ne peut pas être jugé.');
  if (k === 'coverage') return T('Couverture de la grille : {0}. Seuil de décision : 70 %.', pc(a, 0));
  if (k === 'weak') return T('Qualité de l’actif ou rendement insuffisants au regard de la grille.');
  if (k === 'ko') return T('Critère du mandat non satisfait : {0}.', a.map(x => T(MKEY[x]).toLowerCase()).join(', '));
  if (k === 'openQ') return a > 1 ? T('{0} questions décisives restent ouvertes.', a) : T('Une question décisive reste ouverte.');
  if (k === 'unknown') return T('Critère du mandat à documenter : {0}.', a.map(x => T(MKEY[x]).toLowerCase()).join(', '));
  return '';
}
function spark(arr) {
  const v = arr.filter(ok); if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1, n = arr.length;
  const pts = arr.map((x, i) => ok(x) ? [i / (n - 1) * 100, 36 - (x - lo) / sp * 30] : null).filter(Boolean);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="${line} L100 40 L0 40Z" fill="#e8eefc"/><path d="${line}" fill="none" stroke="#577ce5" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function metric(label, icon, value, foot, arr, href) {
  const tag = href ? 'a' : 'div';
  return `<${tag} class="metric" ${href ? `href="#${href}"` : ''}><span class="mtop">${I(icon)}${label}</span>${value == null ? `<div class="value na">${T('À obtenir')}</div>` : `<div class="value">${value}</div>`}${arr ? spark(arr) : ''}<span class="mfoot">${foot || '&nbsp;'}</span></${tag}>`;
}
const delta = (cur, prev, pts) => { if (!ok(cur) || !ok(prev) || prev === 0) return ''; const v = pts ? cur - prev : 100 * (cur / prev - 1); return `<span class="${v >= 0 ? 'up' : 'down'}">${sg(v, 1, pts ? ' pts' : undefined)}</span>`; };

function pageHead(d) {
  const openN = (d.questions || []).filter(q => q.status !== 'Répondue').length;
  return `<div class="crumb">${I('folder')}<a href="#dossiers">${T('Mes dossiers')}</a>${I('chev')}<strong>${esc(d.name)}</strong></div>
  <div class="pagehead"><div><div class="titleline"><h1>${esc(d.name)}</h1>${d.example ? `<span class="tag">${T('Dossier exemple')}</span>` : ''}</div>
    <div class="meta"><span>${I('building')}${esc(d.sector || T('Secteur à préciser'))}</span><i class="sep">·</i><span>${I('pin')}${esc(d.country || T('Pays à préciser'))}</span><i class="sep">·</i><span>${I('layers')}${sel('stage', d.stage, STAGES, T('Étape'))}</span></div></div>
    <div class="actions"><button class="btn" data-a="memo">${I('file')}${T('Note de comité')}</button><button class="btn" data-a="xlsx">${I('download')}Excel</button><button class="btn primary" data-a="import">${I('plus')}${T('Importer un IM')}</button></div></div>
  <nav class="tabs" aria-label="${T('Sections')}">${TABS.map(([k, l, ic]) => `<a href="#${k}" class="${S.view === k ? 'on' : ''}">${I(ic)}${T(l)}${k === 'diligence' && openN ? `<span class="count">${openN}</span>` : ''}</a>`).join('')}</nav>`;
}

function footballField(d, c, opt = {}) {
  const { rows } = ffRows(d, c), entry = c.ret ? c.ret.ev : null, ask = c.b.ask;
  if (!rows.length) return `<div class="empty">${T('Renseignez le CA, l’EBITDA et au moins un comparable pour afficher les fourchettes.')}</div>`;
  const showEntry = ok(entry) && Math.abs(entry - (ask ?? -1)) > 0.05;
  const vals = rows.flatMap(r => [r.lo, r.hi]).concat([entry, ask].filter(ok));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const step = niceStep((hi - lo) / 5); lo = Math.max(0, Math.floor(lo * .94 / step) * step); hi = Math.ceil(hi * 1.03 / step) * step;
  const X = v => 100 * (v - lo) / (hi - lo);
  const ticks = []; for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);
  const vline = (v, cls, tag) => ok(v) ? `<div class="ff-line ${cls}" style="left:${X(v)}%"><span class="ff-tag">${tag}</span></div>` : '';
  return `<div class="ff"><div class="ff-row ff-ov" style="position:absolute;inset:0;pointer-events:none;align-items:stretch"><span></span><div style="position:relative"><div class="ff-lines" style="left:0;right:0">${vline(ask, '', T('Demandé') + ' ' + nf(ask))}${showEntry ? vline(entry, 'entry', T('Entrée') + ' ' + nf(entry)) : ''}</div></div></div>
    ${rows.map(r => `<div class="ff-row"><div class="ff-lbl">${esc(r.k)}<small>${esc(r.s)}</small></div><div class="ff-track">
      <div class="ff-bar" style="left:${X(r.lo)}%;width:${Math.max(.6, X(r.hi) - X(r.lo))}%" data-tip="${esc(r.k)}\n${T('Bas')}      ${meur(r.lo)}\n${T('Central')}  ${meur(r.mid)}\n${T('Haut')}     ${meur(r.hi)}"></div><div class="ff-mid" style="left:${X(r.mid)}%"></div>
      ${opt.values ? `<span class="ff-val" style="right:calc(${100 - X(r.lo)}% + 6px)">${nf(r.lo)}</span><span class="ff-val" style="left:calc(${X(r.hi)}% + 6px)">${nf(r.hi)}</span>` : ''}</div></div>`).join('')}
    <div class="ff-row" style="min-height:0"><span></span><div class="ff-axis">${ticks.map(t => `<span style="left:${X(t)}%">${nf(t, 0)}</span>`).join('')}</div></div></div>
  <div class="legend"><span><i style="background:var(--spark)"></i>${T('Fourchette de VE ({0})', UM())}</span><span><i style="background:var(--ink);width:3px"></i>${T('Valeur centrale')}</span><span><i style="border-left:2px dashed var(--orange);width:0;border-radius:0"></i>${T('Prix demandé')}</span>${showEntry ? `<span><i style="background:var(--ink);width:2px"></i>${T('VE d’entrée retenue')}</span>` : ''}</div>`;
}

/* ---------- Mes dossiers ---------- */
function vDossiers() {
  const rows = S.deals.map(d => ({ d, c: compute(d) }));
  const n = k => rows.filter(r => r.c.sc.code === k).length;
  const openQ = rows.reduce((s, r) => s + (r.d.questions || []).filter(q => q.priority === 'Décisive' && q.status !== 'Répondue').length, 0);
  const st = (l, ic, v) => `<div class="metric"><span class="mtop">${I(ic)}${l}</span><div class="value">${v}</div></div>`;
  return `<div class="pagehead" style="margin-top:4px"><div><h1>${T('Mes dossiers')}</h1><div class="meta"><span>${I('target')}${T('Mandat')} : ${esc(S.mandate.name)}</span><i class="sep">·</i><span>${T('TRI cible')} ${pc(N(S.mandate.hurdle), 0)}</span></div></div>
    <div class="actions"><button class="btn" data-a="mandate">${I('settings')}${T('Mandat acquéreur')}</button><button class="btn" data-a="import">${I('upload')}${T('Importer un IM')}</button><button class="btn primary" data-a="new">${I('plus')}${T('Nouveau dossier')}</button></div></div>
  <div class="g4">${st(T('Dossiers en cours'), 'folder', rows.filter(r => r.d.stage !== 'Abandonné' && r.d.stage !== 'Signé').length)}${st(T('À poursuivre'), 'trend', n('go'))}${st(T('À négocier ou compléter'), 'clock', n('nego') + n('wait'))}${st(T('Questions décisives ouvertes'), 'flag', openQ)}</div>
  ${card(T('Journal des deals'), 'list', `<div class="tw"><table><thead><tr><th>${T('Dossier')}</th><th>${T('Étape')}</th><th class="n">${T('CA')}</th><th class="n">${T('Marge')}</th><th class="n">${T('VE demandée')}</th><th class="n">${T('VE / EBITDA')}</th><th class="n">${T('TRI au prix')}</th><th>${T('Avis')}</th><th></th></tr></thead><tbody>
    ${rows.map(({ d, c }) => `<tr><td><a class="pipe-name" href="#synthese" data-a="open" data-id="${esc(d.id)}">${esc(d.name)}</a> ${d.example ? `<span class="tag" style="padding:1px 6px;font-size:11.5px">${T('Exemple')}</span>` : ''}<span class="mini">${esc([d.sector, d.country].filter(Boolean).join(' · ') || T('Fiche à compléter'))}</span></td>
      <td>${esc(T(d.stage))}</td><td class="n">${meur(c.b.rev)}</td><td class="n">${pc(c.b.margin)}</td><td class="n">${meur(c.b.ask)}</td><td class="n">${mx(c.b.askEvEbitda)}</td>
      <td class="n">${c.ret && c.ret.irr != null ? `<span class="${c.ret.irr * 100 >= c.hurdle ? 'up' : 'down'}">${pc(c.ret.irr * 100)}</span>` : '—'}</td>
      <td>${chip(T(TAG[c.sc.code]), ccls[c.sc.code])}</td>
      <td class="n"><span id="ra-${esc(d.id)}" style="display:inline-flex;gap:4px"><button class="iconbtn" data-a="dup" data-id="${esc(d.id)}" title="${T('Dupliquer')}" aria-label="${T('Dupliquer')}">${I('copy')}</button><button class="iconbtn" data-a="askdel" data-id="${esc(d.id)}" title="${T('Supprimer')}" aria-label="${T('Supprimer')}">${I('x')}</button></span></td></tr>`).join('')}
  </tbody></table></div>`, { cls: 'mt', sub: String(rows.length) })}`;
}

/* ---------- Synthèse ---------- */
function vSynthese(d) {
  const c = compute(d), { b, ret, sc, cp } = c, { mp } = ffRows(d, c), h = d.hist, L = h.years.length - 1;
  const open = (d.questions || []).filter(q => q.status !== 'Répondue').sort((x, y) => (x.priority === 'Décisive' ? 0 : 1) - (y.priority === 'Décisive' ? 0 : 1));
  const margins = h.rev.map((r, i) => r > 0 && ok(N(h.ebitda[i])) ? 100 * h.ebitda[i] / r : null);
  const known = sc.crit.filter(k => k.pts != null).length;
  const sig = k => k.pts == null ? chip(T('À obtenir'), 'amber') : k.pts === 2 ? chip(T('Favorable'), 'good') : k.pts === 1 ? chip(T('Neutre')) : chip(T('Défavorable'), 'bad');
  const fv = k => k.v == null ? T('donnée manquante') : k.unit === '%' ? pc(k.v) : mx(k.v, 2);
  const prevY = h.years[L - 1];
  return pageHead(d) + `
  <div class="g2"><section class="hero"><img class="terrain" src="${TERRAIN}" alt="">
      <div class="eyebrow">${I('activity')}${T('Avis préliminaire')}</div><h2>${T(headline(sc))}</h2><p>${esc(sc.reasons.map(reasonText).join(' '))}</p>
      <div class="herofoot"><span class="signal ${vcls[sc.code]}">${T(TAG[sc.code])}</span><span class="score">${T('Note')} <b>${sc.score ?? '—'}</b> / 100${sc.provisional ? ' · ' + T('provisoire') : ''}</span><button class="subtle" data-a="grid">${T('Grille d’analyse')} ⓘ</button></div></section>
    <section class="card source"><div class="cardhead" style="margin:0"><h2>${T('Document source')}</h2><span class="iconbox">${I('file')}</span></div>
      <button class="doc" data-a="import"><span class="pdficon">${I('file')}</span><span><b>${esc(d.source || T('Aucun IM importé'))}</b><small>${d.source ? T('Information Memorandum') : T('Importer un PDF ou coller des extraits')}</small></span>${I('chev')}</button>
      <div><div class="rowsb"><span>${T('Couverture des données')}</span><b>${known} / ${sc.crit.length}</b></div><div class="progress"><i style="width:${Math.round(sc.coverage * 100)}%"></i></div></div></section></div>

  <div class="sectionhead"><h2>${T('Indicateurs clés')}</h2><span class="period">${I('cal')}${T('Exercice')} ${b.year || '—'}</span></div>
  <div class="g4">
    ${metric(T('Chiffre d’affaires'), 'chart', ok(b.rev) ? meur(b.rev) : null, ok(b.revPrev) ? `${delta(b.rev, b.revPrev)} ${T('vs {0}', prevY)}` : '', h.rev.map(N), 'financiers')}
    ${metric(T('EBITDA retenu'), 'coins', ok(b.adjEbitda) ? meur(b.adjEbitda, 2) : null, b.adjNet ? T('publié {0}', meur(b.ebitda, 2)) : ok(N(h.ebitda[L - 1])) ? `${delta(N(h.ebitda[L]), N(h.ebitda[L - 1]))} ${T('vs {0}', prevY)}` : '', h.ebitda.map(N), 'financiers')}
    ${metric(T('Marge d’EBITDA'), 'percent', ok(b.margin) ? pc(b.margin) : null, ok(b.marginPrev) && ok(b.margin) ? `${delta(b.margin, b.marginPrev, true)} ${T('vs {0}', prevY)}` : '', margins, 'financiers')}
    ${metric(T('Revenus récurrents'), 'repeat', ok(b.recurring) ? pc(b.recurring, 0) : null, [ok(b.arr) ? 'ARR ' + meur(b.arr) : '', ok(b.churn) ? T('churn {0}', pc(b.churn)) : ''].filter(Boolean).join(' · '), null, 'financiers')}
  </div>

  <div class="g2e mt">
    <a class="card wide" href="#valorisation"><span class="iconbox">${I('coins')}</span><span><small>${T('Prix demandé par le vendeur')}</small><strong>${ok(b.ask) ? meur(b.ask) + ' · ' + mx(b.askEvEbitda) + ' EBITDA' : T('À obtenir')}</strong><span class="mini">${cp.evEbitda.n ? T('Médiane des transactions : {0} · {1}', mx(cp.evEbitda.med), meur(cp.evEbitda.med * b.adjEbitda)) : T('Ajoutez des transactions comparables')}</span></span>${I('chev')}</a>
    <a class="card wide" href="#rendement"><span class="iconbox">${I('trend')}</span><span><small>${T('Rendement pour l’acquéreur')}</small><strong>${ret ? T('TRI {0}', pc(ret.irr * 100)) + ' · ' + mx(ret.mom, 2) : T('À calculer')}</strong><span class="mini">${ret ? T('Seuil {0} · prix max {1} · ROIC an 5 {2}', pc(c.hurdle, 0), meur(mp), pc(ret.roic5 * 100)) : T('Indiquez un prix pour calculer le rendement')}</span></span>${I('chev')}</a>
  </div>

  <div class="g2b mt">
    ${card(T('Valorisation'), 'scale', footballField(d, c), { right: `<a class="link" href="#valorisation">${T('Détail')}${I('chev')}</a>` })}
    ${card(T('Informations à obtenir'), 'inbox', open.length ? open.slice(0, 4).map(q => `<div class="ask"><span class="askicon ${q.priority === 'Décisive' ? 'red' : ''}">${I('file')}</span><div><b>${esc(q.q)}</b><span class="mini">${esc(T(q.cat))} · ${esc(T(q.priority))} · ${esc(T(q.status))}</span></div></div>`).join('') + `<a class="link" href="#diligence" style="margin-top:12px">${T('Voir les demandes')}${I('chev')}</a>` : `<div class="empty">${T('Toutes les demandes ont reçu une réponse.')}</div>`, { right: open.length ? chip(T('{0} en attente', open.length), 'amber') : '' })}
  </div>

  <div class="g2b mt">
    ${card(T('Facteurs de décision'), 'scale', `<div class="thead"><span>${T('Facteur analysé')}</span><span>${T('Signal')}</span></div>${sc.crit.map(k => `<div class="factor"><div><strong>${T(k.label)}</strong><span class="mini">${T(k.hint)} · ${fv(k)}</span></div>${sig(k)}</div>`).join('')}`)}
    ${card(T('Thèse d’investissement'), 'flag', `<div class="prose stack" style="gap:18px"><div><h3>${T('Pourquoi acheter')}</h3><p>${esc(d.thesis) || `<span class="dim">${T('À rédiger')}</span>`}</p></div><div><h3>${T('Ce qui invaliderait la thèse')}</h3><p>${esc(d.risks) || `<span class="dim">${T('À rédiger')}</span>`}</p></div>
      <div><h3>${T('Mandat')}</h3>${sc.mandate.map(m => `<div class="factor" style="padding:8px 0;font-size:13.5px"><span>${mLabel(m)}</span>${m.state === 'ok' ? chip(T('Conforme'), 'good') : m.state === 'ko' ? chip(T('Hors mandat'), 'bad') : chip(T('Inconnu'), 'amber')}</div>`).join('')}</div></div>`, { right: `<a class="link" href="#diligence">${T('Modifier')}${I('chev')}</a>` })}
  </div>`;
}

/* ---------- Données financières ---------- */
function vFinanciers(d) {
  const c = compute(d), b = c.b, h = d.hist, pl = BOS.plan(d, d.plan.growth.length) || [], yrs = h.years;
  const row = (lbl, arr, key, dec = 1) => `<tr><td class="lbl">${lbl}</td>${arr.map((v, i) => `<td class="n">${inp(`hist.${key}.${i}`, v, { d: dec, cls: 'w-s', label: lbl + ' ' + yrs[i] })}</td>`).join('')}${pl.map(() => '<td></td>').join('')}</tr>`;
  const calc = (lbl, hv, pv, f, cls = '') => `<tr class="${cls}"><td class="lbl">${lbl}</td>${hv.map(v => `<td class="n">${f(v)}</td>`).join('')}${pv.map(v => `<td class="n dim">${f(v)}</td>`).join('')}</tr>`;
  const g = h.rev.map((v, i) => i && ok(N(v)) && h.rev[i - 1] > 0 ? 100 * (v / h.rev[i - 1] - 1) : null);
  const mg = h.rev.map((v, i) => v > 0 && ok(N(h.ebitda[i])) ? 100 * h.ebitda[i] / v : null);
  const series = yrs.map((y, i) => ({ y, r: N(h.rev[i]), e: N(h.ebitda[i]), fc: false })).concat(pl.map(p => ({ y: p.year, r: p.rev, e: p.ebitda, fc: true })));
  const top = Math.max(1, ...series.map(s => s.r || 0)), st = niceStep(top / 4), ymax = Math.ceil(top / st) * st;
  const tipf = s => `${s.y}${s.fc ? ' (' + T('plan') + ')' : ''}\n${T('CA')}      ${meur(s.r)}\nEBITDA  ${meur(s.e, 2)}`;
  const chart = `<div class="cols">${[1, 2, 3, 4].map(i => i * st <= ymax ? `<div class="gl" style="bottom:${100 * i * st / ymax}%"><span>${nf(i * st, 0)}</span></div>` : '').join('')}
    ${series.map(s => `<div class="colg ${s.fc ? 'fc' : ''}" data-tip="${esc(tipf(s))}"><i class="r" style="height:${100 * (s.r || 0) / ymax}%"></i><i class="e" style="height:${100 * Math.max(0, s.e || 0) / ymax}%"></i></div>`).join('')}</div>
    <div class="colx">${series.map(s => `<span>${s.y}${s.fc ? 'P' : ''}</span>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--spark)"></i>${T('Chiffre d’affaires')} (${UM()})</span><span><i style="background:var(--orange)"></i>EBITDA</span><span><i style="background:var(--spark);opacity:.42"></i>${T('Années de plan (P)')}</span></div>`;
  const adj = d.adjustments || [];
  return pageHead(d) + `
  ${card(T('Compte de résultat'), 'chart', `<div class="tw"><table><thead><tr><th>${UM()}</th>${yrs.map((y, i) => `<th class="n">${inp('hist.years.' + i, y, { raw: 1, cls: 'w-s', label: T('Année') })}</th>`).join('')}${pl.map(p => `<th class="n">${p.year}P</th>`).join('')}</tr></thead><tbody>
      ${row(T('Chiffre d’affaires'), h.rev, 'rev')}${calc(T('Croissance'), g, pl.map(p => p.g), v => v == null ? '—' : sg(v), 'sub')}
      ${row(T('EBITDA publié'), h.ebitda, 'ebitda', 2)}${calc(T('Marge d’EBITDA'), mg, pl.map(p => p.margin), v => pc(v), 'sub')}
      ${calc(T('EBITDA du plan (base retenue)'), h.ebitda.map(() => null), pl.map(p => p.ebitda), v => v == null ? '' : nf(v, 2))}
      ${row('Capex', h.capex, 'capex', 2)}</tbody></table></div><div style="margin-top:20px">${chart}</div>`, { sub: T('historique saisi · plan calculé'), right: `<span class="hint"><i></i>${T('Valeur modifiable')}</span>` })}
  <div class="g2b mt">
    ${card(T('Qualité des résultats'), 'scale', `<div class="tw"><table><thead><tr><th>${T('Retraitement')}</th><th class="n">${UM()}</th><th>${T('Inclus vendeur')}</th><th>${T('Statut')}</th><th></th></tr></thead><tbody>
      <tr class="tot"><td>${T('EBITDA publié')} ${b.year || ''}</td><td class="n">${nf(b.ebitda, 2)}</td><td></td><td></td><td></td></tr>
      ${adj.map((a, i) => `<tr><td>${inp(`adjustments.${i}.label`, a.label, { type: 'text', cls: 'txt w-xl', label: T('Libellé') })}</td><td class="n">${inp(`adjustments.${i}.amount`, a.amount, { d: 2, cls: 'w-s', label: T('Montant') })}</td>
        <td><input type="checkbox" id="f-adjustments.${i}.included" data-k="adjustments.${i}.included" data-t="bool" ${a.included ? 'checked' : ''} aria-label="${T('Inclus vendeur')}"></td><td>${sel(`adjustments.${i}.status`, a.status, ['Accepté', 'À confirmer', 'Rejeté'], T('Statut'))}</td>
        <td><button class="iconbtn" data-a="deladj" data-i="${i}" aria-label="${T('Supprimer')}">${I('x')}</button></td></tr>`).join('')}
      <tr class="tot"><td>${T('EBITDA retenu')}</td><td class="n">${nf(b.adjEbitda, 2)}</td><td colspan="3" class="dim" style="font-weight:450">${sg(b.adjNet, 2, ' ' + UM())} ${T('vs publié')}</td></tr></tbody></table></div>
      <p class="note" style="margin-top:12px">${T('Un retraitement déjà inclus par le vendeur est retiré tant qu’il n’est pas accepté. Un retraitement non inclus n’est ajouté qu’une fois accepté.')}</p>`, { right: `<button class="btn sm" data-a="addadj">${I('plus')}${T('Ajouter')}</button>` })}
    ${card(T('Indicateurs & bilan'), 'repeat', `<div class="form">
      ${field('ARR', 'kpi.arr', d.kpi.arr, UM(), { ref: d.refs.arr })}${field(T('Revenus récurrents'), 'kpi.recurring', d.kpi.recurring, '%', { d: 0, ref: d.refs.recurring })}
      ${field(T('Churn clients'), 'kpi.churn', d.kpi.churn, '%', { ref: d.refs.churn })}${field(T('Rétention nette (NRR)'), 'kpi.nrr', d.kpi.nrr, '%', { d: 0 })}
      ${field(T('Top 10 clients'), 'kpi.top10', d.kpi.top10, T('% du CA'), { d: 0, ref: d.refs.top10 })}${field(T('Nombre de clients'), 'kpi.customers', d.kpi.customers, '', { d: 0 })}
      ${field(T('Dette nette'), 'bs.netDebt', d.bs.netDebt, UM(), { ref: d.refs.netDebt })}${field(T('Éléments assimilés à la dette'), 'bs.debtLike', d.bs.debtLike, UM())}
      ${field(T('VE demandée (100 %)'), 'askPrice', d.askPrice, UM(), { ref: d.refs.askPrice })}${field(T('Effectif'), 'kpi.employees', d.kpi.employees, T('ETP'), { d: 0 })}</div>`)}
  </div>
  ${card(T('Plan d’affaires autonome'), 'trend', `<div class="form">
    ${d.plan.growth.map((v, i) => field(T('Croissance {0}', (b.year || 0) + i + 1), 'plan.growth.' + i, v, '%')).join('')}
    ${field(T('Marge d’EBITDA cible (an {0})', d.plan.growth.length), 'plan.targetMargin', d.plan.targetMargin, '%', { ph: nf(b.margin) })}
    ${field(T('Croissance au-delà'), 'plan.longGrowth', d.plan.longGrowth, '%')}${field('Capex', 'plan.capexPct', d.plan.capexPct, T('% du CA'))}
    ${field(T('Amortissements'), 'plan.daPct', d.plan.daPct, T('% du CA'))}${field(T('BFR'), 'plan.nwcPct', d.plan.nwcPct, T('% du CA'))}${field(T('Taux d’IS'), 'plan.taxRate', d.plan.taxRate, '%')}</div>
    <p class="note" style="margin-top:14px">${T('La marge progresse linéairement de la marge retenue ({0}) vers la cible. Un BFR négatif (abonnements facturés d’avance) génère de la trésorerie quand le CA croît. Ce plan alimente le DCF et le modèle de rendement.', pc(b.margin))}</p>`, { cls: 'mt', sub: T('hors synergies') })}`;
}

/* ---------- Valorisation ---------- */
function vValo(d) {
  const c = compute(d), { b, cp, dc } = c, w = N(d.dcf.wacc), g = N(d.dcf.g), mp = ffRows(d, c).mp;
  const ws = [w - 2, w - 1, w, w + 1, w + 2], gs = [g - 1, g - .5, g, g + .5, g + 1];
  const points = [[T('Prix demandé'), b.ask], [T('Médiane des transactions'), cp.evEbitda.med ? cp.evEbitda.med * b.adjEbitda : null], [T('DCF central'), dc?.ev], [T('Prix max au TRI cible'), mp]];
  return pageHead(d) + `
  ${card(T('Football field'), 'scale', footballField(d, c, { values: true }), { sub: T('valeur d’entreprise, {0} · survolez une barre', UM()) })}
  ${card(T('Transactions comparables'), 'list', `<div class="tw"><table><thead><tr><th></th><th>${T('Cible')}</th><th>${T('Acquéreur')}</th><th class="n">${T('Année')}</th><th>${T('Zone')}</th><th>${T('Niche')}</th><th class="n">${T('CA')}</th><th class="n">EBITDA</th><th class="n">${T('VE')}</th><th class="n">${T('VE / CA')}</th><th class="n">${T('VE / EBITDA')}</th><th></th></tr></thead><tbody>
    ${cp.rows.map((r, i) => `<tr class="${r.include ? '' : 'off'}"><td><input type="checkbox" id="f-comps.${i}.include" data-k="comps.${i}.include" data-t="bool" ${r.include ? 'checked' : ''} aria-label="${T('Retenir')}"></td>
      <td>${inp(`comps.${i}.target`, r.target, { type: 'text', cls: 'txt', label: T('Cible') })}</td><td>${inp(`comps.${i}.buyer`, r.buyer, { type: 'text', cls: 'txt', label: T('Acquéreur') })}</td><td class="n">${inp(`comps.${i}.year`, r.year, { raw: 1, cls: 'w-s', label: T('Année') })}</td>
      <td>${inp(`comps.${i}.geo`, r.geo, { type: 'text', cls: 'txt', label: T('Zone') })}</td><td>${inp(`comps.${i}.niche`, r.niche, { type: 'text', cls: 'txt', label: T('Niche') })}</td>
      <td class="n">${inp(`comps.${i}.rev`, r.rev, { cls: 'w-s', label: T('CA') })}</td><td class="n">${inp(`comps.${i}.ebitda`, r.ebitda, { cls: 'w-s', label: 'EBITDA' })}</td><td class="n">${inp(`comps.${i}.ev`, r.ev, { cls: 'w-s', label: T('VE') })}</td>
      <td class="n">${mx(r.evRev)}</td><td class="n">${mx(r.evEbitda)}</td><td><button class="iconbtn" data-a="delcomp" data-i="${i}" aria-label="${T('Supprimer')}">${I('x')}</button></td></tr>`).join('')}
    ${[['1er quartile', 'q1'], ['Médiane', 'med'], ['3e quartile', 'q3']].map(([l, k]) => `<tr class="${k === 'med' ? 'tot' : 'sub'}"><td></td><td colspan="8">${T(l)}</td><td class="n">${mx(cp.evRev[k])}</td><td class="n">${mx(cp.evEbitda[k])}</td><td></td></tr>`).join('')}
  </tbody></table></div><p class="note" style="margin-top:12px">${d.example ? `<b>${T('Transactions illustratives.')}</b> ${T('Remplacez-les par vos sources (Mergermarket, Capital IQ, communiqués).')} ` : ''}${T('Décochez une opération pour l’exclure des quartiles. Montants en {0}.', UM())}</p>`, { cls: 'mt', right: `<button class="btn sm" data-a="addcomp">${I('plus')}${T('Ajouter')}</button>` })}
  <div class="g2b mt">
    ${card('DCF', 'trend', dc ? `<div class="form" style="grid-template-columns:repeat(2,minmax(0,200px))">${field('WACC', 'dcf.wacc', d.dcf.wacc, '%')}${field(T('Croissance à l’infini'), 'dcf.g', d.dcf.g, '%')}</div>
      <div class="tw" style="margin-top:16px"><table><thead><tr><th>${UM()}</th>${dc.rows.map(r => `<th class="n">${r.year}P</th>`).join('')}</tr></thead><tbody>
        ${[[T('Chiffre d’affaires'), 'rev'], ['EBITDA', 'ebitda'], [T('IS normatif'), 'taxes', -1], ['Capex', 'capex', -1], [T('Variation de BFR'), 'dNwc', -1]].map(([l, k, s]) => `<tr><td class="lbl">${l}</td>${dc.rows.map(r => `<td class="n">${nf((s || 1) * r[k], 2)}</td>`).join('')}</tr>`).join('')}
        <tr class="tot"><td>${T('Flux de trésorerie disponible')}</td>${dc.rows.map(r => `<td class="n">${nf(r.fcf, 2)}</td>`).join('')}</tr><tr class="sub"><td>${T('Valeur actualisée')}</td>${dc.rows.map(r => `<td class="n">${nf(r.pv, 2)}</td>`).join('')}</tr></tbody></table></div>
      <div class="stats" style="margin-top:16px">${[[T('VE · DCF'), meur(dc.ev), 1], [T('Valeur terminale actualisée'), meur(dc.pvTv)], [T('Poids de la valeur terminale'), pc(dc.tvShare * 100, 0)], [T('Multiple de sortie implicite'), mx(dc.impliedExit)]].map(([l, v, hl]) => `<div class="stat ${hl ? 'hl' : ''}"><small>${l}</small><strong>${v}</strong></div>`).join('')}</div>
      <p class="note" style="margin-top:12px">${T('Convention de mi-année. Hypothèses de plan dans l’onglet Données financières.')}</p>` : `<div class="empty">${T('Renseignez le CA, l’EBITDA et un WACC supérieur à la croissance à l’infini.')}</div>`)}
    <div class="stack">
      ${dc ? card(T('Sensibilité du DCF'), 'grid', `<div class="tw"><table><thead><tr><th>WACC \\ g</th>${gs.map(x => `<th class="n">${pc(x)}</th>`).join('')}</tr></thead><tbody>${ws.map(a => `<tr><td class="lbl">${pc(a)}</td>${gs.map(z => `<td class="n ${a === w && z === g ? 'hl' : ''}">${nf(BOS.dcf(d, a, z)?.ev)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, { sub: UM() }) : ''}
      ${card(T('De la VE à la valeur des titres'), 'coins', `<div class="tw"><table><thead><tr><th>${UM()}</th><th class="n">${T('VE')}</th><th class="n">${T('Dette nette')}</th><th class="n">${T('Assimilés')}</th><th class="n">${T('Titres')}</th></tr></thead><tbody>
        ${points.map(([l, v]) => `<tr><td class="lbl">${l}</td><td class="n">${nf(v)}</td><td class="n">${b.netDebt == null ? '?' : nf(-b.netDebt)}</td><td class="n">${nf(-(b.debtLike || 0))}</td><td class="n" style="font-weight:650">${v == null || b.netDebt == null ? '—' : nf(v - b.netDebt - (b.debtLike || 0))}</td></tr>`).join('')}</tbody></table></div>
        <p class="note" style="margin-top:12px">${T('Avant BFR normatif et mécanisme de prix (locked box ou comptes de clôture).')}</p>`)}
    </div></div>`;
}

/* ---------- Rendement & LBO ---------- */
function vRendement(d) {
  const c = compute(d), { b, ret } = c, f = d.financing, s = d.synergies;
  const hyp = card(T('Hypothèses de l’opération'), 'settings', `<div class="form">
    ${field(T('VE d’entrée'), 'financing.entryEv', f.entryEv, UM(), { ph: ok(b.ask) ? nf(b.ask) + ' · ' + T('demandé') : '' })}${field(T('Frais d’acquisition'), 'financing.feesPct', f.feesPct, T('% VE'))}
    ${field(T('Dette d’acquisition'), 'financing.leverage', f.leverage, T('× EBITDA'))}${field(T('Taux d’intérêt'), 'financing.rate', f.rate, '%')}
    ${field(T('Amortissement de la dette'), 'financing.amortYears', f.amortYears, T('ans'), { d: 0 })}${field(T('Horizon d’analyse'), 'financing.hold', f.hold, T('ans'), { d: 0 })}
    ${field(T('Multiple de sortie'), 'financing.exitMultiple', f.exitMultiple, T('× EBITDA'), { ph: ret ? nf(ret.entryMult) + ' · ' + T('entrée') : '' })}
    <div class="field"><span style="font-size:13px;color:#566378;font-weight:500">${T('Remboursement anticipé')}</span><label class="check"><input type="checkbox" id="f-financing.sweep" data-k="financing.sweep" data-t="bool" ${f.sweep ? 'checked' : ''}>${T('Affecter la trésorerie à la dette')}</label></div></div>`);
  const syn = card(T('Synergies d’intégration'), 'layers', `<div class="form">
    ${field(T('Synergies de coûts'), 'synergies.cost', s.cost, T('{0} / an', UM()), { d: 2 })}${field(T('Synergies de revenus (EBITDA)'), 'synergies.revenue', s.revenue, T('{0} / an', UM()), { d: 2 })}
    ${field(T('Montée en charge'), 'synergies.rampYears', s.rampYears, T('ans'), { d: 0 })}${field(T('Coûts d’intégration (an 1)'), 'synergies.integrationCost', s.integrationCost, UM(), { d: 2 })}</div>
    <div class="field" style="margin-top:14px"><label for="f-synergies.note">${T('Origine des synergies')}</label>${inp('synergies.note', s.note, { type: 'text', cls: 'txt', label: T('Origine des synergies') })}</div>`);
  if (!ret) return pageHead(d) + `<div class="g2e">${hyp}${syn}</div><div class="card panel mt"><div class="empty">${T('Il manque l’EBITDA retenu ou un prix d’entrée.')}</div></div>`;
  const mp = maxP(d, c.hurdle), exitShare = ret.exitEq / BOS.sum(ret.flows.slice(1));
  const em = ret.entryMult, entryM = [-2, -1, 0, 1, 2].map(x => em + x), exitM = [-2, -1, 0, 1, 2].map(x => ret.exitMult + x);
  const cell = r => { if (!r || r.irr == null) return '<td class="n">—</td>'; const v = r.irr * 100; return `<td class="n ${v >= c.hurdle ? 'hg' : 'hb'}">${pc(v)}</td>`; };
  const t1 = `<table><thead><tr><th>${T('Entrée \\ sortie')}</th>${exitM.map(x => `<th class="n">${mx(x)}</th>`).join('')}</tr></thead><tbody>${entryM.map(a => `<tr><td class="lbl">${mx(a)} · ${meur(a * b.adjEbitda)}</td>${exitM.map(z => cell(BOS.returns(d, { ev: a * b.adjEbitda, exitMult: z }))).join('')}</tr>`).join('')}</tbody></table>`;
  const gsh = [-6, -3, 0, 3], sm = [0, .5, 1, 1.5];
  const t2 = `<table><thead><tr><th>${T('Croissance \\ synergies')}</th>${sm.map(x => `<th class="n">${pc(x * 100, 0)}</th>`).join('')}</tr></thead><tbody>${gsh.map(a => `<tr><td class="lbl">${T('{0} / an', sg(a, 0, ' pt'))}</td>${sm.map(z => cell(BOS.returns(d, { growthShift: a, synergyMult: z }))).join('')}</tr>`).join('')}</tbody></table>`;
  const R = ret.rows;
  const line = (l, k, sgn = 1, dec = 2, cls = '') => `<tr class="${cls}"><td class="lbl">${l}</td>${R.map(r => `<td class="n ${ok(r[k]) && Math.abs(r[k]) < .005 ? 'dim' : ''}">${!ok(r[k]) || Math.abs(r[k]) < .005 ? '–' : nf(sgn * r[k], dec)}</td>`).join('')}</tr>`;
  return pageHead(d) + `
  <div class="g4">
    ${metric(T('TRI'), 'trend', pc(ret.irr * 100), `<span class="${ret.irr * 100 >= c.hurdle ? 'up' : 'down'}">${ret.irr * 100 >= c.hurdle ? T('au-dessus du seuil') : T('sous le seuil')}</span> ${T('de {0}', pc(c.hurdle, 0))}`)}
    ${metric(T('Multiple du capital'), 'coins', mx(ret.mom, 2), T('sur {0} ans', ret.H))}
    ${metric(T('Prix max au TRI cible'), 'target', meur(mp), ok(b.ask) && mp ? `<span class="${mp >= b.ask ? 'up' : 'down'}">${sg(100 * (mp / b.ask - 1), 0)}</span> ${T('vs prix demandé')}` : '')}
    ${metric(T('ROIC année 5'), 'percent', pc(ret.roic5 * 100), T('résultat d’exploitation après IS / capital investi'))}
  </div>
  <div class="stats mt">${[[T('Rendement cash an 1'), pc(ret.cashYield1 * 100), T('flux avant dette / emplois')], [T('Retour sur fonds propres'), ret.payback ? T('{0} ans', ret.payback) : T('> {0} ans', ret.H), T('hors valeur de sortie')], [T('Levier maximal'), mx(ret.maxLev), T('dette / EBITDA')], [T('Part de la sortie dans les flux'), pc(exitShare * 100, 0), T('dépendance à la revente')]].map(([l, v, s2]) => `<div class="stat"><small>${l}</small><strong>${v}</strong><span>${s2}</span></div>`).join('')}</div>
  <p class="note" style="margin:12px 2px 0">${T('Pour un acquéreur qui conserve ses participations, regardez d’abord le ROIC, le rendement cash et le prix maximal. Plus la part de la sortie est élevée, plus le TRI dépend de la revente.')}</p>
  <div class="g2e mt">${hyp}<div class="stack">${syn}
    ${card(T('Emplois et ressources'), 'scale', `<div class="tw"><table><thead><tr><th>${T('Emplois')}</th><th class="n">${UM()}</th><th>${T('Ressources')}</th><th class="n">${UM()}</th></tr></thead><tbody>
      <tr><td class="lbl">${T('Titres')}</td><td class="n">${nf(ret.ev - (b.netDebt || 0))}</td><td class="lbl">${T('Dette d’acquisition')}</td><td class="n">${nf(ret.debt0)}</td></tr>
      <tr><td class="lbl">${T('Refinancement de la dette nette')}</td><td class="n">${nf(b.netDebt || 0)}</td><td class="lbl">${T('Fonds propres')}</td><td class="n">${nf(ret.equity)}</td></tr>
      <tr><td class="lbl">${T('Éléments assimilés')}</td><td class="n">${nf(ret.debtLike)}</td><td></td><td></td></tr><tr><td class="lbl">${T('Frais')}</td><td class="n">${nf(ret.fees)}</td><td></td><td></td></tr>
      <tr class="tot"><td>${T('Total')}</td><td class="n">${nf(ret.uses)}</td><td>${T('Total')}</td><td class="n">${nf(ret.debt0 + ret.equity)}</td></tr></tbody></table></div>`)}</div></div>
  ${card(T('Flux annuels'), 'chart', `<div class="tw"><table><thead><tr><th>${UM()}</th>${R.map(r => `<th class="n">${r.year}</th>`).join('')}</tr></thead><tbody>
    ${line(T('Chiffre d’affaires'), 'rev', 1, 1)}${line(T('EBITDA autonome'), 'ebitda')}${line(T('Synergies réalisées'), 'syn')}${line(T('EBITDA total'), 'ebitdaTot', 1, 2, 'tot')}
    ${line(T('Coûts d’intégration'), 'integ', -1)}${line(T('IS'), 'taxes', -1)}${line('Capex', 'capex', -1)}${line(T('Variation de BFR'), 'dNwc', -1)}
    ${line(T('Flux avant service de la dette'), 'fcfPre', 1, 2, 'tot')}${line(T('Intérêts'), 'interest', -1)}${line(T('Remboursement de la dette'), 'amort', -1)}${line(T('Remboursement anticipé'), 'sweep', -1)}
    ${line(T('Flux disponible pour l’acquéreur'), 'fcfe', 1, 2, 'tot')}${line(T('Dette en fin d’année'), 'debtEnd')}
    <tr class="sub"><td>${T('Dette / EBITDA')}</td>${R.map(r => `<td class="n">${mx(r.lev)}</td>`).join('')}</tr><tr class="sub"><td>ROIC</td>${R.map(r => `<td class="n">${pc(r.roic * 100)}</td>`).join('')}</tr>
  </tbody></table></div><p class="note" style="margin-top:12px">${T('Sortie en année {0} : VE de {1} moins la dette restante, soit {2} pour les titres.', ret.H, meur(ret.exitEv), meur(ret.exitEq))}</p>`, { cls: 'mt' })}
  <div class="g2e mt">${card(T('TRI selon les multiples'), 'grid', `<div class="tw">${t1}</div><p class="note" style="margin-top:12px">${T('Vert : TRI au moins égal au seuil de {0}. Multiples appliqués à l’EBITDA retenu ({1}).', pc(c.hurdle, 0), meur(b.adjEbitda, 2))}</p>`, { sub: T('entrée × sortie') })}
    ${card(T('TRI selon l’exécution'), 'grid', `<div class="tw">${t2}</div><p class="note" style="margin-top:12px">${T('Écart de croissance annuelle par rapport au plan, et part des synergies réalisée.')}</p>`, { sub: T('croissance × synergies') })}</div>`;
}

/* ---------- Demandes d'infos ---------- */
function vDiligence(d) {
  const c = compute(d), qs = d.questions || [], missing = missingQuestions(d, c);
  return pageHead(d) + `<div class="g2b">
  ${card(T('Demandes d’informations au vendeur'), 'inbox', `<div class="tw"><table><thead><tr><th>${T('Question')}</th><th>${T('Thème')}</th><th>${T('Priorité')}</th><th>${T('Statut')}</th><th></th></tr></thead><tbody>
    ${qs.map((q, i) => `<tr><td class="wrapc">${inp(`questions.${i}.q`, q.q, { type: 'text', cls: 'txt', label: T('Question') })}<div style="margin-top:6px">${inp(`questions.${i}.answer`, q.answer, { type: 'text', cls: 'txt', label: T('Réponse'), ph: T('Réponse du vendeur') })}</div></td>
      <td>${sel(`questions.${i}.cat`, q.cat, ['Financier', 'Commercial', 'Produit', 'Juridique', 'RH', 'Fiscal', 'IT'], T('Thème'))}</td><td>${sel(`questions.${i}.priority`, q.priority, ['Décisive', 'Importante', 'Normale'], T('Priorité'))}</td>
      <td>${sel(`questions.${i}.status`, q.status, ['Ouverte', 'Envoyée', 'Répondue'], T('Statut'))}</td><td><button class="iconbtn" data-a="delq" data-i="${i}" aria-label="${T('Supprimer')}">${I('x')}</button></td></tr>`).join('') || `<tr><td colspan="5" class="empty">${T('Aucune question.')}</td></tr>`}
  </tbody></table></div>${missing.length ? `<div class="ask" style="margin-top:8px"><span class="askicon">${I('info')}</span><div><b>${T('{0} données de la grille sans demande associée', missing.length)}</b><span class="mini">${missing.map(m => esc(T(m[0]))).join(', ')}</span></div><button class="btn sm end" data-a="genq">${T('Ajouter les questions')}</button></div>` : ''}`, { right: `<button class="btn sm" data-a="addq">${I('plus')}${T('Ajouter')}</button>` })}
  <div class="stack">${card(T('Fiche du dossier'), 'building', `<div class="stack" style="gap:12px">
    ${[['Nom de code', 'name'], ['Secteur', 'sector'], ['Pays', 'country'], ['Équipe', 'team'], ['Document source', 'source']].map(([l, k]) => `<div class="field"><label for="f-${k}">${T(l)}</label>${inp(k, d[k], { type: 'text', cls: 'txt', label: T(l) })}</div>`).join('')}
    <div class="field"><label for="f-description">${T('Activité')}</label><textarea class="in" id="f-description" data-k="description" data-t="text">${esc(d.description)}</textarea></div></div>`)}
    ${card(T('Thèse d’investissement'), 'flag', `<div class="stack" style="gap:12px"><div class="field"><label for="f-thesis">${T('Pourquoi acheter')}</label><textarea class="in" id="f-thesis" data-k="thesis" data-t="text">${esc(d.thesis)}</textarea></div>
      <div class="field"><label for="f-risks">${T('Ce qui invaliderait la thèse')}</label><textarea class="in" id="f-risks" data-k="risks" data-t="text">${esc(d.risks)}</textarea></div></div>`)}</div></div>`;
}
function missingQuestions(d, c) {
  const b = c.b, have = (d.questions || []).map(q => (q.q || '').toLowerCase());
  return [['Top 10 clients', b.top10 == null, 'Quelle part du CA représentent les dix premiers clients ?', 'Commercial', 'Décisive'],
    ['Dette nette', b.netDebt == null, 'Montant et détail de la dette financière nette à la clôture', 'Financier', 'Décisive'],
    ['Prix demandé', b.ask == null, 'Quelle valeur d’entreprise le vendeur attend-il pour 100 % du capital ?', 'Financier', 'Décisive'],
    ['Churn clients', b.churn == null, 'Taux annuel de perte de clients sur trois exercices', 'Commercial', 'Importante'],
    ['Revenus récurrents', b.recurring == null, 'Répartition du CA : abonnements, maintenance, licences, services', 'Financier', 'Importante'],
    ['ARR', b.arr == null, 'Revenu récurrent annualisé à la clôture et sa formation', 'Financier', 'Normale']]
    .filter(x => x[1] && !have.some(h => h.includes(T(x[2]).toLowerCase().slice(0, 25)))).map(x => [x[0], T(x[2]), x[3], x[4]]);
}

/* ---------- événements ---------- */
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'langSel') { LANG = el.value; pref('lang', LANG); render(); return; }
  const k = el.dataset && el.dataset.k; if (!k) return;
  const d = deal(), t = el.dataset.t;
  const v = t === 'bool' ? el.checked : t === 'text' ? el.value : parseNum(el.value);
  if (t !== 'bool' && t !== 'text' && el.value.trim() !== '' && v == null) { toast(T('Valeur non reconnue : saisissez un nombre.')); el.value = ''; return; }
  setPath(d, k, v);
  if (k.startsWith('hist.years.') && v != null) { const j = +k.split('.')[2]; d.hist.years = d.hist.years.map((_, i) => Math.round(v) - j + i); }
  d.example = false; persist(d); setTimeout(render, 0);
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, d = deal(), i = +b.dataset.i;
  const mut = fn => { fn(); d.example = false; persist(d); render(); };
  switch (a) {
    case 'new': { const n = blankDeal(T('Nouveau dossier')); S.deals.unshift(n); S.cur = n.id; pref('cur', n.id); persist(n); location.hash = 'diligence'; toast(T('Dossier créé. Complétez la fiche puis les données financières.')); break; }
    case 'open': S.cur = b.dataset.id; pref('cur', S.cur); lsWrite(); if (location.hash === '#synthese') render(); break;
    case 'dup': { const src = S.deals.find(x => x.id === b.dataset.id); const n = JSON.parse(JSON.stringify(src)); n.id = blankDeal().id; n.name = src.name + ' (' + T('copie') + ')'; n.example = false; S.deals.unshift(n); persist(n); render(); toast(T('Dossier dupliqué')); break; }
    case 'askdel': { const box = document.getElementById('ra-' + b.dataset.id); box.innerHTML = `<span class="confirm">${T('Supprimer ?')}<button class="btn sm danger" data-a="del" data-id="${esc(b.dataset.id)}">${T('Oui')}</button><button class="btn sm" data-a="nodel">${T('Non')}</button></span>`; break; }
    case 'nodel': render(); break;
    case 'del': await removeDeal(b.dataset.id); render(); toast(T('Dossier supprimé')); break;
    case 'addadj': mut(() => d.adjustments.push({ label: T('Nouveau retraitement'), amount: 0, included: false, status: 'À confirmer' })); break;
    case 'deladj': mut(() => d.adjustments.splice(i, 1)); break;
    case 'addcomp': mut(() => d.comps.push({ target: '', buyer: '', year: new Date().getFullYear(), geo: '', niche: '', rev: null, ebitda: null, ev: null, include: true })); break;
    case 'delcomp': mut(() => d.comps.splice(i, 1)); break;
    case 'addq': mut(() => d.questions.push({ q: '', cat: 'Financier', priority: 'Importante', status: 'Ouverte', answer: '' })); break;
    case 'delq': mut(() => d.questions.splice(i, 1)); break;
    case 'genq': { const c = compute(d); mut(() => missingQuestions(d, c).forEach(m => d.questions.push({ q: m[1], cat: m[2], priority: m[3], status: 'Ouverte', answer: '' }))); toast(T('Questions ajoutées')); break; }
    case 'grid': openGrid(d); break;
    case 'mandate': openMandate(); break;
    case 'import': openImport(); break;
    case 'xlsx': exportXlsx(d); break;
    case 'memo': exportMemo(d); break;
    case 'close': b.closest('dialog').close(); break;
  }
});
const tip = document.getElementById('tip');
document.addEventListener('mousemove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.style.display = 'none'; return; }
  tip.textContent = t.dataset.tip; tip.style.display = 'block';
  tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 12) + 'px';
  tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 10) + 'px';
});
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2800); }
const dlgHead = t => `<header><h3>${t}</h3><button class="iconbtn" data-a="close" aria-label="${T('Fermer')}">${I('x')}</button></header>`;

function openGrid(d) {
  const sc = compute(d).sc, dlg = $('#dlg');
  dlg.innerHTML = dlgHead(T('Grille d’analyse')) + `<div class="body"><p class="note">${T('Chaque critère reçoit 0, 1 ou 2 points, pondérés. La note est calculée sur les critères renseignés. Tant que des données manquent, elle reste provisoire : fourchette de {0} à {1} selon les valeurs à venir.', sc.lowS, sc.highS)}</p>
    <div class="tw"><table><thead><tr><th>${T('Critère')}</th><th class="n">${T('Poids')}</th><th class="n">${T('Valeur')}</th><th>${T('Signal')}</th></tr></thead><tbody>${sc.crit.map(k => `<tr><td>${T(k.label)}</td><td class="n">${k.w}</td><td class="n">${k.v == null ? '—' : k.unit === '%' ? pc(k.v) : mx(k.v, 2)}</td><td>${k.pts == null ? chip(T('À obtenir'), 'amber') : k.pts === 2 ? chip(T('Favorable'), 'good') : k.pts === 1 ? chip(T('Neutre')) : chip(T('Défavorable'), 'bad')}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${T('Seuils favorables : croissance ≥ 10 %, marge ≥ 20 %, récurrence ≥ 70 %, churn ≤ 7 %, top 10 ≤ 30 %, dette nette ≤ 1,5× EBITDA, prix ≤ médiane des comparables.')}</p></div>`;
  dlg.showModal();
}
function openMandate() {
  const m = S.mandate, dlg = $('#dlg');
  const f = (l, k, t) => `<div class="field"><label for="m-${k}">${l}</label><input class="in ${t ? 'txt' : ''}" id="m-${k}" value="${esc(t ? m[k] ?? '' : m[k] == null ? '' : nf(m[k], 0))}" style="width:100%;text-align:left"></div>`;
  dlg.innerHTML = dlgHead(T('Mandat acquéreur')) + `<div class="body"><p class="note">${T('Ces critères s’appliquent à tous les dossiers. Valeurs proposées : profil d’un consolidateur de logiciels verticaux qui conserve ses acquisitions. Ajustez-les à votre politique d’investissement.')}</p>
    ${f(T('Nom du profil'), 'name', 1)}<div class="form">${f(T('Secteurs acceptés (séparés par des virgules)'), 'sectors', 1)}${f(T('Zones acceptées'), 'geos', 1)}</div>
    <div class="form">${f(T('CA minimum ({0})', UM()), 'minRev')}${f(T('CA maximum ({0})', UM()), 'maxRev')}${f(T('Récurrence minimale (%)'), 'minRecurring')}${f(T('Marge d’EBITDA minimale (%)'), 'minMargin')}${f(T('TRI cible (%)'), 'hurdle')}</div></div>
    <footer><button class="btn" data-a="close">${T('Annuler')}</button><button class="btn primary" id="msave">${T('Enregistrer')}</button></footer>`;
  dlg.showModal();
  $('#msave').onclick = () => { for (const k of ['name', 'sectors', 'geos']) S.mandate[k] = $('#m-' + k).value.trim(); for (const k of ['minRev', 'maxRev', 'minRecurring', 'minMargin', 'hurdle']) S.mandate[k] = parseNum($('#m-' + k).value); persistMandate(); dlg.close(); render(); toast(T('Mandat enregistré')); };
}

/* ---------- import d'IM ---------- */
const FIELDS = [
  ['rev', 'Chiffre d’affaires', 'M€', /chiffre d.affaires|\brevenue\b|\bca\b|\bsales\b/i], ['ebitda', 'EBITDA', 'M€', /\bebitda\b|\bebe\b/i],
  ['arr', 'ARR', 'M€', /\barr\b|annual recurring revenue|revenu récurrent annualisé/i], ['recurring', 'Revenus récurrents', '%', /revenus récurrents|part récurrente|recurring revenue/i],
  ['churn', 'Churn clients', '%', /churn|attrition/i], ['top10', 'Top 10 clients', '%', /top\s*10|dix premiers clients|concentration/i],
  ['netDebt', 'Dette nette', 'M€', /dette (?:financière )?nette|net debt/i], ['askPrice', 'VE demandée (100 %)', 'M€', /valeur d.entreprise|valorisation attendue|enterprise value|prix demandé|asking price/i]
];
function extract(pages) {
  const out = {};
  for (const [key, , unit, re] of FIELDS) {
    const cands = [];
    pages.forEach((page, pi) => page.split(/\n/).forEach(line => {
      const m = re.exec(line); if (!m) return;
      const r = line.slice(m.index + m[0].length).match(/^[^0-9+−-]{0,40}?([+−-]?\d+(?:[   ]\d{3})*(?:[.,]\d+)?)\s*(millions?\s*(?:d[’']euros?|euros?)?|milliards?|milliers?|m\s*€|k\s*€|m€|k€|€\s*m|m(?:n)?\s*eur|k\s*eur|€|euros?|%)/i);
      if (!r || (unit === '%') !== (r[2] === '%')) return;
      let n = Number(r[1].replace(/[   ]/g, '').replace('−', '-').replace(',', '.'));
      const u = r[2].toLowerCase().replace(/\s/g, '');
      if (unit === 'M€') { if (u.startsWith('milliard')) n *= 1000; else if (/^k|^millier/.test(u)) n /= 1000; else if (u === '€' || u.startsWith('euro')) n /= 1e6; }
      if (Number.isFinite(n)) cands.push({ n, ref: 'IM p. ' + (pi + 1), line: line.trim().slice(0, 160) });
    }));
    if (cands.length) out[key] = cands[0];
  }
  const text = pages.slice(0, 4).join('\n');
  const yr = text.match(/(?:exercice(?:\s+clos)?(?:\s+en)?|fiscal year|FY)\s*[:=]?\s*(20\d{2})/i), sector = text.match(/^(?:secteur(?: d’activité)?|industry|sector)\s*:\s*(.{2,80})$/im), country = text.match(/^(?:pays(?: du siège)?|country)\s*:\s*(.{2,60})$/im);
  return { vals: out, year: yr ? +yr[1] : null, sector: sector ? sector[1].trim() : '', country: country ? country[1].trim() : '' };
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); }); }
async function pdfPages(file) {
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  if (!window.pdfjsLib) { await loadScript(base + 'pdf.min.js'); await loadScript(base + 'pdf.worker.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; }
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise, pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, 80); p++) { const tc = await (await doc.getPage(p)).getTextContent(); pages.push(tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('')); }
  return pages;
}
let imName = '';
function openImport() {
  const dlg = $('#dlg'); imName = '';
  dlg.innerHTML = dlgHead(T('Importer un mémorandum d’information')) + `<div class="body">
    <div class="drop" id="drop"><span class="pdficon">${I('file')}</span><span>${T('Déposez le PDF de l’IM ici')}</span><label class="btn" for="imfile">${I('upload')}${T('Choisir un fichier')}</label><input type="file" id="imfile" accept="application/pdf,.pdf,.txt" hidden><span class="note">${T('Le fichier est lu dans votre navigateur et n’est envoyé nulle part.')}</span></div>
    <div class="field"><label for="imtext">${T('Ou collez des extraits de l’IM')}</label><textarea class="in" id="imtext" placeholder="${T('Chiffre d’affaires : 12,4 M€')}&#10;EBITDA : 3,1 M€"></textarea></div><div id="imres"></div></div>
    <footer><button class="btn" data-a="close">${T('Fermer')}</button><button class="btn" id="imparse">${T('Analyser le texte')}</button></footer>`;
  dlg.showModal();
  $('#imparse').onclick = () => showExtract([$('#imtext').value]);
  const handle = async file => { if (!file) return; $('#imres').innerHTML = `<p class="note">${T('Lecture du document…')}</p>`; try { imName = file.name; showExtract(file.name.toLowerCase().endsWith('.pdf') ? await pdfPages(file) : [await file.text()]); } catch { $('#imres').innerHTML = `<p class="note down">${T('Lecture impossible. Copiez le texte de l’IM et collez-le ci-dessus.')}</p>`; } };
  $('#imfile').onchange = e => handle(e.target.files[0]);
  const dz = $('#drop'); dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); handle(e.dataTransfer.files[0]); };
}
function showExtract(pages) {
  const r = extract(pages), box = $('#imres');
  if (!Object.keys(r.vals).length) { box.innerHTML = `<p class="note">${T('Aucun indicateur reconnu. Le texte doit contenir des libellés comme « Chiffre d’affaires : 12,4 M€ ».')}</p>`; return; }
  box.innerHTML = `<div class="tw"><table><thead><tr><th></th><th>${T('Indicateur')}</th><th class="n">${T('Valeur')}</th><th>${T('Source')}</th></tr></thead><tbody>
    ${FIELDS.filter(f => r.vals[f[0]]).map(([k, l, u]) => `<tr><td><input type="checkbox" checked id="ex-${k}" aria-label="${esc(T(l))}"></td><td>${esc(T(l))}</td><td class="n">${u === '%' ? pc(r.vals[k].n) : meur(r.vals[k].n, 2)}</td><td class="wrapc mini">${esc(r.vals[k].ref)} · « ${esc(r.vals[k].line)} »</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${r.year ? T('Exercice détecté : {0}.', r.year) + ' ' : ''}${T('Vérifiez chaque valeur avant de l’appliquer.')}</p>
    <div class="actions"><button class="btn" id="exapply">${T('Appliquer au dossier ouvert')}</button><button class="btn primary" id="exnew">${T('Créer un nouveau dossier')}</button></div>`;
  const apply = d => {
    const v = k => document.getElementById('ex-' + k)?.checked ? r.vals[k] : null, L = d.hist.rev.length - 1;
    if (r.year) d.hist.years = d.hist.years.map((_, i) => r.year - L + i);
    if (v('rev')) { d.hist.rev[L] = v('rev').n; d.refs.rev = v('rev').ref; }
    if (v('ebitda')) { d.hist.ebitda[L] = v('ebitda').n; d.refs.ebitda = v('ebitda').ref; }
    for (const k of ['arr', 'recurring', 'churn', 'top10']) if (v(k)) { d.kpi[k] = v(k).n; d.refs[k] = v(k).ref; }
    if (v('netDebt')) { d.bs.netDebt = v('netDebt').n; d.refs.netDebt = v('netDebt').ref; }
    if (v('askPrice')) { d.askPrice = v('askPrice').n; d.refs.askPrice = v('askPrice').ref; }
    if (r.sector && !d.sector) d.sector = r.sector; if (r.country && !d.country) d.country = r.country; if (imName) d.source = imName;
    d.example = false; persist(d); $('#dlg').close(); location.hash = 'financiers'; render(); toast(T('Données importées. Complétez l’historique.'));
  };
  $('#exapply').onclick = () => apply(deal());
  $('#exnew').onclick = () => { const n = blankDeal((imName || T('Nouveau dossier')).replace(/\.(pdf|txt)$/i, '').replace(/[_-]+/g, ' ')); S.deals.unshift(n); S.cur = n.id; pref('cur', n.id); apply(n); };
}

/* ---------- exports ---------- */
async function save(filename, data) {
  if (!S.dl) { try { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'text/html' })); const a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); toast(T('Fichier prêt : {0}', filename)); } catch { toast(T('Le téléchargement n’est pas disponible ici.')); } return; }
  try { await S.dl.save({ filename, data }); toast(T('Fichier prêt : {0}', filename)); } catch (e) { if (e && e.code !== 'declined') toast(T('Export impossible ({0}).', e.code || '')); }
}
const slug = s => (s || 'dossier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
async function exportXlsx(d) {
  const c = compute(d), { b, cp, dc, ret, sc } = c;
  if (!window.XLSX) { try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); } catch { toast(T('Module Excel indisponible.')); return; } }
  const X = window.XLSX, wb = X.utils.book_new(), r2 = v => ok(v) ? Math.round(v * 1000) / 1000 : null, U = ' (' + UM() + ')';
  const add = (name, aoa, w) => { const ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = (w || []).map(x => ({ wch: x })); X.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
  add(T('Synthèse'), [[d.name], [[d.sector, d.country, T(d.stage)].filter(Boolean).join(' · ')], [], [T('Avis préliminaire'), T(TAG[sc.code])], [T('Note'), sc.score, sc.provisional ? T('provisoire') : ''], [],
    [T('Chiffre d’affaires') + U, r2(b.rev)], [T('EBITDA publié') + U, r2(b.ebitda)], [T('EBITDA retenu') + U, r2(b.adjEbitda)], [T('Marge d’EBITDA') + ' (%)', r2(b.margin)], [T('Croissance') + ' (%)', r2(b.growth)], [T('Revenus récurrents') + ' (%)', b.recurring], [T('Churn clients') + ' (%)', b.churn], [T('Top 10 clients') + ' (%)', b.top10], [T('Dette nette') + U, b.netDebt], [T('VE demandée (100 %)') + U, b.ask], [],
    [T('VE d’entrée') + U, ret && r2(ret.ev)], [T('TRI'), ret && r2(ret.irr)], [T('Multiple du capital'), ret && r2(ret.mom)], [T('ROIC année 5'), ret && r2(ret.roic5)], [T('Prix max au TRI cible') + U, r2(maxP(d, c.hurdle))], [], [T('Pourquoi acheter'), d.thesis], [T('Ce qui invaliderait la thèse'), d.risks]], [36, 18, 30]);
  add(T('Données financières'), [[UM(), ...d.hist.years], [T('Chiffre d’affaires'), ...d.hist.rev], [T('EBITDA publié'), ...d.hist.ebitda], ['Capex', ...d.hist.capex], [], [T('Retraitement'), T('Montant'), T('Inclus vendeur'), T('Statut')], ...d.adjustments.map(a => [a.label, a.amount, a.included ? T('Oui') : T('Non'), T(a.status)]), [T('EBITDA retenu'), r2(b.adjEbitda)]], [34, 12, 12, 12, 12, 12]);
  add(T('Comparables'), [[T('Retenir'), T('Cible'), T('Acquéreur'), T('Année'), T('Zone'), T('Niche'), T('CA'), 'EBITDA', T('VE'), T('VE / CA'), T('VE / EBITDA')], ...cp.rows.map(r => [r.include ? T('Oui') : T('Non'), r.target, r.buyer, r.year, r.geo, r.niche, r.rev, r.ebitda, r.ev, r2(r.evRev), r2(r.evEbitda)]), [], [T('Médiane'), '', '', '', '', '', '', '', '', r2(cp.evRev.med), r2(cp.evEbitda.med)]], [8, 24, 20, 8, 12, 24, 8, 8, 8, 8, 10]);
  if (dc) add('DCF', [['WACC (%)', N(d.dcf.wacc)], ['g (%)', N(d.dcf.g)], [], [UM(), ...dc.rows.map(r => r.year)], [T('Flux de trésorerie disponible'), ...dc.rows.map(r => r2(r.fcf))], [T('Valeur actualisée'), ...dc.rows.map(r => r2(r.pv))], [], [T('VE · DCF'), r2(dc.ev)]], [30, 10, 10, 10, 10, 10]);
  if (ret) add(T('Rendement'), [[UM(), ...ret.rows.map(r => r.year)], ...[['Chiffre d’affaires', 'rev'], ['EBITDA total', 'ebitdaTot'], ['Flux avant service de la dette', 'fcfPre'], ['Intérêts', 'interest'], ['Flux disponible pour l’acquéreur', 'fcfe'], ['Dette en fin d’année', 'debtEnd'], ['ROIC', 'roic']].map(([l, k]) => [T(l), ...ret.rows.map(r => r2(r[k]))]), [], [T('Fonds propres'), r2(ret.equity)], [T('TRI'), r2(ret.irr)], [T('Multiple du capital'), r2(ret.mom)]], [32, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  add(T('Demandes'), [[T('Question'), T('Thème'), T('Priorité'), T('Statut'), T('Réponse')], ...d.questions.map(q => [q.q, T(q.cat), T(q.priority), T(q.status), q.answer])], [60, 12, 12, 12, 40]);
  save('BOS_' + slug(d.name) + '.xlsx', new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })]));
}
function exportMemo(d) {
  const c = compute(d), { b, ret, sc, dc, cp } = c, mp = maxP(d, c.hurdle), row = (l, v) => `<tr><td>${esc(l)}</td><td style="text-align:right">${v}</td></tr>`;
  const html = `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>${esc(d.name)} · ${T('Note de comité')}</title><style>body{font:15px/1.55 Inter,-apple-system,Segoe UI,sans-serif;color:#192638;max-width:820px;margin:36px auto;padding:0 22px}h1{font-size:30px;letter-spacing:-1px;margin:4px 0}h2{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#667388;margin:28px 0 8px}table{border-collapse:collapse;width:100%}td{padding:6px 4px;border-bottom:1px solid #edf0f4;font-variant-numeric:tabular-nums}.v{background:#10203b;color:#fff;border-radius:10px;padding:18px 20px}.v b{font-size:20px}.m{color:#667388;font-size:13px}</style></head><body>
  <p class="m">${T('Note préparatoire au comité d’investissement')} · ${new Date().toLocaleDateString(loc())}</p><h1>${esc(d.name)}</h1><p class="m">${esc([d.sector, d.country, T(d.stage)].filter(Boolean).join(' · '))}</p><p>${esc(d.description)}</p>
  <div class="v"><b>${T(headline(sc))}</b> · ${T('Note')} ${sc.score ?? '—'}/100${sc.provisional ? ' (' + T('provisoire') + ')' : ''}<br>${esc(sc.reasons.map(reasonText).join(' '))}</div>
  <h2>${T('Pourquoi acheter')}</h2><p>${esc(d.thesis) || '—'}</p><h2>${T('Ce qui invaliderait la thèse')}</h2><p>${esc(d.risks) || '—'}</p>
  <h2>${T('Indicateurs clés')}</h2><table>${row(T('Chiffre d’affaires') + ' ' + (b.year || ''), meur(b.rev))}${row(T('Croissance'), pc(b.growth))}${row(T('EBITDA retenu'), meur(b.adjEbitda, 2))}${row(T('Marge d’EBITDA'), pc(b.margin))}${row(T('Revenus récurrents'), pc(b.recurring, 0))}${row(T('Churn clients'), pc(b.churn))}${row(T('Top 10 clients'), pc(b.top10, 0))}${row(T('Dette nette'), meur(b.netDebt))}</table>
  <h2>${T('Valorisation')}</h2><table>${row(T('Prix demandé'), meur(b.ask) + ' · ' + mx(b.askEvEbitda) + ' EBITDA')}${cp.evEbitda.n ? row(T('Transactions · VE / EBITDA'), meur(cp.evEbitda.q1 * b.adjEbitda) + ' – ' + meur(cp.evEbitda.q3 * b.adjEbitda)) : ''}${row(T('DCF central'), meur(dc?.ev))}${row(T('Prix max au TRI cible'), meur(mp))}</table>
  <h2>${T('Rendement pour l’acquéreur')}</h2><table>${ret ? row(T('VE d’entrée'), meur(ret.ev)) + row(T('TRI'), pc(ret.irr * 100)) + row(T('Multiple du capital'), mx(ret.mom, 2)) + row(T('ROIC année 5'), pc(ret.roic5 * 100)) + row(T('Dette d’acquisition'), meur(ret.debt0)) : row(T('Rendement'), T('À calculer'))}</table>
  <h2>${T('Informations à obtenir')}</h2><ul>${d.questions.filter(q => q.status !== 'Répondue').map(q => `<li><b>${esc(T(q.priority))}</b> · ${esc(q.q)}</li>`).join('') || '<li>—</li>'}</ul><p class="m">${T('Hypothèses de l’analyste, à valider en due diligence.')}</p></body></html>`;
  save(T('Note_comite') + '_' + slug(d.name) + '.html', html);
}

boot();
})();
