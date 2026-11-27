'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RepoProvider } from '../../lib/repo-context';
import { demoRoleFrom, isDemo } from '../../lib/session';
import { Welcome, useDemoChosen } from '../demo/Welcome';
import { DemoBar } from './DemoBar';
import { TopBar } from './TopBar';

/** Coquille des pages connectées : dépôt + membre courant, en-tête, contenu. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RepoProvider>
      {isDemo() ? <DemoShell>{children}</DemoShell> : <><TopBar /><main className="wrap">{children}</main></>}
    </RepoProvider>
  );
}

/** Démo publique : le rôle se choisit dans la page (bienvenue ou `?as=`), sans redirection ni cookie obligatoire. */
function DemoShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [chosen, choose] = useDemoChosen();
  // Rendered client-side only (RepoProvider renders nothing on the server), so `window` is there.
  const [asRole] = useState(() => demoRoleFrom(new URLSearchParams(window.location.search).get('as')));
  const [applying, setApplying] = useState(asRole !== null);

  useEffect(() => {
    if (!asRole) return;
    let live = true;
    // `/login?as=X` links land here as `?as=X`: apply the role, then drop the param from the address.
    choose(asRole).catch(() => {}).finally(() => {
      const q = new URLSearchParams(window.location.search);
      q.delete('as');
      const rest = q.toString();
      router.replace(window.location.pathname + (rest ? `?${rest}` : ''));
      if (live) setApplying(false);
    });
    return () => { live = false; };
  }, [asRole, choose, router]);

  return (
    <>
      <DemoBar />
      {applying ? null : chosen ? <><TopBar /><main className="wrap">{children}</main></> : <main className="wrap"><Welcome /></main>}
    </>
  );
}
