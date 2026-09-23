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
    if (a.status.finished && b.status.finished) return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
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
  const cachedUseful = Array.from(cached.values()).map(entry => entry.match).filter(match => (match.status.live || (!match.status.finished && new Date(match.startsAt).getTime() <= horizon)) && new Date(match.startsAt).getTime() >= now - 3 * 3600000);
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

async function providerGetPage(path: string, params: Record<string, string | number>) {
  requireProvider();
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, {
    headers: { "x-apisports-key": API_KEY!, accept: "application/json" },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null) as { errors?: unknown; response?: unknown[]; paging?: { total?: number } } | null;
  if (!response.ok || !json || !Array.isArray(json.response)) {
    const errorText = typeof json?.errors === "object" ? JSON.stringify(json.errors) : "Football provider request failed.";
    throw new Error(errorText);
  }
  return { rows: json.response as any[], totalPages: Math.max(1, Number(json.paging?.total || 1)) };
}

export type FootballSearchOptions = {
  query: string;
  from: string;
  to: string;
  timezone?: string;
  page?: number;
};

export type FootballSearchResult = {
  matches: FootballMatch[];
  page: number;
  totalPages: number;
  hasMore: boolean;
};

function validSearchDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function searchQueryParts(value: string) {
  return Array.from(new Set(value.split(/\s+(?:vs|v|versus)\s+|\s+-\s+/i).map(term => term.trim()).filter(Boolean)));
}

function searchNameScore(name: string, query: string) {
  const a = normalizeSearchText(name);
  const b = normalizeSearchText(query);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b)) return 80;
  if (a.includes(b)) return 60;
  return b.split(" ").every(word => a.includes(word)) ? 40 : 0;
}

async function resolveSearchTeams(query: string) {
  const result = await providerGet("/teams", { search: query });
  return Array.from(new Map(
    result.map(item => item?.team)
      .filter((team: any) => Number.isFinite(Number(team?.id)) && team?.name)
      .map((team: any) => ({ id: Number(team.id), name: String(team.name) }))
      .map(team => [team.id, team] as const)
  ).values()).sort((a, b) => searchNameScore(b.name, query) - searchNameScore(a.name, query)).slice(0, 5);
}

async function resolveSearchLeagues(query: string) {
  const result = await providerGet("/leagues", { search: query });
  return result.map(item => ({
    id: Number(item?.league?.id),
    name: String(item?.league?.name || ""),
    seasons: Array.isArray(item?.seasons) ? item.seasons : [],
  })).filter(league => Number.isFinite(league.id) && league.name)
    .sort((a, b) => searchNameScore(b.name, query) - searchNameScore(a.name, query))
    .slice(0, 3);
}

function seasonsForSearchRange(league: any, from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Array.from(new Set(
    league.seasons.filter((season: any) => {
      const seasonStart = season.start ? new Date(season.start).getTime() : -Infinity;
      const seasonEnd = season.end ? new Date(season.end).getTime() : Infinity;
      return seasonEnd >= start && seasonStart <= end;
    }).map((season: any) => Number(season.year)).filter((year: number) => Number.isFinite(year))
  )).slice(-4);
}

export async function searchMatches(options: FootballSearchOptions): Promise<FootballSearchResult> {
  const query = options.query.trim().slice(0, 80);
  const page = Math.max(1, Math.min(20, Number(options.page) || 1));
  const timezone = options.timezone || "UTC";
  const defaultFrom = dateOnly(new Date(Date.now() - 7 * 86400000));
  const defaultTo = dateOnly(new Date(Date.now() + 30 * 86400000));
  let from = validSearchDate(options.from) || defaultFrom;
  let to = validSearchDate(options.to) || defaultTo;
  const dateInQuery = query.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (dateInQuery) {
    from = dateInQuery;
    to = dateInQuery;
  }

  if (query.length < 3 || from > to) return { matches: [], page, totalPages: 1, hasMore: false };

  if (/^\d{4,20}$/.test(query)) {
    const result = await providerGetPage("/fixtures", { id: query, timezone });
    return { matches: result.rows.map(normalize), page: 1, totalPages: 1, hasMore: false };
  }

  const parts = searchQueryParts(query);
  const teamGroups = await Promise.all(parts.slice(0, 3).map(term => resolveSearchTeams(term).catch(() => [])));
  const teams = Array.from(new Map(teamGroups.flat().map(team => [team.id, team])).values());
  const selectedTeams = parts
    .map(term => teams.filter(team => searchNameScore(team.name, term) >= 60).sort((a, b) => searchNameScore(b.name, term) - searchNameScore(a.name, term))[0])
    .filter((team): team is { id: number; name: string } => Boolean(team));
  const leagueCandidates = await resolveSearchLeagues(query).catch(() => []);
  const matches = new Map<string, FootballMatch>();
  let totalPages = 1;

  if (parts.length >= 2 && selectedTeams.length >= 2) {
    const result = await providerGetPage("/fixtures", {
      h2h: `${selectedTeams[0].id}-${selectedTeams[1].id}`,
      from,
      to,
      timezone,
      page,
    });
    totalPages = Math.max(totalPages, result.totalPages);
    result.rows.map(normalize).forEach(match => matches.set(match.fixtureId, match));
  } else if (selectedTeams.length) {
    const results = await Promise.all(selectedTeams.slice(0, 5).map(team => providerGetPage("/fixtures", {
      team: team.id,
      from,
      to,
      timezone,
      page,
    })));
    results.forEach(result => {
      totalPages = Math.max(totalPages, result.totalPages);
      result.rows.map(normalize).forEach(match => matches.set(match.fixtureId, match));
    });
  }

  if (leagueCandidates.length) {
    const requests = leagueCandidates.flatMap(league =>
      seasonsForSearchRange(league, from, to).map(season =>
        providerGetPage("/fixtures", {
          league: league.id,
          season,
          from,
          to,
          timezone,
          page,
        }).catch(() => null)
      )
    );
    const results = await Promise.all(requests);
    results.forEach(result => {
      if (!result) return;
      totalPages = Math.max(totalPages, result.totalPages);
      result.rows.map(normalize).forEach(match => matches.set(match.fixtureId, match));
    });
  }

  if (!selectedTeams.length && !leagueCandidates.length) {
    const result = await providerGetPage("/fixtures", { from, to, timezone, page });
    totalPages = result.totalPages;
    result.rows.map(normalize).forEach(match => matches.set(match.fixtureId, match));
  }

  const today = dateOnly(new Date());
  if (today >= from && today <= to) {
    try {
      const live = await providerGetPage("/fixtures", { live: "all", timezone });
      live.rows.map(normalize).forEach(match => {
        const teamMatch = !selectedTeams.length || selectedTeams.some(team => team.id === match.home.id || team.id === match.away.id);
        const leagueMatch = !leagueCandidates.length || leagueCandidates.some(league => league.id === match.league.id);
        const h2hMatch = parts.length < 2 || selectedTeams.length < 2 ||
          ((match.home.id === selectedTeams[0].id && match.away.id === selectedTeams[1].id) ||
           (match.home.id === selectedTeams[1].id && match.away.id === selectedTeams[0].id));
        if (teamMatch && leagueMatch && h2hMatch) matches.set(match.fixtureId, match);
      });
    } catch (error) {
      console.error("[football] live search supplement failed", error);
    }
  }

  let result = sortSearchMatches(Array.from(matches.values()));
  const queryWords = normalizeSearchText(query).split(" ").filter(Boolean);
  result = result.filter(match => {
    const home = normalizeSearchText(match.home.name);
    const away = normalizeSearchText(match.away.name);
    const league = normalizeSearchText(match.league.name);
    const text = `${home} ${away} ${league}`;
    if (parts.length >= 2 && selectedTeams.length >= 2) {
      const ids = selectedTeams.slice(0, 2).map(team => team.id);
      return ids.includes(match.home.id || -1) && ids.includes(match.away.id || -1);
    }
    if (selectedTeams.length) return selectedTeams.some(team => team.id === match.home.id || team.id === match.away.id);
    if (leagueCandidates.length) return leagueCandidates.some(leagueItem => leagueItem.id === match.league.id);
    return queryWords.every(word => text.includes(word));
  });

  return {
    matches: result.slice(0, 20),
    page,
    totalPages: Math.max(1, totalPages),
    hasMore: page < Math.max(1, totalPages),
  };
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
