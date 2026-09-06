"use client";

import { Bell, House, Newspaper, Plus, Search, Trophy, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";

const links = [
  { label: "Home", icon: House, href: "/" },
  { label: "Tournaments", icon: Trophy, href: "/#tournaments" },
  { label: "Feeds", icon: Newspaper, href: "/feeds" },
  { label: "Leaderboard", icon: UsersRound, href: "/#leaderboard" },
];

export function TopBar() {
  return (
    <header className="relative z-20 flex items-center justify-between pb-5">
      <a href="/" className="wordmark" aria-label="MatchUp home">
        Match<span>Up</span>
      </a>
      <div className="flex items-center gap-2">
        <button aria-label="Search" className="icon-button hidden sm:grid">
          <Search size={19} />
        </button>
        <button aria-label="Notifications" className="icon-button relative">
          <Bell size={18} />
          <span className="notification-dot">3</span>
        </button>
        <button aria-label="Profile" className="profile-avatar">
          M<span />
        </button>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname.startsWith(href);
  };

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {links.slice(0, 2).map(({ label, icon: Icon, href }) => (
        <a key={label} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`}>
          <Icon size={20} />
          <span>{label}</span>
        </a>
      ))}
      <a href="/feeds" className="create-link" aria-label="Create post">
        <Plus size={28} />
      </a>
      {links.slice(2).map(({ label, icon: Icon, href }) => (
        <a key={label} href={href} className={`nav-link ${isActive(href) ? "active" : ""}`}>
          <Icon size={20} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export function Navigation() {
  return (
    <>
      <TopBar />
      <BottomNav />
    </>
  );
}
