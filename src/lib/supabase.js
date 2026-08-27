import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// True only when both env vars are present; the whole app gates on this
// instead of crashing at import time (which would show a blank white screen).
export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const requireSupabase = () => {
  if (!supabase) throw new Error("HOMEFIX database is not configured.");
  return supabase;
};
