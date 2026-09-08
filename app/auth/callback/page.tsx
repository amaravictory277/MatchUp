'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../../lib/supabase/client';
import { syncAuthSession } from '../../../lib/auth/session';

const DEFAULT_NEXT_PATH = '/home';

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT_PATH;
  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const nextPath = getSafeNextPath(params.get('next'));
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const callbackError = hashParams.get('error_description') || hashParams.get('error');
        if (callbackError) throw new Error(callbackError);

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error('Your authentication link is invalid or expired.');

        // Supabase has already verified the code and returned the real session.
        // The server verifies that access token again before issuing MatchUp's
        // HTTP-only session cookies used by protected routes.
        await syncAuthSession(data.session.access_token, data.session.refresh_token);
        document.cookie = 'matchup-guest=; Max-Age=0; Path=/; SameSite=Lax';

        if (active) {
          router.replace(nextPath);
          router.refresh();
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Authentication failed.');
      }
    })();
    return () => { active = false; };
  }, [router, supabase]);

  return <main className="min-h-screen bg-[#05060f] px-5 py-8 text-white grid place-items-center"><section className="w-full max-w-md rounded-[28px] border border-[#28263f] bg-[#0d0e20] p-8 text-center">{error ? <><div className="text-xl font-black">Authentication failed</div><p className="mt-2 text-sm text-[#918da3]">{error}</p><button type="button" onClick={() => router.replace('/auth')} className="mt-6 w-full rounded-2xl bg-[#7026f5] px-4 py-3.5 text-sm font-black">Return to sign in</button></> : <><Loader2 className="mx-auto animate-spin text-[#9a73ff]" size={30} /><p className="mt-4 font-bold">Securing your MatchUp session…</p></>}</section></main>;
}
