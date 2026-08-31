import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./types";

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (userId: string, email?: string | null) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, email, photo_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      setProfile(data as Profile);
      return;
    }
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({ id: userId, email: email ?? null })
      .select("id, full_name, phone, email, photo_url")
      .single();
    if (insErr) throw insErr;
    setProfile(created as Profile);
  }, []);
  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    loadProfile(session.user.id, session.user.email).catch(() => setProfile(null));
  }, [session?.user?.id, loadProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id, session.user.email);
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, loading, loadProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
