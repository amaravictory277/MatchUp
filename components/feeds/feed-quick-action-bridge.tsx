"use client";

import { useEffect } from "react";

const ALLOWED = new Set(["post-squad", "upload-gameplay", "normal-post"]);

export function FeedQuickActionBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") !== "post") return;
    const action = params.get("action");
    if (!action || !ALLOWED.has(action)) return;
    window.history.replaceState(null, "", "/feeds");
    const open = () => {
      const trigger = document.querySelector<HTMLButtonElement>("[data-feed-create='true']");
      if (!trigger) return false;
      if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
      return true;
    };
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (open()) {
        window.clearInterval(timer);
        window.setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-feed-action='${action}']`)?.click(), 60);
      } else if (attempts > 40) {
        window.clearInterval(timer);
      }
    }, 25);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
