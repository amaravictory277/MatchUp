"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Trophy, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

const formats = [["league", "League"], ["round_robin", "Round Robin"], ["knockout", "Knockout"], ["single_elimination", "Single Elimination"]] as const;
type Profile = { id: string; display_name?: string | null; username?: string | null };
type Group = { id: string; name: string; created_by: string; member_limit: number };

export function GroupTournamentCreator() {
  const router = useRouter();
  const params = useSearchParams();
  const groupId = params.get("groupId") || "";
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [game, setGame] = useState("Football");
  const [format, setFormat] = useState<(typeof formats)[number][0]>("round_robin");
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [startsAt, setStartsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !groupId) { if (!cancelled) setError("Open Create Tournament from a group chat while signed in."); return; }
      const [{ data: g }, { data: rows }, { data: mine }] = await Promise.all([
        supabase.from("chat_groups").select("id,name,created_by,member_limit").eq("id", groupId).eq("kind", "group").maybeSingle(),
        supabase.from("chat_group_members").select("user_id,profiles(id,display_name,username)").eq("group_id", groupId).limit(200),
        supabase.from("chat_group_members").select("user_id").eq("group_id", groupId).eq("user_id", auth.user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (!g || !mine) { setError("You must be a member of this group to create a tournament from it."); return; }
      setGroup(g as Group);
      setMembers((rows || []).map((r: any) => r.profiles as Profile).filter((p: Profile | null) => Boolean(p && p.id !== auth.user.id)));
    })();
    return () => { cancelled = true; };
  }, [groupId, supabase]);

  const toggle = (id: string) => setSelected((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id]);
  const create = async () => {
    setError("");
    if (!groupId || !group) return setError("A valid group is required.");
    if (selected.length < 1) return setError("Add at least one person from this group before creating the tournament.");
    if (name.trim().length < 3) return setError("Tournament name must be at least 3 characters.");
    setSaving(true);
    try {
      const { data, error: e } = await supabase.rpc("create_group_tournament", {
        p_name: name.trim(), p_description: `Created from ${group.name}`, p_format: format,
        p_max_players: Math.max(2, maxPlayers), p_starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        p_visibility: "invite_only", p_entry_information: `Group tournament: ${group.name}`,
        p_game_title: game, p_prize_pool: 0, p_group_id: groupId, p_participant_ids: selected,
      });
      if (e) throw e;
      if (!data) throw new Error("Tournament creation was not confirmed by the server.");
      router.push(`/tournaments/${data}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the tournament."); }
    finally { setSaving(false); }
  };

  return <main className="app-shell pb-28">
    <div className="mb-5 flex items-center gap-3"><button type="button" onClick={() => router.back()} className="icon-button" aria-label="Back"><ArrowLeft size={18} /></button><div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--accent)]">Group tournament</p><h1 className="text-2xl font-black">Create from your group</h1></div></div>
    {error && <div className="mb-4 rounded-2xl border border-[#6f3b18] bg-[#2b170d] p-4 text-sm text-[#ffd0a6]">{error}</div>}
    {group && <section className="surface-card mb-4 p-5"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Trophy size={22}/></div><div><p className="text-xs text-[var(--muted)]">Creating from</p><h2 className="text-lg font-black">{group.name}</h2><p className="text-xs text-[var(--muted)]">{members.length + 1}/{group.member_limit} group members</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Tournament name<input value={name} onChange={e=>setName(e.target.value)} placeholder={`${group.name} Cup`} className="theme-field"/></label>
      <label className="text-xs font-bold">Game<input value={game} onChange={e=>setGame(e.target.value)} className="theme-field"/></label>
      <label className="text-xs font-bold">Format<select value={format} onChange={e=>setFormat(e.target.value as typeof format)} className="theme-field">{formats.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="text-xs font-bold">Maximum players<input type="number" min={2} max={128} value={maxPlayers} onChange={e=>setMaxPlayers(Math.min(128,Math.max(2,Number(e.target.value))))} className="theme-field"/></label>
      <label className="text-xs font-bold sm:col-span-2">Start date & time<input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="theme-field"/></label>
    </div></section>}
    <section className="surface-card p-5"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[var(--accent)]">Required step</p><h2 className="text-xl font-black">Invite group members</h2><p className="mt-1 text-xs text-[var(--muted)]">Select at least one person. They will receive an invitation and must accept before joining.</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent)]">{selected.length} selected</span></div>
      <div className="mt-4 space-y-2">{members.length ? members.map(member => <button key={member.id} type="button" onClick={()=>toggle(member.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected.includes(member.id)?"border-[var(--accent)] bg-[var(--accent-soft)]":"border-[var(--line)] bg-[var(--panel)]"}`}><span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-black text-[var(--accent)]">{(member.display_name||member.username||"M").slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate">{member.display_name||member.username||"Member"}</strong><small className="text-xs text-[var(--muted)]">@{member.username||"player"}</small></span>{selected.includes(member.id)?<Check className="text-[var(--accent)]" size={18}/>:<Users className="text-[var(--muted)]" size={17}/>}</button>) : <div className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">No other members are available in this group yet.</div>}</div>
      <button type="button" onClick={()=>void create()} disabled={saving || selected.length<1 || !group} className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-sm font-black text-[#241205] disabled:opacity-40">{saving?"Creating…":"Create Tournament & Send Invites"}</button><p className="mt-3 text-center text-[11px] text-[var(--muted)]">No one is added automatically. Each selected person must accept.</p>
    </section>
  </main>;
}
