"use client";

import { Camera, Gamepad2, MessageSquareText, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { feedActions, type FeedAction } from "./data";

export function CreateHub({ onAction }: { onAction: (action: FeedAction) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const mediaAction = feedActions.find(a => a.id === "post-squad")!;
  const gameplayAction = feedActions.find(a => a.id === "upload-gameplay")!;
  const normalAction = feedActions.find(a => a.id === "normal-post")!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (action: FeedAction) => { setOpen(false); onAction(action); };

  return <section ref={ref} className="relative mt-3">
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-[#1b4b7d] bg-[#071426] px-3 py-2 text-left shadow-[0_8px_24px_rgba(0,35,75,.18)] transition hover:border-[#2497ff]">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#167bd1] text-white"><Plus size={17} className={open ? "rotate-45 transition-transform" : "transition-transform"} /></span>
      <span className="min-w-0 flex-1 truncate text-sm font-black text-white">Make a Post</span>
    </button>
    {open ? <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-[#194b7c] bg-[#08182b] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,.45)]">
      <button type="button" onClick={() => choose(mediaAction)} className="flex w-full items-center gap-3 rounded-xl bg-[#0a2946] px-4 py-3.5 text-left text-sm font-black text-white transition hover:bg-[#0d3a61]"><Camera size={18} className="text-[#70c1ff]" /><span>Upload Photo / Video</span></button>
      <button type="button" onClick={() => choose(gameplayAction)} className="mt-1 flex w-full items-center gap-3 rounded-xl bg-[#0a2946] px-4 py-3.5 text-left text-sm font-black text-white transition hover:bg-[#0d3a61]"><Gamepad2 size={18} className="text-[#70c1ff]" /><span>Upload Gameplay</span></button>
      <button type="button" onClick={() => choose(normalAction)} className="mt-1 flex w-full items-center gap-3 rounded-xl bg-[#0a2946] px-4 py-3.5 text-left text-sm font-black text-white transition hover:bg-[#0d3a61]"><MessageSquareText size={18} className="text-[#70c1ff]" /><span>Make Normal Post</span></button>
    </div> : null}
  </section>;
}
