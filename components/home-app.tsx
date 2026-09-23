"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Gamepad2,
  Heart,
  Search,
  Swords,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import { Navigation } from "./navigation";
import { MatchUpAvatar } from "./ui/matchup-avatar";
import { FeedSwipeCard } from "./feeds/feed-swipe-card";
import { ProfileDiscoveryCard } from "./home/profile-discovery-card";
import { TournamentSwipeCard } from "./home/tournament-swipe-card";
import { LiveFootballHomeFeature } from "./home/live-football-feature";
import { createBrowserSupabaseClient } from "../lib/supabase/client";
import type { Author, Post } from "./feeds/data";

type Profile = {
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
  ready_player_enabled?: boolean;
  gaming_team_name?: string | null;
  player_rating?: number | null;
  squad_formation?: string | null;
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
  description?: string | null;
  game_title: string | null;
  max_players: number;
  format: string;
  prize_pool: number | null;
  starts_at: string | null;
  banner_path: string | null;
  status: string;
  organizer_id: string;
  profiles?: { display_name?: string | null; username?: string | null; avatar_path?: string | null; country?: string | null; currency_code?: string | null } | null;
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

function nameOf(p?: Profile | null) {
  return p?.display_name?.trim() || p?.username || "MatchUp Player";
}

function gameLabel(value?: string | null) {
  if (!value) return "Football";
  return /football/i.test(value) ? "Football" : value;
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

function ReadyCard({ player, onChallenge, busy }: { player: Profile; onChallenge: (id: string) => void; busy: boolean }) {
  return (
    <article className="min-w-[270px] rounded-[26px] border border-[#1b5a91] bg-[#071426] p-4 shadow-[0_18px_50px_rgba(0,40,90,.2)] sm:min-w-0">
      <div className="flex items-center gap-3">
        <MatchUpAvatar profile={player} size="lg" alt={nameOf(player)} className="!rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{nameOf(player)}</p>
          {player.gaming_team_name ? <p className="mt-1 truncate text-xs font-bold text-[#70c1ff]">{player.gaming_team_name}</p> : null}
        </div>
        {player.player_rating != null ? <div className="grid min-w-12 place-items-center rounded-xl border border-[#47a8ff] bg-[#0b3154] px-2 py-1.5"><span className="text-[8px] font-black uppercase tracking-[.1em] text-[#70c1ff]">OVR</span><span className="text-xl font-black leading-none text-white">{player.player_rating}</span></div> : null}
      </div>
      <div className="mt-4 rounded-2xl border border-[#214a78] bg-[#061426] p-3">
        {player.squad_formation ? <><p className="text-[8px] font-black uppercase tracking-[.14em] text-[#70c1ff]">Formation</p><p className="mt-1 text-lg font-black text-white">{player.squad_formation}</p></> : <p className="text-xs font-bold text-[#7892ac]">Ready to challenge</p>}
      </div>
      <button type="button" disabled={busy} onClick={()=>onChallenge(player.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-4 py-3 text-xs font-black text-white disabled:opacity-60">
        <Swords size={14} />{busy?"Sending…":"Challenge"}
      </button>
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

// DEVELOPMENT RULE — RESTORE means return the affected component to the exact approved design/state
// that existed immediately before the change that caused the problem. Never reinterpret, redesign,
// improve, approximate, or substitute a similar version when restoring.
// PROTECTED HOMEPAGE AREAS: existing approved components keep their design; requested structural moves
// must preserve the component itself. NEW HOMEPAGE AREAS are only the sections explicitly requested.
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
  const [challengeBusy, setChallengeBusy] = useState("");
  const [cancelFriendId, setCancelFriendId] = useState("");
  const [peopleLoading, setPeopleLoading] = useState(false);
  const peopleCursorRef = useRef(0);
  const peopleHasMoreRef = useRef(true);
  const peopleLoadingRef = useRef(false);
  const peopleExclusionsRef = useRef<{ uid: string; followedIds: Set<string>; relationMap: Map<string, "pending" | "friends"> }>({ uid: "", followedIds: new Set(), relationMap: new Map() });

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
      supabase.from("tournaments").select("id,name,description,game_title,max_players,format,prize_pool,starts_at,banner_path,status,entry_information,organizer_id,profiles:organizer_id(display_name,username,avatar_path,country,currency_code)").eq("visibility", "public").order("created_at", { ascending: false }).limit(40),
      supabase.from("tournament_promotions").select("tournament_id,kind,expires_at,position").order("position", { ascending: true }),
      supabase.from("profiles").select("id,username,display_name,avatar_path,cover_media_path,cover_media_type,country,bio,supported_game,is_verified,ready_player_enabled,gaming_team_name,player_rating,squad_formation,created_at", { count: "exact" }).neq("id", uid || "00000000-0000-0000-0000-000000000000").order("created_at", { ascending: false }).range(0, 39),
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
      else if (!relationMap.has(other)) relationMap.set(other, "pending");
    });

    peopleExclusionsRef.current = { uid, followedIds, relationMap };

    const hydratePeople = async (profiles: Profile[]) => {
      // People You May Know excludes only the current user and accepted friends.
      // Pending requests remain visible until they are accepted, so they can still
      // be discovered and handled by the existing friend-request flow.
      const eligible = profiles.filter((p) => p.id !== uid && relationMap.get(p.id) !== "friends");
      return Promise.all(eligible.map(async (p) => {
        const [{ count: followerCount }, { count: postCount }] = await Promise.all([
          supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", p.id),
          supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", p.id),
        ]);
        return { ...p, followerCount: followerCount || 0, postCount: postCount || 0, following: false, friendship: (relationMap.get(p.id) || "none") as "pending" | "friends" | "none" };
      }));
    };

    let discoveryRows = allProfiles;
    let discoveryCursor = allProfiles.length;
    const profileTotal = profilesResult.count ?? allProfiles.length;
    let discoveryHasMore = discoveryCursor < profileTotal;
    const discovered = new Map<string, PersonPreview>();

    // Always evaluate the first fetched page, even when fewer than 40 profiles exist.
    // Only fetch another page after the current page has been filtered.
    while (true) {
      const eligible = await hydratePeople(discoveryRows);
      eligible.forEach((p) => discovered.set(p.id, p));
      if (discovered.size >= 10 || !discoveryHasMore) break;

      const { data: nextRows, error: nextError } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_path,cover_media_path,cover_media_type,country,bio,supported_game,is_verified,ready_player_enabled,gaming_team_name,player_rating,squad_formation,created_at")
        .order("created_at", { ascending: false })
        .range(discoveryCursor, discoveryCursor + 39);
      if (nextError) throw nextError;

      discoveryRows = (nextRows || []) as Profile[];
      discoveryCursor += discoveryRows.length;
      discoveryHasMore = discoveryCursor < profileTotal;
      if (!discoveryRows.length) break;
    }

    peopleCursorRef.current = discoveryCursor;
    peopleHasMoreRef.current = discoveryHasMore;
    setPeople(Array.from(discovered.values()));

    const rawPosts = postsResult.data || [];
    const postIds = rawPosts.map((p: any) => p.id);
    const [{ data: mediaRows }, { data: likeRows }, { data: commentRows }, { data: savedRows }] = await Promise.all([
      postIds.length ? supabase.from("post_media").select("post_id,storage_path,media_type,position").in("post_id", postIds).order("position") : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("post_likes").select("post_id,user_id,created_at").in("post_id", postIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from("post_comments").select("id,post_id,author_id,body,created_at").in("post_id", postIds).order("created_at",{ascending:true}) : Promise.resolve({ data: [] }),
      uid && postIds.length ? supabase.from("saved_posts").select("post_id").eq("user_id", uid).in("post_id", postIds) : Promise.resolve({ data: [] }),
    ]);
    const commentAuthorIds = Array.from(new Set((commentRows || []).map((r: any) => r.author_id)));
    const authorIds = Array.from(new Set([...rawPosts.map((p: any) => p.author_id), ...commentAuthorIds]));
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
    const commentsByPost = new Map<string, any[]>();
    (commentRows || []).forEach((r: any) => { commentCounts.set(r.post_id, (commentCounts.get(r.post_id) || 0) + 1); const list = commentsByPost.get(r.post_id) || []; list.push(r); commentsByPost.set(r.post_id, list); });
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
        commentList: (commentsByPost.get(p.id) || []).map((comment: any) => { const cp = profileMap.get(comment.author_id); return { id: comment.id, author: nameOf(cp), authorId: comment.author_id, text: comment.body, time: relativeTime(comment.created_at), isOwn: uid ? comment.author_id === uid : false }; }),
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
        gaming_team_name: p.gaming_team_name || null,
        player_rating: p.player_rating ?? null,
        squad_formation: p.squad_formation || null,
      } as Profile));
    setReadyPlayers(readyRows.slice(0, 4));

    const memberCounts = new Map<string, number>();
    (groupMembersResult.data || []).forEach((m: any) => memberCounts.set(m.group_id, (memberCounts.get(m.group_id) || 0) + 1));
    setGroups(((groupsResult.data || []) as any[])
      .map((g) => ({ id: g.id, name: g.name, image_path: g.image_path, memberCount: memberCounts.get(g.id) || 0 }))
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 3));

    setLoading(false);
  }, [supabase]);

  const loadMorePeople = useCallback(async () => {
    if (!peopleHasMoreRef.current || peopleLoadingRef.current) return;
    peopleLoadingRef.current = true;
    setPeopleLoading(true);
    try {
      const { uid, relationMap } = peopleExclusionsRef.current;
      const existing = new Set(people.map((p) => p.id));
      let additions: PersonPreview[] = [];

      while (peopleHasMoreRef.current && additions.length < 10) {
        const start = peopleCursorRef.current;
        const { data, error, count } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_path,cover_media_path,cover_media_type,country,bio,supported_game,is_verified,ready_player_enabled,gaming_team_name,player_rating,squad_formation,created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(start, start + 39);

        if (error) throw error;
        const rows = (data || []) as Profile[];
        peopleCursorRef.current = start + rows.length;
        peopleHasMoreRef.current = peopleCursorRef.current < (count ?? peopleCursorRef.current);
        if (!rows.length) break;

        const eligible = rows.filter((p) => p.id !== uid && relationMap.get(p.id) !== "friends" && !existing.has(p.id));
        const hydrated = await Promise.all(eligible.map(async (p) => {
          const [{ count: followerCount }, { count: postCount }] = await Promise.all([
            supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", p.id),
            supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", p.id),
          ]);
          return { ...p, followerCount: followerCount || 0, postCount: postCount || 0, following: false, friendship: (relationMap.get(p.id) || "none") as "pending" | "friends" | "none" };
        }));
        hydrated.forEach((p) => { existing.add(p.id); additions.push(p); });
      }

      if (additions.length) setPeople((current) => [...current, ...additions]);
    } catch {
      notify("Could not load more player suggestions.");
    } finally {
      peopleLoadingRef.current = false;
      setPeopleLoading(false);
    }
  }, [notify, people, supabase]);

  useEffect(() => {
    void loadHome();
    const channel = supabase.channel("matchup-home-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadHome())
      .on("postgres_changes", { event: "*", schema: "public", table: "ready_match_presence" }, () => void loadHome())
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

  const challengeReady = async (id: string) => {
    if (!userId) { notify("Sign in to challenge players."); return; }
    setChallengeBusy(id);
    const { error } = await supabase.rpc("send_match_request", { p_opponent_id: id });
    if (error) notify(error.message || "Could not send challenge.");
    else notify("Challenge sent.");
    setChallengeBusy("");
  };

  const addFriend = async (id: string) => {
    if (!userId) { notify("Sign in to add friends."); return; }
    const current = people.find((p) => p.id === id);
    if (current?.friendship === "pending") {
      setCancelFriendId(id);
      return;
    }
    const { error } = await supabase.rpc("send_friend_request", { p_target: id });
    if (error) {
      notify(error.message.includes("Already friends") ? "You are already friends." : "Could not send friend request.");
      return;
    }
    setPeople((items) => items.map((p) => p.id === id ? { ...p, friendship: "pending" } : p));
    notify("Friend request sent.");
  };

  const cancelFriendRequest = async () => {
    if (!cancelFriendId) return;
    const id = cancelFriendId;
    setCancelFriendId("");
    const { error } = await supabase.rpc("cancel_friend_request", { p_target: id });
    if (error) {
      notify("Could not cancel friend request.");
      return;
    }
    setPeople((items) => items.map((p) => p.id === id ? { ...p, friendship: "none" } : p));
    notify("Friend request cancelled.");
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

      <LiveFootballHomeFeature />

      <section className="mt-8">
        <SectionHeading eyebrow="Competition" title="Featured Tournaments" description="A quick look at public MatchUp competitions." href="/tournaments" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading tournaments…</div> : tournaments.length ? (
          <TournamentSwipeCard tournaments={tournaments.slice(0, 3)} />
        ) : (
          <EmptyState icon={<Trophy size={23} />} title="No featured tournaments yet" text="Public competitions will appear here when they are available." href="/tournaments" action="Explore Tournaments" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Quick Match" title="Ready Players" description="Players who are ready to connect and play." href="/ready-players" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Checking Ready Players…</div> : readyPlayers.length ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{readyPlayers.map((player) => <ReadyCard key={player.id} player={player} onChallenge={challengeReady} busy={challengeBusy===player.id} />)}</div>
        ) : (
          <EmptyState icon={<Zap size={23} />} title="No ready players right now" text="Ready Player availability is live. Open Ready Players to see the current pool or enable your own availability." href="/ready-players" action="Open Ready Players" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Community" title="For You" description="Posts and football moments from the MatchUp community." href="/feeds" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading community posts…</div> : posts.length ? (
          <FeedSwipeCard
            posts={posts}
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
        ) : (
          <EmptyState icon={<Heart size={23} />} title="No community posts yet" text="Media posts from MatchUp players will appear here." href="/feeds" action="Open Feed" />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Connections" title="People You May Know" description="Connect with football players on MatchUp." href="/friends" />
        {loading ? (
          <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading players…</div>
        ) : (
          <ProfileDiscoveryCard
            people={people}
            onFriend={addFriend}
            notify={notify}
            onNeedMore={loadMorePeople}
            peopleLoading={peopleLoading}
            peopleHasMore={peopleHasMoreRef.current}
          />
        )}
      </section>

      <section className="mt-9">
        <SectionHeading eyebrow="Community" title="Groups & Communities" description="Find football communities and play together." href="/groups" />
        {loading ? <div className="surface-card p-8 text-center text-sm text-[#7892ac]">Loading groups…</div> : groups.length ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">{groups.map((group) => <GroupCard key={group.id} group={group} />)}</div>
        ) : (
          <EmptyState icon={<UsersRound size={23} />} title="No groups yet" text="Football communities will appear here as groups are created." href="/groups" action="Open Groups" />
        )}
      </section>

      {cancelFriendId ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setCancelFriendId("")}>
          <section className="w-full max-w-sm rounded-[26px] border border-[#245b91] bg-[#08182b] p-5 shadow-[0_24px_80px_rgba(0,0,0,.6)]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#47a8ff]">Friend request</p>
            <h2 className="mt-1 text-xl font-black text-white">Do you want to cancel request?</h2>
            <p className="mt-2 text-sm leading-6 text-[#7892ac]">The pending request will be removed for both sides.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCancelFriendId("")} className="rounded-xl border border-[#214a78] bg-[#071426] px-4 py-3 text-sm font-black text-[#b7c9da]">Keep Request</button>
              <button type="button" onClick={() => void cancelFriendRequest()} className="rounded-xl bg-[#167bd1] px-4 py-3 text-sm font-black text-white">Cancel Request</button>
            </div>
          </section>
        </div>
      ) : null}
      {toast ? <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#1e6095] bg-[#0a2139] px-5 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div> : null}
      <div className="h-6" />
    </main>
  );
}