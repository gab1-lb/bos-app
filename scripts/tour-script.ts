/* Parcours de la vidéo de prise en main : données de démonstration, étapes et sous-titres FR/EN.
 * Lu par scripts/record-tour.ts (`npm run record:tour`). Tous les dossiers sont fictifs. */
import type { Locator, Page } from '@playwright/test';
import { demoDeal } from '../src/engine/samples.ts';
import type { Deal } from '../src/engine/types.ts';

export type TourLocale = 'fr' | 'en';

/** Outils fournis par l'enregistreur à chaque étape. */
export type TourCtx = {
  page: Page;
  locale: TourLocale;
  /** Choisit le libellé de la langue enregistrée. */
  tr(fr: string, en: string): string;
  /** Déplace le curseur visible jusqu'à l'élément, en douceur. */
  glide(target: Locator, opts?: { dx?: number; dy?: number; ms?: number }): Promise<void>;
  /** glide puis clic (avec halo). */
  click(target: Locator): Promise<void>;
  /** Défilement doux vers un élément (centré) ou une position verticale. */
  scroll(target: Locator | number, block?: 'start' | 'center'): Promise<void>;
  /** Attente visible (le temps de lire). */
  pause(ms: number): Promise<void>;
  /** Remet sous-titres et curseur au premier plan (après l'ouverture d'un <dialog> modal). */
  raise(): Promise<void>;
};

export type TourStep = { id: string; ms: number; caption: Record<TourLocale, string>; run(ctx: TourCtx): Promise<void> };

export const INTRO: Record<TourLocale, { title: string; sub: string }> = {
  fr: { title: 'Prendre en main BOS', sub: 'De l’import de l’IM à la note de comité.' },
  en: { title: 'Getting started with BOS', sub: 'From importing the IM to the committee note.' },
};

export const OUTRO: Record<TourLocale, { title: string; sub: string }> = {
  fr: { title: 'BOS', sub: 'Données de démonstration : tous les dossiers présentés sont fictifs.' },
  en: { title: 'BOS', sub: 'Demo data: every deal shown is fictitious.' },
};

const DEAL = 'demo-helios';
const tab = (page: Page, key: string) => page.locator(`nav.tabs a[href$="/${key}"]`);
const onUrl = (page: Page, re: RegExp) => page.waitForURL(re, { timeout: 15_000 });

export const STEPS: TourStep[] = [
  {
    id: 'accueil', ms: 8500,
    caption: {
      fr: 'Accueil : vos deals actifs, triés par urgence, avec les compteurs, les attentes et la prochaine action.',
      en: 'Home: your active deals, sorted by urgency, with counters, pending items and the next action.',
    },
    async run({ page, glide, scroll, pause }) {
      await pause(900);
      const counters = page.locator('[data-counter]');
      await glide(counters.nth(0), { ms: 700 });
      await glide(counters.nth(2), { ms: 700 });
      await pause(500);
      const card = page.locator(`[data-deal-card="${DEAL}"]`);
      await scroll(card.locator('.waits'), 'center');
      await glide(card.locator('[data-wait]').first(), { ms: 800 });
      await pause(700);
      await glide(card.locator('.hc-props button.btn.sm').first(), { ms: 700 });
    },
  },
  {
    id: 'message', ms: 8500,
    caption: {
      fr: 'Chaque prochaine action ouvre un message pré-rempli : relisez-le, puis copiez-le ou ouvrez votre messagerie.',
      en: 'Each next action opens a prefilled message: review it, then copy it or open your mail app.',
    },
    async run({ page, tr, click, glide, raise, pause }) {
      const card = page.locator(`[data-deal-card="${DEAL}"]`);
      await click(card.locator('.hc-props button.btn.sm').first());
      const dialog = page.locator('dialog.msgdlg');
      await dialog.waitFor();
      await raise();
      await pause(600);
      await glide(dialog.locator('textarea'), { dy: -60, ms: 900 });
      await pause(1600);
      await click(dialog.getByRole('button', { name: tr('Copier', 'Copy'), exact: true }));
      await pause(1700);
      await click(dialog.getByRole('button', { name: tr('Fermer', 'Close') }).first());
      // Le clic sur la croix est parfois perdu (intermittent) : Échap ferme aussi la fenêtre.
      if (!(await dialog.waitFor({ state: 'detached', timeout: 1500 }).then(() => true, () => false))) {
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
      }
    },
  },
  {
    id: 'synthese', ms: 8000,
    caption: {
      fr: 'Mon projet › Synthèse : l’avis préliminaire, la note sur 100 et les indicateurs clés du dossier.',
      en: 'My deal › Summary: the preliminary view, the score out of 100 and the key indicators.',
    },
    async run({ page, click, glide, scroll, pause }) {
      await click(page.locator(`[data-deal-card="${DEAL}"] a.hc-name`));
      await onUrl(page, /\/synthese$/);
      await page.locator('.hero').waitFor();
      await pause(1200);
      await glide(page.locator('.hero .score'), { ms: 800 });
      await pause(1000);
      await scroll(page.locator('.g4').first(), 'center');
      await glide(page.locator('.g4 > *').nth(1), { ms: 800 });
      await glide(page.locator('.g4 > *').nth(3), { ms: 800 });
    },
  },
  {
    id: 'financiers', ms: 8500,
    caption: {
      fr: 'Données financières : vos saisies apparaissent en bleu ; les retraitements QoE donnent l’EBITDA retenu.',
      en: 'Financials: your inputs show in blue; QoE adjustments give the retained EBITDA.',
    },
    async run({ page, click, glide, scroll, pause }) {
      await scroll(0);
      await click(tab(page, 'financiers'));
      await onUrl(page, /\/financiers$/);
      await pause(900);
      await glide(page.locator('[id="f-hist.rev.4"]'), { ms: 800 });
      await pause(700);
      const status = page.locator('[id="f-adjustments.0.status"]');
      await scroll(status, 'center');
      await glide(status, { ms: 800 });
      await pause(400);
      await status.selectOption({ index: 0 }); // « Accepté » : l'EBITDA retenu bouge
      await pause(500);
      await glide(page.locator('tr.tot').last(), { dx: -120, ms: 800 });
    },
  },
  {
    id: 'valorisation', ms: 8500,
    caption: {
      fr: 'Valorisation : une fourchette par méthode, et le repère « Demandé » situe le prix du vendeur.',
      en: 'Valuation: one range per method, and the “Ask” marker places the seller’s price.',
    },
    async run({ page, click, glide, scroll, pause }) {
      await scroll(0);
      await click(tab(page, 'valorisation'));
      await onUrl(page, /\/valorisation$/);
      const gauges = page.locator('[data-gauge]');
      await gauges.first().waitFor();
      await pause(400);
      await scroll(page.locator('.gz').first(), 'center');
      await pause(1400);
      await glide(gauges.nth(0), { ms: 800 });
      await glide(gauges.nth(2), { ms: 800 });
      await pause(400);
      await glide(page.locator('.gz-mark .gz-tag').first(), { ms: 900 });
    },
  },
  {
    id: 'rendement', ms: 7500,
    caption: {
      fr: 'Rendement & LBO : le TRI au prix demandé et le prix maximal pour atteindre votre seuil.',
      en: 'Returns & LBO: the IRR at the asking price and the maximum price to meet your hurdle.',
    },
    async run({ page, click, glide, scroll, pause }) {
      await scroll(0);
      await click(tab(page, 'rendement'));
      await onUrl(page, /\/rendement$/);
      await pause(1000);
      const metrics = page.locator('.g4').first().locator('> *');
      await glide(metrics.nth(0), { ms: 800 });
      await pause(600);
      await glide(metrics.nth(2), { ms: 900 });
      await pause(800);
      await scroll(380);
    },
  },
  {
    id: 'demandes', ms: 9000,
    caption: {
      fr: 'Demandes d’infos : destinataire, dates d’envoi et retards. Les boutons de phase font avancer le dossier.',
      en: 'Info requests: recipient, sent dates and delays. Phase buttons move the deal forward.',
    },
    async run({ page, click, glide, scroll, pause }) {
      await scroll(0);
      await click(tab(page, 'demandes'));
      await onUrl(page, /\/demandes$/);
      await pause(700);
      await glide(page.locator('.steps button.step').nth(2), { ms: 800 });
      await glide(page.locator('.steps .step.on'), { ms: 600 });
      const late = page.locator('[id="f-questions.0.sentAt"]');
      await scroll(late, 'center');
      await glide(late, { dx: 150, ms: 800 });
      await pause(500);
      const who = page.locator('[id="f-questions.2.awaitedFrom"]');
      await glide(who, { ms: 700 });
      await who.selectOption('director');
      const sent = page.locator('[id="f-questions.2.sentAt"]');
      await glide(sent, { ms: 600 });
      await sent.fill(new Date().toISOString().slice(0, 10));
      await sent.blur();
      await pause(600);
    },
  },
  {
    id: 'dossiers', ms: 8500,
    caption: {
      fr: 'Mes dossiers : filtrez par statut, phase ou responsable ; importez un IM ou vos anciens dossiers (JSON).',
      en: 'My deals: filter by status, phase or owner; import an IM or your previous deals (JSON).',
    },
    async run({ page, tr, click, glide, scroll, pause }) {
      await scroll(0);
      await click(page.locator('nav.nav a[href="/dossiers"]'));
      await onUrl(page, /\/dossiers$/);
      await pause(900);
      const filters = page.locator('.filters select');
      await glide(filters.nth(0), { ms: 800 });
      await filters.nth(0).selectOption('decided');
      await pause(1000);
      await filters.nth(0).selectOption('current');
      await glide(filters.nth(2), { ms: 700 });
      await pause(500);
      await glide(page.getByRole('button', { name: tr('Importer un IM', 'Import an IM') }), { ms: 900 });
      await pause(500);
      await glide(page.getByRole('button', { name: tr('Importer des dossiers', 'Import deals') }), { ms: 700 });
    },
  },
  {
    id: 'equipe', ms: 7500,
    caption: {
      fr: 'Votre équipe partage les mêmes dossiers, chaque modification est tracée.',
      en: 'Your team shares the same deals, and every change is tracked.',
    },
    async run({ page, click, glide, pause }) {
      await click(page.locator(`[data-deal-row="${DEAL}"] a.pipe-name`));
      await onUrl(page, /\/synthese$/);
      await click(tab(page, 'activite'));
      await onUrl(page, /\/activite$/);
      await pause(1000);
      const rows = page.locator('.log .logrow');
      await glide(rows.nth(0), { dx: -200, ms: 900 });
      await pause(800);
      await glide(rows.nth(3), { dx: -200, ms: 900 });
    },
  },
];

/* ───────────── Données de démonstration (fictives) ───────────── */

export type SeedOp = { as?: string; op: 'import' | 'patchDeal' | 'setOwner' | 'setContributors' | 'setCommitteeDate'; key?: string; ref?: string; args: unknown[] };

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

type Q = Deal['questions'][number];
const q = (text: string, cat: string, priority: string, extra: Partial<Q> = {}): Q => ({
  id: `q-${text.slice(0, 24)}`, q: text, cat, priority, status: extra.sentAt ? 'Envoyée' : 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null, ...extra,
});

function deal(id: string, over: Partial<Deal>): Deal {
  return { ...demoDeal(), id, example: true, team: '', ...over };
}

const meta = (phase: string, enteredDaysAgo: number, decision: string | null = null) => {
  const t = new Date().toISOString();
  return {
    ownerId: '', contributorIds: [], phase, phaseEnteredAt: daysAgo(enteredDaysAgo), decision, decidedAt: decision ? daysAgo(2) : null,
    committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: t, updatedBy: '',
  };
};

/** Opérations rejouées dans le navigateur (window.__bosRepo) pour un tableau de bord vivant. */
export function seedOps(locale: TourLocale): SeedOp[] {
  const L = (fr: string, en: string) => (locale === 'en' ? en : fr);
  const ops: SeedOp[] = [];
  const patch = (ref: string, path: (string | number)[], v: unknown, as?: string) =>
    ops.push({ as, op: 'patchDeal', ref, args: [path.map(String), v] });

  // Projet Hélios (exemple fourni) : une demande hors délai au dirigeant, une autre au banquier.
  ops.push({ op: 'setOwner', ref: DEAL, args: ['u-analyst'] });
  ops.push({ op: 'setContributors', ref: DEAL, args: [['u-admin', 'u-associate']] });
  if (locale === 'en') {
    patch(DEAL, ['name'], 'Project Helios', 'u-analyst');
    patch(DEAL, ['sector'], 'Vertical B2B software (SaaS)', 'u-analyst');
    patch(DEAL, ['description'], 'French publisher of management software for accounting firms, sold by subscription. 1,450 customers, 92 employees.', 'u-analyst');
    patch(DEAL, ['thesis'], 'Recurring revenue (78%) in a closed niche, low churn and growth above the market. A platform for add-on acquisitions in Southern Europe.', 'u-analyst');
    patch(DEAL, ['risks'], 'Customer concentration not documented. Reliance on the founder. Cloud migration still in progress (22% of customers).', 'u-analyst');
    ['Founder pay brought to market level', 'One-off sale advisory fees', 'Capitalised R&D expensed back'].forEach((l, i) => patch(DEAL, ['adjustments', i, 'label'], l, 'u-analyst'));
    ['What share of revenue do the top ten customers represent?', 'Churn by cohort and customer size (2022–2025)', 'Support for the founder’s normalised pay', 'Key contracts: change-of-control clauses']
      .forEach((l, i) => patch(DEAL, ['questions', i, 'q'], l, 'u-analyst'));
  }
  patch(DEAL, ['questions', 0, 'awaitedFrom'], 'director', 'u-analyst');
  patch(DEAL, ['questions', 0, 'sentAt'], daysAgo(16), 'u-analyst');
  patch(DEAL, ['questions', 1, 'awaitedFrom'], 'seller', 'u-analyst');
  patch(DEAL, ['questions', 1, 'sentAt'], daysAgo(4), 'u-analyst');
  patch(DEAL, ['questions', 1, 'status'], 'Envoyée', 'u-analyst');

  // Projet Orion : BOTe en revue associate, comité dans 8 jours.
  ops.push({
    op: 'import', key: 'orion', args: [deal('demo-orion', {
      name: L('Projet Orion', 'Project Orion'),
      sector: L('Logiciel de gestion pour cliniques vétérinaires (SaaS)', 'Practice management software for vet clinics (SaaS)'),
      country: L('Belgique', 'Belgium'),
      description: L('Éditeur belge de logiciels pour cliniques vétérinaires. 620 clients, 48 salariés.', 'Belgian publisher of software for veterinary clinics. 620 customers, 48 employees.'),
      hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [4.1, 5.0, 5.9, 6.8, 7.9], ebitda: [0.6, 0.8, 1.1, 1.4, 1.8], capex: [0.2, 0.2, 0.3, 0.3, 0.4] },
      kpi: { arr: 6.6, recurring: 84, churn: 3.1, nrr: 108, top10: 14, customers: 620, employees: 48 },
      bs: { netDebt: 0.6, debtLike: 0.1 },
      askPrice: 24,
      questions: [
        q(L('Évolution du nombre de cliniques clientes par pays', 'Number of client clinics by country over time'), 'Commercial', 'Importante',
          { status: 'Répondue', awaitedFrom: 'seller', sentAt: daysAgo(12), answeredAt: daysAgo(5) }),
      ],
    }), meta('associate_review', 3)],
  });
  ops.push({ op: 'setContributors', ref: 'orion', args: [['u-analyst']] });
  ops.push({ op: 'setCommitteeDate', ref: 'orion', args: [inDays(8)] });

  // Projet Vega : analyse en cours, une demande en retard au banquier.
  ops.push({
    op: 'import', key: 'vega', args: [deal('demo-vega', {
      name: L('Projet Vega', 'Project Vega'),
      sector: L('Paie et RH pour PME (SaaS)', 'Payroll and HR for SMEs (SaaS)'),
      country: L('Espagne', 'Spain'),
      description: L('Plateforme espagnole de paie pour PME. 2 100 clients.', 'Spanish payroll platform for SMEs. 2,100 customers.'),
      hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [null, null, 9.2, 10.1, 11.0], ebitda: [null, null, 1.2, 1.5, 1.9], capex: [null, null, 0.5, 0.5, 0.6] },
      kpi: { arr: null, recurring: 65, churn: null, nrr: null, top10: null, customers: 2100, employees: 110 },
      bs: { netDebt: 2.4, debtLike: null },
      askPrice: 21,
      adjustments: [],
      questions: [
        q(L('Taux d’attrition annuel et revenu récurrent (ARR)', 'Annual churn rate and recurring revenue (ARR)'), 'Commercial', 'Décisive', { awaitedFrom: 'seller', sentAt: daysAgo(9) }),
        q(L('Plan de migration de la plateforme vers le cloud', 'Plan for migrating the platform to the cloud'), 'IT', 'Normale'),
      ],
    }), meta('analysis', 6)],
  });
  ops.push({ op: 'setOwner', ref: 'vega', args: ['u-associate'] });

  // Projet Atlas : décidé (Go DD), visible seulement dans Mes dossiers.
  ops.push({
    op: 'import', key: 'atlas', args: [deal('demo-atlas', {
      name: L('Projet Atlas', 'Project Atlas'),
      sector: L('Logiciel pour officines', 'Pharmacy software'), country: L('Allemagne', 'Germany'),
      askPrice: 31, questions: [],
    }), meta('decided', 20, 'go_dd')],
  });
  return ops;
}
