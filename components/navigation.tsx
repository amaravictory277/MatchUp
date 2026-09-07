"use client";

import { Bell, House, MessageSquare, Newspaper, Plus, Search, Trophy, X, FileText, UserPlus, UsersRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export function TopBar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<"tournaments" | "posts" | "friends" | "groups">("tournaments");
  const [query, setQuery] = useState("");
  const isHome = pathname === "/";

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [searchOpen]);

  const searchOptions = [
    { id: "tournaments" as const, label: "Search Tournament", icon: Trophy },
    { id: "posts" as const, label: "Search Posts", icon: FileText },
    { id: "friends" as const, label: "Search Friends", icon: UserPlus },
    { id: "groups" as const, label: "Search Groups", icon: UsersRound },
  ];

  return (
    <>
      <header className="relative z-20 flex items-center justify-between pb-5">
        <a href="/" className="wordmark" aria-label="MatchUp home">Match<span>Up</span></a>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Search" onClick={() => isHome && setSearchOpen(true)} className="icon-button hidden sm:grid"><Search size={19} /></button>
          <button aria-label="Notifications" className="icon-button relative"><Bell size={18} /><span className="notification-dot">3</span></button>
          <a href="/feeds#profile" aria-label="Profile" className="profile-avatar">M<span /></a>
        </div>
      </header>

      {searchOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[#03040c]/80 p-0 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="search-modal-title" onClick={() => setSearchOpen(false)}>
          <div className="relative flex h-[80vh] w-[80vw] flex-col overflow-hidden rounded-[26px] border border-[#302553] bg-[#101024] p-5 shadow-[0_20px_70px_rgba(0,0,0,.58)] sm:p-7" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSearchOpen(false)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-[#2b2b45] bg-[#0d0e20] text-[#aaa8bd] transition hover:border-[#7843ee] hover:text-white" aria-label="Close search">
              <X size={17} />
            </button>
            <div className="pr-10">
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a73ff]">Find anything</p>
              <h2 id="search-modal-title" className="mt-1 text-2xl font-black text-white">Search MatchUp</h2>
              <p className="mt-1 text-sm leading-5 text-[#9694aa]">Choose what you want to search without leaving the homepage.</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {searchOptions.map((option) => {
                const Icon = option.icon;
                const active = searchType === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setSearchType(option.id)} className={`flex min-h-[92px] flex-col items-start justify-between rounded-2xl border p-4 text-left transition ${active ? "border-[#7843ee] bg-[#24184b] shadow-[0_0_24px_rgba(112,38,245,.18)]" : "border-[#302b4b] bg-[#17152e] hover:border-[#5f4b95]"}`}>
                    <span className={`grid size-10 place-items-center rounded-xl ${active ? "bg-[#6d27ff] text-white" : "bg-[#251e45] text-[#a979ff]"}`}><Icon size={19} /></span>
                    <span className={`text-xs font-black ${active ? "text-white" : "text-[#d7d3e4]"}`}>{option.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-[#383252] bg-[#0d0e20] px-4 py-3.5 focus-within:border-[#7843ee]">
              <Search size={19} className="shrink-0 text-[#77728c]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder={`Search ${searchType}...`} aria-label={`Search ${searchType}`} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f6d83]" />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-[#77728c] hover:text-white"><X size={16} /></button> : null}
            </label>

            <div className="mt-4 flex min-h-0 flex-1 items-start justify-center overflow-auto rounded-2xl border border-dashed border-[#292743] bg-[#0b0c19]/60 p-6 text-center">
              <div className="max-w-sm pt-5">
                <Search size={26} className="mx-auto text-[#6d4ed2]" />
                <p className="mt-3 font-bold text-white">Search {searchType}</p>
                <p className="mt-1 text-xs leading-5 text-[#77748a]">Your search results will stay inside this popup on the homepage.</p>
              </div>
            </div>
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
        {links.slice(0, 2).map(({ label, icon: Icon, href, route }) => (
          <button key={label} type="button" onClick={() => { setSelected(label); if (route) router.push(href); }} aria-current={selected === label ? "page" : undefined} className={`nav-link ${selected === label ? "active" : ""}`}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
        <button type="button" onClick={() => setCreateOpen(true)} className="create-link" aria-label="Create"><Plus size={28} /></button>
        {links.slice(2).map(({ label, icon: Icon, href, route }) => (
          <button key={label} type="button" onClick={() => { setSelected(label); if (route) router.push(href); }} aria-current={selected === label ? "page" : undefined} className={`nav-link ${selected === label ? "active" : ""}`}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
      </nav>
      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#03040c]/75 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="create-sheet-title" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-t-[26px] border border-b-0 border-[#302553] bg-[#101024] p-5 shadow-[0_-10px_50px_rgba(0,0,0,.5)] sm:rounded-[26px] sm:border-b" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9a73ff]">Quick actions</p>
                <h2 id="create-sheet-title" className="mt-1 text-xl font-black text-white">Create</h2>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="grid size-9 place-items-center rounded-full border border-[#2b2b45] bg-[#0d0e20] text-[#aaa8bd] transition hover:border-[#7843ee] hover:text-white" aria-label="Close create menu">
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/tournaments/new"); }} className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-4 text-sm font-black text-white shadow-[0_0_24px_rgba(112,38,245,.28)] transition hover:brightness-110">
                <Trophy size={20} />
                <span className="flex-1 text-left">Create Tournament</span>
                <Plus size={18} />
              </button>
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/feeds?create=post"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white">
                <FileText size={20} className="text-[#a979ff]" />
                <span className="flex-1 text-left">Create Post</span>
                <Plus size={18} className="text-[#a979ff]" />
              </button>
              <div className="rounded-2xl border border-[#3b315e] bg-[#17152e] p-4">
                <p className="text-sm font-black text-white">Add New Friends</p>
                <div className="mt-3 grid gap-3">
                  <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?add=friends"); }} className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3.5 text-xs font-black text-white shadow-[0_0_24px_rgba(112,38,245,.22)] transition hover:brightness-110">
                    <UserPlus size={17} />
                    <span className="flex-1 text-left">Add New Friends</span>
                    <Plus size={18} />
                  </button>
                  <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?message=friends"); }} className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3.5 text-xs font-black text-white shadow-[0_0_24px_rgba(112,38,245,.22)] transition hover:brightness-110">
                    <MessageSquare size={17} />
                    <span className="flex-1 text-left">Message Friends</span>
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?create=group"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white">
                <UsersRound size={20} className="text-[#a979ff]" />
                <span className="flex-1 text-left">Create Group</span>
                <Plus size={18} className="text-[#a979ff]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Navigation() { return <><TopBar /><BottomNav /></>; }
