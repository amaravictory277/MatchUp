"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Crown, Gamepad2, MapPin, MessageCircle, Send, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { MatchUpAvatar } from "../ui/matchup-avatar";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export type HomePerson = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  cover_media_path?: string | null;
  cover_media_type?: "image" | "video" | null;
  country: string | null;
  bio: string | null;
  supported_game?: string | null;
  is_verified?: boolean;
  followerCount?: number;
  postCount?: number;
  friendship?: "none" | "pending" | "friends";
};

const nameOf = (person: HomePerson) => person.display_name?.trim() || person.username || "MatchUp Player";
const gameLabel = (value?: string | null) => value?.trim() || "Football";
function publicCoverUrl(supabase: ReturnType<typeof createBrowserSupabaseClient>, path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}

export function ProfileDiscoveryCard({
  people,
  onFriend,
  notify,
  onNeedMore,
  peopleLoading = false,
  peopleHasMore = false,
}: {
  people: HomePerson[];
  onFriend: (id: string) => Promise<void> | void;
  notify: (message: string) => void;
  onNeedMore?: () => Promise<void> | void;
  peopleLoading?: boolean;
  peopleHasMore?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const seenIdsRef = useRef(new Set<string>());
  const [quickChatPerson, setQuickChatPerson] = useState<HomePerson | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const loadingMoreRef = useRef(false);

  const playSwipeSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const now = context.currentTime;
      const duration = 0.16;

      // A short filtered-noise sweep gives a soft "swish" instead of a click/metallic burst.
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const t = i / data.length;
        const envelope = Math.sin(Math.PI * t) * (1 - t * 0.18);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(850, now + duration);
      filter.Q.setValueAtTime(0.55, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(now);
      source.stop(now + duration);

      window.setTimeout(() => void context.close(), 220);
    } catch {}
  };

  const availablePeople = people.filter((profile) => !seenIdsRef.current.has(profile.id));
  const person = availablePeople[0] || null;
  const requestMore = useCallback(async () => {
    if (!onNeedMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try { await onNeedMore(); } finally { loadingMoreRef.current = false; }
  }, [onNeedMore]);

  useEffect(() => {
    if (!person && peopleHasMore && !peopleLoading) void requestMore();
  }, [person, peopleHasMore, peopleLoading, requestMore]);

  const finishExit = (direction: "left" | "right") => {
    if (direction === "left") {
      if (person) seenIdsRef.current.add(person.id);
      setDragX(0);
      setAnimating(false);
      if (availablePeople.length <= 6) void requestMore();
      return;
    }
    const exited = person;
    if (exited) seenIdsRef.current.add(exited.id);
    setDragX(0);
    setAnimating(false);
    if (exited) {
      setMessage("");
      setQuickChatPerson(exited);
    }
  };

  const commitExit = (direction: "left" | "right") => {
    if (!person || animating) return;
    playSwipeSound();
    setAnimating(true);
    const width = cardRef.current?.getBoundingClientRect().width || 320;
    const distance = Math.max(window.innerWidth + 80, width + 180);
    setDragX(direction === "left" ? -distance : distance);
    window.setTimeout(() => finishExit(direction), 340);
  };

  const pointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || animating) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current || animating) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) setDragX(dx);
  };

  const pointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current || animating) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    startRef.current = null;
    const horizontal = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!horizontal) { setDragX(0); return; }
    commitExit(dx < 0 ? "left" : "right");
  };

  const pointerCancel = () => {
    startRef.current = null;
    if (!animating) setDragX(0);
  };

  const sendQuickMessage = async () => {
    if (!quickChatPerson || !message.trim() || sending) return;
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        notify("Sign in to send a message.");
        return;
      }
      const { data: groupId, error: groupError } = await supabase.rpc("get_or_create_private_chat", { p_friend: quickChatPerson.id });
      if (groupError || !groupId) throw groupError || new Error("Could not open this chat.");
      const { error: messageError } = await supabase.from("chat_messages").insert({
        id: crypto.randomUUID(),
        group_id: groupId,
        sender_id: auth.user.id,
        body: message.trim(),
      });
      if (messageError) throw messageError;
      setQuickChatPerson(null);
      setMessage("");
      router.push(`/leaderboard?group=${groupId}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  if (!person) {
    if (peopleLoading || peopleHasMore) {
      return (
        <div className="surface-card rounded-[24px] border-[#153c68] p-6 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[#245b91] border-t-[#47a8ff]" />
          <p className="mt-3 font-black text-white">Finding more MatchUp players…</p>
          <p className="mt-1 text-sm text-[#7892ac]">Loading the next available profiles.</p>
        </div>
      );
    }
    return (
      <div className="surface-card rounded-[24px] border-[#153c68] p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-[#245b91] bg-[#0b3154] p-3">
          <img src="/matchup-logo.svg" alt="MatchUp" className="size-full object-contain" />
        </div>
        <p className="mt-3 font-black text-white">You’re all caught up</p>
        <p className="mt-1 text-sm text-[#7892ac]">New MatchUp players will appear here when available.</p>
      </div>
    );
  }

  const swipeViewport = typeof window === "undefined" ? 420 : Math.max(420, window.innerWidth);
  const progress = Math.min(1, Math.abs(dragX) / swipeViewport);
  const rotation = Math.max(-5, Math.min(5, dragX / 70));
  const transition = animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none";

  const renderProfile = (profile: HomePerson, layer: number) => {
    const name = nameOf(profile);
    const isActive = layer === 0;
    const scale = isActive ? 1 : Math.max(0.18, 0.25 - (layer - 1) * 0.04 + progress * (0.75 - (layer - 1) * 0.06));
    const translateY = isActive ? 0 : 8 + (layer - 1) * 8;
    return (
      <article
        key={profile.id}
        ref={isActive ? cardRef : undefined}
        className={`relative mx-auto aspect-[1.01] w-full max-w-[760px] min-w-0 overflow-hidden rounded-[30px] border border-[#2388e8]/80 bg-[#061a34] text-left shadow-[0_24px_70px_rgba(0,32,78,.48)] ${isActive ? "z-20" : "pointer-events-none absolute inset-0 z-10"}`}
        aria-hidden={!isActive}
        onPointerDown={isActive ? pointerDown : undefined}
        onPointerMove={isActive ? pointerMove : undefined}
        onPointerUp={isActive ? pointerUp : undefined}
        onPointerCancel={isActive ? pointerCancel : undefined}
        style={{
          transform: isActive ? `translate3d(${dragX}px,0,0) rotate(${rotation}deg)` : `translate3d(0,${translateY}px,0) scale(${scale})`,
          opacity: 1,
          transition: isActive ? transition : "transform 340ms cubic-bezier(.16,1,.3,1)",
          willChange: "transform",
        }}
      >
        <div className="absolute inset-0">
          <img src="/1002371685.jpg" alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-[#061c3a]/18" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,30,61,.12)_0%,rgba(5,31,62,.10)_34%,rgba(5,24,49,.34)_59%,rgba(6,26,52,.96)_100%)]" />
        </div>

        <div className="absolute left-[5%] top-[5%] inline-flex items-center gap-2 rounded-full border border-[#58adff]/35 bg-[#1764ae]/55 px-3 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,.18)] sm:px-4 sm:py-2">
          <Crown size={18} className="text-white" fill="currentColor" />
          <span className="text-[10px] font-black uppercase tracking-[.13em] text-white sm:text-[13px]">MatchUp Player</span>
        </div>

        <img src="/matchup-logo.svg" alt="MatchUp" className="absolute left-1/2 top-[11%] h-[25%] w-[38%] -translate-x-1/2 object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,.25)]" draggable={false} />

        <span className="absolute right-[5%] top-[35%] inline-flex items-center gap-2 rounded-full border border-[#4aa9ff] bg-[#07539b]/88 px-3 py-2 text-[11px] font-black text-white shadow-[0_8px_20px_rgba(0,0,0,.3)] sm:px-4 sm:py-2.5 sm:text-[13px]">
          <Gamepad2 size={15} className="text-white" /> {gameLabel(profile.supported_game)}
        </span>

        <div className="absolute left-[5%] top-[23%]">
          <MatchUpAvatar profile={profile} size="lg" alt={name} className="!size-[88px] border-[4px] border-[#0b6dcc] shadow-[0_8px_24px_rgba(0,0,0,.45)] sm:!size-[112px] sm:border-[5px]" />
        </div>

        <div className="absolute inset-x-[5%] top-[50%]">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 text-[24px] font-black leading-none tracking-[-.035em] text-white sm:text-[31px]">{name}</h3>
            {profile.friendship !== "friends" ? (
              <span className="shrink-0 rounded-full bg-[#1b5b98]/82 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.1em] text-[#e2f3ff] shadow-lg sm:px-3.5 sm:py-2 sm:text-[10px]">
                Not friends yet
              </span>
            ) : null}
          </div>
          {profile.country ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#c3e1fb] sm:text-[14px]">
              <MapPin size={14} className="text-[#62b7ff] sm:size-[16px]" />{profile.country}
            </p>
          ) : null}
        </div>

        <div className="absolute inset-x-[5%] top-[65%]">
          <div className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-[#2766a0]/45 bg-[#0b3158]/92 shadow-inner">
            <div className="flex flex-col items-center justify-center px-2 py-2.5 sm:py-3.5">
              <p className="text-[22px] font-black leading-none text-white sm:text-[25px]">{profile.postCount ?? 0}</p>
              <p className="mt-2 text-[9px] font-black uppercase tracking-[.16em] text-[#9ec4e5] sm:text-[10px]">Posts</p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-[#3475ad]/65 px-2 py-2.5 sm:py-3.5">
              <p className="text-[22px] font-black leading-none text-white sm:text-[25px]">{profile.followerCount ?? 0}</p>
              <p className="mt-2 text-[9px] font-black uppercase tracking-[.16em] text-[#9ec4e5] sm:text-[10px]">Followers</p>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-[5%] top-[84%] flex items-stretch gap-3">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void onFriend(profile.id)}
            className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(100deg,#1684e8,#2099ff)] px-4 py-2.5 text-[14px] font-black text-white shadow-[0_10px_26px_rgba(22,132,232,.3)] transition hover:brightness-105 active:scale-[.99] sm:min-h-12 sm:text-[17px]"
          >
            <UserPlus size={18} className="shrink-0 sm:size-[20px]" />
            <span>{profile.friendship === "pending" ? "Request Sent" : "Add Friend"}</span>
          </button>
          <button
            type="button"
            aria-label={`Message ${name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setQuickChatPerson(profile)}
            className="grid min-h-11 w-[70px] shrink-0 place-items-center rounded-[20px] border border-[#2388e8]/80 bg-[#0a3158]/88 text-white shadow-[0_10px_26px_rgba(0,32,78,.28)] transition hover:bg-[#0d3b68] active:scale-[.99] sm:min-h-12 sm:w-[76px]"
          >
            <MessageCircle size={27} strokeWidth={2.1} className="text-[#e7f5ff]" />
          </button>
        </div>
      </article>
    );
  };
  return (
    <>
      <div className="relative block w-full min-w-0 overflow-visible" style={{ touchAction: "pan-y" }}>
        {renderProfile(person, 0)}
      </div>
      {availablePeople.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[9px] font-bold text-[#66809a]" aria-label="Profile swipe controls">
          <span className="inline-flex items-center gap-1"><ArrowRight size={11} className="rotate-180" /> Swipe left</span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, dotIndex) => {
              const activeDot = seenIdsRef.current.size % 3 === dotIndex;
              return <span key={dotIndex} className={`rounded-full transition-all ${activeDot ? "h-1.5 w-5 bg-[#70c1ff]" : "size-1.5 bg-[#31597f]"}`} />;
            })}
          </div>
          <span className="inline-flex items-center gap-1">Swipe right <ArrowRight size={11} /></span>
        </div>
      ) : null}

      {quickChatPerson ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => !sending && setQuickChatPerson(null)}>
          <section className="flex max-h-[calc(100dvh-12px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-[#245b91] bg-[#08182b] shadow-[0_24px_80px_rgba(0,0,0,.6)] sm:max-h-[min(720px,calc(100dvh-32px))] sm:rounded-[30px]" onClick={(event) => event.stopPropagation()}>
            <div className="shrink-0 p-4 pb-3 sm:p-5">
              <div className="flex items-center gap-3">
                <MatchUpAvatar profile={quickChatPerson} size="md" alt={nameOf(quickChatPerson)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white">{nameOf(quickChatPerson)}</p>
                  <p className="truncate text-xs text-[#7892ac]">{quickChatPerson.country || "MatchUp player"}</p>
                </div>
                <button type="button" onClick={() => setQuickChatPerson(null)} className="icon-button shrink-0" aria-label="Close quick chat"><X size={17} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
              <p className="text-xs text-[#7892ac]">Quick message</p>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} autoFocus rows={4} maxLength={1000} placeholder={`Write a message to ${nameOf(quickChatPerson)}…`} className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-[#214a78] bg-[#071426] p-4 text-sm leading-6 text-white outline-none focus:border-[#47a8ff]" />
            </div>
            <div className="shrink-0 border-t border-[#18365f] p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-5">
              <div className="flex gap-2">
                <button type="button" disabled={sending || !message.trim()} onClick={() => void sendQuickMessage()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#167bd1] px-4 py-3.5 text-sm font-black text-white disabled:opacity-50"><Send size={16} /> {sending ? "Sending…" : "Send Message"}</button>
                <button type="button" disabled={sending} onClick={() => setQuickChatPerson(null)} className="min-h-12 rounded-2xl border border-[#214a78] px-4 py-3.5 text-sm font-black text-[#b7c9da]">Cancel</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
