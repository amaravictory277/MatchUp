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
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    if (direction === "left") {
      playSwipeSound();
      setIndex((value) => value + 1);
    } else {
      setConfirmOpen(true);
    }
    setDragX(0);
    setAnimating(false);
  };

  const commitExit = (direction: "left" | "right") => {
    if (!current || animating || confirmOpen) return;
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
          const baseScale = layer === 1 ? 0.94 : 0.90;
          const growth = layer === 1 ? 0.06 : 0.10;
          const scale = baseScale + progress * growth;
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

      {confirmOpen && current ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setConfirmOpen(false)}>
          <section className="w-full max-w-sm rounded-[26px] border border-[#245b91] bg-[#08182b] p-5 shadow-[0_24px_80px_rgba(0,0,0,.6)]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Tournament</p>
            <h2 className="mt-1 text-xl font-black text-white">Do you want to open this tournament?</h2>
            <p className="mt-2 truncate text-sm text-[#7892ac]">{current.name}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm font-black text-[#b7c9da]">Cancel</button>
              <button type="button" onClick={() => { setConfirmOpen(false); router.push(`/tournaments/${current.id}`); }} className="rounded-xl bg-[#167bd1] px-4 py-3 text-sm font-black text-white">Yes / Open Tournament</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
