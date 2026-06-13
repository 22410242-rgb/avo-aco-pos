/**
 * Firebase-Auth-compatible API implemented on top of Supabase Auth.
 * Aliased to `firebase/auth` in vite.config.ts, so the app keeps using
 * { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, ... }.
 */
import type { SupabaseClient, User as SbUser } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface AuthHandle { client: SupabaseClient; }

export interface CompatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export class GoogleAuthProvider {
  providerId = 'google';
}

export function getAuth(): AuthHandle {
  return { client: supabase };
}

function mapUser(u: SbUser | null | undefined): CompatUser | null {
  if (!u) return null;
  const meta: any = u.user_metadata || {};
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: meta.name ?? meta.full_name ?? null,
    photoURL: meta.avatar_url ?? meta.picture ?? null,
  };
}

// Translate Supabase auth errors into the Firebase error.code strings the app
// already branches on, so all UI messages keep working unchanged.
function authError(message: string): Error & { code: string } {
  const m = (message || '').toLowerCase();
  let code = 'auth/unknown';
  if (m.includes('already registered') || m.includes('already been registered')) code = 'auth/email-already-in-use';
  else if (m.includes('password should be') || m.includes('weak') || m.includes('at least 6')) code = 'auth/weak-password';
  else if (m.includes('invalid login') || m.includes('invalid credentials')) code = 'auth/invalid-credential';
  else if (m.includes('email not confirmed')) code = 'auth/invalid-credential';
  else if (m.includes('user not found')) code = 'auth/user-not-found';
  return Object.assign(new Error(message), { code });
}

export function onAuthStateChanged(
  auth: AuthHandle,
  callback: (user: CompatUser | null) => void,
): () => void {
  const client = auth?.client || supabase;
  // Fires INITIAL_SESSION immediately, then on every auth change.
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(mapUser(session?.user));
  });
  return () => {
    try { data.subscription.unsubscribe(); } catch { /* noop */ }
  };
}

export async function signInWithEmailAndPassword(
  auth: AuthHandle,
  email: string,
  password: string,
) {
  const client = auth?.client || supabase;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw authError(error.message);
  return { user: mapUser(data.user) };
}

export async function createUserWithEmailAndPassword(
  auth: AuthHandle,
  email: string,
  password: string,
) {
  // `auth` here is the SECONDARY client, so creating the account does not
  // disturb the signed-in admin's session.
  const client = auth?.client || supabase;
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw authError(error.message);
  if (!data.user) throw authError('User creation failed');
  return { user: { uid: data.user.id, email: data.user.email ?? email } };
}

export async function signOut(auth: AuthHandle) {
  const client = auth?.client || supabase;
  const { error } = await client.auth.signOut();
  if (error) throw authError(error.message);
}

export async function sendPasswordResetEmail(auth: AuthHandle, email: string) {
  const client = auth?.client || supabase;
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw authError(error.message);
}

// Google sign-in. Supabase uses a redirect flow rather than a popup; the page
// redirects to Google and back, after which onAuthStateChanged fires.
export async function signInWithPopup(auth: AuthHandle, _provider: GoogleAuthProvider) {
  const client = auth?.client || supabase;
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw authError(error.message);
  return { user: null, _redirect: data?.url };
}
