"use client";

import { useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dayLabel(value: Date) {
  const now = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const delta = Math.round((start(now) - start(value)) / 86400000);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  return value.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function ChatMetadataEnhancer() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    const chat = document.querySelector<HTMLElement>(".matchup-chat");
    const body = chat?.querySelector<HTMLElement>(".matchup-chat-body");
    if (!body) return;

    let timer = 0;
    let dead = false;

    const render = async () => {
      const rows = Array.from(body.querySelectorAll<HTMLElement>("[data-message-id]"));
      const ids = rows.map((row) => row.dataset.messageId || "").filter((id) => UUID_RE.test(id));
      if (!ids.length) return;

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || dead) return;
      const { data: messages } = await supabase.from("chat_messages").select("id,sender_id,created_at").in("id", ids);
      if (!messages?.length || dead) return;

      const byId = new Map((messages as any[]).map((m) => [m.id, m]));
      let previousDay = "";
      for (const row of rows) {
        const message = byId.get(row.dataset.messageId || "");
        if (!message) continue;
        const day = new Date(message.created_at).toDateString();
        if (day === previousDay) continue;
        previousDay = day;
        const previous = row.previousElementSibling as HTMLElement | null;
        if (previous?.dataset.matchupDateSeparator === "true") continue;
        const separator = document.createElement("div");
        separator.dataset.matchupDateSeparator = "true";
        separator.className = "matchup-chat-date-separator";
        const left = document.createElement("span");
        const label = document.createElement("strong");
        const right = document.createElement("span");
        label.textContent = dayLabel(new Date(message.created_at));
        separator.append(left, label, right);
        row.parentElement?.insertBefore(separator, row);
      }

      const groupId = new URLSearchParams(window.location.search).get("group");
      if (!groupId) return;
      const { data: group } = await supabase.from("chat_groups").select("kind").eq("id", groupId).maybeSingle();
      if (group?.kind !== "group") return;

      const outgoingIds = (messages as any[]).filter((m) => m.sender_id === auth.user.id).map((m) => m.id);
      if (!outgoingIds.length) return;
      const { data: reads } = await supabase.from("chat_message_reads").select("message_id,user_id").in("message_id", outgoingIds).neq("user_id", auth.user.id);
      const seen = new Map<string, Set<string>>();
      for (const read of (reads || []) as any[]) {
        if (!seen.has(read.message_id)) seen.set(read.message_id, new Set());
        seen.get(read.message_id)!.add(read.user_id);
      }

      for (const row of rows) {
        const id = row.dataset.messageId || "";
        if (!outgoingIds.includes(id)) continue;
        const count = seen.get(id)?.size || 0;
        const existing = row.querySelector<HTMLElement>("[data-matchup-seen-by]");
        if (!count) {
          if (existing) existing.remove();
          continue;
        }
        const note = existing || document.createElement("div");
        note.dataset.matchupSeenBy = "true";
        note.className = "matchup-chat-seen-by";
        note.textContent = `Seen by ${count} ${count === 1 ? "person" : "people"}`;
        if (!existing) row.querySelector("div.flex.max-w-\\[84\\%\\]")?.appendChild(note);
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void render(), 80);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(body, { childList: true, subtree: true });
    schedule();

    return () => {
      dead = true;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [supabase]);

  return null;
}
