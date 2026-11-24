import { EN } from './en';

export type Locale = 'fr' | 'en';

export function t(locale: Locale, key: string, ...args: (string | number)[]): string {
  let out = locale === 'en' ? (EN[key] ?? key) : key;
  args.forEach((v, i) => {
    out = out.split('{' + i + '}').join(String(v));
  });
  return out;
}

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const intlLoc = (l: Locale) => (l === 'en' ? 'en-GB' : 'fr-FR');

export function fmt(locale: Locale) {
  const en = locale === 'en';
  const nf = (n: number, d = 1): string =>
    ok(n) ? n.toLocaleString(intlLoc(locale), { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const meur = (n: number, d = 1): string =>
    ok(n) ? (en ? (n < 0 ? '−€' : '€') + nf(Math.abs(n), d) + 'm' : nf(n, d) + ' M€') : '—';
  const pc = (n: number, d = 1): string => (ok(n) ? nf(n, d) + (en ? '%' : ' %') : '—');
  const mx = (n: number, d = 1): string => (ok(n) ? nf(n, d) + '×' : '—');
  const sg = (n: number, d = 1, unit?: string): string =>
    ok(n) ? (n > 0 ? '+' : '') + nf(n, d) + (unit ?? (en ? '%' : ' %')) : '—';
  const unitM = (): string => (en ? '€m' : 'M€');
  return { nf, meur, pc, mx, sg, unitM };
}

/** vide → null ; illisible → 'invalid'. */
export function parseNum(locale: Locale, s: string): number | null | 'invalid' {
  if (s == null) return null;
  let x = String(s)
    .replace(/[\s  ]/g, '')
    .replace('−', '-')
    .replace(/M€|€m|[%×x€m]/gi, '');
  x = locale === 'en' ? x.replace(/,/g, '') : x.replace(',', '.');
  if (x === '') return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : 'invalid';
}
