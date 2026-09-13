"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SectionCard } from "./section-card";

type SidebarEntry = {
  label: string;
  secondary?: string | null;
  source?: HTMLElement;
  group?: boolean;
};

type MountedRoot = { mount: HTMLElement; root: Root };

function exactHeading(drawer: HTMLElement, label: string) {
  return [...drawer.querySelectorAll<HTMLElement>("p,h2,h3,h4,div,span")].find(
    (el) => el.children.length === 0 && (el.textContent || "").trim().toUpperCase() === label,
  ) || null;
}

function sectionLines(drawer: HTMLElement, label: string, nextLabel?: string) {
  const text = (drawer.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const start = text.findIndex((x) => x.toUpperCase() === label);
  if (start < 0) return [];
  const end = nextLabel
    ? text.findIndex((x, index) => index > start && x.toUpperCase() === nextLabel)
    : text.length;
  return text.slice(start + 1, end < 0 ? text.length : end);
}

function entriesFromLines(drawer: HTMLElement, lines: string[], excluded: string[], group = false): SidebarEntry[] {
  const clean = lines.filter(
    (value) =>
      !excluded.some((item) => item.toLowerCase() === value.toLowerCase()) &&
      value.length > 1 &&
      !/^@/.test(value) &&
      !/^\d+(\s|$)/.test(value),
  );

  return [...new Set(clean)].slice(0, 2).map((label) => {
    const source = [...drawer.querySelectorAll<HTMLElement>("button,a,[role='button'],div,span")].find(
      (el) => (el.textContent || "").trim() === label,
    );
    return { label, source, group };
  });
}

function removeSiblingsUntil(start: Element, end: Element | null) {
  let node = start.nextElementSibling;
  while (node && node !== end) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
}

function removeSiblingsAfter(start: Element) {
  let node = start.nextElementSibling;
  while (node) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
}

function runSource(source: HTMLElement | undefined, fallbackHref: string) {
  if (source) {
    source.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return;
  }
  window.location.assign(fallbackHref);
}

export function ChatSidebarSectionCards() {
  const roots = useRef<MountedRoot[]>([]);

  useEffect(() => {
    let queued = false;
    let internalMutation = false;

    const clear = () => {
      roots.current.forEach(({ mount, root }) => {
        root.unmount();
        mount.remove();
      });
      roots.current = [];
    };

    const renderCard = (mount: HTMLElement, element: ReactElement) => {
      const root = createRoot(mount);
      root.render(element);
      roots.current.push({ mount, root });
    };

    const apply = () => {
      if (queued || internalMutation) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        internalMutation = true;
        const drawer = document.querySelector<HTMLElement>(".matchup-chat aside");
        if (!drawer) {
          internalMutation = false;
          return;
        }

        clear();

        const messageHeading = exactHeading(drawer, "MESSAGE FRIENDS");
        const privateHeading = exactHeading(drawer, "PRIVATE CHATS");
        const groupsHeading = exactHeading(drawer, "MY GROUPS");

        if (messageHeading) {
          const lines = sectionLines(drawer, "MESSAGE FRIENDS", "PRIVATE CHATS");
          const entries = entriesFromLines(drawer, lines, [
            "General",
            "Global MatchUp chat",
            "Create Group",
            "View Groups",
            "Message Friends",
            "Add Friends",
          ]);

          const mount = document.createElement("div");
          mount.className = "matchup-sidebar-card-mount";
          messageHeading.parentElement?.insertBefore(mount, messageHeading.nextSibling || null);
          removeSiblingsUntil(messageHeading, privateHeading);

          renderCard(
            mount,
            <SectionCard
              entries={entries.map((entry) => ({
                id: entry.label,
                label: entry.label,
                secondary: entry.secondary,
                profile: { display_name: entry.label },
                onClick: () => runSource(entry.source, "/message-friends?tab=friends"),
              }))}
              description="Connect with your friends and start a conversation."
              primaryLabel="Message Friends"
              secondaryLabel="Add Friends"
              onPrimary={() => window.location.assign("/message-friends?tab=friends")}
              onSecondary={() => window.location.assign("/friends")}
              emptyText="No friends available yet."
            />,
          );
        }

        if (privateHeading) {
          removeSiblingsUntil(privateHeading, groupsHeading);
          privateHeading.remove();
        }

        if (groupsHeading) {
          const header = groupsHeading.parentElement;
          if (header) {
            const lines = sectionLines(drawer, "MY GROUPS");
            const entries = entriesFromLines(drawer, lines, [
              "Create Group",
              "View Groups",
              "Message Friends",
              "Add Friends",
              "MESSAGE FRIENDS",
              "PRIVATE CHATS",
            ], true);

            header.querySelectorAll("button").forEach((button) => button.remove());
            const mount = document.createElement("div");
            mount.className = "matchup-sidebar-card-mount";
            header.parentElement?.insertBefore(mount, header.nextSibling || null);
            removeSiblingsAfter(header);

            renderCard(
              mount,
              <SectionCard
                entries={entries.map((entry) => ({
                  id: entry.label,
                  label: entry.label,
                  secondary: entry.secondary,
                  profile: { id: entry.label, display_name: entry.label },
                  group: true,
                  onClick: () => runSource(entry.source, "/groups"),
                }))}
                description="Keep your groups close and jump back into the conversations that matter."
                primaryLabel="View Groups"
                secondaryLabel="Create Group"
                onPrimary={() => window.location.assign("/groups")}
                onSecondary={() => window.location.assign("/leaderboard?create=group")}
                emptyText="No groups yet."
              />,
            );
          }
        }

        window.requestAnimationFrame(() => {
          internalMutation = false;
        });
      });
    };

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { subtree: true, childList: true });
    apply();
    return () => {
      observer.disconnect();
      clear();
    };
  }, []);

  return null;
}
