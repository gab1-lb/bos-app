'use client';
import { createClient } from '../../lib/supabase/client';
import { MEMORY_COOKIE, isMemoryMode } from '../../lib/session';

export function SignOutButton({ label = 'Se déconnecter', className }: { label?: string; className?: string }) {
  const signOut = async () => {
    if (isMemoryMode()) document.cookie = `${MEMORY_COOKIE}=; path=/; max-age=0`;
    else await createClient().auth.signOut();
    window.location.assign('/login');
  };
  return <button type="button" className={className} onClick={signOut}>{label}</button>;
}
