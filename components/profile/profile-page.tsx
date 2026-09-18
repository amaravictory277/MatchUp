"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Camera, Check, ChevronRight, CircleHelp, Crown, Eye, Gamepad2, Globe2, LockKeyhole, LogOut, Moon, Palette, Pencil, Play, ShieldCheck, Sparkles, Sun, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Navigation } from "../navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { clearAuthSession } from "../../lib/auth/session";
import { useTheme } from "../theme-provider";

type Game = "eFootball" | "FIFA";
type ThemePreference = "light" | "dark" | "system";
type Profile = { id:string; username:string; display_name:string|null; avatar_path:string|null; country:string; supported_game:Game|null; is_verified:boolean; theme_preference:ThemePreference };
type Effect = { id:string; name:string; description:string; duration_hours:number; unlock_method:"ad"|"subscription"; preview_url:string|null; is_premium:boolean };
type UserEffect = { effect_id:string; expires_at:string|null; active:boolean };

const countries=["Nigeria","Ghana","Kenya","South Africa","United Kingdom","United States","Other"];
const sampleVideo="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

function publicAvatar(supabase:ReturnType<typeof createBrowserSupabaseClient>,path:string|null){
  if(!path)return null;
  if(path.startsWith("http"))return path;
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}
function expiry(value:string|null){
  if(!value)return "No active effect";
  const ms=new Date(value).getTime()-Date.now();
  if(ms<=0)return "Expired";
  const hours=Math.ceil(ms/3600000);
  return hours<24?hours+" hours remaining":Math.ceil(hours/24)+" days remaining";
}

export function ProfilePage(){
  const router=useRouter(),supabase=useMemo(()=>createBrowserSupabaseClient(),[]),{theme,setTheme}=useTheme();
  const [profile,setProfile]=useState<Profile|null>(null),[email,setEmail]=useState(""),[screen,setScreen]=useState<"profile"|"edit"|"settings"|"effects"|"preview">("profile");
  const [effects,setEffects]=useState<Effect[]>([]),[userEffects,setUserEffects]=useState<UserEffect[]>([]),[selected,setSelected]=useState<Effect|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[loggingOut,setLoggingOut]=useState(false),[toast,setToast]=useState<string|null>(null);
  const [name,setName]=useState(""),[country,setCountry]=useState(""),[game,setGame]=useState<Game|"">(""),[avatarFile,setAvatarFile]=useState<File|null>(null),[avatarPreview,setAvatarPreview]=useState<string|null>(null);

  const notify=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(null),2300)};
  const load=async()=>{
    setLoading(true);
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){router.replace("/");return}
    setEmail(auth.user.email||"");
    const [{data:p},{data:e},{data:ue}]=await Promise.all([
      supabase.from("profiles").select("id,username,display_name,avatar_path,country,supported_game,is_verified,theme_preference").eq("id",auth.user.id).maybeSingle(),
      supabase.from("profile_effects").select("id,name,description,duration_hours,unlock_method,preview_url,is_premium").order("is_premium").order("name"),
      supabase.from("user_profile_effects").select("effect_id,expires_at,active").eq("user_id",auth.user.id)
    ]);
    if(p){const next=p as Profile;setProfile(next);setName(next.display_name||"");setCountry(next.country||"");setGame(next.supported_game||"")}
    setEffects((e||[]) as Effect[]);setUserEffects((ue||[]) as UserEffect[]);setLoading(false);
  };
  useEffect(()=>{void load()},[]);
  useEffect(()=>()=>{if(avatarPreview?.startsWith("blob:"))URL.revokeObjectURL(avatarPreview)},[avatarPreview]);

  const avatar=avatarPreview||publicAvatar(supabase,profile?.avatar_path||null);
  const active=userEffects.find(x=>x.active&&(!x.expires_at||new Date(x.expires_at).getTime()>Date.now()));
  const activeEffect=effects.find(x=>x.id===active?.effect_id);

  const saveProfile=async()=>{
    if(!profile||saving)return;
    setSaving(true);
    try{
      let avatarPath=profile.avatar_path;
      if(avatarFile){
        if(!avatarFile.type.startsWith("image/"))throw new Error("Profile picture must be an image.");
        if(avatarFile.size>5*1024*1024)throw new Error("Profile picture must be 5MB or smaller.");
        const ext=avatarFile.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"jpg";
        const path=`${profile.id}/avatar-${Date.now()}.${ext}`;
        const up=await supabase.storage.from("profile-media").upload(path,avatarFile,{upsert:false,contentType:avatarFile.type});
        if(up.error)throw up.error;
        avatarPath=path;
      }
      const {data,error}=await supabase.from("profiles").update({display_name:name.trim()||null,country,supported_game:game||null,avatar_path:avatarPath}).eq("id",profile.id).select("id,username,display_name,avatar_path,country,supported_game,is_verified,theme_preference").single();
      if(error)throw error;
      setProfile(data as Profile);setAvatarFile(null);setAvatarPreview(null);setScreen("profile");notify("Profile updated");
    }catch(e){notify(e instanceof Error?e.message:"Could not update profile")}finally{setSaving(false)}
  };

  const logout=async()=>{
    if(loggingOut)return;setLoggingOut(true);
    try{const {error}=await supabase.auth.signOut();await clearAuthSession();if(error)throw error;router.replace("/");router.refresh()}
    catch(e){notify(e instanceof Error?e.message:"Could not log out");setLoggingOut(false)}
  };

  const selectAvatar=(file:File|null)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){notify("Choose an image file");return}
    if(avatarPreview?.startsWith("blob:"))URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);setAvatarPreview(URL.createObjectURL(file));
  };

  const title=screen==="profile"?"Profile":screen==="edit"?"Edit Profile":screen==="settings"?"Settings":screen==="effects"?"Profile Effects":"Effect Preview";

  return <main className="app-shell profile-page">
    <Navigation/>
    <header className="relative z-20 flex items-center justify-between pb-5">
      <div className="flex items-center gap-3">{screen!=="profile"?<button type="button" className="icon-button" aria-label="Back" onClick={()=>setScreen("profile")}><ArrowLeft size={18}/></button>:null}<div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">MatchUp</p><h1 className="mt-1 text-3xl font-black text-white">{title}</h1></div></div>
      {screen==="profile"?<button type="button" className="icon-button" aria-label="Settings" onClick={()=>setScreen("settings")}><Palette size={18}/></button>:null}
    </header>

    {loading?<div className="surface-card p-10 text-center text-sm text-[#7892ac]">Loading profile…</div>:!profile?<div className="surface-card p-10 text-center text-sm text-[#7892ac]">Profile unavailable.</div>:null}

    {!loading&&profile&&screen==="profile"?<section className="space-y-4">
      <div className="surface-card overflow-hidden">
        <div className="h-24 bg-[radial-gradient(circle_at_50%_0%,rgba(36,151,255,.38),transparent_62%)]"/>
        <div className="-mt-12 px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#071426] bg-[#0b3154] text-xl font-black text-[#70c1ff]">{avatar?<img src={avatar} alt="Profile" className="size-full object-cover"/>:(profile.display_name||profile.username).slice(0,2).toUpperCase()}</div>
            <button type="button" onClick={()=>setScreen("edit")} className="rounded-full border border-[#285277] bg-[#0a2946] px-4 py-2 text-xs font-black text-[#bfe4ff]"><Pencil size={14} className="mr-1 inline"/>Edit Profile</button>
          </div>
          <div className="mt-4 flex items-center gap-2"><h2 className="text-2xl font-black text-white">{profile.display_name||profile.username}</h2>{profile.is_verified?<span className="grid size-5 place-items-center rounded-full bg-[#167bd1] text-white"><Check size={12}/></span>:null}</div>
          <p className="mt-1 text-sm text-[#7892ac]">@{profile.username}</p>
          <div className="mt-4 grid gap-2 text-sm text-[#b7c9da] sm:grid-cols-3"><span className="flex items-center gap-2"><UserRound size={15} className="text-[#70c1ff]"/>{email||"No email"}</span><span className="flex items-center gap-2"><Globe2 size={15} className="text-[#70c1ff]"/>{profile.country||"Country not set"}</span><span className="flex items-center gap-2"><Gamepad2 size={15} className="text-[#70c1ff]"/>{profile.supported_game||"Game not set"}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2"><button onClick={()=>setScreen("edit")} className="surface-card p-4 text-left"><p className="text-[10px] font-black text-[#7892ac]">ACCOUNT</p><p className="mt-1 font-black text-white">Edit</p></button><button onClick={()=>setScreen("effects")} className="surface-card p-4 text-left"><p className="text-[10px] font-black text-[#7892ac]">PROFILE</p><p className="mt-1 font-black text-white">Effects</p></button><button onClick={()=>setScreen("settings")} className="surface-card p-4 text-left"><p className="text-[10px] font-black text-[#7892ac]">APP</p><p className="mt-1 font-black text-white">Settings</p></button></div>
      <div className="surface-card flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-xl bg-[#0b3154] text-[#70c1ff]"><Sparkles size={18}/></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-white">Active Profile Effect</p><p className="mt-1 text-xs text-[#7892ac]">{activeEffect?activeEffect.name+" · "+expiry(active?.expires_at||null):"No profile effect is active."}</p></div></div>
    </section>:null}

    {!loading&&profile&&screen==="edit"?<section className="surface-card p-5">
      <div className="flex flex-col items-center"><div className="relative grid size-28 place-items-center overflow-hidden rounded-full border-4 border-[#194b7c] bg-[#0b3154] text-2xl font-black text-[#70c1ff]">{avatar?<img src={avatar} alt="Profile preview" className="size-full object-cover"/>:(profile.display_name||profile.username).slice(0,2).toUpperCase()}<label className="absolute bottom-0 right-0 grid size-9 cursor-pointer place-items-center rounded-full border-2 border-[#071426] bg-[#167bd1] text-white"><Camera size={16}/><input type="file" accept="image/*" className="hidden" onChange={e=>selectAvatar(e.target.files?.[0]||null)}/></label></div><p className="mt-3 text-xs text-[#7892ac]">JPG, PNG or WebP · max 5MB</p></div>
      <div className="mt-6 space-y-4">
        <label className="block"><span className="mb-2 block text-xs font-bold text-[#9bb1c5]">Display Name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={60} className="w-full rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3 text-sm text-white outline-none focus:border-[#2497ff]"/></label>
        <label className="block"><span className="mb-2 block text-xs font-bold text-[#9bb1c5]">Country</span><select value={country} onChange={e=>setCountry(e.target.value)} className="w-full rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3 text-sm text-white"><option value="">Select country</option>{countries.map(c=><option key={c}>{c}</option>)}</select></label>
        <div><span className="mb-2 block text-xs font-bold text-[#9bb1c5]">Supported Game</span><div className="grid grid-cols-2 gap-2">{(["eFootball","FIFA"] as Game[]).map(g=><button type="button" key={g} onClick={()=>setGame(g)} className={`rounded-2xl border p-3 text-left text-sm font-black ${game===g?"border-[#2497ff] bg-[#0b3154] text-[#9bd3ff]":"border-[#18365f] bg-[#071426] text-[#b7c9da]"}`}><Gamepad2 size={16} className="mr-2 inline"/>{g}{game===g?<Check size={14} className="float-right mt-0.5"/>:null}</button>)}</div></div>
        <div className="rounded-2xl border border-[#18365f] bg-[#071426] p-4"><p className="text-xs font-bold text-[#9bb1c5]">Email / Gmail</p><p className="mt-1 text-sm text-white">{email||"Not available"}</p><p className="mt-1 text-[11px] text-[#7892ac]">Email cannot be changed.</p></div>
      </div>
      <button type="button" disabled={saving} onClick={()=>void saveProfile()} className="mt-5 w-full rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3.5 text-sm font-black text-white disabled:opacity-60">{saving?"Saving…":"Save Changes"}</button>
    </section>:null}

    {!loading&&profile&&screen==="settings"?<section className="space-y-4">
      <Group title="ACCOUNT" items={[["Edit Profile","Picture, name, country and game",Pencil,()=>setScreen("edit")],["Account Information",email||"Account email",UserRound,()=>notify("Email is managed by authentication")],["Security","Existing MatchUp authentication controls",LockKeyhole,()=>notify("Security stays in the existing authentication flow")]]}/>
      <Group title="PRIVACY" items={[["Privacy Controls","Public MatchUp profile visibility",Eye,()=>notify("Privacy controls use the existing MatchUp architecture")]]}/>
      <Group title="NOTIFICATIONS" items={[["Notification Preferences","Existing notification center",CircleHelp,()=>router.push("/notifications")]]}/>
      <div className="surface-card overflow-hidden"><p className="px-4 pt-4 text-[10px] font-black uppercase tracking-[.16em] text-[#70c1ff]">APPEARANCE</p><div className="grid grid-cols-3 gap-2 p-4">{(["light","dark","system"] as ThemePreference[]).map(t=><button type="button" key={t} onClick={()=>setTheme(t)} className={`rounded-2xl border p-4 text-center ${theme===t?"border-[#2497ff] bg-[#0b3154] text-white":"border-[#18365f] bg-[#071426] text-[#9bb1c5]"}`}>{t==="light"?<Sun size={18} className="mx-auto"/>:t==="dark"?<Moon size={18} className="mx-auto"/>:<Palette size={18} className="mx-auto"}/><span className="mt-2 block text-xs font-black capitalize">{t}</span>{theme===t?<Check size={13} className="mx-auto mt-1 text-[#70c1ff]"/>:null}</button>)}</div></div>
      <Group title="PROFILE EFFECTS" items={[["Effects","Manage profile effects",Sparkles,()=>setScreen("effects")],["Preview","Sample effect preview",Play,()=>{setSelected(effects[0]||null);setScreen("preview")}],["Unlock Information","Ad/subscription integrations are prepared for later",ShieldCheck,()=>notify("Unlock integrations are not connected yet")],["Active Effect",activeEffect?.name||"None",Sparkles,()=>setScreen("effects")],["Expiration",expiry(active?.expires_at||null),Sparkles,()=>setScreen("effects")]]}/>
      <Group title="PREMIUM / SUBSCRIPTIONS" items={[["Premium Effects","Future subscription effects — coming soon",Crown,()=>notify("Subscriptions are not connected yet")]]}/>
      <Group title="HELP & ABOUT" items={[["Help / Support","MatchUp support",CircleHelp,()=>notify("Support is being prepared")],["About MatchUp","Football competition platform",ShieldCheck,()=>notify("MatchUp")],["Terms","Legal information",LockKeyhole,()=>notify("Terms page is not connected yet")],["Privacy Policy","Privacy information",LockKeyhole,()=>notify("Privacy Policy page is not connected yet")]]}/>
      <button type="button" disabled={loggingOut} onClick={()=>void logout()} className="flex w-full items-center gap-3 rounded-2xl border border-[#5a2b39] bg-[#21131b] px-4 py-4 text-sm font-black text-[#ff9ca9] disabled:opacity-60"><LogOut size={18}/><span className="flex-1">{loggingOut?"Logging out…":"Logout"}</span><ChevronRight size={16}/></button>
    </section>:null}

    {!loading&&profile&&screen==="effects"?<section className="space-y-3">
      <div className="surface-card p-4"><p className="font-black text-white">Profile Effects</p><p className="mt-1 text-xs leading-5 text-[#7892ac]">Preview effects now. Real ad networks and payments are intentionally not connected.</p></div>
      {effects.map(e=>{const unlocked=userEffects.find(x=>x.effect_id===e.id&&(!x.expires_at||new Date(x.expires_at).getTime()>Date.now()));const isActive=userEffects.some(x=>x.effect_id===e.id&&x.active);return <div key={e.id} className="surface-card flex gap-3 p-3.5"><div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[#194b7c] bg-[#071426]"><Sparkles size={25} className="text-[#70c1ff]"/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-black text-white">{e.name}</h3><span className="rounded-full bg-[#0b3154] px-2 py-0.5 text-[9px] font-black text-[#9bd3ff]">{e.is_premium?"Premium":"Free"}</span></div><p className="mt-1 text-xs leading-5 text-[#7892ac]">{e.description}</p><p className="mt-2 text-[10px] font-bold text-[#9bb1c5]">{e.unlock_method==="ad"?"Watch an ad":"Subscription required"} · {e.duration_hours<24?e.duration_hours+" hours":"1 month"}</p><div className="mt-3 flex gap-2"><button type="button" onClick={()=>{setSelected(e);setScreen("preview")}} className="rounded-full border border-[#285277] px-3 py-1.5 text-[10px] font-black text-[#9bd3ff]"><Play size={12} className="mr-1 inline"/>Preview</button><button type="button" disabled={!unlocked} onClick={()=>{if(!unlocked)return;void supabase.from("user_profile_effects").update({active:false}).eq("user_id",profile.id).then(()=>supabase.from("user_profile_effects").update({active:true}).eq("user_id",profile.id).eq("effect_id",e.id)).then(()=>load())}} className="rounded-full bg-[#167bd1] px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40">{isActive?"Active":unlocked?"Use Effect":e.unlock_method==="ad"?"Ad unlock later":"Subscription later"}</button></div></div></div>})}
    </section>:null}

    {!loading&&profile&&screen==="preview"?<section className="surface-card overflow-hidden"><div className="relative aspect-video bg-black"><video src={selected?.preview_url||sampleVideo} controls playsInline className="size-full object-cover"/><span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-black tracking-wider text-white">SAMPLE PREVIEW</span></div><div className="p-5"><h2 className="text-xl font-black text-white">{selected?.name||"Profile Effect"}</h2><p className="mt-1 text-sm text-[#7892ac]">Temporary sample video. Replaceable later with the real MatchUp effect video.</p><button type="button" onClick={()=>setScreen("effects")} className="mt-4 w-full rounded-2xl bg-[#167bd1] px-4 py-3 text-sm font-black text-white">Back to Effects</button></div></section>:null}

    {toast?<div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#1e6095] bg-[#0a2139] px-5 py-2.5 text-sm font-semibold text-white">{toast}</div>:null}
  </main>;
}

function Group({title,items}:{title:string;items:[string,string,LucideIcon,()=>void][]}){
  return <div className="surface-card overflow-hidden"><p className="px-4 pt-4 text-[10px] font-black uppercase tracking-[.16em] text-[#70c1ff]">{title}</p><div className="mt-2 divide-y divide-[#15304e]">{items.map(([label,detail,Icon,action])=><button type="button" key={label} onClick={action} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[#0a2139]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#0b3154] text-[#70c1ff]"><Icon size={16}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">{label}</span><span className="mt-0.5 block text-xs leading-5 text-[#7892ac]">{detail}</span></span><ChevronRight size={16} className="text-[#4d769c]"/></button>)}</div></div>;
}
