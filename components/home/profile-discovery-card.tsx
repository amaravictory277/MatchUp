"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, Gamepad2, MessageCircle, Send, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { MatchUpAvatar } from "../ui/matchup-avatar";
import { MatchUpVerificationBadge } from "../feeds/matchup-verification-badge";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export type HomePerson = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  country: string | null;
  bio: string | null;
  supported_game?: string | null;
  is_verified?: boolean;
  followerCount?: number;
  postCount?: number;
  friendship?: "none" | "pending" | "friends";
};

const nameOf = (person: HomePerson) => person.display_name?.trim() || person.username || "MatchUp Player";

function gameLabel(value?: string | null) {
  const normalized = value?.trim() || "";
  if (!normalized || /e[- ]?football/i.test(normalized) || /football/i.test(normalized)) return "Football";
  return normalized;
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
  const [quickChatPerson, setQuickChatPerson] = useState<HomePerson | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const clickGuardRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const current = people[index] || null;
  const stack = people.slice(index, index + 3);

  const requestMore = useCallback(async () => {
    if (!onNeedMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      await onNeedMore();
    } finally {
      loadingMoreRef.current = false;
    }
  }, [onNeedMore]);

  const playSwipeSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const duration = 0.11;
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1700, context.currentTime);
      filter.Q.setValueAtTime(0.7, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      source.stop(context.currentTime + duration);
      window.setTimeout(() => void context.close(), 180);
    } catch {}
  };

  const finishExit = (direction: "left" | "right") => {
    if (direction === "left") {
      playSwipeSound();
      setIndex((value) => Math.min(value + 1, Math.max(0, people.length - 1)));
      if (people.length - index <= 4) void requestMore();
    } else {
      setIndex((value) => Math.max(0, value - 1));
    }
    setDragX(0);
    setAnimating(false);
  };

  const commitExit = (direction: "left" | "right") => {
    if (!current || animating) return;
    if (direction === "right" && index === 0) {
      setDragX(0);
      return;
    }
    setAnimating(true);
    clickGuardRef.current = true;
    const width = cardRef.current?.getBoundingClientRect().width || 320;
    const distance = Math.max(window.innerWidth + 80, width + 180);
    setDragX(direction === "left" ? -distance : distance);
    window.setTimeout(() => {
      clickGuardRef.current = false;
      finishExit(direction);
    }, 340);
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || animating) return;
    startRef.current = { x: event.clientX, y: event.clientY };
    clickGuardRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || animating) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) setDragX(dx);
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || animating) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    startRef.current = null;
    const horizontal = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!horizontal) {
      setDragX(0);
      return;
    }
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

  if (!current) {
    if (peopleLoading || peopleHasMore) {
      return (
        <div className="surface-card rounded-[30px] border-[#153c68] p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[#245b91] border-t-[#47a8ff]" />
          <p className="mt-3 font-black text-white">Finding more MatchUp players…</p>
          <p className="mt-1 text-sm text-[#7892ac]">Loading the next available profiles.</p>
        </div>
      );
    }
    return (
      <div className="surface-card grid min-h-[300px] place-items-center rounded-[30px] border-[#153c68] bg-[#071426] p-8 text-center">
        <div>
          <div className="mx-auto grid size-20 place-items-center rounded-full border border-[#245b91] bg-[#0b3154] p-4">
            <img src="/matchup-logo.svg" alt="MatchUp" className="size-full object-contain" />
          </div>
          <p className="mt-4 font-black text-white">You’re all caught up</p>
          <p className="mt-1 text-sm text-[#7892ac]">New MatchUp players will appear here when available.</p>
        </div>
      </div>
    );
  }

  const swipeViewport = typeof window === "undefined" ? 420 : Math.max(420, window.innerWidth);
  const progress = Math.min(1, Math.abs(dragX) / swipeViewport);

  const renderProfileCard = (profile: HomePerson, swipeMode = false) => {
    const name = nameOf(profile);
    return (
      <article className="relative w-full overflow-hidden rounded-[30px] border border-[#245b91] bg-[#061426] shadow-[0_24px_80px_rgba(0,40,90,.30)]">
        <img src="/1002371685.jpg" alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,20,39,.08)_0%,rgba(3,22,43,.18)_27%,rgba(4,21,41,.52)_54%,rgba(3,17,33,.98)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(37,135,226,.36),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(31,94,154,.18),transparent_30%)]" />
        <img src="/matchup-logo.svg" alt="" className="absolute left-1/2 top-[24%] w-[230px] -translate-x-1/2 -translate-y-1/2 opacity-[.13] sm:w-[300px]" />

        <div className="relative min-h-[590px] px-5 pb-5 pt-5 sm:min-h-[640px] sm:px-7 sm:pb-7 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <span className="rounded-full border border-[#2d78b9]/80 bg-[#0a2a48]/85 px-4 py-2 text-[10px] font-black uppercase tracking-[.16em] text-[#d7efff] backdrop-blur-md sm:text-[11px]">MatchUp Player</span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#3a99eb] bg-[#092a49]/90 px-4 py-2.5 text-sm font-black text-[#e0f4ff] shadow-[0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-md sm:px-5 sm:py-3 sm:text-base">
              <Gamepad2 size={18} />Football
            </span>
          </div>

          <div className="mt-[205px] flex items-end justify-between gap-3 sm:mt-[230px]">
            <MatchUpAvatar profile={profile} size="lg" alt={name} className="!size-28 shrink-0 border-4 border-[#071426] shadow-[0_14px_40px_rgba(0,0,0,.48)] sm:!size-32" />
            {profile.is_verified ? <MatchUpVerificationBadge /> : null}
          </div>

          <div className="mt-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[30px] font-black leading-none tracking-[-.035em] text-white sm:text-4xl">{name}</h3>
              {profile.friendship !== "friends" ? <span className="rounded-full bg-[#164d7c]/90 px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-[#bfe3ff] backdrop-blur-sm sm:text-[10px]">Not friends yet</span> : null}
            </div>
            <p className="mt-2 text-base font-semibold text-[#a8c2d9]">{profile.country || "Country not set"}</p>
          </div>

          {profile.bio?.trim() ? <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c3d5e5]">{profile.bio.trim()}</p> : null}

          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-[22px] border border-[#214a74]/90 bg-[#08203a]/90 backdrop-blur-md">
            <div className="p-4 text-center sm:p-5"><p className="text-2xl font-black text-white sm:text-3xl">{profile.postCount ?? 0}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.17em] text-[#8ca8c0]">Posts</p></div>
            <div className="border-l border-[#214a74]/90 p-4 text-center sm:p-5"><p className="text-2xl font-black text-white sm:text-3xl">{profile.followerCount ?? 0}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.17em] text-[#8ca8c0]">Followers</p></div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => void onFriend(profile.id)} className="flex min-h-14 items-center justify-center gap-3 rounded-[22px] bg-[#1680d8] px-4 text-base font-black text-white shadow-[0_12px_30px_rgba(22,128,216,.28)] transition hover:bg-[#218fe8] active:scale-[.99] sm:text-lg"><UserPlus size={21} />Add Friend</button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setMessage(""); setQuickChatPerson(profile); }} className="grid min-h-14 min-w-14 place-items-center rounded-[22px] border border-[#3a78ad] bg-[#082a49]/90 text-[#bfe4ff] backdrop-blur-md transition hover:border-[#59acfa] hover:text-white" aria-label={`Message ${name}`}><MessageCircle size={23} /></button>
          </div>

          {!swipeMode && people.length > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-3 text-[9px] font-black text-[#66809a] sm:text-[10px]">
              <span className="inline-flex items-center gap-1 whitespace-nowrap"><ArrowRight size={11} className="rotate-180" />Swipe left</span>
              <div className="flex items-center gap-1.5" aria-hidden="true"><span className="h-1.5 w-5 rounded-full bg-[#70c1ff]" /><span className="size-1.5 rounded-full bg-[#31597f]" /><span className="size-1.5 rounded-full bg-[#31597f]" /></div>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">Swipe right<ArrowRight size={11} /></span>
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="relative w-full overflow-visible" style={{ touchAction: "pan-y" }}>
        {stack.slice(1).reverse().map((profile, reverseIndex) => {
          const layer = stack.length - reverseIndex - 1;
          const scale = Math.max(0.18, 0.25 - (layer - 1) * 0.04 + progress * (0.75 - (layer - 1) * 0.06));
          return (
            <div key={`${profile.id}-stack`} className="pointer-events-none absolute inset-0 z-10" style={{ transform: `translate3d(0,${8 + (layer - 1) * 8}px,0) scale(${scale})`, opacity: 1, transition: "transform 340ms cubic-bezier(.16,1,.3,1)", willChange: "transform" }}>
              {renderProfileCard(profile, true)}
            </div>
          );
        })}

        <div
          ref={cardRef}
          className="relative z-20 w-full"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
          style={{
            transform: `translate3d(${dragX}px,0,0) rotate(${Math.max(-5, Math.min(5, dragX / 70))}deg)`,
            transition: animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none",
            opacity: 1,
            willChange: "transform",
          }}
        >
          {renderProfileCard(current)}
        </div>
      </div>

      {people.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-[9px] font-black text-[#66809a]" aria-label={`People swipe controls, ${Math.min(index + 1, people.length)} of ${people.length}`}>
          <span className="inline-flex items-center gap-1 whitespace-nowrap"><ArrowRight size={11} className="rotate-180" />Swipe left</span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: Math.min(3, people.length) }).map((_, dotIndex) => <span key={dotIndex} className={`rounded-full transition-all ${index % Math.min(3, people.length) === dotIndex ? "h-1.5 w-5 bg-[#70c1ff]" : "size-1.5 bg-[#31597f]"}`} />)}
          </div>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">Swipe right<ArrowRight size={11} /></span>
        </div>
      ) : null}

      {quickChatPerson ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => !sending && setQuickChatPerson(null)}>
          <section className="flex max-h-[calc(100dvh-12px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-[#245b91] bg-[#08182b] shadow-[0_24px_80px_rgba(0,0,0,.6)] sm:max-h-[min(720px,calc(100dvh-32px))] sm:rounded-[30px]" onClick={(event) => event.stopPropagation()}>
            <div className="shrink-0 p-4 pb-3 sm:p-5">
              <div className="flex items-center gap-3">
                <MatchUpAvatar profile={quickChatPerson} size="md" alt={nameOf(quickChatPerson)} />
                <div className="min-w-0 flex-1"><p className="truncate text-base font-black text-white">{nameOf(quickChatPerson)}</p><p className="truncate text-xs text-[#7892ac]">{quickChatPerson.country || "MatchUp player"}</p></div>
                <button type="button" onClick={() => setQuickChatPerson(null)} className="icon-button shrink-0" aria-label="Close quick chat"><X size={17} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-5"><p className="text-xs text-[#7892ac]">Quick message</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} autoFocus rows={4} maxLength={1000} placeholder={`Write a message to ${nameOf(quickChatPerson)}…`} className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-[#214a78] bg-[#071426] p-4 text-sm leading-6 text-white outline-none focus:border-[#47a8ff]" /></div>
            <div className="shrink-0 border-t border-[#18365f] p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-5"><div className="flex gap-2"><button type="button" disabled={sending || !message.trim()} onClick={() => void sendQuickMessage()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#167bd1] px-4 py-3.5 text-sm font-black text-white disabled:opacity-50"><Send size={16} />{sending ? "Sending…" : "Send Message"}</button><button type="button" disabled={sending} onClick={() => setQuickChatPerson(null)} className="min-h-12 rounded-2xl border border-[#214a78] px-4 py-3.5 text-sm font-black text-[#b7c9da]">Cancel</button></div></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
