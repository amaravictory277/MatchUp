"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Gamepad2, Search, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { Navigation } from "./navigation";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

type Tournament = { id: string; name: string; game_title: string; max_players: number; format: string; prize_pool: number; starts_at: string | null; banner_path: string | null };

function money(value: number) {
  return value > 0 ? `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}` : "No prize";
}
function formatName(value: string) { return value.replaceAll("_", " "); }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl"><Sparkles size={17} className="text-[#47a8ff]" />{children}</h2><a href="/tournaments" className="flex items-center gap-1 text-xs font-semibold text-[#5db1ff] transition hover:text-white">See All <ArrowRight size={15} /></a></div>;
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  return <article className="tournament-card overflow-hidden border-[#153c68] bg-[#071426]"><a href={`/tournaments/${tournament.id}`} className="block"><div className="relative h-32 overflow-hidden bg-[#0b223c]"><div className="absolute inset-0 bg-cover bg-center opacity-75" style={{ backgroundImage: `linear-gradient(180deg, transparent 15%, #071426 100%), url(${tournament.banner_path || "/1002371685.jpg"})` }} /><span className="absolute left-3 top-3 rounded-full border border-[#2b8ee6] bg-[#082a4b]/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-[#9bd3ff]">Football</span></div><div className="p-4"><h3 className="truncate font-black text-white">{tournament.name}</h3><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#9ab2ca]"><span className="flex items-center gap-1"><Users size={13} />{tournament.max_players}</span><span className="flex items-center gap-1"><Trophy size={13} />{formatName(tournament.format)}</span><span className="flex items-center gap-1"><Gamepad2 size={13} />{tournament.game_title}</span></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[11px] text-[#7892ac]">Prize Pool</p><p className="mt-0.5 text-base font-black text-white">{money(Number(tournament.prize_pool))}</p></div><span className="grid size-9 place-items-center rounded-xl bg-[#0b5b99] text-[#9bd3ff]"><Trophy size={18} /></span></div></div></a></article>;
}

export function HomeApp() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from("tournaments").select("id,name,game_title,max_players,format,prize_pool,starts_at,banner_path").eq("visibility", "public").order("created_at", { ascending: false }).limit(12);
      if (mounted) { setTournaments((data || []) as Tournament[]); setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [supabase]);
  const featured = tournaments.slice(0, 6);
  return <main className="app-shell"><Navigation /><section className="hero relative overflow-hidden rounded-[28px] px-5 pb-8 pt-5 sm:px-8 sm:pb-12 sm:pt-8"><div className="hero-player" aria-hidden="true" /><div className="relative z-10 max-w-[470px]"><p className="max-w-[300px] text-[11px] font-bold leading-[1.65] tracking-[.18em] text-[#d4e8fb]"><span className="block">THE HOME OF FOOTBALL</span><span className="block">TOURNAMENTS</span></p><h1 className="mt-5 text-[42px] font-black leading-[.94] tracking-[-.05em] text-white sm:text-6xl">Find your next<br /><span className="hero-gradient">competition.</span></h1><p className="mt-5 max-w-[315px] text-sm leading-6 text-[#c8d9e9]">Create, discover and run competitive football tournaments—all in one match-ready place.</p><div className="mt-5 grid max-w-[280px] gap-3"><a href="/tournaments/new" className="hero-button flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-xs font-black text-white"><Trophy size={16} />CREATE TOURNAMENT</a><a href="/tournaments" className="flex items-center justify-center gap-3 rounded-xl border border-[#28547e] bg-[#071426]/70 px-4 py-3 text-xs font-bold text-white transition hover:border-[#2497ff]"><Search size={17} />FIND TOURNAMENT</a></div></div></section><section className="relative mt-7 overflow-hidden rounded-[28px] border border-[#194b7c] bg-[#0a2139] p-4 shadow-[0_18px_55px_rgba(0,66,120,.24)] sm:p-5"><div className="relative z-10 flex flex-col"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#266ca5] bg-[#0c2c4c] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-[#9bd3ff]"><Zap size={11} /> Competition</div><h2 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">Build your next tournament</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#a8bfd5] sm:text-sm">Set the game, teams, schedule and prize pool, then publish it to the MatchUp community.</p><a href="/tournaments/new" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3 text-xs font-black text-white shadow-[0_0_28px_rgba(36,151,255,.3)] transition hover:brightness-110">Create Tournament <ArrowRight size={14} /></a></div></section><section className="mt-7"><SectionTitle>Featured Tournaments</SectionTitle>{loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading tournaments…</div> : featured.length ? <div className="grid gap-3 sm:grid-cols-2">{featured.map((t) => <TournamentCard key={t.id} tournament={t} />)}</div> : <div className="surface-card p-8 text-center"><Trophy size={28} className="mx-auto text-[#47a8ff]" /><p className="mt-3 font-bold text-white">No public tournaments yet</p><p className="mt-1 text-sm text-[#7892ac]">Create the first real MatchUp competition.</p></div>}</section><section className="mt-7 grid gap-3 sm:grid-cols-2"><div className="surface-card flex items-center gap-4 border-[#153c68] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0a3154] text-[#70c1ff]"><Gamepad2 size={22} /></span><div><p className="text-xs text-[#8fa9c1]">Ready to compete?</p><h2 className="font-bold text-white">Join a tournament today</h2></div><ArrowRight className="ml-auto text-[#4ba8f7]" size={17} /></div><div className="surface-card flex items-center gap-4 border-[#153c68] p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0a3154] text-[#70c1ff]"><ShieldCheck size={22} /></span><div><p className="text-xs text-[#8fa9c1]">Fair play, always</p><h2 className="font-bold text-white">Every match counts</h2></div></div></section><div className="h-8" /></main>;
}
