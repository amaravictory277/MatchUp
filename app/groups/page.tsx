"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, MessageCircle, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { MatchUpAvatar, MatchUpAvatarStack, profileName, type MatchUpAvatarProfile } from "../../components/matchup-avatar";

type Group={id:string;name:string;created_by:string;created_at:string;kind:string;locked:boolean;member_limit?:number|null;image_path?:string|null};
type Member={user_id:string;profiles:MatchUpAvatarProfile|MatchUpAvatarProfile[]|null};

function one(v:Member["profiles"]){return Array.isArray(v)?v[0]||null:v||null;}

export default function GroupsPage(){
  const router=useRouter();
  const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const [groups,setGroups]=useState<Array<Group&{members:MatchUpAvatarProfile[];tagged:boolean}>>([]);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){setGroups([]);setLoading(false);return;}
    const {data:rows}=await supabase.from("chat_group_members").select("group_id,chat_groups(id,name,created_by,created_at,kind,locked,member_limit,image_path)").eq("user_id",auth.user.id);
    const groupRows=(rows||[]).map((r:any)=>Array.isArray(r.chat_groups)?r.chat_groups[0]:r.chat_groups).filter(Boolean).filter((g:any)=>g.kind==="group") as Group[];
    const ids=groupRows.map(g=>g.id);
    if(!ids.length){setGroups([]);setLoading(false);return;}
    const {data:members}=await supabase.from("chat_group_members").select("group_id,user_id,profiles(id,display_name,username,avatar_path)").in("group_id",ids).limit(3000);
    const byGroup=new Map<string,MatchUpAvatarProfile[]>();
    for(const row of (members||[]) as Member[]){const p=one(row.profiles);if(!p)continue;const arr=byGroup.get(row.user_id?((row as any).group_id):"")||[];arr.push(p);byGroup.set((row as any).group_id,arr);}
    const me=(await supabase.from("profiles").select("username,display_name").eq("id",auth.user.id).maybeSingle()).data as {username?:string|null;display_name?:string|null}|null;
    const username=me?.username||""; const names=me?.display_name||"";
    const messages=(await supabase.from("chat_messages").select("group_id,body").in("group_id",ids).order("created_at",{ascending:false}).limit(500)).data||[];
    const tagged=new Set<string>();
    for(const m of messages as any[]){const body=String(m.body||"").toLowerCase();if(username&&body.includes(`@${username.toLowerCase()}`)||names&&body.includes(`@${names.toLowerCase()}`))tagged.add(m.group_id);}
    setGroups(groupRows.map(g=>({...g,members:byGroup.get(g.id)||[],tagged:tagged.has(g.id)})));
    setLoading(false);
  },[supabase]);
  useEffect(()=>{void load();},[load]);
  return <main className="app-shell min-h-screen pb-28">
    <header className="mb-6 flex items-center gap-3">
      <button type="button" onClick={()=>router.back()} className="icon-button" aria-label="Back"><ArrowLeft size={18}/></button>
      <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">MatchUp</p><h1 className="text-3xl font-black text-white">Groups</h1></div>
      <button type="button" onClick={()=>router.push("/home?action=create-group")} className="ml-auto grid size-11 place-items-center rounded-2xl bg-[#167bd1] text-white shadow-lg" aria-label="Create Group"><Plus size={20}/></button>
    </header>
    {loading?<div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading your groups…</div>:groups.length?<section className="space-y-3">{groups.map(group=>{
      const image=group.image_path?supabase.storage.from("chat-media").getPublicUrl(group.image_path).data.publicUrl:null;
      return <button key={group.id} type="button" onClick={()=>router.push(`/chat?group=${group.id}`)} className="group-list-card w-full text-left">
        <span className="group-list-media">{image?<img src={image} alt="" className="h-full w-full object-cover"/>:<MatchUpAvatarStack profiles={group.members} size={34} max={3}/>}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-[15px] font-black text-white">{group.name}</strong>{group.tagged?<span className="grid size-5 place-items-center rounded-full bg-[#167bd1] text-[10px] font-black text-white" title="You were mentioned">@</span>:null}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-[#7892ac]"><Users size={13}/>{group.members.length} {group.members.length===1?"member":"members"}</span></span><ChevronRight size={18} className="shrink-0 text-[#5c7893]"/>
      </button>;
    })}</section>:<div className="surface-card p-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#0b3154] text-[#70c1ff]"><Users size={28}/></div><h2 className="mt-4 text-lg font-black text-white">No groups yet</h2><p className="mt-2 text-sm leading-6 text-[#7892ac]">Create a group or accept an invitation to start building your MatchUp football community.</p><button type="button" onClick={()=>router.push("/home?action=create-group")} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#167bd1] px-5 py-3 text-sm font-black text-white"><Plus size={16}/>Create Group</button></div>}
    <div className="mt-5 rounded-3xl border border-[#173d67] bg-[#08182b] p-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-[#0b3154] text-[#70c1ff]"><MessageCircle size={19}/></div><div><p className="text-sm font-black text-white">Your football community</p><p className="mt-0.5 text-xs text-[#7892ac]">Open a group to chat, invite friends and manage members.</p></div></div></div>
  </main>;
}
