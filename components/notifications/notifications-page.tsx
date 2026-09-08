"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, AtSign, Bell, CalendarDays, CheckCheck, FileText, Heart, Link2, MessageCircle, Trophy, UserPlus, UsersRound, UserRoundPlus, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { markAllLocalNotificationsRead, markLocalNotificationRead, readLocalNotifications, type LocalNotification } from "../../lib/notifications/local";

type NotificationRow = {
  id: string;
  recipient_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

type Profile = { id: string; display_name: string | null; username: string | null; avatar_path: string | null };

type ViewNotification = NotificationRow & { actor?: Profile | null; message: string; href?: string | null; thumbnail?: string | null; actorName: string };

const iconForKind = (kind: string) => {
  if (kind.includes("like")) return Heart;
  if (kind.includes("comment")) return MessageCircle;
  if (kind.includes("tag")) return AtSign;
  if (kind.includes("link_copied")) return Link2;
  if (kind === "post_created" || kind.startsWith("post_")) return FileText;
  if (kind.includes("follow") || kind.includes("follower")) return UserRoundPlus;
  if (kind.startsWith("friend")) return UserPlus;
  if (kind.startsWith("group")) return UsersRound;
  if (kind.includes("boost")) return Zap;
  return Trophy;
};

function payloadString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function buildHref(row: NotificationRow) {
  const explicit = payloadString(row.payload, "href");
  if (explicit) return explicit;
  const entityType = payloadString(row.payload, "entity_type") || "";
  const entityId = payloadString(row.payload, "entity_id");
  if (!entityId) return null;
  if (entityType === "tournament") return `/tournaments/${entityId}`;
  if (entityType === "post") return `/feeds?post=${entityId}`;
  if (entityType === "profile") return `/feeds?profile=${entityId}`;
  if (entityType === "group") return `/leaderboard?group=${entityId}`;
  return null;
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

function dayGroup(value: string) {
  const now = new Date();
  const date = new Date(value);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.floor((start.getTime() - target.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This Week";
  return "Earlier";
}

function localToRow(item: LocalNotification): NotificationRow {
  return { id: item.id, recipient_id: "local", kind: item.kind, payload: item.payload, read_at: item.read_at, created_at: item.created_at };
}

export function NotificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [notifications, setNotifications] = useState<ViewNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const localRows = readLocalNotifications().map(localToRow);
    if (!auth.user) {
      setSignedIn(false);
      setNotifications([]);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,recipient_id,kind,payload,read_at,created_at")
      .eq("recipient_id", auth.user.id)
      .order("created_at", { ascending: false });
    const dbRows = (data || []) as NotificationRow[];
    const rows = [...dbRows, ...localRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const actorIds = Array.from(new Set(rows.map((row) => payloadString(row.payload, "actor_id")).filter((id): id is string => Boolean(id))));
    let profiles: Profile[] = [];
    if (actorIds.length) {
      const { data: profileData } = await supabase.from("profiles").select("id,display_name,username,avatar_path").in("id", actorIds);
      profiles = (profileData || []) as Profile[];
    }
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    setNotifications(rows.map((row) => {
      const actor = payloadString(row.payload, "actor_id") ? profileMap.get(payloadString(row.payload, "actor_id")!) || null : null;
      return {
        ...row,
        actor,
        message: payloadString(row.payload, "message") || row.kind.replaceAll("_", " "),
        href: buildHref(row),
        thumbnail: payloadString(row.payload, "thumbnail"),
        actorName: actor?.display_name || actor?.username || payloadString(row.payload, "actor_name") || "MatchUp",
      };
    }));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
    const onStorageChange = () => void load();
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("matchup:notifications-changed", onStorageChange);
    return () => {
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("matchup:notifications-changed", onStorageChange);
    };
  }, [load]);

  const markRead = async (notification: ViewNotification) => {
    if (!notification.read_at) {
      const readAt = new Date().toISOString();
      if (notification.id.startsWith("local-")) {
        markLocalNotificationRead(notification.id);
      } else {
        await supabase.from("notifications").update({ read_at: readAt }).eq("id", notification.id);
      }
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
    }
    if (notification.href) router.push(notification.href);
  };

  const markAllRead = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const readAt = new Date().toISOString();
      await supabase.from("notifications").update({ read_at: readAt }).eq("recipient_id", auth.user.id).is("read_at", null);
    }
    markAllLocalNotificationsRead();
    setNotifications((current) => {
      const readAt = new Date().toISOString();
      return current.map((item) => ({ ...item, read_at: item.read_at || readAt }));
    });
  };

  const groups = ["Today", "Yesterday", "This Week", "Earlier"].map((label) => ({ label, items: notifications.filter((item) => dayGroup(item.created_at) === label) })).filter((group) => group.items.length);
  const unread = notifications.filter((item) => !item.read_at).length;

  return (
    <main className="app-shell min-h-screen pb-28">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} aria-label="Go back" className="grid size-10 place-items-center rounded-full border border-[#2b2b45] bg-[#111226] text-[#aaa8bd] hover:border-[#7843ee] hover:text-white"><ArrowLeft size={18} /></button>
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a73ff]">MatchUp</p><h1 className="text-2xl font-black text-white">Notifications</h1></div>
        </div>
        {unread > 0 ? <button type="button" onClick={() => void markAllRead()} className="flex items-center gap-2 rounded-xl border border-[#3a315c] bg-[#17152e] px-3 py-2 text-xs font-black text-[#d8d3e8] hover:border-[#7843ee] hover:text-white"><CheckCheck size={15} />Mark all as read</button> : null}
      </div>

      {!signedIn ? (
        <div className="surface-card mt-8 p-8 text-center"><Bell size={28} className="mx-auto text-[#7f57e8]" /><p className="mt-3 font-black text-white">Sign in to see your notifications</p><div className="mt-4 flex gap-3"><a href="/auth/sign-in" className="flex-1 rounded-xl bg-[#6d27ff] px-4 py-3 text-center text-sm font-bold text-white transition hover:brightness-110">Sign In</a><a href="/auth/sign-up" className="flex-1 rounded-xl border border-[#6d27ff] bg-transparent px-4 py-3 text-center text-sm font-bold text-[#a979ff] transition hover:bg-[#17132b]">Sign Up</a></div></div>
      ) : loading ? (
        <div className="surface-card mt-8 p-8 text-center text-sm text-[#858196]">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="surface-card mt-8 p-10 text-center"><Bell size={30} className="mx-auto text-[#7b4de2]" /><p className="mt-4 text-lg font-black text-white">You're all caught up</p><p className="mt-1 text-sm text-[#77758b]">Likes, comments, tags, follows, copied links, posts, friends, groups, and tournament activity will appear here.</p></div>
      ) : (
        <div className="mt-7 space-y-7">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.15em] text-[#77748a]"><CalendarDays size={13} />{group.label}</div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const Icon = iconForKind(item.kind);
                  const actorInitial = item.actorName.slice(0, 1).toUpperCase();
                  return <button key={item.id} type="button" onClick={() => void markRead(item)} className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-[#6941c8] ${item.read_at ? "border-[#25243a] bg-[#101124]" : "border-[#51378b] bg-[#17152e]"}`}>
                    <div className="relative shrink-0">
                      {item.actor?.avatar_path ? <img src={item.actor.avatar_path} alt="" className="size-11 rounded-full object-cover" /> : <div className="grid size-11 place-items-center rounded-full bg-[#2a2048] text-sm font-black text-[#b48bff]">{actorInitial}</div>}
                      {!item.read_at ? <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-[#17152e] bg-[#9a73ff]" /> : null}
                    </div>
                    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className={`text-sm leading-5 ${item.read_at ? "font-medium text-[#d0ccdc]" : "font-black text-white"}`}>{item.message}</p><span className="shrink-0 text-[10px] font-semibold text-[#77748a]">{relativeTime(item.created_at)}</span></div><div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#7f7694]"><Icon size={12} />{item.kind.replaceAll("_", " ")}</div></div>
                    {item.thumbnail ? <img src={item.thumbnail} alt="" className="hidden size-12 shrink-0 rounded-xl object-cover sm:block" /> : null}
                  </button>;
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
