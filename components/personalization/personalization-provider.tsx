"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { DEFAULT_PERSONALIZATION, PersonalizationKey, PersonalizationPreferences } from "./personalization-config";

type ContextValue = {
  preferences: PersonalizationPreferences;
  ready: boolean;
  saving: boolean;
  setPreference: (key: PersonalizationKey, value: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const Context = createContext<ContextValue | null>(null);

export function PersonalizationProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [preferences, setPreferences] = useState(DEFAULT_PERSONALIZATION);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setPreferences(DEFAULT_PERSONALIZATION);
      setReady(true);
      return;
    }
    const { data, error } = await supabase.from("user_personalization_preferences").select("*").eq("user_id", auth.user.id).maybeSingle();
    if (!error && data) {
      setPreferences({
        ...DEFAULT_PERSONALIZATION,
        ...Object.fromEntries(Object.keys(DEFAULT_PERSONALIZATION).map((key) => [key, (data as Record<string, unknown>)[key] || DEFAULT_PERSONALIZATION[key as PersonalizationKey]])),
      });
    } else if (!error && !data) {
      await supabase.from("user_personalization_preferences").insert({ user_id: auth.user.id });
      setPreferences(DEFAULT_PERSONALIZATION);
    }
    setReady(true);
  };

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user || cancelled) return;
      channel = supabase.channel("personalization-" + data.user.id).on("postgres_changes", {
        event: "*", schema: "public", table: "user_personalization_preferences", filter: "user_id=eq." + data.user.id,
      }, (payload) => {
        if (payload.eventType === "DELETE") return;
        setPreferences((prev) => ({ ...prev, ...(payload.new as Partial<PersonalizationPreferences>) }));
      }).subscribe();
    });
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [supabase]);

  const setPreference = async (key: PersonalizationKey, value: string) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    setSaving(true);
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const { error } = await supabase.from("user_personalization_preferences").upsert({ user_id: auth.user.id, ...next }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      setPreferences(preferences);
      throw error;
    }
  };

  return <Context.Provider value={{ preferences, ready, saving, setPreference, refresh }}>{children}</Context.Provider>;
}

export function usePersonalization() {
  const value = useContext(Context);
  if (!value) throw new Error("usePersonalization must be used inside PersonalizationProvider");
  return value;
}
