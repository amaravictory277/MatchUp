"use client";

import { useMemo, useRef, useState } from "react";
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
const gameLabel = (value?: string | null) => !value || /football/i.test(value) ? "Football" : value;

export function ProfileDiscoveryCard({
  people,
  onFriend,
  notify,
}: {
  people: HomePerson[];
  onFriend: (id: string) => Promise<void> | void;
  notify: (message: string) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [index, setIndex] = useState(0);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [dragX, setDragX] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const person = people[index] || null;
  const next = people[index + 1] || null;

  const exitLeft = () => {
    if (!person || people.length <= index) return;
    const distance = Math.max(window.innerWidth, cardRef.current?.getBoundingClientRect().width || 0) + 180;
    setDragX(-distance);
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setDragX(0);
    }, 320);
  };

  const openQuickChat = () => {
    if (!person) return;
    const distance = Math.max(window.innerWidth, cardRef.current?.getBoundingClientRect().width || 0) + 120;
    setDragX(distance);
    window.setTimeout(() => {
      setDragX(0);
      setMessage("");
      setQuickChatOpen(true);
    }, 220);
  };

  const pointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    startRef.current = { x: event.clientX, y: event.clientY };
    draggingRef.current = false;
    setDragX(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      draggingRef.current = true;
      setDragX(dx);
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    const horizontal = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.15;
    startRef.current = null;
    if (!horizontal) {
      draggingRef.current = false;
      setDragX(0);
      return;
    }
    draggingRef.current = false;
    if (dx < 0) exitLeft();
    else openQuickChat();
  };

  const pointerCancel = () => {
    startRef.current = null;
    draggingRef.current = false;
    setDragX(0);
  };

  const sendQuickMessage = async () => {
    if (!person || !message.trim() || sending) return;
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        notify("Sign in to send a message.");
        return;
      }
      const { data: groupId, error: groupError } = await supabase.rpc("get_or_create_private_chat", { p_friend: person.id });
      if (groupError || !groupId) throw groupError || new Error("Could not open this chat.");
      const { error: messageError } = await supabase.from("chat_messages").insert({
        id: crypto.randomUUID(),
        group_id: groupId,
        sender_id: auth.user.id,
        body: message.trim(),
      });
      if (messageError) throw messageError;
      setQuickChatOpen(false);
      setMessage("");
      router.push(`/leaderboard?group=${groupId}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  if (!person) {
    return (
      <div className="surface-card rounded-[26px] border-[#153c68] p-6 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full border border-[#245b91] bg-[#0b3154] p-3">
          <img src="/matchup-logo.svg" alt="MatchUp" className="size-full object-contain" />
        </div>
        <p className="mt-3 font-black text-white">{people.length ? "You’re all caught up" : "No player suggestions yet"}</p>
        <p className="mt-1 text-sm text-[#7892ac]">{people.length ? "New MatchUp players will appear here when available." : "New MatchUp players will appear here when available."}</p>
      </div>
    );
  }

  const name = nameOf(person);
  const rotation = Math.max(-5, Math.min(5, dragX / 55));
  const transition = draggingRef.current
    ? "none"
    : "transform 320ms cubic-bezier(.22,1,.36,1), opacity 220ms ease";

  return (
    <>
      <div className="relative w-full overflow-visible">
        {next ? (
          <div
            className="pointer-events-none absolute inset-x-2 top-2 h-full scale-[.985] rounded-[26px] border border-[#173f68] bg-[#08182b] opacity-70"
            aria-hidden="true"
          />
        ) : null}

        <article
          key={person.id}
          ref={cardRef}
          className="relative z-10 w-full touch-pan-y overflow-hidden rounded-[26px] border border-[#245b91] bg-[#071426] shadow-[0_18px_55px_rgba(0,40,90,.22)]"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
          style={{
            transform: `translate3d(${dragX}px,0,0) rotate(${rotation}deg)`,
            opacity: 1 - Math.min(0.2, Math.abs(dragX) / 1200),
            transition,
            willChange: "transform",
          }}
        >
          <div className="relative h-[128px] overflow-hidden bg-[#061120] sm:h-[150px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(36,151,255,.55),transparent_42%),linear-gradient(135deg,#0a2946,#061120_55%,#0b3154)]" />
            <div className="absolute -right-16 -top-20 size-52 rounded-full border border-[#2497ff]/25" />
            <div className="absolute -bottom-24 -left-10 size-44 rounded-full border border-[#2497ff]/20" />
            <img src="/matchup-logo.svg" alt="" className="absolute left-1/2 top-1/2 w-[165px] -translate-x-1/2 -translate-y-1/2 opacity-[.16] sm:w-[205px]" />
            <span className="absolute left-3 top-3 rounded-full border border-[#2c76b5] bg-[#061a2d]/85 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#9bd3ff]">MatchUp Player</span>
          </div>

          <div className="relative px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="-mt-9 flex items-end justify-between gap-3">
              <MatchUpAvatar
                profile={person}
                size="lg"
                alt={name}
                className="!size-[74px] shrink-0 border-[3px] border-[#071426] shadow-[0_10px_24px_rgba(0,0,0,.34)] sm:!size-[82px]"
              />
              <div className="mb-1 flex items-center gap-1.5">
                {person.is_verified ? <MatchUpVerificationBadge /> : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-[#245b91] bg-[#0a2946] px-2.5 py-1.5 text-[10px] font-black text-[#9bd3ff]">
                  <Gamepad2 size={12} /> {gameLabel(person.supported_game)}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[20px] font-black tracking-[-.02em] text-white sm:text-[22px]">{name}</h3>
                <p className="mt-0.5 truncate text-xs font-semibold text-[#86a1bb]">{person.country || "Country not set"}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-[#183f68] bg-[#08182b]">
              <div className="px-3 py-2.5 text-center">
                <p className="text-lg font-black leading-none text-white">{person.postCount ?? 0}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-[#7892ac]">Posts</p>
              </div>
              <div className="border-l border-[#183f68] px-3 py-2.5 text-center">
                <p className="text-lg font-black leading-none text-white">{person.followerCount ?? 0}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-[#7892ac]">Followers</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => void onFriend(person.id)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-4 text-sm font-black text-white shadow-[0_8px_22px_rgba(22,123,209,.2)] transition hover:bg-[#1b8ae8] active:scale-[.99]"
              >
                <UserPlus size={16} /> Add Friend
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={openQuickChat}
                className="grid size-11 place-items-center rounded-xl border border-[#285b91] bg-[#0a2946] text-[#9bd3ff] transition hover:border-[#47a8ff] hover:text-white"
                aria-label={`Message ${name}`}
              >
                <MessageCircle size={18} />
              </button>
            </div>

            {people.length > index + 1 ? (
              <div className="mt-2 flex items-center justify-center gap-2 text-[9px] font-bold text-[#66809a]">
                <span className="inline-flex items-center gap-1"><ArrowRight size={11} className="rotate-180" /> Swipe left</span>
                <span className="size-1 rounded-full bg-[#2b5d87]" />
                <span className="inline-flex items-center gap-1">Quick chat <ArrowRight size={11} /></span>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      {quickChatOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" onClick={() => !sending && setQuickChatOpen(false)}>
          <section className="w-full max-w-lg rounded-t-[30px] border border-[#245b91] bg-[#08182b] p-5 shadow-[0_24px_80px_rgba(0,0,0,.6)] sm:rounded-[30px]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3">
              <MatchUpAvatar profile={person} size="md" alt={name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-white">{name}</p>
                <p className="text-xs text-[#7892ac]">{person.country || "MatchUp player"}</p>
              </div>
              <button type="button" onClick={() => setQuickChatOpen(false)} className="icon-button" aria-label="Close quick chat"><X size={17} /></button>
            </div>
            <p className="mt-4 text-xs text-[#7892ac]">Quick message</p>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} autoFocus rows={4} maxLength={1000} placeholder={`Write a message to ${name}…`} className="mt-2 w-full resize-none rounded-2xl border border-[#214a78] bg-[#071426] p-4 text-sm leading-6 text-white outline-none focus:border-[#47a8ff]" />
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={sending || !message.trim()} onClick={() => void sendQuickMessage()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#167bd1] px-4 py-3.5 text-sm font-black text-white disabled:opacity-50"><Send size={16} /> {sending ? "Sending…" : "Send Message"}</button>
              <button type="button" disabled={sending} onClick={() => setQuickChatOpen(false)} className="rounded-2xl border border-[#214a78] px-4 py-3.5 text-sm font-black text-[#b7c9da]">Cancel</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
