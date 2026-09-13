"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MoreVertical } from "lucide-react";

const ACTION_LABELS = /^(Search messages|Mute chat|Unmute chat|Group invitations|Group settings)$/;

type OriginalAction = {
  button: HTMLButtonElement;
  label: string;
};

export function ChatHeaderActionsEnhancer() {
  useEffect(() => {
    let menuRoot: Root | null = null;
    let menuButton: HTMLButtonElement | null = null;
    let options: HTMLElement | null = null;
    let originalActions: OriginalAction[] = [];
    let applied = false;

    const cleanup = () => {
      options?.remove();
      options = null;
      menuRoot?.unmount();
      menuRoot = null;
      menuButton?.remove();
      menuButton = null;
      originalActions = [];
      applied = false;
    };

    const apply = () => {
      const header = document.querySelector<HTMLElement>(".matchup-chat-header");
      if (!header) return;
      if (applied && header.querySelector(".matchup-menu-extra")) return;

      const candidates = [...header.querySelectorAll<HTMLButtonElement>("button")].filter((button) =>
        ACTION_LABELS.test(button.getAttribute("aria-label") || ""),
      );
      if (!candidates.length) return;

      const actionParent = candidates[0].parentElement;
      if (!actionParent) return;

      originalActions = candidates.map((button) => ({
        button,
        label: button.getAttribute("aria-label") || "Action",
      }));

      const insertionPoint = candidates[0];
      candidates.forEach((button) => button.remove());

      menuButton = document.createElement("button");
      menuButton.type = "button";
      menuButton.className = "icon-button matchup-menu-extra";
      menuButton.setAttribute("aria-label", "Chat options");
      menuButton.title = "Chat options";
      actionParent.insertBefore(menuButton, insertionPoint.nextSibling);
      menuRoot = createRoot(menuButton);
      menuRoot.render(<MoreVertical size={19} aria-hidden="true" />);
      applied = true;

      menuButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (options) {
          options.remove();
          options = null;
          return;
        }

        options = document.createElement("div");
        options.className = "matchup-chat-options";
        options.setAttribute("role", "menu");
        const available = originalActions.filter(({ button }) => button);
        const rows = [
          ["Search messages", "Search messages"],
          ["Mute chat", "Mute chat"],
          ["Group invitations", "Group invitations"],
          ["Group settings", "Group settings"],
        ] as const;

        rows.forEach(([label, text]) => {
          const action = available.find(({ label: originalLabel }) =>
            originalLabel.toLowerCase() === label.toLowerCase() ||
            (label === "Mute chat" && /mute chat|unmute chat/i.test(originalLabel)),
          );
          if (!action) return;
          const item = document.createElement("button");
          item.type = "button";
          item.setAttribute("role", "menuitem");
          item.textContent = text;
          item.addEventListener("click", () => {
            action.button.click();
            options?.remove();
            options = null;
          });
          options!.appendChild(item);
        });

        if (!options.childElementCount) {
          options.remove();
          options = null;
          return;
        }
        header.appendChild(options);
      });
    };

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-label"] });
    apply();

    return () => {
      observer.disconnect();
      cleanup();
    };
  }, []);

  return null;
}
