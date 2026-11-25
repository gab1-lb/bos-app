import { describe, expect, it } from 'vitest';
import { activityFromRow, createSupabaseRepo, mapPgError, memberFromRow, metaToImportJson, rowToDealRecord, type DealRow } from './supabaseRepo';
import { RepoError } from './repo';

const row: DealRow = {
  id: 'abc', data: { id: 'legacy', name: 'N' }, owner_id: 'u1', contributor_ids: null, phase: 'analysis',
  phase_entered_at: '2026-01-01T00:00:00Z', decision: null, decided_at: null, committee_date: '2026-02-01',
  validated_by: null, validated_at: null, archived: false, updated_at: '2026-01-02T00:00:00Z', updated_by: null,
};

describe('supabase mapping', () => {
  it('maps a deal row to {deal, meta}', () => {
    const { deal, meta } = rowToDealRecord(row);
    expect(deal).toMatchObject({ id: 'abc', name: 'N' });
    expect(meta).toEqual({
      id: 'abc', ownerId: 'u1', contributorIds: [], phase: 'analysis', phaseEnteredAt: '2026-01-01T00:00:00Z',
      decision: null, decidedAt: null, committeeDate: '2026-02-01', validatedBy: null, validatedAt: null,
      archived: false, updatedAt: '2026-01-02T00:00:00Z', updatedBy: '',
    });
  });
  it('maps member and activity rows', () => {
    expect(memberFromRow({ id: 'm', email: 'e', name: null, avatar_url: null, role: null, status: 'pending', locale: 'fr' }))
      .toEqual({ id: 'm', email: 'e', name: '', avatarUrl: null, role: null, status: 'pending', locale: 'fr' });
    expect(activityFromRow({ id: 1, deal_id: null, actor_id: 'a', at: 't', kind: 'k', path: null, old_value: 1, new_value: 2 }))
      .toEqual({ id: 1, dealId: '', actorId: 'a', at: 't', kind: 'k', path: null, oldValue: 1, newValue: 2 });
  });
  it('serialises import meta as camelCase', () => {
    expect(metaToImportJson({ ...rowToDealRecord(row).meta, phase: 'decided', decision: 'go_dd' }))
      .toMatchObject({ phase: 'decided', decision: 'go_dd', committeeDate: '2026-02-01', archived: false });
  });
});

describe('mapPgError', () => {
  it('maps SQLSTATEs to RepoError codes', () => {
    expect(mapPgError({ code: '42501', message: 'm' })).toMatchObject({ code: 'forbidden', message: 'm' });
    expect(mapPgError({ code: 'P0002' }).code).toBe('not_found');
    expect(mapPgError({ code: '22023' }).code).toBe('invalid');
    expect(mapPgError({ message: 'Failed to fetch' }).code).toBe('network');
    expect(mapPgError(new RepoError('forbidden')).code).toBe('forbidden');
    expect(mapPgError(null)).toBeInstanceOf(RepoError);
  });
});

describe('rowToDealRecord normalisation', () => {
  it('fills malformed lists and flags generated item ids as unsaved', () => {
    const r = rowToDealRecord({ ...row, data: { name: 'N', questions: [{ q: 'a' }], comps: null, adjustments: 'x' } });
    expect(r.deal.comps).toEqual([]);
    expect(r.deal.adjustments).toEqual([]);
    expect(r.deal.questions[0].id).toBeTruthy();
    expect(r.unsavedIds).toEqual(['questions']);
  });
  it('reports nothing unsaved when every item has an id', () => {
    const r = rowToDealRecord({ ...row, data: { name: 'N', questions: [{ id: 'q', q: 'a' }] } });
    expect(r.unsavedIds).toBeUndefined();
  });
});

describe('invite', () => {
  it('upserts on the e-mail, lower-cased, so a re-invite updates the role', async () => {
    const calls: unknown[] = [];
    const client = { from: (t: string) => ({ upsert: async (row: unknown, o: unknown) => { calls.push([t, row, o]); return { error: null }; } }) };
    await createSupabaseRepo(client as never).invite(' Guest@Partner.FR ', 'reader');
    expect(calls).toEqual([['invites', { email: 'guest@partner.fr', role: 'reader' }, { onConflict: 'email' }]]);
  });
});
