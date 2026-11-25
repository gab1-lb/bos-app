export type Recipient = 'director' | 'seller' | 'associate' | 'committee' | 'internal';

export interface Hist {
  years: number[];
  rev: (number | null)[];
  ebitda: (number | null)[];
  capex: (number | null)[];
}

export interface Kpi {
  arr: number | null;
  recurring: number | null;
  churn: number | null;
  nrr: number | null;
  top10: number | null;
  customers: number | null;
  employees: number | null;
}

export interface Adjustment {
  /** Stable item id (unique within the deal list); rows are written by id, never by position. */
  id: string;
  label: string;
  amount: number | null;
  included: boolean;
  status: string; // 'Accepté' | 'À confirmer' | ...
}

export interface Comp {
  /** Stable item id (unique within the deal list). */
  id: string;
  target: string;
  buyer: string;
  year: number;
  geo: string;
  niche: string;
  rev: number | null;
  ebitda: number | null;
  ev: number | null;
  include: boolean;
}

export interface Question {
  /** Stable item id (unique within the deal list). */
  id: string;
  q: string;
  cat: string;
  priority: string; // 'Décisive' | 'Importante' | ...
  status: string; // 'Ouverte' | 'Envoyée' | 'Répondue'
  answer: string;
  awaitedFrom: Recipient | null;
  sentAt: string | null; // ISO date
  answeredAt: string | null; // ISO date
}

export interface PlanInputs {
  growth: (number | null)[];
  targetMargin: number | null;
  capexPct: number | null;
  daPct: number | null;
  nwcPct: number | null;
  taxRate: number | null;
  longGrowth: number | null;
}

export interface Synergies {
  cost: number | null;
  revenue: number | null;
  rampYears: number | null;
  integrationCost: number | null;
  note: string;
}

export interface Financing {
  entryEv: number | null;
  feesPct: number | null;
  leverage: number | null;
  rate: number | null;
  amortYears: number | null;
  sweep: boolean;
  hold: number | null;
  exitMultiple: number | null;
}

export interface Deal {
  id: string;
  name: string;
  sector: string;
  country: string;
  stage: string;
  team: string;
  description: string;
  source: string;
  example: boolean;
  updatedAt: number;
  hist: Hist;
  kpi: Kpi;
  bs: { netDebt: number | null; debtLike: number | null };
  askPrice: number | null;
  adjustments: Adjustment[];
  comps: Comp[];
  refs: Record<string, string>;
  plan: PlanInputs;
  dcf: { wacc: number | null; g: number | null };
  synergies: Synergies;
  financing: Financing;
  questions: Question[];
  thesis: string;
  risks: string;
}

export interface Mandate {
  name: string;
  sectors: string;
  geos: string;
  minRev: number | null;
  maxRev: number | null;
  minRecurring: number | null;
  minMargin: number | null;
  hurdle: number | null;
}

export interface Base {
  year: number | null;
  rev: number | null;
  revPrev: number | null;
  ebitda: number | null;
  adjNet: number;
  adjEbitda: number | null;
  growth: number | null;
  cagr: number | null;
  margin: number | null;
  marginPrev: number | null;
  arr: number | null;
  recurring: number | null;
  churn: number | null;
  nrr: number | null;
  top10: number | null;
  netDebt: number | null;
  debtLike: number;
  ask: number | null;
  leverage: number | null;
  askEvEbitda: number | null;
  askEvRev: number | null;
  rule40: number | null;
}

export interface PlanRow {
  t: number;
  year: number;
  g: number;
  rev: number;
  ebitda: number;
  margin: number;
  da: number;
  capex: number;
  dNwc: number;
  prevRev: number;
}

export interface DcfRow extends PlanRow {
  ebit: number;
  taxes: number;
  fcf: number;
  df: number;
  pv: number;
}

export interface Dcf {
  rows: DcfRow[];
  pv: number;
  tv: number;
  pvTv: number;
  ev: number;
  tvShare: number;
  impliedExit: number;
}

export interface CompRow extends Comp {
  evRev: number | null;
  evEbitda: number | null;
}

export interface Stats {
  q1: number | null;
  med: number | null;
  q3: number | null;
  n: number;
}

export interface CompsResult {
  rows: CompRow[];
  evRev: Stats;
  evEbitda: Stats;
}

export interface ReturnsOpts {
  hold?: number;
  ev?: number;
  growthShift?: number;
  marginShift?: number;
  leverage?: number;
  synergyMult?: number;
  exitMult?: number;
}

export interface ReturnsRow extends PlanRow {
  syn: number;
  integ: number;
  ebitdaTot: number;
  interest: number;
  taxes: number;
  fcfPre: number;
  amort: number;
  sweep: number;
  fcfe: number;
  debtStart: number;
  debtEnd: number;
  lev: number | null;
  cover: number | null;
  roic: number;
  cashYield: number;
}

export interface Returns {
  H: number;
  ev: number;
  fees: number;
  debt0: number;
  debtLike: number;
  uses: number;
  equity: number;
  rows: ReturnsRow[];
  exitMult: number;
  exitEv: number;
  exitEq: number;
  flows: number[];
  irr: number | null;
  mom: number;
  payback: number | null;
  entryMult: number;
  entryMultSyn: number;
  roic5: number;
  cashYield1: number;
  maxLev: number;
  minCover: number;
}

export interface Criterion {
  k: string;
  label: string;
  v: number | null;
  unit: string;
  w: number;
  hint: string;
  pts: number | null;
}

export type MandateState = 'ok' | 'ko' | 'inconnu';

export interface MandateCheck {
  key: string;
  param: number | null;
  actual: string | number | null;
  state: MandateState;
}

export type ScreenCode = 'go' | 'nego' | 'wait' | 'stop';
export type ScreenSub = 'mandate' | 'price' | 'coverage' | 'go' | 'nego' | 'weak';

export type ScreenReason =
  | ['ko', string[]]
  | ['noPrice']
  | ['coverage', number]
  | ['go', number, number]
  | ['nego', number, number]
  | ['weak']
  | ['openQ', number]
  | ['unknown', string[]];

export interface Screen {
  crit: Criterion[];
  score: number | null;
  coverage: number;
  lowS: number;
  highS: number;
  provisional: boolean;
  mandate: MandateCheck[];
  code: ScreenCode;
  sub: ScreenSub;
  reasons: ScreenReason[];
  hurdle: number;
}
