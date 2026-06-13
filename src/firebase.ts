/**
 * Backend handles for the app.
 *
 * Previously this file initialised Firebase. It now wires the same export
 * surface (`auth`, `db`, `secondaryAuth`, `googleProvider`) to Supabase, so
 * every existing import in the app — `import { auth, db } from './firebase'` —
 * keeps working without any change.
 */
import { supabase, supabaseSecondary } from './lib/supabaseClient';
import { GoogleAuthProvider } from './lib/auth-compat';

// `db` and `auth` carry the Supabase client; the firestore/auth compat layers
// read `.client` off these handles.
export const db = { client: supabase };
export const auth = { client: supabase };

// Secondary handle: lets an admin create user accounts without being signed out.
export const secondaryAuth = { client: supabaseSecondary };

export const googleProvider = new GoogleAuthProvider();

export { supabase };
