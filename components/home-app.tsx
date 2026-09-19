"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Gamepad2,
  Heart,
  MessageCircle,
  Save,
  Search,
  Share2,
  Swords,
  Trophy,
  Users,
  UsersRound,
  UserPlus,
  Zap,
} from "lucide-react";
import { Navigation } from "./navigation";
import { MatchUpAvatar } from "./ui/matchup-avatar";
import { MatchUpVerificationBadge } from "./feeds/matchup-verification-badge";
import { FeedCard } from "./feeds/feed-card";
import { createBrowserSupabaseClient } from "../lib/supabase/client";
import type { Author, Post } from "./feeds/data";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  country: string | null;
  bio: string | null;
  supported_game?: string | null;
  is_verified?: boolean;
  ready_player_enabled?: boolean;
  followerCount?: number;
  postCount?: number;
};

type PersonPreview = Profile & {
  following: boolean;
  friendship: "none" | "pending" | "friends";
};

type Tournament = {
  id: string;
  name: string;
  game_title: string | null;
  max_players: number;
  format: string;
  prize_pool: number | null;
  starts_at: string | null;
  banner_path: string | null;
  status: string;
  entry_information?: string | null;
  promotion_kind?: string | null;
  teams?: number;
  venue?: string | null;
};

type GroupPreview = {
  id: string;
  name: string;
  image_path: string | null;
  memberCount: number;
};

const fallbackMedia = "/matchup-logo.svg";

function nameOf(p?: Profile | null) {
  return p?.display_name?.trim() || p?.username || "MatchUp Player";
}

function gameLabel(value?: string | null) {
  if (!value) return "Football";
  return /efootball/i.test(value) ? "Football" : value;
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString();
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  return amount > 0 ? `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}` : null;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function countdown(value: string | null) {
  if (!value) return "Date TBA";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Started";
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `Starts in ${days}d ${hours}h`;
  if (hours > 0) return `Starts in ${hours}h`;
  return `Starts in ${Math.max(1, minutes)}m`;
}

function publicStorageUrl(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  bucket: string,
  path: string | null,
) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function SectionHeading({
  eyebrow,
  title,
  description,
  href,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#47a8ff]">{eyebrow}</p> : null}
        <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[#86a1bb] sm:text-sm">{description}</p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#214a78] bg-[#071426] px-3 py-2 text-[11px] font-black text-[#bfe3ff] transition hover:border-[#47a8ff] hover:text-white"
      >
        See All <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  href,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#214a78] bg-[#071426] p-7 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#0b3154] text-[#70c1ff]">{icon}</span>
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-[#7892ac]">{text}</p>
      {href && action ? (
        <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black text-white">
          {action}<ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function PersonCard({ person, onFollow, onFriend }: {
  person: PersonPreview;
  onFollow: (id: string) => void;
  onFriend: (id: string) => void;
}) {
  const name = nameOf(person);
  const friendLabel = person.friendship === "friends" ? "Friends" : person.friendship === "pending" ? "Request Sent" : "Add Friend";
  return (
    <article className="min-w-[292px] overflow-hidden rounded-[24px] border border-[#1b4775] bg-[#071426] p-4 shadow-[0_16px_45px_rgba(0,35,70,.16)] sm:min-w-[320px]">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <MatchUpAvatar profile={person} size="lg" alt={name} className="!size-[68px] !rounded-full border-2 border-[#2497ff]" />
          {person.is_verified ? <span className="absolute -bottom-1 -right-1"><MatchUpVerificationBadge /></span> : null}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-base font-black text-white">{name}</p>
            {person.is_verified ? <MatchUpVerificationBadge /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#7892ac]">
            {person.country ? <span>{person.country}</span> : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#214a78] bg-[#0a2139] px-2 py-0.5 font-bold text-[#9bd3ff]">
              <Gamepad2 size={11} />{gameLabel(person.supported_game)}
            </span>
          </div>
        </div>
      </div>

      {person.bio?.trim() ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#b7c9da]">{person.bio.trim()}</p> : null}

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-[#153c68] bg-[#08182b] p-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.1em] text-[#7892ac]">Followers</p>
          <p className="mt-1 text-sm font-black text-white">{person.followerCount ?? 0}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.1em] text-[#7892ac]">Posts</p>
          <p className="mt-1 text-sm font-black text-white">{person.postCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onFollow(person.id)}
          className={`rounded-xl px-3 py-2.5 text-xs font-black ${person.following ? "border border-[#285277] bg-[#0a2139] text-[#b7c9da]" : "bg-[#167bd1] text-white"}`}
        >
          {person.following ? "Unfollow" : "Follow"}
        </button>
        <button
          type="button"
          disabled={person.friendship !== "none"}
          onClick={() => onFriend(person.id)}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black ${person.friendship === "none" ? "border-[#285b91] bg-[#0a2946] text-[#9bd3ff]" : "border-[#18365f] bg-[#071426] text-[#6f89a1]"}`}
        >
          {person.friendship === "friends" ? <Check size={14} /> : <UserPlus size={14} />}
          {friendLabel}
        </button>
      </div>
    </article>
  );
}

function TournamentCard({ tournament, supabase }: { tournament: Tournament; supabase: ReturnType<typeof createBrowserSupabaseClient> }) {
  const prize = formatMoney(tournament.prize_pool);
  const date = formatDate(tournament.starts_at);
  const banner = publicStorageUrl(supabase, "tournament-media", tournament.banner_path);
  const format = formatLabel(tournament.format);
  const status = tournament.status === "open" ? "Registration Open" : formatLabel(tournament.status);
  return (
    <Link href={`/tournaments/${tournament.id}`} className="group block min-w-[300px] sm:min-w-0">
      <article className="overflow-hidden rounded-[26px] border border-[#1b4775] bg-[#071426] shadow-[0_18px_55px_rgba(0,45,90,.18)] transition hover:-translate-y-0.5 hover:border-[#2497ff]">
        <div className="relative h-40 overflow-hidden bg-[#061120]">
          {banner ? (
            <img src={banner} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[#071426] p-10">
              <img src={fallbackMedia} alt="MatchUp" className="max-h-full max-w-[230px] object-contain opacity-90" />
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,22,.08),rgba(3,12,22,.9))]" />
          <span className="absolute left-3 top-3 rounded-full border border-[#2497ff] bg-[#061a2d]/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-[#9bd3ff]">
            FEATURED
          </span>
          <div className="absolute inset-x-4 bottom-3">
            <p className="truncate text-lg font-black text-white">{tournament.name}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-[#214a78] bg-[#0a2139] px-3 py-2 text-[10px] font-black text-[#b7c9da]">
              <Users size={13} className="shrink-0 text-[#70c1ff]" />{tournament.max_players} Players
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-[#214a78] bg-[#0a2139] px-3 py-2 text-[10px] font-black text-[#b7c9da]">
              <Trophy size={13} className="shrink-0 text-[#70c1ff]" />{format}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-[#214a78] bg-[#0a2139] px-3 py-2 text-[10px] font-black text-[#b7c9da]">
              <CalendarDays size={13} className="shrink-0 text-[#70c1ff]" />{countdown(tournament.starts_at)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#214a78] bg-[#08182b] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">
              ⚽ {gameLabel(tournament.game_title)}
            </span>
            <span className="rounded-full border border-[#214a78] bg-[#08182b] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">
              {status}
            </span>
            {tournament.teams ? (
              <span className="rounded-full border border-[#214a78] bg-[#08182b] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">
                {tournament.teams} Teams
              </span>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-[#245b91] bg-[linear-gradient(135deg,#0a2946,#071a2d)] px-4 py-3.5">
            <div className="flex items-center gap-2 text-[10px] font-black tracking-[.15em] text-[#70c1ff]">
              <Trophy size={14} /> PRIZE POOL
            </div>
            <p className="mt-1 text-2xl font-black text-white">{prize || "No Prize Pool"}</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#86a1bb]">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              {date ? <><CalendarDays size={13} />{date}</> : "Date TBA"}
            </span>
            {tournament.venue ? <span className="max-w-[48%] truncate">{tournament.venue}</span> : null}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#167bd1] px-4 py-3 text-xs font-black text-white">
            <span>View Tournament</span><ArrowRight size={16} />
          </div>
        </div>
      </article>
    </Link>
  );
}

function ReadyCard({ player }: { player: Profile }) {
  return (
    <article className="min-w-[250px] rounded-[24px] border border-[#1b4775] bg-[#071426] p-4 sm:min-w-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <MatchUpAvatar profile={player} size="lg" alt={nameOf(player)} className="!rounded-full" />
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#071426] bg-[#2497ff]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{nameOf(player)}</p>
          <p className="mt-1 text-xs font-bold text-[#70c1ff]">Ready to play</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">
          <Gamepad2 size={11} className="mr-1 inline" />{gameLabel(player.supported_game)}
        </span>
        <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">READY</span>
      </div>
      <Link href="/ready-players" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black text-white">
        <Swords size={14} />Challenge
      </Link>
    </article>
  );
}

function GroupCard({ group }: { group: GroupPreview }) {
  return (
    <Link href={`/leaderboard?group=${group.id}`} className="min-w-[250px] rounded-[24px] border border-[#1b4775] bg-[#071426] p-4 transition hover:border-[#47a8ff] sm:min-w-0">
      <div className="flex items-center gap-3">
        <MatchUpAvatar group profile={{ id: group.id, display_name: group.name, avatar_path: group.image_path, username: null }} size="lg" alt={group.name} className="!rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{group.name}</p>
          <p className="mt-1 text-xs text-[#7892ac]">{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#9bd3ff]">FOOTBALL COMMUNITY</span>
        <ArrowRight size={15} className="shrink-0 text-[#70c1ff]" />
      </div>
    </Link>
  );
}

export function HomeApp() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [people, setPeople] = useState<PersonPreview[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [readyPlayers, setReadyPlayers] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<GroupPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  const loadHome = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || "";
    setUserId(uid);

    const [
      tournamentsResult,
      promotionsResult,
      profilesResult,
      followsResult,
      friendshipsResult,
      postsResult,
      readyResult,
      groupsResult,
      groupMembersResult,
    ] = await Promise.all([
      supabase.from("tournaments").select("id,name,game_title,max_players,format,prize_pool,starts_at,banner_path,status,entry_information,organizer_id").eq("visibility", "public").order("created_at", { ascending: false }).limit(40),
      supabase.from("tournament_promotions").select("tournament_id,kind,expires_at,position").order("position", { ascending: true }),
      supabase.from("profiles").select("id,username,display_name,avatar_path,country,bio,supported_game,is_verified,ready_player_enabled,created_at").neq("id", uid || "00000000-0000-0000-0000-000000000000").order("created_at", { ascending: false }).limit(50),
      uid ? supabase.from("user_follows").select("following_id").eq("follower_id", uid) : Promise.resolve({ data: [] as { following_id: string }[] }),
      uid ? supabase.from("friendships").select("user_id,friend_id,status").or(`user_id.eq.${uid},friend_id.eq.${uid}`).limit(500) : Promise.resolve({ data: [] as any[] }),
      supabase.from("posts").select("id,author_id,body,created_at").order("created_at", { ascending: false }).limit(40),
      supabase.rpc("get_ready_players"),
      supabase.from("chat_groups").select("id,name,image_path,kind,archived_at,created_at").eq("kind", "group").is("archived_at", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("chat_group_members").select("group_id,user_id").limit(3000),
    ]);

    const promotions = promotionsResult.data || [];
    const activePromotions = new Map<string, { kind: string; position: number }>();
    promotions.forEach((p: any) => {
      if ((!p.expires_at || new Date(p.expires_at).getTime() > Date.now()) && !activePromotions.has(p.tournament_id)) {
        activePromotions.set(p.tournament_id, { kind: p.kind, position: p.position ?? 999 });
      }
    });

    const tournamentRows = (tournamentsResult.data || [])
      .map((t: any) => ({ ...t, promotion_kind: activePromotions.get(t.id)?.kind || null }))
      .filter((t: any) => t.status !== "cancelled");

    const boosted = tournamentRows.filter((t: any) => ["boost", "pin"].includes(t.promotion_kind));
    const promoted = tournamentRows.filter((t: any) => ["featured", "promoted"].includes(t.promotion_kind));
    const regular = tournamentRows.filter((t: any) => !t.promotion_kind && ["open", "in_progress", "full"].includes(t.status));
    const featuredRows = [...boosted, ...promoted, ...regular].slice(0, 3);

    const tournamentIds = featuredRows.map((t: any) => t.id);
    const [{ data: teamRows }, { data: venueRows }] = await Promise.all([
      tournamentIds.length ? supabase.from("tournament_teams").select("tournament_id").in("tournament_id", tournamentIds) : Promise.resolve({ data: [] }),
      tournamentIds.length ? supabase.from("venues").select("tournament_id,name").in("tournament_id", tournamentIds) : Promise.resolve({ data: [] }),
    ]);
    const teamCounts = new Map<string, number>();
    (teamRows || []).forEach((r: any) => teamCounts.set(r.tournament_id, (teamCounts.get(r.tournament_id) || 0) + 1));
    const venueMap = new Map<string, string>();
    (venueRows || []).forEach((r: any) => { if (r.name) venueMap.set(r.tournament_id, r.name); });
    setTournaments(featuredRows.map((t: any) => ({ ...t, teams: teamCounts.get(t.id) || 0, venue: venueMap.get(t.id) || null })));

    const allProfiles = (profilesResult.data || []) as Profile[];
    const followedIds = new Set((followsResult.data || []).map((f: any) => f.following_id));
    const relationMap = new Map<string, "pending" | "friends">();
    (friendshipsResult.data || []).forEach((r: any) => {
      if (r.status !== "accepted" && r.status !== "pending") return;
      const other = r.user_id === uid ? r.friend_id : r.user_id;
      if (r.status === "accepted") relationMap.set(other, "friends");
      else relationMap.set(other, "pending");
    });

    const candidatePeople = allProfiles.filter((p) => !relationMap.has(p.id) && !followedIds.has(p.id)).slice(0, 10);
    const peopleWithCounts = await Promise.all(candidatePeople.map(async (p) => {
      const [{ count: followerCount }, { count: postCount }] = await Promise.all([
        supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", p.id),
      ]);
      return { ...p, followerCount: followerCount || 0, postCount: postCount || 0, following: false, friendship: "none" as const };
    }));
    setPeople(peopleWithCounts);

    const rawPosts = postsResult.data || [];
    const postIds = rawPosts.map((p: any) => p.id);
    const commentAuthorIds = Array.from(new Set((commentRows || []).map((r: any) => r.author_id)));\n    const authorIds = Array.from(new Set([...rawPosts.map((p: any) => p.author_id), ...commentAuthorIds]));
    const [{ data: mediaRows }, { data: likeRows }, { data: commentRows }, { data: savedRows }] = await Promise.all([
      postIds.length ? supabase.from("post_media").select("post_id,storage_path,media_type,position").in("post_id", postIds).order("position") : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("post_likes").select("post_id,user_id,created_at").in("post_id", postIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("post_comments").select("id,post_id,author_id,body,created_at").in("post_id", postIds).order("created_at",{ascending:true}) : Promise.resolve({ data: [] }),
      uid && postIds.length ? supabase.from("saved_posts").select("post_id").eq("user_id", uid).in("post_id", postIds) : Promise.resolve({ data: [] }),
    ]);
    const likeUserIds = Array.from(new Set((likeRows || []).map((r: any) => r.user_id)));
    const profileIds = Array.from(new Set([...authorIds, ...likeUserIds]));
    const { data: postProfiles } = profileIds.length
      ? await supabase.from("profiles").select("id,username,display_name,avatar_path,country,bio,supported_game,is_verified").in("id", profileIds)
      : { data: [] };
    const profileMap = new Map(((postProfiles || []) as Profile[]).map((p) => [p.id, p]));

    const mediaMap = new Map<string, { url: string; type: "image" | "video" }[]>();
    (mediaRows || []).forEach((m: any) => {
      const url = publicStorageUrl(supabase, "feed-media", m.storage_path);
      if (!url) return;
      const list = mediaMap.get(m.post_id) || [];
      list.push({ url, type: m.media_type === "video" ? "video" : "image" });
      mediaMap.set(m.post_id, list);
    });

    const commentCounts = new Map<string, number>();
    (commentRows || []).forEach((r: any) => commentCounts.set(r.post_id, (commentCounts.get(r.post_id) || 0) + 1));
    const likedIds = new Set((likeRows || []).filter((r: any) => r.user_id === uid).map((r: any) => r.post_id));
    const savedIds = new Set((savedRows || []).map((r: any) => r.post_id));
    const likesByPost = new Map<string, any[]>();
    (likeRows || []).forEach((r: any) => {
      const list = likesByPost.get(r.post_id) || [];
      list.push(r);
      likesByPost.set(r.post_id, list);
    });

    const feed: Post[] = rawPosts.map((p: any) => {
      const author = profileMap.get(p.author_id);
      const likeAvatars = (likesByPost.get(p.id) || []).slice(-4).reverse().map((r: any) => profileMap.get(r.user_id)).filter(Boolean) as Profile[];
      const authorName = nameOf(author);
      const authorData: Author = {
        id: p.author_id,
        name: authorName,
        handle: `@${author?.username || "player"}`,
        avatar: publicStorageUrl(supabase, "profile-media", author?.avatar_path || null),
        initials: authorName.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase(),
        game: gameLabel(author?.supported_game),
        verified: Boolean(author?.is_verified),
      };
      return {
        id: p.id,
        author: authorData,
        time: relativeTime(p.created_at),
        caption: p.body || "",
        media: (mediaMap.get(p.id) || []).map((m) => m.url),
        videoUrl: (mediaMap.get(p.id) || []).find((m) => m.type === "video")?.url,
        hasVideo: Boolean((mediaMap.get(p.id) || []).some((m) => m.type === "video")),
        likes: (likesByPost.get(p.id) || []).length,
        comments: commentCounts.get(p.id) || 0,
        commentList: [],
        shares: 0,
        liked: likedIds.has(p.id),
        saved: savedIds.has(p.id),
        following: followedIds.has(p.author_id),
        isOwn: uid ? p.author_id === uid : false,
        category: "community",
        likeAvatars: likeAvatars.map((p2) => ({
          id: p2.id,
          name: nameOf(p2),
          handle: `@${p2.username || "player"}`,
          avatar: publicStorageUrl(supabase, "profile-media", p2.avatar_path),
          initials: nameOf(p2).split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase(),
          game: gameLabel(p2.supported_game),
          verified: Boolean(p2.is_verified),
        })),
      } as Post;
    }).filter((p) => p.media.length > 0).slice(0, 6);
    setPosts(feed);

    const readyRows = ((readyResult.data || []) as any[])
      .filter((p: any) => p.id !== uid)
      .map((p: any) => ({
        id: p.id,
        username: p.username || null,
        display_name: p.display_name || null,
        avatar_path: p.avatar_path || null,
        country: p.country || null,
        bio: p.bio || null,
        supported_game: p.supported_game || null,
        is_verified: Boolean(p.is_verified),
        ready_player_enabled: true,
      } as Profile));
    setReadyPlayers(readyRows.slice(0, 3));

    const memberCounts = new Map<string, number>();
    (groupMembersResult.data || []).forEach((m: any) => memberCounts.set(m.group_id, (memberCounts.get(m.group_id) || 0) + 1));
    setGroups(((groupsResult.data || []) as any[])
      .map((g) => ({ id: g.id, name: g.name, image_path: g.image_path, memberCount: memberCounts.get(g.id) || 0 }))
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 3));

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadHome();
    const channel = supabase.channel("matchup-home-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_follows" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_groups" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_members" }, () => void loadHome())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadHome, supabase]);

  const toggleLike = async (id: string) => {
    if (!userId) { notify("Sign in to like posts."); return; }
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const result = post.liked
      ? await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", userId)
      : await supabase.from("post_likes").insert({ post_id: id, user_id: userId });
    if (result.error) notify("Could not update like.");
    else setPosts((items) => items.map((p) => p.id === id ? { ...p, liked: !post.liked, likes: p.likes + (post.liked ? -1 : 1) } : p));
  };

  const toggleFollow = async (id: string) => {
    if (!userId) { notify("Sign in to follow players."); return; }
    const result = await supabase.from("user_follows").select("following_id").eq("follower_id", userId).eq("following_id", id).maybeSingle();
    if (result.data) {
      const { error } = await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", id);
      if (error) notify("Could not update follow.");
      else setPosts((items) => items.map((p) => p.author.id === id ? { ...p, following: false } : p));
    } else {
      const { error } = await supabase.from("user_follows").insert({ follower_id: userId, following_id: id });
      if (error) notify("Could not update follow.");
      else {
        setPosts((items) => items.map((p) => p.author.id === id ? { ...p, following: true } : p));
        setPeople((items) => items.map((p) => p.id === id ? { ...p, following: true } : p));
      }
    }
  };

  const followPerson = async (id: string) => toggleFollow(id);

  const addFriend = async (id: string) => {
    if (!userId) { notify("Sign in to add friends."); return; }
    const { error } = await supabase.rpc("send_friend_request", { p_target: id });
    if (error) {
      notify(error.message.includes("Already friends") ? "You are already friends." : "Could not send friend request.");
      return;
    }
    setPeople((items) => items.map((p) => p.id === id ? { ...p, friendship: "pending" } : p));
    notify("Friend request sent.");
  };

  const toggleSave = async (id: string) => {
    if (!userId) { notify("Sign in to save posts."); return; }
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const result = post.saved
      ? await supabase.from("saved_posts").delete().eq("post_id", id).eq("user_id", userId)
      : await supabase.from("saved_posts").insert({ post_id: id, user_id: userId });
    if (result.error) notify("Could not update saved post.");
    else setPosts((items) => items.map((p) => p.id === id ? { ...p, saved: !post.saved } : p));
  };

  const addComment = async (id: string, text: string) => {
    if (!userId) { notify("Sign in to comment."); return; }
    const { error } = await supabase.from("post_comments").insert({ post_id: id, author_id: userId, body: text.trim() });
    if (error) notify("Could not post comment.");
    else { notify("Comment posted."); void loadHome(); }
  };

  const editPost = async (id: string, caption: string) => {
    if (!userId) return;
    const { error } = await supabase.from("posts").update({ body: caption.trim() }).eq("id", id).eq("author_id", userId);
    if (error) notify("Could not edit post.");
    else void loadHome();
  };

  const deletePost = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_id", userId);
    if (error) notify("Could not delete post.");
    else void loadHome();
  };

  const sharePost = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feeds/post/${id}`);
      notify("Post link copied.");
    } catch {
      notify("Could not copy post link.");
    }
  };

  const downloadPost = async (id: string, type: "image" | "video") => {
    if (!userId) { notify("Sign in to download media."); return; }
    const post = posts.find((p) => p.id === id);
    const src = type === "video" ? post?.videoUrl : post?.media[0];
    if (!src) { notify("Media is unavailable."); return; }
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matchup-${id}.${type === "video" ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await supabase.rpc("record_media_download", { p_post_id: id, p_media_type: type });
      notify(`Download ${type === "video" ? "video" : "image"} started.`);
    } catch {
      notify("Download could not be started.");
    }
  };

  const noOp = () => {};
  const openPost = (id: string) => router.push(`/feeds/post/${id}`);
  const openMedia = (id: string, index: number) => router.push(`/feeds/media/${id}?index=${index}`);

  return (
    <main className="app-shell pb-28">
      <Navigation />

      <section className="hero relative overflow-hidden rounded-[30px] px-5 py-7 sm:px-8 sm:py-9">
        <div className="relative z-10 max-w-[620px]">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#9bd3ff]">THE HOME OF FOOTBALL TOURNAMENTS</p>
          <h1 className="mt-4 max-w-[620px] text-[43px] font-black leading-[.95] tracking-[-.055em] text-white sm:text-6xl">
            Find your next <span className="hero-gradient">competition.</span>
          </h1>
          <p className="mt-4 max-w-[520px] text-sm leading-6 text-[#c8d9e9] sm:text-base">
            Create, discover and run competitive football tournaments—all in one match-ready place.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/tournaments/new" className="hero-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black text-white">
              <Trophy size={16} />Create Tournament
            </Link>
            <Link href="/tournaments" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#28547e] bg-[#071426]/70 px-5 py-3 text-xs font-black text-white transition hover:border-[#47a8ff]">
              <Search size={16} />Find Tournament
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading eyebrow="Connections" title="People You May Know" description="Connect with football players on MatchUp." href="/friends" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading players…</div> : people.length ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">{people.map((person) => <PersonCard key={person.id} person={person} onFollow={followPerson} onFriend={addFriend} />)}</div>
        ) : (
          <EmptyState icon={<Users size={23} />} title="No new player suggestions" text="There are no suitable player profiles to preview right now." href="/friends" action="Find Players" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Competition" title="Featured Tournaments" description="A quick look at public MatchUp competitions." href="/tournaments" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading tournaments…</div> : tournaments.length ? (
          <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => <div key={tournament.id} className="snap-start sm:min-w-0"><TournamentCard tournament={tournament} supabase={supabase} /></div>)}
          </div>
        ) : (
          <EmptyState icon={<Trophy size={23} />} title="No featured tournaments yet" text="Public competitions will appear here when they are available." href="/tournaments" action="Explore Tournaments" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Community" title="From the MatchUp Community" description="See what's happening around MatchUp." href="/feeds" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading community posts…</div> : posts.length ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <FeedCard
                key={post.id}
                post={post}
                onToggleLike={toggleLike}
                onToggleFollow={toggleFollow}
                onComment={addComment}
                onEditComment={noOp}
                onDeleteComment={noOp}
                onShare={sharePost}
                onDelete={deletePost}
                onEdit={editPost}
                onToggleSave={toggleSave}
                onDownload={downloadPost}
                onOpenPost={openPost}
                onOpenMedia={openMedia}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Heart size={23} />} title="No community posts yet" text="Media posts from MatchUp players will appear here." href="/feeds" action="Open Feed" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Quick Match" title="Ready Players" description="Players who are ready to connect and play." href="/ready-players" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Checking Ready Players…</div> : readyPlayers.length ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{readyPlayers.map((player) => <ReadyCard key={player.id} player={player} />)}</div>
        ) : (
          <EmptyState icon={<Zap size={23} />} title="No ready players right now" text="Ready Player availability is live. Open Ready Players to see the current pool or enable your own availability." href="/ready-players" action="Open Ready Players" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Community" title="Popular Groups" description="Find football communities and play together." href="/groups" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading groups…</div> : groups.length ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{groups.map((group) => <GroupCard key={group.id} group={group} />)}</div>
        ) : (
          <EmptyState icon={<UsersRound size={23} />} title="No groups yet" text="Football communities will appear here as groups are created." href="/groups" action="Open Groups" />
        )}
      </section>

      {toast ? <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#1e6095] bg-[#0a2139] px-5 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div> : null}
      <div className="h-6" />
    </main>
  );
}
