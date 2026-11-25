/* Note de comité HTML autonome (port de exportMemo de legacy/app.js). */
import type { Deal } from '../../engine/types';
import { decisionLabel, phaseLabel, type DealMeta } from '../../domain/phases';
import { fmt, t as tr, type Locale } from '../../i18n/format';
import type { Computed } from '../../components/project/compute';
import { headlineKey, reasonText } from '../../components/project/verdict';
import { download, slug } from './download';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Phase du dossier, avec la décision finale le cas échéant. */
export const stageText = (locale: Locale, meta: DealMeta): string =>
  meta.decision ? `${phaseLabel(locale, meta.phase)} · ${decisionLabel(locale, meta.decision)}` : phaseLabel(locale, meta.phase);

export function memoHtml(d: Deal, meta: DealMeta, c: Computed, locale: Locale, now: Date = new Date()): string {
  const f = { ...fmt(locale), t: (k: string, ...a: (string | number)[]) => tr(locale, k, ...a) };
  const { t, meur, pc, mx } = f;
  const { b, ret, sc, dc, cp, mp } = c;
  const row = (l: string, v: string) => `<tr><td>${esc(l)}</td><td style="text-align:right">${esc(v)}</td></tr>`;
  const n = (v: number | null | undefined) => (v == null ? NaN : v);
  const dateLoc = locale === 'en' ? 'en-GB' : 'fr-FR';
  const open = d.questions.filter((q) => q.status !== 'Répondue');
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(d.name)} · ${esc(t('Note de comité'))}</title><style>body{font:15px/1.55 Inter,-apple-system,Segoe UI,sans-serif;color:#192638;max-width:820px;margin:36px auto;padding:0 22px}h1{font-size:30px;letter-spacing:-1px;margin:4px 0}h2{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:#667388;margin:28px 0 8px}table{border-collapse:collapse;width:100%}td{padding:6px 4px;border-bottom:1px solid #edf0f4;font-variant-numeric:tabular-nums}.v{background:#10203b;color:#fff;border-radius:10px;padding:18px 20px}.v b{font-size:20px}.m{color:#667388;font-size:13px}</style></head><body>
  <p class="m">${esc(t('Note préparatoire au comité d’investissement'))} · ${esc(now.toLocaleDateString(dateLoc))}</p><h1>${esc(d.name)}</h1><p class="m">${esc([d.sector, d.country, stageText(locale, meta)].filter(Boolean).join(' · '))}</p><p>${esc(d.description)}</p>
  <div class="v"><b>${esc(t(headlineKey(sc)))}</b> · ${esc(t('Note'))} ${sc.score == null ? '—' : Math.round(sc.score)}/100${sc.provisional ? ' (' + esc(t('provisoire')) + ')' : ''}<br>${esc(sc.reasons.map((r) => reasonText(r, f)).join(' '))}</div>
  <h2>${esc(t('Pourquoi acheter'))}</h2><p>${esc(d.thesis) || '—'}</p><h2>${esc(t('Ce qui invaliderait la thèse'))}</h2><p>${esc(d.risks) || '—'}</p>
  <h2>${esc(t('Indicateurs clés'))}</h2><table>${row(t('Chiffre d’affaires') + ' ' + (b.year || ''), meur(n(b.rev)))}${row(t('Croissance'), pc(n(b.growth)))}${row(t('EBITDA retenu'), meur(n(b.adjEbitda), 2))}${row(t('Marge d’EBITDA'), pc(n(b.margin)))}${row(t('Revenus récurrents'), pc(n(b.recurring), 0))}${row(t('Churn clients'), pc(n(b.churn)))}${row(t('Top 10 clients'), pc(n(b.top10), 0))}${row(t('Dette nette'), meur(n(b.netDebt)))}</table>
  <h2>${esc(t('Valorisation'))}</h2><table>${row(t('Prix demandé'), meur(n(b.ask)) + ' · ' + mx(n(b.askEvEbitda)) + ' EBITDA')}${cp.evEbitda.n && b.adjEbitda != null ? row(t('Transactions · VE / EBITDA'), meur(n(cp.evEbitda.q1) * b.adjEbitda) + ' – ' + meur(n(cp.evEbitda.q3) * b.adjEbitda)) : ''}${row(t('DCF central'), meur(n(dc?.ev)))}${row(t('Prix max au TRI cible'), meur(n(mp)))}</table>
  <h2>${esc(t('Rendement pour l’acquéreur'))}</h2><table>${ret ? row(t('VE d’entrée'), meur(ret.ev)) + row(t('TRI'), pc(n(ret.irr) * 100)) + row(t('Multiple du capital'), mx(ret.mom, 2)) + row(t('ROIC année 5'), pc(ret.roic5 * 100)) + row(t('Dette d’acquisition'), meur(ret.debt0)) : row(t('Rendement'), t('À calculer'))}</table>
  <h2>${esc(t('Informations à obtenir'))}</h2><ul>${open.map((q) => `<li><b>${esc(t(q.priority))}</b> · ${esc(q.q)}</li>`).join('') || '<li>—</li>'}</ul><p class="m">${esc(t('Hypothèses de l’analyste, à valider en due diligence.'))}</p></body></html>`;
}

export const memoFileName = (locale: Locale, d: Deal) => `${tr(locale, 'Note_comite')}_${slug(d.name)}.html`;

/** Télécharge la note de comité ; renvoie le nom du fichier. */
export function exportMemo(d: Deal, meta: DealMeta, c: Computed, locale: Locale): string {
  const name = memoFileName(locale, d);
  download(name, memoHtml(d, meta, c, locale));
  return name;
}
