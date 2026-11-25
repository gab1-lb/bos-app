/** Starts the Google sign-in; resolves to null when the browser is being redirected, else to the error message
 *  (a returned error or a thrown rejection, e.g. network failure), so the button never fails silently. */
export async function startGoogleSignIn(
  auth: { signInWithOAuth(o: { provider: 'google'; options: { redirectTo: string } }): Promise<{ error: { message?: string } | null }> },
  origin: string,
): Promise<string | null> {
  try {
    const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } });
    return error ? error.message || 'error' : null;
  } catch (e) {
    return (e instanceof Error ? e.message : String(e ?? '')) || 'error';
  }
}
