"use client";
import { CircleDollarSign, Forward, Gamepad2, Plus, Search, Trophy, Users, Bookmark, Check } from "lucide-react";
import type { MouseEvent, PointerEvent } from "react";
import { useMemo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { MatchUpImage } from "../matchup-image";
import { MatchUpAvatar } from "../ui/matchup-avatar";
import { ContentForwarder } from "../share/content-forwarder";
type Category="boosted"|"featured"|"discover";
type TournamentRow={id:string;tournament_id?:string;name:string;teams?:number;description?:string|null;format:string;status:string;starts_at?:string|null;visibility?:string;max_players:number;organizer_id:string;banner_path?:string|null;game_title?:string|null;prize_pool?:number|null;profiles?:{display_name?:string|null;username?:string|null;avatar_path?:string|null;country?:string|null;currency_code?:string|null}|Array<{display_name?:string|null;username?:string|null;avatar_path?:string|null;country?:string|null;currency_code?:string|null}>|null;promotion_kind?:string|null;promotion_expires_at?:string|null};
function currencyForOrganizer(profile?:{country?:string|null;currency_code?:string|null}|null){
  if(profile?.currency_code) return profile.currency_code;
  const country=(profile?.country||"").trim().toLowerCase();
  const fallback:Record<string,string>={nigeria:"NGN",ghana:"GHS",kenya:"KES","south africa":"ZAR","united kingdom":"GBP","united states":"USD"};
  return fallback[country]||"USD";
}
function formatPrize(value:number, profile?:{country?:string|null;currency_code?:string|null}|null){
  if(value<=0) return "No prize";
  const currency=currencyForOrganizer(profile);
  const locale=currency==="NGN"?"en-NG":currency==="GHS"?"en-GH":currency==="KES"?"en-KE":currency==="ZAR"?"en-ZA":currency==="GBP"?"en-GB":"en-US";
  return new Intl.NumberFormat(locale,{style:"currency",currency,maximumFractionDigits:0}).format(value);
}
function formatName(v:string){return v.replaceAll("_"," ");}
export function TournamentCard({
  row,
  swipeMode = false,
  onOpenOverride,
}: {
  row: TournamentRow;
  swipeMode?: boolean;
  onOpenOverride?: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [saved, setSaved] = useState(false);
  const [menu, setMenu] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantProfiles, setParticipantProfiles] = useState<Array<{id:string;display_name?:string|null;username?:string|null;avatar_path?:string|null}>>([]);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const creator = profile?.display_name || profile?.username || "MatchUp Organizer";
  const creatorAvatar = profile?.avatar_path || null;
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || "";
      const { data: players } = await supabase
        .from("tournament_players")
        .select("player_id,status")
        .eq("tournament_id", row.id)
        .eq("status", "joined")
        .order("joined_at", { ascending: true })
        .limit(128);
      const ids = ((players || []) as Array<{player_id:string}>).map((p) => p.player_id);
      const previewIds = ids.slice(0, 6);
      const { data: profiles } = previewIds.length
        ? await supabase.from("profiles").select("id,display_name,username,avatar_path").in("id", previewIds)
        : { data: [] as Array<{id:string}> };
      if (!cancelled) {
        setParticipantIds(ids);
        setParticipantProfiles((profiles || []) as Array<{id:string;display_name?:string|null;username?:string|null;avatar_path?:string|null}>);
        setJoined(Boolean(uid && ids.includes(uid)));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [row.id, supabase]);

  const joinTournament = async (event?: MouseEvent) => {
    event?.stopPropagation();
    if (joining || joined) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/auth");
      return;
    }
    setJoining(true);
    const { error } = await supabase.rpc("join_tournament", { p_tournament: row.id });
    if (error) {
      setJoining(false);
      window.dispatchEvent(new CustomEvent("matchup-toast", { detail: error.message }));
      return;
    }
    setJoined(true);
    setParticipantIds((ids) => ids.includes(auth.user.id) ? ids : [...ids, auth.user.id]);
    setJoining(false);
  };

  const save = async () => {
    const { data: a } = await supabase.auth.getUser();
    if (!a.user) {
      router.push("/auth");
      return;
    }
    const result = saved
      ? await supabase.from("saved_tournaments").delete().eq("user_id", a.user.id).eq("tournament_id", row.id)
      : await supabase.from("saved_tournaments").insert({ user_id: a.user.id, tournament_id: row.id });
    if (!result.error) setSaved(!saved);
  };

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const down = (e: PointerEvent) => {
    if (swipeMode && e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    if (!swipeMode) {
      cancel();
      timer.current = setTimeout(() => {
        if (!moved.current) {
          setMenu(true);
          navigator.vibrate?.(12);
        }
      }, 600);
    }
  };

  const move = (e: PointerEvent) => {
    if (!start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 14) {
      moved.current = true;
      cancel();
    }
  };

  const up = () => {
    cancel();
    start.current = null;
  };

  const open = () => {
    if (onOpenOverride) {
      onOpenOverride();
      return;
    }
    router.push(`/tournaments/${row.id}`);
  };

  const startsAt = row.starts_at ? new Date(row.starts_at) : null;
  const dateLabel = startsAt && !Number.isNaN(startsAt.getTime())
    ? startsAt.toLocaleDateString([], { month: "short", day: "numeric" })
    : "Date TBA";
  const timeLabel = startsAt && !Number.isNaN(startsAt.getTime())
    ? startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Time TBA";
  const prizeValue = Number(row.prize_pool || 0);
  const prizeLabel = formatPrize(prizeValue, profile);

  return (
    <article
      className="group relative w-full overflow-hidden rounded-[28px] bg-[#071426] text-left shadow-[0_24px_70px_rgba(0,25,55,.34)]"
      onPointerDown={swipeMode ? undefined : down}
      onPointerMove={swipeMode ? undefined : move}
      onPointerUp={swipeMode ? undefined : up}
      onPointerCancel={swipeMode ? undefined : () => { cancel(); moved.current = true; }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(event) => { if (swipeMode && event.detail > 0) { event.stopPropagation(); return; } open(); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") open(); }}
        className="relative"
      >
        <div className="relative h-[214px] overflow-hidden sm:h-[250px]">
          <MatchUpImage src="/1002371685.jpg" alt="Football players ready for a match" className="h-full w-full" brandPosition="center" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,24,.12)_0%,rgba(3,12,24,.08)_30%,rgba(7,20,38,.42)_62%,#071426_100%)]" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#071426]/78 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#d7edff] shadow-lg backdrop-blur-md">
              <Trophy size={13} className="text-[#70c1ff]" />
              {formatName(row.format)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#071426]/78 px-3 py-1.5 text-[10px] font-black text-[#d7edff] shadow-lg backdrop-blur-md">
              <Gamepad2 size={13} className="text-[#70c1ff]" />
              {row.game_title || "Football"}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#071426] to-transparent" />
        </div>

        <div className="relative -mt-1 px-4 pb-3.5 sm:px-5 sm:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#47a8ff]">Football tournament</p>
              <h2 className="mt-1 text-[23px] font-black leading-[1.05] tracking-[-.025em] text-white sm:text-[26px]">{row.name}</h2>
              {row.description ? <p className="mt-2 line-clamp-2 max-w-[620px] text-[12px] leading-5 text-[#9db2c7] sm:text-[13px]">{row.description}</p> : null}
            </div>

            <div className="shrink-0 rounded-2xl bg-[#0b2139] px-3 py-2 text-right shadow-inner">
              <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#66809a]">{dateLabel}</p>
              <p className="mt-0.5 text-[11px] font-black text-white">{timeLabel}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users size={15} className="shrink-0 text-[#70c1ff]" />
                <span className="text-[12px] font-black text-white">{participantIds.length}/{row.max_players} players</span>
              </div>
              <div className="mt-2 flex items-center">
                {participantProfiles.map((participant) => (
                  <MatchUpAvatar
                    key={participant.id}
                    profile={participant}
                    size="sm"
                    alt={participant.display_name || participant.username || "Player"}
                    className="-ml-2 !size-8 border-2 border-[#071426] first:ml-0"
                  />
                ))}
                {participantIds.length > participantProfiles.length ? (
                  <span className="-ml-2 grid size-8 place-items-center rounded-full border-2 border-[#071426] bg-[#12385a] text-[9px] font-black text-[#bfe3ff]">
                    +{participantIds.length - participantProfiles.length}
                  </span>
                ) : null}
                {!participantIds.length ? <span className="ml-2 text-[10px] font-semibold text-[#66809a]">Be the first to join</span> : null}
              </div>
            </div>

            <div className="text-right">
              <p className="mb-1 text-[9px] font-black uppercase tracking-[.14em] text-[#66809a]">Price</p>
              <div className="inline-flex min-w-[148px] items-center justify-end gap-1.5 rounded-2xl bg-[#0b2139] px-3 py-2.5 shadow-inner">
                <CircleDollarSign size={16} className="shrink-0 text-[#70c1ff]" />
                <span className="text-[32px] font-black leading-none tracking-[-.04em] text-white sm:text-[40px]">{prizeLabel}</span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => void joinTournament(event)}
              disabled={joining || joined || row.status === "full"}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-5 py-3 text-[12px] font-black uppercase tracking-[.04em] text-white shadow-[0_10px_28px_rgba(36,151,255,.22)] transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {joined ? <Check size={15} /> : null}
              {joining ? "Joining…" : joined ? "Joined Tournament" : row.status === "full" ? "Tournament Full" : "Join Tournament"}
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 text-[10px] text-[#66809a]">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {creatorAvatar ? <MatchUpAvatar profile={{ id: row.organizer_id, display_name: creator, username: profile?.username || null, avatar_path: creatorAvatar }} size="sm" alt={creator} className="!size-[19px] shrink-0 border border-[#1d4d78]" /> : <span className="size-[19px] shrink-0 rounded-full bg-[#12385a]" />}
              <span className="truncate">Organized by {creator}</span>
            </span>
            <span className="shrink-0 font-bold capitalize text-[#86a1bb]">{formatName(row.status)}</span>
          </div>
        </div>
      </div>

      {!swipeMode && menu ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setMenu(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-[#08182b] p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { setForwardOpen(true); setMenu(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm font-black text-white"><Forward size={18}/>Forward tournament</button>
            <button type="button" onClick={() => { void save(); setMenu(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm font-black text-white"><Bookmark size={18}/>{saved ? "Remove saved tournament" : "Save tournament"}</button>
            <button type="button" onClick={() => setMenu(false)} className="flex w-full items-center justify-center rounded-2xl p-3 text-sm font-bold text-[#a9bdd5]">Cancel</button>
          </div>
        </div>
      ) : null}

      <ContentForwarder open={forwardOpen} onClose={() => setForwardOpen(false)} title={`Tournament: ${row.name}`} contentUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/tournaments/${row.id}`} />
    </article>
  );
}

export function TournamentListingPage({category,title}:{category:Category;title:string}){const router=useRouter();const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);const [rows,setRows]=useState<TournamentRow[]>([]);const [query,setQuery]=useState("");const [loading,setLoading]=useState(true);const [idMode,setIdMode]=useState(false);useEffect(()=>{setIdMode(new URLSearchParams(window.location.search).get("mode")==="id");},[]);useEffect(()=>{let mounted=true;const load=async()=>{const {data}=await supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,banner_path,game_title,prize_pool,profiles:organizer_id(display_name,username,avatar_path,country,currency_code)").eq("visibility","public").order("created_at",{ascending:false}).limit(100);if(mounted){setRows((data||[]) as TournamentRow[]);setLoading(false);}};void load();return()=>{mounted=false;};},[supabase]);const filtered=rows.filter(r=>!query.trim()||`${r.name} ${r.tournament_id} ${r.format} ${r.game_title||""} ${r.description||""}`.toLowerCase().includes(query.trim().toLowerCase()));return <main className="app-shell pb-28"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#47a8ff]">MatchUp Tournaments</p><h1 className="mt-1 text-3xl font-black text-white">{title}</h1><p className="mt-1 max-w-xl text-sm leading-6 text-[#86a1bb]">Browse real public tournaments and find your next competition.</p></div><Link href="/tournaments/new" className="hidden items-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3 text-xs font-black text-white sm:flex"><Plus size={15}/>Create</Link></div><div className="mt-5 flex gap-3"><label className="flex flex-1 items-center gap-2 rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3"><Search size={17} className="text-[#47a8ff]"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none" placeholder={idMode?"Paste tournament ID":"Search tournaments"}/></label><button type="button" onClick={()=>router.push("/tournaments/new")} className="rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3 text-xs font-black text-white">Create</button></div>{loading?<div className="surface-card mt-7 border-[#153c68] p-8 text-center text-sm text-[#7892ac]">Loading tournaments…</div>:filtered.length?<div className="mt-7 grid gap-4 sm:grid-cols-2">{filtered.map(row=><TournamentCard key={row.id} row={row}/>)}</div>:<div className="surface-card mt-7 border-[#153c68] p-8 text-center"><Search className="mx-auto text-[#47a8ff]"/><p className="mt-3 font-bold text-white">No tournaments found</p><p className="mt-1 text-sm text-[#7892ac]">Try a different search.</p></div>}</main>;}
