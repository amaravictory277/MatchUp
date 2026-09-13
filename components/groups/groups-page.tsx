"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Plus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type Profile={id:string;display_name:string|null;username:string|null;avatar_path:string|null};
type Group={id:string;name:string;kind:string;image_path:string|null;created_at:string;memberCount:number;members:Profile[];tagged:boolean};
const nameOf=(p:Profile)=>p.display_name||p.username||"MatchUp Player";

export function GroupsPage(){
 const router=useRouter(); const supabase=useMemo(()=>createBrowserSupabaseClient(),[]); const [groups,setGroups]=useState<Group[]>([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{let cancelled=false; const load=async()=>{const {data:auth}=await supabase.auth.getUser(); if(!auth.user){router.push("/auth");return;} const uid=auth.user.id;
   const {data:memberships}=await supabase.from("chat_group_members").select("group_id,chat_groups(id,name,kind,image_path,created_at)").eq("user_id",uid);
   const raw=(memberships||[]).map((r:any)=>Array.isArray(r.chat_groups)?r.chat_groups[0]:r.chat_groups).filter((g:any)=>g&&g.kind==="group"); const unique=raw.filter((g:any,i:number,a:any[])=>a.findIndex(x=>x.id===g.id)===i);
   const ids=unique.map((g:any)=>g.id); if(!ids.length){if(!cancelled){setGroups([]);setLoading(false);}return;}
   const {data:rows}=await supabase.from("chat_group_members").select("group_id,user_id,profiles(id,display_name,username,avatar_path)").in("group_id",ids).limit(2000);
   const byGroup=new Map<string,Profile[]>(); (rows||[]).forEach((r:any)=>{const p=Array.isArray(r.profiles)?r.profiles[0]:r.profiles;if(!p)return;const list=byGroup.get(r.group_id)||[];if(list.length<5)list.push(p);byGroup.set(r.group_id,list);});
   const username=(await supabase.from("profiles").select("username").eq("id",uid).maybeSingle()).data?.username;
   const messageRows=(await supabase.from("chat_messages").select("group_id,body").in("group_id",ids).order("created_at",{ascending:false}).limit(1000)).data||[];
   const next=unique.map((g:any)=>{const members=byGroup.get(g.id)||[];const count=(rows||[]).filter((r:any)=>r.group_id===g.id).length;const tagged=Boolean(username&&messageRows.some((m:any)=>m.group_id===g.id&&new RegExp(`(^|\\s)@${String(username).replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&")}(\\s|$|[.,!?])`,"i").test(m.body||"")));return {...g,memberCount:count,members,tagged};});
   if(!cancelled){setGroups(next);setLoading(false);} }; void load(); return()=>{cancelled=true;};},[router,supabase]);
 return <main className="min-h-screen bg-[#061120] px-4 pb-28 pt-5 text-white sm:px-6"><div className="mx-auto max-w-2xl">
   <header className="flex items-center gap-3 border-b border-white/5 pb-5"><button type="button" onClick={()=>router.back()} className="icon-button" aria-label="Back"><ArrowLeft size={18}/></button><div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Community</p><h1 className="text-2xl font-black">Groups</h1></div><button type="button" onClick={()=>router.push("/leaderboard?create=group")} className="grid size-10 place-items-center rounded-xl bg-[#167bd1]" aria-label="Create group"><Plus size={19}/></button></header>
   <div className="mt-6 flex rounded-2xl border border-[#18365f] bg-[#071426] p-1"><button type="button" onClick={()=>router.push("/message-friends?tab=friends")} className="flex-1 rounded-xl px-4 py-3 text-sm font-black text-[#7892ac]">FRIENDS</button><button type="button" className="flex-1 rounded-xl bg-[#167bd1] px-4 py-3 text-sm font-black text-white">GROUPS</button></div>
   {loading?<div className="py-16 text-center text-sm text-[#7892ac]">Loading your groups…</div>:groups.length?<section className="mt-7"><h2 className="mb-3 text-[11px] font-black uppercase tracking-[.16em] text-[#70c1ff]">Groups</h2><div className="space-y-3">{groups.map(g=><button type="button" key={g.id} onClick={()=>router.push(`/leaderboard?group=${g.id}`)} className="flex w-full items-center gap-4 rounded-2xl border border-[#18365f] bg-[#071426] p-4 text-left transition hover:border-[#2497ff]">
     <MatchUpAvatar group={true} profile={{id:g.id,display_name:g.name,avatar_path:g.image_path,username:null}} size="md" alt={`${g.name} group image`}/><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-base font-black">{g.name}</span>{g.tagged&&<span className="grid size-6 place-items-center rounded-full bg-[#0b3154] text-xs font-black text-[#70c1ff]" title="You were mentioned">@</span>}</span><span className="mt-1 block text-xs text-[#7892ac]">{g.memberCount} {g.memberCount===1?"member":"members"}</span><span className="mt-2 flex items-center -space-x-2">{g.members.slice(0,4).map(p=><MatchUpAvatar key={p.id} profile={p} size="sm" alt={nameOf(p)}/>)}</span></span><ChevronRight size={19} className="shrink-0 text-[#5f86a8]"/></button>)}</div></section>:<div className="mt-12 rounded-3xl border border-dashed border-[#18365f] bg-[#071426] p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#0b3154] text-[#70c1ff]"><UsersRound size={24}/></span><h2 className="mt-4 text-lg font-black">No groups yet</h2><p className="mt-2 text-sm text-[#7892ac]">Create or join a group to build your football community.</p><button type="button" onClick={()=>router.push("/leaderboard?create=group")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#167bd1] px-4 py-3 text-sm font-black"><Plus size={16}/>Create Group</button></div>}
 </div></main>;
}
