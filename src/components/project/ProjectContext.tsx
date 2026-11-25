'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Mandate } from '../../engine/types';
import type { DealRecord, Repo } from '../../data/repo';
import type { ListItem, ListName } from '../../domain/dealShape';
import type { Member } from '../../domain/permissions';
import { can } from '../../domain/permissions';
import { useApp, useI18n } from '../../lib/repo-context';
import { setLastDeal } from '../shell/lastDeal';
import { compute, setIn, type Computed } from './compute';

type ProjectCtx = DealRecord & {
  id: string;
  mandate: Mandate;
  c: Computed;
  me: Member | null;
  members: Member[];
  editable: boolean;
  /** Enregistre un champ du dossier (chemin dans le JSON du deal). */
  patch(path: string[], value: unknown): void;
  /** Ajoute des lignes (questions, retraitements, comparables) à la fin de la liste, une par une, dans l'ordre. */
  appendItems<L extends ListName>(list: L, items: ListItem<L>[]): void;
  /** Supprime la ligne qui porte cet identifiant. */
  removeItem(list: ListName, itemId: string): void;
  /** Modifie des champs de la ligne qui porte cet identifiant (jamais par position). */
  updateItem(list: ListName, itemId: string, fields: Record<string, unknown>): void;
  /** Lance une action du dépôt (phase, décision…) avec message d'erreur. */
  act(fn: (repo: Repo, id: string) => Promise<void>): Promise<void>;
};

const Ctx = createContext<ProjectCtx | null>(null);

export function useProject(): ProjectCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('ProjectProvider missing');
  return c;
}

export function ProjectProvider({ id, children }: { id: string; children: ReactNode }) {
  const { repo, me, toast } = useApp();
  const { t } = useI18n();
  const [rec, setRec] = useState<DealRecord | null | undefined>(undefined);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const reload = useCallback(async () => {
    try {
      const r = await repo.getDeal(id);
      setRec(r);
    } catch {
      setRec(null);
    }
  }, [repo, id]);

  useEffect(() => {
    setRec(undefined);
    void reload();
    repo.mandate().then(setMandate).catch(() => setMandate(null));
    repo.members().then(setMembers).catch(() => setMembers([]));
    const off = repo.subscribe(id, () => { void reload(); });
    return off;
  }, [repo, id, reload]);

  useEffect(() => { if (rec) setLastDeal(rec.deal.id); }, [rec]);

  const fail = useCallback((e: unknown) => {
    toast(t('Enregistrement impossible : {0}', (e as Error)?.message ?? ''), true);
    void reload();
  }, [toast, t, reload]);

  const editable = !!me && !!rec && can(me, 'edit', rec.meta);
  const patch = useCallback((path: string[], value: unknown) => {
    if (!editable) return;
    setRec((r) => (r ? { ...r, deal: setIn(r.deal, path, value) } : r));
    repo.patchDeal(id, path, value).catch(fail);
  }, [repo, id, fail, editable]);

  type Items = Record<string, unknown>[];
  const editList = useCallback((list: ListName, f: (items: Items) => Items) => {
    setRec((r) => (r ? { ...r, deal: { ...r.deal, [list]: f(((r.deal as unknown as Record<string, Items>)[list] ?? [])) } } : r));
  }, []);
  const appendItems = useCallback(<L extends ListName>(list: L, items: ListItem<L>[]) => {
    if (!editable || items.length === 0) return;
    editList(list, (xs) => [...xs, ...(items as unknown as Items)]);
    void (async () => {
      try { for (const it of items) await repo.appendItem(id, list, it); } catch (e) { fail(e); }
    })();
  }, [repo, id, fail, editable, editList]);
  const removeItem = useCallback((list: ListName, itemId: string) => {
    if (!editable) return;
    editList(list, (xs) => xs.filter((x) => x.id !== itemId));
    repo.removeItem(id, list, itemId).catch(fail);
  }, [repo, id, fail, editable, editList]);
  const updateItem = useCallback((list: ListName, itemId: string, fields: Record<string, unknown>) => {
    if (!editable) return;
    editList(list, (xs) => xs.map((x) => (x.id === itemId ? { ...x, ...fields } : x)));
    repo.updateItem(id, list, itemId, fields).catch(fail);
  }, [repo, id, fail, editable, editList]);

  // Older data: item ids generated on read are saved once, so later writes by id find their rows.
  const savedIds = useRef<string | null>(null);
  useEffect(() => {
    if (!rec?.unsavedIds?.length || !editable || savedIds.current === id) return;
    savedIds.current = id;
    for (const list of rec.unsavedIds) repo.patchDeal(id, [list], rec.deal[list]).catch(() => {});
  }, [rec, editable, repo, id]);

  const act = useCallback(async (fn: (repo: Repo, id: string) => Promise<void>) => {
    try { await fn(repo, id); await reload(); } catch (e) { fail(e); }
  }, [repo, id, reload, fail]);

  const c = useMemo(() => (rec && mandate ? compute(rec.deal, mandate) : null), [rec, mandate]);

  if (rec === undefined || (rec && (!mandate || !c))) return <div className="loading" aria-busy="true">…</div>;
  if (rec === null) return <div className="card panel mt"><div className="empty">{t('Dossier introuvable.')}</div></div>;

  const value: ProjectCtx = {
    ...rec, id, mandate: mandate!, c: c!, me, members,
    editable,
    patch, appendItems, removeItem, updateItem, act,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Liaison d'un champ d'une ligne de liste : enregistré par identifiant de ligne, pas par position. */
export function useBindItem() {
  const { updateItem, editable } = useProject();
  return useCallback((list: ListName, index: number, itemId: string, field: string, label: string) => ({
    id: `f-${list}.${index}.${field}`, label, readOnly: !editable,
    onCommit: (v: unknown) => updateItem(list, itemId, { [field]: v === undefined ? null : v }),
  }), [updateItem, editable]);
}

/** Raccourcis de liaison d'un champ au dossier : id, libellé, lecture seule, enregistrement. */
export function useBind() {
  const { patch, editable } = useProject();
  return useCallback((path: (string | number)[], label: string) => {
    const p = path.map(String);
    return { id: `f-${p.join('.')}`, label, readOnly: !editable, onCommit: (v: unknown) => patch(p, v) };
  }, [patch, editable]);
}
