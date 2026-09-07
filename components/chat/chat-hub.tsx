"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Copy,
  Forward,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  Reply,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type Profile = { id: string; display_name?: string | null; username?: string | null };
type Group = { id: string; name: string; created_by: string; created_at: string };
type Friend = Profile;
type Invite = { id: string; group_id: string; invited_by: string; invited_user_id: string; status: string; created_at: string; chat_groups?: Group | Group[] | null; inviter?: Profile | Profile[] | null };
type Message = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  sticker_key?: string | null;
  reply_to_id?: string | null;
  created_at: string;
  deleted_at?: string | null;
  profiles?: Profile | Profile[] | null;
  reactions?: Reaction[];
  pending?: boolean;
};
type Reaction = { message_id: string; user_id: string; emoji: string };
type ReadState = { message_id: string; user_id: string; read_at: string };
type Presence = { user_id: string; name?: string; typing?: boolean };

type MenuState = { message: Message; x: number; y: number } | null;

const STICKERS = ["⚽", "🏆", "🔥", "🎮", "😎", "😂", "🫡", "👑", "💜", "✅", "💯", "🙌"];
const QUICK_REACTIONS = ["😀", "❤️", "🔥", "😂", "😮", "😢", "🙏", "👍"];
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\s)+$/u;
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function normalizeProfile(value: Profile | Profile[] | null | undefined): Profile | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
function normalizeGroup(value: Group | Group[] | null | undefined): Group | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
function displayName(profile?: Profile | Profile[] | null, fallback = "Member") {
  const p = normalizeProfile(profile);
  return p?.display_name || p?.username || fallback;
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function validateChatClient(body: string) {
  const urls = body.match(URL_RE) || [];
  for (const raw of urls) {
    const url = raw.startsWith("www.") ? `https://${raw}` : raw;
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.pathname !== "/feeds" && !parsed.pathname.startsWith("/feeds/")) return "Only links copied from MatchUp Feeds can be shared in groups.";
      if (parsed.origin !== window.location.origin && parsed.hostname !== "match-up-ten.vercel.app") return "Only MatchUp Feeds links are allowed in group chat.";
    } catch {
      return "That link could not be validated.";
    }
  }
  if (/(data:image|javascript:|blob:|\.(png|jpe?g|gif|webp|mp4|mov|webm|m4a|mp3)(\?|$|\s))/i.test(body)) {
    return "Images, videos, audio and file links are not allowed in group chat.";
  }
  return null;
}

export function ChatHub() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<{ id: string; displayName: string }>({ id: "", displayName: "You" });
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reads, setReads] = useState<ReadState[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [error, setError] = useState("");
  const [sendingIds, setSendingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroups, setShowGroups] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showInvitePane, setShowInvitePane] = useState(false);
  const [typingNotice, setTypingNotice] = useState("");

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadUserAndGroups = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setLoading(false);
      setError("Sign in to use group chat.");
      return;
    }
    const { data: me } = await supabase.from("profiles").select("id,display_name,username").eq("id", auth.user.id).maybeSingle();
    setUser({ id: auth.user.id, displayName: displayName(me, "You") });

    const [{ data: memberships }, { data: friendRows }, { data: inviteRows }] = await Promise.all([
      supabase.from("chat_group_members").select("group_id,chat_groups(id,name,created_by,created_at)").eq("user_id", auth.user.id),
      supabase.from("friendships").select("user_id,friend_id").eq("status", "accepted").or(`user_id.eq.${auth.user.id},friend_id.eq.${auth.user.id}`),
      supabase.from("chat_group_invites").select("id,group_id,invited_by,invited_user_id,status,created_at,chat_groups(id,name,created_by,created_at)").eq("invited_user_id", auth.user.id).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    const groupList = (memberships || []).map((row: { chat_groups?: Group | Group[] | null }) => normalizeGroup(row.chat_groups)).filter(Boolean) as Group[];
    setGroups(groupList);
    setInvites((inviteRows || []) as Invite[]);

    const friendIds = (friendRows || []).map((row: { user_id: string; friend_id: string }) => row.user_id === auth.user.id ? row.friend_id : row.user_id);
    if (friendIds.length) {
      const { data: friendProfiles } = await supabase.from("profiles").select("id,display_name,username").in("id", friendIds);
      setFriends(friendProfiles || []);
    } else {
      setFriends([]);
    }
    setLoading(false);
    if (!activeGroup && groupList[0]) setActiveGroup(groupList[0]);
  }, [supabase, activeGroup]);

  useEffect(() => { void loadUserAndGroups(); }, [loadUserAndGroups]);

  const markVisibleRead = useCallback(async (list: Message[], uid: string) => {
    const ids = list.filter((m) => m.sender_id !== uid && !m.deleted_at).map((m) => m.id);
    if (!ids.length) return;
    const rows = ids.map((message_id) => ({ message_id, user_id: uid }));
    await supabase.from("chat_message_reads").upsert(rows, { onConflict: "message_id,user_id" });
  }, [supabase]);

  const refreshGroup = useCallback(async (group: Group) => {
    const [{ data: messageRows, error: messageError }, { data: reactionRows }, { data: readRows }, { data: memberRows }] = await Promise.all([
      supabase.from("chat_messages").select("id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles(id,display_name,username)").eq("group_id", group.id).order("created_at", { ascending: true }).limit(500),
      supabase.from("chat_message_reactions").select("message_id,user_id,emoji").in("message_id", (await supabase.from("chat_messages").select("id").eq("group_id", group.id).limit(500)).data?.map((m) => m.id) || []),
      supabase.from("chat_message_reads").select("message_id,user_id,read_at").in("message_id", (await supabase.from("chat_messages").select("id").eq("group_id", group.id).limit(500)).data?.map((m) => m.id) || []),
      supabase.from("chat_group_members").select("user_id,profiles(id,display_name,username)").eq("group_id", group.id),
    ]);
    if (messageError) { setError(messageError.message); return; }
    const normalized = (messageRows || []).map((row: Message) => ({ ...row, profiles: normalizeProfile(row.profiles) }));
    setMessages(normalized);
    setReactions((reactionRows || []) as Reaction[]);
    setReads((readRows || []) as ReadState[]);
    setMembers((memberRows || []).map((row: { profiles?: Profile | Profile[] | null }) => normalizeProfile(row.profiles)).filter(Boolean) as Profile[]);
    await markVisibleRead(normalized, user.id);
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
  }, [markVisibleRead, supabase, user.id]);

  useEffect(() => {
    if (!activeGroup || !user.id) return;
    void refreshGroup(activeGroup);
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`chat-group-${activeGroup.id}`, { config: { presence: { key: user.id } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${activeGroup.id}` }, async (payload) => {
        const row = payload.new as Message;
        const { data: sender } = await supabase.from("profiles").select("id,display_name,username").eq("id", row.sender_id).maybeSingle();
        setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, profiles: sender }]);
        if (row.sender_id !== user.id) {
          await supabase.from("chat_message_reads").upsert({ message_id: row.id, user_id: user.id }, { onConflict: "message_id,user_id" });
        }
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `group_id=eq.${activeGroup.id}` }, (payload) => {
        const row = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === row.id ? { ...m, ...row } : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `group_id=eq.${activeGroup.id}` }, (payload) => {
        const row = payload.old as Message;
        setMessages((prev) => prev.filter((m) => m.id !== row.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" }, (payload) => {
        const row = (payload.new || payload.old) as Reaction;
        if (!row?.message_id) return;
        if (payload.eventType === "INSERT") setReactions((prev) => prev.some((r) => r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji) ? prev : [...prev, row]);
        if (payload.eventType === "DELETE") setReactions((prev) => prev.filter((r) => !(r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reads" }, (payload) => {
        const row = (payload.new || payload.old) as ReadState;
        if (!row?.message_id) return;
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") setReads((prev) => [...prev.filter((r) => !(r.message_id === row.message_id && r.user_id === row.user_id)), row]);
      })
      .on("presence", { event: "sync" }, () => setPresence(Object.values(channel.presenceState()).flatMap((entries) => entries as unknown as Presence[])))
      .on("presence", { event: "join" }, () => setPresence(Object.values(channel.presenceState()).flatMap((entries) => entries as unknown as Presence[])))
      .on("presence", { event: "leave" }, () => setPresence(Object.values(channel.presenceState()).flatMap((entries) => entries as unknown as Presence[])));
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ user_id: user.id, name: user.displayName, typing: false });
    });
    channelRef.current = channel;
    return () => { void supabase.removeChannel(channel); channelRef.current = null; };
  }, [activeGroup, refreshGroup, supabase, user.displayName, user.id]);

  const sendMessage = useCallback(async (value = input, stickerKey?: string) => {
    if (!activeGroup || !user.id) return;
    const body = value.trim();
    if (!body && !stickerKey) return;
    const validation = validateChatClient(body);
    if (validation) { setError(validation); return; }
    setError("");
    if (!stickerKey && EMOJI_ONLY.test(body)) {
      const target = [...messages].reverse().find((m) => m.sender_id !== user.id && !m.deleted_at);
      if (target) await toggleReaction(target.id, body.trim());
      setInput("");
      setShowStickers(false);
      return;
    }
    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: Message = { id: tempId, group_id: activeGroup.id, sender_id: user.id, body, sticker_key: stickerKey || null, reply_to_id: replyTo?.id || null, created_at: new Date().toISOString(), profiles: { id: user.id, display_name: user.displayName }, pending: true };
    setMessages((prev) => [...prev, optimistic]);
    setSendingIds((prev) => [...prev, tempId]);
    setInput(""); setReplyTo(null); setShowStickers(false);
    if (channelRef.current) await channelRef.current.track({ user_id: user.id, name: user.displayName, typing: false });
    const { data, error: insertError } = await supabase.from("chat_messages").insert({ group_id: activeGroup.id, sender_id: user.id, body, sticker_key: stickerKey || null, reply_to_id: replyTo?.id || null }).select("id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles(id,display_name,username)").single();
    if (insertError) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(insertError.message);
      setSendingIds((prev) => prev.filter((id) => id !== tempId));
      return;
    }
    setMessages((prev) => prev.map((m) => m.id === tempId ? { ...data, profiles: normalizeProfile(data.profiles) } : m));
    setSendingIds((prev) => prev.filter((id) => id !== tempId));
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
  }, [activeGroup, input, messages, replyTo, supabase, user.displayName, user.id]);

  const toggleTyping = async (value: string) => {
    setInput(value);
    if (!channelRef.current) return;
    await channelRef.current.track({ user_id: user.id, name: user.displayName, typing: Boolean(value.trim()) });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (value.trim()) {
      typingTimer.current = setTimeout(() => { void channelRef.current?.track({ user_id: user.id, name: user.displayName, typing: false }); }, 1200);
    }
  };

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user.id) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) await supabase.from("chat_message_reactions").delete().match({ message_id: messageId, user_id: user.id, emoji });
    else await supabase.from("chat_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    setMenu(null);
  }, [reactions, supabase, user.id]);

  const deleteMessage = async (message: Message) => {
    if (!activeGroup || (message.sender_id !== user.id && activeGroup.created_by !== user.id)) return;
    const { error: deleteError } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", message.id);
    if (deleteError) setError(deleteError.message);
    setMenu(null);
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    const { data, error: rpcError } = await supabase.rpc("create_chat_group", { p_name: groupName.trim(), p_friend_ids: selectedFriends });
    if (rpcError) { setError(rpcError.message); return; }
    setShowCreate(false); setGroupName(""); setSelectedFriends([]); setShowInvitePane(false);
    await loadUserAndGroups();
    const created = groups.find((g) => g.id === data) || (await supabase.from("chat_groups").select("id,name,created_by,created_at").eq("id", data).maybeSingle()).data;
    if (created) setActiveGroup(created as Group);
  };

  const acceptInvite = async (invite: Invite) => {
    const { error: inviteError } = await supabase.from("chat_group_invites").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", invite.id).eq("invited_user_id", user.id);
    if (inviteError) { setError(inviteError.message); return; }
    const { error: memberError } = await supabase.from("chat_group_members").insert({ group_id: invite.group_id, user_id: user.id });
    if (memberError) { setError(memberError.message); return; }
    await loadUserAndGroups();
    const group = normalizeGroup(invite.chat_groups);
    if (group) setActiveGroup(group);
  };
  const declineInvite = async (invite: Invite) => {
    const { error: inviteError } = await supabase.from("chat_group_invites").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", invite.id).eq("invited_user_id", user.id);
    if (inviteError) setError(inviteError.message);
    else setInvites((prev) => prev.filter((x) => x.id !== invite.id));
  };

  const leaveGroup = async () => {
    if (!activeGroup) return;
    const ok = window.confirm(`Leave ${activeGroup.name}?`);
    if (!ok) return;
    const { error: leaveError } = await supabase.from("chat_group_members").delete().eq("group_id", activeGroup.id).eq("user_id", user.id);
    if (leaveError) { setError(leaveError.message); return; }
    const next = groups.find((g) => g.id !== activeGroup.id) || null;
    setActiveGroup(next); setGroups((prev) => prev.filter((g) => g.id !== activeGroup.id));
  };

  const groupedReactions = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, new Map());
      const counts = map.get(r.message_id)!;
      counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
    }
    return map;
  }, [reactions]);
  const readSet = useMemo(() => new Set(reads.filter((r) => r.user_id !== user.id).map((r) => r.message_id)), [reads, user.id]);
  const onlineMembers = useMemo(() => presence.filter((p) => p.user_id), [presence]);
  const typingMembers = useMemo(() => onlineMembers.filter((p) => p.typing && p.user_id !== user.id), [onlineMembers, user.id]);
  useEffect(() => {
    if (typingMembers.length >= 3) setTypingNotice(`${typingMembers.length} people are typing…`);
    else if (typingMembers.length === 2) setTypingNotice(`${typingMembers[0]?.name || "Someone"} and ${typingMembers[1]?.name || "someone"} are typing…`);
    else if (typingMembers.length === 1) setTypingNotice(`${typingMembers[0]?.name || "Someone"} is typing…`);
    else setTypingNotice("");
  }, [typingMembers]);

  const messageStatus = (message: Message) => {
    if (message.pending || sendingIds.includes(message.id)) return "sending";
    if (readSet.has(message.id)) return "read";
    return onlineMembers.length > 1 ? "delivered" : "sent";
  };

  const handlePointerDown = (event: React.PointerEvent, message: Message) => {
    swipeRef.current = { id: message.id, x: event.clientX, y: event.clientY };
    longPressTimer.current = setTimeout(() => setMenu({ message, x: Math.min(event.clientX, window.innerWidth - 260), y: Math.min(event.clientY, window.innerHeight - 300) }), 560);
  };
  const handlePointerMove = (event: React.PointerEvent, message: Message) => {
    if (!swipeRef.current || swipeRef.current.id !== message.id) return;
    const dx = event.clientX - swipeRef.current.x;
    const dy = Math.abs(event.clientY - swipeRef.current.y);
    if (longPressTimer.current && (Math.abs(dx) > 20 || dy > 20)) clearTimeout(longPressTimer.current);
    if (dx > 70 && dy < 45) { setReplyTo(message); inputRef.current?.focus(); swipeRef.current = null; }
  };
  const clearPointerTimers = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); swipeRef.current = null; };

  if (loading) return <section className="surface-card p-6 text-sm text-[#8e8b9f]">Loading chat…</section>;
  if (!user.id) return <section className="surface-card p-6 text-sm text-[#aaa8ba]">Sign in to use MatchUp group chat.</section>;

  return (
    <section className="relative min-h-[70vh] overflow-hidden rounded-[28px] border border-[#2a2941] bg-[#fafafa] text-[#1b1b22] shadow-[0_24px_70px_rgba(0,0,0,.28)]">
      <div className="flex min-h-[70vh] flex-col">
        <header className="border-b border-[#e6e6eb] bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowGroups((v) => !v)} className="grid size-10 place-items-center rounded-full border border-[#dedee6] bg-white" aria-label="My Groups"><Menu size={19}/></button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">{activeGroup?.name || "My Groups"}</h1>
              <p className="text-xs text-[#777784]">{activeGroup ? `${activeGroup.id ? onlineMembers.length : 0} Online` : "Choose a group to chat"}</p>
            </div>
            <button type="button" onClick={() => setShowCreate(true)} className="grid size-10 place-items-center rounded-full bg-[#6d27ff] text-white shadow-[0_8px_20px_rgba(109,39,255,.25)]" aria-label="Create Group"><Plus size={20}/></button>
            <div className="relative">
              <button type="button" onClick={() => setShowInvitePane((v) => !v)} className="grid size-10 place-items-center rounded-full border border-[#dedee6] bg-white" aria-label="Group invitations"><Users size={19}/>{invites.length ? <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#62c51f] px-1 text-[10px] font-black text-white">{invites.length}</span> : null}</button>
            </div>
            {activeGroup ? <button type="button" onClick={leaveGroup} className="grid size-10 place-items-center rounded-full border border-[#dedee6] bg-white" aria-label="Group menu"><MoreHorizontal size={19}/></button> : null}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#f4f4f8] px-3 py-2 text-xs font-semibold text-[#4e4e5b]"><span className="size-2 rounded-full bg-[#27c93f]" />Online <span className="font-black">{activeGroup ? onlineMembers.length : 0}</span></div>
        </header>

        {showGroups ? <div className="border-b border-[#e6e6eb] bg-white px-4 py-3 sm:px-6"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.14em] text-[#8b8a95]">My Groups</p><button type="button" onClick={() => setShowGroups(false)}><X size={16}/></button></div>{groups.length ? groups.map((g) => <button key={g.id} type="button" onClick={() => { setActiveGroup(g); setShowGroups(false); }} className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${activeGroup?.id === g.id ? "bg-[#efe9ff] font-bold text-[#5f22da]" : "hover:bg-[#f5f5f8]"}`}>{g.name}</button>) : <p className="py-2 text-sm text-[#8c8b97]">No groups yet. Create one with friends.</p>}</div> : null}

        {showInvitePane && invites.length ? <div className="border-b border-[#e6e6eb] bg-[#fcfcfd] px-4 py-3 sm:px-6"><p className="mb-3 text-xs font-black uppercase tracking-[.14em] text-[#8b8a95]">Group Invites</p>{invites.map((invite) => <div key={invite.id} className="mb-2 rounded-2xl border border-[#e3e3e8] bg-white p-3"><p className="font-bold">{normalizeGroup(invite.chat_groups)?.name || "New group"}</p><p className="mt-1 text-xs text-[#777784]">You were invited to join this group.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => void acceptInvite(invite)} className="rounded-xl bg-[#6d27ff] px-4 py-2 text-xs font-bold text-white">Accept</button><button type="button" onClick={() => void declineInvite(invite)} className="rounded-xl border border-[#dddde5] px-4 py-2 text-xs font-bold">Decline</button></div></div>)}</div> : null}

        <div className="flex-1 overflow-y-auto bg-[#f7f7fa] px-3 py-4 sm:px-6">
          {!activeGroup ? <div className="grid min-h-[48vh] place-items-center"><div className="max-w-sm text-center"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#eee9fb] text-[#6d27ff]"><Users size={29}/></div><h2 className="mt-4 text-xl font-bold">Start a group conversation</h2><p className="mt-2 text-sm leading-6 text-[#777784]">Create a room with people already on your friends list. Everyone must accept an invite before they can read messages.</p><button type="button" onClick={() => setShowCreate(true)} className="mt-5 rounded-2xl bg-[#6d27ff] px-5 py-3 text-sm font-bold text-white">Create Group</button></div></div> : messages.length === 0 ? <div className="grid min-h-[48vh] place-items-center text-center text-sm text-[#858490]">No messages yet. Say hello.</div> : <div className="mx-auto max-w-3xl space-y-3">{messages.map((message) => {
              const own = message.sender_id === user.id;
              const counts = groupedReactions.get(message.id);
              const status = messageStatus(message);
              const parent = message.reply_to_id ? messages.find((m) => m.id === message.reply_to_id) : null;
              return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[82%] sm:max-w-[70%]" onPointerDown={(e) => handlePointerDown(e, message)} onPointerMove={(e) => handlePointerMove(e, message)} onPointerUp={clearPointerTimers} onPointerCancel={clearPointerTimers}>
                  {!own ? <p className="mb-1 ml-2 text-[11px] font-semibold text-[#777784]">{displayName(message.profiles)}</p> : null}
                  {parent ? <div className={`mb-1 rounded-xl border-l-4 border-[#9a73ff] px-3 py-2 text-[11px] ${own ? "bg-[#e9defd]" : "bg-white"}`}><span className="font-bold">Replying to {displayName(parent.profiles, parent.sender_id === user.id ? "You" : "Member")}</span><div className="truncate text-[#777784]">{parent.sticker_key || parent.body}</div></div> : null}
                  <div className={`rounded-[22px] px-4 py-3 shadow-sm ${own ? "rounded-br-[7px] bg-[#6d27ff] text-white" : "rounded-bl-[7px] border border-[#e7e7ec] bg-white text-[#202027]"} ${message.deleted_at ? "opacity-60" : ""}`}>
                    {message.deleted_at ? <span className="text-sm italic">Message deleted</span> : message.sticker_key ? <span className="text-5xl" aria-label="sticker">{message.sticker_key}</span> : <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{message.body}</p>}
                    <div className={`mt-1.5 flex items-center justify-end gap-2 text-[10px] ${own ? "text-white/70" : "text-[#9999a4]"}`}><span>{formatTime(message.created_at)}</span>{own ? <span aria-label={status}>{status === "sending" ? <span className="inline-flex items-center gap-1"><span className="size-2 animate-pulse rounded-full bg-current" />Sending</span> : status === "read" ? <CheckCheck size={14} className="text-[#6bdc5d]" /> : status === "delivered" ? <CheckCheck size={14}/> : <Check size={14}/>}</span> : null}</div>
                  </div>
                  {counts?.size ? <div className="mt-1 flex flex-wrap gap-1 pl-2">{Array.from(counts.entries()).map(([emoji, count]) => <button key={emoji} type="button" onClick={() => void toggleReaction(message.id, emoji)} className={`rounded-full border px-2 py-1 text-xs ${reactions.some((r) => r.message_id === message.id && r.user_id === user.id && r.emoji === emoji) ? "border-[#8d5bff] bg-[#efe8ff]" : "border-[#dddde5] bg-white"}`}>{emoji} {count}</button>)}</div> : null}
                </div>
              </div>;
            })}<div ref={bottomRef} /></div>}
          {typingNotice ? <div className="mx-auto mt-2 max-w-3xl text-xs font-semibold text-[#8b8a96]"><span className="mr-2 inline-flex gap-1 align-middle"><span className="size-1.5 animate-bounce rounded-full bg-[#888793] [animation-delay:-.2s]"/><span className="size-1.5 animate-bounce rounded-full bg-[#888793] [animation-delay:-.1s]"/><span className="size-1.5 animate-bounce rounded-full bg-[#888793]"/></span>{typingNotice}</div> : null}
        </div>

        {error ? <div className="border-t border-[#f1c7cd] bg-[#fff3f4] px-4 py-3 text-sm text-[#a5283d]">{error}</div> : null}
        <div className="border-t border-[#e4e4ea] bg-white p-3 sm:p-4">
          {replyTo ? <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[#f1edfa] px-3 py-2 text-xs"><Reply size={14} className="text-[#6d27ff]"/><span className="min-w-0 flex-1 truncate">Replying to <strong>{displayName(replyTo.profiles)}</strong>: {replyTo.sticker_key || replyTo.body}</span><button type="button" onClick={() => setReplyTo(null)}><X size={15}/></button></div> : null}
          {showStickers ? <div className="mb-2 grid grid-cols-6 gap-2 rounded-2xl border border-[#e2e2e8] bg-[#fbfbfc] p-3">{STICKERS.map((sticker) => <button type="button" key={sticker} onClick={() => void sendMessage("", sticker)} className="rounded-xl p-2 text-2xl hover:bg-[#f0eef5]">{sticker}</button>)}</div> : null}
          <div className="flex items-end gap-2 rounded-[24px] border border-[#dcdce4] bg-[#fbfbfd] p-2">
            <button type="button" onClick={() => setShowStickers((v) => !v)} className="grid size-10 shrink-0 place-items-center rounded-full text-[#777784] hover:bg-[#eeeeF3]" aria-label="Stickers"><Smile size={20}/></button>
            <input ref={inputRef} value={input} onChange={(e) => void toggleTyping(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Type your message…" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" aria-label="Message" />
            <button type="button" onClick={() => void sendMessage()} className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1d1d27] text-white" aria-label="Send message"><Send size={18}/></button>
          </div>
          <div className="mt-2 flex items-center gap-2 px-2 text-[10px] text-[#90909a]"><Paperclip size={12}/>Text and stickers only. Feed links are the only links permitted.</div>
        </div>
      </div>

      {menu ? <div className="fixed inset-0 z-[70]" onMouseDown={() => setMenu(null)}><div className="absolute w-[250px] rounded-2xl border border-[#dad9e0] bg-white p-2 shadow-[0_20px_55px_rgba(0,0,0,.22)]" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
        <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-[#92919b]">Message</p>
        <div className="grid grid-cols-8 gap-1 px-2 pb-2">{QUICK_REACTIONS.map((emoji) => <button type="button" key={emoji} onClick={() => void toggleReaction(menu.message.id, emoji)} className="rounded-lg p-1.5 text-lg hover:bg-[#f3f2f7]">{emoji}</button>)}</div>
        <button type="button" onClick={() => { setReplyTo(menu.message); setMenu(null); inputRef.current?.focus(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-[#f4f4f7]"><Reply size={16}/>Reply</button>
        <button type="button" onClick={async () => { await navigator.clipboard?.writeText(menu.message.body); setMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-[#f4f4f7]"><Copy size={16}/>Copy</button>
        <button type="button" onClick={() => { setError("Forwarding is intentionally limited to copying text in this chat version."); setMenu(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-[#f4f4f7]"><Forward size={16}/>Forward</button>
        {(menu.message.sender_id === user.id || activeGroup?.created_by === user.id) ? <button type="button" onClick={() => void deleteMessage(menu.message)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#b12e43] hover:bg-[#fff1f3]"><Trash2 size={16}/>Delete</button> : <div className="px-3 py-2 text-xs text-[#8c8b96]">Only the message author or group creator can delete.</div>}
      </div></div> : null}

      {showCreate ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4"><div className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#6d27ff]">New group</p><h2 className="mt-1 text-2xl font-black">Create Group</h2></div><button type="button" onClick={() => setShowCreate(false)}><X size={20}/></button></div><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="mt-5 w-full rounded-2xl border border-[#ddddE5] bg-[#fafafd] px-4 py-3 text-sm outline-none focus:border-[#8d63ef]" />
          <div className="mt-4"><p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-[#8b8a96]">Invite friends</p>{friends.length ? <div className="max-h-60 space-y-2 overflow-y-auto">{friends.map((friend) => <label key={friend.id} className="flex items-center gap-3 rounded-2xl border border-[#e5e5ea] p-3"><input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={(e) => setSelectedFriends((prev) => e.target.checked ? [...prev, friend.id] : prev.filter((id) => id !== friend.id))} /><span className="min-w-0"><span className="block truncate font-semibold">{displayName(friend)}</span><span className="text-xs text-[#8b8a96]">@{friend.username || "friend"}</span></span></label>)}</div> : <div className="rounded-2xl bg-[#f5f5f8] p-4 text-sm text-[#777784]">You don't have any accepted friends yet. Groups can only invite existing friends.</div>}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-2xl border border-[#dddde5] px-4 py-2.5 text-sm font-bold">Cancel</button><button type="button" disabled={!groupName.trim()} onClick={() => void createGroup()} className="rounded-2xl bg-[#6d27ff] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create Group</button></div></div></div> : null}
    </section>
  );
}
