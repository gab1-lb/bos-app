import type { Deal } from '../engine/types';
import { blankDeal } from '../engine/samples';
import type { Member } from './permissions';
import type { Decision, DealMeta, Phase } from './phases';

export type ImportItem = { deal: Deal; meta: Omit<DealMeta, 'id'> };

const STAGES: Record<string, { phase: Phase; decision: Decision | null }> = {
  'Présélection': { phase: 'im_received', decision: null },
  'IM reçu': { phase: 'im_received', decision: null },
  'Offre indicative': { phase: 'decided', decision: 'indicative_offer' },
  'Due diligence': { phase: 'decided', decision: 'go_dd' },
  'Offre ferme': { phase: 'decided', decision: 'go_dd' },
  'Signé': { phase: 'decided', decision: 'go_dd' },
  'Abandonné': { phase: 'decided', decision: 'no_go' },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function migrate(d: Record<string, unknown>): Deal {
  const b = blankDeal();
  const o = (k: keyof Deal) => (isObj(d[k]) ? (d[k] as object) : {});
  const deal = {
    ...b, ...d,
    hist: { ...b.hist, ...o('hist') }, kpi: { ...b.kpi, ...o('kpi') }, bs: { ...b.bs, ...o('bs') },
    plan: { ...b.plan, ...o('plan') }, dcf: { ...b.dcf, ...o('dcf') },
    synergies: { ...b.synergies, ...o('synergies') }, financing: { ...b.financing, ...o('financing') },
  } as Deal;
  deal.questions = (Array.isArray(deal.questions) ? deal.questions : []).map((q) => ({
    ...q, awaitedFrom: q.awaitedFrom ?? null, sentAt: q.sentAt ?? null, answeredAt: q.answeredAt ?? null,
  }));
  return deal;
}

export function importLegacy(json: unknown, importer: Member, now: Date): { items: ImportItem[]; errors: string[] } {
  let data = json;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { items: [], errors: ['JSON invalide'] }; }
  }
  if (!isObj(data) || data.format !== 'bos-legacy-v1' || !Array.isArray(data.deals)) {
    return { items: [], errors: ['Format non reconnu (attendu : bos-legacy-v1)'] };
  }
  const iso = now.toISOString();
  const items: ImportItem[] = [];
  const errors: string[] = [];
  data.deals.forEach((raw, i) => {
    if (!isObj(raw)) { errors.push(`Dossier ${i + 1} : invalide`); return; }
    const deal = migrate(raw);
    const st = STAGES[deal.stage] ?? { phase: 'im_received' as Phase, decision: null };
    items.push({
      deal,
      meta: {
        ownerId: importer.id, contributorIds: [], phase: st.phase, phaseEnteredAt: iso, decision: st.decision,
        decidedAt: st.decision ? iso : null, committeeDate: null, validatedBy: null, validatedAt: null,
        archived: false, updatedAt: iso, updatedBy: importer.id,
      },
    });
  });
  return { items, errors };
}
