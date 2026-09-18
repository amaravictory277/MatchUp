"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

type ThemePreference = "light" | "dark" | "system";
type ThemeContextValue = { theme: ThemePreference; setTheme: (theme: ThemePreference) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: ThemePreference) {
  if (theme !== "system") return theme;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [theme, setThemeState] = useState<ThemePreference>("dark");

  const applyTheme = useCallback((value: ThemePreference) => {
    document.documentElement.dataset.theme = resolveTheme(value);
    document.documentElement.dataset.themePreference = value;
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("matchup-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
      applyTheme(stored);
    } else {
      applyTheme("dark");
    }

    const onSystemTheme = () => {
      if ((window.localStorage.getItem("matchup-theme") || "dark") === "system") {
        applyTheme("system");
      }
    };
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener?.("change", onSystemTheme);
    return () => media.removeEventListener?.("change", onSystemTheme);
  }, [applyTheme]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      const { data: profile } = await supabase.from("profiles").select("theme_preference").eq("id", data.user.id).maybeSingle();
      if (!active) return;
      const value = profile?.theme_preference;
      if (value === "light" || value === "dark" || value === "system") {
        setThemeState(value);
        window.localStorage.setItem("matchup-theme", value);
        applyTheme(value);
      }
    };
    void load();
    return () => { active = false; };
  }, [applyTheme, supabase]);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemeState(value);
    window.localStorage.setItem("matchup-theme", value);
    applyTheme(value);
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      await supabase.from("profiles").update({ theme_preference: value }).eq("id", data.user.id);
    });
  }, [applyTheme, supabase]);

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
