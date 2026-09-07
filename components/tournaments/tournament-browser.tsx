"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Plus, Search, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Category = "boosted" | "featured" | "discover";

type TournamentRow = {
  id: string;
  tournament_id: string;
  name: string;
  description?: string | null;
  format: string;
  status: string;
  starts_at?: string | null;
  visibility: string;
  max_players: number;
  organizer_id: string;
  banner_path?: string | null;
  profiles?: { display_name?: string | null; username?: string | null } | Array<{ display_name?: string | null; username?: string | null }> | null;
  promotion_kind?: string | null;
  promotion_expires_at?: string | null;
};

const showcase = [
  "MatchUp Elite Finals", "Night League Championship", "Lagos Kings Cup", "Weekend Rivals", "Pro Division Clash",
  "Friday Night Showdown", "MatchUp Champions Cup", "Ultimate eFootball Arena", "Street to Stadium Cup", "Elite Masters League",
  "Next Gen Challenge", "Golden Boot Tournament", "Super Sunday Knockout", "National Rivalry Cup", "Legends Championship",
];

function fallbackRows(category: Category): TournamentRow[] {
  return showcase.map((name, index) => ({
    id: `demo-${category}-${index + 1}`,
    tournament_id: `DEMO-${category.toUpperCase()}-${index + 1}`,
    name,
    description: "Open MatchUp competition for competitive eFootball players.",
    format: ["knockout", "group_stage", "league"][index % 3],
    status: "open",
    starts_at: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
    visibility: "public",
    max_players: [32, 64, 128][index % 3],
    organizer_id: "",
    banner_path: "/images/preview.webp",
    promotion_kind: category === "boosted" ? "pin" : category === "featured" ? "featured" : null,
  }));
}

function normalizeRows(rows: TournamentRow[], category: Category) {
  const selected = rows.filter((row) => {
    const kind = row.promotion_kind;
    if (category === "boosted") return kind === "boost" || kind === "pin";
    if (category === "featured") return kind === "featured" || kind === "promoted";
    return !kind;
  });
  const source = selected.length ? selected : fallbackRows(category);
  return source.slice(0, 15);
}

function profileName(row: TournamentRow) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile?.display_name || profile?.username || "MatchUp Organizer";
}

function formatName(value: string) {
  return value.replaceAll("_", " ");
}

export function TournamentCard({ row, category }: { row: TournamentRow; category: Category }) {
  const router = useRouter();
  const isDemo = row.id.startsWith("demo-");
  const badge = category === "boosted" ? "Pinned" : category === "featured" ? "Featured" : null;
  return (
    <button
      type="button"
      disabled={isDemo}
      onClick={() => router.push(`/tournaments/${row.id}`)}
      className={`group w-full overflow-hidden rounded-[20px] border border-[#24253d] bg-[#0d0e20] text-left shadow-[0_14px_32px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-[#59418e] ${isDemo ? "cursor-default" : "cursor-pointer"}`}
    >
      <div className="relative h-36 overflow-hidden bg-[#17142b]">
        <img src={row.banner_path || "/images/preview.webp"} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080912] via-[#080912]/10 to-transparent" />
        {badge ? <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${category === "boosted" ? "border-[#6940b7]/60 bg-[#26164b]/90 text-[#c8adff]" : "border-[#346a5b]/70 bg-[#0f2c27]/90 text-[#87edc9]"}`}><Zap size={11} />{badge}</span> : null}
        <span className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-white/80 backdrop-blur">{formatName(row.format)}</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-black text-white">{row.name}</h2>
          <Trophy size={16} className="mt-0.5 shrink-0 text-[#9a72ff]" />
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-[#89869b]">{row.description || "Open MatchUp competition."}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-[#bcb8cc]">
          <span className="flex items-center gap-1.5"><Users size={13} />{row.max_players} players</span>
          <span className="flex items-center gap-1.5"><CalendarDays size={13} />{row.starts_at ? new Date(row.starts_at).toLocaleDateString() : "Date TBA"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[10px] font-semibold text-[#767388]">
          <span>{profileName(row)}</span><span className="capitalize">{formatName(row.status)}</span>
        </div>
      </div>
    </button>
  );
}

function ActionBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="flex items-center gap-2 rounded-2xl border border-[#28293f] bg-[#0d0e20] px-4 py-3">
        <Search size={17} className="text-[#737086]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#666376]" placeholder="Search tournaments" aria-label="Search tournaments" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => document.getElementById("tournament-results")?.scrollIntoView({ behavior: "smooth" })} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#2b2b45] bg-[#121327] px-4 py-3 text-xs font-black text-white sm:flex-none"><Trophy size={15} />Find Competition</button>
        <button type="button" onClick={() => router.push("/tournaments/new")} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3 text-xs font-black text-white sm:flex-none"><Plus size={15} />Build Your Own</button>
      </div>
    </div>
  );
}

export function TournamentListingPage({ category, title }: { category: Category; title: string }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [tournamentsResult, promotionsResult] = await Promise.all([
        supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,banner_path,profiles:organizer_id(display_name,username)").eq("visibility", "public").order("created_at", { ascending: false }),
        supabase.from("tournament_promotions").select("tournament_id,kind,expires_at,position").order("position", { ascending: true }),
      ]);
      if (!mounted) return;
      const promotions = promotionsResult.data || [];
      const enriched = (tournamentsResult.data || []).map((row: any) => {
        const active = promotions.find((promotion: any) => promotion.tournament_id === row.id && new Date(promotion.expires_at).getTime() > Date.now());
        return { ...row, promotion_kind: active?.kind || null, promotion_expires_at: active?.expires_at || null } as TournamentRow;
      });
      setRows(normalizeRows(enriched, category));
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [category, supabase]);

  return (
    <main className="app-shell pb-28">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a73ff]">MatchUp Tournaments</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">{title}</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#8f8ca1]">Browse competitive eFootball events, find your next challenge, or build your own.</p>
        </div>
        <Link href="/tournaments/new" className="hidden shrink-0 items-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3 text-xs font-black text-white sm:flex"><Plus size={15} />Create</Link>
      </div>
      <ActionBar />
      <div id="tournament-results" className="mt-7">
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#89869b]">Loading tournaments…</div> : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => <TournamentCard key={row.id} row={row} category={category} />)}
          </div>
        )}
      </div>
    </main>
  );
}
