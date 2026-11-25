/* ===== Données d'exemple et gabarits — port de legacy/data.js ===== */
import type { Deal, Mandate } from './types';

export const DEFAULT_MANDATE: Mandate = {
  name: 'Consolidateur logiciel vertical · détention longue',
  sectors: 'logiciel, saas, software, edition',
  geos: 'france, belgique, pays-bas, allemagne, espagne, italie, europe',
  minRev: 2, maxRev: 60, minRecurring: 50, minMargin: 10, hurdle: 15,
};

export function blankDeal(name?: string): Deal {
  const y = new Date().getFullYear() - 1;
  return {
    id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name || 'Nouveau dossier', sector: '', country: '', stage: 'Présélection', team: '',
    description: '', source: '', example: false, updatedAt: Date.now(),
    hist: {
      years: [y - 4, y - 3, y - 2, y - 1, y],
      rev: [null, null, null, null, null], ebitda: [null, null, null, null, null], capex: [null, null, null, null, null],
    },
    kpi: { arr: null, recurring: null, churn: null, nrr: null, top10: null, customers: null, employees: null },
    bs: { netDebt: null, debtLike: null },
    askPrice: null, adjustments: [], comps: [], refs: {},
    plan: { growth: [8, 8, 7, 6, 5], targetMargin: null, capexPct: 4, daPct: 3.5, nwcPct: -5, taxRate: 25, longGrowth: 3 },
    dcf: { wacc: 11, g: 2.5 },
    synergies: { cost: 0, revenue: 0, rampYears: 3, integrationCost: 0, note: '' },
    financing: { entryEv: null, feesPct: 3, leverage: 0, rate: 6.5, amortYears: 6, sweep: false, hold: 7, exitMultiple: null },
    questions: [], thesis: '', risks: '',
  };
}

export function demoDeal(): Deal {
  const d = blankDeal('Projet Hélios');
  let n = 0;
  const q = (text: string, cat: string, priority: string, status: string): Deal['questions'][number] => ({
    id: `helios-q${++n}`, q: text, cat, priority, status, answer: '', awaitedFrom: null, sentAt: null, answeredAt: null,
  });
  Object.assign(d, {
    id: 'demo-helios', example: true, sector: 'Logiciel vertical B2B (SaaS)', country: 'France', stage: 'Offre indicative',
    team: 'C. Martin · A. Morel', source: 'Hélios_IM_2025.pdf (exemple fictif)',
    description: 'Éditeur français de logiciels de gestion pour cabinets d’expertise comptable, vendus par abonnement. 1 450 clients, 92 salariés.',
    hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [6.3, 8.1, 8.8, 10.5, 12.4], ebitda: [1.0, 1.5, 1.7, 2.4, 3.1], capex: [0.3, 0.4, 0.4, 0.5, 0.6] },
    kpi: { arr: 9.8, recurring: 78, churn: 4.2, nrr: 104, top10: null, customers: 1450, employees: 92 },
    bs: { netDebt: 1.8, debtLike: 0.4 },
    askPrice: 42,
    refs: { rev: 'IM p. 2', ebitda: 'IM p. 2', arr: 'IM p. 3', recurring: 'IM p. 3', churn: 'IM p. 3', netDebt: 'IM p. 14', askPrice: 'Lettre de process' },
    adjustments: [
      { id: 'helios-adj1', label: 'Rémunération du dirigeant ramenée au marché', amount: 0.15, included: true, status: 'À confirmer' },
      { id: 'helios-adj2', label: 'Honoraires de cession non récurrents', amount: 0.2, included: false, status: 'Accepté' },
      { id: 'helios-adj3', label: 'R&D capitalisée réintégrée en charges', amount: -0.25, included: false, status: 'Accepté' },
    ],
    comps: [
      { id: 'helios-comp-a', target: 'Cible A (illustratif)', buyer: 'Consolidateur VMS', year: 2025, geo: 'France', niche: 'Logiciel cabinets comptables', rev: 9, ebitda: 2.3, ev: 27, include: true },
      { id: 'helios-comp-b', target: 'Cible B (illustratif)', buyer: 'Industriel coté', year: 2024, geo: 'Benelux', niche: 'ERP PME', rev: 22, ebitda: 5.1, ev: 84, include: true },
      { id: 'helios-comp-c', target: 'Cible C (illustratif)', buyer: 'Fonds LBO', year: 2024, geo: 'France', niche: 'Paie et RH', rev: 15, ebitda: 3.9, ev: 62, include: true },
      { id: 'helios-comp-d', target: 'Cible D (illustratif)', buyer: 'Consolidateur VMS', year: 2023, geo: 'Allemagne', niche: 'Gestion d’officines', rev: 6, ebitda: 1.4, ev: 15, include: true },
      { id: 'helios-comp-e', target: 'Cible E (illustratif)', buyer: 'Industriel', year: 2025, geo: 'Espagne', niche: 'Logiciel juridique', rev: 11, ebitda: 2.6, ev: 35, include: true },
      { id: 'helios-comp-f', target: 'Cible F (illustratif)', buyer: 'Fonds LBO', year: 2022, geo: 'Royaume-Uni', niche: 'Fiscalité', rev: 40, ebitda: 11, ev: 210, include: false },
    ],
    plan: { growth: [14, 12, 10, 9, 8], targetMargin: 28, capexPct: 4.5, daPct: 4, nwcPct: -8, taxRate: 25, longGrowth: 4 },
    dcf: { wacc: 11, g: 2.5 },
    synergies: { cost: 0.4, revenue: 0.2, rampYears: 3, integrationCost: 0.5, note: 'Mutualisation hébergement et back-office ; vente croisée vers la base clients du groupe.' },
    financing: { entryEv: null, feesPct: 3, leverage: 1.5, rate: 6.5, amortYears: 6, sweep: false, hold: 7, exitMultiple: 12 },
    questions: [
      q('Quelle part du CA représentent les dix premiers clients ?', 'Commercial', 'Décisive', 'Envoyée'),
      q('Détail du churn par cohorte et par taille de client (2022–2025)', 'Commercial', 'Importante', 'Ouverte'),
      q('Justificatif de la rémunération normalisée du dirigeant', 'Financier', 'Importante', 'Ouverte'),
      q('Contrats clés : clauses de changement de contrôle', 'Juridique', 'Décisive', 'Ouverte'),
    ],
    thesis: 'Actif récurrent (78 %) sur une niche fermée, churn faible et croissance supérieure au marché. Plateforme d’accueil pour des acquisitions complémentaires en Europe du Sud.',
    risks: 'Concentration clients non documentée. Dépendance au dirigeant fondateur. Migration cloud encore en cours (22 % des clients).',
  } satisfies Partial<Deal>);
  return d;
}
