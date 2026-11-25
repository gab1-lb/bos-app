import { describe, expect, it } from 'vitest';
import { startGoogleSignIn } from './googleSignIn';

describe('startGoogleSignIn', () => {
  it('redirects to the callback of this site', async () => {
    let seen: unknown;
    const auth = { signInWithOAuth: async (o: unknown) => { seen = o; return { error: null }; } };
    expect(await startGoogleSignIn(auth, 'https://bos.example')).toBeNull();
    expect(seen).toEqual({ provider: 'google', options: { redirectTo: 'https://bos.example/auth/callback' } });
  });
  it('returns the message of a returned error', async () => {
    const auth = { signInWithOAuth: async () => ({ error: { message: 'provider disabled' } }) };
    expect(await startGoogleSignIn(auth, 'x')).toBe('provider disabled');
  });
  it('catches a thrown rejection (network failure) and returns its message', async () => {
    const auth = { signInWithOAuth: async () => { throw new TypeError('Failed to fetch'); } };
    expect(await startGoogleSignIn(auth, 'x')).toBe('Failed to fetch');
  });
});
