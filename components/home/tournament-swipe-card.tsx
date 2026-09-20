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
      const duration = 0.11;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const envelope = Math.pow(1 - i / data.length, 2);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1700, context.currentTime);
      filter.Q.setValueAtTime(0.7, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      source.stop(context.currentTime + duration);
      window.setTimeout(() => void context.close(), 180);
    } catch {}
  };

  const current = tournaments[index] || null;
  const stack = tournaments.slice(index, index + 3);

  const finishExit = (direction: "left" | "right") => {
    playSwipeSound();
    if (direction === "left") {
      setIndex((value) => Math.min(value + 1, tournaments.length - 1));
      setDragX(0);
    } else {
      // Preserve the existing right-swipe exit animation, then open the
      // tournament that was on the surface.
      router.push(`/tournaments/${current.id}`);
      setDragX(0);
    }
    setAnimating(false);
  };

  const commitExit = (direction: "left" | "right") => {
    if (!current || animating) return;
    if (direction === "left" && index >= tournaments.length - 1) {
      setDragX(0);
      return;
    }
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
  const nextTournament = dragX < 0 ? tournaments[index + 1] : dragX > 0 ? tournaments[index - 1] : null;

  return (
    <>
      <div className="relative w-full overflow-hidden rounded-[28px]" style={{ touchAction: "pan-y" }}>
        {nextTournament ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 w-full origin-center"
            aria-hidden="true"
            style={{
              transform: `translate3d(0,0,0) scale(${0.2 + progress * 0.8})`,
              transition: animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none",
              willChange: "transform",
            }}
          >
            <TournamentCard row={nextTournament} swipeMode />
          </div>
        ) : null}

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
        <div
          className="mt-3 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-1"
          aria-label={`Featured tournaments, card ${Math.min(index + 1, tournaments.length)} of ${tournaments.length}`}
        >
          <span className="justify-self-start whitespace-nowrap text-[9px] font-semibold text-[#7892ac] sm:text-[10px]">← Swipe left for next</span>
          <div className="flex items-center justify-center gap-1.5">
            {tournaments.map((tournament, dotIndex) => (
              <span
                key={tournament.id}
                className={`rounded-full transition-all duration-200 ${
                  dotIndex === index ? "h-1.5 w-5 bg-[#70c1ff]" : "size-1.5 bg-[#31597f]"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="justify-self-end whitespace-nowrap text-[9px] font-semibold text-[#7892ac] sm:text-[10px]">Swipe right to open tournament →</span>
        </div>
      ) : null}
    </>
  );
}
