"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Camera, Check, ChevronRight, Gamepad2, Globe2, LogOut, Pencil, UserRound, Bell } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { clearAuthSession } from "../../lib/auth/session";
import { MatchUpVerificationBadge } from "../feeds/matchup-verification-badge";

type Game = "eFootball" | "FIFA";
type Profile = { id:string; username:string; display_name:string|null; avatar_path:string|null; country:string|null; supported_game:Game|null; is_verified:boolean; created_at:string };
const countries = ["Nigeria","Ghana","Kenya","South Africa","United Kingdom","United States","Other"];

function publicAvatar(supabase:ReturnType<typeof createBrowserSupabaseClient>, path:string|null){
  if(!path)return null;
  if(/^https?:\/\//i.test(path))return path;
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}
function nameOf(profile:Profile){return profile.display_name?.trim() || profile.username || "MatchUp Player";}

export function ProfilePage(){
  const router=useRouter(), searchParams=useSearchParams(), supabase=useMemo(()=>createBrowserSupabaseClient(),[]);
  const view=searchParams.get("view");
  const screen=view==="edit" || view==="settings" ? view : "profile";
  const [profile,setProfile]=useState<Profile|null>(null),[email,setEmail]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[loggingOut,setLoggingOut]=useState(false),[toast,setToast]=useState<string|null>(null);
  const [name,setName]=useState(""),[country,setCountry]=useState(""),[game,setGame]=useState<Game|"">(""),[avatarFile,setAvatarFile]=useState<File|null>(null),[avatarPreview,setAvatarPreview]=useState<string|null>(null);
  const notify=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(null),2600)};
  const load=async()=>{
    setLoading(true);
    const {data:auth,error:authError}=await supabase.auth.getUser();
    if(authError || !auth.user){router.replace("/");return}
    setEmail(auth.user.email || "");
    const {data,error}=await supabase.from("profiles").select("id,username,display_name,avatar_path,country,supported_game,is_verified,created_at").eq("id",auth.user.id).maybeSingle();
    if(error || !data){setProfile(null);setLoading(false);return}
    const next=data as Profile; setProfile(next); setName(next.display_name || ""); setCountry(next.country || ""); setGame(next.supported_game || ""); setLoading(false);
  };
  useEffect(()=>{void load()},[]);
  useEffect(()=>{
    if(!profile?.id)return;
    const channel=supabase.channel("profile-"+profile.id).on("postgres_changes",{event:"*",schema:"public",table:"profiles",filter:"id=eq."+profile.id},payload=>{
      if(payload.eventType==="DELETE")return;
      const next=payload.new as Profile; setProfile(next); setName(next.display_name || ""); setCountry(next.country || ""); setGame(next.supported_game || "");
    }).subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[profile?.id,supabase]);
  useEffect(()=>()=>{if(avatarPreview?.startsWith("blob:"))URL.revokeObjectURL(avatarPreview)},[avatarPreview]);
  const avatar=avatarPreview || publicAvatar(supabase,profile?.avatar_path || null);
  const displayName=profile ? nameOf(profile) : "MatchUp Player";
  const initial=displayName.charAt(0).toUpperCase();
  const openView=(next:"edit"|"settings")=>router.push("/profile?view="+next);
  const goBack=()=>router.back();
  const selectAvatar=(file:File|null)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){notify("Choose an image file.");return}
    if(file.size>5*1024*1024){notify("Profile picture must be 5MB or smaller.");return}
    if(avatarPreview?.startsWith("blob:"))URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  };
  const saveProfile=async()=>{
    if(!profile || saving)return; setSaving(true);
    try{
      let avatarPath=profile.avatar_path;
      if(avatarFile){
        const extension=avatarFile.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"") || "jpg";
        const path=profile.id+"/avatar-"+crypto.randomUUID()+"."+extension;
        const upload=await supabase.storage.from("profile-media").upload(path,avatarFile,{upsert:false,contentType:avatarFile.type});
        if(upload.error)throw upload.error; avatarPath=path;
      }
      const {data,error}=await supabase.from("profiles").update({display_name:name.trim() || null,country:country || null,supported_game:game || null,avatar_path:avatarPath}).eq("id",profile.id).select("id,username,display_name,avatar_path,country,supported_game,is_verified,created_at").single();
      if(error)throw error;
      setProfile(data as Profile); setAvatarFile(null); setAvatarPreview(null); notify("Profile updated."); router.replace("/profile");
    }catch(error){console.error("MatchUp profile save failed:",error);notify(error instanceof Error ? error.message : "Settings couldn't be saved.")}finally{setSaving(false)}
  };
  const logout=async()=>{
    if(loggingOut)return; setLoggingOut(true);
    const {error}=await supabase.auth.signOut(); await clearAuthSession();
    if(error){console.error("MatchUp logout failed:",error);notify(error.message);setLoggingOut(false);return}
    router.replace("/"); router.refresh();
  };
  if(loading)return <main className="profile-page app-shell"><div className="surface-card p-10 text-center text-sm text-[#7892ac]">Loading profile…</div></main>;
  if(!profile)return <main className="profile-page app-shell"><div className="surface-card p-10 text-center text-sm text-[#7892ac]">Profile unavailable.</div></main>;
  if(screen==="edit")return <main className="profile-page app-shell">
    <header className="flex items-center gap-3 pb-5"><button type="button" onClick={goBack} className="icon-button" aria-label="Back"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">MatchUp</p><h1 className="mt-1 text-3xl font-black text-white">Edit Profile</h1></div></header>
    <section className="surface-card overflow-visible p-5">
      <div className="flex flex-col items-center"><div className="relative"><div className="grid size-28 place-items-center overflow-hidden rounded-full border-4 border-[#194b7c] bg-[#0b3154] text-3xl font-black text-[#70c1ff] shadow-[0_12px_35px_rgba(0,0,0,.3)]">{avatar?<img src={avatar} alt={displayName} className="size-full object-cover"/>:initial}</div><label className="absolute -bottom-1 -right-1 grid size-10 cursor-pointer place-items-center rounded-full border-2 border-[#071426] bg-[linear-gradient(145deg,#126bc0,#2497ff)] text-white shadow-lg" aria-label="Change profile picture"><Camera size={17}/><input type="file" accept="image/*" className="hidden" onChange={e=>selectAvatar(e.target.files?.[0] || null)}/></label></div><p className="mt-4 text-xs text-[#7892ac]">JPG, PNG or WebP · maximum 5MB</p></div>
      <div className="mt-7 space-y-4">
        <label className="block"><span className="mb-2 block text-xs font-bold text-[#9bb1c5]">Display Name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={60} className="w-full rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3.5 text-sm text-white outline-none focus:border-[#2497ff]"/></label>
        <label className="block"><span className="mb-2 block text-xs font-bold text-[#9bb1c5]">Country</span><select value={country} onChange={e=>setCountry(e.target.value)} className="w-full rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3.5 text-sm text-white"><option value="">Select country</option>{countries.map(item=><option key={item}>{item}</option>)}</select></label>
        <div><span className="mb-2 block text-xs font-bold text-[#9bb1c5]">Supported Game</span><div className="grid grid-cols-2 gap-2">{(["eFootball","FIFA"] as Game[]).map(item=><button key={item} type="button" onClick={()=>setGame(item)} className={"rounded-2xl border p-3.5 text-left text-sm font-black "+(game===item?"border-[#2497ff] bg-[#0b3154] text-[#9bd3ff]":"border-[#18365f] bg-[#071426] text-[#b7c9da]")}><Gamepad2 size={16} className="mr-2 inline"/>{item}{game===item?<Check size={14} className="float-right mt-0.5"/>:null}</button>)}</div></div>
        <div className="rounded-2xl border border-[#18365f] bg-[#071426] p-4"><p className="text-xs font-bold text-[#9bb1c5]">Email / Gmail</p><p className="mt-1 break-all text-sm text-white">{email || "Not available"}</p><p className="mt-1 text-[11px] text-[#7892ac]">Email is managed by authentication and cannot be changed here.</p></div>
      </div>
      <button type="button" disabled={saving} onClick={()=>void saveProfile()} className="mt-6 w-full rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3.5 text-sm font-black text-white shadow-[0_10px_28px_rgba(36,151,255,.2)] disabled:opacity-60">{saving?"Saving…":"Save Changes"}</button>
    </section>{toast?<Toast message={toast}/>:null}
  </main>;
  if(screen==="settings")return <main className="profile-page app-shell">
    <header className="flex items-center gap-3 pb-5"><button type="button" onClick={goBack} className="icon-button" aria-label="Back"><ArrowLeft size={18}/></button><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">MatchUp</p><h1 className="mt-1 text-3xl font-black text-white">Settings</h1></div></header>
    <div className="space-y-4"><SettingsGroup title="ACCOUNT"><SettingsRow icon={Pencil} title="Edit Profile" detail="Update your picture, name, country or game" onClick={()=>openView("edit")}/><SettingsRow icon={UserRound} title="Account Information" detail={email || "Authentication account"}/></SettingsGroup><SettingsGroup title="NOTIFICATIONS"><SettingsRow icon={Bell} title="Notification Preferences" detail="Open your existing MatchUp notifications" onClick={()=>router.push("/notifications")}/></SettingsGroup></div>
    {toast?<Toast message={toast}/>:null}
  </main>;
  return <main className="profile-page app-shell">
    <header className="flex items-center gap-3 pb-5"><button type="button" onClick={goBack} className="icon-button" aria-label="Back to previous page"><ArrowLeft size={18}/></button><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">MatchUp</p><h1 className="mt-1 text-3xl font-black text-white">Profile</h1></div></header>
    <section className="profile-hero surface-card overflow-hidden"><div className="h-28 bg-[radial-gradient(circle_at_50%_0%,rgba(36,151,255,.42),transparent_64%)]"/><div className="-mt-14 px-5 pb-5"><div className="flex items-end justify-between gap-4"><div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#071426] bg-[#0b3154] text-3xl font-black text-[#70c1ff] shadow-[0_15px_45px_rgba(0,0,0,.35)]">{avatar?<img src={avatar} alt={displayName} className="size-full object-cover"/>:initial}</div><button type="button" onClick={()=>openView("edit")} className="rounded-full bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_22px_rgba(36,151,255,.22)]"><Pencil size={14} className="mr-1 inline"/>Edit Profile</button></div>
      <div className="mt-5 flex items-center gap-2"><h2 className="truncate text-2xl font-black text-white">{displayName}</h2>{profile.is_verified?<MatchUpVerificationBadge/>:null}</div><p className="mt-1 text-sm text-[#7892ac]">@{profile.username}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3"><InfoCard icon={UserRound} label="Email" value={email || "Not available"}/><InfoCard icon={Globe2} label="Country" value={profile.country || "Not set"}/><InfoCard icon={Gamepad2} label="Game" value={profile.supported_game || "Not set"}/></div>
    </div></section>
    <section className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={()=>openView("edit")} className="surface-card p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2497ff]"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#70c1ff]">Profile</p><p className="mt-1 text-base font-black text-white">Edit details</p><p className="mt-1 text-xs text-[#7892ac]">Keep your MatchUp identity current.</p></button><button type="button" onClick={()=>openView("settings")} className="surface-card p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2497ff]"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#70c1ff]">App</p><p className="mt-1 text-base font-black text-white">Settings</p><p className="mt-1 text-xs text-[#7892ac]">Account and notification controls.</p></button></section>
    <section className="mt-4 surface-card p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#0b3154] text-[#70c1ff]"><Gamepad2 size={18}/></span><div><p className="text-sm font-black text-white">Supported game</p><p className="mt-1 text-xs text-[#7892ac]">{profile.supported_game ? "Your Feed posts show "+profile.supported_game+" beside their timestamps." : "Choose eFootball or FIFA in Edit Profile."}</p></div></div></section>
    <button type="button" disabled={loggingOut} onClick={()=>void logout()} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#5a2b39] bg-[#21131b] px-4 py-4 text-sm font-black text-[#ff9ca9] disabled:opacity-60"><LogOut size={18}/><span className="flex-1 text-left">{loggingOut?"Logging out…":"Logout"}</span><ChevronRight size={16}/></button>
    {toast?<Toast message={toast}/>:null}
  </main>;
}
function SettingsGroup({title,children}:{title:string;children:React.ReactNode}){return <section className="surface-card overflow-hidden"><p className="px-4 pt-4 text-[10px] font-black uppercase tracking-[.16em] text-[#70c1ff]">{title}</p><div className="mt-2 divide-y divide-[#15304e]">{children}</div></section>}
function SettingsRow({icon:Icon,title,detail,onClick}:{icon:typeof UserRound;title:string;detail:string;onClick?:()=>void}){return <button type="button" disabled={!onClick} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-4 text-left disabled:cursor-default"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#0b3154] text-[#70c1ff]"><Icon size={16}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">{title}</span><span className="mt-0.5 block text-xs leading-5 text-[#7892ac]">{detail}</span></span>{onClick?<ChevronRight size={16} className="text-[#4d769c]"/>:null}</button>}
function InfoCard({icon:Icon,label,value}:{icon:typeof UserRound;label:string;value:string}){return <div className="rounded-2xl border border-[#18365f] bg-[#071426]/80 p-3"><Icon size={15} className="text-[#70c1ff]"/><p className="mt-2 text-[10px] font-black uppercase tracking-[.1em] text-[#7892ac]">{label}</p><p className="mt-1 truncate text-xs font-bold text-[#d9e8f5]">{value}</p></div>}
function Toast({message}:{message:string}){return <div role="status" className="fixed bottom-6 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-[#1e6095] bg-[#0a2139] px-5 py-2.5 text-sm font-semibold text-white shadow-2xl">{message}</div>}