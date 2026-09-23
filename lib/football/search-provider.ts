import type { FootballMatch } from "./server";

const API_BASE = (process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io").replace(/\/$/, "");
const API_KEY = process.env.FOOTBALL_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const memory = new Map<string, { expiresAt: number; matches: FootballMatch[] }>();

function cleanText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalize(raw: any): FootballMatch {
  const code = String(raw?.fixture?.status?.short || "NS");
  return {
    fixtureId: String(raw?.fixture?.id),
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

async function providerGet(path: string, params: Record<string, string | number>) {
  if (!API_KEY) {
    throw new Error("FOOTBALL_API_KEY is not configured on the server");
  }

  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const response = await fetch(url, {
    headers: { "x-apisports-key": API_KEY, accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.text();
  let json: any = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = null;
  }

  const providerErrors = json?.errors && typeof json.errors === "object" ? JSON.stringify(json.errors) : "";
  if (!response.ok || !Array.isArray(json?.response)) {
    throw new Error(`API-Football ${response.status}: ${providerErrors || body.slice(0, 240) || "invalid provider response"}`);
  }

  return json.response as any[];
}

async function readCache(query: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [] as FootballMatch[];
  const url = new URL(`${SUPABASE_URL}/rest/v1/football_fixture_cache`);
  url.searchParams.set("select", "payload,fetched_at");
  url.searchParams.set("or", `(home_team_name.ilike.*${encodeURIComponent(query)}*,away_team_name.ilike.*${encodeURIComponent(query)}*)`);
  url.searchParams.set("order", "starts_at.asc");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []) as Array<{ payload?: FootballMatch; fetched_at?: string }>;
  return rows.map(row => row.payload).filter((match): match is FootballMatch => Boolean(match?.fixtureId));
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

function sortMatches(matches: FootballMatch[], now = Date.now()) {
  return [...new Map(matches.map(match => [match.fixtureId, match])).values()].sort((a, b) => {
    if (a.status.live !== b.status.live) return a.status.live ? -1 : 1;
    if (a.status.finished !== b.status.finished) return a.status.finished ? 1 : -1;
    if (a.status.finished && b.status.finished) return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    return Math.abs(new Date(a.startsAt).getTime() - now) - Math.abs(new Date(b.startsAt).getTime() - now);
  });
}

function queryParts(value: string) {
  return Array.from(new Set(
    value
      .split(/\s+(?:vs|v|versus)\s+|\s+-\s+/i)
      .map(part => part.trim())
      .filter(Boolean),
  ));
}

function teamScore(name: string, term: string) {
  const n = cleanText(name);
  const q = cleanText(term);
  if (!n || !q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  const words = q.split(" ").filter(Boolean);
  return words.length && words.every(word => n.includes(word)) ? 40 : 0;
}

async function resolveTeams(term: string) {
  const raw = await providerGet("/teams", { search: term });
  const candidates = raw
    .map(item => item?.team)
    .filter((team: any) => Number.isFinite(Number(team?.id)) && team?.name)
    .map((team: any) => ({ id: Number(team.id), name: String(team.name) }));
  return Array.from(new Map(candidates.map(team => [team.id, team])).values())
    .sort((a, b) => teamScore(b.name, term) - teamScore(a.name, term))
    .slice(0, 5);
}

async function fetchTeamWindow(teamId: number) {
  const now = Date.now();
  const from = new Date(now - 7 * 86400000);
  const to = new Date(now + 45 * 86400000);

  // One provider request covers the full required search window across every competition.
  // No league, country, season, round, or popular-league filter is applied.
  const rows = await providerGet("/fixtures", {
    team: teamId,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    timezone: "UTC",
  });
  return rows.map(normalize);
}

export async function searchFootballMatches(query: string) {
  const clean = query.trim().slice(0, 80);
  if (clean.length < 3) return [];

  const memoryKey = cleanText(clean);
  const memoryHit = memory.get(memoryKey);
  if (memoryHit && memoryHit.expiresAt > Date.now()) return memoryHit.matches;

  // Cache-first: repeated searches are served from Supabase without calling the provider.
  const cached = await readCache(clean);
  const now = Date.now();
  const sevenDays = now - 7 * 86400000;
  const cachedUseful = sortMatches(cached.filter(match => {
    const start = new Date(match.startsAt).getTime();
    return match.status.live || (start >= sevenDays && start <= now) || (!match.status.finished && start >= now);
  }), now);
  if (cachedUseful.length) {
    const exactCached = cachedUseful.filter(match => queryParts(clean).some(term => teamScore(match.home.name, term) >= 60 || teamScore(match.away.name, term) >= 60));
    if (exactCached.length) {
      memory.set(memoryKey, { expiresAt: now + 60000, matches: exactCached.slice(0, 20) });
      return exactCached.slice(0, 20);
    }
  }

  const terms = queryParts(clean);
  const teams = (await Promise.all(terms.map(resolveTeams))).flat();
  const uniqueTeams = Array.from(new Map(teams.map(team => [team.id, team])).values())
    .sort((a, b) => terms.reduce((score, term) => score + teamScore(b.name, term), 0) - terms.reduce((score, term) => score + teamScore(a.name, term), 0))
    .slice(0, 5);

  if (!uniqueTeams.length) {
    memory.set(memoryKey, { expiresAt: now + 30000, matches: [] });
    return [];
  }

  const settled = await Promise.allSettled(uniqueTeams.map(team => fetchTeamWindow(team.id)));
  const all = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const directTerms = terms.map(cleanText);
  const relevant = all.filter(match => {
    const start = new Date(match.startsAt).getTime();
    const withinWindow = match.status.live || (match.status.finished && start >= sevenDays && start <= now) || (!match.status.finished && start >= now);
    if (!withinWindow) return false;
    const home = cleanText(match.home.name);
    const away = cleanText(match.away.name);
    return directTerms.some(term => teamScore(home, term) >= 60 || teamScore(away, term) >= 60);
  });

  // A single global live request makes the live section independent of league selection.
  try {
    const live = (await providerGet("/fixtures", { live: "all" })).map(normalize).filter(match => {
      const home = cleanText(match.home.name);
      const away = cleanText(match.away.name);
      return directTerms.some(term => teamScore(home, term) >= 60 || teamScore(away, term) >= 60);
    });
    relevant.push(...live);
  } catch (error) {
    console.error("[football] global live fallback failed", error);
  }

  const result = sortMatches(relevant, now).slice(0, 20);
  await writeCache(result);
  memory.set(memoryKey, { expiresAt: now + 60000, matches: result });
  return result;
}
