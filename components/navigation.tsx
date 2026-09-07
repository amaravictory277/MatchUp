"use client";

import { Bell, House, MessageSquare, Newspaper, Plus, Search, Trophy, X, Users, FileText, UserPlus, UsersRound } from "lucide-react";
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
  return (
    <header className="relative z-20 flex items-center justify-between pb-5">
      <a href="/" className="wordmark" aria-label="MatchUp home">Match<span>Up</span></a>
      <div className="flex items-center gap-2">
        <button aria-label="Search" className="icon-button hidden sm:grid"><Search size={19} /></button>
        <button aria-label="Notifications" className="icon-button relative"><Bell size={18} /><span className="notification-dot">3</span></button>
        <a href="/feeds#profile" aria-label="Profile" className="profile-avatar">M<span /></a>
      </div>
    </header>
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
                <Trophy size={20} />Create Tournament
              </button>
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/feeds?create=post"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white">
                <FileText size={20} className="text-[#a979ff]" />Create Post
              </button>
              <div className="rounded-2xl border border-[#3b315e] bg-[#17152e] p-4">
                <p className="text-sm font-black text-white">Add New Friends</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?add=friends"); }} className="flex items-center justify-center gap-2 rounded-xl border border-[#4a3a7a] bg-[#1f1a3d] px-3 py-3 text-xs font-black text-[#c8adff] transition hover:border-[#7843ee] hover:text-white">
                    <UserPlus size={16} />Add Friends
                  </button>
                  <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?message=friends"); }} className="flex items-center justify-center gap-2 rounded-xl border border-[#4a3a7a] bg-[#1f1a3d] px-3 py-3 text-xs font-black text-[#c8adff] transition hover:border-[#7843ee] hover:text-white">
                    <MessageSquare size={16} />Message Friends
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => { setCreateOpen(false); router.push("/leaderboard?create=group"); }} className="flex items-center gap-3 rounded-2xl border border-[#3b315e] bg-[#17152e] px-4 py-4 text-sm font-black text-[#ddd8f0] transition hover:border-[#7843ee] hover:text-white">
                <UsersRound size={20} className="text-[#a979ff]" />Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Navigation() { return <><TopBar /><BottomNav /></>; }
