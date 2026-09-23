"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, MoreVertical, Reply, Send, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Match = {
  fixtureId: string;
  league: { name: string; logo: string | null };
  status: { code: string; label: string; elapsed: number | null; live: boolean; finished: boolean };
  startsAt: string;
  home: { name: string; logo: string | null; score: number | null };
  away: { name: string; logo: string | null; score: number | null };
};

type Message = {
  id: string;
  sender_id: string;
  reply_to_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_path: string | null } | null;
};

const emojis = ["❤️","😂","🔥","👏","😡","⚽"];

function displayName(profile?: Message["profile"]) {
  return profile?.display_name?.trim() || profile?.username || "MatchUp Player";
}
function relative(value: string) {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return \`\${minutes}m\`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return \`\${hours}h\`;
  const days = Math.floor(hours / 24);
  return \`\${days}d\`;
}

export function MatchRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [userId, setUserId] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const [canonicalName, setCanonicalName] = useState("");
  const [customName, setCustomName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [voteState, setVoteState] = useState({ home: 0, away: 0, total: 0, myVote: null as "home" | "away" | null });

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/auth"); return; }
    setUserId(auth.user.id);

    const { data: room, error: roomError } = await supabase
      .from("football_match_rooms")
      .select("id,fixture_id,canonical_name,football_fixture_cache(payload)")
      .eq("id", roomId)
      .maybeSingle();
    if (roomError || !room) { setNotice("This Match Room is unavailable."); setLoading(false); return; }

    const cache = Array.isArray((room as any).football_fixture_cache) ? (room as any).football_fixture_cache[0] : (room as any).football_fixture_cache;
    setCanonicalName((room as any).canonical_name || "Match Room");
    setMatch(cache?.payload || null);

    const [{ data: member }, { data: settings }, { data: rows }, { data: reactionRows }] = await Promise.all([
      supabase.from("football_match_room_members").select("muted").eq("room_id", roomId).eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("football_match_room_settings").select("custom_name").eq("room_id", roomId).eq("user_id", auth.user.id).maybeSingle(),
      supabase.from("football_match_messages").select("id,sender_id,reply_to_id,body,edited_at,deleted_at,created_at,profiles!football_match_messages_sender_id_fkey(display_name,username,avatar_path)").eq("room_id", roomId).order("created_at", { ascending: true }).limit(300),
      supabase.from("football_match_message_reactions").select("message_id,user_id,emoji").limit(3000),
    ]);

    if (!member) {
      setNotice("You have left this Match Room.");
      setLoading(false);
      return;
    }

    const { data: voteRows } = await supabase.from("football_match_votes").select("user_id,team").eq("fixture_id", (room as any).fixture_id);
    const voteHome = (voteRows || []).filter((row:any) => row.team === "home").length;
    const voteAway = (voteRows || []).filter((row:any) => row.team === "away").length;
    const voteMine = (voteRows || []).find((row:any) => row.user_id === auth.user.id)?.team || null;
    setVoteState({ home: voteHome, away: voteAway, total: voteHome + voteAway, myVote: voteMine as "home" | "away" | null });
    setMuted(Boolean(member.muted));
    setCustomName(settings?.custom_name || "");
    setRenameValue(settings?.custom_name || (room as any).canonical_name || "");
    setMessages(((rows || []) as any[]).map(row => ({ ...row, profile: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles })));
    const grouped: Record<string,string[]> = {};
    (reactionRows || []).forEach((row:any) => { grouped[row.message_id] = [...(grouped[row.message_id] || []), row.emoji]; });
    setReactions(grouped);
    setLoading(false);
  }, [roomId, router, supabase]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(\`match-room-\${roomId}\`)
      .on("postgres_changes", { event: "*", schema: "public", table: "football_match_messages", filter: \`room_id=eq.\${roomId}\` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "football_match_message_reactions" }, () => void load())
      .subscribe();
    const timer = window.setInterval(async () => {
      const current = match;
      if (!current) return;
      const response = await fetch(\`/api/football/matches?fixture=\${encodeURIComponent(current.fixtureId)}&refresh=1\`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.matches?.[0]) setMatch(payload.matches[0]);
    }, 60000);
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load, match, roomId, supabase]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    if (editing) {
      const { error } = await supabase.from("football_match_messages").update({ body, edited_at: new Date().toISOString() }).eq("id", editing.id).eq("sender_id", userId);
      if (error) setNotice(error.message); else { setEditing(null); setText(""); }
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("football_match_messages").insert({ room_id: roomId, sender_id: userId, reply_to_id: replyTo?.id || null, body });
    if (error) setNotice(error.message); else { setReplyTo(null); setText(""); }
    setBusy(false);
  };

  const deleteMessage = async (message: Message) => {
    if (message.sender_id !== userId) return;
    const { error } = await supabase.from("football_match_messages").update({ deleted_at: new Date().toISOString(), body: "[Message deleted]" }).eq("id", message.id).eq("sender_id", userId);
    if (error) setNotice(error.message);
  };

  const react = async (messageId: string, emoji: string) => {
    const existing = reactions[messageId]?.filter(item => item === emoji).length;
    if (existing) await supabase.from("football_match_message_reactions").delete().eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji);
    else await supabase.from("football_match_message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    void load();
  };

  const vote = async (team: "home" | "away") => {
    if (!match) return;
    const { data, error } = await supabase.rpc("cast_match_vote", { p_fixture_id: match.fixtureId, p_team: team });
    if (error) setNotice(error.message);
    else {
      const row = Array.isArray(data) ? data[0] : data;
      setNotice(\`Vote recorded: \${Number(row?.home_percent || 0)}% / \${Number(row?.away_percent || 0)}%\`);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    const { error } = await supabase.rpc("set_match_room_mute", { p_room_id: roomId, p_muted: next });
    if (error) setNotice(error.message); else { setMuted(next); setMenuOpen(false); }
  };

  const rename = async () => {
    const { data, error } = await supabase.rpc("set_match_room_name", { p_room_id: roomId, p_name: renameValue });
    if (error) setNotice(error.message);
    else { setCustomName(data || ""); setRenaming(false); setMenuOpen(false); }
  };

  const leave = async () => {
    const { error } = await supabase.rpc("leave_match_room", { p_room_id: roomId });
    if (error) setNotice(error.message);
    else router.replace("/home");
  };

  if (loading) return <main className="grid min-h-[100dvh] place-items-center bg-[#061120] text-sm text-[#7892ac]">Loading Match Room…</main>;
  if (!match) return <main className="min-h-[100dvh] bg-[#061120] p-5 text-white"><button type="button" onClick={() => router.back()} className="icon-button"><ArrowLeft size={18}/></button><div className="mx-auto mt-16 max-w-lg rounded-3xl border border-[#214a78] bg-[#071426] p-7 text-center"><p className="font-black">Match Room unavailable</p><p className="mt-2 text-sm text-[#7892ac]">{notice}</p></div></main>;

  const title = customName || canonicalName;
  return (
    <main className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#061120] text-white">
      <header className="shrink-0 border-b border-[#17395e] bg-[#071426]/98 px-3 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()} className="icon-button" aria-label="Back"><ArrowLeft size={18}/></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{title}</p>
            <p className={\`mt-0.5 text-[9px] font-black uppercase tracking-[.12em] \${match.status.live ? "text-[#5df2c1]" : "text-[#70c1ff]"}\`}>{match.status.live ? \`LIVE\${match.status.elapsed ? \` · \${match.status.elapsed}'\` : ""}\` : match.status.label}</p>
          </div>
          <button type="button" onClick={() => setMenuOpen(value => !value)} className="icon-button" aria-label="Match Room options"><MoreVertical size={18}/></button>
        </div>

        <div className="mt-3 rounded-2xl border border-[#1b527f] bg-[#0a2139] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-center"><img src={match.home.logo || ""} alt="" className="mx-auto size-9 object-contain"/><p className="mt-1 truncate text-[10px] font-black">{match.home.name}</p><p className="mt-1 text-2xl font-black">{match.home.score ?? "—"}</p></div>
            <div className="text-center"><p className="text-[8px] font-black uppercase tracking-[.14em] text-[#70c1ff]">{match.league.name}</p><p className="mt-1 text-[9px] font-black text-[#7892ac]">VS</p></div>
            <div className="min-w-0 flex-1 text-center"><img src={match.away.logo || ""} alt="" className="mx-auto size-9 object-contain"/><p className="mt-1 truncate text-[10px] font-black">{match.away.name}</p><p className="mt-1 text-2xl font-black">{match.away.score ?? "—"}</p></div>
          </div>
          <div className="mt-3 rounded-xl border border-[#173f68] bg-[#061426] p-2.5">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[.08em]"><span className="text-[#70c1ff]">{voteState.total ? Math.round(voteState.home / voteState.total * 100) : 0}% {match.home.name}</span><span className="text-[#ff9ca9]">{voteState.total ? Math.round(voteState.away / voteState.total * 100) : 0}% {match.away.name}</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#ff657b]"><div className="h-full bg-[#70c1ff]" style={{width: `${voteState.total ? Math.round(voteState.home / voteState.total * 100) : 0}%`}} /></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => void vote("home")} className={`rounded-xl border px-2 py-2.5 text-[10px] font-black ${voteState.myVote === "home" ? "border-[#70c1ff] bg-[#0b3154]" : "border-[#214a78] bg-[#071426]"} text-[#bfe3ff]`}>Vote {match.home.name}</button><button type="button" onClick={() => void vote("away")} className={`rounded-xl border px-2 py-2.5 text-[10px] font-black ${voteState.myVote === "away" ? "border-[#ff8797] bg-[#341b2a]" : "border-[#214a78] bg-[#071426]"} text-[#ffb5bf]`}>Vote {match.away.name}</button></div>
        </div>
      </header>

      {menuOpen ? (
        <div className="absolute right-3 top-14 z-50 w-56 rounded-2xl border border-[#245b91] bg-[#08182b] p-2 shadow-[0_20px_60px_rgba(0,0,0,.5)]">
          <button type="button" onClick={() => { setRenaming(true); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-[#0b3154]"><Edit3 size={16}/>Rename Match Room</button>
          <button type="button" onClick={() => void toggleMute()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-[#0b3154]">{muted?<Volume2 size={16}/>:<VolumeX size={16}/>} {muted?"Unmute Match Room":"Mute Match Room"}</button>
          <button type="button" onClick={() => void leave()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-[#ffadb7] hover:bg-[#24151a]"><X size={16}/>Leave Match Room</button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          {messages.map(message => {
            const own = message.sender_id === userId;
            const reply = message.reply_to_id ? messages.find(item => item.id === message.reply_to_id) : null;
            const messageReactions = reactions[message.id] || [];
            return (
              <article key={message.id} className={\`group flex \${own ? "justify-end" : "justify-start"}\`}>
                <div className={\`max-w-[86%] rounded-2xl border px-3 py-2.5 \${own ? "border-[#1f6da8] bg-[#0b3154]" : "border-[#183b62] bg-[#071426]"}\`}>
                  {!own ? <p className="mb-1 text-[10px] font-black text-[#70c1ff]">{displayName(message.profile)}</p> : null}
                  {reply ? <div className="mb-2 rounded-xl border-l-2 border-[#47a8ff] bg-[#061120]/60 px-2.5 py-1.5 text-[9px] text-[#7892ac]"><span className="font-black text-[#bfe3ff]">{displayName(reply.profile)}</span>: {reply.body.slice(0,120)}</div> : null}
                  <p className={\`whitespace-pre-wrap break-words text-sm leading-6 \${message.deleted_at ? "italic text-[#7892ac]" : "text-white"}\`}>{message.body}</p>
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-[#7892ac]"><span>{relative(message.created_at)}</span>{message.edited_at && !message.deleted_at ? <span>edited</span> : null}{own && !message.deleted_at ? <><button type="button" onClick={() => { setEditing(message); setText(message.body); setReplyTo(null); }} aria-label="Edit message"><Edit3 size={11}/></button><button type="button" onClick={() => void deleteMessage(message)} aria-label="Delete message"><Trash2 size={11}/></button></> : null}<button type="button" onClick={() => setReplyTo(message)} aria-label="Reply"><Reply size={11}/></button></div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">{emojis.map(emoji => <button type="button" key={emoji} onClick={() => void react(message.id, emoji)} className={\`rounded-full border px-1.5 py-0.5 text-[10px] \${messageReactions.includes(emoji) ? "border-[#47a8ff] bg-[#0b3154]" : "border-[#214a78] bg-[#061426]"}\`}>{emoji}</button>)}</div>
                </div>
              </article>
            );
          })}
          {!messages.length ? <div className="py-16 text-center text-sm text-[#7892ac]">Start the match discussion.</div> : null}
        </div>
      </div>

      <footer className="shrink-0 border-t border-[#17395e] bg-[#071426] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          {replyTo || editing ? <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#214a78] bg-[#061426] px-3 py-2 text-xs text-[#7892ac]"><Reply size={13}/><span className="min-w-0 flex-1 truncate">{editing ? "Editing your message" : \`Replying to \${displayName(replyTo?.profile)}\`}</span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setText(""); }}><X size={14}/></button></div> : null}
          <div className="flex items-end gap-2 rounded-2xl border border-[#214a78] bg-[#061426] p-2">
            <textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send();} }} rows={1} maxLength={2000} placeholder="Write a match reaction…" className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white outline-none placeholder:text-[#5f7b96]"/>
            <button type="button" disabled={busy || !text.trim()} onClick={() => void send()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#167bd1] text-white disabled:opacity-50" aria-label="Send message"><Send size={16}/></button>
          </div>
          <p className="mt-1 px-1 text-[9px] text-[#5f7b96]">Text discussion only · links, stickers and media are not supported.</p>
        </div>
      </footer>

      {renaming ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" onClick={() => setRenaming(false)}><section className="w-full max-w-sm rounded-3xl border border-[#245b91] bg-[#08182b] p-5" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-black">Rename Match Room</h2><button type="button" onClick={() => setRenaming(false)} className="icon-button"><X size={16}/></button></div><input value={renameValue} onChange={event => setRenameValue(event.target.value)} maxLength={80} className="mt-4 w-full rounded-xl border border-[#214a78] bg-[#061426] px-3 py-3 text-sm text-white outline-none focus:border-[#47a8ff]"/><button type="button" onClick={() => void rename()} className="mt-3 w-full rounded-xl bg-[#167bd1] px-4 py-3 text-sm font-black">Save Name</button></section></div> : null}
      {notice ? <div role="status" className="fixed left-1/2 top-3 z-[110] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-[#245b91] bg-[#08182b] px-4 py-3 text-sm font-bold shadow-xl">{notice}</div> : null}
    </main>
  );
}
