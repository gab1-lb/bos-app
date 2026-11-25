'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Repo } from '../data/repo';
import { createSupabaseRepo } from '../data/supabaseRepo';
import type { Member } from '../domain/permissions';
import { fmt, t, type Locale } from '../i18n/format';
import { LOCALE_COOKIE } from '../i18n/pickLocale';
import { MEMORY_COOKIE, getMemorySessionRepo, isMemoryMode } from './session';
import { createClient } from './supabase/client';

type Toast = { msg: string; bad: boolean; key: number };

type RepoCtx = {
  repo: Repo;
  me: Member | null;
  locale: Locale;
  setLocale(l: Locale): Promise<void>;
  toast(msg: string, bad?: boolean): void;
};

const Ctx = createContext<RepoCtx | null>(null);

/** Client-side repository + current member for every authenticated page. */
export function RepoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [toastState, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const r = isMemoryMode() ? getMemorySessionRepo() : createSupabaseRepo(createClient());
    setRepo(r);
    let live = true;
    r.me().then((m) => { if (live) setMe(m); }).catch(() => {});
    if (process.env.NEXT_PUBLIC_DATA_MODE === 'memory') {
      // E2E hook, memory mode only (literal check so production builds drop it).
      const w = window as unknown as { __bosRepo?: Repo; __bosGo?: (p: string) => void; __bosAs?: (id: string) => Promise<void> };
      w.__bosRepo = r;
      w.__bosGo = (p: string) => router.push(p);
      // Another teammate takes the keyboard without a reload, so the in-memory deals survive (multi-user e2e paths).
      w.__bosAs = async (id: string) => {
        (r as Repo & { asMember(id: string): void }).asMember(id);
        document.cookie = `${MEMORY_COOKIE}=${encodeURIComponent(id)}; path=/; samesite=lax`;
        setMe(await r.me());
      };
    }
    return () => { live = false; };
  }, [router]);

  useEffect(() => {
    if (!me) return;
    document.documentElement.lang = me.locale;
    // Remembered for the sign-in and waiting pages, which have no member yet.
    document.cookie = `${LOCALE_COOKIE}=${me.locale}; path=/; max-age=31536000; samesite=lax`;
  }, [me]);

  const toast = useCallback((msg: string, bad = false) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, bad, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const setLocale = useCallback(async (l: Locale) => {
    if (!repo) return;
    setMe((m) => (m ? { ...m, locale: l } : m));
    try {
      await repo.setMyLocale(l);
    } catch (e) {
      toast(t(l, 'Enregistrement impossible : {0}', (e as Error).message), true);
    }
  }, [repo, toast]);

  const value = useMemo<RepoCtx | null>(
    () => (repo ? { repo, me, locale: me?.locale ?? 'fr', setLocale, toast } : null),
    [repo, me, setLocale, toast],
  );

  if (!value) return null;
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className={`toast ${toastState ? 'on' : ''} ${toastState?.bad ? 'bad' : ''}`}
        role={toastState?.bad ? 'alert' : 'status'}
        aria-live="polite"
      >
        {toastState?.msg}
      </div>
    </Ctx.Provider>
  );
}

function useCtx(): RepoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('RepoProvider missing');
  return c;
}

export const useRepo = (): Repo => useCtx().repo;
export const useMe = (): Member | null => useCtx().me;
export const useApp = useCtx;

/** Locale-bound translation and number formatting. */
export function useI18n() {
  const { locale } = useCtx();
  return useMemo(() => ({ locale, t: (k: string, ...a: (string | number)[]) => t(locale, k, ...a), ...fmt(locale) }), [locale]);
}
export type I18n = ReturnType<typeof useI18n>;
