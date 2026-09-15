"use client";

import { useEffect } from "react";

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

function activeKey(chat: HTMLElement) {
  const title = chat.querySelector<HTMLElement>(".matchup-chat-header h1")?.textContent?.trim() || "General";
  return `${window.location.pathname}:${title}`;
}

export function ChatVisualEnhancer() {
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
    let restoringOlder = false;
    let previousHeight = body.scrollHeight;
    let previousTop = body.scrollTop;
    let lastScrollTop = body.scrollTop;

    const atBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 72;
    const wasAtBottom = () => previousHeight - previousTop - body.clientHeight < 72;

    const markRelativeTimes = () => {
      chat.querySelectorAll<HTMLElement>("[data-message-id]").forEach((row) => {
        const time = row.querySelector<HTMLElement>("span.text-\\[9px\\]")?.textContent?.trim();
        if (time) row.dataset.chatTime = time;
        const title = row.querySelector<HTMLElement>("[title]")?.getAttribute("title");
        if (!title) return;
        const date = new Date(title);
        if (!Number.isNaN(date.getTime())) {
          row.dataset.chatRelative = relative(date);
          row.dataset.chatDate = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        }
      });
    };

    const setKeyboardSafeComposer = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const rect = chat.getBoundingClientRect();
      const viewportBottom = vv.offsetTop + vv.height;
      const keyboard = Math.max(0, window.innerHeight - viewportBottom);
      const left = Math.max(0, rect.left);
      const right = Math.max(0, window.innerWidth - rect.right);

      composer.style.position = "fixed";
      composer.style.left = `${left}px`;
      composer.style.right = `${right}px`;
      composer.style.bottom = `${keyboard}px`;
      composer.style.width = `${Math.max(0, rect.width)}px`;
      composer.style.zIndex = "40";

      const composerHeight = composer.getBoundingClientRect().height;
      body.style.paddingBottom = `${composerHeight + 20}px`;
      chat.style.setProperty("--matchup-keyboard-height", `${keyboard}px`);
    };

    const restoreSavedPosition = () => {
      try {
        const raw = sessionStorage.getItem(`${SCROLL_KEY}${activeKey(chat)}`);
        if (!raw) return false;
        const value = Number(raw);
        if (!Number.isFinite(value)) return false;
        body.scrollTop = Math.min(value, Math.max(0, body.scrollHeight - body.clientHeight));
        lastScrollTop = body.scrollTop;
        previousTop = body.scrollTop;
        return true;
      } catch {
        return false;
      }
    };

    const savePosition = () => {
      try {
        sessionStorage.setItem(`${SCROLL_KEY}${activeKey(chat)}`, String(body.scrollTop));
      } catch {
        // Storage is optional; chat remains functional without it.
      }
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
      indicator.innerHTML = '<span data-matchup-new-count></span><button type="button">Scroll to bottom <span aria-hidden="true">↓</span></button>';
      const button = indicator.querySelector("button");
      button?.addEventListener("click", () => {
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

    const onScroll = () => {
      const current = body.scrollTop;
      if (header) {
        if (current <= 4 || current < lastScrollTop - 1) {
          header.style.maxHeight = "120px";
          header.style.transform = "translateY(0)";
          header.style.opacity = "1";
          header.style.pointerEvents = "auto";
        } else if (current > lastScrollTop + 1) {
          header.style.maxHeight = "0px";
          header.style.transform = "translateY(-100%)";
          header.style.opacity = "0";
          header.style.pointerEvents = "none";
        }
      }
      const nearTop = current < 120;
      if (nearTop && !restoringOlder) {
        const loader = body.querySelector<HTMLButtonElement>("[data-matchup-older-loader]");
        if (loader && !loader.disabled) {
          restoringOlder = true;
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
      lastScrollTop = current;
      previousTop = current;
      previousHeight = body.scrollHeight;
      savePosition();
    };

    const onViewport = () => {
      cancelAnimationFrame(keyboardFrame);
      keyboardFrame = requestAnimationFrame(setKeyboardSafeComposer);
    };

    const initialApply = () => {
      removeOlderButton();
      markRelativeTimes();
      setKeyboardSafeComposer();
      const ids = new Set(Array.from(body.querySelectorAll<HTMLElement>("[data-message-id]")).map((el) => el.dataset.messageId || ""));
      previousIds = ids;
      restoreTimer = window.setTimeout(() => {
        restoreSavedPosition();
        removeOlderButton();
        setKeyboardSafeComposer();
      }, 120);
    };

    body.addEventListener("scroll", onScroll, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    window.addEventListener("resize", onViewport);

    const observer = new MutationObserver(() => {
      removeOlderButton();
      markRelativeTimes();
      setKeyboardSafeComposer();

      if (restoringOlder) {
        const delta = body.scrollHeight - previousHeight;
        body.scrollTop = previousTop + delta;
        lastScrollTop = body.scrollTop;
        restoringOlder = false;
        previousHeight = body.scrollHeight;
        previousTop = body.scrollTop;
        return;
      }

      const currentIds = new Set(Array.from(body.querySelectorAll<HTMLElement>("[data-message-id]")).map((el) => el.dataset.messageId || ""));
      const added = [...currentIds].filter((id) => id && !previousIds.has(id));
      if (added.length) {
        const stayedUp = !wasAtBottom();
        if (stayedUp) {
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
      lastScrollTop = body.scrollTop;
    });
    observer.observe(body, { childList: true, subtree: true });

    if (header) {
      header.style.position = "sticky";
      header.style.top = "0";
      header.style.zIndex = "50";
      header.style.maxHeight = "120px";
      header.style.transform = "translateY(0)";
      header.style.opacity = "1";
    }

    initialApply();
    return () => {
      window.clearTimeout(restoreTimer);
      cancelAnimationFrame(keyboardFrame);
      body.removeEventListener("scroll", onScroll);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      window.removeEventListener("resize", onViewport);
      observer.disconnect();
    };
  }, []);

  return null;
}
