import type { Deal, Mandate } from '../engine/types';
import type { Decision, DealMeta, Phase } from '../domain/phases';
import type { Member, Role } from '../domain/permissions';
import type { Template } from '../domain/templates';
import type { Locale } from '../i18n/format';
import type { ListItem, ListName } from '../domain/dealShape';

export type DealRecord = {
  deal: Deal;
  meta: DealMeta;
  /** Lists whose item ids were generated when the deal was read (older data): not stored yet. */
  unsavedIds?: ListName[];
};

export type ActivityEntry = {
  id: number;
  dealId: string;
  actorId: string;
  at: string;
  kind: string;
  path: string | null;
  oldValue: unknown;
  newValue: unknown;
};

export type RepoErrorCode = 'forbidden' | 'not_found' | 'invalid' | 'network';

export class RepoError extends Error {
  code: RepoErrorCode;
  constructor(code: RepoErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RepoError';
    this.code = code;
  }
}

export interface Repo {
  me(): Promise<Member | null>;
  listDeals(): Promise<DealRecord[]>;
  getDeal(id: string): Promise<DealRecord | null>;
  createDeal(deal: Deal): Promise<string>;
  importDeal(deal: Deal, meta: Omit<DealMeta, 'id'>): Promise<string>;
  patchDeal(id: string, path: string[], value: unknown): Promise<void>;
  /** Adds an item (with its client-generated id) at the end of a deal list. */
  appendItem<L extends ListName>(id: string, list: L, item: ListItem<L>): Promise<void>;
  /** Removes the item with this id; no-op when it is already gone. */
  removeItem(id: string, list: ListName, itemId: string): Promise<void>;
  /** Sets fields of the item with this id (not `id` itself); not_found when the item is gone. */
  updateItem(id: string, list: ListName, itemId: string, fields: Record<string, unknown>): Promise<void>;
  setPhase(id: string, p: Phase): Promise<void>;
  validateBote(id: string): Promise<void>;
  decide(id: string, d: Decision): Promise<void>;
  archive(id: string, v: boolean): Promise<void>;
  deleteDeal(id: string): Promise<void>;
  setCommitteeDate(id: string, date: string | null): Promise<void>;
  setContributors(id: string, ids: string[]): Promise<void>;
  setOwner(id: string, ownerId: string): Promise<void>;
  setMyLocale(locale: Locale): Promise<void>;
  activity(dealId: string): Promise<ActivityEntry[]>;
  subscribe(dealId: string | null, cb: () => void): () => void;
  members(): Promise<Member[]>;
  setMember(id: string, patch: Partial<Pick<Member, 'role' | 'status'>>): Promise<void>;
  invite(email: string, role: Role): Promise<void>;
  mandate(): Promise<Mandate>;
  setMandate(m: Mandate): Promise<void>;
  templates(): Promise<Template[]>;
  saveTemplate(t: Template): Promise<void>;
}
