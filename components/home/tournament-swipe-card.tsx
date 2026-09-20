"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
  visibility?: string;
  organizer_id: string;
  profiles?: { display_name?: string | null; username?: string | null; avatar_path?: string | null } | null;
};

export function TournamentSwipeCard({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const clickGuardRef = useRef(false);

  const playSwipeSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(520, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(220, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
      window.setTimeout(() => void context.close(), 180);
    } catch {}
  };

  const current = tournaments[index] || null;
  const stack = tournaments.slice(index, index + 3);

  const finishExit = (direction: "left" | "right") => {
    playSwipeSound();
    setIndex((value) => value + 1);
    setDragX(0);
    setAnimating(false);
  };

  const commitExit = (direction: "left" | "right") => {
    if (!current || animating) return;
    setAnimating(true);
    clickGuardRef.current = true;
    const width = cardRef.current?.getBoundingClientRect().width || 320;
    const distance = Math.max(window.innerWidth + 80, width + 180);
    setDragX(direction === "left" ? -distance : distance);
    window.setTimeout(() => {
      clickGuardRef.current = false;
      finishExit(direction);
    }, 340);
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || animating) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    clickGuardRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || animating) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) setDragX(dx);
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || animating) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    startRef.current = null;
    const horizontal = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!horizontal) { setDragX(0); return; }
    commitExit(dx < 0 ? "left" : "right");
  };

  const pointerCancel = () => {
    startRef.current = null;
    if (!animating) setDragX(0);
  };

  if (!current) {
    return <div className="surface-card rounded-[24px] border-[#153c68] p-6 text-center text-sm text-[#7892ac]">No more featured tournaments.</div>;
  }

  const swipeViewport = typeof window === "undefined" ? 420 : Math.max(420, window.innerWidth);
  const progress = Math.min(1, Math.abs(dragX) / swipeViewport);

  return (
    <>
      <div className="relative w-full overflow-visible" style={{ touchAction: "pan-y" }}>
        {stack.slice(1).reverse().map((tournament, reverseIndex) => {
          const layer = stack.length - reverseIndex - 1;
          const scale = Math.max(0.18, 0.25 - (layer - 1) * 0.04 + progress * (0.75 - (layer - 1) * 0.06));
          return (
            <div key={tournament.id} className="pointer-events-none absolute inset-0 z-10" style={{ transform: `translate3d(0,${8 + (layer - 1) * 8}px,0) scale(${scale})`, opacity: 1, transition: "transform 340ms cubic-bezier(.16,1,.3,1)", willChange: "transform" }}>
              <TournamentCard row={tournament} swipeMode />
            </div>
          );
        })}

        <div
          ref={cardRef}
          className="relative z-20 w-full"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
          style={{
            transform: `translate3d(${dragX}px,0,0) rotate(${Math.max(-5, Math.min(5, dragX / 70))}deg)`,
            transition: animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none",
            opacity: 1,
            willChange: "transform",
          }}
        >
          <TournamentCard row={current} swipeMode onOpenOverride={() => {
            if (clickGuardRef.current) return;
            router.push(`/tournaments/${current.id}`);
          }} />
        </div>
      </div>

      {tournaments.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[9px] font-black text-[#66809a]" aria-label={`Tournament swipe controls, ${Math.min(index + 1, tournaments.length)} of ${tournaments.length}`}>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <ArrowRight size={11} className="rotate-180" />
            Swipe left
          </span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: Math.min(3, tournaments.length) }).map((_, dotIndex) => {
              const activeDot = index % Math.min(3, tournaments.length) === dotIndex;
              return <span key={dotIndex} className={`rounded-full transition-all ${activeDot ? "h-1.5 w-5 bg-[#70c1ff]" : "size-1.5 bg-[#31597f]"}`} />;
            })}
          </div>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            Swipe right
            <ArrowRight size={11} />
          </span>
        </div>
      ) : null}
    </>
  );
}
