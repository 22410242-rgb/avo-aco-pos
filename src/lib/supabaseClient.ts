import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase project credentials are injected at build time via Vite env vars.
// Configure them in .env (local) and in Vercel → Settings → Environment Variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced clearly instead of a cryptic runtime crash.
  console.error(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Add them to your .env file and to your Vercel project environment variables.'
  );
}

// Primary client – holds the logged-in (admin/cashier) session.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'avo-aco-auth',
  },
});

// Secondary client – used to create new user accounts WITHOUT replacing the
// currently signed-in admin session (mirrors the old Firebase "secondaryApp"
// pattern). It uses a separate storage key so its session never touches the
// primary one.
export const supabaseSecondary: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'avo-aco-auth-secondary',
  },
});
