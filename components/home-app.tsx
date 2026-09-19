"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Gamepad2,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  UsersRound,
  Video,
  Zap,
} from "lucide-react";
import { Navigation } from "./navigation";
import { MatchUpAvatar } from "./ui/matchup-avatar";
import { MatchUpVerificationBadge } from "./feeds/matchup-verification-badge";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
  supported_game?: string | null;
  is_verified?: boolean;
  ready_player_enabled?: boolean;
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
  organizer_id?: string;
  promotion_kind?: string | null;
  teams?: number;
  venue?: string | null;
};

type FeedPreview = {
  id: string;
  author: Profile;
  caption: string;
  created_at: string;
  media: { url: string; type: "image" | "video" }[];
  liked: boolean;
  saved: boolean;
  likes: number;
  comments: number;
  likeAvatars: Profile[];
};

type PersonPreview = Profile & {
  previewImage: string | null;
  following: boolean;
};

type ReadyPlayer = Profile;

type GroupPreview = {
  id: string;
  name: string;
  image_path: string | null;
  memberCount: number;
};

const fallbackHero = "/1002371685.jpg";

function nameOf(p?: Profile | null) {
  return p?.display_name || p?.username || "MatchUp Player";
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

function publicStorageUrl(supabase: ReturnType<typeof createBrowserSupabaseClient>, bucket: string, path: string | null) {
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
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#214a78] bg-[#071426] px-3 py-2 text-[11px] font-black text-[#bfe3ff] transition hover:border-[#47a8ff] hover:text-white">
        See All <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function EmptyState({ icon, title, text, href, action }: { icon: ReactNode; title: string; text: string; href?: string; action?: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#214a78] bg-[#071426] p-7 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#0b3154] text-[#70c1ff]">{icon}</span>
      <p className="mt-3 font-black text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-[#7892ac]">{text}</p>
      {href && action ? <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black text-white">{action}<ArrowRight size={14} /></Link> : null}
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const prize = formatMoney(tournament.prize_pool);
  const date = formatDate(tournament.starts_at);
  const banner = tournament.banner_path || fallbackHero;

  return (
    <article className="group min-w-[290px] overflow-hidden rounded-[26px] border border-[#1b4775] bg-[#071426] shadow-[0_18px_55px_rgba(0,45,90,.18)] sm:min-w-0">
      <Link href={`/tournaments/${tournament.id}`} className="block">
        <div className="relative h-40 overflow-hidden bg-[#0a2139]">
          <img src={publicStorageUrl(createBrowserSupabaseClient(), "tournament-media", banner) || banner} alt="" className="absolute inset-0 size-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,22,.12),rgba(3,12,22,.9))]" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#4b8dc2] bg-[#061a2d]/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-[#bfe3ff]">⚽ Football</span>
            {tournament.status === "in_progress" ? <span className="rounded-full border border-[#35c58a]/50 bg-[#123a2c]/90 px-2.5 py-1 text-[10px] font-black uppercase text-[#7bf0b9]">LIVE</span> : null}
          </div>
          <div className="absolute inset-x-4 bottom-3">
            <p className="truncate text-lg font-black text-white">{tournament.name}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#b7c9da]">{tournament.game_title || "Football"} · {formatLabel(tournament.format)}</p>
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {tournament.teams ? <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#b7c9da]"><Users size={11} className="mr-1 inline" />{tournament.teams} teams</span> : null}
            <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#b7c9da]">{formatLabel(tournament.format)}</span>
            <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#b7c9da]">{tournament.status === "open" ? "Registration Open" : formatLabel(tournament.status)}</span>
            {tournament.venue ? <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#b7c9da]">{tournament.venue}</span> : null}
          </div>

          <div className="mt-4 rounded-2xl border border-[#5a4a20] bg-[linear-gradient(135deg,#1a1b19,#15120a)] px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] font-black tracking-[.15em] text-[#ffca4d]"><Trophy size={14} /> PRIZE POOL</div>
            <p className="mt-1 text-xl font-black text-white">{prize || "No Prize Pool"}</p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#86a1bb]">
            <span className="flex items-center gap-1.5">{date ? <><CalendarDays size={13} />{date}</> : "Date TBA"}</span>
            {tournament.entry_information ? <span className="max-w-[50%] truncate">{tournament.entry_information}</span> : null}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-black text-[#bfe3ff]">View Tournament</span>
            <span className="grid size-9 place-items-center rounded-xl bg-[#126bc0] text-white"><ArrowRight size={16} /></span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function PersonCard({ person, onFollow }: { person: PersonPreview; onFollow: (id: string) => void }) {
  const name = nameOf(person);
  return (
    <article className="min-w-[250px] overflow-hidden rounded-[25px] border border-[#1b4775] bg-[#071426] p-4 shadow-[0_16px_45px_rgba(0,35,70,.16)] sm:min-w-[270px]">
      <div className="flex items-start justify-between gap-3">
        <div className="relative">
          <div className="grid size-16 place-items-center overflow-hidden rounded-full border-2 border-[#d9a735] bg-[#0b3154]">
            <MatchUpAvatar profile={person} size="lg" alt={name} className="!size-full !rounded-full" />
          </div>
          {person.is_verified ? <span className="absolute -bottom-1 -right-1"><MatchUpVerificationBadge /></span> : null}
        </div>
        {person.supported_game ? <span className="rounded-full border border-[#6a5421] bg-[#1a170d] px-2.5 py-1 text-[10px] font-black text-[#ffca4d]">{person.supported_game}</span> : null}
      </div>
      <p className="mt-4 truncate text-base font-black text-white">{name}</p>
      <p className="mt-1 truncate text-xs text-[#7892ac]">@{person.username || "player"}</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#153c68] bg-[#0a1b2f]">
        {person.previewImage ? <img src={person.previewImage} alt="" className="h-24 w-full object-cover" /> : <div className="flex h-24 items-center justify-center text-[#355879]"><ImageIcon size={25} /></div>}
      </div>
      <button type="button" onClick={() => onFollow(person.id)} className={`mt-3 w-full rounded-xl px-4 py-2.5 text-xs font-black ${person.following ? "border border-[#285277] bg-[#0a2139] text-[#b7c9da]" : "bg-[#167bd1] text-white"}`}>
        {person.following ? "Unfollow" : "Follow"}
      </button>
    </article>
  );
}

function FeedPreviewCard({
  post,
  onLike,
  onSave,
  onShare,
}: {
  post: FeedPreview;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (id: string) => void;
}) {
  const first = post.media[0];
  const hashtags = Array.from(post.caption.matchAll(/#[\p{L}\p{N}_-]+/gu)).map((m) => m[0]).slice(0, 5);
  return (
    <article className="overflow-hidden rounded-[26px] border border-[#1b4775] bg-[#071426] shadow-[0_18px_55px_rgba(0,35,70,.16)]">
      <div className="flex items-center gap-3 p-4">
        <MatchUpAvatar profile={post.author} size="md" alt={nameOf(post.author)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-black text-white">{nameOf(post.author)}</p>
            {post.author.is_verified ? <MatchUpVerificationBadge /> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#7892ac]">
            <span>{relativeTime(post.created_at)}</span>
            {post.author.supported_game ? <><span>•</span><span>{post.author.supported_game}</span></> : null}
          </div>
        </div>
        <button type="button" onClick={() => window.location.href = `/feeds/post/${post.id}`} aria-label="Open post" className="grid size-9 place-items-center rounded-full text-[#7892ac] hover:bg-[#0a2139]"><MoreHorizontal size={19} /></button>
      </div>

      <Link href={`/feeds/media/${post.id}?index=0`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#061120]">
          {first?.type === "video" ? <video src={first.url} muted playsInline preload="metadata" className="size-full object-cover" /> : first ? <img src={first.url} alt="" className="size-full object-cover" /> : null}
          {post.media.length > 1 ? <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-black text-white">{post.media.length} media</span> : null}
        </div>
      </Link>

      <div className="p-4 pt-3">
        <p className="text-sm leading-6 text-[#d8e5f0]">{post.caption}</p>
        {hashtags.length ? <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-[#76b9ee]">{hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#214a78] bg-[#08182b] p-2">
          <button type="button" onClick={() => onLike(post.id)} className={`flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${post.liked ? "bg-[#3b1424] text-[#ff4d75]" : "text-[#c2d1df] hover:bg-[#0b223c]"}`}>
            <Heart size={18} fill={post.liked ? "currentColor" : "none"} />{post.likes}
          </button>
          <Link href={`/feeds/post/${post.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-[#c2d1df] hover:bg-[#0b223c]">
            <MessageCircle size={18} />{post.comments}
          </Link>
          <button type="button" onClick={() => onShare(post.id)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-[#c2d1df] hover:bg-[#0b223c]">
            <Share2 size={18} />Share
          </button>
          <button type="button" onClick={() => onSave(post.id)} className={`ml-auto grid size-10 shrink-0 place-items-center rounded-xl ${post.saved ? "bg-[#16385a] text-[#70c1ff]" : "text-[#c2d1df] hover:bg-[#0b223c]"}`} aria-label={post.saved ? "Unsave post" : "Save post"}>
            <Save size={18} fill={post.saved ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-[#7892ac]">
          <div className="flex -space-x-2">
            {post.likeAvatars.slice(0, 3).map((p) => <MatchUpAvatar key={p.id} profile={p} size="sm" alt={nameOf(p)} className="!size-7 !rounded-full border-2 border-[#071426]" />)}
          </div>
          {post.likes ? <span>Liked by {post.likes} {post.likes === 1 ? "person" : "people"}</span> : <span>No likes yet</span>}
          <span className="ml-auto flex shrink-0 items-center gap-1"><Clock3 size={13} />{relativeTime(post.created_at)}</span>
        </div>
      </div>
    </article>
  );
}

function ReadyCard({ player }: { player: ReadyPlayer }) {
  return (
    <article className="min-w-[245px] rounded-[24px] border border-[#1b4775] bg-[#071426] p-4 sm:min-w-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <MatchUpAvatar profile={player} size="lg" alt={nameOf(player)} className="!rounded-full" />
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#071426] bg-[#35c58a]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{nameOf(player)}</p>
          <p className="mt-1 text-xs text-[#35c58a]">Ready to play</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {player.supported_game ? <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#b7c9da]"><Gamepad2 size={11} className="mr-1 inline" />{player.supported_game}</span> : null}
        <span className="rounded-full border border-[#245f55] bg-[#0b2a24] px-2.5 py-1 text-[10px] font-black text-[#72e6b3]">READY</span>
      </div>
      <Link href="/ready-players" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-4 py-2.5 text-xs font-black text-white"><Swords size={14} />Challenge</Link>
    </article>
  );
}

function GroupCard({ group }: { group: GroupPreview }) {
  return (
    <Link href={`/leaderboard?group=${group.id}`} className="min-w-[250px] rounded-[24px] border border-[#1b4775] bg-[#071426] p-4 transition hover:border-[#47a8ff] sm:min-w-0">
      <div className="flex items-center gap-3">
        <MatchUpAvatar group profile={{ id: group.id, display_name: group.name, avatar_path: group.image_path, username: null }} size="lg" alt={group.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{group.name}</p>
          <p className="mt-1 text-xs text-[#7892ac]">{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full border border-[#214a78] bg-[#0a2139] px-2.5 py-1 text-[10px] font-black text-[#b7c9da]">⚽ FOOTBALL COMMUNITY</span>
        <ArrowRight size={15} className="text-[#70c1ff]" />
      </div>
    </Link>
  );
}

export function HomeApp() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [userId, setUserId] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [people, setPeople] = useState<PersonPreview[]>([]);
  const [posts, setPosts] = useState<FeedPreview[]>([]);
  const [readyPlayers, setReadyPlayers] = useState<ReadyPlayer[]>([]);
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
      postsResult,
      readyResult,
      groupsResult,
      groupMembersResult,
    ] = await Promise.all([
      supabase.from("tournaments").select("id,name,game_title,max_players,format,prize_pool,starts_at,banner_path,status,entry_information,organizer_id").eq("visibility", "public").order("created_at", { ascending: false }).limit(30),
      supabase.from("tournament_promotions").select("tournament_id,kind,expires_at,position").order("position", { ascending: true }),
      supabase.from("profiles").select("id,username,display_name,avatar_path,supported_game,is_verified,ready_player_enabled").neq("id", uid || "00000000-0000-0000-0000-000000000000").order("created_at", { ascending: false }).limit(30),
      uid ? supabase.from("user_follows").select("following_id").eq("follower_id", uid) : Promise.resolve({ data: [] as { following_id: string }[] }),
      supabase.from("posts").select("id,author_id,body,created_at").order("created_at", { ascending: false }).limit(40),
      supabase.rpc("get_ready_players"),
      supabase.from("chat_groups").select("id,name,image_path,kind,archived_at,created_at").eq("kind", "group").is("archived_at", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("chat_group_members").select("group_id,user_id").limit(2000),
    ]);

    const promotions = promotionsResult.data || [];
    const activePromotions = new Map<string, { kind: string; position: number }>();
    promotions.forEach((p: any) => {
      if (new Date(p.expires_at).getTime() > Date.now() && !activePromotions.has(p.tournament_id)) activePromotions.set(p.tournament_id, { kind: p.kind, position: p.position ?? 999 });
    });

    const tournamentRows = (tournamentsResult.data || []).map((t: any) => ({ ...t, promotion_kind: activePromotions.get(t.id)?.kind || null })).filter((t: any) => t.status !== "cancelled");
    const boosted = tournamentRows.filter((t: any) => t.promotion_kind === "boost" || t.promotion_kind === "pin");
    const promoted = tournamentRows.filter((t: any) => t.promotion_kind === "featured" || t.promotion_kind === "promoted");
    const featuredRows = [...boosted, ...promoted, ...tournamentRows.filter((t: any) => !t.promotion_kind && ["open", "in_progress", "full"].includes(t.status))].slice(0, 3);

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

    const rawPosts = postsResult.data || [];
    const postIds = rawPosts.map((p: any) => p.id);
    const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.author_id)));
    const [{ data: mediaRows }, { data: likeRows }, { data: commentRows }, { data: savedRows }] = await Promise.all([
      postIds.length ? supabase.from("post_media").select("post_id,storage_path,media_type,position").in("post_id", postIds).order("position") : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("post_likes").select("post_id,user_id,created_at").in("post_id", postIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("post_comments").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [] }),
      uid && postIds.length ? supabase.from("saved_posts").select("post_id").eq("user_id", uid).in("post_id", postIds) : Promise.resolve({ data: [] }),
    ]);

    const likeUserIds = Array.from(new Set((likeRows || []).map((r: any) => r.user_id)));
    const postAuthorIds = Array.from(new Set([...authorIds, ...likeUserIds]));
    const { data: postProfiles } = postAuthorIds.length
      ? await supabase.from("profiles").select("id,username,display_name,avatar_path,supported_game,is_verified").in("id", postAuthorIds)
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

    const feed = rawPosts.map((p: any) => {
      const author = profileMap.get(p.author_id);
      const media = mediaMap.get(p.id) || [];
      return {
        id: p.id,
        author: author || { id: p.author_id, username: null, display_name: null, avatar_path: null },
        caption: p.body || "",
        created_at: p.created_at,
        media,
        liked: likedIds.has(p.id),
        saved: savedIds.has(p.id),
        likes: (likesByPost.get(p.id) || []).length,
        comments: commentCounts.get(p.id) || 0,
        likeAvatars: (likesByPost.get(p.id) || []).slice(-4).reverse().map((r: any) => profileMap.get(r.user_id)).filter(Boolean),
      } as FeedPreview;
    }).filter((p) => p.media.length > 0).slice(0, 6);
    setPosts(feed);

    const postPreviewByAuthor = new Map<string, string>();
    feed.forEach((p) => { if (p.media[0] && !postPreviewByAuthor.has(p.author.id)) postPreviewByAuthor.set(p.author.id, p.media[0].url); });
    const candidatePeople = allProfiles.filter((p) => !followedIds.has(p.id)).slice(0, 6);
    setPeople(candidatePeople.slice(0, 3).map((p) => ({ ...p, following: false, previewImage: postPreviewByAuthor.get(p.id) || null })));

    setReadyPlayers(((readyResult.data || []) as ReadyPlayer[]).filter((p) => p.id !== uid).slice(0, 3));

    const memberCounts = new Map<string, number>();
    (groupMembersResult.data || []).forEach((m: any) => memberCounts.set(m.group_id, (memberCounts.get(m.group_id) || 0) + 1));
    setGroups(((groupsResult.data || []) as any[]).map((g) => ({ id: g.id, name: g.name, image_path: g.image_path, memberCount: memberCounts.get(g.id) || 0 })).sort((a, b) => b.memberCount - a.memberCount).slice(0, 3));

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadHome();
    const channel = supabase.channel("matchup-home-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_follows" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => void loadHome())
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

  const sharePost = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feeds/post/${id}`);
      notify("Post link copied.");
    } catch {
      notify("Could not copy post link.");
    }
  };

  const followPerson = async (id: string) => {
    if (!userId) { notify("Sign in to follow players."); return; }
    const person = people.find((p) => p.id === id);
    if (!person) return;
    const result = person.following
      ? await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", id)
      : await supabase.from("user_follows").insert({ follower_id: userId, following_id: id });
    if (result.error) notify("Could not update follow.");
    else {
      setPeople((items) => items.map((p) => p.id === id ? { ...p, following: !person.following } : p));
      notify(person.following ? "Unfollowed." : "Following.");
    }
  };

  return (
    <main className="app-shell pb-28">
      <Navigation />

      <section className="hero relative overflow-hidden rounded-[30px] px-5 pb-8 pt-6 sm:px-8 sm:pb-12 sm:pt-9">
        <div className="hero-player" aria-hidden="true" />
        <div className="relative z-10 max-w-[600px]">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d4e8fb]">THE MATCHUP FOOTBALL HUB</p>
          <h1 className="mt-4 max-w-[620px] text-[43px] font-black leading-[.95] tracking-[-.055em] text-white sm:text-6xl">Find your next <span className="hero-gradient">competition.</span></h1>
          <p className="mt-4 max-w-[520px] text-sm leading-6 text-[#c8d9e9] sm:text-base">Create, discover and run competitive football tournaments—all in one match-ready place.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/tournaments/new" className="hero-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black text-white"><Trophy size={16} />Create Tournament</Link>
            <Link href="/tournaments" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#28547e] bg-[#071426]/70 px-5 py-3 text-xs font-black text-white transition hover:border-[#47a8ff]"><Search size={16} />Find Tournament</Link>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading eyebrow="Connections" title="People You May Know" description="Connect with football players on MatchUp." href="/friends" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading players…</div> : people.length ? <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">{people.map((person) => <PersonCard key={person.id} person={person} onFollow={followPerson} />)}</div> : <EmptyState icon={<Users size={23} />} title="No new player suggestions" text="There are no suitable player profiles to preview right now." href="/friends" action="Find Players" />}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Competition" title="Featured Tournaments" description="A quick look at public MatchUp competitions." href="/tournaments" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading tournaments…</div> : tournaments.length ? <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{tournaments.map((t) => <TournamentCard key={t.id} tournament={t} />)}</div> : <EmptyState icon={<Trophy size={23} />} title="No featured tournaments yet" text="Public competitions will appear here when they are available." href="/tournaments" action="Explore Tournaments" />}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Community" title="From the MatchUp Community" description="See what's happening around MatchUp." href="/feeds" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading community posts…</div> : posts.length ? <div className="space-y-4">{posts.map((post) => <FeedPreviewCard key={post.id} post={post} onLike={toggleLike} onSave={toggleSave} onShare={sharePost} />)}</div> : <EmptyState icon={<ImageIcon size={23} />} title="No community posts yet" text="Media posts from MatchUp players will appear here." href="/feeds" action="Open Feed" />}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Quick Match" title="Ready Players" description="Players who are ready to connect and play." href="/ready-players" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Checking Ready Players…</div> : readyPlayers.length ? <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{readyPlayers.map((player) => <ReadyCard key={player.id} player={player} />)}</div> : <EmptyState icon={<Zap size={23} />} title="No ready players right now" text="Ready Player availability is live. Open Ready Players to see the current pool or enable your own availability." href="/ready-players" action="Open Ready Players" />}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Community" title="Popular Groups" description="Find football communities and play together." href="/groups" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading groups…</div> : groups.length ? <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{groups.map((group) => <GroupCard key={group.id} group={group} />)}</div> : <EmptyState icon={<UsersRound size={23} />} title="No groups yet" text="Football communities will appear here as groups are created." href="/groups" action="Open Groups" />}
      </section>

      <section className="mt-9 rounded-[26px] border border-[#183d64] bg-[#071426] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0b3154] text-[#70c1ff]"><ShieldCheck size={22} /></span>
          <div className="min-w-0"><p className="text-sm font-black text-white">Everything happening on MatchUp</p><p className="mt-1 text-xs leading-5 text-[#7892ac]">Tournaments, players, community posts, Ready Players and groups are all connected through the real MatchUp data.</p></div>
        </div>
      </section>

      {toast ? <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#1e6095] bg-[#0a2139] px-5 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div> : null}
      <div className="h-6" />
    </main>
  );
}
