type FootballMatch = {
  fixtureId: string;
  league: { id: number | null; name: string; logo: string | null };
  status: { code: string; label: string; elapsed: number | null; live: boolean; finished: boolean };
  startsAt: string;
  home: { id: number | null; name: string; logo: string | null; score: number | null };
  away: { id: number | null; name: string; logo: string | null; score: number | null };
};

const API_BASE = (process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io").replace(/\/$/, "");
const API_KEY = process.env.FOOTBALL_API_KEY;

const LIVE_CODES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_CODES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

type ProviderResult = {
  rows: any[];
  totalPages: number;
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

function providerRequired() {
  if (!API_KEY) throw new Error("Football provider is not configured.");
}

async function providerGet(path: string, params: Record<string, string | number>): Promise<ProviderResult> {
  providerRequired();
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  const response = await fetch(url, {
    headers: { "x-apisports-key": API_KEY!, accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.text();
  let json: any = null;
  try { json = body ? JSON.parse(body) : null; } catch { json = null; }

  if (!response.ok || !Array.isArray(json?.response)) {
    const details = json?.errors && typeof json.errors === "object" ? JSON.stringify(json.errors) : "Football provider request failed.";
    throw new Error(`API-Football ${response.status}: ${details}`);
  }

  return {
    rows: json.response,
    totalPages: Math.max(1, Number(json?.paging?.total || 1)),
  };
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

function clean(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function scoreName(name: string, query: string) {
  const a = clean(name);
  const b = clean(query);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b)) return 80;
  if (a.includes(b)) return 60;
  return b.split(" ").every(word => a.includes(word)) ? 40 : 0;
}

function queryParts(value: string) {
  return Array.from(new Set(value.split(/\s+(?:vs|v|versus)\s+|\s+-\s+/i).map(part => part.trim()).filter(Boolean)));
}

function sortMatches(matches: FootballMatch[]) {
  return Array.from(new Map(matches.map(match => [match.fixtureId, match])).values()).sort((a, b) => {
    if (a.status.live !== b.status.live) return a.status.live ? -1 : 1;
    if (a.status.finished !== b.status.finished) return a.status.finished ? 1 : -1;
    if (a.status.finished) return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

async function resolveTeams(query: string) {
  const result = await providerGet("/teams", { search: query });
  return Array.from(new Map(
    result.rows
      .map(item => item?.team)
      .filter((team: any) => Number.isFinite(Number(team?.id)) && team?.name)
      .map((team: any) => ({ id: Number(team.id), name: String(team.name) }))
      .map(team => [team.id, team] as const)
  ).values()).sort((a, b) => scoreName(b.name, query) - scoreName(a.name, query)).slice(0, 5);
}

async function resolveLeagues(query: string) {
  const result = await providerGet("/leagues", { search: query });
  return result.rows
    .map(item => ({
      id: Number(item?.league?.id),
      name: String(item?.league?.name || ""),
      seasons: Array.isArray(item?.seasons) ? item.seasons : [],
    }))
    .filter(league => Number.isFinite(league.id) && league.name)
    .sort((a, b) => scoreName(b.name, query) - scoreName(a.name, query))
    .slice(0, 3);
}

function seasonsForRange(league: any, from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const seasons = league.seasons
    .filter((season: any) => {
      const seasonStart = season.start ? new Date(season.start).getTime() : -Infinity;
      const seasonEnd = season.end ? new Date(season.end).getTime() : Infinity;
      return seasonEnd >= start && seasonStart <= end;
    })
    .map((season: any) => Number(season.year))
    .filter((year: number) => Number.isFinite(year));

  return Array.from(new Set(seasons)).slice(-4);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export async function searchFootballMatches(options: FootballSearchOptions): Promise<FootballSearchResult> {
  const query = options.query.trim().slice(0, 80);
  const page = Math.max(1, Math.min(20, Number(options.page) || 1));
  const timezone = options.timezone || "UTC";
  const defaultFrom = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const defaultTo = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  let from = validDate(options.from) || defaultFrom;
  let to = validDate(options.to) || defaultTo;

  const dateInQuery = query.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (dateInQuery) {
    from = dateInQuery;
    to = dateInQuery;
  }

  if (query.length < 3 || from > to) return { matches: [], page, totalPages: 1, hasMore: false };

  if (/^\d{4,20}$/.test(query)) {
    const result = await providerGet("/fixtures", { id: query, timezone });
    const matches = result.rows.map(normalize);
    return { matches, page: 1, totalPages: 1, hasMore: false };
  }

  const parts = queryParts(query);
  const teamGroups = await Promise.all(parts.slice(0, 3).map(term => resolveTeams(term).catch(() => [])));
  const teams = Array.from(new Map(teamGroups.flat().map(team => [team.id, team])).values());
  const selectedTeams = parts.map(term => teams.filter(team => scoreName(team.name, term) >= 60).sort((a, b) => scoreName(b.name, term) - scoreName(a.name, term))[0]).filter((team): team is { id: number; name: string } => Boolean(team));

  const leagueCandidates = await resolveLeagues(query).catch(() => []);
  const matches = new Map<string, FootballMatch>();
  let totalPages = 1;

  if (parts.length >= 2 && selectedTeams.length >= 2) {
    const result = await providerGet("/fixtures", {
      h2h: `${selectedTeams[0].id}-${selectedTeams[1].id}`,
      from,
      to,
      timezone,
      page,
    });
    totalPages = Math.max(totalPages, result.totalPages);
    result.rows.map(normalize).forEach(match => matches.set(match.fixtureId, match));
  } else if (selectedTeams.length) {
    const results = await Promise.all(selectedTeams.slice(0, 5).map(team => providerGet("/fixtures", {
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
      seasonsForRange(league, from, to).map(season =>
        providerGet("/fixtures", {
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
    const result = await providerGet("/fixtures", { from, to, timezone, page });
    totalPages = result.totalPages;
    result.rows.map(normalize).forEach(match => matches.set(match.fixtureId, match));
  }

  // Live scores are queried from the provider's live fixture feed, not from cached
  // fixtures, whenever the selected date window includes today.
  const today = new Date().toISOString().slice(0, 10);
  if (today >= from && today <= to) {
    try {
      const live = await providerGet("/fixtures", { live: "all", timezone });
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

  let result = sortMatches(Array.from(matches.values()));
  const queryWords = clean(query).split(" ").filter(Boolean);

  result = result.filter(match => {
    const home = clean(match.home.name);
    const away = clean(match.away.name);
    const league = clean(match.league.name);
    const text = `${home} ${away} ${league}`;

    if (parts.length >= 2 && selectedTeams.length >= 2) {
      return selectedTeams.slice(0, 2).some(team => team.id === match.home.id || team.id === match.away.id) &&
        selectedTeams.slice(0, 2).every(team => team.id === match.home.id || team.id === match.away.id);
    }

    if (selectedTeams.length) return selectedTeams.some(team => team.id === match.home.id || team.id === match.away.id);
    if (leagueCandidates.length) return leagueCandidates.some(leagueItem => leagueItem.id === match.league.id);
    return queryWords.every(word => text.includes(word));
  });

  const matchesForPage = result.slice(0, 20);
  return {
    matches: matchesForPage,
    page,
    totalPages: Math.max(1, totalPages),
    hasMore: page < Math.max(1, totalPages),
  };
}
