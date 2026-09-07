"use client";

import { Bell, House, MessageSquare, Newspaper, Plus, Search, Trophy, X, FileText, UserPlus, UsersRound, ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TournamentCard } from "./tournaments/tournament-browser";
import { createBrowserSupabaseClient } from "../lib/supabase/client";

const links = [
  { label: "Home", icon: House, href: "/", route: true },
  { label: "Tournaments", icon: Trophy, href: "/tournaments", route: true },
  { label: "Feeds", icon: Newspaper, href: "/feeds", route: true },
  { label: "Chat", icon: MessageSquare, href: "/leaderboard", route: true },
] as const;

function getRouteActive(pathname: string) {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/tournaments")) return "Tournaments";
  if (pathname.startsWith("/feeds")) return "Feeds";
  if (pathname.startsWith("/leaderboard")) return "Chat";
  return null;
}

type SearchType = "tournaments" | "posts" | "friends" | "groups";

type GlobalTournament = {
  id: string;
  tournament_id: string;
  name: string;
  description?: string | null;
  format: string;
  status: string;
  starts_at?: string | null;
  visibility: string;
  max_players: number;
  organizer_id: string;
  banner_path?: string | null;
  profiles?: { display_name?: string | null; username?: string | null } | Array<{ display_name?: string | null; username?: string | null }> | null;
};

const searchOptions: { id: SearchType; label: string; icon: typeof Trophy }[] = [
  { id: "tournaments", label: "Search Tournament", icon: Trophy },
  { id: "posts", label: "Search Posts", icon: FileText },
  { id: "friends", label: "Search Friends", icon: UserPlus },
  { id: "groups", label: "Search Groups", icon: UsersRound },
];

const builtInTournamentResults: GlobalTournament[] = [
  "MatchUp Elite Finals",
  "Night League Championship",
  "Lagos Kings Cup",
  "Weekend Rivals",
  "Pro Division Clash",
  "Friday Night Showdown",
  "MatchUp Champions Cup",
  "Ultimate eFootball Arena",
  "Street to Stadium Cup",
  "Elite Masters League",
  "Next Gen Challenge",
  "Golden Boot Tournament",
  "Super Sunday Knockout",
  "National Rivalry Cup",
  "Legends Championship",
].map((name, index) => ({
  id: `demo-discover-${index + 1}`,
  tournament_id: `DEMO-DISCOVER-${index + 1}`,
  name,
  description: "Open MatchUp competition for competitive eFootball players.",
  format: ["knockout", "group_stage", "league"][index % 3],
  status: "open",
  starts_at: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
  visibility: "public",
  max_players: [32, 64, 128][index % 3],
  organizer_id: "",
  banner_path: "/1002371685.jpg",
}));

function readVisibleSearchLines(type: Exclude<SearchType, "tournaments">, query: string) {
  if (typeof document === "undefined") return [];
  const normalizedQuery = query.trim().toLowerCase();
  const root = document.querySelector("main");
  if (!root) return [];

  const typeTerms: Record<Exclude<SearchType, "tournaments">, string[]> = {
    posts: ["post", "share", "highlight", "gameplay", "feed", "connect", "community"],
    friends: ["friend", "friends", "player", "follow", "followers", "network"],
    groups: ["group", "groups", "community", "team", "teams"],
  };

  const lines = Array.from(root.querySelectorAll("h1,h2,h3,h4,p,a,button,span"))
    .filter((node) => {
      const element = node as HTMLElement;
      if (!element.innerText?.trim()) return false;
      if (element.closest('[role="dialog"], nav')) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((node) => (node as HTMLElement).innerText.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(lines));
  const terms = typeTerms[type];
  return unique
    .filter((line) => {
      const lower = line.toLowerCase();
      return terms.some((term) => lower.includes(term)) && (!normalizedQuery || lower.includes(normalizedQuery));
    })
    .slice(0, 30);
}

export function TopBar() {
  usePathname();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<SearchType | null>(null);
  const [query, setQuery] = useState("");
  const [tournamentResults, setTournamentResults] = useState<GlobalTournament[]>([]);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let cancelled = false;
    const loadTournamentResults = async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id,tournament_id,name,description,format,status,starts_at,visibility,max_players,organizer_id,banner_path,profiles:organizer_id(display_name,username)")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });
      if (!cancelled) setTournamentResults((data || []) as GlobalTournament[]);
    };

    void loadTournamentResults();
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen, supabase]);

  useEffect(() => {
    if (!searchOpen || !searchType || searchType === "tournaments") {
      setVisibleLines([]);
      return;
    }
    const refresh = () => setVisibleLines(readVisibleSearchLines(searchType, query));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [searchOpen, searchType, query]);

  const allTournamentResults = useMemo(() => {
    const seen = new Set<string>();
    return [...tournamentResults, ...builtInTournamentResults].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [tournamentResults]);

  const filteredTournaments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return allTournamentResults.slice(0, 30);
    return allTournamentResults
      .filter((row) => `${row.name} ${row.tournament_id} ${row.format} ${row.description || ""}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 30);
  }, [query, allTournamentResults]);

  const activeSearchOption = searchOptions.find((option) => option.id === searchType);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const openSearch = () => {
    setSearchOpen(true);
    setSearchType(null);
    setQuery("");
    setCategoryMenuOpen(false);
  };

  const chooseSearchType = (type: SearchType) => {
    setSearchType(type);
    setQuery("");
    setCategoryMenuOpen(false);
  };

  return (
    <>
      <header className="relative z-20 flex items-center justify-between pb-5">
        <a href="/" className="wordmark" aria-label="MatchUp home">Match<span>Up</span></a>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Search" onClick={openSearch} className="icon-button"><Search size={19} /></button>
          <button aria-label="Notifications" className="icon-button relative"><Bell size={18} /><span className="notification-dot">3</span></button>
          <a href="/feeds#profile" aria-label="Profile" className="profile-avatar">M<span /></a>
        </div>
      </header>

      {searchOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#03040c]/80 p-1.5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="search-modal-title" onClick={() => setSearchOpen(false)}>
          <div className={`relative flex w-[95vw] flex-col overflow-hidden rounded-[26px] border border-[#302553] bg-[#101024] shadow-[0_20px_70px_rgba(0,0,0,.58)] ${searchType ? "h-[95vh] p-4 sm:p-7" : "p-4 sm:p-7"}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSearchOpen(false)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-[#2b2b45] bg-[#0d0e20] text-[#aaa8bd] transition hover:border-[#7843ee] hover:text-white" aria-label="Close search"><X size={17} /></button>
            <div className="pr-10">
              <h2 id="search-modal-title" className="text-2xl font-black text-white">Search MatchUp</h2>
            </div>

            {!searchType ? (
              <div className="mt-6 grid grid-cols-1 gap-3">
                {searchOptions.map((option) => {
                  const Icon = option.icon;
                  return <button key={option.id} type="button" onClick={() => chooseSearchType(option.id)} className="flex min-h-[92px] w-full items-center gap-4 rounded-2xl border border-[#302b4b] bg-[#17152e] p-4 text-left transition hover:border-[#6f4ad8] hover:bg-[#1a1835]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#251e45] text-[#a979ff]"><Icon size={19} /></span><span className="text-sm font-black text-[#d7d3e4]">{option.label}</span></button>;
                })}
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="flex items-center gap-3 rounded-2xl border border-[#383252] bg-[#0d0e20] px-4 py-3.5 focus-within:border-[#7843ee]"><Search size={19} className="shrink-0 text-[#77728c]" /><input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder={`Search ${activeSearchOption?.label.replace("Search ", "").toLowerCase()}...`} aria-label={`Search ${activeSearchOption?.label || "content"}`} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6d83]" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-[#77728c] hover:text-white"><X size={16} /></button> : null}</label>
                  <div className="relative min-w-0 sm:min-w-[240px]">
                    <button type="button" aria-haspopup="listbox" aria-expanded={categoryMenuOpen} onClick={() => setCategoryMenuOpen((open) => !open)} className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-[#302b4b] bg-[#17152e] px-4 text-sm font-black text-[#d7d3e4] outline-none transition hover:border-[#6f4ad8] focus:border-[#6f4ad8]">
                      <span className="flex min-w-0 items-center gap-2.5 truncate"><activeSearchOption.icon size={17} className="shrink-0 text-[#a979ff]" />{activeSearchOption?.label}</span>
                      <ChevronDown size={17} className={`shrink-0 text-[#9a73ff] transition-transform ${categoryMenuOpen ? "rotate-180" : ""}`} />
                    </button>
                    {categoryMenuOpen ? (
                      <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[#3b315e] bg-[#17152e] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,.48)]">
                        {searchOptions.map((option) => {
                          const Icon = option.icon;
                          return <button key={option.id} type="button" role="option" aria-selected={searchType === option.id} onClick={() => chooseSearchType(option.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${searchType === option.id ? "bg-[#251e45] text-white" : "text-[#d7d3e4] hover:bg-[#1f1c3a] hover:text-white"}`}><Icon size={16} className="text-[#a979ff]" />{option.label}</button>;
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 min-h-0 flex-1 overflow-y-auto scroll-smooth overscroll-contain pr-1 [scrollbar-width:thin]">
                  {searchType === "tournaments" ? (
                    filteredTournaments.length > 0 ? (
                      <div className="grid gap-4 pb-4">
                        {filteredTournaments.map((tournament) => <TournamentCard key={tournament.id} row={tournament as any} category="discover" />)}
                      </div>
                    ) : (
                      <div className="flex min-h-[50vh] items-center justify-center text-center"><div className="max-w-sm"><Search size={26} className="mx-auto text-[#6d4ed2]" /><p className="mt-3 font-bold text-white">{query.trim() ? "No tournaments found" : "No public tournaments yet"}</p><p className="mt-1 text-xs leading-5 text-[#77748a]">{query.trim() ? "Try the tournament name, tournament ID, format, or another search term." : "Public tournaments from across MatchUp will appear here."}</p></div></div>
                    )
                  ) : query.trim() && visibleLines.length > 0 ? (
                    <div className="grid gap-2 pb-4 text-left">{visibleLines.map((result, index) => <div key={`${result}-${index}`} className="rounded-xl border border-[#292743] bg-[#111326] px-4 py-3 text-sm text-[#ddd8eb]"><span className="text-[#a979ff]">{activeSearchOption?.label}:</span> {result}</div>)}</div>
                  ) : (
                    <div className="flex min-h-[50vh] items-center justify-center text-center"><div className="max-w-sm"><Search size={26} className="mx-auto text-[#6d4ed2]" /><p className="mt-3 font-bold text-white">{query.trim() ? "No matches found" : `Search ${activeSearchOption?.label.replace("Search ", "")}`}</p><p className="mt-1 text-xs leading-5 text-[#77748a]">{query.trim() ? "Try another search term or category." : "Type above to start searching."}</p></div></div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const routeActive = getRouteActive(pathname);
  const [selected, setSelected] = useState<string>(routeActive ?? "Home");
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => { if (routeActive) setSelected(routeActive); }, [routeActive]);

  return (
    <>
      <nav className="bottom-nav" aria-label="Main navigation">
        {links.slice(0, 2).map(({ label, icon: Icon, href, route }) => <button key={label} type="button" onClick={() => { setSelected(label); if (route) router.push(href); }} aria-current={selected === label ? "page" : undefined} className={`nav-link ${selected === label ? "active" : ""}`}><Icon size={20} /><span>{label}</span></button>)}
        <button type="button" onClick={() => setCreateOpen(true)} className="create-link" aria-label="Create"><Plus size={28} /></button>
        {links.slice(2).map(({ label, icon: Icon, href, route }) => <button key={label} type="button" onClick={() => { setSelected(label); if (route) router.push(href); }} aria-current={selected === label ? "page" : undefined} className={`nav-link ${selected === label ? "active" : ""}`}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#03040c]/75 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="create-sheet-title" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-t-[26px] border border-b-0 border-[#302553] bg-[#101024] p-5 shadow-[0_-10px_50px_rgba(0,0,0,.5)] sm:rounded-[26px] sm:border-b" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a73ff]">Quick actions</p><h2 id="create-sheet-title" className="mt-1 text-xl font-black text-white">Create</h2></div><button type="button" onClick={() => setCreateOpen(false)} className="grid size-9 place-items-center rounded-full border border-[#2b2b45] bg-[#0d0e20] text-[#aaa8bd] transition hover:border-[#7843ee] hover:text-white" aria-label="Close create menu"><X size={17} /></button></div>
            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/tournaments/new"); }} className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-4 text-sm font-black text-white shadow-[0_0_24px_rgba(112,38,245,.28)] transition hover:brightness-110"><Trophy size={20} /><span className="flex-1 text-left">Create Tournament</span><Plus size={18} /></button>
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/feeds?create=post"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white"><FileText size={20} className="text-[#a979ff]" /><span className="flex-1 text-left">Create Post</span><Plus size={18} className="text-[#a979ff]" /></button>
              <div className="rounded-2xl border border-[#3b315e] bg-[#17152e] p-4"><p className="text-sm font-black text-white">Add New Friends</p><div className="mt-3 grid gap-3"><button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?add=friends"); }} className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3.5 text-xs font-black text-white shadow-[0_0_24px_rgba(112,38,245,.22)] transition hover:brightness-110"><UserPlus size={17} /><span className="flex-1 text-left">Add New Friends</span><Plus size={18} /></button><button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?message=friends"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-3.5 text-xs font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white"><MessageSquare size={17} /><span className="flex-1 text-left">Message Friends</span></button></div></div>
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?create=group"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white"><UsersRound size={20} className="text-[#a979ff]" /><span className="flex-1 text-left">Create Group</span><Plus size={18} className="text-[#a979ff]" /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Navigation() { return <><TopBar /><BottomNav /></>; }
