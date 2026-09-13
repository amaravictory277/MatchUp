"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Lock,
  Menu,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  MoreVertical,
  Trophy,
  Trash2,
  Unlock,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { SidebarSectionCard } from "./sidebar-section-card";
import { MatchUpAvatar } from "../ui/matchup-avatar";

type Profile = {
  id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_path?: string | null;
};
type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  kind: "general" | "private" | "group" | "match";
  locked: boolean;
  member_limit?: number;
  image_path?: string | null;
};
type Invite = {
  id: string;
  group_id: string;
  invited_by: string;
  invited_user_id: string;
  status: string;
  created_at: string;
  chat_groups?: Group | Group[] | null;
};
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
  pending?: boolean;
};
type Reaction = { message_id: string; user_id: string; emoji: string };
type ReadState = { message_id: string; user_id: string; read_at: string };
type Presence = { user_id: string; name?: string; typing?: boolean };
type PrivateChat = { group: Group; friend: Profile };
const STICKERS = [
  "⚽",
  "🏆",
  "🔥",
  "🎮",
  "😎",
  "😂",
  "🫡",
  "👑",
  "❤️",
  "✅",
  "💯",
  "🙌",
];
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|\s)+$/u;
function profile(v: Profile | Profile[] | null | undefined) {
  return Array.isArray(v) ? v[0] || null : v || null;
}
function profileAccent(v: Profile | Profile[] | null | undefined) {
  const p = profile(v);
  const palettes = ["#43a8ff", "#35c58a", "#ffb454", "#c87cff", "#48d1e5"];
  const key = p?.id || p?.avatar_path || "matchup-default";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return palettes[Math.abs(h) % palettes.length];
}
function groupOf(v: Group | Group[] | null | undefined) {
  return Array.isArray(v) ? v[0] || null : v || null;
}
function nameOf(
  v: Profile | Profile[] | null | undefined,
  fallback = "Member",
) {
  const p = profile(v);
  return p?.display_name || p?.username || fallback;
}
function timeOf(v: string) {
  const d = new Date(v);
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}
function exactTime(v: string) {
  return new Date(v).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
function chatBodyError(body: string) {
  for (const raw of body.match(URL_RE) || []) {
    const url = raw.startsWith("www.") ? `https://${raw}` : raw;
    try {
      const u = new URL(url, window.location.origin);
      if (!u.pathname.startsWith("/feeds"))
        return "Only links copied from MatchUp Feeds can be shared in chat.";
      if (
        u.origin !== window.location.origin &&
        u.hostname !== "match-up-ten.vercel.app"
      )
        return "Only MatchUp Feed links are allowed in chat.";
    } catch {
      return "That link could not be validated.";
    }
  }
  if (
    /(data:image|javascript:|blob:|\.(png|jpe?g|gif|webp|mp4|mov|webm|m4a|mp3)(\?|$|\s))/i.test(
      body,
    )
  )
    return "Images, videos, audio and file links are not allowed in chat.";
  return null;
}

export function ChatHub() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<{ id: string; displayName: string }>({
    id: "",
    displayName: "You",
  });
  const [general, setGeneral] = useState<Group | null>(null);
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reads, setReads] = useState<ReadState[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingNotice, setTypingNotice] = useState("");
  const [showRooms, setShowRooms] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const [groupLimit, setGroupLimit] = useState(20);
  const [showLimitPicker, setShowLimitPicker] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<Profile[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlighted, setHighlighted] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const loadWorkspace = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setUser({ id: "", displayName: "Guest" });
      const { data: g } = await supabase
        .from("chat_groups")
        .select(
          "id,name,created_by,created_at,kind,locked,member_limit,image_path",
        )
        .eq("kind", "general")
        .maybeSingle();
      setGeneral(g as Group | null);
      setGroups([]);
      setPrivateChats([]);
      setFriends([]);
      setInvites([]);
      setInviteCandidates([]);
      setLoading(false);
      setError(
        g
          ? "Sign in to send messages or interact in chat."
          : "General chat is not available yet.",
      );
      if (g) setActive(g as Group);
      return;
    }
    const me = (
      await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_path")
        .eq("id", auth.user.id)
        .maybeSingle()
    ).data as Profile | null;
    setUser({ id: auth.user.id, displayName: nameOf(me, "You") });
    const { data: generalId, error: generalError } = await supabase.rpc(
      "get_or_create_general_chat",
    );
    if (generalError) {
      setError(generalError.message);
      setLoading(false);
      return;
    }
    const [
      { data: generalRow },
      { data: membershipRows },
      { data: friendRows },
      { data: inviteRows },
      { data: muteRows },
    ] = await Promise.all([
      supabase
        .from("chat_groups")
        .select(
          "id,name,created_by,created_at,kind,locked,member_limit,image_path",
        )
        .eq("id", generalId)
        .maybeSingle(),
      supabase
        .from("chat_group_members")
        .select(
          "group_id,chat_groups(id,name,created_by,created_at,kind,locked,member_limit,image_path)",
        )
        .eq("user_id", auth.user.id),
      supabase
        .from("friendships")
        .select("user_id,friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${auth.user.id},friend_id.eq.${auth.user.id}`),
      supabase
        .from("chat_group_invites")
        .select(
          "id,group_id,invited_by,invited_user_id,status,created_at,chat_groups(id,name,created_by,created_at,kind,locked,member_limit,image_path)",
        )
        .eq("invited_user_id", auth.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("muted_conversations")
        .select("conversation_id")
        .eq("user_id", auth.user.id),
    ]);
    const g = generalRow as Group | null;
    setGeneral(g);
    const rawGroups = (membershipRows || [])
      .map((r: any) => groupOf(r.chat_groups))
      .filter(Boolean) as Group[];
    const unique = rawGroups.filter(
      (x, i, a) => a.findIndex((y) => y.id === x.id) === i,
    );
    const privateGroups = unique.filter((x) => x.kind === "private");
    setGroups(unique.filter((x) => x.kind === "group"));
    setInvites((inviteRows || []) as Invite[]);
    setMuted(
      Boolean(
        (muteRows || []).some((r: any) => r.conversation_id === generalId),
      ),
    );
    const ids = unique.map((x) => x.id);
    let allMembers: any[] = [];
    if (ids.length)
      allMembers =
        (
          await supabase
            .from("chat_group_members")
            .select("group_id,user_id,profiles(id,display_name,username)")
            .in("group_id", ids)
            .limit(5000)
        ).data || [];
    setPrivateChats(
      privateGroups
        .map((pg) => {
          const other = allMembers.find(
            (r) => r.group_id === pg.id && r.user_id !== auth.user.id,
          );
          return other?.profiles
            ? { group: pg, friend: profile(other.profiles)! }
            : null;
        })
        .filter(Boolean) as PrivateChat[],
    );
    const friendIds = (friendRows || []).map((r: any) =>
      r.user_id === auth.user.id ? r.friend_id : r.user_id,
    );
    const fp = friendIds.length
      ? (
          await supabase
            .from("profiles")
            .select("id,display_name,username,avatar_path")
            .in("id", friendIds)
        ).data || []
      : [];
    setFriends(fp as Profile[]);
    setInviteCandidates(fp as Profile[]);
    setLoading(false);
    if (!active && g) setActive(g);
  }, [active, supabase]);
  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);
  const loadGroup = useCallback(
    async (group: Group, olderThan?: string) => {
      const q = supabase
        .from("chat_messages")
        .select(
          "id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles!chat_messages_sender_id_fkey(id,display_name,username)",
        )
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (olderThan) q.lt("created_at", olderThan);
      const { data, error: e } = await q;
      if (e) {
        setError(e.message);
        return;
      }
      const rows = ((data || []) as Message[])
        .map((m) => ({ ...m, profiles: profile(m.profiles) }))
        .reverse();
      const ids = rows.map((m) => m.id);
      const [rr, rd, mm, mute] = await Promise.all([
        ids.length
          ? supabase
              .from("chat_message_reactions")
              .select("message_id,user_id,emoji")
              .in("message_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase
              .from("chat_message_reads")
              .select("message_id,user_id,read_at")
              .in("message_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("chat_group_members")
          .select("user_id,profiles(id,display_name,username)")
          .eq("group_id", group.id)
          .limit(200),
        supabase
          .from("muted_conversations")
          .select("conversation_id")
          .eq("user_id", user.id)
          .eq("conversation_id", group.id)
          .maybeSingle(),
      ]);
      if (olderThan)
        setMessages((prev) => [
          ...rows,
          ...prev.filter((m) => !rows.some((x) => x.id === m.id)),
        ]);
      else setMessages(rows);
      setReactions((rr.data || []) as Reaction[]);
      setReads((rd.data || []) as ReadState[]);
      setMembers(
        (mm.data || [])
          .map((r: any) => profile(r.profiles))
          .filter(Boolean) as Profile[],
      );
      setMuted(Boolean(mute.data));
      if (!olderThan) {
        const unread = rows.filter(
          (m) => m.sender_id !== user.id && !m.deleted_at,
        );
        if (user.id && unread.length)
          await supabase.from("chat_message_reads").upsert(
            unread.map((m) => ({ message_id: m.id, user_id: user.id })),
            { onConflict: "message_id,user_id" },
          );
        window.setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          30,
        );
      }
    },
    [supabase, user.id],
  );
  useEffect(() => {
    const body = chatBodyRef.current;
    if (!body) return;
    let last = body.scrollTop;
    const onScroll = () => {
      const current = body.scrollTop;
      if (current <= 4) {
        setHeaderVisible(true);
      } else if (current > last + 1) {
        setHeaderVisible(false);
      } else if (current < last - 1) {
        setHeaderVisible(true);
      }
      last = current;
    };
    body.addEventListener("scroll", onScroll, { passive: true });
    return () => body.removeEventListener("scroll", onScroll);
  }, [active]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    void loadGroup(active);
    setHighlighted("");
    if (channelRef.current) void supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`matchup-chat-${active.id}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${active.id}`,
        },
        async (payload) => {
          const row = payload.new as Message;
          const sender = (
            await supabase
              .from("profiles")
              .select("id,display_name,username,avatar_path")
              .eq("id", row.sender_id)
              .maybeSingle()
          ).data;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { ...row, profiles: sender }],
          );
          if (user.id && row.sender_id !== user.id)
            await supabase
              .from("chat_message_reads")
              .upsert(
                { message_id: row.id, user_id: user.id },
                { onConflict: "message_id,user_id" },
              );
          window.setTimeout(
            () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
            10,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${active.id}`,
        },
        (p) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === (p.new as Message).id
                ? { ...m, ...(p.new as Message) }
                : m,
            ),
          ),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${active.id}`,
        },
        (p) =>
          setMessages((prev) =>
            prev.filter((m) => m.id !== (p.old as Message).id),
          ),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reactions" },
        (p) => {
          const r = (p.new || p.old) as Reaction;
          if (!r?.message_id) return;
          if (p.eventType === "INSERT")
            setReactions((v) =>
              v.some(
                (x) =>
                  x.message_id === r.message_id &&
                  x.user_id === r.user_id &&
                  x.emoji === r.emoji,
              )
                ? v
                : [...v, r],
            );
          if (p.eventType === "DELETE")
            setReactions((v) =>
              v.filter(
                (x) =>
                  !(
                    x.message_id === r.message_id &&
                    x.user_id === r.user_id &&
                    x.emoji === r.emoji
                  ),
              ),
            );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reads" },
        (p) => {
          const r = (p.new || p.old) as ReadState;
          if (!r?.message_id) return;
          if (p.eventType === "INSERT" || p.eventType === "UPDATE")
            setReads((v) => [
              ...v.filter(
                (x) =>
                  !(x.message_id === r.message_id && x.user_id === r.user_id),
              ),
              r,
            ]);
        },
      )
      .on("presence", { event: "sync" }, () =>
        setPresence(
          Object.values(channel.presenceState()).flatMap(
            (v) => v as unknown as Presence[],
          ),
        ),
      )
      .on("presence", { event: "join" }, () =>
        setPresence(
          Object.values(channel.presenceState()).flatMap(
            (v) => v as unknown as Presence[],
          ),
        ),
      )
      .on("presence", { event: "leave" }, () =>
        setPresence(
          Object.values(channel.presenceState()).flatMap(
            (v) => v as unknown as Presence[],
          ),
        ),
      );
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user.id)
        await channel.track({
          user_id: user.id,
          name: user.displayName,
          typing: false,
        });
    });
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [active, loadGroup, supabase, user.displayName, user.id]);
  const toggleTyping = async (v: string) => {
    setInput(v);
    if (!channelRef.current) return;
    await channelRef.current.track({
      user_id: user.id,
      name: user.displayName,
      typing: Boolean(v.trim()),
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (v.trim())
      typingTimer.current = setTimeout(
        () =>
          void channelRef.current?.track({
            user_id: user.id,
            name: user.displayName,
            typing: false,
          }),
        1200,
      );
  };
  const toggleReaction = useCallback(
    async (id: string, emoji: string) => {
      if (!user.id) return;
      const own = reactions.find(
        (r) =>
          r.message_id === id && r.user_id === user.id && r.emoji === emoji,
      );
      if (own)
        await supabase
          .from("chat_message_reactions")
          .delete()
          .match({ message_id: id, user_id: user.id, emoji });
      else
        await supabase
          .from("chat_message_reactions")
          .insert({ message_id: id, user_id: user.id, emoji });
    },
    [reactions, supabase, user.id],
  );
  const sendMessage = useCallback(
    async (value = input, sticker?: string) => {
      if (!active || !user.id) return;
      const body = value.trim();
      if (!body && !sticker) return;
      const validation = chatBodyError(body);
      if (validation) {
        setError(validation);
        return;
      }
      if (!sticker && EMOJI_ONLY.test(body)) {
        const target = [...messages]
          .reverse()
          .find((m) => m.sender_id !== user.id && !m.deleted_at);
        if (target) await toggleReaction(target.id, body.trim());
        setInput("");
        return;
      }
      const temp = `pending-${crypto.randomUUID()}`;
      const optimistic: Message = {
        id: temp,
        group_id: active.id,
        sender_id: user.id,
        body,
        sticker_key: sticker || null,
        reply_to_id: replyTo?.id || null,
        created_at: new Date().toISOString(),
        profiles: { id: user.id, display_name: user.displayName },
        pending: true,
      };
      setMessages((v) => [...v, optimistic]);
      setInput("");
      const reply = replyTo;
      setReplyTo(null);
      setShowStickers(false);
      const { data, error: e } = await supabase
        .from("chat_messages")
        .insert({
          group_id: active.id,
          sender_id: user.id,
          body,
          sticker_key: sticker || null,
          reply_to_id: reply?.id || null,
        })
        .select(
          "id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles!chat_messages_sender_id_fkey(id,display_name,username)",
        )
        .single();
      if (e) {
        setMessages((v) => v.filter((m) => m.id !== temp));
        setError(e.message);
        return;
      }
      setMessages((v) =>
        v.map((m) =>
          m.id === temp
            ? {
                ...(data as Message),
                profiles: profile((data as Message).profiles),
              }
            : m,
        ),
      );
    },
    [
      active,
      input,
      messages,
      replyTo,
      supabase,
      toggleReaction,
      user.displayName,
      user.id,
    ],
  );
  const deleteMessage = async (m: Message) => {
    if (!active || (m.sender_id !== user.id && active.created_by !== user.id))
      return;
    const { error: e } = await supabase
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", m.id);
    if (e) setError(e.message);
  };
  const openPrivate = async (friend: Profile) => {
    const { data, error: e } = await supabase.rpc(
      "get_or_create_private_chat",
      { p_friend: friend.id },
    );
    if (e) {
      setError(e.message);
      return;
    }
    const g = (
      await supabase
        .from("chat_groups")
        .select(
          "id,name,created_by,created_at,kind,locked,member_limit,image_path",
        )
        .eq("id", data)
        .maybeSingle()
    ).data as Group | null;
    if (g) {
      setPrivateChats((v) =>
        v.some((x) => x.group.id === g.id) ? v : [...v, { group: g, friend }],
      );
      setActive(g);
      setShowRooms(false);
    }
  };
  const createGroup = async () => {
    if (groupName.trim().length < 2) {
      setError("Group name must be at least 2 characters.");
      return;
    }
    const { data, error: e } = await supabase.rpc("create_chat_group", {
      p_name: groupName.trim(),
      p_friend_ids: selectedInvitees,
      p_member_limit: groupLimit,
    });
    if (e) {
      setError(e.message);
      return;
    }
    const g = (
      await supabase
        .from("chat_groups")
        .select(
          "id,name,created_by,created_at,kind,locked,member_limit,image_path",
        )
        .eq("id", data)
        .maybeSingle()
    ).data as Group | null;
    if (g) {
      if (groupImage) {
        const ext = (groupImage.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${g.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("chat-media")
          .upload(path, groupImage, {
            upsert: false,
            contentType: groupImage.type,
          });
        if (up.error)
          setError(
            `Group created, but the photo could not be uploaded: ${up.error.message}`,
          );
        else {
          await supabase
            .from("chat_groups")
            .update({ image_path: path })
            .eq("id", g.id);
          g.image_path = path;
        }
      }
      setGroups((v) => [g, ...v]);
      setActive(g);
    }
    setShowCreate(false);
    setGroupName("");
    setGroupImage(null);
    setInviteSearch("");
    setSelectedInvitees([]);
  };
  const searchPeople = async (q: string) => {
    setInviteSearch(q);
    if (!q.trim()) {
      setInviteCandidates(friends);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_path")
      .neq("id", user.id)
      .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
      .limit(20);
    setInviteCandidates((data || []) as Profile[]);
  };
  const inviteMember = async (id: string) => {
    if (!active) return;
    const { error: e } = await supabase.rpc("invite_chat_group_member", {
      p_group_id: active.id,
      p_user_id: id,
    });
    if (e) setError(e.message);
    else setError("Invitation sent.");
  };
  const acceptInvite = async (i: Invite) => {
    const { data, error: e } = await supabase.rpc("respond_chat_group_invite", {
      p_invite_id: i.id,
      p_accept: true,
    });
    if (e) {
      setError(e.message);
      return;
    }
    setInvites((v) => v.filter((x) => x.id !== i.id));
    await loadWorkspace();
    const g = (
      await supabase
        .from("chat_groups")
        .select(
          "id,name,created_by,created_at,kind,locked,member_limit,image_path",
        )
        .eq("id", data)
        .maybeSingle()
    ).data as Group | null;
    if (g) setActive(g);
  };
  const declineInvite = async (i: Invite) => {
    const { error: e } = await supabase.rpc("respond_chat_group_invite", {
      p_invite_id: i.id,
      p_accept: false,
    });
    if (e) setError(e.message);
    else setInvites((v) => v.filter((x) => x.id !== i.id));
  };
  const renameGroup = async () => {
    if (!active || active.kind !== "group") return;
    const n = groupName.trim();
    if (n.length < 2) return;
    const { error: e } = await supabase
      .from("chat_groups")
      .update({ name: n })
      .eq("id", active.id)
      .eq("created_by", user.id);
    if (e) setError(e.message);
    else {
      setActive({ ...active, name: n });
      setGroups((v) =>
        v.map((g) => (g.id === active.id ? { ...g, name: n } : g)),
      );
    }
  };
  const setMemberLimit = async (limit: number) => {
    if (!active || active.kind !== "group" || active.created_by !== user.id)
      return;
    const { error: e } = await supabase.rpc("set_chat_group_member_limit", {
      p_group_id: active.id,
      p_member_limit: limit,
    });
    if (e) {
      setError(e.message);
      return;
    }
    setActive({ ...active, member_limit: limit });
    setGroups((v) =>
      v.map((g) => (g.id === active.id ? { ...g, member_limit: limit } : g)),
    );
    setGroupLimit(limit);
    setShowLimitPicker(false);
  };
  const toggleLock = async () => {
    if (!active || active.created_by !== user.id || active.kind !== "group")
      return;
    const next = !active.locked;
    const { error: e } = await supabase
      .from("chat_groups")
      .update({ locked: next })
      .eq("id", active.id)
      .eq("created_by", user.id);
    if (e) setError(e.message);
    else setActive({ ...active, locked: next });
  };
  const deleteGroup = async () => {
    if (!active || active.created_by !== user.id || active.kind !== "group")
      return;
    if (
      !window.confirm(
        `Delete ${active.name}? This permanently removes its messages and memberships.`,
      )
    )
      return;
    if (active.image_path)
      await supabase.storage.from("chat-media").remove([active.image_path]);
    const { error: e } = await supabase
      .from("chat_groups")
      .delete()
      .eq("id", active.id)
      .eq("created_by", user.id);
    if (e) {
      setError(e.message);
      return;
    }
    setGroups((v) => v.filter((g) => g.id !== active.id));
    setActive(general);
    setShowManage(false);
  };
  const removeMember = async (id: string) => {
    if (!active || active.created_by !== user.id) return;
    const { error: e } = await supabase
      .from("chat_group_members")
      .delete()
      .eq("group_id", active.id)
      .eq("user_id", id);
    if (e) setError(e.message);
    else setMembers((v) => v.filter((m) => m.id !== id));
  };
  const changeGroupImage = async (file: File) => {
    if (
      !active ||
      active.created_by !== user.id ||
      !file.type.startsWith("image/")
    ) {
      setError("Only the group owner can change the group photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Group photo must be 5 MB or smaller.");
      return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${active.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage
      .from("chat-media")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (up.error) {
      setError(up.error.message);
      return;
    }
    const { error: e } = await supabase
      .from("chat_groups")
      .update({ image_path: path })
      .eq("id", active.id)
      .eq("created_by", user.id);
    if (e) {
      setError(e.message);
      return;
    }
    if (active.image_path)
      await supabase.storage.from("chat-media").remove([active.image_path]);
    setActive({ ...active, image_path: path });
    setGroups((v) =>
      v.map((g) => (g.id === active.id ? { ...g, image_path: path } : g)),
    );
  };
  const toggleMute = async () => {
    if (!active) return;
    const next = !muted;
    if (next) {
      const { error: e } = await supabase
        .from("muted_conversations")
        .upsert(
          { user_id: user.id, conversation_id: active.id },
          { onConflict: "user_id,conversation_id" },
        );
      if (e) {
        setError(e.message);
        return;
      }
    } else {
      const { error: e } = await supabase
        .from("muted_conversations")
        .delete()
        .eq("user_id", user.id)
        .eq("conversation_id", active.id);
      if (e) {
        setError(e.message);
        return;
      }
    }
    setMuted(next);
  };
  const searchMessages = async () => {
    const q = messageSearch.trim();
    if (!active || !q) {
      setSearchResults([]);
      return;
    }
    const { data, error: e } = await supabase
      .from("chat_messages")
      .select(
        "id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles!chat_messages_sender_id_fkey(id,display_name,username)",
      )
      .eq("group_id", active.id)
      .ilike("body", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (e) setError(e.message);
    else setSearchResults((data || []) as Message[]);
  };
  const jumpTo = async (id: string) => {
    if (!active) return;
    const target = (
      await supabase
        .from("chat_messages")
        .select(
          "id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles!chat_messages_sender_id_fkey(id,display_name,username)",
        )
        .eq("id", id)
        .maybeSingle()
    ).data as Message | null;
    if (!target) return;
    const [before, after] = await Promise.all([
      (
        await supabase
          .from("chat_messages")
          .select(
            "id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles!chat_messages_sender_id_fkey(id,display_name,username)",
          )
          .eq("group_id", active.id)
          .lt("created_at", target.created_at)
          .order("created_at", { ascending: false })
          .limit(25)
      ).data || [],
      (
        await supabase
          .from("chat_messages")
          .select(
            "id,group_id,sender_id,body,sticker_key,reply_to_id,created_at,deleted_at,profiles!chat_messages_sender_id_fkey(id,display_name,username)",
          )
          .eq("group_id", active.id)
          .gt("created_at", target.created_at)
          .order("created_at", { ascending: true })
          .limit(25)
      ).data || [],
    ]);
    setMessages([...before.reverse(), target, ...after] as Message[]);
    setHighlighted(id);
    setSearchOpen(false);
    window.setTimeout(
      () =>
        document
          .querySelector(`[data-message-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      80,
    );
    window.setTimeout(() => setHighlighted(""), 2600);
  };
  const loadOlder = async () => {
    if (!active || !messages.length || loadingOlder) return;
    setLoadingOlder(true);
    await loadGroup(active, messages[0].created_at);
    setLoadingOlder(false);
  };
  const leaveGroup = async () => {
    if (!active || active.kind !== "group") return;
    if (!window.confirm(`Leave ${active.name}?`)) return;
    const { error: e } = await supabase
      .from("chat_group_members")
      .delete()
      .eq("group_id", active.id)
      .eq("user_id", user.id);
    if (e) {
      setError(e.message);
      return;
    }
    setGroups((v) => v.filter((g) => g.id !== active.id));
    setActive(general);
    setShowManage(false);
  };
  const reactionCounts = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of reactions) {
      if (!map.has(r.message_id)) map.set(r.message_id, new Map());
      const m = map.get(r.message_id)!;
      m.set(r.emoji, (m.get(r.emoji) || 0) + 1);
    }
    return map;
  }, [reactions]);
  const readSet = useMemo(
    () =>
      new Set(
        reads.filter((r) => r.user_id !== user.id).map((r) => r.message_id),
      ),
    [reads, user.id],
  );
  const typingMembers = useMemo(
    () =>
      presence.filter((p) => p.user_id && p.user_id !== user.id && p.typing),
    [presence, user.id],
  );
  useEffect(() => {
    if (typingMembers.length === 1)
      setTypingNotice(`${typingMembers[0].name || "Someone"} is typing…`);
    else if (typingMembers.length > 1)
      setTypingNotice(`${typingMembers.length} people are typing…`);
    else setTypingNotice("");
  }, [typingMembers]);
  const activeLabel =
    active?.kind === "private"
      ? active.name || "Private chat"
      : active?.name || "General";
  const activeImage = active?.image_path
    ? supabase.storage.from("chat-media").getPublicUrl(active.image_path).data
        .publicUrl
    : null;
  const owner = Boolean(
    active && active.kind === "group" && active.created_by === user.id,
  );
  if (loading)
    return (
      <section className="surface-card p-6 text-sm text-[#7892ac]">
        Loading MatchUp chat…
      </section>
    );
  if (!user.id)
    return (
      <section className="surface-card p-6 text-sm text-[#a9bdd5]">
        <p>Sign in to use private messages and groups.</p>
        <div className="mt-4 flex gap-3">
          <a
            href="/auth/sign-in"
            className="flex-1 rounded-xl bg-[#1674cf] px-4 py-3 text-center text-sm font-bold text-white"
          >
            Sign In
          </a>
          <a
            href="/auth/sign-up"
            className="flex-1 rounded-xl border border-[#1674cf] px-4 py-3 text-center text-sm font-bold text-[#70c1ff]"
          >
            Sign Up
          </a>
        </div>
      </section>
    );
  return (
    <section className="matchup-chat relative h-[100dvh] min-h-0 overflow-hidden rounded-[28px] border border-[#173d67] bg-[#071426] text-white shadow-[0_24px_70px_rgba(0,35,75,.3)]">
      <div className="flex h-full min-h-0 flex-col">
        <header
          className={`matchup-chat-header border-b border-[#18365f] bg-[#08182b] px-3 py-3 sm:px-5 overflow-hidden transition-[max-height,transform,opacity] duration-200 ${headerVisible ? "max-h-24 translate-y-0 opacity-100" : "max-h-0 -translate-y-full opacity-0 pointer-events-none"}`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRooms((v) => !v)}
              className="icon-button"
              aria-label="Open chats and groups"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {active?.kind === "group" && members.length ? (
                    <div className="flex shrink-0 items-center pl-1">
                      {members.slice(0, 5).map((m, i) => (
                        <div
                          key={m.id}
                          className={`relative size-8 overflow-hidden rounded-full border-2 border-[#08182b] ${i ? "-ml-2" : ""}`}
                        >
                          <MatchUpAvatar
                            profile={m}
                            size="sm"
                            className="size-full rounded-full"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0b3154]">
                      {activeImage ? (
                        <img
                          src={activeImage}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Users size={17} className="text-[#70c1ff]" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-black">
                      {activeLabel}
                    </h1>
                    <p className="text-[11px] text-[#7892ac]">
                      {active?.kind === "general"
                        ? `${presence.length} online`
                        : active?.kind === "group"
                          ? `${members.length} members`
                          : "Private message"}
                    </p>
                  </div>
                </div>
                {active?.kind === "group" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName(active.name);
                      setInviteSearch("");
                      setInviteCandidates(friends);
                      setShowManage(true);
                    }}
                    className="shrink-0 rounded-xl bg-[#1674cf] px-3 py-2 text-[11px] font-black text-white shadow-[0_5px_14px_rgba(0,0,0,.18)]"
                  >
                    Invite
                  </button>
                ) : null}
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowChatOptions((v) => !v)}
                className="icon-button"
                aria-label="Chat options"
              >
                <MoreVertical size={19} />
              </button>
              {showChatOptions ? (
                <div className="absolute right-0 top-11 z-50 min-w-44 rounded-2xl border border-[#214a78] bg-[#08182b] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatOptions(false);
                      void toggleMute();
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-[#0b223c]"
                  >
                    {muted ? "Unmute chat" : "Mute chat"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatOptions(false);
                      setShowInvites((v) => !v);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-[#0b223c]"
                  >
                    <span>Group invitations</span>
                    {invites.length ? (
                      <span className="rounded-full bg-[#126bc0] px-1.5 py-0.5 text-[9px]">
                        {invites.length}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName(active?.name || "");
                      setInviteSearch("");
                      setInviteCandidates(friends);
                      setGroupLimit(active?.member_limit || 20);
                      setShowManage(true);
                      setShowChatOptions(false);
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold hover:bg-[#0b223c]"
                  >
                    Group settings
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {searchOpen ? (
            <div className="mt-3 flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#214a78] bg-[#071426] px-3">
                <Search size={15} className="text-[#47a8ff]" />
                <input
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchMessages();
                  }}
                  placeholder="Search this chat"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMessageSearch("");
                    setSearchResults([]);
                  }}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void searchMessages()}
                className="rounded-2xl bg-[#126bc0] px-4 text-xs font-black"
              >
                Search
              </button>
            </div>
          ) : null}
          {searchOpen && searchResults.length ? (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-[#18365f] bg-[#071426] p-2">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void jumpTo(r.id)}
                  className="block w-full rounded-xl p-2 text-left hover:bg-[#0b223c]"
                >
                  <p className="truncate text-xs font-bold">
                    {r.body || r.sticker_key || "Sticker"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#7892ac]">
                    {nameOf(r.profiles)} · {exactTime(r.created_at)}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </header>
        {showRooms ? (
          <aside className="fixed inset-0 z-[60] flex h-[100dvh] w-full flex-col overflow-y-auto border-[#18365f] bg-[#08182b] p-4 shadow-2xl sm:absolute sm:inset-x-0 sm:top-[73px] sm:z-30 sm:h-auto sm:max-h-[calc(72vh-73px)] sm:w-auto sm:border-b">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#47a8ff]">
                Chats & Groups
              </p>
              <button type="button" onClick={() => setShowRooms(false)}>
                <X size={17} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (general) {
                  setActive(general);
                  setShowRooms(false);
                }
              }}
              className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left ${active?.kind === "general" ? "bg-[#0b3154]" : "hover:bg-[#0a1d32]"}`}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[#126bc0]">
                <Users size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm">General</strong>
                <small className="text-[11px] text-[#7892ac]">
                  Global MatchUp chat
                </small>
              </span>
            </button>
            <SidebarSectionCard
              title="MESSAGE FRIENDS"
              description="Connect with your friends and start a conversation."
              entries={friends
                .slice(0, 2)
                .map((f) => ({
                  id: f.id,
                  label: nameOf(f),
                  secondary: `@${f.username || "friend"}`,
                  profile: f,
                  onClick: () => void openPrivate(f),
                }))}
              primaryLabel="Message Friends"
              secondaryLabel="Add Friends"
              onPrimary={() =>
                window.location.assign("/message-friends?tab=friends")
              }
              onSecondary={() => window.location.assign("/friends")}
              emptyText="No friends available yet."
            />
            <SidebarSectionCard
              title="MY GROUPS"
              description="Keep your groups close and jump back into the conversations that matter."
              entries={groups.slice(0, 2).map((g) => ({
                id: g.id,
                label: g.name,
                secondary: g.locked ? "Locked group" : "Group",
                group: true,
                onClick: () => {
                  setActive(g);
                  setShowRooms(false);
                },
              }))}
              primaryLabel="View Groups"
              secondaryLabel="Create Group"
              onPrimary={() => window.location.assign("/groups")}
              onSecondary={() => {
                setInviteSearch("");
                setInviteCandidates(friends);
                setShowCreate(true);
                setShowRooms(false);
              }}
              emptyText="No groups yet."
            />
          </aside>
        ) : null}
        {showInvites && (
          <div className="border-b border-[#18365f] bg-[#08182b] p-4">
            {invites.length ? (
              invites.map((i) => (
                <div
                  key={i.id}
                  className="mb-2 rounded-2xl border border-[#214a78] bg-[#071426] p-3"
                >
                  <p className="font-bold">
                    {groupOf(i.chat_groups)?.name || "New group"}
                  </p>
                  <p className="mt-1 text-xs text-[#7892ac]">
                    You were invited to join this group.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void acceptInvite(i)}
                      className="rounded-xl bg-[#126bc0] px-4 py-2 text-xs font-black"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void declineInvite(i)}
                      className="rounded-xl border border-[#214a78] px-4 py-2 text-xs font-black"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7892ac]">
                No pending group invitations.
              </p>
            )}
          </div>
        )}
        <div
          ref={chatBodyRef}
          className="matchup-chat-body min-h-0 flex-1 overflow-y-auto bg-[#061221] px-3 py-4 sm:px-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(44,108,164,.07) 0 1px, transparent 1px), radial-gradient(circle at 80% 70%, rgba(44,108,164,.05) 0 1px, transparent 1px)",
            backgroundSize: "42px 42px,58px 58px",
          }}
        >
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={!messages.length || loadingOlder}
              className="mx-auto mb-4 block rounded-full border border-[#18365f] px-4 py-2 text-[10px] font-black text-[#7892ac] disabled:opacity-40"
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
            {messages.length ? (
              <>
                {messages.map((m) => {
                  const own = m.sender_id === user.id;
                  const counts = reactionCounts.get(m.id);
                  const read = readSet.has(m.id);
                  const parent = m.reply_to_id
                    ? messages.find((x) => x.id === m.reply_to_id)
                    : null;
                  const sender = profile(m.profiles);
                  const accent = profileAccent(sender);
                  const replyPreview = parent ? (
                    <div className="mb-2 border-l-2 border-[#70c1ff] pl-3 py-1 text-[10px]">
                      <strong className="block">
                        {nameOf(
                          parent.profiles,
                          parent.sender_id === user.id ? "You" : "Member",
                        )}
                      </strong>
                      <p className="truncate text-white/60">
                        {parent.body || parent.sticker_key}
                      </p>
                    </div>
                  ) : null;
                  return own ? (
                    <div
                      key={m.id}
                      data-message-id={m.id}
                      className="mb-3 flex justify-end"
                    >
                      <div className="flex max-w-[84%] flex-col items-end sm:max-w-[72%]">
                        {replyPreview}
                        <div
                          className={`rounded-[22px] rounded-br-[7px] bg-[#126bc0] px-4 py-3 transition ${highlighted === m.id ? "ring-2 ring-[#70c1ff] shadow-[0_0_28px_rgba(36,151,255,.35)]" : ""} ${m.deleted_at ? "opacity-60" : ""}`}
                        >
                          {m.deleted_at ? (
                            <i className="text-sm">Message deleted</i>
                          ) : m.sticker_key ? (
                            <span className="text-5xl">{m.sticker_key}</span>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {m.body}
                            </p>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <span className="text-[9px] text-white/50">
                            {timeOf(m.created_at)}
                          </span>
                          {!m.pending ? (
                            <span
                              className={`grid size-5 place-items-center rounded-full border ${read ? "border-white bg-white" : "border-white/25 bg-transparent"}`}
                              aria-label={read ? "Read" : "Delivered"}
                            >
                              {read ? (
                                <CheckCheck
                                  size={11}
                                  className="text-[#126bc0]"
                                />
                              ) : (
                                <CheckCheck
                                  size={11}
                                  className="text-white/45"
                                />
                              )}
                            </span>
                          ) : (
                            <span
                              className="grid size-5 place-items-center rounded-full border border-white/25"
                              aria-label="Sent"
                            >
                              <Check size={11} className="text-white/45" />
                            </span>
                          )}
                        </div>
                        {counts?.size ? (
                          <div className="mt-2 flex flex-wrap justify-end gap-1">
                            {Array.from(counts.entries()).map(
                              ([emoji, count]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() =>
                                    void toggleReaction(m.id, emoji)
                                  }
                                  className="rounded-full border border-white/15 bg-black/10 px-2 py-1 text-[10px]"
                                >
                                  {emoji} {count}
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="ml-1 mt-5 grid size-7 place-items-center rounded-full text-[#4e6b88] hover:bg-[#0b223c]"
                        aria-label="Reply to message"
                        onClick={() => {
                          setReplyTo(m);
                          inputRef.current?.focus();
                        }}
                      >
                        <Reply size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={m.id}
                      data-message-id={m.id}
                      className="mb-4 flex justify-start"
                    >
                      <div className="mr-2 mt-0 size-10 shrink-0 overflow-hidden rounded-full">
                        <MatchUpAvatar
                          profile={sender}
                          size="sm"
                          className="size-full rounded-full"
                        />
                      </div>
                      <div className="min-w-0 max-w-[84%] sm:max-w-[72%]">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-sm font-black"
                            style={
                              !sender?.avatar_path
                                ? {
                                    color: accent,
                                    backgroundColor: `${accent}1a`,
                                  }
                                : undefined
                            }
                          >
                            {nameOf(sender)}
                          </span>
                          <span className="text-[10px] text-[#7892ac]">
                            {timeOf(m.created_at)}
                          </span>
                        </div>
                        <div
                          className={`rounded-[22px] rounded-bl-[7px] border border-[#173d67] bg-[#0a1b2f] px-4 py-3 transition ${highlighted === m.id ? "ring-2 ring-[#70c1ff] shadow-[0_0_28px_rgba(36,151,255,.35)]" : ""} ${m.deleted_at ? "opacity-60" : ""}`}
                        >
                          {replyPreview}
                          {m.deleted_at ? (
                            <i className="text-sm">Message deleted</i>
                          ) : m.sticker_key ? (
                            <span className="text-5xl">{m.sticker_key}</span>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {m.body}
                            </p>
                          )}
                        </div>
                        {counts?.size ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Array.from(counts.entries()).map(
                              ([emoji, count]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() =>
                                    void toggleReaction(m.id, emoji)
                                  }
                                  className="rounded-full border border-white/15 bg-black/10 px-2 py-1 text-[10px]"
                                >
                                  {emoji} {count}
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="ml-1 mt-5 grid size-7 place-items-center rounded-full text-[#4e6b88] hover:bg-[#0b223c]"
                        aria-label="Reply to message"
                        onClick={() => {
                          setReplyTo(m);
                          inputRef.current?.focus();
                        }}
                      >
                        <Reply size={14} />
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="grid min-h-[45vh] place-items-center text-center">
                <div>
                  <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#0b3154] text-[#70c1ff]">
                    <Users size={28} />
                  </div>
                  <h2 className="mt-4 text-lg font-black">
                    {active?.kind === "general"
                      ? "Welcome to General"
                      : "No messages yet"}
                  </h2>
                  <p className="mt-2 text-sm text-[#7892ac]">
                    Send a real message. It will persist and appear here in
                    realtime.
                  </p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {typingNotice ? (
            <p className="mx-auto mt-2 max-w-3xl text-xs text-[#7892ac]">
              {typingNotice}
            </p>
          ) : null}
        </div>
        {error ? (
          <div className="border-t border-[#6c2736] bg-[#2a1018] px-4 py-3 text-xs text-[#ff9eaa]">
            {error}
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-3 underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {active?.locked ? (
          <div className="border-t border-[#6c2736] bg-[#24151a] px-4 py-3 text-xs text-[#ffb2bc]">
            <Lock size={13} className="mr-1 inline" />
            This group is locked. Existing messages are still readable.
          </div>
        ) : null}
        <div
          className="matchup-chat-composer sticky bottom-0 z-20 shrink-0 border-t border-[#18365f] bg-[#08182b] p-3 sm:p-4"
          style={
            keyboardOffset
              ? { transform: `translateY(-${keyboardOffset}px)` }
              : undefined
          }
        >
          {replyTo ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-[#214a78] bg-[#071426] px-3 py-2 text-xs">
              <div className="min-w-0 flex-1 border-l-2 border-[#70c1ff] pl-3">
                <strong className="block">{nameOf(replyTo.profiles)}</strong>
                <span className="block truncate text-white/60">
                  {replyTo.body || replyTo.sticker_key}
                </span>
              </div>
              <button type="button" onClick={() => setReplyTo(null)}>
                <X size={15} />
              </button>
            </div>
          ) : null}
          {showStickers ? (
            <div className="mb-2 grid grid-cols-6 gap-1 rounded-2xl border border-[#18365f] bg-[#071426] p-2">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage("", s)}
                  className="rounded-xl p-2 text-2xl hover:bg-[#0b223c]"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-[24px] border border-[#214a78] bg-[#071426] p-2">
            <button
              type="button"
              onClick={() => setShowStickers((v) => !v)}
              className="grid size-10 shrink-0 place-items-center rounded-full text-[#7892ac]"
              aria-label="Stickers"
            >
              <Smile size={19} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => void toggleTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={Boolean(active?.locked)}
              placeholder={
                active?.locked ? "Group is locked" : "Type a message…"
              }
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none disabled:cursor-not-allowed"
              aria-label="Message"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={Boolean(active?.locked) || !input.trim()}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1674cf] text-white disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 px-2 text-[10px] text-[#66809a]">
            <Paperclip size={11} />
            Text, stickers and MatchUp Feed links only.
          </p>
        </div>
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-[#214a78] bg-[#08182b] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">
                  New private group
                </p>
                <h2 className="mt-1 text-xl font-black">Create Group</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>
                <X size={19} />
              </button>
            </div>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="mt-5 w-full rounded-2xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm outline-none"
            />
            <label className="mt-4 block rounded-2xl border border-dashed border-[#214a78] p-4 text-center text-xs text-[#7892ac]">
              <span className="font-bold text-white">Group photo</span>
              <span className="ml-2">optional, up to 5 MB</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setGroupImage(e.target.files?.[0] || null)}
                className="mt-2 block w-full text-xs"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowLimitPicker(true)}
              className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[#214a78] bg-[#071426] p-4 text-left"
            >
              <span>
                <strong className="block text-sm">Group limit</strong>
                <small className="text-[11px] text-[#7892ac]">
                  Choose how many people can be in this group
                </small>
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent)]">
                {groupLimit} people
              </span>
            </button>
            <div className="mt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-[#66809a]">
                Invite people
              </p>
              <div className="flex items-center gap-2 rounded-2xl border border-[#214a78] bg-[#071426] px-3">
                <Search size={15} className="text-[#47a8ff]" />
                <input
                  value={inviteSearch}
                  onChange={(e) => void searchPeople(e.target.value)}
                  placeholder="Search friends or any MatchUp user"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
              </div>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {inviteCandidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setSelectedInvitees((v) =>
                        v.includes(p.id)
                          ? v.filter((x) => x !== p.id)
                          : [...v, p.id],
                      )
                    }
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${selectedInvitees.includes(p.id) ? "bg-[#0b3154]" : "hover:bg-[#0a1d32]"}`}
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-[#103a60] text-xs font-black">
                      {nameOf(p).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">
                        {nameOf(p)}
                      </strong>
                      <small className="text-[10px] text-[#7892ac]">
                        @{p.username || "player"}
                      </small>
                    </span>
                    {selectedInvitees.includes(p.id) ? (
                      <Check size={16} className="text-[#70c1ff]" />
                    ) : (
                      <Plus size={15} className="text-[#66809a]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-2xl border border-[#214a78] px-4 py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createGroup()}
                disabled={groupName.trim().length < 2}
                className="rounded-2xl bg-[#1674cf] px-5 py-2.5 text-sm font-black disabled:opacity-40"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
      {showManage && active?.kind === "group" && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-[#214a78] bg-[#08182b] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">
                  Group controls
                </p>
                <h2 className="mt-1 text-xl font-black">{active.name}</h2>
              </div>
              <button type="button" onClick={() => setShowManage(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/tournaments/from-group?groupId=${active.id}`;
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-left"
              >
                <Trophy size={18} className="text-[var(--accent)]" />
                <span>
                  <strong className="block text-sm">Create Tournament</strong>
                  <small className="text-[11px] text-[var(--muted)]">
                    Invite people from this group before creating
                  </small>
                </span>
              </button>
              <div className="flex gap-2">
                <input
                  value={groupName || active.name}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void renameGroup()}
                  className="rounded-2xl bg-[#126bc0] px-4 text-xs font-black"
                >
                  Rename
                </button>
              </div>
              <label className="flex items-center justify-between rounded-2xl border border-[#214a78] bg-[#071426] p-3 text-sm">
                <span>Change group photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void changeGroupImage(f);
                  }}
                  className="max-w-[170px] text-xs"
                />
              </label>
              <button
                type="button"
                onClick={() => void toggleMute()}
                className="flex items-center justify-between rounded-2xl border border-[#214a78] bg-[#071426] p-3 text-left text-sm"
              >
                <span>{muted ? "Unmute this chat" : "Mute this chat"}</span>
                <span className="text-xs text-[#7892ac]">
                  {muted ? "UNMUTE" : "MUTE"}
                </span>
              </button>
              {owner ? (
                <button
                  type="button"
                  onClick={() => void toggleLock()}
                  className="flex items-center gap-3 rounded-2xl border border-[#214a78] bg-[#071426] p-3 text-left text-sm"
                >
                  {active.locked ? <Unlock size={17} /> : <Lock size={17} />}
                  <span>{active.locked ? "Unlock group" : "Lock group"}</span>
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setGroupLimit(active.member_limit || 20);
                setShowLimitPicker(true);
              }}
              className="mb-4 flex w-full items-center justify-between rounded-2xl border border-[#214a78] bg-[#071426] p-3 text-left"
            >
              <span>
                <strong className="block text-sm">Group limit</strong>
                <small className="text-[11px] text-[#7892ac]">
                  Members {members.length} · Limit {active.member_limit || 20}
                </small>
              </span>
              <span className="text-xs font-black text-[var(--accent)]">
                Change
              </span>
            </button>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#66809a]">
                  Members · {members.length}
                </p>
              </div>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 border-b border-[#122c48] py-2.5"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-[#103a60] text-[10px] font-black">
                    {nameOf(m).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {nameOf(m)}
                    {m.id === active.created_by ? (
                      <span className="ml-2 text-[9px] text-[#70c1ff]">
                        OWNER
                      </span>
                    ) : null}
                  </span>
                  {owner && m.id !== user.id ? (
                    <button
                      type="button"
                      onClick={() => void removeMember(m.id)}
                      className="rounded-lg p-2 text-[#ff8f9f]"
                      aria-label={`Remove ${nameOf(m)}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-[.14em] text-[#66809a]">
                Invite another person
              </p>
              <div className="flex gap-2">
                <input
                  value={inviteSearch}
                  onChange={(e) => void searchPeople(e.target.value)}
                  placeholder="Search by username or name"
                  className="min-w-0 flex-1 rounded-2xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm"
                />
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto">
                {inviteCandidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void inviteMember(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[#0a1d32]"
                  >
                    <UserPlus size={15} className="text-[#70c1ff]" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {nameOf(p)}
                    </span>
                    <span className="text-[10px] text-[#7892ac]">Invite</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => void leaveGroup()}
                className="rounded-2xl border border-[#214a78] px-4 py-2.5 text-xs font-bold"
              >
                Leave Group
              </button>
              {owner ? (
                <button
                  type="button"
                  onClick={() => void deleteGroup()}
                  className="rounded-2xl bg-[#7d2638] px-4 py-2.5 text-xs font-black"
                >
                  Delete Group
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {showLimitPicker && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--line)] bg-[#171109] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[var(--accent)]">
                  Group settings
                </p>
                <h2 className="mt-1 text-xl font-black">Limit group size</h2>
              </div>
              <button type="button" onClick={() => setShowLimitPicker(false)}>
                <X size={19} />
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Once the group reaches this number, new invitations are blocked
              until the admin raises the limit.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[10, 20, 30, 50].map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => {
                    setGroupLimit(limit);
                    if (showManage) void setMemberLimit(limit);
                  }}
                  className={`rounded-2xl border p-5 text-left ${groupLimit === limit ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[#100d09]"}`}
                >
                  <span className="block text-2xl font-black">{limit}</span>
                  <span className="text-xs text-[var(--muted)]">people</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (showManage) void setMemberLimit(groupLimit);
                else setShowLimitPicker(false);
              }}
              className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-[#241205]"
            >
              Save limit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
