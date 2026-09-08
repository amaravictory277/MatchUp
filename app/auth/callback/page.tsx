'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../../lib/supabase/client';
import { syncAuthSession } from '../../../lib/auth/session';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { if (active) setError(exchangeError.message); return; }
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) { if (active) setError(sessionError?.message || 'Your authentication link is invalid or expired.'); return; }
      await syncAuthSession(data.session.access_token, data.session.refresh_token);
      router.replace(params.get('next') || '/'); router.refresh();
    })();
    return () => { active = false; };
  }, [params, router, supabase]);

  return <main className="min-h-screen bg-[#05060f] px-5 py-8 text-white grid place-items-center"><section className="w-full max-w-md rounded-[28px] border border-[#28263f] bg-[#0d0e20] p-8 text-center">{error ? <><div className="text-xl font-black">Authentication failed</div><p className="mt-2 text-sm text-[#918da3]">{error}</p><button type="button" onClick={() => router.replace('/auth')} className="mt-6 w-full rounded-2xl bg-[#7026f5] px-4 py-3.5 text-sm font-black">Return to sign in</button></> : <><Loader2 className="mx-auto animate-spin text-[#9a73ff]" size={30} /><p className="mt-4 font-bold">Securing your MatchUp session…</p></>}</section></main>;
}
