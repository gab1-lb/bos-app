'use client';
import { useState } from 'react';
import { t, type Locale } from '../../i18n/format';
import { startGoogleSignIn } from '../../lib/googleSignIn';
import { createClient } from '../../lib/supabase/client';

export function LoginButton({ locale }: { locale: Locale }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setError(null);
    setBusy(true);
    let msg: string | null;
    try { msg = await startGoogleSignIn(createClient().auth, window.location.origin); }
    catch (e) { msg = (e as Error)?.message || 'error'; }
    if (msg !== null) { setError(msg); setBusy(false); }
  };
  return (
    <>
      <button type="button" onClick={signIn} disabled={busy} aria-busy={busy || undefined}>{t(locale, 'Se connecter avec Google')}</button>
      {error !== null && <p role="alert">{t(locale, 'La connexion avec Google a échoué ({0}). Réessayez.', error)}</p>}
    </>
  );
}
