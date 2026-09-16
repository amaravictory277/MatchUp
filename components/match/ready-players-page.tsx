"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Gamepad2, Loader2, Swords, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_path: string | null;
  ready_player_enabled: boolean;
};

type MatchRequest = {
  id: string;
  requester_id: string;
  opponent_id: string;
  status: string;
  created_at: string;
  responded_at?: string | null;
  profiles?: Profile | Profile[] | null;
  matches?: { id: string; match_conversations?: { conversation_id: string } | { conversation_id: string }[] | null } | { id: string; match_conversations?: { conversation_id: string } | { conversation_id: string }[] | null }[] | null;
};

const nameOf = (p: Profile) => p.display_name || p.username || "MatchUp Player";
const profileOf = (request: MatchRequest) => Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
const matchOf = (request: MatchRequest) => Array.isArray(request.matches) ? request.matches[0] : request.matches;
const conversationOf = (request: MatchRequest) => {
  const match = matchOf(request);
  const relation = match?.match_conversations;
  return Array.isArray(relation) ? relation[0]?.conversation_id : relation?.conversation_id;
};

export function ReadyPlayersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [meReady, setMeReady] = useState(false);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<MatchRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MatchRequest[]>([]);
  const [activeMatchCount, setActiveMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/auth");
      return;
    }

    const id = auth.user.id;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: me }, { data: ps }, { data: reqsIn }, { data: reqsOut }, { count: activeCount }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,username,avatar_path,ready_player_enabled").eq("id", id).maybeSingle(),
      supabase.rpc("get_ready_players"),
      supabase
        .from("match_requests")
        .select("id,requester_id,opponent_id,status,created_at,responded_at,profiles!match_requests_requester_id_fkey(id,display_name,username,avatar_path,ready_player_enabled),matches(id,match_conversations(conversation_id))")
        .eq("opponent_id", id)
        .in("status", ["pending", "accepted"])
        .or(`status.eq.pending,responded_at.gte.${cutoff}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("match_requests")
        .select("id,requester_id,opponent_id,status,created_at,responded_at,profiles!match_requests_opponent_id_fkey(id,display_name,username,avatar_path,ready_player_enabled),matches(id,match_conversations(conversation_id))")
        .eq("requester_id", id)
        .in("status", ["pending", "accepted"])
        .or(`status.eq.pending,responded_at.gte.${cutoff}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .or(`player_a_id.eq.${id},player_b_id.eq.${id}`)
        .eq("status", "active"),
    ]);

    setMeReady(Boolean((me as Profile | null)?.ready_player_enabled));
    setPlayers((ps || []) as Profile[]);
    setIncoming((reqsIn || []) as MatchRequest[]);
    setOutgoing((reqsOut || []) as MatchRequest[]);
    setActiveMatchCount(activeCount || 0);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    let active = true;
    let currentSession: string | null = null;

    const start = async () => {
      const { data, error } = await supabase.rpc("start_ready_match_presence");
      if (!active) return;
      if (error) {
        setNotice(error.message);
        setLoading(false);
        return;
      }
      currentSession = data as string;
      setSessionId(currentSession);
      await load();
    };

    void start();

    const heartbeat = window.setInterval(() => {
      if (currentSession && document.visibilityState === "visible") {
        void supabase.rpc("heartbeat_ready_match_presence", { p_session_id: currentSession }).then(({ error }) => {
          if (error && active) setNotice(error.message);
        });
      }
    }, 7000);

    const channel = supabase
      .channel("matchup-ready-match-state")
      .on("postgres_changes", { event: "*", schema: "public", table: "match_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ready_match_presence" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => void load())
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
      if (currentSession) void supabase.rpc("stop_ready_match_presence", { p_session_id: currentSession });
    };
  }, [load, supabase]);

  const toggleReady = async () => {
    setBusy("self");
    setNotice("");
    if (!sessionId) {
      setNotice("Ready Match is still connecting. Try again in a moment.");
      setBusy("");
      return;
    }
    const { data, error } = await supabase.rpc("set_ready_player", { p_enabled: !meReady });
    if (error) setNotice(error.message);
    else setMeReady(Boolean(data));
    setBusy("");
    await load();
  };

  const challenge = async (id: string) => {
    setBusy(id);
    setNotice("");
    const { error } = await supabase.rpc("send_match_request", { p_opponent_id: id });
    if (error) setNotice(error.message);
    setBusy("");
    await load();
  };

  const openMatchChat = (conversationId: string | undefined) => {
    if (conversationId) router.push(`/leaderboard?group=${conversationId}`);
    else setNotice("The match chat is not available yet. Please refresh and try again.");
  };

  const respond = async (request: MatchRequest, accept: boolean) => {
    setBusy(request.id);
    setNotice("");
    const { data, error } = await supabase.rpc("respond_match_request", {
      p_request_id: request.id,
      p_accept: accept,
    });
    if (error) {
      setNotice(error.message);
    } else if (accept && data) {
      const { data: conversation } = await supabase
        .from("match_conversations")
        .select("conversation_id")
        .eq("match_id", data as string)
        .maybeSingle();
      if (conversation?.conversation_id) router.push(`/leaderboard?group=${conversation.conversation_id}`);
      else setNotice("The match was created, but its private chat is not available yet.");
      await load();
    } else {
      await load();
    }
    setBusy("");
  };

  return (
    <main className="min-h-screen bg-[#061120] px-4 pb-28 pt-5 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 border-b border-white/5 pb-5">
          <button type="button" onClick={() => router.back()} className="icon-button" aria-label="Back"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Quick Match</p><h1 className="text-2xl font-black">Ready Players</h1></div>
          <Gamepad2 size={22} className="text-[#47a8ff]" />
        </header>

        {notice ? <div role="status" className="mt-4 rounded-2xl border border-[#205d8e] bg-[#0a2946] px-4 py-3 text-sm font-bold text-[#bfe3ff]">{notice}</div> : null}

        <section className="mt-6 rounded-2xl border border-[#18365f] bg-[#071426] p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#0b3154] text-[#70c1ff]"><Swords size={21} /></span>
            <div className="min-w-0 flex-1"><h2 className="font-black">Ready to play?</h2><p className="mt-1 text-xs leading-5 text-[#7892ac]">Turn on Ready Player so other MatchUp users can send you a real 1v1 request.</p></div>
            <button type="button" onClick={() => void toggleReady()} disabled={busy === "self" || !sessionId} className={`rounded-xl px-3 py-2 text-xs font-black ${meReady ? "bg-[#35a66f] text-white" : "bg-[#167bd1] text-white"} disabled:opacity-50`}>{busy === "self" ? <Loader2 size={14} className="animate-spin" /> : "Ready"}</button>
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-[#18365f] bg-[#071426] px-4 py-3 text-sm font-bold text-[#b7c9da]">You have {activeMatchCount} active match{activeMatchCount === 1 ? "" : "es"}. This does not affect Ready Player availability.</div>

        {incoming.length ? <section className="mt-7"><h2 className="mb-3 text-sm font-black uppercase tracking-[.14em] text-[#70c1ff]">Match Requests</h2><div className="space-y-2">{incoming.map((request) => {const profile = profileOf(request);if (!profile) return null;const accepted = request.status === "accepted";return <div key={request.id} className="rounded-2xl border border-[#214a78] bg-[#0a2139] p-3"><div className="flex items-center gap-3"><MatchUpAvatar profile={profile} size="md" alt={nameOf(profile)} /><div className="min-w-0 flex-1"><p className="truncate font-black">{nameOf(profile)}</p><p className="text-xs text-[#7892ac]">{accepted ? "You matched — open the dedicated private chat." : "wants to play a quick match"}</p></div></div>{accepted ? <button type="button" disabled={!conversationOf(request)} onClick={() => openMatchChat(conversationOf(request))} className="mt-3 w-full rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black disabled:opacity-50">MESSAGE NOW</button> : <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy === request.id} onClick={() => void respond(request, true)} className="rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black"><Check size={14} className="mr-1 inline" />Accept</button><button type="button" disabled={busy === request.id} onClick={() => void respond(request, false)} className="rounded-xl border border-[#36506b] px-4 py-2.5 text-xs font-black text-[#b7c9da]"><X size={14} className="mr-1 inline" />Decline</button></div>}</div>})}</div></section> : null}

        {outgoing.length ? <section className="mt-7"><h2 className="mb-3 text-sm font-black uppercase tracking-[.14em] text-[#70c1ff]">Your Requests</h2><div className="space-y-2">{outgoing.map((request) => {const profile = profileOf(request);if (!profile) return null;const accepted = request.status === "accepted";return <div key={request.id} className="rounded-2xl border border-[#18365f] bg-[#071426] p-3"><div className="flex items-center gap-3"><MatchUpAvatar profile={profile} size="md" alt={nameOf(profile)} /><div className="min-w-0 flex-1"><p className="truncate font-black">{nameOf(profile)}</p><p className="text-xs text-[#7892ac]">{accepted ? "Match accepted" : "Request sent"}</p></div></div>{accepted ? <button type="button" disabled={!conversationOf(request)} onClick={() => openMatchChat(conversationOf(request))} className="mt-3 w-full rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black disabled:opacity-50">MESSAGE NOW</button> : null}</div>})}</div></section> : null}

        <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-black">Players ready now</h2><p className="mt-1 text-xs text-[#7892ac]">Only users who are connected, inside Ready Match, and have enabled Ready Player are shown.</p></div><span className="text-xs font-bold text-[#7892ac]">{players.length}</span></div>{loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading ready players…</div> : players.length ? <div className="space-y-2">{players.map((player) => <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-[#18365f] bg-[#071426] p-3"><MatchUpAvatar profile={player} size="md" alt={nameOf(player)} /><div className="min-w-0 flex-1"><p className="truncate font-black">{nameOf(player)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-[#7892ac]"><span className="size-2 rounded-full bg-[#35c58a]" />Ready to play</p></div><button type="button" disabled={busy === player.id} onClick={() => void challenge(player.id)} className="flex items-center gap-1.5 rounded-xl bg-[#167bd1] px-3 py-2.5 text-xs font-black disabled:opacity-50"><Swords size={14} />{busy === player.id ? "Sending…" : "Challenge"}</button></div>)}</div> : <div className="surface-card p-8 text-center"><UserRound size={28} className="mx-auto text-[#47a8ff]" /><p className="mt-3 font-black">No ready players right now</p><p className="mt-1 text-sm text-[#7892ac]">You can turn on Ready Player and wait for another user.</p></div>}</section>
      </div>
    </main>
  );
}
