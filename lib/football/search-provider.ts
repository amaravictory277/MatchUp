import type { FootballMatch } from "./server";

const API_BASE = (process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io").replace(/\/$/, "");
const API_KEY = process.env.FOOTBALL_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

type ProviderPage = {
  rows: any[];
  current: number;
  total: number;
};

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

function cleanText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function normalize(raw: any): FootballMatch {
  const code = String(raw?.fixture?.status?.short || "NS");
  return {
    fixtureId: String(raw?.fixture?.id),
    league: { id: Number.isFinite(Number(raw?.league?.id)) ? Number(raw.league.id) : null, name: String(raw?.league?.name || "Football"), logo: raw?.league?.logo || null },
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

async function providerGet(path: string, params: Record<string, string | number>): Promise<ProviderPage> {
  if (!API_KEY) throw new Error("Football provider is not configured.");
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, {
    headers: { "x-apisports-key": API_KEY, accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.text();
  let json: any = null;
  try { json = body ? JSON.parse(body) : null; } catch { json = null; }
  const providerErrors = json?.errors && typeof json.errors === "object" ? JSON.stringify(json.errors) : "";
  if (!response.ok || !Array.isArray(json?.response)) {
    throw new Error(`API-Football ${response.status}: ${providerErrors || body.slice(0, 240) || "invalid provider response"}`);
  }
  return {
    rows: json.response,
    current: Number(json?.paging?.current || params.page || 1),
    total: Math.max(1, Number(json?.paging?.total || 1)),
  };
}

async function providerAll(path: string, params: Record<string, string | number>, maxPages = 8) {
  const first = await providerGet(path, { ...params, page: 1 });
  const rows = [...first.rows];
  const totalPages = Math.min(first.total, maxPages);
  for (let page = 2; page <= totalPages; page++) {
    const next = await providerGet(path, { ...params, page });
    rows.push(...next.rows);
  }
  return { rows, totalPages };
}

async function readCache(query: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [] as Array<{ match: FootballMatch; fetchedAt: number }>;
  const safe = query.replace(/[,*()]/g, " ");
  const url = new URL(`${SUPABASE_URL}/rest/v1/football_fixture_cache`);
  url.searchParams.set("select", "payload,fetched_at");
  url.searchParams.set("or", `(home_team_name.ilike.*${safe}*,away_team_name.ilike.*${safe}*,league_name.ilike.*${safe}*)`);
  url.searchParams.set("order", "starts_at.asc");
  url.searchParams.set("limit", "200");
  const response = await fetch(url, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, cache: "no-store" });
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []) as Array<{ payload?: FootballMatch; fetched_at?: string }>;
  return rows.map(row => ({ match: row.payload!, fetchedAt: row.fetched_at ? new Date(row.fetched_at).getTime() : 0 })).filter(row => Boolean(row.match?.fixtureId));
}

async function writeCache(matches: FootballMatch[]) {
  if (!matches.length || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const now = new Date().toISOString();
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
    fetched_at: now,
    updated_at: now,
  }));
  await fetch(`${SUPABASE_URL}/rest/v1/football_fixture_cache?on_conflict=fixture_id`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
}

function sortMatches(matches: FootballMatch[], now = Date.now()) {
  return [...new Map(matches.map(match => [match.fixtureId, match])).values()].sort((a, b) => {
    if (a.status.live !== b.status.live) return a.status.live ? -1 : 1;
    if (a.status.finished !== b.status.finished) return a.status.finished ? 1 : -1;
    if (a.status.finished && b.status.finished) return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

function queryParts(value: string) {
  return Array.from(new Set(value.split(/\s+(?:vs|v|versus)\s+|\s+-\s+/i).map(part => part.trim()).filter(Boolean)));
}

function teamScore(name: string, term: string) {
  const n = cleanText(name), q = cleanText(term);
  if (!n || !q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  const words = q.split(" ").filter(Boolean);
  return words.length && words.every(word => n.includes(word)) ? 40 : 0;
}

async function resolveTeams(term: string) {
  const raw = await providerGet("/teams", { search: term });
  const candidates = raw.rows
    .map(item => item?.team)
    .filter((team: any) => Number.isFinite(Number(team?.id)) && team?.name)
    .map((team: any) => ({ id: Number(team.id), name: String(team.name) }));
  return Array.from(new Map(candidates.map(team => [team.id, team])).values())
    .sort((a, b) => teamScore(b.name, term) - teamScore(a.name, term))
    .slice(0, 5);
}

async function resolveLeagues(term: string) {
  const raw = await providerGet("/leagues", { search: term });
  return raw.rows
    .map(item => ({
      id: Number(item?.league?.id),
      name: String(item?.league?.name || ""),
      seasons: Array.isArray(item?.seasons) ? item.seasons : [],
    }))
    .filter((league: any) => Number.isFinite(league.id) && league.name)
    .sort((a: any, b: any) => teamScore(b.name, term) - teamScore(a.name, term))
    .slice(0, 3);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function yearsBetween(from: string, to: string) {
  const start = Number(from.slice(0, 4));
  const end = Number(to.slice(0, 4));
  return Array.from({ length: Math.min(4, Math.max(1, end - start + 1)) }, (_, index) => start + index);
}

function seasonsForLeague(league: any, from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T23:59:59Z`).getTime();
  const seasons = (league.seasons || []).filter((season: any) => {
    const seasonStart = season.start ? new Date(`${season.start}T00:00:00Z`).getTime() : -Infinity;
    const seasonEnd = season.end ? new Date(`${season.end}T23:59:59Z`).getTime() : Infinity;
    return seasonEnd >= start && seasonStart <= end;
  }).map((season: any) => Number(season.year)).filter(Number.isFinite);
  if (seasons.length) return Array.from(new Set(seasons)).slice(-4);
  return yearsBetween(from, to);
}

function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function inRequestedWindow(match: FootballMatch, from: string, to: string, timezone: string) {
  const localDate = dateInTimezone(new Date(match.startsAt), timezone);
  return localDate >= from && localDate <= to;
}

export async function searchFootballMatches(options: FootballSearchOptions): Promise<FootballSearchResult> {
  const clean = options.query.trim().slice(0, 80);
  if (clean.length < 3) return { matches: [], page: 1, totalPages: 1, hasMore: false };

  const from = validDate(options.from) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const to = validDate(options.to) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const timezone = options.timezone || "UTC";
  const page = Math.max(1, Math.min(20, Number(options.page) || 1));
  const normalizedQuery = cleanText(clean);
  const isoDate = clean.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || "";
  const effectiveFrom = isoDate ? isoDate : from;
  const effectiveTo = isoDate ? isoDate : to;

  if (/^\d{4,20}$/.test(clean)) {
    const result = await providerGet("/fixtures", { id: clean, timezone });
    const matches = result.rows.map(normalize).filter(match => inRequestedWindow(match, effectiveFrom, effectiveTo));
    return { matches, page: 1, totalPages: 1, hasMore: false };
  }

  const directTerms = queryParts(clean);
  const isH2H = directTerms.length >= 2;
  const [teamCandidates, leagueCandidates] = await Promise.all([
    Promise.all(directTerms.slice(0, 3).map(resolveTeams)).then(groups => groups.flat()),
    resolveLeagues(clean).catch(() => []),
  ]);

  const uniqueTeams = Array.from(new Map(teamCandidates.map(team => [team.id, team])).values());
  const teamByTerm = directTerms
    .map(term => uniqueTeams.filter(team => teamScore(team.name, term) >= 60).sort((a, b) => teamScore(b.name, term) - teamScore(a.name, term))[0])
    .filter((team): team is { id: number; name: string } => Boolean(team));

  const matches = new Map<string, FootballMatch>();
  let totalPages = 1;

  if (isH2H && teamByTerm.length >= 2) {
    const h2h = await providerGet("/fixtures", {
      h2h: `${teamByTerm[0].id}-${teamByTerm[1].id}`,
      from: effectiveFrom,
      to: effectiveTo,
      timezone,
      page,
    });
    h2h.rows.map(normalize).filter(match => inRequestedWindow(match, effectiveFrom, effectiveTo)).forEach(match => matches.set(match.fixtureId, match));
    totalPages = h2h.total;
  } else if (teamByTerm.length) {
    const selectedTeams = uniqueTeams.filter(team => directTerms.some(term => teamScore(team.name, term) >= 60)).slice(0, 5);
    const teamPages = await Promise.all(selectedTeams.map(team => providerGet("/fixtures", {
      team: team.id,
      from: effectiveFrom,
      to: effectiveTo,
      timezone,
      page,
    })));
    teamPages.forEach(result => {
      totalPages = Math.max(totalPages, result.total);
      result.rows.map(normalize).filter(match => inRequestedWindow(match, effectiveFrom, effectiveTo)).forEach(match => matches.set(match.fixtureId, match));
    });
  }

  if (leagueCandidates.length) {
    const leagueRequests = leagueCandidates.flatMap(league => seasonsForLeague(league, effectiveFrom, effectiveTo).map(season => providerGet("/fixtures", {
      league: league.id,
      season,
      from: effectiveFrom,
      to: effectiveTo,
      timezone,
      page,
    }).catch(() => null)));
    const leaguePages = await Promise.all(leagueRequests);
    leaguePages.forEach(result => {
      if (!result) return;
      totalPages = Math.max(totalPages, result.total);
      result.rows.map(normalize).filter(match => inRequestedWindow(match, effectiveFrom, effectiveTo)).forEach(match => matches.set(match.fixtureId, match));
    });
  }

  // A date-only search uses the provider's date-range endpoint directly rather than
  // relying on whatever fixtures happen to be cached in Supabase.
  if (!teamByTerm.length && !leagueCandidates.length) {
    const generic = await providerGet("/fixtures", {
      from: effectiveFrom,
      to: effectiveTo,
      timezone,
      page,
    });
    totalPages = generic.total;
    generic.rows.map(normalize).filter(match => inRequestedWindow(match, effectiveFrom, effectiveTo)).forEach(match => matches.set(match.fixtureId, match));
  }

  // Always include currently live fixtures when the requested window contains today.
  const today = dateInTimezone(new Date(), timezone);
  if (today >= effectiveFrom && today <= effectiveTo) {
    try {
      const live = await providerGet("/fixtures", { live: "all", timezone });
      const liveRows = live.rows.map(normalize);
      liveRows.forEach(match => {
        if (!inRequestedWindow(match, effectiveFrom, effectiveTo)) return;
        if (teamByTerm.length && !teamByTerm.some(team => team.id === match.home.id || team.id === match.away.id)) return;
        if (leagueCandidates.length && !leagueCandidates.some(league => league.id === match.league.id)) return;
        if (isH2H && teamByTerm.length >= 2) {
          const ids = new Set([teamByTerm[0].id, teamByTerm[1].id]);
          if (!ids.has(match.home.id || -1) || !ids.has(match.away.id || -1)) return;
        }
        matches.set(match.fixtureId, match);
      });
    } catch (error) {
      console.error("[football] live search supplement failed", error);
    }
  }

  let result = sortMatches(Array.from(matches.values())).filter(match => {
    const terms = directTerms.map(cleanText);
    if (!terms.length) return true;
    const fixtureText = `${cleanText(match.home.name)} ${cleanText(match.away.name)} ${cleanText(match.league.name)}`;
    return terms.every(term => fixtureText.includes(term) || teamByTerm.some(team => team.id === match.home.id || team.id === match.away.id));
  });

  // For a pure competition search, keep competition matches even if the free-text
  // words do not occur in the normalized league name exactly.
  if (leagueCandidates.length) {
    const leagueIds = new Set(leagueCandidates.map(league => league.id));
    result = result.filter(match => leagueIds.has(match.league.id) || result.length <= 20);
  }

  const pageSize = 20;
  const start = 0;
  const paged = result.slice(start, start + pageSize);
  await writeCache(paged);
  return { matches: paged, page, totalPages: Math.max(1, totalPages), hasMore: page < Math.max(1, totalPages) };
}
