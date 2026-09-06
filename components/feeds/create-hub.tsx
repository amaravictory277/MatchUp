"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, FilePlus2, Video } from "lucide-react";
import { feedActions, type FeedAction } from "./data";

export function CreateHub({ onAction }: { onAction: (action: FeedAction) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="surface-card mt-5 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 text-left"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#25134e] text-[#a979ff]">
          <FilePlus2 size={24} />
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold text-white">Create something</span>
          <span className="block text-xs leading-5 text-[#9694aa]">
            Share, compete, and be part of the community.
          </span>
        </span>
        {open ? (
          <ChevronUp size={20} className="text-[#9694aa]" />
        ) : (
          <ChevronDown size={20} className="text-[#9694aa]" />
        )}
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => onAction(feedActions[1])}
            className="hero-button flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
              <Video size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-white">
                Post a squad / Upload gameplay
              </span>
              <span className="block text-xs text-white/75">
                Show your skills, get noticed, and earn.
              </span>
            </span>
            <ChevronRight size={18} className="text-white/80" />
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            {feedActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onAction(action)}
                  className="tournament-card flex items-center gap-3 p-3 text-left"
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${action.tile}`}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-tight text-white">
                      {action.title}
                    </span>
                    <span className="block text-[11px] text-[#9694aa]">{action.subtitle}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#6f6d83]" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
