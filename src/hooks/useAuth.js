import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { getOrCreateProfile, getSession, onAuthStateChange, signOut as signOutService } from "../services/auth";

// Single source of truth for the authenticated session + profile.
// Every component reads auth state from this hook instead of re-implementing
// supabase.auth.getSession()/onAuthStateChange() themselves.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;

    const loadProfile = async (nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const row = await getOrCreateProfile(nextSession.user);
        if (mounted) setProfile(row);
      } catch (error) {
        console.error("[HOMEFIX] Profile load error:", error);
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    getSession()
      .then(loadProfile)
      .catch((error) => {
        console.error("[HOMEFIX] Session restore error:", error);
        if (mounted) setLoading(false);
      });

    const unsubscribe = onAuthStateChange(loadProfile);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await signOutService();
    setSession(null);
    setProfile(null);
  };

  return {
    session,
    user: session?.user || null,
    profile,
    role: profile?.role || "customer",
    loading,
    isAuthenticated: Boolean(session?.user),
    signOut,
    refreshProfile: async () => {
      if (!session?.user) return;
      const row = await getOrCreateProfile(session.user);
      setProfile(row);
      return row;
    },
  };
}
