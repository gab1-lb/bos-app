'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [error, setError] = useState(false);
  const signIn = async () => {
    setError(false);
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) setError(true);
  };
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 16, textAlign: 'center' }}>
      <div>
        <h1>BOS</h1>
        <button type="button" onClick={signIn}>Se connecter avec Google</button>
        {error && <p role="alert">La connexion avec Google a échoué. Réessayez.</p>}
      </div>
    </main>
  );
}
