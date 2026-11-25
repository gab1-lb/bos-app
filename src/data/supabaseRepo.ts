import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mandate } from '../engine/types';
import { DEFAULT_MANDATE } from '../engine/samples';
import type { Decision, DealMeta, Phase } from '../domain/phases';
import type { Member, Role } from '../domain/permissions';
import type { Template } from '../domain/templates';
import type { Locale } from '../i18n/format';
import { normalizeDeal } from '../domain/dealShape';
import { RepoError, type ActivityEntry, type DealRecord, type Repo } from './repo';

/* ---------- pure mapping helpers (unit-tested) ---------- */

type PgErr = { code?: string; message?: string } | null | undefined;

export function mapPgError(err: PgErr | unknown): RepoError {
  if (err instanceof RepoError) return err;
  const e = (err ?? {}) as { code?: string; message?: string };
  const msg = e.message ?? 'unknown error';
  switch (e.code) {
    case '42501': return new RepoError('forbidden', msg);
    case 'P0002':
    case 'PGRST116': return new RepoError('not_found', msg);
    case undefined:
    case '': return new RepoError('network', msg);
    default: return new RepoError('invalid', msg);
  }
}

export type DealRow = {
  id: string;
  data: Record<string, unknown>;
  owner_id: string | null;
  contributor_ids: string[] | null;
  phase: Phase;
  phase_entered_at: string;
  decision: Decision | null;
  decided_at: string | null;
  committee_date: string | null;
  validated_by: string | null;
  validated_at: string | null;
  archived: boolean;
  updated_at: string;
  updated_by: string | null;
};

/** Row → record. The deal is normalised (sections, arrays, item ids) so one malformed row cannot break a screen. */
export function rowToDealRecord(row: DealRow): DealRecord {
  const { deal, idsAdded } = normalizeDeal({ ...row.data, id: row.id });
  return {
    deal,
    ...(idsAdded.length ? { unsavedIds: idsAdded } : {}),
    meta: {
      id: row.id,
      ownerId: row.owner_id ?? '',
      contributorIds: row.contributor_ids ?? [],
      phase: row.phase,
      phaseEnteredAt: row.phase_entered_at,
      decision: row.decision,
      decidedAt: row.decided_at,
      committeeDate: row.committee_date,
      validatedBy: row.validated_by,
      validatedAt: row.validated_at,
      archived: row.archived,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by ?? '',
    },
  };
}

export type MemberRow = {
  id: string; email: string; name: string | null; avatar_url: string | null;
  role: Role | null; status: Member['status']; locale: Locale;
};

export const memberFromRow = (r: MemberRow): Member => ({
  id: r.id, email: r.email, name: r.name ?? '', avatarUrl: r.avatar_url, role: r.role, status: r.status, locale: r.locale,
});

export type ActivityRow = {
  id: number; deal_id: string | null; actor_id: string | null; at: string; kind: string;
  path: string | null; old_value: unknown; new_value: unknown;
};

export const activityFromRow = (r: ActivityRow): ActivityEntry => ({
  id: r.id, dealId: r.deal_id ?? '', actorId: r.actor_id ?? '', at: r.at, kind: r.kind,
  path: r.path, oldValue: r.old_value, newValue: r.new_value,
});

/** Deal meta in the camelCase shape import_deal expects. */
export const metaToImportJson = (m: Omit<DealMeta, 'id'>) => ({
  phase: m.phase, phaseEnteredAt: m.phaseEnteredAt, decision: m.decision, decidedAt: m.decidedAt,
  committeeDate: m.committeeDate, archived: m.archived,
});

/* ---------- repository ---------- */

export function createSupabaseRepo(client: SupabaseClient): Repo {
  const check = (error: unknown) => { if (error) throw mapPgError(error); };
  const rpc = async <T = void>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.rpc(fn, args);
    check(error);
    return data as T;
  };
  const one = async (id: string): Promise<DealRecord | null> => {
    const { data, error } = await client.from('deals').select('*').eq('id', id).maybeSingle();
    check(error);
    return data ? rowToDealRecord(data as DealRow) : null;
  };

  return {
    async me() {
      const { data: auth, error: aerr } = await client.auth.getUser();
      if (aerr || !auth.user) return null;
      const { data, error } = await client.from('members').select('*').eq('id', auth.user.id).maybeSingle();
      check(error);
      return data ? memberFromRow(data as MemberRow) : null;
    },
    async listDeals() {
      const { data, error } = await client.from('deals').select('*').order('updated_at', { ascending: false });
      check(error);
      return ((data ?? []) as DealRow[]).map(rowToDealRecord);
    },
    getDeal: one,
    // Item ids are generated client-side, before the deal is stored.
    createDeal: (deal) => rpc<string>('create_deal', { p_data: normalizeDeal(deal).deal }),
    importDeal: (deal, meta) => rpc<string>('import_deal', { p_data: normalizeDeal(deal).deal, p_meta: metaToImportJson(meta) }),
    patchDeal: (id, path, value) => rpc('patch_deal', { p_id: id, p_path: path, p_value: value === undefined ? null : value }),
    appendItem: (id, list, item) => rpc('deal_list_append', { p_id: id, p_list: list, p_item: item }),
    removeItem: (id, list, itemId) => rpc('deal_list_remove', { p_id: id, p_list: list, p_item_id: itemId }),
    updateItem: (id, list, itemId, fields) => rpc('deal_list_update', { p_id: id, p_list: list, p_item_id: itemId, p_fields: fields }),
    setPhase: (id, p) => rpc('set_phase', { p_id: id, p_phase: p }),
    validateBote: (id) => rpc('validate_bote', { p_id: id }),
    decide: (id, d) => rpc('decide', { p_id: id, p_decision: d }),
    archive: (id, v) => rpc('set_archived', { p_id: id, p_value: v }),
    deleteDeal: (id) => rpc('delete_deal', { p_id: id }),
    setCommitteeDate: (id, date) => rpc('set_committee_date', { p_id: id, p_date: date }),
    setContributors: (id, ids) => rpc('set_contributors', { p_id: id, p_ids: ids }),
    setOwner: (id, ownerId) => rpc('set_owner', { p_id: id, p_owner: ownerId }),
    setMyLocale: (locale) => rpc('set_my_locale', { p_locale: locale }),
    async activity(dealId) {
      const { data, error } = await client.from('activity').select('*').eq('deal_id', dealId)
        .order('at', { ascending: false }).order('id', { ascending: false });
      check(error);
      return ((data ?? []) as ActivityRow[]).map(activityFromRow);
    },
    subscribe(dealId, cb) {
      const name = `bos:${dealId ?? 'all'}:${Math.random().toString(36).slice(2)}`;
      let ch = client.channel(name).on('postgres_changes',
        { event: '*', schema: 'public', table: 'deals', ...(dealId ? { filter: `id=eq.${dealId}` } : {}) }, () => cb());
      if (dealId) {
        ch = ch.on('postgres_changes',
          { event: '*', schema: 'public', table: 'activity', filter: `deal_id=eq.${dealId}` }, () => cb());
      }
      ch.subscribe();
      return () => { void client.removeChannel(ch); };
    },
    async members() {
      const { data, error } = await client.from('members').select('*').order('created_at');
      check(error);
      return ((data ?? []) as MemberRow[]).map(memberFromRow);
    },
    async setMember(id, patch) {
      const { data, error } = await client.from('members').update(patch).eq('id', id).select('id');
      check(error);
      if (!data || data.length === 0) throw new RepoError('forbidden', 'member not updated (not found or not allowed)');
    },
    async invite(email, role) {
      const { error } = await client.from('invites').insert({ email: email.trim().toLowerCase(), role });
      check(error);
    },
    async mandate() {
      const { data, error } = await client.from('mandate').select('data').eq('id', 1).maybeSingle();
      check(error);
      return { ...DEFAULT_MANDATE, ...((data?.data ?? {}) as Partial<Mandate>) };
    },
    async setMandate(m) {
      const { error } = await client.from('mandate').upsert({ id: 1, data: m });
      check(error);
    },
    async templates() {
      const { data, error } = await client.from('templates').select('key,locale,subject,body');
      check(error);
      return (data ?? []) as Template[];
    },
    async saveTemplate(t) {
      const { error } = await client.from('templates')
        .upsert({ key: t.key, locale: t.locale, subject: t.subject, body: t.body }, { onConflict: 'key,locale' });
      check(error);
    },
  };
}
