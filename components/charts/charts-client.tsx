"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Trophy } from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { ChartPageSkeleton } from "../ui/content-skeletons";

type Competition = {
  id: string;
  name: string;
  max_players: number;
  status: string;
};

type ChartRow = Competition & {
  teams: number;
  matches: number;
  completed: number;
  progress: number;
};

export function ChartsClient() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("id,name,max_players,status")
      .eq("visibility", "public")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(40);

    const competitions = (tournaments || []) as Competition[];
    if (!competitions.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ids = competitions.map((item) => item.id);
    const [{ data: teams }, { data: fixtures }] = await Promise.all([
      supabase.from("tournament_teams").select("tournament_id").in("tournament_id", ids),
      supabase.from("fixtures").select("tournament_id,status,cancelled").in("tournament_id", ids),
    ]);

    const teamCounts = new Map<string, number>();
    (teams || []).forEach((team: { tournament_id: string }) => {
      teamCounts.set(team.tournament_id, (teamCounts.get(team.tournament_id) || 0) + 1);
    });

    const fixtureStats = new Map<string, { total: number; completed: number }>();
    (fixtures || []).forEach((fixture: { tournament_id: string; status: string; cancelled?: boolean | null }) => {
      if (fixture.cancelled) return;
      const current = fixtureStats.get(fixture.tournament_id) || { total: 0, completed: 0 };
      current.total += 1;
      if (fixture.status === "confirmed") current.completed += 1;
      fixtureStats.set(fixture.tournament_id, current);
    });

    setRows(
      competitions.map((competition) => {
        const fixture = fixtureStats.get(competition.id) || { total: 0, completed: 0 };
        return {
          ...competition,
          teams: teamCounts.get(competition.id) || 0,
          matches: fixture.total,
          completed: fixture.completed,
          progress: fixture.total ? Math.round((fixture.completed / fixture.total) * 100) : 0,
        };
      }),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const progressRows = useMemo(
    () => [...rows].sort((a, b) => b.progress - a.progress || b.completed - a.completed).slice(0, 8),
    [rows],
  );
  const sizeRows = useMemo(
    () => [...rows].sort((a, b) => b.teams - a.teams || b.max_players - a.max_players).slice(0, 8),
    [rows],
  );
  const maxTeams = Math.max(1, ...sizeRows.map((item) => Math.max(item.teams, item.max_players)));

  return (
    <main className="app-shell min-h-screen pb-28">
      {loading ? (
        <ChartPageSkeleton count={2} />
      ) : (
        <>
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#47a8ff]">MatchUp Charts</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Competition charts</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#86a1bb]">
              Structural views of public MatchUp competitions, their progress, and configured team capacity.
            </p>
          </div>

          {rows.length ? (
            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              <section className="rounded-[26px] border border-[#18365f] bg-[#071426] p-5">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#70c1ff]" />
                  <div>
                    <h2 className="font-black text-white">Competition progress</h2>
                    <p className="mt-1 text-xs text-[#7892ac]">Completed fixtures as a share of scheduled fixtures.</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {progressRows.map((row) => (
                    <div key={row.id}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-bold text-white">{row.name}</span>
                        <span className="shrink-0 font-black text-[#70c1ff]">{row.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0d2945]">
                        <div className="h-full rounded-full bg-[#167bd1] transition-[width]" style={{ width: row.progress + "%" }} />
                      </div>
                      <p className="mt-1 text-[10px] text-[#66809a]">{row.completed} of {row.matches} matches completed</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[26px] border border-[#18365f] bg-[#071426] p-5">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-[#70c1ff]" />
                  <div>
                    <h2 className="font-black text-white">Competition size</h2>
                    <p className="mt-1 text-xs text-[#7892ac]">Configured teams and maximum player capacity.</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {sizeRows.map((row) => {
                    const width = Math.round((Math.max(row.teams, row.max_players) / maxTeams) * 100);
                    return (
                      <div key={row.id}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate font-bold text-white">{row.name}</span>
                          <span className="shrink-0 font-black text-[#70c1ff]">{row.teams}/{row.max_players}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0d2945]">
                          <div className="h-full rounded-full bg-[#167bd1] transition-[width]" style={{ width: width + "%" }} />
                        </div>
                        <p className="mt-1 text-[10px] text-[#66809a]">{row.teams} teams configured · {row.max_players} maximum</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            <section className="mt-7 rounded-[26px] border border-dashed border-[#214a78] bg-[#071426] p-8 text-center">
              <BarChart3 className="mx-auto text-[#70c1ff]" size={24} />
              <p className="mt-3 font-black text-white">No public competition data yet</p>
              <p className="mt-1 text-sm text-[#7892ac]">Charts will appear here as public tournaments and fixtures are created.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
