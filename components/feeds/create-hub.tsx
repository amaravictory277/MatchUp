"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Video } from "lucide-react";
import { feedActions, type FeedAction } from "./data";

export function CreateHub({ onAction }: { onAction: (action: FeedAction) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="surface-card mt-5 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#194b7c] bg-[linear-gradient(145deg,#126bc0,#2497ff)] text-white shadow-[0_0_18px_rgba(36,151,255,.35)]"><Plus size={26} /></span>
        <span className="flex-1"><span className="block text-lg font-bold text-white">Create something</span><span className="block text-xs leading-5 text-[#86a1bb]">Share, compete, and be part of the community.</span></span>
        {open ? <ChevronUp size={20} className="text-[#86a1bb]" /> : <ChevronDown size={20} className="text-[#86a1bb]" />}
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={() => onAction(feedActions[1])} className="hero-button flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white"><Video size={20} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">Post squad / gameplay</span><span className="block truncate text-xs text-white/75">Share your squad or gameplay with the community.</span></span>
            <ChevronRight size={18} className="shrink-0 text-white/80" />
          </button>

          <div className="space-y-3">
            {feedActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.id} type="button" onClick={() => onAction(action)} className="tournament-card flex w-full items-center gap-3 p-4 text-left transition hover:border-[#2497ff] hover:bg-[#0a2139]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#194b7c] bg-[#0b3154] text-[#70c1ff]"><Icon size={21} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{action.title}</span><span className="block text-xs text-[#86a1bb]">{action.subtitle}</span></span>
                  <ChevronRight size={18} className="shrink-0 text-[#7892ac]" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}