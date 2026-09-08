'use client';

import Link from 'next/link';

export default function ConfirmationErrorPage() {
  return (
    <main className="min-h-screen bg-[#05060f] px-5 py-8 text-white grid place-items-center">
      <section className="w-full max-w-md rounded-[28px] border border-[#28263f] bg-[#0d0e20] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.45)]">
        <div className="wordmark">Match<span>Up</span></div>
        <div className="mt-8 text-3xl font-black tracking-tight">We couldn&apos;t verify your email.</div>
        <p className="mt-3 text-sm leading-6 text-[#918da3]">
          Your confirmation link may have expired, already been used, or otherwise been rejected by Supabase.
        </p>
        <Link href="/auth" className="mt-7 block w-full rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3.5 text-sm font-black">
          Return to Sign In
        </Link>
      </section>
    </main>
  );
}
