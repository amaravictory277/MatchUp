'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleUserRound, Search, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';

type AdminUser = {
  id: string;
  display_name: string | null;
  username: string;
  avatar_path: string | null;
  last_seen_at: string | null;
  created_at: string;
};

type Props = {
  initialUsers: AdminUser[];
  initialTotal: number;
  initialActiveToday: number;
  adminName: string;
};

function initials(user: AdminUser) {
  const value = user.display_name?.trim() || user.username;
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
}

function avatarUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  return null;
}

function relativeTime(value: string | null) {
  if (!value) return 'No activity recorded';
  const then = new Date(value).getTime();
  const delta = Date.now() - then;
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function UserAvatar({ user, online }: { user: AdminUser; online: boolean }) {
  const src = avatarUrl(user.avatar_path);
  return (
    <div className="relative h-12 w-12 shrink-0">
      {src ? <img src={src} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700 ring-1 ring-blue-100">{initials(user)}</div>}
      <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-label={online ? 'Online now' : 'Offline'} />
    </div>
  );
}

export function AdminDashboard({ initialUsers, initialTotal, initialActiveToday, adminName }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [activeToday, setActiveToday] = useState(initialActiveToday);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const presence = supabase.channel('matchup:online-users', { config: { presence: { key: `admin-${Date.now()}` } } });
    const sync = () => setOnlineIds(new Set(Object.keys(presence.presenceState() as Record<string, unknown[]>)));
    presence.on('presence', { event: 'sync' }, sync).on('presence', { event: 'join' }, sync).on('presence', { event: 'leave' }, sync).subscribe();

    const profileEvents = supabase
      .channel('matchup:admin-profiles')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        const profile = payload.new as AdminUser;
        setTotal((current) => current + 1);
        setUsers((current) => current.some((item) => item.id === profile.id) ? current : [profile, ...current]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'profiles' }, (payload) => {
        const deleted = payload.old as { id?: string };
        if (!deleted.id) return;
        setTotal((current) => Math.max(0, current - 1));
        setUsers((current) => current.filter((item) => item.id !== deleted.id));
        setOnlineIds((current) => {
          const next = new Set(current);
          next.delete(deleted.id!);
          return next;
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(presence);
      void supabase.removeChannel(profileEvents);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUsers(initialUsers);
      setTotal(initialTotal);
      setActiveToday(initialActiveToday);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/users?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { users: AdminUser[]; total: number; activeToday: number };
        setUsers(data.users);
        setTotal(data.total);
        setActiveToday(data.activeToday);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, initialUsers, initialTotal, initialActiveToday]);

  const onlineUsers = useMemo(() => users.filter((user) => onlineIds.has(user.id)), [users, onlineIds]);
  const offlineUsers = useMemo(() => users.filter((user) => !onlineIds.has(user.id)).sort((a, b) => new Date(b.last_seen_at || b.created_at).getTime() - new Date(a.last_seen_at || a.created_at).getTime()), [users, onlineIds]);
  const onlineCount = onlineIds.size;
  const offlineCount = Math.max(0, total - onlineCount);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/home" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="Back to MatchUp"><ArrowLeft className="h-5 w-5" /></Link>
            <div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">MatchUp Admin</p></div>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Overview</h1>
              <p className="mt-1 text-sm text-slate-500">Signed in as {adminName}</p>
            </div>
          </div>
          <div className="hidden rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 sm:block">Live user monitoring</div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="User statistics">
          <StatCard label="Total users" value={total} icon={<Users className="h-5 w-5" />} />
          <StatCard label="Online now" value={onlineCount} icon={<Wifi className="h-5 w-5" />} live />
          <StatCard label="Offline" value={offlineCount} icon={<WifiOff className="h-5 w-5" />} />
          <StatCard label="Active today" value={activeToday} icon={<CircleUserRound className="h-5 w-5" />} />
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-base font-extrabold">Search users</h2><p className="mt-0.5 text-xs text-slate-500">Search by display name or username. Emails are never shown.</p></div>
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:max-w-md">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
              {searching ? <span className="text-xs font-semibold text-blue-600">Searching…</span> : null}
            </label>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <UserSection title="Online now" subtitle={`${onlineCount} unique registered user${onlineCount === 1 ? '' : 's'} present`} users={onlineUsers} online />
          <UserSection title="Offline" subtitle={`${offlineCount} registered user${offlineCount === 1 ? '' : 's'} not present`} users={offlineUsers} online={false} />
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon, live = false }: { label: string; value: number; icon: ReactNode; live?: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</div>{live ? <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live</span> : null}</div><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 text-3xl font-black tracking-tight text-slate-950">{value.toLocaleString()}</p></article>;
}

function UserSection({ title, subtitle, users, online }: { title: string; subtitle: string; users: AdminUser[]; online: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div><span className={`h-3 w-3 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} /></div></div><div className="divide-y divide-slate-100">{users.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-500">{online ? 'No users are online right now.' : 'No offline users match this search.'}</div> : users.map((user) => <div key={user.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><UserAvatar user={user} online={online} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-900">{user.display_name || user.username}</p><p className="truncate text-xs font-medium text-slate-500">@{user.username}</p></div><div className={`shrink-0 text-right text-xs font-semibold ${online ? 'text-emerald-600' : 'text-slate-500'}`}>{online ? 'Online now' : `Last seen ${relativeTime(user.last_seen_at)}`}</div></div>)}</div></section>;
}
