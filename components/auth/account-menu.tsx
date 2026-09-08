"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { clearAuthSession } from "../../lib/auth/session";

export function AccountMenu() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) setUser(data.session?.user ?? null);
    };

    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (!session) setOpen(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      let serverError: unknown = null;

      try {
        await clearAuthSession();
      } catch (logoutError) {
        serverError = logoutError;
      }

      if (signOutError) throw signOutError;
      if (serverError) throw serverError;

      setUser(null);
      setOpen(false);
      router.replace("/");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <div className="relative">
        <button type="button" onClick={() => router.push("/auth")} aria-label="Sign in" className="profile-avatar">
          <User size={18} />
        </button>
        {error ? <div role="alert" className="absolute right-0 top-[calc(100%+10px)] z-[80] w-64 rounded-2xl border border-[#5b2d38] bg-[#21131b] px-3 py-2 text-xs leading-5 text-[#ffb2b2] shadow-[0_18px_50px_rgba(0,0,0,.5)]">{error}</div> : null}
      </div>
    );
  }

  const displayName = user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "MatchUp player";
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); setError(null); }}
        className="profile-avatar"
      >
        {initial}<span />
      </button>

      {open ? (
        <div role="menu" aria-label="Account menu" className="absolute right-0 top-[calc(100%+10px)] z-[80] w-64 overflow-hidden rounded-2xl border border-[#302b4b] bg-[#101024] p-2 shadow-[0_18px_50px_rgba(0,0,0,.5)]">
          <div className="px-3 py-3">
            <p className="truncate text-sm font-black text-white">{displayName}</p>
            {user.email ? <p className="mt-0.5 truncate text-xs text-[#858196]">{user.email}</p> : null}
          </div>
          <div className="my-1 h-px bg-[#292743]" />
          {error ? <p role="alert" className="px-3 py-2 text-xs leading-5 text-[#ff9b9b]">{error}</p> : null}
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-black text-[#f0dede] transition hover:bg-[#21182a] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />
            <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
