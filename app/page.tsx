import type { Metadata } from "next";
import { ArrowRight, Gamepad2, ShieldCheck, Trophy, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "MatchUp | Competitive eFootball",
  description: "Enter MatchUp and discover competitive eFootball tournaments.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#05060f] px-5 py-6 text-white sm:px-8">
      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[#2d2945] bg-[#0b0d1b] shadow-[0_24px_100px_rgba(0,0,0,.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(117,57,255,.25),transparent_30%),linear-gradient(135deg,#101126_0%,#080914_55%,#130d24_100%)]" />
        <div className="absolute right-[-12%] top-[12%] h-[58%] w-[60%] rounded-full bg-[url('/1002371685.jpg')] bg-cover bg-center opacity-25 blur-[1px] sm:opacity-40" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b0d1b_0%,rgba(11,13,27,.9)_38%,rgba(11,13,27,.25)_100%)]" />
        <div className="relative z-10 flex flex-1 flex-col px-6 pb-8 pt-7 sm:px-12 sm:pb-12 sm:pt-10">
          <div className="wordmark">Match<span>Up</span></div>
          <div className="flex flex-1 items-center py-14 sm:py-20">
            <div className="max-w-xl">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#a979ff]">THE HOME OF EFOOTBALL TOURNAMENTS</p>
              <h1 className="mt-5 text-[48px] font-black leading-[.92] tracking-[-.055em] sm:text-7xl">Your next match<br /><span className="hero-gradient">starts here.</span></h1>
              <p className="mt-6 max-w-md text-sm leading-6 text-[#c3bfce] sm:text-base">Create, discover and compete in MatchUp tournaments built for players who want every match to count.</p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs font-bold text-[#d4d0df]">
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Trophy size={14} className="text-[#a979ff]" />Competitive cups</span>
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Users size={14} className="text-[#81d63f]" />Real players</span>
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Gamepad2 size={14} className="text-[#4d8bff]" />eFootball</span>
              </div>
              <a href="/auth" className="hero-button mt-8 flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black text-white sm:w-auto">LET&apos;S GO <ArrowRight size={18} /></a>
              <p className="mt-4 flex items-center gap-2 text-[11px] text-[#807c90]"><ShieldCheck size={14} />Secure account authentication powered by MatchUp.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
