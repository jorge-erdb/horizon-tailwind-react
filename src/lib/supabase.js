import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Credentials come from the environment — nothing is hardcoded. Create
 * Nova's own project at https://supabase.com, then copy .env.example to
 * .env.local and fill in:
 *
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon public key>
 *
 * Vite only exposes variables prefixed with VITE_, and it inlines them at
 * build time. The anon key is designed to be public — it protects nothing on
 * its own, so Row Level Security on every table is what actually enforces
 * access. Never put the service_role key here.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Warn rather than throw: the marketing page and dashboard shell should
  // still render for anyone cloning the repo before wiring up credentials.
  // eslint-disable-next-line no-console
  console.warn(
    "[Nova] Supabase is not configured. Copy .env.example to .env.local and " +
      "set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then " +
      "restart the dev server. Authentication is disabled until you do."
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export default supabase;
