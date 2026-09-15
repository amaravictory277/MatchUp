"use client";
import { useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function PrivateHeaderEnhancer() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".matchup-chat");
    if (!root) return;
    const header = root.querySelector<HTMLElement>(".matchup-chat-header");
    if (!header) return;

    let restore: HTMLButtonElement | null = null;
    let syncToken = "";

    const applyBackButton = () => {
      const privateChat = header.querySelector("p")?.textContent?.trim() === "Private message";
      const button = header.querySelector<HTMLButtonElement>("button");
      if (!button) return;
      if (privateChat) {
        if (!restore) restore = button;
        button.setAttribute("aria-label", "Back to messaging");
        button.title = "Back to messaging";
        button.dataset.privateBack = "true";
        button.innerHTML = '<span aria-hidden="true" style="font-size:20px;line-height:1">←</span>';
      } else if (button.dataset.privateBack) {
        button.setAttribute("aria-label", "Open chats and groups");
        button.title = "";
        button.removeAttribute("data-private-back");
        restore = null;
      }
    };

    const syncPrivateName = async () => {
      const groupId = new URLSearchParams(window.location.search).get("group");
      if (!groupId || syncToken === groupId) return;
      const { data: group } = await supabase.from("chat_groups").select("id,kind").eq("id", groupId).maybeSingle();
      if (!group || group.kind !== "private") return;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: rows } = await supabase
        .from("chat_group_members")
        .select("user_id,profiles(id,display_name,username)")
        .eq("group_id", groupId)
        .limit(2);
      const opponent = ((rows || []) as any[])
        .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
        .find((p: any) => p && p.id !== auth.user.id);
      if (!opponent) return;
      const title = header.querySelector<HTMLElement>("h1");
      if (!title) return;
      title.textContent = opponent.display_name || opponent.username || "MatchUp Player";
      title.dataset.privateDisplayName = opponent.id;
      syncToken = groupId;
      applyBackButton();
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("button[data-private-back]");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.history.length > 1) window.history.back();
      else window.location.assign("/message-friends?tab=friends");
    };

    header.addEventListener("click", onClick, true);
    const observer = new MutationObserver(() => {
      applyBackButton();
      void syncPrivateName();
    });
    observer.observe(header, { childList: true, subtree: true, characterData: true });
    applyBackButton();
    void syncPrivateName();

    return () => {
      header.removeEventListener("click", onClick, true);
      observer.disconnect();
    };
  }, [supabase]);

  return null;
}
