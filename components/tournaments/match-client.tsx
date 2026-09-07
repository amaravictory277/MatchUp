"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, MapPin, Plus, Trash2, Trophy } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Match = { id: string; tournament_id: string; round_number: number; position: number; round_label: string; home_team_id?: string | null; away_team_id?: string | null; winner_team_id?: string | null; home_score?: number | null; away_score?: number | null; status: string; scheduled_at?: string | null; venue_id?: string | null; duration_minutes?: number; referee_name?: string | null; home_penalties?: number | null; away_penalties?: number | null };
type Team = { id: string; team_name: string; short_name: string; crest_path?: string | null };
type Event = { id: string; event_type: string; minute: number; tournament_team_id?: string | null; player_id?: string | null };

export function MatchClient() {
  const params = useParams<{ id: string; matchId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [admin, setAdmin] = useState(false);
  const [scores, setScores] = useState({ home: "", away: "", hp: "", ap: "" });
  const [event, setEvent] = useState({ type: "goal", minute: "1", team: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: m, error: me }, { data: t }, { data: ev }, { data: user }] = await Promise.all([
        supabase.from("fixtures").select("id,tournament_id,round_number,position,round_label,home_team_id,away_team_id,winner_team_id,home_score,away_score,status,scheduled_at,venue_id,duration_minutes,referee_name,home_penalties,away_penalties").eq("id", params.matchId).single(),
        supabase.from("tournament_teams").select("id,team_name,short_name,crest_path").eq("tournament_id", params.id).order("seed"),
        supabase.from("match_events").select("id,event_type,minute,tournament_team_id,player_id").eq("fixture_id", params.matchId).order("minute"),
        supabase.auth.getUser(),
      ]);
      if (me) { setMessage(me.message); return; }
      setMatch(m); setTeams(t || []); setEvents(ev || []);
      setScores({ home: m?.home_score == null ? "" : String(m.home_score), away: m?.away_score == null ? "" : String(m.away_score), hp: m?.home_penalties == null ? "" : String(m.home_penalties), ap: m?.away_penalties == null ? "" : String(m.away_penalties) });
      if (user.user && m) setAdmin(!!(await supabase.from("tournament_admins").select("user_id").eq("tournament_id", params.id).eq("user_id", user.user.id).eq("permission", "admin").maybeSingle()).data || (await supabase.from("tournaments").select("organizer_id").eq("id", params.id).single()).data?.organizer_id === user.user.id);
    };
    void load();
  }, [params.id, params.matchId, supabase]);

  const map = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const home = match ? map.get(match.home_team_id || "") : undefined;
  const away = match ? map.get(match.away_team_id || "") : undefined;

  const saveScore = async () => {
    if (!match || !admin) return;
    const h = Number(scores.home); const a = Number(scores.away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) return setMessage("Enter valid scores.");
    let winner = h === a ? null : h > a ? match.home_team_id : match.away_team_id;
    if (h === a) { const hp = Number(scores.hp); const ap = Number(scores.ap); if (!Number.isInteger(hp) || !Number.isInteger(ap) || hp === ap) return setMessage("For a drawn knockout match, enter penalty scores."); winner = hp > ap ? match.home_team_id : match.away_team_id; }
    setSaving(true);
    const { error } = await supabase.from("fixtures").update({ home_score: h, away_score: a, home_penalties: scores.hp ? Number(scores.hp) : null, away_penalties: scores.ap ? Number(scores.ap) : null, winner_team_id: winner, status: "confirmed" }).eq("id", match.id);
    if (error) setMessage(error.message); else { setMatch((m) => m ? { ...m, home_score: h, away_score: a, home_penalties: scores.hp ? Number(scores.hp) : null, away_penalties: scores.ap ? Number(scores.ap) : null, winner_team_id: winner, status: "confirmed" } : m); setMessage("Result saved."); }
    setSaving(false);
  };

  const addEvent = async () => {
    if (!match || !admin || !event.team || !event.minute) return;
    const { data, error } = await supabase.from("match_events").insert({ fixture_id: match.id, event_type: event.type, minute: Number(event.minute), tournament_team_id: event.team }).select("id,event_type,minute,tournament_team_id,player_id").single();
    if (error) setMessage(error.message); else if (data) { setEvents((x) => [...x, data]); setMessage("Match event recorded."); }
  };

  const deleteEvent = async (id: string) => { const { error } = await supabase.from("match_events").delete().eq("id", id); if (!error) setEvents((x) => x.filter((e) => e.id !== id)); };

  if (!match) return <main className="app-shell"><div className="surface-card p-8 text-sm text-[#9694aa]">{message || "Loading match…"}</div></main>;

  return <main className="app-shell pb-28"><div className="mb-4 flex items-center gap-3"><button type="button" onClick={() => router.push(`/tournaments/${params.id}`)} className="icon-button"><ArrowLeft size={18}/></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.15em] text-[#9a73ff]">{match.round_label}</p><h1 className="truncate text-xl font-black text-white">Match Center</h1></div></div>
    <section className="surface-card p-5"><div className="flex items-center justify-between gap-4"><div className="flex flex-1 flex-col items-center gap-2"><img src={home?.crest_path || "/icon.svg"} className="size-16 object-contain"/><span className="text-center text-sm font-black text-white">{home?.team_name || "TBD"}</span></div><div className="text-center"><p className="text-[10px] font-bold uppercase text-[#77758b]">{match.status}</p><div className="mt-2 flex items-center gap-3"><input inputMode="numeric" value={scores.home} onChange={(e)=>setScores(s=>({...s,home:e.target.value.replace(/\D/g,"")}))} className="w-16 rounded-2xl bg-[#0d0e20] p-3 text-center text-3xl font-black text-white"/><span className="text-2xl font-black text-[#77758b]">:</span><input inputMode="numeric" value={scores.away} onChange={(e)=>setScores(s=>({...s,away:e.target.value.replace(/\D/g,"")}))} className="w-16 rounded-2xl bg-[#0d0e20] p-3 text-center text-3xl font-black text-white"/></div></div><div className="flex flex-1 flex-col items-center gap-2"><img src={away?.crest_path || "/icon.svg"} className="size-16 object-contain"/><span className="text-center text-sm font-black text-white">{away?.team_name || "TBD"}</span></div></div>{match.home_score === match.away_score && match.home_score != null ? <div className="mt-4 grid grid-cols-2 gap-3"><input inputMode="numeric" value={scores.hp} onChange={(e)=>setScores(s=>({...s,hp:e.target.value.replace(/\D/g,"")}))} placeholder="Home pens" className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"/><input inputMode="numeric" value={scores.ap} onChange={(e)=>setScores(s=>({...s,ap:e.target.value.replace(/\D/g,"")}))} placeholder="Away pens" className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"/></div> : null}<div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-[#a6a3b7]"><span className="flex items-center gap-1"><Clock3 size={14}/>{match.scheduled_at ? new Date(match.scheduled_at).toLocaleString() : "Kickoff TBA"}</span><span className="flex items-center gap-1"><MapPin size={14}/>Venue TBA</span><span>{match.duration_minutes || 12} min</span>{match.referee_name ? <span>Ref: {match.referee_name}</span> : null}</div>{admin ? <button type="button" onClick={saveScore} disabled={saving} className="mx-auto mt-5 flex items-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-5 py-3 text-xs font-black text-white disabled:opacity-60"><Check size={16}/>{saving ? "Saving…" : "Save result"}</button> : null}</section>

    <section className="mt-4 surface-card p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#9a73ff]">Match events</p><h2 className="mt-1 text-lg font-black text-white">Goals, cards & substitutions</h2></div><Trophy size={20} className="text-[#e5c147]"/></div>{events.length ? <div className="mt-4 space-y-2">{events.map((e)=><div key={e.id} className="flex items-center gap-3 rounded-2xl bg-[#0d0e20] p-3"><span className="grid size-9 place-items-center rounded-xl bg-[#1c1830] text-xs font-black text-[#b58cff]">{e.minute}'</span><div className="flex-1"><p className="text-sm font-bold text-white">{e.event_type.replaceAll("_", " ")}</p><p className="text-[11px] text-[#77758b]">{map.get(e.tournament_team_id || "")?.team_name || "Team"}</p></div>{admin ? <button type="button" onClick={()=>deleteEvent(e.id)} className="text-[#ff6b81]" aria-label="Delete event"><Trash2 size={16}/></button> : null}</div>)}</div> : <p className="mt-4 text-sm text-[#77758b]">No events recorded yet.</p>}{admin ? <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]"><select value={event.type} onChange={(e)=>setEvent(s=>({...s,type:e.target.value}))} className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"><option value="goal">Goal</option><option value="assist">Assist</option><option value="yellow_card">Yellow card</option><option value="red_card">Red card</option><option value="substitution">Substitution</option><option value="penalty_scored">Penalty scored</option><option value="penalty_missed">Penalty missed</option></select><input inputMode="numeric" value={event.minute} onChange={(e)=>setEvent(s=>({...s,minute:e.target.value.replace(/\D/g,"")}))} placeholder="Minute" className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"/><select value={event.team} onChange={(e)=>setEvent(s=>({...s,team:e.target.value}))} className="rounded-2xl border border-[#26263d] bg-[#0d0e20] p-3 text-sm text-white"><option value="">Select team</option>{teams.map((t)=><option key={t.id} value={t.id}>{t.team_name}</option>)}</select><button type="button" onClick={addEvent} className="grid place-items-center rounded-2xl bg-white px-4 text-[#0b0c18]" aria-label="Add event"><Plus size={18}/></button></div> : null}</section>
    {message ? <div className="mt-4 rounded-2xl border border-[#303047] bg-[#121326] p-4 text-sm text-[#c9c6d8]">{message}</div> : null}
  </main>;
}
