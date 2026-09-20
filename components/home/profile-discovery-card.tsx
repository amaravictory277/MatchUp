"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, MessageCircle, Send, UserPlus, X } from "lucide-react";
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
  const [endReached, setEndReached] = useState(false);
  const [profilePreview, setProfilePreview] = useState<HomePerson | null>(null);
  const [profilePreviewClosing, setProfilePreviewClosing] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (people.length === 0) {
      setIndex(0);
      return;
    }
    setIndex((value) => Math.min(value, people.length - 1));
  }, [people.length]);

  const current = people[index] || null;

  const closeProfilePreview = useCallback(() => {
    if (!profilePreview || profilePreviewClosing) return;
    setProfilePreviewClosing(true);
    window.setTimeout(() => {
      setProfilePreview(null);
      setProfilePreviewClosing(false);
    }, 220);
  }, [profilePreview, profilePreviewClosing]);

  const publicStorageUrl = useCallback((path: string | null | undefined) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
    return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
  }, [supabase]);

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
      gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      source.stop(context.currentTime + duration);
      window.setTimeout(() => void context.close(), 180);
    } catch {}
  };

  const finishExit = (direction: "left" | "right") => {
    playSwipeSound();
    if (direction === "left") {
      const isLastCard = index >= people.length - 1 && !peopleHasMore;
      if (isLastCard) {
        setEndReached(true);
        window.setTimeout(() => setEndReached(false), 1800);
      } else {
        setIndex((value) => Math.min(value + 1, Math.max(0, people.length - 1)));
        if (people.length - index <= 4) void requestMore();
      }
    } else {
      // Right swipe is the quick-message gesture. The card completes its
      // swipe response, then returns to the surface while the sheet opens.
      setQuickChatPerson(current);
      setMessage("");
    }
    setDragX(0);
    if (direction === "left" && index >= people.length - 1 && !peopleHasMore) {
      window.setTimeout(() => setAnimating(false), 340);
    } else {
      setAnimating(false);
    }
  };

  const commitExit = (direction: "left" | "right") => {
    if (!current || animating) return;
    if (direction === "left" && index >= people.length - 1 && peopleHasMore) {
      void requestMore();
    }
    setAnimating(true);
    const width = cardRef.current?.getBoundingClientRect().width || 320;
    const distance = Math.max(window.innerWidth + 80, width + 180);
    setDragX(direction === "left" ? -distance : distance);
    window.setTimeout(() => {
      finishExit(direction);
    }, 340);
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || animating) return;
    startRef.current = { x: event.clientX, y: event.clientY };
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

  const renderProfileCard = (profile: HomePerson, active = false) => {
    const name = nameOf(profile);
    const coverUrl = publicStorageUrl(profile.cover_media_path);
    const avatarUrl = publicStorageUrl(profile.avatar_path);
    return (
      <article className="relative flex w-full flex-col overflow-hidden rounded-[28px] border border-[#245b91] bg-[#061426] shadow-[0_22px_70px_rgba(0,40,90,.28)]">
        <div className="relative h-[120px] overflow-hidden bg-[#061120] sm:h-[134px]">
          {coverUrl ? (
            profile.cover_media_type === "video" ? (
              <video src={coverUrl} className="absolute inset-0 size-full object-cover" autoPlay={active} muted loop playsInline preload={active ? "auto" : "metadata"} />
            ) : (
              <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
            )
          ) : (
            <img src="/1002371685.jpg" alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,20,39,.06)_0%,rgba(3,22,43,.12)_34%,rgba(4,21,41,.34)_60%,rgba(6,20,38,.78)_82%,#061426_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(37,135,226,.30),transparent_38%),radial-gradient(circle_at_88%_10%,rgba(31,94,154,.16),transparent_34%)]" />
          <img src="/matchup-logo.svg" alt="" className="absolute left-1/2 top-[48%] w-[150px] -translate-x-1/2 -translate-y-1/2 opacity-[.13] sm:w-[175px]" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#061426] to-transparent" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            <span className="rounded-full border border-[#2d78b9]/80 bg-[#0a2a48]/90 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.15em] text-[#d7efff] shadow-[0_8px_20px_rgba(0,0,0,.18)]">
              MatchUp Player
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#3a99eb] bg-[#092a49]/92 px-3 py-1.5 text-[11px] font-black text-[#e0f4ff] shadow-[0_8px_20px_rgba(0,0,0,.22)]">
              <Gamepad2 size={14} />Football
            </span>
          </div>
        </div>

        <div className="relative px-4 pb-2 pt-0 sm:px-5 sm:pb-3">
          <div className="relative -mt-2 flex flex-col items-center text-center">
            <button
              type="button"
              disabled={!avatarUrl}
              aria-label={avatarUrl ? "Preview profile picture" : undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); if (avatarUrl) { setProfilePreviewClosing(false); setProfilePreview(profile); } }}
              className="relative block rounded-full disabled:cursor-default"
            >
              <MatchUpAvatar
                profile={profile}
                size="lg"
                alt={name}
                className="!size-[78px] border-[3px] border-[#071426] shadow-[0_10px_26px_rgba(0,0,0,.42)] sm:!size-[86px]"
              />
            </button>
            <h3 className="mt-1.5 max-w-full whitespace-normal break-words text-[21px] font-black leading-[1.02] tracking-[-.03em] text-white sm:text-[23px]">
              {name}
            </h3>
            <p className="mt-0.5 text-[12px] font-semibold text-[#a8c2d9] sm:text-[13px]">
              {profile.country || "Country not set"}
            </p>
          </div>

          <div className="relative mx-auto mt-2 grid w-full max-w-[290px] grid-cols-2 overflow-hidden rounded-[16px] border border-[#245b91]/75 bg-[#08203a]/92 shadow-[inset_0_0_0_1px_rgba(71,168,255,.04)]">
            <span className="pointer-events-none absolute bottom-2.5 left-1/2 top-2.5 w-px -translate-x-1/2 bg-[#31597f]" aria-hidden="true" />
            <div className="px-3 py-2.5 text-center sm:py-3">
              <p className="text-lg font-black leading-none text-white sm:text-xl">{profile.postCount ?? 0}</p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-[.12em] text-[#8ca8c0] sm:text-[8px]">Posts</p>
            </div>
            <div className="px-3 py-2.5 text-center sm:py-3">
              <p className="text-lg font-black leading-none text-white sm:text-xl">{profile.followerCount ?? 0}</p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-[.12em] text-[#8ca8c0] sm:text-[8px]">Followers</p>
            </div>
          </div>

          {profile.bio?.trim() ? (
            <p className="mx-auto mt-2 max-w-[520px] line-clamp-2 text-center text-[11px] leading-5 text-[#9fb6cc]">{profile.bio.trim()}</p>
          ) : null}

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_52px] gap-2.5 sm:mt-3 sm:grid-cols-[minmax(0,1fr)_56px] sm:gap-3">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void onFriend(profile.id)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[15px] bg-[#1680d8] px-3 text-[12px] font-black text-white shadow-[0_10px_24px_rgba(22,128,216,.24)] transition hover:bg-[#218fe8] active:scale-[.99] sm:text-sm"
            >
              {profile.friendship === "pending" ? null : <UserPlus size={17} />}
              <span>{profile.friendship === "pending" ? "Request Sent" : "Add Friend"}</span>
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => { setMessage(""); setQuickChatPerson(profile); }}
              className="flex min-h-12 items-center justify-center rounded-[15px] border border-[#3a78ad] bg-[#082a49]/92 text-[#bfe4ff] transition hover:border-[#59acfa] hover:text-white"
              aria-label={`Message ${name}`}
            >
              <MessageCircle size={20} />
            </button>
          </div>
        </div>
      </article>
    );
  };

  const swipeViewport = typeof window === "undefined" ? 420 : Math.max(420, window.innerWidth);
  const progress = Math.min(1, Math.abs(dragX) / swipeViewport);
  const nextProfile = dragX < 0 ? people[index + 1] : null;

  return (
    <>
      <div
        className="relative w-full overflow-visible rounded-[28px]"
        style={{ touchAction: "pan-y" }}
      >
        {nextProfile ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 w-full origin-center"
            aria-hidden="true"
            style={{
              transform: `translate3d(0,0,0) scale(${0.2 + progress * 0.8})`,
              transition: animating ? "transform 340ms cubic-bezier(.16,1,.3,1)" : "none",
              willChange: "transform",
            }}
          >
            {renderProfileCard(nextProfile, false)}
          </div>
        ) : null}

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
            willChange: "transform",
          }}
        >
          {renderProfileCard(current, true)}
        </div>
      </div>

      {endReached ? (
        <div className="mt-3 w-full overflow-hidden rounded-2xl border border-[#3a99eb] bg-[#167bd1] px-2.5 py-3 text-center shadow-[0_10px_28px_rgba(22,123,209,.24)]" aria-live="polite">
          <span className="block whitespace-nowrap text-[11px] font-black text-white sm:text-sm">You have reached the end</span>
        </div>
      ) : null}

      {people.length > 1 ? (
        <div
          className="mt-3 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-1"
          aria-label={`People You May Know, card ${Math.min(index + 1, people.length)} of ${people.length}`}
        >
          <span className="justify-self-start whitespace-nowrap text-[9px] font-semibold text-[#7892ac] sm:text-[10px]">← Swipe left for next</span>
          <div className="flex items-center justify-center gap-1.5">
            {people.map((person, dotIndex) => (
              <span
                key={person.id}
                className={`rounded-full transition-all duration-200 ${
                  dotIndex === index ? "h-1.5 w-5 bg-[#70c1ff]" : "size-1.5 bg-[#31597f]"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="justify-self-end whitespace-nowrap text-[9px] font-semibold text-[#7892ac] sm:text-[10px]">Swipe right to message →</span>
        </div>
      ) : null}

      {profilePreview ? (() => {
        const previewUrl = publicStorageUrl(profilePreview.avatar_path);
        if (!previewUrl) return null;
        return (
          <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[2px] ${profilePreviewClosing ? "animate-[profile-preview-fade-out_.22s_ease-in_forwards]" : "animate-[profile-preview-fade_.22s_ease-out]"}`}
            role="dialog"
            aria-modal="true"
            aria-label="Profile picture preview"
            onClick={closeProfilePreview}
          >
            <div
              className={`relative aspect-square w-[min(72vw,340px)] overflow-hidden rounded-full border-[5px] border-[#071426] bg-[#061426] shadow-[0_24px_80px_rgba(0,0,0,.62)] ${profilePreviewClosing ? "animate-[profile-preview-shrink_.22s_cubic-bezier(.7,0,.84,0)_forwards]" : "animate-[profile-preview-grow_.28s_cubic-bezier(.16,1,.3,1)]"}`}
              onClick={(event) => event.stopPropagation()}
            >
              <img src={previewUrl} alt={nameOf(profilePreview)} className="size-full rounded-full object-cover" />
            </div>
          </div>
        );
      })() : null}

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
