'use client';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const signIn = async () => {
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 16, textAlign: 'center' }}>
      <div>
        <h1>BOS</h1>
        <button type="button" onClick={signIn}>Se connecter avec Google</button>
      </div>
    </main>
  );
}
