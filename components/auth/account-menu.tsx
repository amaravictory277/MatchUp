"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Profile = { id:string; display_name:string|null; username:string|null; avatar_path:string|null };

export function AccountMenu(){
  const router=useRouter(),supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const [profile,setProfile]=useState<Profile|null>(null);
  useEffect(()=>{
    let active=true;
    const load=async()=>{const {data:auth}=await supabase.auth.getUser();if(!auth.user){if(active)setProfile(null);return}const {data}=await supabase.from("profiles").select("id,display_name,username,avatar_path").eq("id",auth.user.id).maybeSingle();if(active)setProfile((data as Profile|null)||null)};
    void load();
    const channel=supabase.channel("current-profile-avatar").on("postgres_changes",{event:"*",schema:"public",table:"profiles"},async payload=>{const {data:auth}=await supabase.auth.getUser();if(!auth.user||payload.eventType==="DELETE"||(payload.new as Profile|undefined)?.id!==auth.user.id)return;setProfile(payload.new as Profile)}).subscribe();
    const {data:listener}=supabase.auth.onAuthStateChange(()=>void load());
    return()=>{active=false;listener.subscription.unsubscribe();void supabase.removeChannel(channel)};
  },[supabase]);
  const label=profile?.display_name?.trim()||profile?.username||"MatchUp Player";
  const initial=label.charAt(0).toUpperCase();
  const avatar=profile?.avatar_path ? (/^https?:\/\//i.test(profile.avatar_path) ? profile.avatar_path : supabase.storage.from("profile-media").getPublicUrl(profile.avatar_path).data.publicUrl) : null;
  return <button type="button" aria-label="Open Profile" onClick={()=>router.push("/profile")} className="profile-avatar grid size-10 place-items-center overflow-hidden rounded-full border text-sm font-black text-white">{avatar?<img src={avatar} alt="" className="size-full object-cover"/>:initial}</button>;
}