/* Activité : texte lisible d'une ligne du journal (libellé du champ, valeurs traduites et compactes), FR / EN. */
import type { ActivityEntry } from '../data/repo';
import type { Deal, Recipient } from '../engine/types';
import { fmt, t, type Locale } from '../i18n/format';
import { decisionLabel, phaseLabel, type Decision, type Phase } from './phases';
import { RECIPIENTS, recipientLabel } from './recipients';

const KIND: Record<string, string> = {
  create: 'Création du dossier', import: 'Import du dossier', patch: 'Modification', phase: 'Changement de phase',
  validate: 'Validation du BOTe', decide: 'Décision', archive: 'Archivage', delete: 'Suppression',
  committee: 'Date de comité', contributors: 'Contributeurs', owner: 'Responsable',
  list_add: 'Ajout d’une ligne', list_remove: 'Retrait d’une ligne',
};

/** Libellés des champs (clés FR du dictionnaire), par chemin sans les positions. */
const FIELD: Record<string, string> = {
  name: 'Nom de code', sector: 'Secteur', country: 'Pays', team: 'Équipe', source: 'Document source', stage: 'Étape',
  description: 'Activité', thesis: 'Pourquoi acheter', risks: 'Ce qui invaliderait la thèse', askPrice: 'VE demandée (100 %)',
  'kpi.arr': 'ARR', 'kpi.recurring': 'Revenus récurrents', 'kpi.churn': 'Churn clients', 'kpi.nrr': 'Rétention nette (NRR)',
  'kpi.top10': 'Top 10 clients', 'kpi.customers': 'Nombre de clients', 'kpi.employees': 'Effectif',
  'bs.netDebt': 'Dette nette', 'bs.debtLike': 'Éléments assimilés à la dette',
  'hist.years': 'Années', 'hist.rev': 'Chiffre d’affaires', 'hist.ebitda': 'EBITDA publié', 'hist.capex': 'Capex',
  'plan.growth': 'Croissance', 'plan.targetMargin': 'Marge d’EBITDA cible', 'plan.longGrowth': 'Croissance au-delà',
  'plan.capexPct': 'Capex', 'plan.daPct': 'Amortissements', 'plan.nwcPct': 'BFR', 'plan.taxRate': 'Taux d’IS',
  'dcf.wacc': 'WACC', 'dcf.g': 'Croissance à l’infini',
  'synergies.cost': 'Synergies de coûts', 'synergies.revenue': 'Synergies de revenus (EBITDA)', 'synergies.rampYears': 'Montée en charge',
  'synergies.integrationCost': 'Coûts d’intégration (an 1)', 'synergies.note': 'Origine des synergies',
  'financing.entryEv': 'VE d’entrée', 'financing.feesPct': 'Frais d’acquisition', 'financing.leverage': 'Dette d’acquisition',
  'financing.rate': 'Taux d’intérêt', 'financing.amortYears': 'Amortissement de la dette', 'financing.sweep': 'Affecter la trésorerie à la dette',
  'financing.hold': 'Horizon d’analyse', 'financing.exitMultiple': 'Multiple de sortie',
  'questions.q': 'Question', 'questions.answer': 'Réponse', 'questions.cat': 'Thème', 'questions.priority': 'Priorité',
  'questions.status': 'Statut', 'questions.awaitedFrom': 'Destinataire', 'questions.sentAt': 'Envoyée le', 'questions.answeredAt': 'Répondue le',
  'adjustments.label': 'Libellé', 'adjustments.amount': 'Montant', 'adjustments.included': 'Inclus vendeur', 'adjustments.status': 'Statut',
  'comps.include': 'Retenir', 'comps.target': 'Cible', 'comps.buyer': 'Acquéreur', 'comps.year': 'Année', 'comps.geo': 'Zone',
  'comps.niche': 'Niche', 'comps.rev': 'CA', 'comps.ebitda': 'EBITDA', 'comps.ev': 'VE',
};
const ROW: Record<string, string> = { questions: 'Question {0}', adjustments: 'Retraitement {0}', comps: 'Comparable {0}' };
const ROW_ONE: Record<string, string> = { questions: 'Question', adjustments: 'Retraitement', comps: 'Comparable' };

/** Valeurs enregistrées en français dans les données (thèmes, priorités, statuts) : traduites à l'affichage. */
const FR_VALUES = new Set([
  'Financier', 'Commercial', 'Produit', 'Juridique', 'RH', 'Fiscal', 'IT',
  'Décisive', 'Importante', 'Normale', 'Ouverte', 'Envoyée', 'Répondue', 'Accepté', 'À confirmer', 'Rejeté',
]);

const MAX = 60;
const cut = (s: string) => (s.length > MAX ? s.slice(0, MAX - 1) + '…' : s);
const DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** « Question 3 · Réponse », « Chiffre d’affaires 2025 », « Croissance an 2 »… ; chemin brut si inconnu. */
export function fieldLabel(locale: Locale, path: string, deal?: Deal): string {
  const parts = path.split('.');
  const [head] = parts;
  if (ROW[head]) {
    if (parts.length === 1) return t(locale, ROW_ONE[head]);
    const idx = /^\d+$/.test(parts[1]) ? Number(parts[1]) : null;
    const row = idx == null ? t(locale, ROW_ONE[head]) : t(locale, ROW[head], idx + 1);
    const key = `${head}.${parts.slice(2).join('.')}`;
    return parts.length > 2 ? `${row} · ${FIELD[key] ? t(locale, FIELD[key]) : parts.slice(2).join('.')}` : row;
  }
  if (head === 'hist' && parts.length === 3 && /^\d+$/.test(parts[2])) {
    const year = deal?.hist?.years?.[Number(parts[2])];
    const label = FIELD[`hist.${parts[1]}`];
    if (label) return `${t(locale, label)} ${year ?? `#${Number(parts[2]) + 1}`}`;
  }
  if (head === 'plan' && parts[1] === 'growth' && parts.length === 3 && /^\d+$/.test(parts[2])) {
    return t(locale, 'Croissance an {0}', Number(parts[2]) + 1);
  }
  if (head === 'refs' && parts.length === 2) return `${t(locale, 'Source')} · ${parts[1]}`;
  const label = FIELD[path];
  return label ? t(locale, label) : path;
}

type Ctx = { locale: Locale; who(id: string): string; deal?: Deal };

/** Valeur courte et lisible : traduite, date au format local, nombre formaté, résumé d'une ligne. */
export function valueText(v: unknown, ctx: Ctx, path: string | null = null): string {
  const { locale } = ctx;
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? t(locale, 'Oui') : t(locale, 'Non');
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '—';
    if (Number.isInteger(v) && /year/i.test(path ?? '')) return String(v);
    return fmt(locale).nf(v, Number.isInteger(v) ? 0 : 2);
  }
  if (typeof v === 'string') {
    if (path?.endsWith('.awaitedFrom') && RECIPIENTS.includes(v as Recipient)) return recipientLabel(locale, v as Recipient);
    if (FR_VALUES.has(v)) return t(locale, v);
    if (DATE.test(v) && !Number.isNaN(Date.parse(v))) {
      return new Date(v.length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeZone: 'Europe/Paris' });
    }
    return cut(v.replace(/\s+/g, ' ').trim());
  }
  if (Array.isArray(v)) {
    if (v.length && v.length <= 8 && v.every((x) => typeof x === 'number' || x == null)) return v.map((x) => valueText(x, ctx, path)).join(' · ');
    return v.length === 1 ? t(locale, '1 élément') : t(locale, '{0} éléments', v.length);
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const s = [o.q, o.label, o.target, o.name].find((x) => typeof x === 'string' && x.trim());
    return s ? `« ${cut(String(s).trim())} »` : '…';
  }
  return cut(String(v));
}

export type ActivityText = { action: string; field: string | null; from: string | null; to: string | null };

/** Ligne du journal : action, champ, ancienne et nouvelle valeur (null = ne pas afficher). */
export function activityText(e: ActivityEntry, ctx: Ctx): ActivityText {
  const { locale, who } = ctx;
  const action = t(locale, KIND[e.kind] ?? e.kind);
  const field = e.path ? fieldLabel(locale, e.path, ctx.deal) : null;
  const val = (v: unknown): string => {
    if (v == null || v === '') return '—';
    switch (e.kind) {
      case 'phase': return phaseLabel(locale, v as Phase);
      case 'decide': return decisionLabel(locale, v as Decision);
      case 'owner': case 'validate': return who(String(v));
      case 'contributors': return Array.isArray(v) && v.length ? v.map((id) => who(String(id))).join(', ') : '—';
      default: return valueText(v, ctx, e.path);
    }
  };
  switch (e.kind) {
    case 'create': case 'import': return { action, field, from: null, to: null };
    case 'list_add': return { action, field, from: null, to: val(e.newValue) };
    case 'list_remove': case 'delete': return { action, field, from: val(e.oldValue), to: null };
    case 'validate': return { action, field, from: null, to: val(e.newValue) };
    default: return { action, field, from: val(e.oldValue), to: val(e.newValue) };
  }
}
