import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Gamepad2,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Navigation } from "../components/navigation";

type Tournament = { name: string; tag: string; players: string; format: string; prize: string; image: string; accent: "violet" | "green" | "blue" };

const pinnedTournaments: Tournament[] = [
  { name: "Elite Showdown", tag: "PINNED", players: "128 Players", format: "Knockout", prize: "₦25,000", image: "https://images.pexels.com/photos/36000773/pexels-photo-36000773.jpeg?auto=compress&cs=tinysrgb&w=900", accent: "green" },
  { name: "Legends Cup", tag: "PINNED", players: "64 Players", format: "Knockout", prize: "₦15,000", image: "https://images.pexels.com/photos/7005503/pexels-photo-7005503.jpeg?auto=compress&cs=tinysrgb&w=900", accent: "violet" },
  { name: "Weekend Clash", tag: "PINNED", players: "32 Players", format: "Group Stage", prize: "₦10,000", image: "https://images.pexels.com/photos/27348425/pexels-photo-27348425.jpeg?auto=compress&cs=tinysrgb&w=900", accent: "blue" },
];

const featuredTournaments: Tournament[] = [
  { name: "MatchUp Champions Cup", tag: "FEATURED", players: "128 Players", format: "Knockout", prize: "₦50,000", image: "https://images.pexels.com/photos/27348425/pexels-photo-27348425.jpeg?auto=compress&cs=tinysrgb&w=1400", accent: "violet" },
  { name: "Friday Night Showdown", tag: "FEATURED", players: "64 Players", format: "Knockout", prize: "₦20,000", image: "https://images.pexels.com/photos/36000773/pexels-photo-36000773.jpeg?auto=compress&cs=tinysrgb&w=1400", accent: "green" },
  { name: "Weekend Battle Arena", tag: "FEATURED", players: "256 Players", format: "Group Stage", prize: "₦30,000", image: "https://images.pexels.com/photos/7005503/pexels-photo-7005503.jpeg?auto=compress&cs=tinysrgb&w=1400", accent: "blue" },
];

const accentStyles = {
  violet: { badge: "bg-[#6d27ff]", button: "bg-[#6d27ff] shadow-[0_0_24px_rgba(109,39,255,.45)]", icon: "text-[#9a73ff]", glow: "bg-[#6929ff]" },
  green: { badge: "bg-[#62c51f]", button: "bg-[#62c51f] shadow-[0_0_24px_rgba(98,197,31,.3)]", icon: "text-[#7ce53a]", glow: "bg-[#57bd29]" },
  blue: { badge: "bg-[#2367ff]", button: "bg-[#2367ff] shadow-[0_0_24px_rgba(35,103,255,.4)]", icon: "text-[#4d8bff]", glow: "bg-[#2367ff]" },
};

function SectionTitle({ children }: { children: React.ReactNode }) { return <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl"><Sparkles size={17} className="text-[#9a73ff]" />{children}</h2><a href="/tournaments" className="flex items-center gap-1 text-xs font-semibold text-[#a979ff] transition hover:text-white">See All <ChevronRight size={15} /></a></div>; }

function PinnedCard({ tournament }: { tournament: Tournament }) {
  const accent = accentStyles[tournament.accent];
  return <article className="tournament-card group min-w-[238px] flex-1 overflow-hidden sm:min-w-[260px]">
    <div className="relative h-32 overflow-hidden bg-[#1d1a36]"><div className="absolute inset-0 bg-cover bg-center opacity-75 transition duration-500 group-hover:scale-105" style={{ backgroundImage: `linear-gradient(180deg, transparent 20%, #0a0b19 100%), url(${tournament.image})` }} /><span className={`absolute left-3 top-3 rounded-md ${accent.badge} px-2 py-1 text-[10px] font-black tracking-wide text-white`}>Pinned</span></div>
    <div className="p-4"><h3 className="font-bold text-white">{tournament.name}</h3><div className="mt-2 flex gap-3 text-[11px] text-[#aaa8ba]"><span className="flex items-center gap-1"><Users size={13} />{tournament.players}</span><span className="flex items-center gap-1"><Trophy size={13} />{tournament.format}</span></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[11px] text-[#9694a8]">Prize Pool</p><p className="mt-0.5 text-base font-black text-white">{tournament.prize}</p></div><span className={`grid size-9 place-items-center rounded-xl ${accent.glow} ${accent.icon} shadow-lg`}><Trophy size={18} /></span></div></div>
  </article>;
}

function FeaturedCard({ tournament }: { tournament: Tournament }) {
  const accent = accentStyles[tournament.accent];
  return <article className="tournament-card overflow-hidden"><div className="relative h-28 overflow-hidden sm:h-32"><div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: `linear-gradient(180deg, rgba(12,12,30,.08), #0b0c18 100%), url(${tournament.image})` }} /><span className={`absolute left-4 top-4 rounded-md ${accent.badge} px-2.5 py-1 text-[10px] font-black tracking-wide text-white`}>{tournament.tag}</span></div><div className="relative -mt-px grid gap-5 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"><div><h3 className="text-lg font-bold text-white">{tournament.name}</h3><div className="mt-2 flex flex-wrap gap-3 text-xs text-[#c0bdcd]"><span className="flex items-center gap-1"><Users size={14} />{tournament.players}</span><span className="flex items-center gap-1"><Trophy size={14} />{tournament.format}</span><span className="flex items-center gap-1 text-[#81d63f]"><CalendarDays size={14} />Starts in 2d 14h</span></div></div><div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end"><div className="rounded-xl bg-[#17172a] px-4 py-2"><p className="text-[10px] text-[#aaa8ba]">Prize Pool</p><p className="font-black text-white">{tournament.prize}</p></div><a href="/tournaments" className={`flex items-center justify-center gap-2 rounded-xl ${accent.button} px-5 py-2.5 text-xs font-bold text-white transition hover:brightness-110`}>View Tournament <ArrowRight size={15} /></a></div></div></article>;
}

export default function Home() {
  return <main className="app-shell"><Navigation />
    <section className="hero relative overflow-hidden rounded-[28px] px-5 pb-8 pt-5 sm:px-8 sm:pb-12 sm:pt-8"><div className="hero-player" aria-hidden="true" /><div className="relative z-10 max-w-[470px]"><p className="max-w-[300px] text-[11px] font-bold leading-[1.65] tracking-[.18em] text-[#d4d0df]"><span className="block">THE HOME OF EFOOTBALL</span><span className="block">TOURNAMENTS</span></p><h1 className="mt-5 text-[42px] font-black leading-[.94] tracking-[-.05em] text-white sm:text-6xl">Find your next<br /><span className="hero-gradient">competition.</span></h1><p className="mt-5 max-w-[315px] text-sm leading-6 text-[#d3d0dd]">Create, discover and run competitive EFootball tournaments—all in one match-ready place.</p><div className="mt-5 grid max-w-[280px] gap-3"><a href="/tournaments/new" className="hero-button flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-xs font-black text-white"><Trophy size={16} />CREATE TOURNAMENT</a><a href="/tournaments" className="flex items-center justify-center gap-3 rounded-xl border border-[#35334e] bg-[#0f1020]/70 px-4 py-3 text-xs font-bold text-white transition hover:border-[#7444ed]"><Search size={17} />FIND TOURNAMENT</a></div></div></section>
    <section className="relative mt-7 h-[170px] overflow-hidden rounded-[28px] border border-[#30284d] bg-[radial-gradient(circle_at_80%_20%,rgba(109,39,255,.25),transparent_35%),linear-gradient(135deg,#121128_0%,#1a1534_55%,#101122_100%)] shadow-[0_18px_50px_rgba(17,10,40,.26)] sm:h-[160px]"><div className="absolute inset-y-0 right-0 w-[34%] overflow-hidden border-l border-[#2f2948] sm:w-[31%]"><div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(90deg, rgba(16,15,34,.86) 0%, rgba(16,15,34,.18) 100%), url(${pinnedTournaments[1].image})` }} /><div className="absolute bottom-3 right-3 rounded-xl border border-white/10 bg-[#0e0d1a]/70 px-3 py-2 backdrop-blur-md"><span className="rounded-lg bg-[#6d27ff] px-2 py-1 text-[9px] font-black text-white">Pinned</span></div></div><div className="relative z-10 flex h-full w-[72%] flex-col justify-center p-4 sm:w-[68%] sm:p-5"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#5d43a1] bg-[#24184b] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-[#c2a8ff]"><Zap size={11} /> Tournament Boost</div><h2 className="mt-2 text-lg font-black tracking-tight text-white sm:text-2xl">Boost Your Tournament &amp; Get Pinned</h2><p className="mt-1 max-w-[520px] text-[11px] leading-4 text-[#c7c2d5] sm:text-xs sm:leading-5">Boost your tournament with as little as <strong className="text-white">₦100</strong> and get it pinned to the top for <strong className="text-white">5 hours</strong>.</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-semibold text-[#aaa4bd]"><span className="rounded-full bg-[#17152a] px-2.5 py-1">From ₦100</span><span className="rounded-full bg-[#17152a] px-2.5 py-1">Pinned for 5 hours</span><a href="/tournaments/new" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6d27ff] px-3 py-1.5 text-[9px] font-black text-white shadow-[0_0_20px_rgba(109,39,255,.35)] transition hover:brightness-110">Boost Tournament <ArrowRight size={12} /></a></div></div></section>
    <section className="mt-7" id="tournaments"><SectionTitle>Featured Boosted Tournament</SectionTitle><div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">{pinnedTournaments.map((tournament) => <PinnedCard key={tournament.name} tournament={tournament} />)}</div></section>
    <section className="mt-7"><SectionTitle>Featured Tournaments</SectionTitle><div className="grid gap-3">{featuredTournaments.map((tournament) => <FeaturedCard key={tournament.name} tournament={tournament} />)}</div></section>
    <section className="mt-7 grid gap-3 sm:grid-cols-2"><div className="surface-card flex items-center gap-4 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#25134e] text-[#a979ff]"><Gamepad2 size={22} /></span><div><p className="text-xs text-[#a7a5b7]">Ready to compete?</p><h2 className="font-bold text-white">Join a tournament today</h2></div><ArrowRight className="ml-auto text-[#8e61ed]" size={17} /></div><div className="surface-card flex items-center gap-4 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#152e24] text-[#72d33b]"><ShieldCheck size={22} /></span><div><p className="text-xs text-[#a7a5b7]">Fair play, always</p><h2 className="font-bold text-white">Every match counts</h2></div></div></section><div className="h-8" /></main>;
}
