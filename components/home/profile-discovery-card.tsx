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
  country: string | null;
  bio: string | null;
  supported_game?: string | null;
  is_verified?: boolean;
  followerCount?: number;
  postCount?: number;
};

const nameOf = (person: HomePerson) => person.display_name?.trim() || person.username || "MatchUp Player";
const gameLabel = (value?: string | null) => value?.trim() || "Football";

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

  const availablePeople = people.filter((profile) => !seenIdsRef.current.has(profile.id));
  const person = availablePeople[0] || null;
  const stack = availablePeople.slice(0, 3);

  const requestMore = useCallback(async () => {
    if (!onNeedMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      await onNeedMore();
    } finally {
      loadingMoreRef.current = false;
    }
  }, [onNeedMore]);

  useEffect(() => {
    if (!person && peopleHasMore && !peopleLoading) void requestMore();
  }, [person, peopleHasMore, peopleLoading, requestMore]);

  const finishExit = (direction: "left" | "right") => {
    const exited = person;
    if (exited) seenIdsRef.current.add(exited.id);
    setDragX(0);
    setAnimating(false);

    if (direction === "left") {
      if (availablePeople.length <= 6) void requestMore();
      return;
    }

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

  if (!person) {
    if (peopleLoading || peopleHasMore) {
      return (
        <div className="surface-card rounded-[28px] border-[#153c68] p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[#245b91] border-t-[#47a8ff]" />
          <p className="mt-3 font-black text-white">Finding more MatchUp players…</p>
          <p className="mt-1 text-sm text-[#7892ac]">Loading the next available profiles.</p>
        </div>
      );
    }
    return (
      <div className="surface-card overflow-hidden rounded-[28px] border-[#153c68]">
        <div className="grid min-h-[300px] place-items-center bg-[#071426] p-8 text-center">
          <div>
            <div className="mx-auto grid size-20 place-items-center rounded-full border border-[#245b91] bg-[#0b3154] p-4">
              <img src="/matchup-logo.svg" alt="MatchUp" className="size-full object-contain" />
            </div>
            <p className="mt-4 font-black text-white">You’re all caught up</p>
            <p className="mt-1 text-sm text-[#7892ac]">New MatchUp players will appear here when available.</p>
          </div>
        </div>
      </div>
    );
  }

  const progress = Math.min(1, Math.abs(dragX) / Math.max(420, typeof window === "undefined" ? 420 : window.innerWidth));
  const rotation = Math.max(-7, Math.min(7, dragX / 70));
  const transition = animating ? "transform 340ms cubic-bezier(.16,1,.3,1), opacity 280ms ease" : "none";

  const renderProfile = (profile: HomePerson, layer: number) => {
    const name = nameOf(profile);
    const isActive = layer === 0;
    // The next card starts at 10% scale and grows toward 100% as the front card leaves.
    const scale = isActive
      ? 1
      : Math.min(1, 0.1 + progress * 0.9 - (layer - 1) * 0.04);
    const translateY = isActive ? 0 : 10 + (layer - 1) * 10;

    return (
      <article
        key={profile.id}
        ref={isActive ? cardRef : undefined}
        className={`w-full rounded-[30px] border border-[#245b91] bg-[#071426] shadow-[0_22px_70px_rgba(0,40,90,.24)] ${isActive ? "relative z-20" : "pointer-events-none absolute inset-0 z-10"}`}
        aria-hidden={!isActive}
        onPointerDown={isActive ? pointerDown : undefined}
        onPointerMove={isActive ? pointerMove : undefined}
        onPointerUp={isActive ? pointerUp : undefined}
        onPointerCancel={isActive ? pointerCancel : undefined}
        style={{
          transform: isActive
            ? `translate3d(${dragX}px,0,0) rotate(${rotation}deg)`
            : `translate3d(0,${translateY}px,0) scale(${scale})`,
          opacity: isActive ? 1 - Math.min(0.22, Math.abs(dragX) / 1300) : 0.92,
          transition: isActive ? transition : "transform 340ms cubic-bezier(.16,1,.3,1)",
          willChange: "transform",
        }}
      >
        <div className="relative h-[220px] overflow-hidden rounded-t-[30px] bg-[#061120] sm:h-[270px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(36,151,255,.55),transparent_42%),linear-gradient(135deg,#0a2946,#061120_55%,#0b3154)]" />
          <div className="absolute -right-16 -top-20 size-64 rounded-full border border-[#2497ff]/25" />
          <div className="absolute -bottom-24 -left-10 size-56 rounded-full border border-[#2497ff]/20" />
          <img src="/matchup-logo.svg" alt="" className="absolute left-1/2 top-1/2 w-[210px] -translate-x-1/2 -translate-y-1/2 opacity-20 sm:w-[270px]" />
          <span className="absolute left-4 top-4 rounded-full border border-[#2c76b5] bg-[#061a2d]/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-[#9bd3ff]">MatchUp Player</span>
          <span className="absolute bottom-0 left-1/2 z-30 inline-flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 rounded-full border border-[#2b8ee6] bg-[#0a2946] px-3 py-2 text-[11px] font-black text-[#9bd3ff] shadow-[0_8px_18px_rgba(0,0,0,.28)]">
            <Gamepad2 size={13} /> {gameLabel(profile.supported_game)}
          </span>
        </div>

        <div className="relative px-5 pb-5 pt-3 sm:px-7 sm:pb-7 sm:pt-3">
          <div className="-mt-16 flex items-end justify-between gap-4">
            <MatchUpAvatar profile={profile} size="lg" alt={name} className="!size-28 shrink-0 border-4 border-[#071426] shadow-[0_14px_35px_rgba(0,0,0,.38)] sm:!size-32" />
            <div className="mb-1 flex items-center gap-2">
              {profile.is_verified ? <MatchUpVerificationBadge /> : null}
            </div>
          </div>

          <div className="mt-4 min-w-0">
            <h3 className="truncate text-[28px] font-black tracking-[-.03em] text-white sm:text-3xl">{name}</h3>
            <p className="mt-1 text-sm font-semibold text-[#86a1bb]">{profile.country || "Country not set"}</p>
          </div>

          {profile.bio?.trim() ? (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#b7c9da]">{profile.bio.trim()}</p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#183f68] bg-[#08182b]">
            <div className="p-4 text-center">
              <p className="text-2xl font-black text-white">{profile.postCount ?? 0}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.14em] text-[#7892ac]">Posts</p>
            </div>
            <div className="border-l border-[#183f68] p-4 text-center">
              <p className="text-2xl font-black text-white">{profile.followerCount ?? 0}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.14em] text-[#7892ac]">Followers</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => void onFriend(profile.id)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#167bd1] px-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(22,123,209,.22)] transition hover:bg-[#1b8ae8] active:scale-[.99]">
              <UserPlus size={17} /> Add Friend
            </button>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setMessage(""); setQuickChatPerson(profile); }} className="grid size-12 place-items-center rounded-2xl border border-[#285b91] bg-[#0a2946] text-[#9bd3ff] transition hover:border-[#47a8ff] hover:text-white" aria-label={`Message ${name}`}>
              <MessageCircle size={19} />
            </button>
          </div>

          {isActive && availablePeople.length > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-[#66809a]">
              <span className="inline-flex items-center gap-1"><ArrowRight size={12} className="rotate-180" /> Swipe left for next player</span>
              <span className="size-1 rounded-full bg-[#2b5d87]" />
              <span className="inline-flex items-center gap-1">Swipe right for quick chat <ArrowRight size={12} /></span>
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
          return renderProfile(profile, layer);
        })}
        {renderProfile(person, 0)}
      </div>

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
