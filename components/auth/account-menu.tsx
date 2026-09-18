"use client";

import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function AccountMenu() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) setUser(data.session?.user ?? null);
    };

    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // The account/profile icon is a direct navigation control.
  // It intentionally has no dropdown, popover, or account overlay.
  return (
    <button
      type="button"
      aria-label={user ? "Open Profile" : "Sign in"}
      onClick={() => router.push(user ? "/profile" : "/auth")}
      className="profile-avatar"
    >
      {user ? (
        <span className="font-black text-sm">
          {(user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "M").trim().charAt(0).toUpperCase() || "M"}
        </span>
      ) : (
        <User size={18} />
      )}
      {user ? <span /> : null}
    </button>
  );
}
