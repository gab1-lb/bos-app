'use client';
import type { ReactNode } from 'react';
import { RepoProvider } from '../../lib/repo-context';
import { TopBar } from './TopBar';

/** Coquille des pages connectées : dépôt + membre courant, en-tête, contenu. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RepoProvider>
      <TopBar />
      <main className="wrap">{children}</main>
    </RepoProvider>
  );
}
