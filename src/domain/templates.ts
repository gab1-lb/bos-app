import type { Deal, Mandate, Recipient } from '../engine/types';
import { base, comps, maxPrice, returns } from '../engine/finance';
import { fmt, type Locale } from '../i18n/format';
import type { DealMeta } from './phases';
import type { Member } from './permissions';
import { daysSince, type Wait } from './waits';

export type TemplateKey = 'info_request' | 'reminder' | 'bote_review' | 'committee_note' | 'no_go' | 'go_dd';
export type Template = { key: TemplateKey; locale: Locale; subject: string; body: string };

const fr = (key: TemplateKey, subject: string, body: string): Template => ({ key, locale: 'fr', subject, body });
const en = (key: TemplateKey, subject: string, body: string): Template => ({ key, locale: 'en', subject, body });

export const DEFAULT_TEMPLATES: Template[] = [
  fr('info_request', '{{deal.name}} : demande d’informations complémentaires',
`Bonjour,

Dans le cadre de notre analyse du {{deal.name}}, plusieurs points restent à clarifier. Pourriez-vous nous apporter votre éclairage sur les questions suivantes ?

{{questionsFor}}

Ces éléments nous permettront de finaliser notre Business Overview. Nous restons à votre disposition pour en échanger.

Bien cordialement,
{{author}}`),
  en('info_request', '{{deal.name}}: request for additional information',
`Hello,

As part of our review of {{deal.name}}, a few points remain to be clarified. Could you please help us with the following questions?

{{questionsFor}}

These answers will allow us to finalise our Business Overview. Happy to discuss at your convenience.

Best regards,
{{author}}`),
  fr('reminder', '{{deal.name}} : relance',
`Bonjour,

Nous nous permettons de revenir vers vous au sujet de notre demande sur le {{deal.name}}, restée sans réponse depuis {{days}} jours. Les points en attente sont les suivants :

{{questionsFor}}

Votre retour nous permettrait de poursuivre l’analyse dans les meilleurs délais.

Bien cordialement,
{{author}}`),
  en('reminder', '{{deal.name}}: follow-up',
`Hello,

I am following up on our request regarding {{deal.name}}, which has been pending for {{days}} days. The outstanding points are:

{{questionsFor}}

Your feedback would help us move the analysis forward promptly.

Best regards,
{{author}}`),
  fr('bote_review', '{{deal.name}} : BOTe pour revue',
`Bonjour,

Le BOTe du {{deal.name}} est prêt pour votre revue.

Synthèse :
- Chiffre d’affaires : {{rev}}
- EBITDA ajusté : {{adjEbitda}} (marge {{margin}})
- Prix demandé : {{ask}} ({{askMultiple}} l’EBITDA ajusté)
- TRI au prix demandé : {{irr}} (seuil : {{hurdle}})

Thèse : {{thesis}}

Risques : {{risks}}

Questions encore ouvertes :
{{openQuestions}}

Merci de me faire part de vos commentaires.

Bien cordialement,
{{author}}`),
  en('bote_review', '{{deal.name}}: BOTe for review',
`Hello,

The BOTe for {{deal.name}} is ready for your review.

Summary:
- Revenue: {{rev}}
- Adjusted EBITDA: {{adjEbitda}} ({{margin}} margin)
- Asking price: {{ask}} ({{askMultiple}} adjusted EBITDA)
- IRR at asking price: {{irr}} (hurdle: {{hurdle}})

Thesis: {{thesis}}

Risks: {{risks}}

Open questions:
{{openQuestions}}

Please share your comments.

Best regards,
{{author}}`),
  fr('committee_note', '{{deal.name}} : note pour le comité',
`Bonjour,

Veuillez trouver ci-dessous la synthèse du {{deal.name}} pour le comité.

- Chiffre d’affaires : {{rev}} ; EBITDA ajusté : {{adjEbitda}} (marge {{margin}})
- Prix demandé : {{ask}}, soit {{askMultiple}} l’EBITDA ajusté
- Valorisation implicite (multiples de transactions comparables) : {{range}}
- TRI au prix demandé : {{irr}}, pour un seuil de {{hurdle}}
- Prix maximum compatible avec le seuil : {{maxPrice}}

Thèse : {{thesis}}

Risques : {{risks}}

Questions ouvertes :
{{openQuestions}}

Bien cordialement,
{{author}}`),
  en('committee_note', '{{deal.name}}: committee note',
`Hello,

Please find below the {{deal.name}} summary for the committee.

- Revenue: {{rev}}; adjusted EBITDA: {{adjEbitda}} ({{margin}} margin)
- Asking price: {{ask}}, i.e. {{askMultiple}} adjusted EBITDA
- Implied valuation (precedent-transaction multiples): {{range}}
- IRR at asking price: {{irr}}, against a {{hurdle}} hurdle
- Maximum price consistent with the hurdle: {{maxPrice}}

Thesis: {{thesis}}

Risks: {{risks}}

Open questions:
{{openQuestions}}

Best regards,
{{author}}`),
  fr('no_go', '{{deal.name}} : suite de nos échanges',
`Bonjour,

Nous vous remercions du temps consacré à la présentation du {{deal.name}} et des informations partagées. Après examen approfondi, nous avons décidé de ne pas donner suite à ce stade, au regard de nos critères d’investissement.

Nous restons ouverts à échanger si la situation évolue.

Bien cordialement,
{{author}}`),
  en('no_go', '{{deal.name}}: following our discussions',
`Hello,

Thank you for the time spent presenting {{deal.name}} and for the information shared. After careful review, we have decided not to proceed at this stage, given our investment criteria.

We remain open to reconnecting should circumstances change.

Best regards,
{{author}}`),
  fr('go_dd', '{{deal.name}} : passage en due diligence',
`Bonjour,

Nous avons le plaisir de vous confirmer que nous souhaitons poursuivre avec le {{deal.name}} et engager une due diligence, sous réserve de la confirmation des éléments ci-dessous.

Pourriez-vous nous transmettre les informations suivantes ?

{{openQuestions}}

Nous vous proposerons prochainement un calendrier.

Bien cordialement,
{{author}}`),
  en('go_dd', '{{deal.name}}: moving to due diligence',
`Hello,

We are pleased to confirm that we wish to proceed with {{deal.name}} and begin due diligence, subject to confirmation of the items below.

Could you please provide the following information?

{{openQuestions}}

We will propose a timetable shortly.

Best regards,
{{author}}`),
];

export type RenderCtx = {
  deal: Deal;
  meta: DealMeta;
  mandate: Mandate;
  author: Member;
  recipient?: Recipient;
  locale: Locale;
  now: Date;
};

const has = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);

function variables(ctx: RenderCtx, key: TemplateKey): Record<string, string> {
  const { deal, mandate, author, recipient, locale, now } = ctx;
  const f = fmt(locale);
  const b = base(deal);
  const ret = returns(deal);
  const q = comps(deal).evEbitda;
  const hurdle = mandate.hurdle;
  const mp = has(hurdle) ? maxPrice(deal, hurdle) : null;
  const open = deal.questions.filter((x) => x.status !== 'Répondue');
  const bullets = (qs: typeof open) => qs.map((x) => '- ' + x.q).join('\n');
  const forRecipient = (qs: typeof open) => (recipient === undefined ? qs : qs.filter((x) => x.awaitedFrom === recipient));
  // Sent questions with no explicit recipient are awaited from the director, as in waitsFor.
  const pending = open
    .filter((x) => x.sentAt && !x.answeredAt)
    .filter((x) => recipient === undefined || (x.awaitedFrom ?? 'director') === recipient);
  const mine = key === 'reminder' ? pending : forRecipient(open);
  const pendingDays = pending.map((x) => daysSince(x.sentAt as string, now));
  const none = locale === 'en' ? 'No open questions.' : 'Aucune question ouverte.';
  const range =
    has(q.q1) && has(q.q3) && has(b.adjEbitda)
      ? locale === 'en'
        ? `${f.meur(q.q1 * b.adjEbitda)} – ${f.meur(q.q3 * b.adjEbitda)}`
        : `${f.nf(q.q1 * b.adjEbitda)} – ${f.meur(q.q3 * b.adjEbitda)}`
      : '';
  return {
    'deal.name': deal.name || '',
    rev: has(b.rev) ? f.meur(b.rev) : '',
    adjEbitda: has(b.adjEbitda) ? f.meur(b.adjEbitda) : '',
    margin: has(b.margin) ? f.pc(b.margin) : '',
    ask: has(b.ask) ? f.meur(b.ask) : '',
    askMultiple: has(b.askEvEbitda) ? f.mx(b.askEvEbitda) : '',
    range,
    irr: ret && has(ret.irr) ? f.pc(ret.irr * 100) : '',
    maxPrice: has(mp) ? f.meur(mp) : '',
    hurdle: has(hurdle) ? f.pc(hurdle) : '',
    thesis: deal.thesis?.trim() || '',
    risks: deal.risks?.trim() || '',
    openQuestions: open.length ? bullets(open) : none,
    questionsFor: mine.length ? bullets(mine) : none,
    author: author.name || '',
    days: pendingDays.length ? String(Math.max(...pendingDays)) : '',
  };
}

export function renderTemplate(tpl: Template, ctx: RenderCtx): { subject: string; body: string; missing: string[] } {
  const vars = variables(ctx, tpl.key);
  const placeholder = ctx.locale === 'en' ? '[to complete]' : '[à compléter]';
  const missing: string[] = [];
  const sub = (s: string) =>
    s.replace(/\{\{([\w.]+)\}\}/g, (_m, name: string) => {
      const v = vars[name];
      if (v === undefined || v === '') {
        if (!missing.includes(name)) missing.push(name);
        return placeholder;
      }
      return v;
    });
  return { subject: sub(tpl.subject), body: sub(tpl.body), missing };
}

export function suggestTemplate(meta: DealMeta, waits: Wait[], deal?: Deal): TemplateKey | null {
  if (waits.some((w) => w.source === 'question' && (w.level === 'late' || w.level === 'overdue'))) return 'reminder';
  if (meta.decision === 'no_go') return 'no_go';
  if (meta.decision === 'go_dd') return 'go_dd';
  if (meta.phase === 'analysis' && deal && deal.questions.some((q) => q.status !== 'Répondue' && !q.sentAt)) return 'info_request';
  if (meta.phase === 'bote_written') return 'bote_review';
  if (meta.phase === 'associate_review' && meta.validatedAt) return 'committee_note';
  return null;
}

export function mailtoHref(subject: string, body: string, to = ''): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** Recipient preselected in the message dialog (only info_request / reminder are addressed per recipient). */
export function defaultRecipient(key: TemplateKey, deal: Deal, waits: Wait[]): Recipient | undefined {
  if (key === 'reminder') {
    const qs = waits.filter((w) => w.source === 'question');
    return qs.length ? qs.reduce((a, b) => (b.days > a.days ? b : a)).from : undefined;
  }
  if (key === 'info_request') {
    const n = new Map<Recipient, number>();
    for (const q of deal.questions) {
      if (q.status !== 'Répondue' && !q.sentAt && q.awaitedFrom) n.set(q.awaitedFrom, (n.get(q.awaitedFrom) ?? 0) + 1);
    }
    let best: Recipient | undefined;
    for (const [r, c] of n) if (best === undefined || c > (n.get(best) as number)) best = r;
    return best;
  }
  return undefined;
}
