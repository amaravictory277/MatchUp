import { Bell, Gamepad2, House, Plus, Search, Trophy, UsersRound } from "lucide-react";

const links = [
  { label: "Home", icon: House, href: "/" },
  { label: "Tournaments", icon: Trophy, href: "#tournaments" },
  { label: "Games", icon: Gamepad2, href: "#games" },
  { label: "Leaderboard", icon: UsersRound, href: "#leaderboard" },
];

export function Navigation() {
  return (
    <>
      <header className="relative z-20 flex items-center justify-between pb-5">
        <a href="/" className="wordmark" aria-label="MatchUp home">Match<span>Up</span></a>
        <div className="flex items-center gap-2">
          <button aria-label="Search" className="icon-button hidden sm:grid"><Search size={19} /></button>
          <button aria-label="Notifications" className="icon-button relative"><Bell size={18} /><span className="notification-dot">3</span></button>
          <button aria-label="Profile" className="profile-avatar">M<span /></button>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Main navigation">
        {links.slice(0, 2).map(({ label, icon: Icon, href }) => <a key={label} href={href} className={`nav-link ${label === "Home" ? "active" : ""}`}><Icon size={20} /><span>{label}</span></a>)}
        <a href="#create" className="create-link" aria-label="Create tournament"><Plus size={28} /></a>
        {links.slice(2).map(({ label, icon: Icon, href }) => <a key={label} href={href} className="nav-link"><Icon size={20} /><span>{label}</span></a>)}
      </nav>
    </>
  );
}
