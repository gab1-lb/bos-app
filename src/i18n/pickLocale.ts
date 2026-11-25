import type { Locale } from './format';

/** Language remembered for the sign-in and waiting pages (set once a member's language is known). */
export const LOCALE_COOKIE = 'bos_locale';

/** Cookie first, then the browser's preferred language among French and English (Accept-Language), French by default. */
export function pickLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (cookie === 'fr' || cookie === 'en') return cookie;
  let best: Locale = 'fr';
  let bestQ = -1;
  for (const part of (acceptLanguage ?? '').split(',')) {
    const [tag, ...params] = part.trim().toLowerCase().split(';');
    const lang = tag.split('-')[0];
    if (lang !== 'fr' && lang !== 'en') continue;
    const qp = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const q = qp ? Number(qp.slice(2)) : 1;
    if (Number.isFinite(q) && q > bestQ) { best = lang; bestQ = q; }
  }
  return best;
}
