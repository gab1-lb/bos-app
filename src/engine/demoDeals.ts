/* ===== Dossiers fictifs de la démo publique : un par étape du parcours ===== */
import type { Deal } from './types';
import type { DealMeta } from '../domain/phases';
import { analyst, associate } from '../data/personas';
import { blankDeal } from './samples';

import type { SeedDeal } from '../data/memoryRepo';
export type { SeedDeal };

export const DEMO_DEAL_IDS: string[] = ['demo-helios', 'demo-atlas', 'demo-boree', 'demo-ceres', 'demo-dune'];

const DAY = 86400000;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY).toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

type QSpec = [text: string, cat: string, priority: string];
type Common = Partial<Deal> & Pick<Deal, 'id' | 'name' | 'sector' | 'country' | 'description' | 'hist' | 'kpi' | 'bs' | 'askPrice'>;

function build(slug: string, name: string, c: Common, comps: [string, string, number, string, string, number, number, number][], questions: QSpec[], extra: Partial<Deal>): Deal {
  const d = blankDeal(name);
  Object.assign(d, {
    example: true, stage: 'Présélection', source: `${name}_IM (exemple fictif)`, updatedAt: 0, ...c,
    comps: comps.map(([target, buyer, year, geo, niche, rev, ebitda, ev], i) => ({
      id: `${slug}-comp-${String.fromCharCode(97 + i)}`, target, buyer, year, geo, niche, rev, ebitda, ev, include: true,
    })),
    questions: questions.map(([q, cat, priority], i) => ({
      id: `${slug}-q${i + 1}`, q, cat, priority, status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null,
    })),
    ...extra,
  });
  return d;
}

export function demoSeed(now: Date): SeedDeal[] {
  const t = now.toISOString();
  const meta = (id: string, o: Partial<DealMeta>): DealMeta => ({
    id, ownerId: analyst.id, contributorIds: [], phase: 'analysis', phaseEnteredAt: t, decision: null, decidedAt: null,
    committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: t, updatedBy: analyst.id, ...o,
  });

  const atlas = build('atlas', 'Projet Atlas', {
    id: 'demo-atlas', name: 'Projet Atlas', sector: 'Logiciel vertical B2B (SaaS) · transport routier', country: 'France',
    team: 'A. Lambert · C. Martin',
    description: 'Éditeur de logiciels de gestion de flottes et de tournées pour transporteurs routiers, vendus par abonnement. 620 clients, 74 salariés.',
    hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [5.2, 6.4, 7.6, 8.9, 10.2], ebitda: [0.8, 1.2, 1.7, 2.2, 2.7], capex: [0.3, 0.3, 0.4, 0.4, 0.5] },
    kpi: { arr: 8.1, recurring: 80, churn: 5.1, nrr: 106, top10: null, customers: 620, employees: 74 },
    bs: { netDebt: 1.1, debtLike: 0.3 }, askPrice: 31,
    refs: { rev: 'IM p. 4', ebitda: 'IM p. 4', arr: 'IM p. 6', recurring: 'IM p. 6', churn: 'IM p. 7', netDebt: 'IM p. 18', askPrice: 'Lettre de process' },
    adjustments: [
      { id: 'atlas-adj1', label: 'Rémunération du dirigeant ramenée au marché', amount: 0.12, included: true, status: 'À confirmer' },
      { id: 'atlas-adj2', label: 'Coûts de migration non récurrents', amount: 0.18, included: false, status: 'Accepté' },
    ],
    plan: { growth: [13, 11, 10, 8, 7], targetMargin: 29, capexPct: 4.5, daPct: 4, nwcPct: -7, taxRate: 25, longGrowth: 3.5 },
    synergies: { cost: 0.3, revenue: 0.2, rampYears: 3, integrationCost: 0.4, note: 'Mutualisation du support et de l’hébergement ; vente croisée auprès des clients logistique du groupe.' },
    financing: { entryEv: null, feesPct: 3, leverage: 1.5, rate: 6.5, amortYears: 6, sweep: false, hold: 7, exitMultiple: 12 },
    thesis: 'Logiciel métier incontournable pour des transporteurs de taille moyenne, 80 % de revenus récurrents et marge en progression. Plateforme pour consolider la gestion de flottes en France et au Benelux.',
    risks: 'Concentration clients non documentée. Exposition au cycle du transport routier. Dépendance à deux développeurs clés.',
  }, [
    ['Cible A (illustratif)', 'Consolidateur VMS', 2025, 'France', 'Télématique et flottes', 8, 2.1, 26],
    ['Cible B (illustratif)', 'Fonds LBO', 2024, 'Benelux', 'Logiciel de transport', 14, 3.4, 44],
    ['Cible C (illustratif)', 'Industriel coté', 2024, 'Allemagne', 'Gestion de tournées', 19, 4.4, 61],
    ['Cible D (illustratif)', 'Consolidateur VMS', 2023, 'Espagne', 'Logistique PME', 7, 1.6, 19],
  ], [
    ['Quelle part du CA représentent les dix premiers clients ?', 'Commercial', 'Décisive'],
    ['Détail du churn par taille de flotte (2022–2025)', 'Commercial', 'Importante'],
    ['Contrats clés : clauses de changement de contrôle', 'Juridique', 'Décisive'],
  ], {});

  const sentAt = ago(now, 9);
  const boree = build('boree', 'Projet Borée', {
    id: 'demo-boree', name: 'Projet Borée', sector: 'Logiciel vertical B2B (SaaS) · laboratoires', country: 'Belgique',
    team: 'A. Lambert',
    description: 'Éditeur belge de logiciels de gestion pour laboratoires d’analyses médicales et environnementales. 340 laboratoires clients, 48 salariés.',
    hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [3.4, 4.0, 4.7, 5.5, 6.3], ebitda: [0.6, 0.8, 1.0, 1.3, 1.6], capex: [0.2, 0.2, 0.3, 0.3, 0.3] },
    kpi: { arr: 5.0, recurring: 82, churn: 3.6, nrr: 108, top10: 31, customers: 340, employees: 48 },
    bs: { netDebt: 0.6, debtLike: null }, askPrice: 17.5,
    refs: { rev: 'IM p. 3', ebitda: 'IM p. 3', arr: 'IM p. 5', recurring: 'IM p. 5', churn: 'IM p. 5', top10: 'IM p. 6', askPrice: 'Teaser' },
    adjustments: [{ id: 'boree-adj1', label: 'Honoraires de cession non récurrents', amount: 0.1, included: false, status: 'Accepté' }],
    plan: { growth: [12, 11, 9, 8, 6], targetMargin: 30, capexPct: 4.5, daPct: 4, nwcPct: -6, taxRate: 25, longGrowth: 3 },
    synergies: { cost: 0.15, revenue: 0.1, rampYears: 3, integrationCost: 0.2, note: 'Mutualisation de l’hébergement ; ouverture du marché français.' },
    financing: { entryEv: null, feesPct: 3, leverage: 1.5, rate: 6.5, amortYears: 6, sweep: false, hold: 7, exitMultiple: 11 },
    thesis: 'Niche réglementée à forte rétention (churn 3,6 %), clients captifs et marge d’EBITDA en hausse. Point d’entrée pour la consolidation des logiciels de laboratoire au Benelux.',
    risks: 'Marché étroit. Évolutions réglementaires sur l’accréditation. Équipe produit restreinte.',
  }, [
    ['Cible A (illustratif)', 'Consolidateur VMS', 2025, 'Pays-Bas', 'Logiciel de laboratoire', 5, 1.2, 14],
    ['Cible B (illustratif)', 'Fonds LBO', 2024, 'France', 'Gestion de la qualité', 9, 2.0, 25],
    ['Cible C (illustratif)', 'Industriel', 2024, 'Allemagne', 'Logiciel de santé', 16, 3.5, 47],
    ['Cible D (illustratif)', 'Consolidateur VMS', 2023, 'Belgique', 'Imagerie médicale', 6, 1.3, 16],
  ], [
    ['Répartition du CA entre abonnements, maintenance et services', 'Financier', 'Importante'],
    ['Éléments assimilés à la dette : crédit-bail, earn-out, provisions', 'Financier', 'Décisive'],
    ['Feuille de route produit et niveau d’accréditation des modules', 'Commercial', 'Importante'],
  ], {});
  boree.questions.forEach((q) => Object.assign(q, { status: 'Envoyée', sentAt, awaitedFrom: 'director' }));

  const ceres = build('ceres', 'Projet Cérès', {
    id: 'demo-ceres', name: 'Projet Cérès', sector: 'Logiciel vertical B2B (ERP) · agriculture', country: 'France',
    team: 'C. Martin · A. Morel',
    description: 'Éditeur d’un ERP dédié aux coopératives agricoles (collecte, stockage, négoce, facturation). 210 coopératives clientes, 105 salariés.',
    hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [9.0, 10.4, 11.8, 13.1, 14.6], ebitda: [1.8, 2.3, 2.8, 3.4, 4.1], capex: [0.5, 0.6, 0.6, 0.7, 0.8] },
    kpi: { arr: 11.2, recurring: 77, churn: 3.1, nrr: null, top10: 38, customers: 210, employees: 105 },
    bs: { netDebt: 2.4, debtLike: 0.5 }, askPrice: 52,
    refs: { rev: 'IM p. 3', ebitda: 'IM p. 3', arr: 'IM p. 5', recurring: 'IM p. 5', churn: 'IM p. 6', top10: 'IM p. 7', netDebt: 'IM p. 21', askPrice: 'Lettre de process' },
    adjustments: [
      { id: 'ceres-adj1', label: 'Rémunération du dirigeant ramenée au marché', amount: 0.2, included: true, status: 'Accepté' },
      { id: 'ceres-adj2', label: 'R&D capitalisée réintégrée en charges', amount: -0.3, included: true, status: 'Accepté' },
    ],
    plan: { growth: [11, 10, 9, 8, 6], targetMargin: 30, capexPct: 5, daPct: 4, nwcPct: -6, taxRate: 25, longGrowth: 3 },
    synergies: { cost: 0.5, revenue: 0.3, rampYears: 3, integrationCost: 0.6, note: 'Fusion des équipes support ; extension vers les négoces agricoles du Benelux.' },
    financing: { entryEv: null, feesPct: 3, leverage: 2, rate: 6.5, amortYears: 6, sweep: true, hold: 7, exitMultiple: 12 },
    thesis: 'ERP métier ancré dans les coopératives, forte rétention (churn 3,1 %) et marge d’EBITDA de 28 %. Base solide pour une plateforme agri-tech en Europe.',
    risks: 'Cycle des récoltes et pression sur les coopératives. Migration cloud à finir pour 30 % des clients. Dépendance au directeur technique.',
  }, [
    ['Cible A (illustratif)', 'Consolidateur VMS', 2025, 'France', 'Logiciel agricole', 12, 3.0, 38],
    ['Cible B (illustratif)', 'Industriel coté', 2024, 'Pays-Bas', 'ERP agroalimentaire', 24, 5.6, 71],
    ['Cible C (illustratif)', 'Fonds LBO', 2024, 'Espagne', 'Gestion de coopératives', 10, 2.5, 30],
    ['Cible D (illustratif)', 'Consolidateur VMS', 2023, 'Allemagne', 'Négoce de céréales', 17, 3.8, 49],
  ], [
    ['Détail du churn par type de coopérative (2022–2025)', 'Commercial', 'Importante'],
    ['Avancement de la migration cloud par client', 'Technique', 'Décisive'],
  ], {});
  ceres.questions.forEach((q) => Object.assign(q, { status: 'Répondue', answer: 'Réponse reçue dans la data room.', sentAt: ago(now, 20), answeredAt: ago(now, 12), awaitedFrom: 'director' }));

  const dune = build('dune', 'Projet Dune', {
    id: 'demo-dune', name: 'Projet Dune', sector: 'Logiciel vertical B2B · billetterie', country: 'Espagne',
    team: 'A. Morel',
    description: 'Éditeur espagnol de logiciels de billetterie pour musées, théâtres et collectivités. 150 salles clientes, 38 salariés.',
    hist: { years: [2021, 2022, 2023, 2024, 2025], rev: [4.8, 5.6, 6.1, 6.4, 6.6], ebitda: [1.0, 1.1, 1.0, 0.9, 0.7], capex: [0.2, 0.3, 0.3, 0.3, 0.3] },
    kpi: { arr: 3.8, recurring: 58, churn: 8.4, nrr: 97, top10: 52, customers: 150, employees: 38 },
    bs: { netDebt: 1.9, debtLike: null }, askPrice: 7.5,
    refs: { rev: 'IM p. 2', ebitda: 'IM p. 2', arr: 'IM p. 4', top10: 'IM p. 5', netDebt: 'IM p. 12', askPrice: 'Teaser' },
    adjustments: [],
    plan: { growth: [5, 5, 4, 4, 3], targetMargin: 12, capexPct: 4, daPct: 3.5, nwcPct: -3, taxRate: 25, longGrowth: 2 },
    synergies: { cost: 0.1, revenue: 0, rampYears: 3, integrationCost: 0.2, note: 'Peu de synergies identifiées hors hébergement.' },
    financing: { entryEv: null, feesPct: 3, leverage: 1, rate: 7, amortYears: 6, sweep: false, hold: 7, exitMultiple: 9 },
    thesis: 'Niche de la billetterie culturelle avec une base installée stable, mais croissance faible et marge en repli : thèse non confirmée après analyse.',
    risks: 'No-go : 45 % du CA sur un seul client public, marge en baisse 3 années de suite. Renouvellement du contrat principal incertain. Churn élevé sur les petites salles.',
  }, [
    ['Cible A (illustratif)', 'Fonds LBO', 2024, 'Espagne', 'Billetterie culturelle', 7, 1.6, 15],
    ['Cible B (illustratif)', 'Consolidateur VMS', 2023, 'France', 'Billetterie et loisirs', 12, 2.4, 27],
    ['Cible C (illustratif)', 'Industriel', 2022, 'Italie', 'Logiciel de réservation', 9, 1.8, 18],
  ], [
    ['Calendrier de renouvellement du contrat du principal client public', 'Commercial', 'Décisive'],
  ], {});

  return [
    { deal: atlas, meta: meta('demo-atlas', { phase: 'associate_review', phaseEnteredAt: ago(now, 2), updatedAt: ago(now, 2) }) },
    { deal: boree, meta: meta('demo-boree', { phase: 'analysis', phaseEnteredAt: ago(now, 9), updatedAt: sentAt }) },
    {
      deal: ceres,
      meta: meta('demo-ceres', {
        ownerId: associate.id, updatedBy: associate.id, phase: 'associate_review', phaseEnteredAt: ago(now, 3), updatedAt: ago(now, 3),
        committeeDate: isoDate(new Date(now.getTime() + 5 * DAY)), validatedBy: associate.id, validatedAt: ago(now, 3),
      }),
    },
    {
      deal: dune,
      meta: meta('demo-dune', {
        phase: 'decided', phaseEnteredAt: ago(now, 6), decision: 'no_go', decidedAt: ago(now, 6), updatedAt: ago(now, 6),
      }),
    },
  ];
}
