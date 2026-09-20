"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(540, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(230, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
      window.setTimeout(() => void context.close(), 180);
    } catch {}
  };

  const availablePeople = people.filter((profile) => !seenIdsRef.current.has(profile.id));
  const person = availablePeople[0] || null;
  const stack = availablePeople.slice(0, 3);

  const requestMore = useCallback(async () => {
    if (!onNeedMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try { await onNeedMore(); } finally { loadingMoreRef.current = false; }
  }, [onNeedMore]);

  useEffect(() => {
    if (!person && peopleHasMore && !peopleLoading) void requestMore();
  }, [person, peopleHasMore, peopleLoading, requestMore]);

  const finishExit = (direction: "left" | "right") => {
    playSwipeSound();
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
        className={`w-full overflow-hidden rounded-[26px] bg-[#071426] shadow-[0_22px_60px_rgba(0,25,55,.30)] ${isActive ? "relative z-20" : "pointer-events-none absolute inset-0 z-10"}`}
        aria-hidden={!isActive}
        onPointerDown={isActive ? pointerDown : undefined}
        onPointerMove={isActive ? pointerMove : undefined}
        onPointerUp={isActive ? pointerUp : undefined}
        onPointerCancel={isActive ? pointerCancel : undefined}
        style={{
          transform: isActive
            ? `translate3d(${dragX}px,0,0) rotate(${rotation}deg)`
            : `translate3d(0,${translateY}px,0) scale(${scale})`,
          opacity: 1,
          transition: isActive ? transition : "transform 340ms cubic-bezier(.16,1,.3,1)",
          willChange: "transform",
        }}
      >
        <div className="relative h-[118px] overflow-hidden bg-[#061120] sm:h-[138px]">
          {profile.cover_media_path ? (
            profile.cover_media_type === "video" ? (
              <video src={publicCoverUrl(supabase, profile.cover_media_path) || undefined} className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline preload="metadata" />
            ) : (
              <img src={publicCoverUrl(supabase, profile.cover_media_path) || undefined} alt="" className="absolute inset-0 size-full object-cover" />
            )
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(36,151,255,.55),transparent_42%),linear-gradient(135deg,#0a2946,#061120_55%,#0b3154)]" />
              <img src="/matchup-logo.svg" alt="" className="absolute left-1/2 top-1/2 w-[145px] -translate-x-1/2 -translate-y-1/2 opacity-[.16] sm:w-[180px]" />
            </>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,24,.08)_0%,rgba(7,20,38,.12)_48%,#071426_100%)]" />
          <div className="absolute -right-16 -top-20 size-48 rounded-full border border-white/10" />
          <span className="absolute left-3 top-3 rounded-full bg-[#061a2d]/78 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#d7edff] shadow-lg backdrop-blur-md">MatchUp Player</span>
        </div>
        <span className="pointer-events-none absolute right-3 top-[96px] z-[100] inline-flex translate-y-1/2 items-center gap-1 rounded-full border border-[#2b8ee6] bg-[#0a2946] px-2.5 py-1.5 text-[10px] font-black text-[#9bd3ff] shadow-[0_8px_18px_rgba(0,0,0,.28)] sm:top-[112px]">
          <Gamepad2 size={12} /> {gameLabel(profile.supported_game)}
        </span>

        <div className="relative px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-3">
          <div className="-mt-8 flex items-end justify-between gap-3">
            <MatchUpAvatar profile={profile} size="lg" alt={name} className="!size-[64px] shrink-0 border-[3px] border-[#071426] shadow-[0_8px_20px_rgba(0,0,0,.34)] sm:!size-[70px]" />
            <div className="mb-0.5 flex items-center gap-1.5">
              {profile.is_verified ? <MatchUpVerificationBadge /> : null}
            </div>
          </div>

          <div className="mt-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 truncate text-[18px] font-black tracking-[-.02em] text-white sm:text-[20px]">{name}</h3>
              {profile.friendship !== "friends" ? <span className="shrink-0 rounded-full bg-[#102c46] px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] text-[#89b7d9]">Not friends yet</span> : null}
            </div>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#86a1bb]">{profile.country || "Country not set"}</p>
          </div>

          <div className="mt-2.5 grid grid-cols-2 overflow-hidden rounded-2xl bg-[#0b2139] shadow-inner">
            <div className="px-3 py-2 text-center">
              <p className="text-base font-black leading-none text-white">{profile.postCount ?? 0}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-[#7892ac]">Posts</p>
            </div>
            <div className="border-l border-[#284965] px-3 py-2 text-center">
              <p className="text-base font-black leading-none text-white">{profile.followerCount ?? 0}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-[#7892ac]">Followers</p>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => void onFriend(profile.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-4 text-sm font-black text-white shadow-[0_8px_22px_rgba(22,123,209,.2)] transition hover:bg-[#1b8ae8] active:scale-[.99]">
              <UserPlus size={16} /> {profile.friendship === "pending" ? "Request Sent" : "Add Friend"}
            </button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setMessage(""); setQuickChatPerson(profile); }} className="grid size-11 place-items-center rounded-xl border border-[#285b91] bg-[#0a2946] text-[#9bd3ff]" aria-label={`Message ${name}`}>
              <MessageCircle size={18} />
            </button>
          </div>


        </div>
      </article>
    );
  };

  return (
    <>
      <div className="relative w-full overflow-visible" style={{ touchAction: "pan-y" }}>
        {stack.slice(1).reverse().map((profile, reverseIndex) => {
          const layer = stack.length - reverseIndex - 1;
          return renderProfile(profile, layer);
        })}
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
