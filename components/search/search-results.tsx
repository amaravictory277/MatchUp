"use client";

import { useEffect, useMemo, useState } from "react";
import { Gamepad2, Swords, UsersRound } from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { TournamentCard } from "../tournaments/tournament-browser";
import { ProfileDiscoveryCard, type HomePerson } from "../home/profile-discovery-card";
import { FeedCard } from "../feeds/feed-card";
import type { Author, Comment, Post } from "../feeds/data";
import { MatchUpAvatar } from "../ui/matchup-avatar";
import { SearchResultSkeleton } from "../ui/content-skeletons";

export type SearchType = "tournaments" | "posts" | "players" | "groups" | "ready-players";

type TournamentResult = {
  id:string;tournament_id:string;name:string;description?:string|null;format:string;status:string;starts_at?:string|null;
  visibility:string;max_players:number;organizer_id:string;banner_path?:string|null;game_title?:string|null;prize_pool?:number|null;
  profiles?:{display_name?:string|null;username?:string|null;avatar_path?:string|null;country?:string|null;currency_code?:string|null}|null;
};

type GroupResult={id:string;name:string;image_path:string|null;member_count?:number|null};
type PlayerResult=HomePerson & { ready_player_enabled?:boolean };
type PostResult=Post;

function relativeTime(value:string){const m=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));if(m<1)return"Just now";if(m<60)return`${m} min ago`;const h=Math.floor(m/60);if(h<24)return`${h} hour${h===1?"":"s"} ago`;return new Date(value).toLocaleDateString();}
function profileName(p:any){return p?.display_name||p?.username||"MatchUp Player";}
function publicUrl(supabase:any,bucket:string,path:string|null){if(!path)return null;if(/^https?:\/\//i.test(path))return path;return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;}

export function SearchResults({type,query,onNavigate}:{type:SearchType;query:string;onNavigate:()=>void}){
 const supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
 const [loading,setLoading]=useState(false);
 const [tournaments,setTournaments]=useState<TournamentResult[]>([]);
 const [players,setPlayers]=useState<PlayerResult[]>([]);
 const [groups,setGroups]=useState<GroupResult[]>([]);
 const [posts,setPosts]=useState<PostResult[]>([]);
 const [ready,setReady]=useState<PlayerResult[]>([]);
 const [error,setError]=useState("");

 useEffect(()=>{
   const q=query.trim();
   if(q.length<2){setTournaments([]);setPlayers([]);setGroups([]);setPosts([]);setReady([]);setError("");return;}
   let cancelled=false;
   const run=async()=>{
     setLoading(true);setError("");
     try{
       if(type==="tournaments"){
         const {data}=await supabase.from("tournaments").select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,banner_path,game_title,prize_pool,profiles:organizer_id(display_name,username,avatar_path,country,currency_code)").eq("visibility","public").or(`name.ilike.%${q}%,tournament_id.ilike.%${q}%,game_title.ilike.%${q}%,description.ilike.%${q}%`).order("created_at",{ascending:false}).limit(4);
         if(!cancelled)setTournaments((data||[]) as TournamentResult[]);
       }else if(type==="players"||type==="ready-players"){
         const base=supabase.from("profiles").select("id,username,display_name,avatar_path,country,bio,supported_game,gaming_team_name,player_rating,squad_formation,is_verified,ready_player_enabled").neq("id",(await supabase.auth.getUser()).data.user?.id||"");
         const {data}=type==="ready-players"
           ? await base.eq("ready_player_enabled",true).or(`username.ilike.%${q}%,display_name.ilike.%${q}%,bio.ilike.%${q}%`).limit(30)
           : await base.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,bio.ilike.%${q}%`).limit(30);
         const list=((data||[]) as PlayerResult[]);
         if(!cancelled){if(type==="players")setPlayers(list);else setReady(list);}
       }else if(type==="groups"){
         const {data}=await supabase.from("chat_groups").select("id,name,image_path,member_count").eq("kind","group").ilike("name",`%${q}%`).order("name").limit(30);
         if(!cancelled)setGroups((data||[]) as GroupResult[]);
       }else{
         const {data:rows}=await supabase.from("posts").select("id,author_id,body,created_at").ilike("body",`%${q}%`).order("created_at",{ascending:false}).limit(12);
         const base=rows||[];const ids=base.map((r:any)=>r.id);const authorIds=Array.from(new Set(base.map((r:any)=>r.author_id)));
         if(!ids.length){if(!cancelled)setPosts([]);return;}
         const [{data:media},{data:likes},{data:comments},{data:profiles}]=await Promise.all([
           supabase.from("post_media").select("post_id,storage_path,media_type,position").in("post_id",ids).order("position"),
           supabase.from("post_likes").select("post_id,user_id").in("post_id",ids),
           supabase.from("post_comments").select("id,post_id,author_id,body,created_at").in("post_id",ids).order("created_at",{ascending:true}),
           supabase.from("profiles").select("id,display_name,username,avatar_path,supported_game,is_verified").in("id",authorIds)
         ]);
         const pMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));const mediaMap=new Map<string,any[]>();
         (media||[]).forEach((m:any)=>{const list=mediaMap.get(m.post_id)||[];list.push({...m,url:publicUrl(supabase,"feed-media",m.storage_path)});mediaMap.set(m.post_id,list);});
         const result=base.map((r:any)=>{
           const p=pMap.get(r.author_id);const name=profileName(p);const ml=mediaMap.get(r.id)||[];const video=ml.find(m=>m.media_type==="video")?.url;const images=ml.filter(m=>m.media_type==="image").map(m=>m.url);
           const commentList=(comments||[]).filter((c:any)=>c.post_id===r.id).map((c:any)=>{const cp=pMap.get(c.author_id);return{id:c.id,author:profileName(cp),authorId:c.author_id,text:c.body,time:relativeTime(c.created_at)}}) as Comment[];
           const author:Author={id:r.author_id,name,handle:`@${p?.username||"player"}`,avatar:publicUrl(supabase,"profile-media",p?.avatar_path||null),initials:name.split(/\s+/).map((x:string)=>x[0]).join("").slice(0,2).toUpperCase(),game:p?.supported_game||null,verified:Boolean(p?.is_verified)};
           return{id:r.id,author,time:relativeTime(r.created_at),caption:r.body||"",media:images.length?images:video?[video]:[],videoUrl:video||undefined,hasVideo:Boolean(video),likes:(likes||[]).filter((l:any)=>l.post_id===r.id).length,comments:commentList.length,commentList,shares:0,liked:false,saved:false,following:false,isOwn:false,category:"community" as const};
         });
         if(!cancelled)setPosts(result);
       }
     }catch{if(!cancelled)setError("Search is unavailable right now. Please try again.");}
     finally{if(!cancelled)setLoading(false);}
   };
   const timer=window.setTimeout(()=>void run(),250);return()=>{cancelled=true;window.clearTimeout(timer)};
 },[query,type,supabase]);

 if(query.trim().length<2)return <p className="py-10 text-center text-sm text-[#7892ac]">Type at least 2 characters to search real MatchUp data.</p>;
 if(loading)return <div className="mt-4"><SearchResultSkeleton count={3}/></div>;
 if(error)return <p className="py-10 text-center text-sm text-[#7892ac]">{error}</p>;

 if(type==="tournaments")return tournaments.length?<div className="mt-4 grid gap-4">{tournaments.map(row=><TournamentCard key={row.id} row={row}/>)}</div>:<Empty/>;
 if(type==="players")return players.length?<div className="mt-4"><ProfileDiscoveryCard people={players} listMode onFriend={async(id)=>{const {error}=await supabase.rpc("send_friend_request",{p_target:id});if(!error)setPlayers(v=>v.filter(p=>p.id!==id));}} notify={setError}/></div>:<Empty/>;
 if(type==="ready-players")return ready.length?<div className="mt-4 space-y-2">{ready.map(player=><article key={player.id} className="flex items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3"><MatchUpAvatar profile={player} size="md" alt={profileName(player)}/><div className="min-w-0 flex-1"><p className="truncate font-black text-white">{profileName(player)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[#7892ac]"><span className="size-2 rounded-full bg-[#35c58a]"/>Ready to play</p>{player.supported_game?<span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#70c1ff]"><Gamepad2 size={11}/>{player.supported_game}</span>:null}</div><button type="button" onClick={()=>{onNavigate();window.location.href=`/ready-players?player=${player.id}`}} className="flex items-center gap-1.5 rounded-xl bg-[#167bd1] px-3 py-2.5 text-xs font-black text-white"><Swords size={14}/>Challenge</button></article>)}</div>:<Empty/>;
 if(type==="groups")return groups.length?<div className="mt-4 space-y-2">{groups.map(group=><button key={group.id} type="button" onClick={()=>{onNavigate();window.location.href=`/chat?group=${group.id}`}} className="flex w-full items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3 text-left"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0b3154] text-[#70c1ff]">{group.image_path?<img src={publicUrl(supabase,"chat-media",group.image_path)||""} alt="" className="size-full object-cover"/>:<UsersRound size={20}/>}</span><span className="min-w-0 flex-1"><span className="block truncate font-black text-white">{group.name}</span><span className="mt-1 block text-xs text-[#7892ac]">{group.member_count||0} members</span></span><UsersRound size={16} className="text-[#70c1ff]"/></button>)}</div>:<Empty/>;
 return posts.length?<div className="mt-4 space-y-5">{posts.map(post=><FeedCard key={post.id} post={post} active onToggleLike={()=>{}} onToggleFollow={()=>{}} onComment={()=>{}} onEditComment={()=>{}} onDeleteComment={()=>{}} onShare={()=>{}} onDelete={()=>{}} onEdit={()=>{}} onToggleSave={()=>{}} onDownload={()=>{}} onOpenPost={(id)=>{onNavigate();window.location.href=`/feeds?post=${id}`}} onOpenMedia={(id,index)=>{onNavigate();window.location.href=`/feeds/media/${id}?index=${index}`}}/>)}</div>:<Empty/>;

 function Empty(){return <p className="py-10 text-center text-sm text-[#7892ac]">No results found.</p>;}
}
