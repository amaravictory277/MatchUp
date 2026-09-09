"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ImagePlus, Search, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { builtinTeams, teamCountries, teamLeagues, type BuiltinTeam } from "../../lib/tournament/teams";
import { groupsFromTeams, roundRobin, singleElimination } from "../../lib/tournament/engine";

const formats = [
  { id: "league", label: "League", help: "Everyone plays the configured schedule." },
  { id: "round_robin", label: "Round Robin", help: "Each team plays every other team once." },
  { id: "group_stage", label: "Group Stage", help: "Split teams into groups and generate matchdays." },
  { id: "knockout", label: "Knockout", help: "Single-elimination bracket with rounds to a champion." },
  { id: "single_elimination", label: "Single Elimination", help: "One loss and a team is out." },
  { id: "double_elimination", label: "Double Elimination", help: "Winners and losers paths; bracket data remains extensible." },
  { id: "groups_knockout", label: "Group + Knockout", help: "Group phase first, then a knockout phase." },
] as const;
const games = ["Football", "eFootball", "EA SPORTS FC", "FIFA", "Other"] as const;
type Selected = BuiltinTeam & { selectedId: string };

export function CreateTournament() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gameTitle, setGameTitle] = useState<(typeof games)[number]>("Football");
  const [prizePool, setPrizePool] = useState("0");
  const [format, setFormat] = useState<(typeof formats)[number]["id"]>("league");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "invite_only">("public");
  const [maxTeams, setMaxTeams] = useState(16);
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState("All leagues");
  const [country, setCountry] = useState("All countries");
  const [selected, setSelected] = useState<Selected[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ name: "", shortName: "", country: "", city: "", logo: null as File | null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => builtinTeams.filter((team) => {
    const q = search.trim().toLowerCase();
    return (!q || team.fullName.toLowerCase().includes(q) || team.shortName.toLowerCase().includes(q) || team.searchKeywords.some((k) => k.toLowerCase().includes(q))) && (league === "All leagues" || team.league === league) && (country === "All countries" || team.country === country);
  }).slice(0, 80), [search, league, country]);
  const isSelected = (id: string) => selected.some((t) => t.id === id);
  const addBuiltin = (team: BuiltinTeam) => { if (isSelected(team.id) || selected.length >= maxTeams) return; setSelected((prev) => [...prev, { ...team, selectedId: team.id }]); };
  const remove = (selectedId: string) => setSelected((prev) => prev.filter((t) => t.selectedId !== selectedId));

  const addCustom = async () => {
    if (!custom.name.trim() || !custom.shortName.trim() || !custom.country.trim()) return;
    if (selected.length >= maxTeams) throw new Error(`Maximum ${maxTeams} teams selected.`);
    const id = `custom-${crypto.randomUUID()}`;
    let logoPath = "";
    if (custom.logo) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in before uploading a custom logo.");
      if (!custom.logo.type.startsWith("image/")) throw new Error("Team logo must be an image.");
      if (custom.logo.size > 5 * 1024 * 1024) throw new Error("Team logo must be 5 MB or smaller.");
      const safeName = custom.logo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userData.user.id}/${id}-${safeName}`;
      const upload = await supabase.storage.from("team-logos").upload(path, custom.logo, { upsert: false });
      if (upload.error) throw upload.error;
      logoPath = upload.data.path;
    }
    const customTeam: Selected = { id, fullName: custom.name.trim(), shortName: custom.shortName.trim(), country: custom.country.trim(), league: "Custom", crestUrl: logoPath ? supabase.storage.from("team-logos").getPublicUrl(logoPath).data.publicUrl : "", searchKeywords: [custom.name, custom.shortName, custom.country, custom.city], selectedId: id };
    setSelected((prev) => [...prev, customTeam]);
    setCustom({ name: "", shortName: "", country: "", city: "", logo: null });
    setCustomOpen(false);
  };

  const save = async () => {
    setError("");
    const amount = Number(prizePool);
    if (name.trim().length < 3) return setError("Tournament name must be at least 3 characters.");
    if (selected.length < 2) return setError("Add at least 2 teams before creating the tournament.");
    if (!Number.isFinite(amount) || amount < 0) return setError("Prize pool must be zero or a positive amount.");
    if (amount > 9999999999) return setError("Prize pool is too large.");
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in before creating a tournament.");
      const seedById = new Map(selected.map((team, index) => [team.id, index + 1]));
      const seedFixtures = (fixtures: ReturnType<typeof roundRobin>) => fixtures.map((fixture) => ({ round_number: fixture.round_number, position: fixture.position, round_label: fixture.round_label, group_name: fixture.group_name ?? "", home_seed: fixture.home_team_id ? seedById.get(fixture.home_team_id) ?? null : null, away_seed: fixture.away_team_id ? seedById.get(fixture.away_team_id) ?? null : null })).filter((fixture) => fixture.home_seed && fixture.away_seed);
      const teamIds = selected.map((team) => team.id);
      const generated = format === "knockout" || format === "single_elimination" || format === "double_elimination" ? singleElimination(teamIds) : format === "group_stage" || format === "groups_knockout" ? groupsFromTeams(teamIds).fixtures : roundRobin(teamIds);
      const teamRows = selected.map((team, index) => ({ builtin_team_id: team.id.startsWith("custom-") ? "" : team.id, team_name: team.fullName, short_name: team.shortName, country: team.country, league: team.league, city: team.id.startsWith("custom-") ? team.searchKeywords[3] || "" : "", crest_path: team.crestUrl, seed: index + 1 }));
      const { data: tournamentId, error: createError } = await supabase.rpc("create_tournament_atomic", {
        p_name: name.trim(), p_description: description.trim(), p_format: format, p_max_players: maxTeams,
        p_starts_at: startsAt ? new Date(startsAt).toISOString() : null, p_visibility: visibility,
        p_entry_information: location.trim(), p_game_title: gameTitle, p_prize_pool: amount,
        p_teams: teamRows, p_fixtures: seedFixtures(generated),
      });
      if (createError) throw createError;
      if (!tournamentId) throw new Error("The tournament could not be confirmed by the server.");
      router.push(`/tournaments/${tournamentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tournament. Nothing was saved.");
    } finally { setSaving(false); }
  };

  const field = "mt-2 w-full rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3 text-white outline-none transition focus:border-[#2491ff]";
  return <main className="app-shell pb-28">
    <div className="mb-5 flex items-center gap-3"><button type="button" onClick={() => router.push("/tournaments")} className="icon-button" aria-label="Back to tournaments"><ArrowLeft size={18} /></button><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#47a8ff]">New tournament</p><h1 className="text-2xl font-black text-white">Build your competition</h1></div></div>
    <section className="surface-card space-y-5 p-5">
      <div><label className="text-xs font-bold text-[#a9bdd5]">Tournament name</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="MatchUp Champions Cup" /></div>
      <div><label className="text-xs font-bold text-[#a9bdd5]">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${field} resize-none text-sm`} placeholder="What makes this tournament special?" /></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-bold text-[#a9bdd5]">Game</label><div className="relative"><select value={gameTitle} onChange={(e) => setGameTitle(e.target.value as (typeof games)[number])} className={`${field} appearance-none`}>{games.map((game) => <option key={game}>{game}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-5 text-[#7194b9]" size={17} /></div></div><div><label className="text-xs font-bold text-[#a9bdd5]">Prize pool</label><input type="number" min="0" step="0.01" inputMode="decimal" value={prizePool} onChange={(e) => setPrizePool(e.target.value)} className={field} placeholder="0" /><p className="mt-1 text-[11px] text-[#7187a0]">Use 0 for a free/no-prize tournament.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-bold text-[#a9bdd5]">Format</label><div className="relative"><select value={format} onChange={(e) => setFormat(e.target.value as (typeof formats)[number]["id"])} className={`${field} appearance-none`}>{formats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-5 text-[#7194b9]" size={17} /></div><p className="mt-1 text-xs text-[#7187a0]">{formats.find((f) => f.id === format)?.help}</p></div><div><label className="text-xs font-bold text-[#a9bdd5]">Maximum teams</label><input type="number" min={2} max={128} value={maxTeams} onChange={(e) => setMaxTeams(Math.min(128, Math.max(2, Number(e.target.value))))} className={field} /></div></div>
      <div className="grid gap-3 sm:grid-cols-3"><div><label className="text-xs font-bold text-[#a9bdd5]">Start date & time</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} /></div><div><label className="text-xs font-bold text-[#a9bdd5]">Location / venue</label><input value={location} onChange={(e) => setLocation(e.target.value)} className={field} placeholder="Lagos, Nigeria" /></div><div><label className="text-xs font-bold text-[#a9bdd5]">Visibility</label><select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className={field}><option value="public">Public</option><option value="private">Private</option><option value="invite_only">Invite only</option></select></div></div>
    </section>
    <section className="mt-5 surface-card p-5">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#47a8ff]">Team library</p><h2 className="text-xl font-black text-white">Choose your teams</h2><p className="mt-1 text-xs text-[#7187a0]">{selected.length}/{maxTeams} selected · duplicates are blocked</p></div><button type="button" onClick={() => setCustomOpen(true)} className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#061120]">Add custom team</button></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1"><div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-[#18365f] bg-[#071426] px-3"><Search size={17} className="text-[#7194b9]" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" placeholder="Search Arsenal, Bayern, Enyimba..." /></div><select value={league} onChange={(e) => setLeague(e.target.value)} className="rounded-2xl border border-[#18365f] bg-[#071426] px-3 text-xs text-[#a9bdd5]"><option>All leagues</option>{teamLeagues.map((x) => <option key={x}>{x}</option>)}</select><select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-2xl border border-[#18365f] bg-[#071426] px-3 text-xs text-[#a9bdd5]"><option>All countries</option>{teamCountries.map((x) => <option key={x}>{x}</option>)}</select></div>
      {selected.length ? <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{selected.map((team, i) => <div key={team.selectedId} className="flex min-w-[190px] items-center gap-3 rounded-2xl border border-[#174a7d] bg-[#0a1c33] p-3"><img src={team.crestUrl || "/icon.svg"} alt="" className="size-10 rounded-full bg-white/5 object-contain p-1" onError={(e) => { e.currentTarget.src = "/icon.svg"; }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{i + 1}. {team.fullName}</p><p className="text-[11px] text-[#7187a0]">{team.country} · {team.league}</p></div><button type="button" onClick={() => remove(team.selectedId)} className="text-[#7187a0] hover:text-white" aria-label={`Remove ${team.fullName}`}><X size={16} /></button></div>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#1d426b] p-6 text-center text-sm text-[#7187a0]">No teams added yet. Pick from the library or create your own.</div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{filtered.map((team) => <button key={team.id} type="button" onClick={() => isSelected(team.id) ? remove(team.id) : addBuiltin(team)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${isSelected(team.id) ? "border-[#248fe8] bg-[#0b2745]" : "border-[#18365f] bg-[#071426] hover:border-[#245b91]"}`}><img src={team.crestUrl} alt="" className="size-11 rounded-full bg-white/5 object-contain p-1" onError={(e) => { e.currentTarget.src = "/icon.svg"; }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{team.fullName}</p><p className="text-[11px] text-[#7187a0]">{team.country} · {team.league}</p></div>{isSelected(team.id) ? <span className="grid size-7 place-items-center rounded-full bg-[#167bd1] text-white"><Check size={15} /></span> : <span className="text-xs font-bold text-[#7194b9]">Add</span>}</button>)}</div>
    </section>
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-[#6f2b3b] bg-[#26131a] p-4 text-sm text-[#ff9bad]">{error}</div> : null}
    <div className="mt-5 flex gap-3"><button type="button" onClick={() => router.push("/tournaments")} className="flex-1 rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3 text-sm font-bold text-[#a9bdd5]">Cancel</button><button type="button" onClick={save} disabled={saving} className="flex-[1.5] rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? "Creating…" : "Create tournament"}</button></div>
    {customOpen ? <div className="install-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCustomOpen(false); }}><div className="install-sheet max-h-[90vh] overflow-y-auto"><button type="button" onClick={() => setCustomOpen(false)} className="install-close" aria-label="Close"><X size={18} /></button><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#47a8ff]">Custom club</p><h3 className="mt-1 text-xl font-black text-white">Add your own team</h3></div><div className="mt-4 grid gap-3"><input value={custom.name} onChange={(e) => setCustom((s) => ({ ...s, name: e.target.value }))} placeholder="Team name" className={field} /><input value={custom.shortName} onChange={(e) => setCustom((s) => ({ ...s, shortName: e.target.value }))} placeholder="Short name" className={field} /><input value={custom.country} onChange={(e) => setCustom((s) => ({ ...s, country: e.target.value }))} placeholder="Country" className={field} /><input value={custom.city} onChange={(e) => setCustom((s) => ({ ...s, city: e.target.value }))} placeholder="City / location" className={field} /><label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#245b91] bg-[#071426] p-4 text-sm text-[#a9bdd5]"><ImagePlus size={20} className="text-[#47a8ff]" /><span className="flex-1">Upload your own logo</span><input type="file" accept="image/*" className="hidden" onChange={(e) => setCustom((s) => ({ ...s, logo: e.target.files?.[0] || null }))} />{custom.logo ? <span className="max-w-[45%] truncate text-xs font-bold text-white">{custom.logo.name}</span> : null}</label></div><div className="install-actions"><button type="button" onClick={async () => { try { await addCustom(); } catch (e) { setError(e instanceof Error ? e.message : "Could not add team."); } }} className="install-btn-primary">Add team</button><button type="button" onClick={() => setCustomOpen(false)} className="install-btn-secondary">Cancel</button></div></div></div> : null}
  </main>;
}
