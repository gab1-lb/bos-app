import type { Deal, Mandate } from '../engine/types';
import { DEFAULT_MANDATE, demoDeal } from '../engine/samples';
import { PHASES, type Decision, type DealMeta, type Phase } from '../domain/phases';
import { can, type Action, type Member, type Role } from '../domain/permissions';
import { DEFAULT_TEMPLATES, type Template } from '../domain/templates';
import type { Locale } from '../i18n/format';
import { admin, PERSONAS } from './personas';
import { RepoError, type ActivityEntry, type DealRecord, type Repo } from './repo';

export type MemoryRepo = Repo & {
  asMember(id: string): void;
  /** Memory mode only: restores a role / status decided earlier (no permission check). */
  overrideMember(id: string, patch: Partial<Pick<Member, 'role' | 'status'>>): void;
};
export type MemoryRepoOptions = { me?: Member; members?: Member[]; now?: () => Date };

const DECISIONS: Decision[] = ['go_dd', 'indicative_offer', 'no_go'];
const EARLY: Phase[] = ['im_received', 'analysis', 'bote_written'];
const clone = <T,>(v: T): T => (v === undefined ? v : structuredClone(v));

export function createMemoryRepo(opts: MemoryRepoOptions = {}): MemoryRepo {
  const now = opts.now ?? (() => new Date());
  const iso = () => now().toISOString();
  const memberList: Member[] = clone(opts.members ?? PERSONAS);
  let meId = (opts.me ?? admin).id;
  if (!memberList.some((m) => m.id === meId)) memberList.unshift(clone(opts.me ?? admin));

  const deals = new Map<string, DealRecord>();
  const log: ActivityEntry[] = [];
  const invites = new Map<string, Role>();
  let mandate: Mandate = clone(DEFAULT_MANDATE);
  let templates: Template[] = clone(DEFAULT_TEMPLATES);
  let seq = 0;
  let idSeq = 0;
  const listeners = new Set<{ dealId: string | null; cb: () => void }>();

  const cur = (): Member => memberList.find((m) => m.id === meId) ?? (() => { throw new RepoError('forbidden', 'no current member'); })();
  const ok = (action: Action, meta?: DealMeta) => { if (!can(cur(), action, meta)) throw new RepoError('forbidden', `permission denied: ${action}`); };
  const senior = () => { const r = cur(); return cur().status === 'active' && (r.role === 'admin' || r.role === 'associate'); };
  const requireSenior = () => { if (!senior()) throw new RepoError('forbidden', 'permission denied'); };
  const lock = (id: string): DealRecord => {
    const rec = deals.get(id);
    if (!rec) throw new RepoError('not_found', `deal ${id} not found`);
    return rec;
  };
  const notify = (dealId: string) => { for (const l of [...listeners]) if (l.dealId === null || l.dealId === dealId) l.cb(); };
  const record = (dealId: string, kind: string, path: string | null, oldValue: unknown, newValue: unknown) => {
    log.push({ id: ++seq, dealId, actorId: cur().id, at: iso(), kind, path, oldValue: clone(oldValue ?? null), newValue: clone(newValue ?? null) });
  };
  const touch = (rec: DealRecord) => { rec.meta.updatedAt = iso(); rec.meta.updatedBy = cur().id; };
  const newId = () => `mem-${++idSeq}`;
  const activeMember = (id: string, roles?: Role[]) => {
    const m = memberList.find((x) => x.id === id);
    return !!m && m.status === 'active' && (!roles || (!!m.role && roles.includes(m.role)));
  };

  // seed
  {
    const deal = demoDeal();
    const t = iso();
    deals.set(deal.id, {
      deal,
      meta: {
        id: deal.id, ownerId: admin.id, contributorIds: [], phase: 'analysis', phaseEnteredAt: t, decision: null,
        decidedAt: null, committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: t, updatedBy: admin.id,
      },
    });
  }

  const insert = (deal: Deal, meta: Omit<DealMeta, 'id'>, kind: string, details: unknown): string => {
    const id = newId();
    deals.set(id, { deal: { ...clone(deal), id }, meta: { ...clone(meta), id } });
    record(id, kind, null, null, details);
    notify(id);
    return id;
  };

  const repo: MemoryRepo = {
    asMember(id) {
      if (!memberList.some((m) => m.id === id)) throw new RepoError('not_found', `unknown member ${id}`);
      meId = id;
    },
    overrideMember(id, patch) {
      const m = memberList.find((x) => x.id === id);
      if (!m) return;
      if (patch.role !== undefined) m.role = patch.role;
      if (patch.status !== undefined) m.status = patch.status;
    },
    async me() { return clone(memberList.find((m) => m.id === meId) ?? null); },
    async listDeals() {
      if (!can(cur(), 'read')) return [];
      return [...deals.values()].map(clone).sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
    },
    async getDeal(id) {
      if (!can(cur(), 'read')) return null;
      const rec = deals.get(id);
      return rec ? clone(rec) : null;
    },
    async createDeal(deal) {
      ok('create');
      const t = iso();
      return insert(deal, {
        ownerId: cur().id, contributorIds: [], phase: 'im_received', phaseEnteredAt: t, decision: null, decidedAt: null,
        committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: t, updatedBy: cur().id,
      }, 'create', { name: deal.name });
    },
    async importDeal(deal, meta) {
      ok('import');
      if (!PHASES.includes(meta.phase)) throw new RepoError('invalid', `unknown phase ${meta.phase}`);
      if (meta.decision !== null && !DECISIONS.includes(meta.decision)) throw new RepoError('invalid', 'unknown decision');
      if ((meta.phase === 'decided') !== (meta.decision !== null)) throw new RepoError('invalid', 'decision must be set iff phase is decided');
      const t = iso();
      return insert(deal, {
        ownerId: cur().id, contributorIds: [], phase: meta.phase, phaseEnteredAt: meta.phaseEnteredAt || t,
        decision: meta.decision, decidedAt: meta.decision ? meta.decidedAt || t : null, committeeDate: meta.committeeDate,
        validatedBy: null, validatedAt: null, archived: meta.archived, updatedAt: t, updatedBy: cur().id,
      }, 'import', { name: deal.name, legacyId: deal.id, phase: meta.phase, decision: meta.decision });
    },
    async patchDeal(id, path, value) {
      ok('edit');
      if (!path || path.length === 0) throw new RepoError('invalid', 'empty path');
      if (path[0] === 'id') throw new RepoError('invalid', 'data.id is immutable');
      const rec = lock(id);
      const root = rec.deal as unknown as Record<string, unknown>;
      let parent: unknown = root;
      for (const k of path.slice(0, -1)) {
        parent = typeof parent === 'object' && parent !== null ? (parent as Record<string, unknown>)[k] : undefined;
      }
      const last = path[path.length - 1];
      const isArr = Array.isArray(parent);
      const validIdx = isArr && /^\d+$/.test(last) && Number(last) <= (parent as unknown[]).length;
      if (typeof parent !== 'object' || parent === null || (isArr && !validIdx)) {
        throw new RepoError('invalid', `path ${path.join('.')} has no parent in deal data`);
      }
      const p = parent as Record<string, unknown>;
      const old = p[last];
      p[last] = clone(value === undefined ? null : value);
      touch(rec);
      record(id, 'patch', path.join('.'), old, value);
      notify(id);
    },
    async setPhase(id, phase) {
      ok('edit');
      if (!PHASES.includes(phase) || phase === 'decided') throw new RepoError('invalid', `invalid target phase ${phase} (use decide())`);
      const rec = lock(id);
      ok(`setPhase:${phase}`, rec.meta);
      const m = rec.meta;
      if (m.phase === phase) return;
      const old = m.phase;
      m.phase = phase; m.phaseEnteredAt = iso(); m.decision = null; m.decidedAt = null;
      if (EARLY.includes(phase)) { m.validatedBy = null; m.validatedAt = null; }
      touch(rec);
      record(id, 'phase', null, old, phase);
      notify(id);
    },
    async validateBote(id) {
      requireSenior();
      const rec = lock(id);
      if (rec.meta.phase !== 'associate_review') throw new RepoError('invalid', 'deal is not in associate_review');
      ok('validateBote', rec.meta);
      rec.meta.validatedBy = cur().id; rec.meta.validatedAt = iso();
      touch(rec);
      record(id, 'validate', null, null, cur().id);
      notify(id);
    },
    async decide(id, d) {
      requireSenior();
      if (!DECISIONS.includes(d)) throw new RepoError('invalid', `unknown decision ${d}`);
      const rec = lock(id);
      const m = rec.meta;
      const old = m.decision;
      if (m.phase !== 'decided') m.phaseEnteredAt = iso();
      m.phase = 'decided'; m.decision = d; m.decidedAt = iso();
      touch(rec);
      record(id, 'decide', null, old, d);
      notify(id);
    },
    async archive(id, v) {
      ok('edit');
      if (typeof v !== 'boolean') throw new RepoError('invalid', 'archived must be true or false');
      const rec = lock(id);
      ok('archive', rec.meta);
      const old = rec.meta.archived;
      rec.meta.archived = v;
      touch(rec);
      record(id, 'archive', null, old, v);
      notify(id);
    },
    async deleteDeal(id) {
      requireSenior();
      const rec = lock(id);
      record(id, 'delete', null, { id, name: rec.deal.name }, null);
      deals.delete(id);
      // like the database (deal_id set null), but notify with the id first
      const entry = log[log.length - 1];
      notify(id);
      entry.dealId = '';
      for (const e of log) if (e.dealId === id) e.dealId = '';
    },
    async setCommitteeDate(id, date) {
      ok('edit');
      if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RepoError('invalid', 'invalid date');
      const rec = lock(id);
      const old = rec.meta.committeeDate;
      rec.meta.committeeDate = date;
      touch(rec);
      record(id, 'committee', null, old, date);
      notify(id);
    },
    async setContributors(id, ids) {
      ok('edit');
      const uniq = [...new Set(ids)];
      if (uniq.some((x) => !activeMember(x))) throw new RepoError('invalid', 'contributors must be active members');
      const rec = lock(id);
      const old = rec.meta.contributorIds;
      rec.meta.contributorIds = uniq;
      touch(rec);
      record(id, 'contributors', null, old, uniq);
      notify(id);
    },
    async setOwner(id, ownerId) {
      requireSenior();
      if (!activeMember(ownerId, ['admin', 'associate', 'analyst'])) throw new RepoError('invalid', 'owner must be an active analyst, associate or admin');
      const rec = lock(id);
      if (rec.meta.phase === 'associate_review') throw new RepoError('forbidden', 'permission denied: owner cannot change during associate_review');
      const old = rec.meta.ownerId;
      rec.meta.ownerId = ownerId; rec.meta.validatedBy = null; rec.meta.validatedAt = null;
      touch(rec);
      record(id, 'owner', null, old, ownerId);
      notify(id);
    },
    async setMyLocale(locale: Locale) {
      const me = cur();
      if (me.status !== 'active' || !me.role) throw new RepoError('forbidden', 'permission denied');
      if (locale !== 'fr' && locale !== 'en') throw new RepoError('invalid', `unknown locale ${locale}`);
      me.locale = locale;
    },
    async activity(dealId) {
      return log.filter((e) => e.dealId === dealId).map(clone).sort((a, b) => b.id - a.id);
    },
    subscribe(dealId, cb) {
      const l = { dealId, cb };
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    async members() { return clone(memberList); },
    async setMember(id, patch) {
      ok('manageMembers');
      const m = memberList.find((x) => x.id === id);
      if (!m) throw new RepoError('not_found', `member ${id} not found`);
      // like the database trigger: at least one active admin must remain
      const role = patch.role !== undefined ? patch.role : m.role;
      const status = patch.status !== undefined ? patch.status : m.status;
      if (m.role === 'admin' && m.status === 'active' && (role !== 'admin' || status !== 'active')
        && !memberList.some((x) => x.id !== m.id && x.role === 'admin' && x.status === 'active')) {
        throw new RepoError('forbidden', 'at least one active admin must remain');
      }
      if (patch.role !== undefined) m.role = patch.role;
      if (patch.status !== undefined) m.status = patch.status;
    },
    async invite(email, role) {
      ok('manageMembers');
      invites.set(email.trim().toLowerCase(), role);
    },
    async mandate() { return clone(mandate); },
    async setMandate(m) { ok('manageMandate'); mandate = clone(m); },
    async templates() { return clone(templates); },
    async saveTemplate(t) {
      ok('manageTemplates');
      templates = [...templates.filter((x) => !(x.key === t.key && x.locale === t.locale)), clone(t)];
    },
  };
  return repo;
}
