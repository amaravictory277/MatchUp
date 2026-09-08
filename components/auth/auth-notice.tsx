'use client';

import { CheckCircle2, XCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const NOTICE_MESSAGES = {
  'signed-in': 'Signed in successfully',
  'account-created': 'Your account was successfully created',
} as const;

type Notice = keyof typeof NOTICE_MESSAGES;

export function AuthNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('notice');
    if (!value || !(value in NOTICE_MESSAGES)) return;

    setNotice(value as Notice);
    const url = new URL(window.location.href);
    url.searchParams.delete('notice');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!notice) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(12px+env(safe-area-inset-top))]">
      <div role="status" aria-live="polite" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-emerald-300/25 bg-white px-4 py-3 text-sm font-extrabold text-[#101216] shadow-[0_14px_35px_rgba(0,0,0,.16)]">
        <CheckCircle2 className="shrink-0 text-emerald-600" size={20} strokeWidth={2.5} />
        <span className="flex-1">{NOTICE_MESSAGES[notice]}</span>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)} className="shrink-0 rounded-full p-1 text-[#777b84] transition hover:bg-black/5 hover:text-[#20232a]">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function AuthErrorNotice({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(12px+env(safe-area-inset-top))]">
      <div role="alert" aria-live="assertive" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-red-200/80 bg-white px-4 py-3 text-sm font-extrabold text-[#17181c] shadow-[0_14px_35px_rgba(0,0,0,.16)]">
        <XCircle className="shrink-0 text-red-600" size={20} strokeWidth={2.5} />
        <span className="flex-1">{message}</span>
      </div>
    </div>
  );
}
