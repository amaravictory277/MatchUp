"use client";

import { Bell, MessageCircle, Swords, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

type Profile={id:string;display_name:string|null;username:string|null;avatar_path?:string|null};
type Notification={id:string;kind:string;payload:Record<string,unknown>|null;created_at:string;actor?:Profile|null};
const text=(n:Notification)=>{const v=n.payload?.message;return typeof v==="string"?v:n.kind.replaceAll("_"," ");};
const href=(n:Notification)=>{const explicit=n.payload?.href;if(typeof explicit==="string")return explicit;const type=n.payload?.entity_type;const id=n.payload?.entity_id;if(type==="profile"&&typeof id==="string")return `/friends?user=${id}`;if(type==="post"&&typeof id==="string")return `/feeds?post=${id}`;if(type==="group"&&typeof id==="string")return `/leaderboard?group=${id}`;if(n.kind.startsWith("match_request"))return "/ready-players";return "/notifications";};
const Icon=({kind}:{kind:string})=>kind.startsWith("friend")?<UserPlus size={17}/>:kind.startsWith("match")?<Swords size={17}/>:kind.includes("message")?<MessageCircle size={17}/>:<Bell size={17}/>;

export function RealtimeMatchOverlay(){
 const router=useRouter();const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);const [item,setItem]=useState<Notification|null>(null);
 useEffect(()=>{let dead=false;const loadActor=async(row:any)=>{const actorId=row?.payload?.actor_id;if(!actorId)return row as Notification;const {data}=await supabase.from("profiles").select("id,display_name,username,avatar_path").eq("id",actorId).maybeSingle();return {...row,actor:(data as Profile|null)} as Notification;};const start=async()=>{const {data:auth}=await supabase.auth.getUser();if(!auth.user)return;const channel=supabase.channel(`matchup-live-notifications-${auth.user.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`recipient_id=eq.${auth.user.id}`},async payload=>{const row=payload.new as any;if(!row?.id||dead)return;try{if(window.localStorage.getItem(`matchup-toast:${row.id}`))return;window.localStorage.setItem(`matchup-toast:${row.id}`,"1");}catch{}const next=await loadActor(row);if(!dead)setItem(next);}).subscribe();return()=>{dead=true;void supabase.removeChannel(channel);};};let cleanup:(()=>void)|undefined;void start().then(fn=>{cleanup=fn;});return()=>{dead=true;cleanup?.();};},[supabase]);
 useEffect(()=>{if(!item)return;const timer=window.setTimeout(()=>setItem(null),5000);return()=>window.clearTimeout(timer);},[item]);
 if(!item)return null;const actor=item.actor;const label=actor?.display_name||actor?.username||"MatchUp player";return <button type="button" onClick={()=>{setItem(null);router.push(href(item));}} className="fixed left-1/2 top-[max(12px,env(safe-area-inset-top))] z-[150] flex w-[min(calc(100%-24px),430px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#4aaeff]/50 bg-[#126bc0] px-3.5 py-3 text-left text-white shadow-[0_14px_38px_rgba(0,31,67,.42)] transition hover:bg-[#167bd1]" aria-label={text(item)}><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/10">{actor?.avatar_path?<img src={actor.avatar_path} alt="" className="size-full object-cover"/>:<Icon kind={item.kind}/>}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-black">{text(item)}</span><span className="mt-0.5 block text-[9px] font-semibold text-white/70">{label} · tap to open</span></span></button>;
}
