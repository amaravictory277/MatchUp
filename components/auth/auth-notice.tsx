'use client';

import { CheckCircle2, XCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const NOTICE_MESSAGES = {
  'signed-in': 'Signed in successfully',
  'account-created': 'Your account was successfully created',
} as const;

type Notice = keyof typeof NOTICE_MESSAGES;

function NoticeBar({ message, error = false, onDismiss }: { message: string; error?: boolean; onDismiss?: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(12px+env(safe-area-inset-top))]">
      <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm font-extrabold text-[#101216] shadow-[0_14px_35px_rgba(0,0,0,.16)] ${error ? 'border-red-200/80' : 'border-emerald-300/25'}`}>
        {error ? <XCircle className="shrink-0 text-red-600" size={20} strokeWidth={2.5} /> : <CheckCircle2 className="shrink-0 text-emerald-600" size={20} strokeWidth={2.5} />}
        <span className="flex-1">{message}</span>
        {onDismiss ? <button type="button" aria-label="Dismiss notification" onClick={onDismiss} className="shrink-0 rounded-full p-1 text-[#777b84] transition hover:bg-black/5 hover:text-[#20232a]"><X size={16} /></button> : null}
      </div>
    </div>
  );
}

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

  return notice ? <NoticeBar message={NOTICE_MESSAGES[notice]} onDismiss={() => setNotice(null)} /> : null;
}

export function AuthSuccessNotice({ message }: { message: string }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  return visible && message ? <NoticeBar message={message} /> : null;
}

export function AuthErrorNotice({ message }: { message: string }) {
  return message ? <NoticeBar message={message} error /> : null;
}
