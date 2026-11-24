import type { DealMeta } from './phases';

export const NOW = new Date('2026-11-24T10:00:00+01:00');
export const ago = (n: number, now: Date = NOW) => new Date(now.getTime() - n * 86400000).toISOString();

export const mkMeta = (o: Partial<DealMeta> = {}): DealMeta => ({
  id: 'd1', ownerId: 'u1', contributorIds: [], phase: 'analysis', phaseEnteredAt: ago(1), decision: null, decidedAt: null,
  committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: ago(1), updatedBy: 'u1', ...o,
});
