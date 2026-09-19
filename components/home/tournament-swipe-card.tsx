"use client";

import { useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, Trophy, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type Tournament = {
  id: string;
  name: string;
  game_title: string | null;
  max_players: number;
  format: string;
  prize_pool: number | null;
  starts_at: string | null;
  banner_path: string | null;
  status: string;
  teams?: number;
  venue?: string | null;
};

const fallbackMedia = "/matchup-logo.svg";

function storageUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return null;
}
function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function money(value: number | null | undefined) {
  const amount = Number(value || 0);
  return amount > 0 ? `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}` : "No Prize Pool";
}
function countdown(value: string | null) {
  if (!value) return "Date TBA";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Started";
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `Starts in ${days}d ${hours}h`;
  if (hours) return `Starts in ${hours}h`;
  return `Starts in ${Math.max(1, minutes)}m`;
}
function game(value: string | null) {
  if (!value || /football/i.test(value)) return "Football";
  return value;
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#214a78] bg-[#0a2139] px-3 py-2 text-[11px] font-black text-[#b7c9da]">{icon}{children}</span>;
}

export function TournamentSwipeCard({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const current = tournaments[index] || null;
  const next = tournaments.length > 1 ? tournaments[(index + 1) % tournaments.length] : null;

  if (!current) return null;

  const begin = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    startRef.current = { x: event.clientX, y: event.clientY };
    setDragging(false);
    setDragX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      setDragging(true);
      setDragX(Math.max(-180, Math.min(180, dx)));
    }
  };
  const end = (event: React.PointerEvent<HTMLElement>) => {
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
    if (dx < 0) {
      setDragX(-520);
      window.setTimeout(() => { setDragX(0); setIndex((value) => (value + 1) % tournaments.length); }, 180);
    } else {
      setDragX(90);
      window.setTimeout(() => { setDragX(0); setConfirmOpen(true); }, 140);
    }
  };
  const openConfirm = () => setConfirmOpen(true);
  const confirm = () => {
    setConfirmOpen(false);
    router.push(`/tournaments/${current.id}`);
  };

  return (
    <>
      <div className="relative w-full overflow-hidden rounded-[30px]">
        {next ? <div className="pointer-events-none absolute inset-x-2 top-2 h-full scale-[.985] rounded-[30px] border border-[#173f68] bg-[#08182b] opacity-70" aria-hidden="true" /> : null}
        <article
          className="relative z-10 w-full touch-pan-y overflow-hidden rounded-[30px] border border-[#245b91] bg-[#071426] shadow-[0_22px_70px_rgba(0,40,90,.22)]"
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={() => { startRef.current = null; setDragging(false); setDragX(0); }}
          style={{ transform: `translate3d(${dragX}px,0,0) rotate(${Math.max(-5, Math.min(5, dragX / 35))}deg)`, transition: dragging ? "none" : "transform 300ms cubic-bezier(.22,1,.36,1)" }}
        >
          <div className="relative h-44 overflow-hidden bg-[#061120] sm:h-52">
            {current.banner_path && storageUrl(current.banner_path) ? <img src={storageUrl(current.banner_path)!} alt="" className="absolute inset-0 size-full object-cover" /> : <div className="absolute inset-0 grid place-items-center"><img src={fallbackMedia} alt="MatchUp" className="w-44 opacity-70" /></div>}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,22,.06),rgba(3,12,22,.92))]" />
            <span className="absolute left-4 top-4 rounded-full border border-[#2497ff] bg-[#061a2d]/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#9bd3ff]">FEATURED</span>
            <div className="absolute inset-x-4 bottom-4">
              <h3 className="truncate text-xl font-black text-white sm:text-2xl">{current.name}</h3>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Chip icon={<Users size={14} className="text-[#70c1ff]" />}>{current.max_players} Players</Chip>
              <Chip icon={<Trophy size={14} className="text-[#70c1ff]" />}>{label(current.format)}</Chip>
              <Chip icon={<CalendarDays size={14} className="text-[#70c1ff]" />}>{countdown(current.starts_at)}</Chip>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip icon={<span className="text-[#70c1ff]">⚽</span>}>{game(current.game_title)}</Chip>
              <Chip icon={<Check size={13} className="text-[#70c1ff]" />}>{current.status === "open" ? "Registration Open" : label(current.status)}</Chip>
              {current.teams ? <Chip icon={<Users size={13} className="text-[#70c1ff]" />}>{current.teams} Teams</Chip> : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0 rounded-2xl border border-[#245b91] bg-[#08182b] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#70c1ff]">Prize Pool</p>
                <p className="mt-1 truncate text-xl font-black text-white">{money(current.prize_pool)}</p>
              </div>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={openConfirm} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-[#167bd1] px-4 text-xs font-black text-white shadow-[0_10px_28px_rgba(22,123,209,.22)]">View Tournament <ArrowRight size={16} /></button>
            </div>
            <p className="mt-3 text-center text-[10px] font-bold text-[#66809a]">Swipe left for next tournament · swipe right to open</p>
          </div>
        </article>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-[26px] border border-[#245b91] bg-[#08182b] p-5 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Tournament</p>
            <h2 className="mt-1 text-xl font-black text-white">Open Tournament?</h2>
            <p className="mt-2 text-sm leading-5 text-[#7892ac]">Continue to the real tournament page for <span className="font-bold text-white">{current.name}</span>.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-2xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm font-black text-[#b7c9da]">Cancel</button>
              <button type="button" onClick={confirm} className="rounded-2xl bg-[#167bd1] px-4 py-3 text-sm font-black text-white">Yes, Open</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
