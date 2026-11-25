import { describe, it, expect } from 'vitest';
import { can, type Member, type Role, type Action } from './permissions';
import type { DealMeta } from './phases';

const m = (role: Role | null, status: Member['status'] = 'active', id = 'me'): Member =>
  ({ id, email: 'a@b.c', name: 'A', avatarUrl: null, role, status, locale: 'fr' });
const deal = (ownerId: string): DealMeta => ({
  id: 'd', ownerId, contributorIds: [], phase: 'analysis', phaseEnteredAt: '', decision: null, decidedAt: null,
  committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: '', updatedBy: '',
});
const ALL: Action[] = ['read', 'edit', 'create', 'setPhase:im_received', 'setPhase:analysis', 'setPhase:bote_written',
  'setPhase:associate_review', 'setPhase:committee', 'setPhase:decided', 'validateBote', 'decide', 'delete', 'archive',
  'manageMembers', 'manageMandate', 'manageTemplates', 'import', 'setOwner'];
const allowed = (mem: Member, d?: DealMeta) => ALL.filter((a) => can(mem, a, d));

describe('can', () => {
  it('pending/denied/null role: nothing', () => {
    expect(allowed(m('admin', 'pending'), deal('x'))).toEqual([]);
    expect(allowed(m('associate', 'denied'), deal('x'))).toEqual([]);
    expect(allowed(m(null), deal('x'))).toEqual([]);
  });
  it('reader reads only', () => expect(allowed(m('reader'), deal('x'))).toEqual(['read']));
  it('analyst', () => {
    const a = m('analyst');
    expect(can(a, 'edit', deal('other'))).toBe(true);
    expect(can(a, 'setPhase:bote_written', deal('other'))).toBe(true);
    expect(can(a, 'setPhase:im_received', deal('other'))).toBe(true);
    expect(can(a, 'setPhase:associate_review', deal('other'))).toBe(false);
    // starting phase must also be an analyst phase
    for (const phase of ['associate_review', 'committee', 'decided'] as const) {
      const d = { ...deal('other'), phase };
      expect(can(a, 'setPhase:analysis', d)).toBe(false);
      expect(can(a, 'setPhase:im_received', d)).toBe(false);
    }
    expect(can(m('associate'), 'setPhase:analysis', { ...deal('other'), phase: 'decided' })).toBe(true);
    // fail-closed without a deal: the starting phase is unknown
    expect(can(a, 'setPhase:analysis')).toBe(false);
    expect(can(m('associate'), 'setPhase:analysis')).toBe(true);
    expect(can(a, 'validateBote', deal('other'))).toBe(false);
    expect(can(a, 'decide', deal('other'))).toBe(false);
    expect(can(a, 'delete', deal('other'))).toBe(false);
    expect(can(a, 'archive', deal('other'))).toBe(false);
    expect(can(a, 'archive', deal('me'))).toBe(true);
    expect(can(a, 'manageMembers')).toBe(false);
    expect(can(a, 'import')).toBe(false);
  });
  it('associate', () => {
    const a = m('associate');
    expect(can(a, 'validateBote', deal('other'))).toBe(true);
    expect(can(a, 'validateBote', deal('me'))).toBe(false);
    expect(can(a, 'decide', deal('x'))).toBe(true);
    expect(can(a, 'delete', deal('x'))).toBe(true);
    expect(can(a, 'archive', deal('x'))).toBe(true);
    expect(can(a, 'setPhase:decided', deal('x'))).toBe(true);
    expect(can(a, 'import')).toBe(true);
    expect(can(a, 'manageMembers')).toBe(false);
    expect(can(a, 'manageMandate')).toBe(false);
  });
  it('admin', () => {
    const a = m('admin');
    expect(can(a, 'manageMembers')).toBe(true);
    expect(can(a, 'manageMandate')).toBe(true);
    expect(can(a, 'manageTemplates')).toBe(true);
    expect(can(a, 'import')).toBe(true);
    expect(can(a, 'validateBote', deal('other'))).toBe(true);
    expect(can(a, 'validateBote', deal('me'))).toBe(false);
    expect(can(a, 'decide', deal('me'))).toBe(true);
    expect(can(a, 'delete', deal('me'))).toBe(true);
  });
  it('setOwner: associate/admin, not during associate review (as set_owner)', () => {
    expect(can(m('analyst'), 'setOwner', deal('me'))).toBe(false);
    expect(can(m('associate'), 'setOwner', deal('other'))).toBe(true);
    expect(can(m('admin'), 'setOwner', deal('me'))).toBe(true);
    expect(can(m('admin'), 'setOwner', { ...deal('other'), phase: 'associate_review' })).toBe(false);
    expect(can(m('associate'), 'setOwner')).toBe(false);
  });
  it('an unknown action is refused, even to an admin (fail closed)', () => {
    expect(can(m('admin'), 'bogus' as Action, deal('me'))).toBe(false);
  });
});
