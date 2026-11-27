'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { useApp } from '../repo-context';
import { PERSONA_BY_ROLE, rememberedDemoRole, type DemoRole } from '../session';

/* Demo only. "Chosen" = a role remembered by the bos_as cookie at load, or one picked in this page life
   (welcome, demo bar, `?as=`). Module state, so it survives client-side navigation without any cookie. */
let picked = false;
let atLoad: boolean | undefined;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const isChosen = () => picked || (atLoad ??= rememberedDemoRole() !== null);

/** Whether the demo visitor has a role yet, and how to pick one (applied without navigation). */
export function useDemoChosen(): [boolean, (role: DemoRole) => Promise<void>] {
  const { switchPersona } = useApp();
  const chosen = useSyncExternalStore(subscribe, isChosen, () => false);
  const choose = useCallback(async (role: DemoRole) => {
    await switchPersona(PERSONA_BY_ROLE[role].id);
    picked = true;
    listeners.forEach((l) => l());
  }, [switchPersona]);
  return [chosen, choose];
}
