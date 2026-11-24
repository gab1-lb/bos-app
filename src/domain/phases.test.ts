import { describe, it, expect } from 'vitest';
import { PHASES, phaseLabel, decisionLabel, suggestNextPhase, type DealMeta } from './phases';
import type { Screen } from '../engine/types';

const meta = (phase: DealMeta['phase']): DealMeta => ({
  id: 'd', ownerId: 'u', contributorIds: [], phase, phaseEnteredAt: '2026-01-01', decision: null,
  decidedAt: null, committeeDate: null, validatedBy: null, validatedAt: null, archived: false,
  updatedAt: '2026-01-01', updatedBy: 'u',
});
const scr = (coverage: number, sub: string) => ({ coverage, sub }) as unknown as Screen;

describe('phases', () => {
  it('order and labels', () => {
    expect(PHASES).toEqual(['im_received', 'analysis', 'bote_written', 'associate_review', 'committee', 'decided']);
    expect(phaseLabel('fr', 'committee')).toBe('Présentation comité');
    expect(phaseLabel('en', 'im_received')).toBe('IM received');
    expect(decisionLabel('fr', 'go_dd')).toBe('Go DD');
    expect(decisionLabel('en', 'no_go')).toBe('No-go');
  });
  it('suggestNextPhase', () => {
    expect(suggestNextPhase(meta('analysis'), scr(0.7, 'go'))).toBe('bote_written');
    expect(suggestNextPhase(meta('analysis'), scr(0.69, 'coverage'))).toBeNull();
    expect(suggestNextPhase(meta('analysis'), scr(0.9, 'price'))).toBeNull();
    expect(suggestNextPhase(meta('im_received'), scr(0.9, 'go'))).toBeNull();
    expect(suggestNextPhase(meta('bote_written'), scr(0.9, 'go'))).toBeNull();
  });
});
