import { cookies } from "next/headers";

export type FootballMatch = {
  fixtureId: string;
  league: { id: number | null; name: string; logo: string | null };
  status: { code: string; label: string; elapsed: number | null; live: boolean; finished: boolean };
  startsAt: string;
  home: { id: number | null; name: string; logo: string | null; score: number | null };
  away: { id: number | null; name: string; logo: string | null; score: number | null };
};

const API_BASE = (process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io").replace(/\/$/, "");
const API_KEY = process.env.FOOTBALL_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const POPULAR_LEAGUES = new Map<number, number>([[1, 100], [2, 98], [39, 96], [140, 94], [78, 92], [135, 90], [61, 88], [94, 84], [88, 82], [253, 72], [203, 70], [179, 68], [71, 66]]);

export function getServiceRoleConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function requireProvider() {
  if (!API_KEY) throw new Error("Football data is not configured. Add FOOTBALL_API_KEY to the server environment.");
}

async function providerGet(path: string, params: Record<string, string | number>) {
  requireProvider();
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, {
    headers: { "x-apisports-key": API_KEY!, accept: "application/json" },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null) as { errors?: unknown; response?: unknown[] } | null;
  if (!response.ok || !json || !Array.isArray(json.response)) {
    const errorText = typeof json?.errors === "object" ? JSON.stringify(json.errors) : "Football provider request failed.";
    throw new Error(errorText);
  }
  return json.response as any[];
}

function normalize(raw: any): FootballMatch {
  const code = String(raw?.fixture?.status?.short || "NS");
  return {
    fixtureId: String(raw.fixture.id),
    league: {
      id: Number.isFinite(Number(raw?.league?.id)) ? Number(raw.league.id) : null,
      name: String(raw?.league?.name || "Football"),
      logo: raw?.league?.logo || null,
    },
    status: {
      code,
      label: String(raw?.fixture?.status?.long || code),
      elapsed: Number.isFinite(Number(raw?.fixture?.status?.elapsed)) ? Number(raw.fixture.status.elapsed) : null,
      live: LIVE_CODES.has(code),
      finished: FINISHED_CODES.has(code),
    },
    startsAt: new Date(raw.fixture.date).toISOString(),
    home: {
      id: Number.isFinite(Number(raw?.teams?.home?.id)) ? Number(raw.teams.home.id) : null,
      name: String(raw?.teams?.home?.name || "Home"),
      logo: raw?.teams?.home?.logo || null,
      score: Number.isFinite(Number(raw?.goals?.home)) ? Number(raw.goals.home) : null,
    },
    away: {
      id: Number.isFinite(Number(raw?.teams?.away?.id)) ? Number(raw.teams.away.id) : null,
      name: String(raw?.teams?.away?.name || "Away"),
      logo: raw?.teams?.away?.logo || null,
      score: Number.isFinite(Number(raw?.goals?.away)) ? Number(raw.goals.away) : null,
    },
  };
}

async function getCached(fixtureIds?: string[]) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Map<string, { match: FootballMatch; fetchedAt: number }>();
  const url = new URL(`${SUPABASE_URL}/rest/v1/football_fixture_cache`);
  url.searchParams.set("select", "fixture_id,payload,fetched_at");
  if (fixtureIds?.length) {
    url.searchParams.set("fixture_id", `in.(${fixtureIds.map(id => `"${id.replace(/"/g, '""')}"`).join(",")})`);
  }
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    cache: "no-store",
  });
  if (!response.ok) return new Map();
  const rows = await response.json().catch(() => []) as any[];
  return new Map(rows.map(row => [String(row.fixture_id), { match: row.payload as FootballMatch, fetchedAt: new Date(row.fetched_at).getTime() }]));
}

async function upsertCache(matches: FootballMatch[]) {
  if (!matches.length || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const rows = matches.map(match => ({
    fixture_id: match.fixtureId,
    provider: "api-football",
    payload: match,
    starts_at: match.startsAt,
    status_code: match.status.code,
    league_name: match.league.name,
    home_team_name: match.home.name,
    away_team_name: match.away.name,
    home_score: match.home.score,
    away_score: match.away.score,
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  await fetch(`${SUPABASE_URL}/rest/v1/football_fixture_cache?on_conflict=fixture_id`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
}

function rankMatch(match: FootballMatch, now = Date.now()) {
  const leagueScore = POPULAR_LEAGUES.get(match.league.id || 0) || 10;
  const liveScore = match.status.live ? 1000 : 0;
  const starts = new Date(match.startsAt).getTime();
  const hours = Math.abs(starts - now) / 3600000;
  return leagueScore + liveScore + (match.status.live ? 0 : Math.max(0, 120 - hours * 8));
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sortSearchMatches(matches: FootballMatch[], now = Date.now()) {
  return [...matches].sort((a, b) => {
    if (a.status.live !== b.status.live) return a.status.live ? -1 : 1;
    if (a.status.finished !== b.status.finished) return a.status.finished ? 1 : -1;
    if (a.status.finished && b.status.finished) {
      return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    }
    return rankMatch(b, now) - rankMatch(a, now);
  });
}

async function fetchDate(date: string) {
  return (await providerGet("/fixtures", { date, timezone: "UTC" })).map(normalize);
}

async function fetchLive() {
  return (await providerGet("/fixtures", { live: "all" })).map(normalize);
}

export async function getFeaturedMatches() {
  const now = Date.now();
  const cached = await getCached();
  const today = dateOnly(new Date(now));
  const tomorrow = dateOnly(new Date(now + 86400000));
  const horizon = now + 10 * 3600000;
  const cachedUseful = Array.from(cached.values())
    .map(entry => entry.match)
    .filter(match => (match.status.live || (!match.status.finished && new Date(match.startsAt).getTime() <= horizon)) && new Date(match.startsAt).getTime() >= now - 3 * 3600000);
  const cacheFresh = Array.from(cached.values()).some(entry => entry.fetchedAt > now - 120000);
  if (cacheFresh && cachedUseful.length) return cachedUseful.sort((a, b) => rankMatch(b, now) - rankMatch(a, now)).slice(0, 20);

  const [todayMatches, tomorrowMatches, liveMatches] = await Promise.all([fetchDate(today), fetchDate(tomorrow), fetchLive()]);
  const map = new Map<string, FootballMatch>();
  [...todayMatches, ...tomorrowMatches, ...liveMatches].forEach(match => map.set(match.fixtureId, match));
  const all = Array.from(map.values()).filter(match => {
    const start = new Date(match.startsAt).getTime();
    return match.status.live || (!match.status.finished && start >= now && start <= horizon);
  });
  await upsertCache(all);
  return all.sort((a, b) => rankMatch(b, now) - rankMatch(a, now)).slice(0, 20);
}

export async function getMatchById(fixtureId: string, forceRefresh = false) {
  const cached = await getCached([fixtureId]);
  const existing = cached.get(fixtureId);
  const ttl = existing?.match.status.live ? 45000 : 300000;
  if (!forceRefresh && existing && existing.fetchedAt > Date.now() - ttl) return existing.match;
  const rows = await providerGet("/fixtures", { id: fixtureId });
  if (!rows[0]) throw new Error("Fixture not found.");
  const match = normalize(rows[0]);
  await upsertCache([match]);
  return match;
}

export async function searchMatches(query: string) {
  const clean = query.trim().slice(0, 80);
  if (clean.length < 3) return [];

  const searchTerms = Array.from(new Set(
    clean
      .split(/\s+(?:vs|v|versus)\s+|\s+-\s+/i)
      .map(term => term.trim())
      .filter(Boolean),
  ));

  const teamResults = await Promise.all(searchTerms.map(term => providerGet("/teams", { search: term })));
  const teamCandidates = teamResults
    .flat()
    .map((item: any) => item?.team)
    .filter((team: any) => Number.isFinite(Number(team?.id)) && team?.name)
    .map((team: any) => ({
      id: Number(team.id),
      name: String(team.name),
      code: String(team.code || ""),
    }));

  const normalizedTerms = searchTerms.map(normalizeSearchText).filter(Boolean);
  const uniqueTeams = Array.from(new Map(teamCandidates.map(team => [team.id, team])).values());
  const rankedTeams = uniqueTeams.sort((a, b) => {
    const aName = normalizeSearchText(a.name);
    const bName = normalizeSearchText(b.name);
    const aExact = normalizedTerms.some(term => aName === term) ? 100 : 0;
    const bExact = normalizedTerms.some(term => bName === term) ? 100 : 0;
    const aStarts = normalizedTerms.some(term => aName.startsWith(term)) ? 20 : 0;
    const bStarts = normalizedTerms.some(term => bName.startsWith(term)) ? 20 : 0;
    return (bExact + bStarts) - (aExact + aStarts);
  });

  // Do not scope fixture retrieval by league, country, season, competition, or round.
  // Team IDs are global across competitions, so every competition involving a matched
  // team remains eligible for the search.
  const teamIds = rankedTeams.map(team => team.id).slice(0, 12);
  if (!teamIds.length) return [];

  const now = Date.now();
  const pastBoundary = now - 7 * 24 * 60 * 60 * 1000;
  const today = dateOnly(new Date(now));
  const sevenDaysAgo = dateOnly(new Date(pastBoundary));

  const fixtureGroups = await Promise.all(teamIds.map(async teamId => {
    const results: any[] = [];

    // Primary recent lookup: team + last returns recent fixtures across competitions
    // without requiring a league or season. This avoids relying on provider date-window
    // behavior for the seven-day history requirement.
    try {
      results.push(...await providerGet("/fixtures", { team: teamId, last: 20, timezone: "UTC" }));
    } catch (error) {
      console.error(`[football] recent team fixtures lookup failed for team ${teamId}`, error);
    }

    // Secondary exact-window lookup. This catches a match inside the seven-day window
    // even if the team's recent list is unusual or the provider has returned stale data.
    try {
      results.push(...await providerGet("/fixtures", {
        team: teamId,
        from: sevenDaysAgo,
        to: today,
        timezone: "UTC",
      }));
    } catch (error) {
      console.error(`[football] seven-day team fixture lookup failed for team ${teamId}`, error);
    }

    // Live lookup is deliberately global across all leagues. It is filtered locally
    // by the resolved team IDs, so no competition is excluded from live search.
    try {
      results.push(...await providerGet("/fixtures", { live: "all" }));
    } catch (error) {
      console.error(`[football] live fixture lookup failed for team ${teamId}`, error);
    }

    return results;
  }));

  const upcomingGroups = await Promise.all(teamIds.map(async teamId => {
    try {
      return await providerGet("/fixtures", { team: teamId, next: 20, timezone: "UTC" });
    } catch (error) {
      console.error(`[football] upcoming fixture lookup failed for team ${teamId}`, error);
      return [];
    }
  }));

  const resolvedTeamIds = new Set(teamIds);
  const normalizedQuery = normalizeSearchText(clean);
  const queryWords = normalizedTerms.flatMap(term => term.split(" ")).filter(Boolean);
  const matches = new Map<string, FootballMatch>();

  [...fixtureGroups.flat(), ...upcomingGroups.flat()].forEach((raw: any) => {
    const match = normalize(raw);
    const start = new Date(match.startsAt).getTime();
    const homeId = match.home.id ?? -1;
    const awayId = match.away.id ?? -1;
    const involvesResolvedTeam = resolvedTeamIds.has(homeId) || resolvedTeamIds.has(awayId);
    if (!involvesResolvedTeam) return;

    const homeName = normalizeSearchText(match.home.name);
    const awayName = normalizeSearchText(match.away.name);
    const fixtureText = `${homeName} ${awayName}`;
    const directTeamNameMatch = normalizedTerms.some(term => homeName.includes(term) || awayName.includes(term));
    const wordMatch = queryWords.length > 0 && queryWords.every(word => fixtureText.includes(word));
    const isRecentFinished = match.status.finished && start >= pastBoundary && start <= now;
    const isLive = match.status.live;
    const isUpcoming = !match.status.finished && start >= now;

    if ((directTeamNameMatch || wordMatch || fixtureText.includes(normalizedQuery)) && (isRecentFinished || isLive || isUpcoming)) {
      matches.set(match.fixtureId, match);
    }
  });

  const result = sortSearchMatches(Array.from(matches.values()), now).slice(0, 20);
  await upsertCache(result);
  return result;
}

export async function getAuthenticatedAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("matchup-access-token")?.value || null;
}

export async function getUserIdFromAccessToken(accessToken: string) {
  if (!SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null) as { id?: string } | null;
  return user?.id || null;
}

export async function callSupabaseRpc<T>(accessToken: string, functionName: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Supabase is not configured.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || payload?.hint || "Supabase request failed.");
  return payload as T;
}
