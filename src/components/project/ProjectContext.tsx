'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Mandate } from '../../engine/types';
import type { DealRecord, Repo } from '../../data/repo';
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

  const patch = useCallback((path: string[], value: unknown) => {
    setRec((r) => (r ? { ...r, deal: setIn(r.deal, path, value) } : r));
    repo.patchDeal(id, path, value).catch(fail);
  }, [repo, id, fail]);

  const act = useCallback(async (fn: (repo: Repo, id: string) => Promise<void>) => {
    try { await fn(repo, id); await reload(); } catch (e) { fail(e); }
  }, [repo, id, reload, fail]);

  const c = useMemo(() => (rec && mandate ? compute(rec.deal, mandate) : null), [rec, mandate]);

  if (rec === undefined || (rec && (!mandate || !c))) return <div className="loading" aria-busy="true">…</div>;
  if (rec === null) return <div className="card panel mt"><div className="empty">{t('Dossier introuvable.')}</div></div>;

  const value: ProjectCtx = {
    ...rec, id, mandate: mandate!, c: c!, me, members,
    editable: !!me && can(me, 'edit', rec.meta),
    patch, act,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Raccourcis de liaison d'un champ au dossier : id, libellé, lecture seule, enregistrement. */
export function useBind() {
  const { patch, editable } = useProject();
  return useCallback((path: (string | number)[], label: string) => {
    const p = path.map(String);
    return { id: `f-${p.join('.')}`, label, readOnly: !editable, onCommit: (v: unknown) => patch(p, v) };
  }, [patch, editable]);
}
