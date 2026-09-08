'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../../lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) setError(authError.message); else { setDone(true); await supabase.auth.signOut(); }
    setBusy(false);
  };

  return <main className="min-h-screen bg-[#05060f] px-5 py-8 text-white sm:grid sm:place-items-center"><section className="mx-auto w-full max-w-md rounded-[28px] border border-[#28263f] bg-[#0d0e20] p-6 shadow-[0_24px_80px_rgba(0,0,0,.45)] sm:p-8"><button type="button" onClick={() => router.push('/auth')} className="icon-button mb-6" aria-label="Back"><ArrowLeft size={18} /></button><div className="wordmark">Match<span>Up</span></div>{done ? <div className="mt-10 text-center"><CheckCircle2 size={42} className="mx-auto text-[#78d442]" /><h1 className="mt-4 text-2xl font-black">Password updated</h1><p className="mt-2 text-sm text-[#918da3]">Your password was changed successfully. Sign in with the new password.</p><button type="button" onClick={() => router.replace('/auth?mode=signin')} className="mt-6 w-full rounded-2xl bg-[#7026f5] px-4 py-3.5 text-sm font-black">Return to sign in</button></div> : <><h1 className="mt-8 text-3xl font-black">Create a new password</h1><p className="mt-2 text-sm leading-6 text-[#918da3]">This page is available only through a valid Supabase recovery session.</p>{!ready ? <div className="mt-7 rounded-2xl border border-[#3a315c] bg-[#17152e] p-4 text-sm text-[#c6bfd6]">Waiting for your secure password-reset session…</div> : <form onSubmit={submit} className="mt-7 space-y-4"><label className="block"><span className="mb-2 block text-xs font-bold text-[#aaa7b9]">New password</span><span className="flex items-center gap-3 rounded-2xl border border-[#292840] bg-[#080916] px-4 focus-within:border-[#7843ee]"><LockKeyhole size={17} className="text-[#77738b]" /><input required minLength={8} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none" /><button type="button" onClick={() => setShow((v) => !v)} className="text-[#77738b]" aria-label="Toggle password visibility">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><input required minLength={8} type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-2xl border border-[#292840] bg-[#080916] px-4 py-3.5 text-sm outline-none focus:border-[#7843ee]" placeholder="Confirm new password" />{error ? <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{error}</p> : null}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3.5 text-sm font-black disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : null}Update password</button></form>}</>}</section></main>;
}
