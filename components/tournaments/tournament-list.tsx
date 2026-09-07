"use client";

import { ArrowRight, ChevronDown, Plus, Search, Trophy, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { TournamentCard } from "./tournament-browser";

type TournamentRow = { id: string; tournament_id: string; name: string; description?: string | null; format: string; status: string; starts_at?: string | null; visibility: string; max_players: number; organizer_id: string; banner_path?: string | null; profiles?: { display_name?: string | null; username?: string | null } | Array<{ display_name?: string | null; username?: string | null }> | null; promotion_kind?: string | null; promotion_expires_at?: string | null };
const showcase = ["MatchUp Elite Finals", "Night League Championship", "Lagos Kings Cup", "Weekend Rivals", "Pro Division Clash", "Friday Night Showdown", "MatchUp Champions Cup", "Ultimate eFootball Arena", "Street to Stadium Cup", "Elite Masters League", "Next Gen Challenge", "Golden Boot Tournament", "Super Sunday Knockout", "National Rivalry Cup", "Legends Championship"];
const fallback = (kind: "boosted" | "featured" | "discover") => showcase.map((name, index) => ({ id: `demo-${kind}-${index + 1}`, tournament_id: `DEMO-${kind.toUpperCase()}-${index + 1}`, name, description: "Open MatchUp competition for competitive eFootball players.", format: ["knockout", "group_stage", "league"][index % 3], status: "open", starts_at: new Date(Date.now() + (index + 1) * 86400000).toISOString(), visibility: "public", max_players: [32, 64, 128][index % 3], organizer_id: "", banner_path: "/1002371685.jpg", promotion_kind: kind === "boosted" ? "pin" : kind === "featured" ? "featured" : null } as TournamentRow));
function pick(rows: TournamentRow[], kind: "boosted" | "featured" | "discover") { const selected = rows.filter((row) => kind === "boosted" ? row.promotion_kind === "boost" || row.promotion_kind === "pin" : kind === "featured" ? row.promotion_kind === "featured" || row.promotion_kind === "promoted" : !row.promotion_kind); const seen = new Set(selected.map((row) => row.id)); return [...selected, ...fallback(kind).filter((row) => !seen.has(row.id))].slice(0, 15); }

function Section({ title, category, rows }: { title: string; category: "boosted" | "featured" | "discover"; rows: TournamentRow[] }) {
  const href = category === "boosted" ? "/tournaments/featured-boosted" : category === "featured" ? "/tournaments/featured" : "/tournaments/discover";
  return (
    <section className="mt-9 first:mt-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#766f8f]">{category === "boosted" ? "Pinned visibility" : category === "featured" ? "Hand-picked events" : "Open competitions"}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">{title}</h2>
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#2b2b45] bg-[#111226] px-3 py-2 text-[11px] font-black text-white transition hover:border-[#59418e]">See All<ArrowRight size={14} /></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{rows.map((row) => <TournamentCard key={row.id} row={row} category={category} />)}</div>
    </section>
  );
}

export function TournamentList() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [tournamentsResult, promotionsResult] = await Promise.all([
        supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,banner_path,profiles:organizer_id(display_name,username)").eq("visibility", "public").order("created_at", { ascending: false }),
        supabase.from("tournament_promotions").select("tournament_id,kind,expires_at,position").order("position", { ascending: true })
      ]);
      if (!mounted) return;
      const promotions = promotionsResult.data || [];
      setRows((tournamentsResult.data || []).map((row: any) => {
        const active = promotions.find((promotion: any) => promotion.tournament_id === row.id && new Date(promotion.expires_at).getTime() > Date.now());
        return { ...row, promotion_kind: active?.kind || null, promotion_expires_at: active?.expires_at || null } as TournamentRow;
      }));
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [supabase]);

  const boosted = pick(rows, "boosted");
  const featured = pick(rows.filter((row) => !boosted.some((item) => item.id === row.id)), "featured");
  const discover = pick(rows.filter((row) => !boosted.some((item) => item.id === row.id) && !featured.some((item) => item.id === row.id)), "discover");

  return (
    <main className="app-shell pb-28">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a73ff]">MatchUp Tournaments</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Tournaments</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#8f8ca1]">Find a competition or build your own.</p>
        </div>
        <Link href="/tournaments/new" className="hidden shrink-0 items-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3 text-xs font-black text-white sm:flex"><Plus size={15} />Create</Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button type="button" onClick={() => setSearchOpen(true)} className="flex items-center gap-3 rounded-2xl border border-[#28293f] bg-[#0d0e20] px-4 py-3 text-left text-sm font-bold text-[#c7c4d4] transition hover:border-[#59418e]">
          <Search size={17} className="text-[#9a73ff]" />Search Tournaments<ChevronDown size={16} className="ml-auto text-[#737086]" />
        </button>
        <div className="flex gap-2">
          <Link href="/tournaments/discover" className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#2b2b45] bg-[#121327] px-4 py-3 text-xs font-black text-white sm:flex-none"><Users size={15} />Find Competition</Link>
          <Link href="/tournaments/new" className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3 text-xs font-black text-white sm:flex-none"><Plus size={15} />Build Your Own</Link>
        </div>
      </div>
      {loading ? (
        <div className="surface-card mt-7 p-8 text-center text-sm text-[#89869b]">Loading tournaments…</div>
      ) : (
        <>
          <Section title="Featured Boosted Tournaments" category="boosted" rows={boosted} />
          <Section title="Featured Tournaments" category="featured" rows={featured} />
          <Section title="Discover Tournaments" category="discover" rows={discover} />
        </>
      )}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#03040c]/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="search-tournaments-title">
          <div className="w-full max-w-md rounded-[26px] border border-[#302553] bg-[#101024] p-5 shadow-[0_24px_80px_rgba(0,0,0,.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a73ff]">Find your next match</p>
                <h2 id="search-tournaments-title" className="mt-1 text-xl font-black text-white">Search tournaments</h2>
                <p className="mt-1 text-sm leading-5 text-[#8f8ca1]">Choose how you want to find a competition.</p>
              </div>
              <button type="button" onClick={() => setSearchOpen(false)} className="grid size-9 place-items-center rounded-full border border-[#2b2b45] bg-[#0d0e20] text-[#aaa8bd] transition hover:border-[#7843ee] hover:text-white" aria-label="Close search options">
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <Link href="/tournaments/discover" onClick={() => setSearchOpen(false)} className="flex items-center justify-between rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-4 text-sm font-black text-white shadow-[0_0_24px_rgba(112,38,245,.28)] transition hover:brightness-110">
                <span className="flex items-center gap-3"><Search size={18} />Search tournaments</span>
                <ArrowRight size={17} />
              </Link>
              <Link href="/tournaments/discover?mode=id" onClick={() => setSearchOpen(false)} className="flex items-center justify-between rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white">
                <span className="flex items-center gap-3"><Trophy size={18} className="text-[#a979ff]" />Search by tournament ID</span>
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
