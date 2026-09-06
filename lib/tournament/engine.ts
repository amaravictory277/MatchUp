export type TeamSeed = { id: string; name: string; seed?: number | null; group?: string | null };
export type FixtureDraft = {
  round_number: number;
  position: number;
  round_label: string;
  group_name?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
};

const ROUND_NAMES = ["Round of 16", "Quarter-final", "Semi-final", "Final"];

export function roundLabel(round: number, totalRounds: number) {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semi-final";
  if (fromFinal === 2) return "Quarter-final";
  if (totalRounds <= 4 && round <= 4) return ROUND_NAMES[round - 1] ?? `Round ${round}`;
  return `Round ${round}`;
}

export function roundRobin(teamIds: string[], groupName?: string | null): FixtureDraft[] {
  const teams = [...teamIds];
  if (teams.length < 2) return [];
  if (teams.length % 2) teams.push("");
  const n = teams.length;
  const rounds = n - 1;
  const fixtures: FixtureDraft[] = [];
  const rotation = [...teams];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      if (home && away) {
        fixtures.push({ round_number: r + 1, position: i + 1, round_label: `Matchday ${r + 1}`, group_name: groupName, home_team_id: r % 2 === 0 ? home : away, away_team_id: r % 2 === 0 ? away : home });
      }
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return fixtures;
}

export function singleElimination(teamIds: string[]): FixtureDraft[] {
  const sorted = [...teamIds];
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, sorted.length)));
  while (sorted.length < size) sorted.push("");
  const totalRounds = Math.log2(size);
  const fixtures: FixtureDraft[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const matches = size / 2 ** r;
    for (let p = 1; p <= matches; p++) {
      const home = r === 1 ? sorted[(p - 1) * 2] || null : null;
      const away = r === 1 ? sorted[(p - 1) * 2 + 1] || null : null;
      fixtures.push({ round_number: r, position: p, round_label: roundLabel(r, totalRounds), home_team_id: home, away_team_id: away });
    }
  }
  return fixtures;
}

export function groupsFromTeams(teamIds: string[], groupCount = 4): { groups: TeamSeed[][]; fixtures: FixtureDraft[] } {
  const count = Math.max(1, Math.min(groupCount, Math.ceil(teamIds.length / 4)));
  const groups: TeamSeed[][] = Array.from({ length: count }, (_, i) => []);
  teamIds.forEach((id, index) => groups[index % count].push({ id, name: id, group: String.fromCharCode(65 + (index % count)) }));
  const fixtures = groups.flatMap((group, index) => roundRobin(group.map((t) => t.id), String.fromCharCode(65 + index)));
  return { groups, fixtures };
}

export function statsFromFixtures(fixtures: Array<{ home_team_id?: string | null; away_team_id?: string | null; home_score?: number | null; away_score?: number | null; status?: string | null; home_penalties?: number | null; away_penalties?: number | null }>) {
  const map = new Map<string, { p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }>();
  const ensure = (id?: string | null) => {
    if (!id) return null;
    if (!map.has(id)) map.set(id, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
    return map.get(id)!;
  };
  fixtures.filter((f) => f.status === "confirmed" && f.home_team_id && f.away_team_id && f.home_score != null && f.away_score != null).forEach((f) => {
    const home = ensure(f.home_team_id)!;
    const away = ensure(f.away_team_id)!;
    const hs = f.home_score!;
    const as = f.away_score!;
    home.p += 1; away.p += 1; home.gf += hs; home.ga += as; away.gf += as; away.ga += hs;
    if (hs > as) { home.w += 1; home.pts += 3; away.l += 1; }
    else if (as > hs) { away.w += 1; away.pts += 3; home.l += 1; }
    else { home.d += 1; away.d += 1; home.pts += 1; away.pts += 1; }
  });
  map.forEach((row) => { row.gd = row.gf - row.ga; });
  return map;
}
