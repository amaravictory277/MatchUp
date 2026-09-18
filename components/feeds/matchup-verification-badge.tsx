"use client";

import { Check } from "lucide-react";

export function MatchUpVerificationBadge() {
  return (
    <span
      aria-label="Verified MatchUp account"
      title="Verified MatchUp account"
      className="inline-grid size-[15px] shrink-0 place-items-center rounded-full border border-[#70c1ff]/60 bg-[#167bd1] text-white shadow-[0_0_8px_rgba(36,151,255,.28)]"
    >
      <Check size={9} strokeWidth={3.5} />
    </span>
  );
}
