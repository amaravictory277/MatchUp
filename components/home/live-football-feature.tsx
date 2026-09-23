"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Vote, MessageCircle, Radio, Trophy } from "lucide-react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export type FootballMatch = {
  fixtureId: string;
  league: { id: number | null; name: string; logo: string | null };
  status: { code: string; label: string; elapsed: number | null; live: boolean; finished: boolean };
  startsAt: string;
  home: { id: number | null; name: string; logo: string | null; score: number | null };
  away: { id: number | null; name: string; logo: string | null; score: number | null };
};

type VoteState = { home: number; away: number; total: number; myVote: "home" | "away" | null };
type DatePreset = "previous7" | "today" | "next7" | "next30" | "custom";

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function searchDateRange(preset: DatePreset, customFrom: string, customTo: string) {
  const today = new Date();
  const todayString = localDateString(today);
  if (preset === "previous7") return { from: localDateString(shiftDate(today, -7)), to: todayString };
  if (preset === "today") return { from: todayString, to: todayString };
  if (preset === "next7") return { from: todayString, to: localDateString(shiftDate(today, 7)) };
  if (preset === "next30") return { from: todayString, to: localDateString(shiftDate(today, 30)) };
  return { from: customFrom, to: customTo };
}

function statusLabel(match: FootballMatch) {
  if (match.status.live) return match.status.elapsed ? `LIVE · ${match.status.elapsed}'` : "LIVE";
  if (match.status.finished) return "FULL-TIME";
  return new Date(match.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function percentages(state: VoteState) {
  if (!state.total) return { home: 0, away: 0 };
  return { home: Math.round((state.home / state.total) * 100), away: Math.round((state.away / state.total) * 100) };
}

export function LiveMatchCard({
  match,
  voteState,
  onVote,
  onRoom,
}: {
  match: FootballMatch;
  voteState: VoteState;
  onVote: (fixtureId: string, team: "home" | "away") => void;
  onRoom: (fixtureId: string) => void;
}) {
  const pct = percentages(voteState);
  const finished = match.status.finished;

  return (
    <article className="min-w-[300px] max-w-[340px] snap-start rounded-[26px] border border-[#1d5d99] bg-[#071a31] p-4 shadow-[0_18px_50px_rgba(0,45,100,.22)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-black uppercase tracking-[.15em] text-[#70c1ff]">{match.league.name}</p>
          <p className={`mt-1 text-[10px] font-black uppercase tracking-[.1em] ${match.status.live ? "text-[#5df2c1]" : finished ? "text-[#b7c9d9]" : "text-[#9fb6cc]"}`}>
            {statusLabel(match)}
          </p>
        </div>
        <Radio size={16} className={match.status.live ? "text-[#5df2c1]" : "text-[#5c82a5]"} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[#245b91] bg-[#0a2946] p-2">
            {match.home.logo ? <img src={match.home.logo} alt="" className="size-full object-contain" /> : null}
          </div>
          <p className="mt-2 truncate text-xs font-black text-white">{match.home.name}</p>
          <p className="mt-1 text-3xl font-black leading-none text-white">{match.home.score ?? "—"}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[.14em] text-[#587d9f]">VS</span>
        <div className="min-w-0 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[#245b91] bg-[#0a2946] p-2">
            {match.away.logo ? <img src={match.away.logo} alt="" className="size-full object-contain" /> : null}
          </div>
          <p className="mt-2 truncate text-xs font-black text-white">{match.away.name}</p>
          <p className="mt-1 text-3xl font-black leading-none text-white">{match.away.score ?? "—"}</p>
        </div>
      </div>

      {finished ? (
        <div className="mt-4 rounded-2xl border border-[#173f68] bg-[#061426] px-3 py-3 text-center">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#7892ac]">Final score</p>
          <p className="mt-1 text-sm font-black text-white">{match.home.name} {match.home.score ?? 0} — {match.away.score ?? 0} {match.away.name}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-[#173f68] bg-[#061426] p-3">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[.1em]">
              <span className="truncate text-[#70c1ff]">{match.home.name} {pct.home}%</span>
              <span className="text-[#ff9ca9]">{match.away.name} {pct.away}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ff657b]">
              <div className="h-full bg-[#70c1ff] transition-[width] duration-300" style={{ width: `${pct.home}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-[#7892ac]">
              <span>{voteState.home} vote{voteState.home === 1 ? "" : "s"}</span>
              <span>{voteState.away} vote{voteState.away === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onVote(match.fixtureId, "home")} className={`rounded-xl border px-2 py-2.5 text-[10px] font-black transition ${voteState.myVote === "home" ? "border-[#70c1ff] bg-[#0b3154] text-white" : "border-[#214a78] bg-[#081f38] text-[#bfe3ff]"}`}>
              Vote {match.home.name}
            </button>
            <button type="button" onClick={() => onVote(match.fixtureId, "away")} className={`rounded-xl border px-2 py-2.5 text-[10px] font-black transition ${voteState.myVote === "away" ? "border-[#ff8797] bg-[#341b2a] text-white" : "border-[#214a78] bg-[#081f38] text-[#bfe3ff]"}`}>
              Vote {match.away.name}
            </button>
          </div>
          <button type="button" onClick={() => onRoom(match.fixtureId)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-4 py-3 text-xs font-black text-white shadow-[0_10px_24px_rgba(22,123,209,.22)]">
            <MessageCircle size={15} /> View Match Room
          </button>
        </>
      )}
    </article>
  );
}

function DiscoveryCarousel({ onOpenMatch }: { onOpenMatch: () => void }) {
  const [slide, setSlide] = useState(0);
  const [dragX, setDragX] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pauseUntil = useRef(0);

  const go = useCallback((next: number) => {
    setSlide(next === 0 ? 0 : 1);
    pauseUntil.current = Date.now() + 10000;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() < pauseUntil.current) return;
      setSlide(value => value === 0 ? 1 : 0);
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) setDragX(dx);
  };
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.15) go(dx < 0 ? 1 : 0);
    setDragX(0);
  };

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#174978] bg-[#061426] shadow-[0_24px_70px_rgba(0,30,80,.26)]">
      <div
        className="flex w-[200%] touch-pan-y transition-transform duration-500 ease-out"
        style={{ transform: `translate3d(calc(-${slide * 50}% + ${dragX}px),0,0)` }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={() => { start.current = null; setDragX(0); }}
      >
        <article className="w-1/2 shrink-0 bg-[radial-gradient(circle_at_80%_0%,rgba(36,151,255,.22),transparent_45%),#071426] px-5 py-7 sm:px-8 sm:py-9">
          <div className="max-w-[620px]">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#9bd3ff]">THE HOME OF FOOTBALL TOURNAMENTS</p>
            <h1 className="mt-4 max-w-[620px] text-[43px] font-black leading-[.95] tracking-[-.055em] text-white sm:text-6xl">Find your next <span className="text-[#70c1ff]">competition.</span></h1>
            <p className="mt-4 max-w-[520px] text-sm leading-6 text-[#c8d9e9] sm:text-base">Create, discover and run competitive football tournaments—all in one match-ready place.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/tournaments" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-5 py-3 text-xs font-black text-white"><Trophy size={16}/>Search Tournaments</Link>
              <Link href="/tournaments" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#28547e] bg-[#071426]/70 px-5 py-3 text-xs font-black text-white"><Search size={16}/>Find Tournament</Link>
            </div>
          </div>
        </article>

        <article className="w-1/2 shrink-0 bg-[radial-gradient(circle_at_82%_8%,rgba(36,151,255,.22),transparent_42%),#071426] px-5 py-7 sm:px-8 sm:py-9">
          <div className="max-w-[620px]">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#70c1ff]">LIVE FOOTBALL • MATCHUP ROOMS</p>
            <h2 className="mt-4 text-[38px] font-black leading-[.96] tracking-[-.05em] text-white sm:text-5xl">View <span className="text-[#70c1ff]">Live Scores.</span></h2>
            <p className="mt-4 max-w-[540px] text-sm leading-6 text-[#c8d9e9] sm:text-base">Follow real football matches, see current scores, vote for either team, and jump into the Match Room for the discussion.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onOpenMatch} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#167bd1] px-5 py-3 text-xs font-black text-white"><Radio size={16}/>View Live Scores</button>
              <button type="button" onClick={onOpenMatch} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#28547e] bg-[#071426]/70 px-5 py-3 text-xs font-black text-white"><Search size={16}/>Search Match</button>
            </div>
          </div>
        </article>
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {[0, 1].map(index => <button key={index} type="button" onClick={() => go(index)} aria-label={`Show slide ${index + 1}`} className={`h-1.5 rounded-full transition-all ${slide === index ? "w-7 bg-[#70c1ff]" : "w-1.5 bg-[#31597f]"}`} />)}
      </div>
    </section>
  );
}

export function LiveFootballHomeFeature() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("next30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(false);

  const loadVotes = useCallback(async (items: FootballMatch[]) => {
    const liveOrUpcoming = items.filter(item => !item.status.finished);
    if (!liveOrUpcoming.length) {
      setVotes({});
      return;
    }
    const ids = liveOrUpcoming.map(item => item.fixtureId);
    const { data } = await supabase.from("football_match_votes").select("fixture_id,user_id,team").in("fixture_id", ids);
    const { data: auth } = await supabase.auth.getUser();
    const next: Record<string, VoteState> = {};
    ids.forEach(id => { next[id] = { home: 0, away: 0, total: 0, myVote: null }; });
    (data || []).forEach((row: any) => {
      const state = next[row.fixture_id] || { home: 0, away: 0, total: 0, myVote: null };
      if (row.team === "home") state.home += 1; else state.away += 1;
      state.total += 1;
      if (auth.user?.id === row.user_id) state.myVote = row.team;
      next[row.fixture_id] = state;
    });
    setVotes(next);
  }, [supabase]);

  const load = useCallback(async (refresh = false) => {
    const response = await fetch(`/api/football/matches${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError("Live football data is unavailable right now.");
      return;
    }
    setError("");
    setMatches(payload.matches || []);
    await loadVotes(payload.matches || []);
  }, [loadVotes]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const openRoom = async (fixtureId: string) => {
    const response = await fetch("/api/football/match-room", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fixtureId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.roomId) {
      setError(payload.error || "Sign in to open a Match Room.");
      return;
    }
    router.push(`/match-room/${payload.roomId}`);
  };

  const vote = async (fixtureId: string, team: "home" | "away") => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Sign in to vote on matches.");
      return;
    }
    const { data, error: voteError } = await supabase.rpc("cast_match_vote", { p_fixture_id: fixtureId, p_team: team });
    if (voteError) {
      console.error("[football] vote update failed", voteError);
      setError("We couldn't update your vote right now. Please try again.");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setVotes(current => ({
      ...current,
      [fixtureId]: {
        home: Number(row?.home_votes || 0),
        away: Number(row?.away_votes || 0),
        total: Number(row?.total_votes || 0),
        myVote: row?.my_vote || null,
      },
    }));
  };

  const requestSearch = async (page = 1, append = false) => {
    if (query.trim().length < 3) {
      setError("Enter at least 3 characters to search for a match.");
      return;
    }

    const range = searchDateRange(datePreset, customFrom, customTo);
    if (!range.from || !range.to || range.from > range.to) {
      setError("Choose a valid custom date range.");
      return;
    }

    setSearching(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const params = new URLSearchParams({
      search: query.trim(),
      from: range.from,
      to: range.to,
      timezone,
      page: String(page),
    });
    let response: Response;
    let payload: any = {};
    try {
      response = await fetch(`/api/football/matches?${params.toString()}`, { cache: "no-store" });
      payload = await response.json().catch(() => ({}));
    } catch {
      setSearching(false);
      setError("We couldn't reach the football search service right now. Please try again.");
      return;
    }
    setSearching(false);

    if (!response.ok || payload.providerUnavailable) {
      setError(payload.error || "We couldn't search for that match right now. Please try again.");
      return;
    }

    const nextMatches = Array.isArray(payload.matches) ? payload.matches : [];
    setMatches(current => append ? [...current, ...nextMatches.filter((match: FootballMatch) => !current.some(item => item.fixtureId === match.fixtureId))] : nextMatches);
    setSearchPage(page);
    setHasMoreSearchResults(Boolean(payload.hasMore));
    await loadVotes(append ? [...matches, ...nextMatches] : nextMatches);
    setError(nextMatches.length || append ? "" : "No fixture matched that team, competition, opponent, or date range.");
  };

  const search = async () => {
    await requestSearch(1, false);
  };

  const loadMoreSearchResults = async () => {
    if (!hasMoreSearchResults || searching) return;
    await requestSearch(searchPage + 1, true);
  };

  const openSearch = () => {
    setShowSearch(true);
    window.setTimeout(() => document.getElementById("matchup-match-search")?.focus(), 0);
  };

  return (
    <>
      <DiscoveryCarousel onOpenMatch={openSearch} />
      <section className="mt-9" id="live-scores">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#47a8ff]">Live Football</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">Live Scores & Match Rooms</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[#86a1bb] sm:text-sm">Real football fixtures, current scores, voting and focused Match Room discussion.</p>
          </div>
          <button type="button" onClick={openSearch} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#214a78] bg-[#071426] px-3 py-2 text-[11px] font-black text-[#bfe3ff]"><Search size={14}/>Search Match</button>
        </div>

        {showSearch ? (
          <div className="mb-4 rounded-2xl border border-[#214a78] bg-[#071426] p-3">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  id="matchup-match-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => { if (event.key === "Enter") void search(); }}
                  placeholder="Team, opponent, competition, match or date…"
                  className="min-w-0 flex-1 rounded-xl border border-[#214a78] bg-[#061426] px-3 py-3 text-sm text-white outline-none focus:border-[#47a8ff]"
                />
                <button type="button" disabled={searching} onClick={() => void search()} className="rounded-xl bg-[#167bd1] px-4 text-xs font-black text-white disabled:opacity-60">
                  {searching ? "Searching…" : "Search"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {([
                  ["previous7", "Previous 7 Days"],
                  ["today", "Today"],
                  ["next7", "Next 7 Days"],
                  ["next30", "Next 30 Days"],
                  ["custom", "Custom Range"],
                ] as Array<[DatePreset, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDatePreset(value)}
                    className={`rounded-xl border px-2 py-2 text-[10px] font-black transition ${datePreset === value ? "border-[#70c1ff] bg-[#0b3154] text-white" : "border-[#214a78] bg-[#061426] text-[#9fb6cc]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {datePreset === "custom" ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-[10px] font-black uppercase tracking-[.12em] text-[#7892ac]">
                    From
                    <input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-[#214a78] bg-[#061426] px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-white outline-none" />
                  </label>
                  <label className="text-[10px] font-black uppercase tracking-[.12em] text-[#7892ac]">
                    To
                    <input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} className="mt-1 w-full rounded-xl border border-[#214a78] bg-[#061426] px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-white outline-none" />
                  </label>
                </div>
              ) : null}

              <p className="text-[10px] leading-4 text-[#7892ac]">
                Search runs against the football provider using team, opponent, competition and date-range parameters. Results are not limited to fixtures already loaded on this page.
              </p>
            </div>
          </div>
        ) : null}

        {error ? <div role="status" className="mb-4 rounded-2xl border border-[#6b3341] bg-[#24151a] px-4 py-3 text-sm font-bold text-[#ffb2bc]">{error}</div> : null}

        {matches.length ? (
          <>
            <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-2">
              {matches.map(match => (
                <LiveMatchCard
                  key={match.fixtureId}
                  match={match}
                  voteState={votes[match.fixtureId] || { home: 0, away: 0, total: 0, myVote: null }}
                  onVote={vote}
                  onRoom={openRoom}
                />
              ))}
            </div>
            {showSearch && hasMoreSearchResults ? (
              <button
                type="button"
                disabled={searching}
                onClick={() => void loadMoreSearchResults()}
                className="mx-auto mt-3 block rounded-full border border-[#214a78] bg-[#071426] px-5 py-2.5 text-[11px] font-black text-[#bfe3ff] disabled:opacity-60"
              >
                {searching ? "Loading…" : "Load More Matches"}
              </button>
            ) : null}
          </>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[#214a78] bg-[#071426] p-7 text-center">
            <Vote className="mx-auto text-[#70c1ff]" size={23}/>
            <p className="mt-3 font-black text-white">{showSearch ? "No matching fixtures found" : "No live or upcoming matches available"}</p>
            <p className="mt-1 text-sm leading-5 text-[#7892ac]">{showSearch ? "Try another team, competition, opponent, fixture or date range." : "Check back soon for live fixtures and upcoming matches."}</p>
          </div>
        )}
      </section>
    </>
  );
}
