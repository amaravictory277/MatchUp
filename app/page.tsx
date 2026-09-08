import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MatchUp | Play. Compete. Match Up.",
  description: "Welcome to MatchUp — discover players, join tournaments, and compete.",
};

export default function LandingPage() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-[#07142f] text-white">
      <section className="relative mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden bg-[#0a1835] shadow-2xl lg:max-w-none">
        <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/1002371685.jpg')" }} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,24,.82)_0%,rgba(7,20,47,.3)_27%,rgba(7,20,47,.18)_45%,rgba(5,13,30,.9)_79%,#06132d_100%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[42%] bg-[linear-gradient(135deg,rgba(19,49,105,.92),rgba(23,63,139,.35)_62%,transparent)]" />

        <div className="relative z-10 flex h-full min-h-0 flex-col px-6 pb-7 pt-6 sm:px-10 sm:pb-9 sm:pt-8 lg:px-16 lg:pt-10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-lg font-black backdrop-blur-md">M</div>
              <span className="text-xl font-black tracking-[-.04em]">MatchUp</span>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/85 backdrop-blur-md">eFootball</span>
          </header>

          <div className="flex min-h-0 flex-1 items-end pb-3 sm:pb-6 lg:pb-8">
            <div className="w-full">
              <p className="mb-3 text-sm font-semibold tracking-tight text-white/80">Welcome to MatchUp ⚽</p>
              <h1 className="max-w-[620px] text-[43px] font-black leading-[.98] tracking-[-.055em] sm:text-6xl lg:text-7xl">
                Better Matches,
                <br />
                <span className="text-white">Better Competition.</span>
              </h1>
              <p className="mt-4 max-w-[480px] text-sm leading-6 text-white/75 sm:text-base">Find your next opponent, join tournaments, and make every match count.</p>
              <a href="/auth" className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-[#102554] shadow-[0_12px_35px_rgba(0,0,0,.3)] transition hover:-translate-y-0.5 hover:bg-white/95 active:translate-y-0 sm:max-w-[420px]">Let&apos;s Go!</a>
            </div>
          </div>

          <div className="flex justify-center pt-2"><span className="h-1 w-28 rounded-full bg-white/75" aria-hidden="true" /></div>
        </div>
      </section>
    </main>
  );
}
