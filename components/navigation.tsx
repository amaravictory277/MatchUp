"use client";

import { Bell, House, Newspaper, Plus, Search, Trophy, UsersRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { label: "Home", icon: House, href: "/", route: true },
  { label: "Tournaments", icon: Trophy, href: "/tournaments", route: true },
  { label: "Feeds", icon: Newspaper, href: "/feeds", route: true },
  { label: "Chat", icon: UsersRound, href: "/leaderboard", route: true },
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
  useEffect(() => { if (routeActive) setSelected(routeActive); }, [routeActive]);

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {links.slice(0, 2).map(({ label, icon: Icon, href, route }) => (
        <button key={label} type="button" onClick={() => { setSelected(label); if (route) router.push(href); }} aria-current={selected === label ? "page" : undefined} className={`nav-link ${selected === label ? "active" : ""}`}>
          <Icon size={20} /><span>{label}</span>
        </button>
      ))}
      <button type="button" onClick={() => router.push("/feeds")} className="create-link" aria-label="Create post"><Plus size={28} /></button>
      {links.slice(2).map(({ label, icon: Icon, href, route }) => (
        <button key={label} type="button" onClick={() => { setSelected(label); if (route) router.push(href); }} aria-current={selected === label ? "page" : undefined} className={`nav-link ${selected === label ? "active" : ""}`}>
          <Icon size={20} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Navigation() { return <><TopBar /><BottomNav /></>; }
