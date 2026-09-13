"use client";

import type { ReactNode } from "react";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type SectionCardEntry = {
  id: string;
  label: string;
  secondary?: string | null;
  profile?: {
    id?: string;
    display_name?: string | null;
    username?: string | null;
    avatar_path?: string | null;
  } | null;
  group?: boolean;
  onClick?: () => void;
};

type SectionCardProps = {
  entries: SectionCardEntry[];
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  emptyText: string;
  footer?: ReactNode;
};

export function SectionCard({
  entries,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  emptyText,
  footer,
}: SectionCardProps) {
  return (
    <div className="w-full rounded-2xl border border-[#214a78] bg-[#071426] p-3 shadow-[0_12px_30px_rgba(0,35,75,.16)] sm:p-4">
      <div className="space-y-1">
        {entries.length ? (
          entries.slice(0, 2).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={entry.onClick}
              className="flex min-w-0 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#0b223c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47a8ff]"
            >
              <MatchUpAvatar profile={entry.profile} size="sm" group={entry.group} alt={entry.label} className="size-9 rounded-full" />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-bold text-white">{entry.label}</strong>
                {entry.secondary ? <span className="block truncate text-[10px] text-[#7892ac]">{entry.secondary}</span> : null}
              </span>
            </button>
          ))
        ) : (
          <p className="px-2 py-3 text-xs text-[#7892ac]">{emptyText}</p>
        )}
      </div>

      <p className="px-2 pb-2 pt-1 text-[11px] leading-5 text-[#7892ac]">{description}</p>
      {footer}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#18365f] pt-3">
        <button
          type="button"
          onClick={onPrimary}
          className="min-w-0 rounded-xl bg-[#126bc0] px-2.5 py-2.5 text-center text-[11px] font-black text-white transition hover:bg-[#167bd1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70c1ff]"
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="min-w-0 rounded-xl border border-[#214a78] bg-[#0a1d32] px-2.5 py-2.5 text-center text-[11px] font-black text-[#9bd3ff] transition hover:bg-[#0b2946] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70c1ff]"
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}
