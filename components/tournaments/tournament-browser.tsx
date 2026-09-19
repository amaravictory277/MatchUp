"use client";
import { CalendarDays, Forward, Gamepad2, Plus, Search, Trophy, Users, Bookmark } from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { MatchUpImage } from "../matchup-image";
import { MatchUpAvatar } from "../ui/matchup-avatar";
import { ContentForwarder } from "../share/content-forwarder";
type Category="boosted"|"featured"|"discover";
type TournamentRow={id:string;tournament_id?:string;name:string;description?:string|null;format:string;status:string;starts_at?:string|null;visibility?:string;max_players:number;organizer_id:string;banner_path?:string|null;game_title?:string|null;prize_pool?:number|null;profiles?:{display_name?:string|null;username?:string|null;avatar_path?:string|null}|Array<{display_name?:string|null;username?:string|null;avatar_path?:string|null}>|null;promotion_kind?:string|null;promotion_expires_at?:string|null};
function formatName(v:string){return v.replaceAll("_"," ");}function money(v:number){return v>0?`₦${v.toLocaleString("en-NG",{maximumFractionDigits:2})}`:"No prize";}
function storageUrl(supabase: ReturnType<typeof createBrowserSupabaseClient>, path: string | null){
  if(!path)return null;
  if(path.startsWith("http://")||path.startsWith("https://")||path.startsWith("/"))return path;
  return supabase.storage.from("tournament-media").getPublicUrl(path).data.publicUrl;
}
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const creator = profile?.display_name || profile?.username || "MatchUp Organizer";
  const bannerUrl = storageUrl(supabase, row.banner_path || null);
  const creatorProfile = {
    id: row.organizer_id,
    display_name: creator,
    username: profile?.username || null,
    avatar_path: profile?.avatar_path || null,
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: a } = await supabase.auth.getUser();
      if (!a.user) return;
      const { data } = await supabase.from("saved_tournaments").select("tournament_id").eq("user_id", a.user.id).eq("tournament_id", row.id).maybeSingle();
      if (!cancelled) setSaved(Boolean(data));
    };
    void load();
    return () => { cancelled = true; };
  }, [row.id, supabase]);

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

  const down = (e: React.PointerEvent) => {
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

  const move = (e: React.PointerEvent) => {
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

  return (
    <article
      className="group w-full overflow-hidden rounded-[24px] border border-[#245b91] bg-[#071426] text-left shadow-[0_18px_50px_rgba(0,35,75,.22)]"
      onPointerDown={swipeMode ? undefined : down}
      onPointerMove={swipeMode ? undefined : move}
      onPointerUp={swipeMode ? undefined : up}
      onPointerCancel={swipeMode ? undefined : () => { cancel(); moved.current = true; }}
      onContextMenu={e => e.preventDefault()}
    >
      <div role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") open(); }}>
        <div className="relative h-[182px] overflow-hidden bg-[#061120] sm:h-[220px]">
          {bannerUrl ? <MatchUpImage src={bannerUrl} className="h-full bg-[#0b223c]" /> : <div className="grid h-full place-items-center bg-[#061120]"><img src="/matchup-logo.svg" alt="MatchUp" className="w-44 opacity-65" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#071426] via-[#071426]/20 to-[#071426]/15" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-[#2b8ee6]/70 bg-[#082a4b]/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-[#9bd3ff]">
            {badge}
          </span>
          <div className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-[#2b8ee6]/60 bg-[#071426]/75 text-[#70c1ff] backdrop-blur-sm">
            <Trophy size={21} strokeWidth={2.2} />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <h2 className="text-[22px] font-black leading-tight tracking-[-.02em] text-white">{row.name}</h2>
          <p className="mt-1 line-clamp-1 text-sm leading-5 text-[#86a1bb]">{row.description || "Open MatchUp football competition."}</p>

          <div className="mt-3 inline-flex max-w-full items-center gap-4 rounded-xl border border-[#214a78] bg-[#08182b] px-3 py-2.5 text-xs font-bold text-[#b7c9da]">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Users size={14} className="text-[#70c1ff]" />{row.max_players} teams</span>
            <span className="h-4 w-px bg-[#214a78]" />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Gamepad2 size={14} className="text-[#70c1ff]" />{row.game_title || "Football"}</span>
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="rounded-xl border border-[#214a78] bg-[#08182b] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7892ac]">Prize</p>
              <p className="mt-0.5 text-base font-black text-white">{money(Number(row.prize_pool || 0))}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#214a78] bg-[#08182b] px-3 py-2 text-xs font-bold text-[#a9bdd5]">
              <CalendarDays size={14} className="text-[#70c1ff]" />
              {row.starts_at ? new Date(row.starts_at).toLocaleDateString() : "Date TBA"}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <MatchUpAvatar profile={creatorProfile} size="sm" alt={creator} className="!size-8 shrink-0 rounded-full" />
              <span className="truncate text-sm font-black text-white">{creator}</span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-xl border border-[#245b91] bg-[#0a2946] px-3 py-2 text-[11px] font-black capitalize text-[#9bd3ff]">
              {formatName(row.status)}
            </span>
          </div>
        </div>
      </div>

      {!swipeMode && menu ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setMenu(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-[#194b7c] bg-[#08182b] p-3" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => { setForwardOpen(true); setMenu(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm font-black text-white"><Forward size={18}/>Forward tournament</button>
            <button type="button" onClick={() => { void save(); setMenu(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm font-black text-white"><Bookmark size={18}/>{saved ? "Remove saved tournament" : "Save tournament"}</button>
            <button type="button" onClick={() => setMenu(false)} className="flex w-full items-center justify-center rounded-2xl border border-[#18365f] p-3 text-sm font-bold text-[#a9bdd5]">Cancel</button>
          </div>
        </div>
      ) : null}
      <ContentForwarder open={forwardOpen} onClose={() => setForwardOpen(false)} title={`Tournament: ${row.name}`} contentUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/tournaments/${row.id}`} />
    </article>
  );
}

export function TournamentListingPage({category,title}:{category:Category;title:string}){const router=useRouter();const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);const [rows,setRows]=useState<TournamentRow[]>([]);const [query,setQuery]=useState("");const [loading,setLoading]=useState(true);const [idMode,setIdMode]=useState(false);useEffect(()=>{setIdMode(new URLSearchParams(window.location.search).get("mode")==="id");},[]);useEffect(()=>{let mounted=true;const load=async()=>{const {data}=await supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,banner_path,game_title,prize_pool,profiles:organizer_id(display_name,username)").eq("visibility","public").order("created_at",{ascending:false}).limit(100);if(mounted){setRows((data||[]) as TournamentRow[]);setLoading(false);}};void load();return()=>{mounted=false;};},[supabase]);const filtered=rows.filter(r=>!query.trim()||`${r.name} ${r.tournament_id} ${r.format} ${r.game_title||""} ${r.description||""}`.toLowerCase().includes(query.trim().toLowerCase()));return <main className="app-shell pb-28"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#47a8ff]">MatchUp Tournaments</p><h1 className="mt-1 text-3xl font-black text-white">{title}</h1><p className="mt-1 max-w-xl text-sm leading-6 text-[#86a1bb]">Browse real public tournaments and find your next competition.</p></div><Link href="/tournaments/new" className="hidden items-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3 text-xs font-black text-white sm:flex"><Plus size={15}/>Create</Link></div><div className="mt-5 flex gap-3"><label className="flex flex-1 items-center gap-2 rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3"><Search size={17} className="text-[#47a8ff]"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none" placeholder={idMode?"Paste tournament ID":"Search tournaments"}/></label><button type="button" onClick={()=>router.push("/tournaments/new")} className="rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3 text-xs font-black text-white">Create</button></div>{loading?<div className="surface-card mt-7 border-[#153c68] p-8 text-center text-sm text-[#7892ac]">Loading tournaments…</div>:filtered.length?<div className="mt-7 grid gap-4 sm:grid-cols-2">{filtered.map(row=><TournamentCard key={row.id} row={row} category={category}/>)}</div>:<div className="surface-card mt-7 border-[#153c68] p-8 text-center"><Search className="mx-auto text-[#47a8ff]"/><p className="mt-3 font-bold text-white">No tournaments found</p><p className="mt-1 text-sm text-[#7892ac]">Try a different search.</p></div>}</main>;}
