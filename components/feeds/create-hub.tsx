"use client";

import { Camera, MessageSquareText, Plus } from "lucide-react";
import { feedActions, type FeedAction } from "./data";

export function CreateHub({ onAction }: { onAction: (action: FeedAction) => void }) {
  const mediaAction = feedActions.find((action) => action.id === "post-squad")!;
  const normalAction = feedActions.find((action) => action.id === "normal-post")!;
  return (
    <section className="surface-card mt-4 border-[#153c68] p-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onAction(mediaAction)} className="hero-button flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white"><Camera size={18} /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-black text-white">Post squad / gameplay</span>
        </button>
        <button type="button" onClick={() => onAction(normalAction)} className="flex min-w-0 items-center gap-2 rounded-2xl border border-[#1b4b7d] bg-[#071426] px-3 py-2.5 text-left transition hover:border-[#2497ff]">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#0b3154] text-[#70c1ff]"><MessageSquareText size={17} /></span>
          <span className="max-w-[9rem] truncate text-xs font-black text-white">Make Normal Post</span>
        </button>
        <button type="button" onClick={() => onAction(mediaAction)} aria-label="Create post" className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#1b4b7d] bg-[#0b3154] text-[#70c1ff] transition hover:border-[#2497ff]">
          <Plus size={18} />
        </button>
      </div>
    </section>
  );
}
