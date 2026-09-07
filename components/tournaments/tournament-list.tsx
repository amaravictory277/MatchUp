"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function TournamentList() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError("");
      const { data, error: e } = await supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,profiles:organizer_id(display_name,username)").eq("visibility", "public").order("created_at", { ascending: false });
      if (e) setError(e.message); else setRows(data || []);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const visible = rows.filter((r) => !query.trim() || `${r.name} ${r.tournament_id} ${r.format}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <main className="app-shell pb-28"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#9a73ff]">Discover</p><h1 className="text-3xl font-black text-white">Tournaments</h1><p className="mt-1 text-sm text-[#9694aa]">Find a competition or build your own.</p></div><button type="button" onClick={() => router.push("/tournaments/new")} className="flex items-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3 text-xs font-black text-white"><Plus size={16} />Create</button></div>
    <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#26263d] bg-[#0d0e20] px-4 py-3"><Search size={17} className="text-[#6f6d83]" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none" placeholder="Search tournaments" /></div>
    {error ? <div className="mt-5 rounded-2xl border border-[#51253a] bg-[#24111a] p-4 text-sm text-[#ff9bad]">{error}</div> : null}
    <div className="mt-5 grid gap-3">{loading ? <div className="surface-card p-6 text-sm text-[#9694aa]">Loading tournaments…</div> : visible.length === 0 ? <div className="surface-card p-8 text-center"><Trophy className="mx-auto text-[#7b48ec]"/><p className="mt-3 font-bold text-white">No public tournaments yet</p><p className="mt-1 text-sm text-[#77758b]">Create the first MatchUp competition.</p></div> : visible.map((r) => <button key={r.id} type="button" onClick={() => router.push(`/tournaments/${r.id}`)} className="surface-card w-full p-4 text-left transition hover:border-[#4d3a71]"><div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#25134e] text-[#aa7aff]"><Trophy size={22}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-black text-white">{r.name}</h2><span className="rounded-full border border-[#2f2941] px-2 py-1 text-[9px] font-black uppercase text-[#aaa8bc]">{r.format.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-[#77758b]">{r.profiles?.display_name || r.profiles?.username || "Organizer"} · {r.status.replaceAll("_", " ")}</p><div className="mt-3 flex items-center gap-4 text-[11px] text-[#bdb9cc]"><span className="flex items-center gap-1"><Users size={14}/>{r.max_players} teams max</span><span>{r.starts_at ? new Date(r.starts_at).toLocaleDateString() : "Date TBA"}</span></div></div></div></button>)}</div>
  </main>;
}
