"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TournamentCard } from "../tournaments/tournament-browser";

type Tournament = {
  id: string;
  tournament_id?: string;
  name: string;
  description?: string | null;
  game_title: string | null;
  max_players: number;
  format: string;
  prize_pool: number | null;
  starts_at: string | null;
  banner_path: string | null;
  status: string;
  organizer_id: string;
  profiles?: { display_name?: string | null; username?: string | null; avatar_path?: string | null } | null;
};

export function TournamentSwipeCard({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const current = tournaments[index] || null;
  const next = tournaments[index + 1] || null;

  if (!current) return null;

  const commitNext = () => {
    const distance = Math.max(window.innerWidth, cardRef.current?.getBoundingClientRect().width || 0) + 180;
    setDragX(-distance);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDragX(0);
    }, 320);
  };

  const openConfirmation = () => {
    setDragX(110);
    window.setTimeout(() => {
      setDragX(0);
      setConfirmOpen(true);
    }, 180);
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    startRef.current = { x: event.clientX, y: event.clientY };
    setDragging(false);
    setDragX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      setDragging(true);
      setDragX(dx);
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    const horizontal = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.15;
    startRef.current = null;
    setDragging(false);
    if (!horizontal) {
      setDragX(0);
      return;
    }
    if (dx < 0) commitNext();
    else openConfirmation();
  };

  return (
    <>
      <div className="relative w-full overflow-visible">
        {next ? (
          <div className="pointer-events-none absolute inset-x-2 top-2 h-full scale-[.985] rounded-[24px] border border-[#173f68] bg-[#08182b] opacity-70" aria-hidden="true" />
        ) : null}

        <div
          ref={cardRef}
          className="relative z-10 w-full touch-pan-y"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => {
            startRef.current = null;
            setDragging(false);
            setDragX(0);
          }}
          style={{
            transform: `translate3d(${dragX}px,0,0) rotate(${Math.max(-4, Math.min(4, dragX / 55))}deg)`,
            transition: dragging ? "none" : "transform 320ms cubic-bezier(.22,1,.36,1)",
            willChange: "transform",
          }}
        >
          <TournamentCard
            row={current}
            swipeMode
            onOpenOverride={() => setConfirmOpen(true)}
          />
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <section className="w-full max-w-sm rounded-[26px] border border-[#245b91] bg-[#08182b] p-5 shadow-[0_24px_80px_rgba(0,0,0,.6)]">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Tournament</p>
            <h2 className="mt-1 text-xl font-black text-white">Open Tournament?</h2>
            <p className="mt-2 text-sm leading-6 text-[#86a1bb]">Open “{current.name}” and view its full tournament details.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm font-black text-[#b7c9da]">Cancel</button>
              <button type="button" onClick={() => { setConfirmOpen(false); router.push(`/tournaments/${current.id}`); }} className="rounded-xl bg-[#167bd1] px-4 py-3 text-sm font-black text-white">Yes</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
