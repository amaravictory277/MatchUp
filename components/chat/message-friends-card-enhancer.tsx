"use client";

import { useEffect } from "react";

export function MessageFriendsCardEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== "/message-friends") return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("button,a,input,textarea,select")) return;

      let node: HTMLElement | null = target;
      while (node && node.tagName !== "MAIN") {
        const messageButton = Array.from(node.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent?.trim() === "Message");
        if (messageButton && !messageButton.disabled) {
          event.preventDefault();
          messageButton.click();
          return;
        }
        node = node.parentElement;
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
