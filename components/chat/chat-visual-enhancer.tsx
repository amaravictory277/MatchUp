"use client";

import { useEffect, useMemo } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

const SCROLL_KEY = "matchup:chat-scroll:";

function relative(value: Date) {
  const mins = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function dayLabel(value: Date) {
  const now = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const delta = Math.round((start(now) - start(value)) / 86400000);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  return value.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function activeKey() {
  const group = new URLSearchParams(window.location.search).get("group");
  return `${window.location.pathname}:${group || "general"}`;
}

export function ChatVisualEnhancer() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    const chat = document.querySelector<HTMLElement>(".matchup-chat");
    if (!chat) return;

    const header = chat.querySelector<HTMLElement>(".matchup-chat-header");
    const body = chat.querySelector<HTMLElement>(".matchup-chat-body");
    const composer = chat.querySelector<HTMLElement>(".matchup-chat-composer");
    if (!body || !composer) return;

    let restoreTimer = 0;
    let keyboardFrame = 0;
    let previousIds = new Set<string>();
    let newMessageCount = 0;
    let loadingOlder = false;
    let previousHeight = body.scrollHeight;
    let previousTop = body.scrollTop;
    let restoringPosition = false;
    let metadataTimer = 0;

    const readSavedPosition = () => {
      try {
        const raw = sessionStorage.getItem(`${SCROLL_KEY}${activeKey()}`);
        if (!raw) return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
      } catch {
        return null;
      }
    };

    const savePosition = () => {
      if (restoringPosition) return;
      try {
        sessionStorage.setItem(`${SCROLL_KEY}${activeKey()}`, String(body.scrollTop));
      } catch {
        // Scroll restoration is optional UI state, not chat data.
      }
    };

    const restoreSavedPosition = () => {
      const value = readSavedPosition();
      if (value === null) return false;
      restoringPosition = true;
      body.scrollTop = Math.min(value, Math.max(0, body.scrollHeight - body.clientHeight));
      previousTop = body.scrollTop;
      window.requestAnimationFrame(() => {
        restoringPosition = false;
        savePosition();
      });
      return true;
    };

    const syncMatchHeader = async () => {
      const groupId = new URLSearchParams(window.location.search).get("group");
      const title = header?.querySelector<HTMLElement>("h1");
      if (!header || !title || !groupId || title.dataset.matchupMatchHeader === groupId) return;

      const { data: group } = await supabase
        .from("chat_groups")
        .select("id,kind")
        .eq("id", groupId)
        .maybeSingle();
      if (!group || group.kind !== "match") return;

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: rows } = await supabase
        .from("chat_group_members")
        .select("user_id,profiles(id,display_name,username)")
        .eq("group_id", groupId)
        .limit(2);
      const people = ((rows || []) as any[])
        .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
        .filter(Boolean);
      const me = people.find((p: any) => p.id === auth.user.id);
      const opponent = people.find((p: any) => p.id !== auth.user.id);
      if (!me || !opponent) return;

      title.replaceChildren();
      const mine = document.createElement("span");
      mine.textContent = me.display_name || me.username || "You";
      mine.className = "block truncate";
      const other = document.createElement("span");
      other.textContent = opponent.display_name || opponent.username || "Opponent";
      other.className = "mt-0.5 block truncate text-[10px] font-bold text-[#70c1ff]";
      title.append(mine, other);
      title.dataset.matchupMatchHeader = groupId;
      const subtitle = title.parentElement?.querySelector<HTMLElement>("p");
      if (subtitle) subtitle.textContent = "1-v-1 Match Chat";
    };

    const removeOlderButton = () => {
      const button = Array.from(body.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.trim() === "Load older messages" || b.textContent?.trim() === "Loading…",
      );
      if (button) {
        button.dataset.matchupOlderLoader = "true";
        button.style.display = "none";
      }
    };

    const ensureNewMessageIndicator = () => {
      let indicator = body.querySelector<HTMLElement>("[data-matchup-new-messages]");
      if (indicator) return indicator;
      indicator = document.createElement("div");
      indicator.dataset.matchupNewMessages = "true";
      indicator.className = "matchup-new-messages-indicator";
      indicator.innerHTML =
        '<span data-matchup-new-count></span><button type="button">Scroll to newest <span aria-hidden="true">↓</span></button>';
      indicator.querySelector("button")?.addEventListener("click", () => {
        body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
        newMessageCount = 0;
        indicator!.hidden = true;
        window.setTimeout(savePosition, 300);
      });
      body.appendChild(indicator);
      return indicator;
    };

    const updateIndicator = () => {
      const indicator = ensureNewMessageIndicator();
      const count = indicator.querySelector<HTMLElement>("[data-matchup-new-count]");
      if (count) count.textContent = `${newMessageCount} new message${newMessageCount === 1 ? "" : "s"}`;
      indicator.hidden = newMessageCount === 0;
    };

    const renderMessageMetadata = async () => {
      const rows = Array.from(body.querySelectorAll<HTMLElement>("[data-message-id]"));
      if (!rows.length) return;
      const ids = rows.map((row) => row.dataset.messageId || "").filter(Boolean);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("id,sender_id,created_at")
        .in("id", ids);
      if (!messages?.length) return;

      const byId = new Map((messages as any[]).map((m) => [m.id, m]));
      body.querySelectorAll("[data-matchup-date-separator]").forEach((node) => node.remove());
      let previousDay = "";
      rows.forEach((row) => {
        const message = byId.get(row.dataset.messageId || "");
        if (!message) return;
        const day = new Date(message.created_at).toDateString();
        if (day !== previousDay) {
          const separator = document.createElement("div");
          separator.dataset.matchupDateSeparator = "true";
          separator.className = "matchup-chat-date-separator";
          separator.innerHTML = `<span aria-hidden="true"></span><strong>${dayLabel(new Date(message.created_at))}</strong><span aria-hidden="true"></span>`;
          row.parentElement?.insertBefore(separator, row);
          previousDay = day;
        }
      });

      const groupId = new URLSearchParams(window.location.search).get("group");
      if (!groupId) return;
      const { data: group } = await supabase.from("chat_groups").select("kind").eq("id", groupId).maybeSingle();
      if (group?.kind !== "group") return;

      const outgoingIds = (messages as any[])
        .filter((m) => m.sender_id === auth.user.id)
        .map((m) => m.id);
      if (!outgoingIds.length) return;
      const { data: reads } = await supabase
        .from("chat_message_reads")
        .select("message_id,user_id")
        .in("message_id", outgoingIds)
        .neq("user_id", auth.user.id);
      const seen = new Map<string, Set<string>>();
      for (const read of (reads || []) as any[]) {
        if (!seen.has(read.message_id)) seen.set(read.message_id, new Set());
        seen.get(read.message_id)!.add(read.user_id);
      }
      rows.forEach((row) => {
        const id = row.dataset.messageId || "";
        if (!outgoingIds.includes(id)) return;
        row.querySelectorAll("[data-matchup-seen-by]").forEach((node) => node.remove());
        const count = seen.get(id)?.size || 0;
        if (!count) return;
        const note = document.createElement("div");
        note.dataset.matchupSeenBy = "true";
        note.className = "matchup-chat-seen-by";
        note.textContent = `Seen by ${count} ${count === 1 ? "person" : "people"}`;
        row.querySelector("div.flex.max-w-\\[84\\%\\]")?.appendChild(note);
      });
    };

    const setKeyboardSafeComposer = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const rect = chat.getBoundingClientRect();
      const viewportBottom = vv.offsetTop + vv.height;
      const keyboard = Math.max(0, window.innerHeight - viewportBottom);
      composer.style.position = "fixed";
      composer.style.left = `${Math.max(0, rect.left)}px`;
      composer.style.right = `${Math.max(0, window.innerWidth - rect.right)}px`;
      composer.style.bottom = `${keyboard}px`;
      composer.style.width = `${Math.max(0, rect.width)}px`;
      composer.style.transform = "none";
      composer.style.zIndex = "40";
      body.style.paddingBottom = `${composer.getBoundingClientRect().height + 24}px`;
      chat.style.setProperty("--matchup-keyboard-height", `${keyboard}px`);
    };

    const atBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 72;

    const onScroll = () => {
      if (restoringPosition) return;
      const current = body.scrollTop;
      if (current < 120 && !loadingOlder) {
        const loader = body.querySelector<HTMLButtonElement>("[data-matchup-older-loader]");
        if (loader && !loader.disabled) {
          loadingOlder = true;
          previousHeight = body.scrollHeight;
          previousTop = current;
          loader.click();
        }
      }
      if (atBottom()) {
        newMessageCount = 0;
        const indicator = body.querySelector<HTMLElement>("[data-matchup-new-messages]");
        if (indicator) indicator.hidden = true;
      }
      previousTop = current;
      previousHeight = body.scrollHeight;
      savePosition();
    };

    const onViewport = () => {
      window.cancelAnimationFrame(keyboardFrame);
      keyboardFrame = window.requestAnimationFrame(setKeyboardSafeComposer);
    };

    const content = body.querySelector<HTMLElement>(".mx-auto.max-w-3xl");
    const anchor = content?.lastElementChild as HTMLElement | null;
    const savedPosition = readSavedPosition();
    const originalScrollIntoView = anchor?.scrollIntoView;
    if (anchor && savedPosition !== null) anchor.scrollIntoView = () => undefined;

    const initialApply = () => {
      removeOlderButton();
      setKeyboardSafeComposer();
      void syncMatchHeader();
      previousIds = new Set(
        Array.from(body.querySelectorAll<HTMLElement>("[data-message-id]")).map((el) => el.dataset.messageId || ""),
      );
      if (savedPosition !== null) {
        restoreSavedPosition();
        window.setTimeout(() => {
          if (anchor && originalScrollIntoView) anchor.scrollIntoView = originalScrollIntoView;
        }, 220);
      }
      window.clearTimeout(metadataTimer);
      metadataTimer = window.setTimeout(() => void renderMessageMetadata(), 60);
    };

    body.addEventListener("scroll", onScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);

    const observer = new MutationObserver(() => {
      removeOlderButton();
      setKeyboardSafeComposer();
      void syncMatchHeader();
      window.clearTimeout(metadataTimer);
      metadataTimer = window.setTimeout(() => void renderMessageMetadata(), 50);

      if (loadingOlder) {
        const delta = body.scrollHeight - previousHeight;
        body.scrollTop = previousTop + delta;
        previousTop = body.scrollTop;
        previousHeight = body.scrollHeight;
        loadingOlder = false;
        return;
      }

      const currentIds = new Set(
        Array.from(body.querySelectorAll<HTMLElement>("[data-message-id]")).map((el) => el.dataset.messageId || ""),
      );
      const added = [...currentIds].filter((id) => id && !previousIds.has(id));
      if (added.length) {
        const wasAtBottom = body.scrollHeight - previousTop - body.clientHeight < 72;
        if (!wasAtBottom) {
          newMessageCount += added.length;
          body.scrollTop = Math.min(previousTop, Math.max(0, body.scrollHeight - body.clientHeight));
          updateIndicator();
        } else {
          newMessageCount = 0;
          const indicator = body.querySelector<HTMLElement>("[data-matchup-new-messages]");
          if (indicator) indicator.hidden = true;
        }
      }
      previousIds = currentIds;
      previousHeight = body.scrollHeight;
      previousTop = body.scrollTop;
    });
    observer.observe(body, { childList: true, subtree: true });

    initialApply();
    restoreTimer = window.setTimeout(() => {
      removeOlderButton();
      setKeyboardSafeComposer();
      if (savedPosition !== null) restoreSavedPosition();
      void renderMessageMetadata();
    }, 140);

    return () => {
      window.clearTimeout(restoreTimer);
      window.clearTimeout(metadataTimer);
      window.cancelAnimationFrame(keyboardFrame);
      body.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
      observer.disconnect();
      if (anchor && originalScrollIntoView) anchor.scrollIntoView = originalScrollIntoView;
    };
  }, [supabase]);

  return null;
}
