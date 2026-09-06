"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CalendarDays, Check, ChevronRight, Clipboard, Copy, Crown, ExternalLink, Goal, MapPin, MoreHorizontal, Pencil, Share2, Shield, Trophy, Users, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { statsFromFixtures } from "../../lib/tournament/engine";

type Team = { id: string; team_name: string; short_name: string; country: string; league: string; crest_path?: string | null; seed?: number | null; group_name?: string | null };
type Fixture = { id: string; round_number: number; position: number; round_label: string; group_name?: string | null; home_team_id?: string | null; away_team_id?: string | null; winner_team_id?: string | null; home_score?: number | null; away_score?: number | null; status: string; scheduled_at?: string | null; venue_id?: string | null; duration_minutes?: number; referee_name?: string | null; home_penalties?: number | null; away_penalties?: number | null; cancelled?: boolean };
type Tournament = { id: string; tournament_id: string; name: string; description: string; format: string; status: string; starts_at?: string | null; visibility: string; max_players: number; organizer_id: string; entry_information?: string | null; prize_information?: string | null; profiles?: { display_name?: string | null; username?: string | null } | null };

const tabs = ["Overview", "Fixtures", "Results", "Standings", "Teams", "Bracket", "Statistics"] as const;

const crestFallback = "/icon.svg";
function logo(path?: string | null) {
  return path || crestFallback;
}

function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "TBA"; }

export function TournamentClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Fixture | null>(null);
  const [score, setScore] = useState({ home: "", away: "", hp: "", ap: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const confirmed = fixtures.filter((f) => f.status === "confirmed" && f.home_score != null && f.away_score != null);
  const stats = useMemo(() => statsFromFixtures(fixtures), [fixtures]);
  const progress = fixtures.length ? Math.round((confirmed.length / fixtures.length) * 100) : 0;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError("");
      const [{ data: t, error: te }, { data: ts, error: tse }, { data: fs, error: fe }, { data: userData }] = await Promise.all([
        supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,entry_information,prize_information,profiles:organizer_id(display_name,username)").eq("id", params.id).single(),
        supabase.from("tournament_teams").select("id,team_name,short_name,country,league,crest_path,seed,group_name").eq("tournament_id", params.id).order("seed"),
        supabase.from("fixtures").select("id,round_number,position,round_label,group_name,home_team_id,away_team_id,winner_team_id,home_score,away_score,status,scheduled_at,venue_id,duration_minutes,referee_name,home_penalties,away_penalties,cancelled").eq("tournament_id", params.id).order("round_number").order("position"),
        supabase.auth.getUser(),
      ]);
      if (!active) return;
      if (te) { setError(te.message); setLoading(false); return; }
      if (tse) setError(tse.message);
      if (fe) setError(fe.message);
      const normalizedTournament = t
        ? { ...t, profiles: Array.isArray(t.profiles) ? t.profiles[0] ?? null : t.profiles }
        : null;
      setTournament(normalizedTournament); setTeams(ts || []); setFixtures(fs || []);
      if (userData.user && t) setIsAdmin(t.organizer_id === userData.user.id || !!(await supabase.from("tournament_admins").select("user_id").eq("tournament_id", params.id).eq("user_id", userData.user.id).eq("permission", "admin").maybeSingle()).data);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [params.id, supabase]);

  const team = (id?: string | null) => id ? teamMap.get(id) : undefined;

  const openScore = (match: Fixture) => { setSelectedMatch(match); setScore({ home: match.home_score == null ? "" : String(match.home_score), away: match.away_score == null ? "" : String(match.away_score), hp: match.home_penalties == null ? "" : String(match.home_penalties), ap: match.away_penalties == null ? "" : String(match.away_penalties) }); };

  const saveScore = async () => {
    if (!selectedMatch || !tournament || !isAdmin) return;
    const h = Number(score.home); const a = Number(score.away);
    if (!Number.isInteger(h) || h < 0 || !Number.isInteger(a) || a < 0) { setToast("Enter valid non-negative scores."); return; }
    let winner: string | null = null;
    if (selectedMatch.home_team_id && selectedMatch.away_team_id) {
      if (h > a) winner = selectedMatch.home_team_id;
      if (a > h) winner = selectedMatch.away_team_id;
      if (h === a) { const hp = Number(score.hp); const ap = Number(score.ap); if (Number.isInteger(hp) && Number.isInteger(ap) && hp !== ap) winner = hp > ap ? selectedMatch.home_team_id : selectedMatch.away_team_id; }
    }
    if (h === a && !winner && tournament.format.includes("knockout")) { setToast("Add penalty scores for a drawn knockout match."); return; }
    setSaving(true);
    const { error: e } = await supabase.from("fixtures").update({ home_score: h, away_score: a, home_penalties: score.hp === "" ? null : Number(score.hp), away_penalties: score.ap === "" ? null : Number(score.ap), winner_team_id: winner, status: "confirmed" }).eq("id", selectedMatch.id);
    if (e) { setToast(e.message); setSaving(false); return; }

    if (winner && tournament.format !== "league" && tournament.format !== "round_robin" && tournament.format !== "group_stage") {
      const nextRound = selectedMatch.round_number + 1;
      const nextPosition = Math.ceil(selectedMatch.position / 2);
      const next = fixtures.find((f) => f.round_number === nextRound && f.position === nextPosition);
      if (next) {
        const patch = selectedMatch.position % 2 === 1 ? { home_team_id: winner } : { away_team_id: winner };
        await supabase.from("fixtures").update(patch).eq("id", next.id);
      }
    }
    setFixtures((prev) => prev.map((f) => f.id === selectedMatch.id ? { ...f, home_score: h, away_score: a, home_penalties: score.hp === "" ? null : Number(score.hp), away_penalties: score.ap === "" ? null : Number(score.ap), winner_team_id: winner, status: "confirmed" } : f));
    const nextLocal = fixtures.find((f) => f.round_number === selectedMatch.round_number + 1 && f.position === Math.ceil(selectedMatch.position / 2));
    if (winner && nextLocal) setFixtures((prev) => prev.map((f) => f.id === nextLocal.id ? { ...f, ...(selectedMatch.position % 2 === 1 ? { home_team_id: winner } : { away_team_id: winner }) } : f));
    setSelectedMatch(null); setToast("Result saved and competition data recalculated."); setSaving(false);
  };

  const copyShare = async () => { await navigator.clipboard?.writeText(window.location.href); setToast("Tournament link copied"); };
  const setWinnerName = (f: Fixture) => f.winner_team_id ? team(f.winner_team_id)?.team_name : undefined;

  if (loading) return <main className="app-shell"><div className="surface-card p-8 text-sm text-[#9694aa]">Loading tournament…</div></main>;
  if (!tournament) return <main className="app-shell"><div className="surface-card p-8"><p className="font-bold text-white">Tournament not found</p><p className="mt-1 text-sm text-[#9694aa]">{error || "This tournament may be private or no longer available."}</p></div></main>;

  return <main className="app-shell pb-28">
    <header className="mb-4 flex items-center gap-3"><button type="button" onClick={() => router.push("/tournaments")} className="icon-button"><ArrowLeft size={18}/></button><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black uppercase tracking-[.16em] text-[#9a73ff]">{tournament.status.replaceAll("_", " ")}</p><h1 className="truncate text-xl font-black text-white">{tournament.name}</h1></div><button type="button" onClick={copyShare} className="icon-button" aria-label="Share tournament"><Share2 size={17}/></button><button type="button" className="icon-button" aria-label="Tournament options"><MoreHorizontal size={18}/></button></header>
    <section className="surface-card overflow-hidden p-5"><div className="flex items-start gap-4"><span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-[linear-gradient(145deg,#241443,#0f1020)] text-[#aa7aff]"><Trophy size={30}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black text-white">{tournament.name}</h2><span className="rounded-full bg-[#6d27ff] px-2.5 py-1 text-[9px] font-black uppercase text-white">{tournament.format.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-[#aaa8bc]">Organized by {tournament.profiles?.display_name || tournament.profiles?.username || "MatchUp organizer"}</p><div className="mt-4 flex flex-wrap gap-3 text-xs text-[#bdb9cc]"><span className="flex items-center gap-1"><Users size={14}/>{teams.length} teams</span><span className="flex items-center gap-1"><CalendarDays size={14}/>{formatDate(tournament.starts_at)}</span><span className="flex items-center gap-1"><MapPin size={14}/>{tournament.entry_information || "Venue TBA"}</span></div></div></div>{tournament.description ? <p className="mt-4 text-sm leading-6 text-[#cbc8d8]">{tournament.description}</p> : null}<div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-[#0d0e20] p-3"><p className="text-[10px] text-[#77758b]">Played</p><p className="mt-1 text-lg font-black text-white">{confirmed.length}</p></div><div className="rounded-2xl bg-[#0d0e20] p-3"><p className="text-[10px] text-[#77758b]">Remaining</p><p className="mt-1 text-lg font-black text-white">{Math.max(0, fixtures.length - confirmed.length)}</p></div><div className="rounded-2xl bg-[#0d0e20] p-3"><p className="text-[10px] text-[#77758b]">Progress</p><p className="mt-1 text-lg font-black text-white">{progress}%</p></div></div></section>

    <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">{tabs.map((x) => <button type="button" key={x} onClick={() => setTab(x)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${tab === x ? "bg-white text-[#0b0c18]" : "border border-[#28283f] bg-[#0d0e20] text-[#aaa8bc]"}`}>{x}</button>)}</div>

    {error ? <div className="mt-4 rounded-2xl border border-[#51253a] bg-[#24111a] p-4 text-sm text-[#ff9bad]">{error}</div> : null}

    {tab === "Overview" ? <div className="mt-4 grid gap-4"><section className="surface-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#9a73ff]">Next match</p><p className="mt-1 text-xs text-[#77758b]">{fixtures.find((f) => f.status !== "confirmed" && !f.cancelled)?.round_label || "Schedule pending"}</p></div><CalendarDays className="text-[#8170a7]" size={18}/></div>{(() => { const next = fixtures.find((f) => f.status !== "confirmed" && !f.cancelled); return next ? <div className="mt-4 flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3">{team(next.home_team_id) ? <><img src={logo(team(next.home_team_id)?.crest_path)} className="size-12 rounded-full bg-white/5 object-contain p-2"/><span className="truncate text-sm font-bold text-white">{team(next.home_team_id)?.team_name}</span></> : <span className="text-[#77758b]">TBD</span>}</div><span className="text-xs font-black text-[#8d89a0]">VS</span><div className="flex min-w-0 items-center gap-3">{team(next.away_team_id) ? <><span className="truncate text-sm font-bold text-white">{team(next.away_team_id)?.team_name}</span><img src={logo(team(next.away_team_id)?.crest_path)} className="size-12 rounded-full bg-white/5 object-contain p-2"/></> : <span className="text-[#77758b]">TBD</span>}</div></div> : <div className="mt-4 rounded-2xl border border-dashed border-[#2c2c42] p-5 text-center text-sm text-[#77758b]">No fixtures yet.</div>; })()}</section><section className="grid gap-3 sm:grid-cols-3"><div className="surface-card p-4"><p className="text-xs text-[#77758b]">Teams</p><p className="mt-1 text-2xl font-black text-white">{teams.length}</p></div><div className="surface-card p-4"><p className="text-xs text-[#77758b]">Matches</p><p className="mt-1 text-2xl font-black text-white">{fixtures.length}</p></div><div className="surface-card p-4"><p className="text-xs text-[#77758b]">Goals</p><p className="mt-1 text-2xl font-black text-white">{confirmed.reduce((n, f) => n + (f.home_score || 0) + (f.away_score || 0), 0)}</p></div></section><section className="surface-card p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-white">Latest results</h3><button type="button" onClick={() => setTab("Results")} className="text-xs font-bold text-[#a979ff]">See all</button></div>{confirmed.slice(-3).reverse().map((f) => <button type="button" onClick={() => router.push(`/tournaments/${tournament.id}/matches/${f.id}`)} key={f.id} className="flex w-full items-center justify-between gap-3 border-t border-[#202139] py-3 text-left"><span className="min-w-0 truncate text-sm font-semibold text-white">{team(f.home_team_id)?.team_name || "TBD"}</span><span className="rounded-xl bg-[#17172a] px-3 py-1.5 text-sm font-black text-white">{f.home_score} – {f.away_score}</span><span className="min-w-0 truncate text-right text-sm font-semibold text-white">{team(f.away_team_id)?.team_name || "TBD"}</span></button>)}</section></div> : null}

    {tab === "Fixtures" || tab === "Results" ? <section className="mt-4 space-y-3">{fixtures.filter((f) => tab === "Fixtures" ? f.status !== "confirmed" && !f.cancelled : f.status === "confirmed").length === 0 ? <div className="surface-card p-7 text-center text-sm text-[#77758b]">{tab === "Fixtures" ? "No fixtures generated yet." : "Results will appear here after matches are completed."}</div> : fixtures.filter((f) => tab === "Fixtures" ? f.status !== "confirmed" && !f.cancelled : f.status === "confirmed").map((f) => <button key={f.id} type="button" onClick={() => router.push(`/tournaments/${tournament.id}/matches/${f.id}`)} className="surface-card flex w-full items-center gap-3 p-4 text-left transition hover:border-[#493a6b]"><div className="w-20 shrink-0"><p className="text-[10px] font-black uppercase text-[#9a73ff]">{f.round_label || `Round ${f.round_number}`}</p><p className="mt-1 text-[10px] text-[#77758b]">{formatDate(f.scheduled_at)}</p></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{team(f.home_team_id)?.team_name || "TBD"}</p><p className="mt-1 truncate text-sm font-bold text-white">{team(f.away_team_id)?.team_name || "TBD"}</p></div><div className="shrink-0 text-right"><p className="text-lg font-black text-white">{f.home_score ?? "–"}</p><p className="text-lg font-black text-white">{f.away_score ?? "–"}</p></div><ChevronRight size={17} className="shrink-0 text-[#676477]"/></button>)}</section> : null}

    {tab === "Standings" ? <section className="mt-4 surface-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-[#0d0e20] text-[#77758b]"><tr>{["POS","TEAM","P","W","D","L","GF","GA","GD","PTS"].map((x) => <th key={x} className="px-3 py-3 font-black">{x}</th>)}</tr></thead><tbody>{teams.map((t, i) => { const s = stats.get(t.id) || { p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0 }; return <tr key={t.id} className="border-t border-[#202139]"><td className="px-3 py-3 font-black text-[#9a73ff]">{i + 1}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><img src={logo(t.crest_path)} className="size-7 rounded-full object-contain"/><span className="font-bold text-white">{t.team_name}</span></div></td><td className="px-3 py-3 text-white">{s.p}</td><td className="px-3 py-3 text-white">{s.w}</td><td className="px-3 py-3 text-white">{s.d}</td><td className="px-3 py-3 text-white">{s.l}</td><td className="px-3 py-3 text-white">{s.gf}</td><td className="px-3 py-3 text-white">{s.ga}</td><td className="px-3 py-3 text-white">{s.gd}</td><td className="px-3 py-3 font-black text-white">{s.pts}</td></tr>; })}</tbody></table></div></section> : null}

    {tab === "Teams" ? <section className="mt-4 grid gap-3 sm:grid-cols-2">{teams.length === 0 ? <div className="surface-card p-7 text-center text-sm text-[#77758b]">No teams added yet.</div> : teams.map((t) => <div key={t.id} className="surface-card p-4"><div className="flex items-center gap-3"><img src={logo(t.crest_path)} className="size-14 rounded-full bg-white/5 object-contain p-2"/><div className="min-w-0 flex-1"><h3 className="truncate font-black text-white">{t.team_name}</h3><p className="text-xs text-[#77758b]">{t.country} · {t.league}{t.group_name ? ` · Group ${t.group_name}` : ""}</p></div><span className="text-xs font-black text-[#9a73ff]">#{t.seed || "–"}</span></div></div>)}</section> : null}

    {tab === "Bracket" ? <section className="mt-4"><div className="no-scrollbar flex gap-4 overflow-x-auto pb-3">{[...new Set(fixtures.map((f) => f.round_number))].sort((a,b) => a-b).map((round) => <div key={round} className="min-w-[220px]"><p className="mb-2 text-xs font-black uppercase tracking-[.15em] text-[#9a73ff]">{fixtures.find((f) => f.round_number === round)?.round_label || `Round ${round}`}</p><div className="space-y-3">{fixtures.filter((f) => f.round_number === round).map((f) => <button type="button" key={f.id} onClick={() => openScore(f)} disabled={!isAdmin} className="surface-card w-full p-3 text-left disabled:opacity-100"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-white">{team(f.home_team_id)?.team_name || "TBD"}</span><span className="font-black text-white">{f.home_score ?? "–"}</span></div><div className="my-2 h-px bg-[#25263e]"/><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-white">{team(f.away_team_id)?.team_name || "TBD"}</span><span className="font-black text-white">{f.away_score ?? "–"}</span></div>{f.winner_team_id ? <p className="mt-2 text-[10px] font-black text-[#7bd63d]">{setWinnerName(f)} advances</p> : null}</button>)}</div></div>)}</div></section> : null}

    {tab === "Statistics" ? <section className="mt-4 grid gap-3 sm:grid-cols-2"><div className="surface-card p-5"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-[#9a73ff]"/><h3 className="font-black text-white">Tournament totals</h3></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-[#77758b]">Goals scored</p><p className="text-xl font-black text-white">{confirmed.reduce((n,f)=>n+(f.home_score||0)+(f.away_score||0),0)}</p></div><div><p className="text-[#77758b]">Matches played</p><p className="text-xl font-black text-white">{confirmed.length}</p></div><div><p className="text-[#77758b]">Matches remaining</p><p className="text-xl font-black text-white">{Math.max(0,fixtures.length-confirmed.length)}</p></div><div><p className="text-[#77758b]">Teams</p><p className="text-xl font-black text-white">{teams.length}</p></div></div></div><div className="surface-card p-5"><div className="flex items-center gap-2"><Crown size={18} className="text-[#e6c34d]"/><h3 className="font-black text-white">Leaders</h3></div>{teams.length ? <div className="mt-4 space-y-3">{[...teams].sort((a,b)=>(stats.get(b.id)?.pts||0)-(stats.get(a.id)?.pts||0)).slice(0,3).map((t,i)=><div key={t.id} className="flex items-center gap-3"><span className="w-5 text-center text-xs font-black text-[#9a73ff]">{i+1}</span><img src={logo(t.crest_path)} className="size-9 rounded-full object-contain"/><span className="flex-1 text-sm font-bold text-white">{t.team_name}</span><span className="text-sm font-black text-white">{stats.get(t.id)?.pts||0} pts</span></div>)}</div> : <p className="mt-4 text-sm text-[#77758b]">Statistics will appear after matches are played.</p>}</div></section> : null}

    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#6f6d83]"><Shield size={14}/> Public viewers can view this tournament; authorized organizers/admins can manage competition data.</div>

    {selectedMatch ? <div className="install-overlay"><div className="install-sheet max-h-[92vh] overflow-y-auto"><button type="button" onClick={() => setSelectedMatch(null)} className="install-close"><X size={18}/></button><p className="text-xs font-black uppercase tracking-[.15em] text-[#9a73ff]">Quick score update</p><h3 className="mt-1 text-xl font-black text-white">{team(selectedMatch.home_team_id)?.team_name || "TBD"} vs {team(selectedMatch.away_team_id)?.team_name || "TBD"}</h3><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><p className="truncate text-xs font-bold text-[#aaa8bc]">{team(selectedMatch.home_team_id)?.short_name || "HOME"}</p><input inputMode="numeric" value={score.home} onChange={(e)=>setScore(s=>({...s,home:e.target.value.replace(/\D/g,"")}))} className="mt-2 w-full rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-center text-3xl font-black text-white"/></div><span className="text-[#77758b]">–</span><div><p className="truncate text-xs font-bold text-[#aaa8bc]">{team(selectedMatch.away_team_id)?.short_name || "AWAY"}</p><input inputMode="numeric" value={score.away} onChange={(e)=>setScore(s=>({...s,away:e.target.value.replace(/\D/g,"")}))} className="mt-2 w-full rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-center text-3xl font-black text-white"/></div></div>{tournament.format.includes("knockout") ? <div className="mt-4 grid grid-cols-2 gap-3"><input inputMode="numeric" value={score.hp} onChange={(e)=>setScore(s=>({...s,hp:e.target.value.replace(/\D/g,"")}))} placeholder="Home pens" className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"/><input inputMode="numeric" value={score.ap} onChange={(e)=>setScore(s=>({...s,ap:e.target.value.replace(/\D/g,"")}))} placeholder="Away pens" className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"/></div> : null}<div className="install-actions"><button type="button" onClick={saveScore} disabled={!isAdmin || saving} className="install-btn-primary">{saving ? "Saving…" : "Save result"}</button><button type="button" onClick={()=>router.push(`/tournaments/${tournament.id}/matches/${selectedMatch.id}`)} className="install-btn-secondary">Detailed match</button></div>{!isAdmin ? <p className="mt-3 text-center text-xs text-[#77758b]">Only the tournament organizer/admin can edit results.</p> : null}</div></div> : null}
    {toast ? <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#35334e] bg-[#14152a] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.5)]">{toast}</div> : null}
  </main>;
}
