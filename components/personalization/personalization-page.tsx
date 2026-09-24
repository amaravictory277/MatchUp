"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Bell, CircleUserRound, ChevronRight, Circle, IdCard, MessageCircle, Palette, Sparkles, Swords, Trophy, Type, UserRound, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { EFFECTS, PERSONALIZATION_CATEGORIES, PersonalizationKey } from "./personalization-config";
import { usePersonalization } from "./personalization-provider";
import { ChatBubbleEffect, ChatTextEffect, NameEffect, ProfileFrame } from "./effect-renderers";

const ICONS = { Type, CircleUserRound, Palette, MessageCircle, Sparkles, Swords, Trophy, IdCard, Zap, Bell };

type ProfileData = { displayName: string; avatar: string | null; country: string | null; game: string | null; rating: number | null };

export function PersonalizationPage({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const { preferences, setPreference, saving } = usePersonalization();
  const [active, setActive] = useState<(typeof PERSONALIZATION_CATEGORIES)[number] | null>(null);
  const [preview, setPreview] = useState("");
  const current = active ? preferences[active.preference as PersonalizationKey] : "";
  const options = useMemo(() => active ? EFFECTS[active.key === "chat" ? "chat" : active.key] || EFFECTS[active.key] || [] : [], [active]);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);

  const open = (category: (typeof PERSONALIZATION_CATEGORIES)[number]) => {
    setActive(category);
    setPreview(preferences[category.preference as PersonalizationKey]);
    setCategoryKey(category.key);
  };

  const apply = async () => {
    if (!active || !preview || saving) return;
    await setPreference(active.preference as PersonalizationKey, preview);
  };

  const visualOptions = categoryKey === "chat" ? EFFECTS.chat : options;
  const selected = preview || current;

  return <main className="profile-page app-shell pb-10">
    <header className="flex items-center gap-3 pb-5">
      <button type="button" onClick={() => router.back()} className="icon-button" aria-label="Back"><ArrowLeft size={18}/></button>
      <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">MatchUp</p><h1 className="mt-1 text-3xl font-black text-white">Personalization</h1><p className="mt-1 text-sm text-[#7892ac]">Make your MatchUp profile and interactions your own.</p></div>
    </header>
    <div className="grid gap-3">
      {PERSONALIZATION_CATEGORIES.map((category) => {
        const Icon = ICONS[category.icon as keyof typeof ICONS] || Circle;
        const value = preferences[category.preference as PersonalizationKey];
        const label = (EFFECTS[category.key === "chat" ? "chat" : category.key] || EFFECTS[category.key] || []).find(x => x.id === value)?.name || value;
        return <button key={category.key} type="button" onClick={() => open(category)} className="surface-card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#2497ff]">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0b3154] text-[#70c1ff]"><Icon size={19}/></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-white">{category.title}</strong><span className="mt-0.5 block text-xs text-[#7892ac]">{category.description}</span><span className="mt-2 inline-flex rounded-full bg-[#0b3154] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">{label}</span></span>
          <ChevronRight size={17} className="text-[#4d769c]"/>
        </button>;
      })}
    </div>
    {active ? <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5">
      <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-[#214a78] bg-[#071426] p-5 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Live preview</p><h2 className="mt-1 text-xl font-black text-white">{active.title}</h2><p className="mt-1 text-xs text-[#7892ac]">Every option is free and unlocked.</p></div><button type="button" onClick={() => setActive(null)} className="icon-button" aria-label="Close">×</button></div>
        <div className={`mt-5 rounded-[24px] border border-[#18365f] bg-[#061221] p-5 ${categoryKey === "theme" ? "min-h-56" : ""}`}>
          {categoryKey === "name" ? <div className="grid min-h-28 place-items-center"><NameEffect><span className="text-4xl font-black">{profile.displayName}</span></NameEffect></div> :
           categoryKey === "frame" ? <div className="grid min-h-28 place-items-center"><ProfileFrame src={profile.avatar} alt={profile.displayName} className="size-28"><span /></ProfileFrame></div> :
           categoryKey === "theme" ? <div className={`matchup-theme-preview matchup-theme-preview--${selected}`}><ProfileFrame src={profile.avatar} alt={profile.displayName} className="size-20" fallback={<UserRound size={24} className="text-[#70c1ff]"/>}/><div><NameEffect><p className="text-xl font-black">{profile.displayName}</p></NameEffect><p className="text-xs text-[#7892ac]">{[profile.country,profile.game].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs text-[#7892ac]">Followers · Following · Profile</p></div></div> :
           categoryKey === "chat" ? <div className="flex justify-end"><ChatBubbleEffect><ChatTextEffect><span className="text-sm">This is a live preview of your outgoing message.</span></ChatTextEffect></ChatBubbleEffect></div> :
           categoryKey === "reaction" ? <div className="grid min-h-24 place-items-center"><span className={`matchup-reaction-preview matchup-reaction-preview--${selected}`}>⚽ ❤️ 🏆</span></div> :
           categoryKey === "match" ? <div className="grid min-h-24 place-items-center text-center"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#70c1ff]">MatchUp</p><p className="mt-2 text-3xl font-black">2 <span className="text-[#47a8ff]">—</span> 1</p><p className="text-xs text-[#7892ac]">LIVE · Match presentation preview</p></div></div> :
           categoryKey === "tournament" ? <div className={`matchup-tournament-preview matchup-tournament-preview--${selected}`}><Trophy size={20}/><div><p className="text-sm font-black">MatchUp Championship</p><p className="text-xs opacity-70">16 players · Saturday</p></div></div> :
           categoryKey === "player" ? <div className={`matchup-player-card-preview matchup-player-card-preview--${selected}`}><ProfileFrame src={profile.avatar} alt={profile.displayName} className="size-16"/><div className="min-w-0"><NameEffect><p className="truncate text-lg font-black">{profile.displayName}</p></NameEffect><p className="text-xs opacity-70">{[profile.country,profile.game,profile.rating ? `OVR ${profile.rating}` : null].filter(Boolean).join(" · ")}</p></div></div> :
           categoryKey === "ready" ? <div className="grid min-h-24 place-items-center"><span className={`matchup-ready-preview matchup-ready-preview--${selected}`}>{EFFECTS.ready.find(x=>x.id===selected)?.name || "READY"}</span></div> :
           categoryKey === "notification" ? <div className={`matchup-notification-preview matchup-notification-preview--${selected}`}><Bell size={18}/><div><p className="text-sm font-black">New MatchUp activity</p><p className="text-xs opacity-70">Notification style preview</p></div></div> :
           <div className="grid min-h-24 place-items-center"><Sparkles className="text-[#70c1ff]"/></div>}
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {visualOptions.map(option => <button key={option.id} type="button" onClick={() => setPreview(option.id)} className={`rounded-2xl border p-3 text-left transition ${selected===option.id ? "border-[#2497ff] bg-[#0b3154]" : "border-[#18365f] bg-[#061221]"}`}><span className="block text-sm font-black text-white">{option.name}</span><span className="mt-1 block text-[11px] leading-5 text-[#7892ac]">{option.description}</span>{selected===option.id?<span className="mt-2 inline-flex rounded-full bg-[#126bc0] px-2 py-1 text-[9px] font-black">Selected</span>:null}</button>)}
        </div>
        <button type="button" onClick={() => void apply()} disabled={saving || !preview} className="mt-5 w-full rounded-2xl bg-[linear-gradient(100deg,#126bc0,#2497ff)] px-4 py-3.5 text-sm font-black text-white disabled:opacity-60">{saving ? "Saving…" : "Apply"}</button>
      </section>
    </div> : null}
  </main>;
}
