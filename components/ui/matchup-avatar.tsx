"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type AvatarProfile = { id?: string; display_name?: string | null; username?: string | null; avatar_path?: string | null };
type Props = { profile?: AvatarProfile | null; size?: "sm" | "md" | "lg"; alt?: string; className?: string; group?: boolean };
const sizeClass = { sm: "size-10", md: "size-12", lg: "size-16" };
const palettes = [["#0b3154", "#2497ff", "#d8f0ff"],["#0a2946", "#47a8ff", "#e3f4ff"],["#102f4d", "#70c1ff", "#eef9ff"]];
function hash(value: string) { let h=0; for(let i=0;i<value.length;i++) h=(h*31+value.charCodeAt(i))|0; return Math.abs(h); }
function label(profile?: AvatarProfile|null){return profile?.display_name||profile?.username||"MatchUp Player";}

export function MatchUpAvatar({profile,size="md",alt,className="",group=false}:Props){
 const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
 const [failed,setFailed]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const key=profile?.id||profile?.avatar_path||"matchup-default";
 const palette=palettes[hash(key)%palettes.length];
 const name=label(profile);
 const initials=name.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
 const [avatarSrc,setAvatarSrc]=useState<string|null>(null);
 useEffect(()=>{
   setFailed(false); setLoaded(false);
   const raw=profile?.avatar_path;
   if(!raw){setAvatarSrc(null);return;}
   const src=/^https?:\/\//i.test(raw)?raw:supabase.storage.from(group?"chat-media":"profile-media").getPublicUrl(raw).data.publicUrl;
   setAvatarSrc(src||null);
 },[group,profile?.avatar_path,supabase]);
 const background=useMemo(()=>`linear-gradient(145deg,${palette[0]},${palette[1]})`,[palette]);
 return <span className={`relative inline-grid shrink-0 overflow-hidden rounded-full ${sizeClass[size]} ${className}`} style={{background}}>
   <span className={`absolute inset-0 grid place-items-center rounded-full text-xs font-black text-white transition-opacity duration-200 ${loaded&&!failed?"opacity-0":"opacity-100"}`}>{initials}</span>
   {avatarSrc&&!failed?<img src={avatarSrc} alt={alt??name} className={`relative size-full rounded-full object-cover transition-[filter,opacity] duration-300 ${loaded?"opacity-100 blur-0":"opacity-70 blur-[7px]"}`} loading="lazy" decoding="async" onLoad={()=>setLoaded(true)} onError={()=>{setFailed(true);setLoaded(false)}}/>:null}
 </span>;
}
