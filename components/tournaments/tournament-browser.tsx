"use client";

import { CalendarDays, Gamepad2, Trophy, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { MatchUpImage } from "../matchup-image";

type Category = "boosted" | "featured" | "discover";
type TournamentRow = { id:string;tournament_id:string;name:string;description?:string|null;format:string;status:string;starts_at?:string|null;visibility:string;max_players:number;organizer_id:string;banner_path?:string|null;game_title?:string|null;prize_pool?:number|null;profiles?:{display_name?:string|null;username?:string|null}|Array<{display_name?:string|null;username?:string|null}>|null;promotion_kind?:string|null;promotion_expires_at?:string|null };
function profileName(row:TournamentRow){const p=Array.isArray(row.profiles)?row.profiles[0]:row.profiles;return p?.display_name||p?.username||"MatchUp Organizer";}
function formatName(v:string){return v.replaceAll("_"," ");}
function money(v:number){return v>0?`₦${v.toLocaleString("en-NG",{maximumFractionDigits:2})}`:"No prize";}
export function TournamentCard({row,category}:{row:TournamentRow;category:Category}){
 const router=useRouter(); const badge=category==="boosted"?"Pinned":category==="featured"?"Featured":null;
 return <button type="button" onClick={()=>router.push(`/tournaments/${row.id}`)} className="group w-full overflow-hidden rounded-[20px] border border-[#173d67] bg-[#071426] text-left shadow-[0_14px_32px_rgba(0,35,75,.22)] transition hover:-translate-y-0.5 hover:border-[#2497ff]">
  <MatchUpImage src={row.banner_path||"/1002371685.jpg"} className="h-36 bg-[#0b223c]"/><div className="relative -mt-36 h-36 overflow-hidden pointer-events-none"><div className="absolute inset-0 bg-gradient-to-t from-[#071426] via-[#071426]/20 to-[#071426]/35"/>{badge?<span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-[#2b8ee6]/50 bg-[#082a4b]/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-[#9bd3ff]"><Zap size={11}/>{badge}</span>:null}<span className="absolute bottom-3 left-3 rounded-full border border-[#2b8ee6]/40 bg-[#0b3154]/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#9bd3ff]">{formatName(row.format)}</span></div>
  <div className="p-4"><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 flex-1 truncate text-base font-black text-white">{row.name}</h2><Trophy size={16} className="mt-0.5 shrink-0 text-[#47a8ff]"/></div><p className="mt-1 line-clamp-1 text-xs text-[#86a1bb]">{row.description||"Open MatchUp football competition."}</p><div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-[#a9bdd5]"><span className="flex items-center gap-1.5"><Users size={13}/>{row.max_players} teams</span><span className="flex items-center gap-1.5"><Gamepad2 size={13}/>{row.game_title||"Football"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3"><span className="text-[11px] text-[#7892ac]">Prize <strong className="text-white">{money(Number(row.prize_pool||0))}</strong></span><span className="flex items-center justify-end gap-1 text-[11px] text-[#7892ac]"><CalendarDays size={12}/>{row.starts_at?new Date(row.starts_at).toLocaleDateString():"Date TBA"}</span></div><div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-[#66809a]"><span>{profileName(row)}</span><span className="capitalize">{formatName(row.status)}</span></div></div>
 </button>;
}
