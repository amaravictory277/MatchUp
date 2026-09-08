'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import { syncAuthSession } from '../../lib/auth/session';

type Mode = 'signin' | 'signup' | 'forgot' | 'verify';

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try { await syncAuthSession(session.access_token, session.refresh_token); } catch { /* The browser session remains managed by Supabase. */ }
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) throw new Error('No session was returned. Please try again.');
        await syncAuthSession(data.session.access_token, data.session.refresh_token);
        router.replace('/'); router.refresh(); return;
      }
      if (mode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirm) throw new Error('Passwords do not match.');
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (data.session) { await syncAuthSession(data.session.access_token, data.session.refresh_token); router.replace('/'); router.refresh(); return; }
        setMode('verify'); setMessage('Check your email for the secure MatchUp verification link.'); return;
      }
      if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/reset-password` });
        if (authError) throw authError;
        setMessage('If an account exists for that email, Supabase has sent a password-reset email.'); return;
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: authError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (authError) throw authError;
      setMessage('A new verification email has been sent.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not resend verification email.'); }
    finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (authError) { setError(authError.message); setBusy(false); }
  };

  return <main className="min-h-screen bg-[#05060f] px-5 py-8 text-white sm:grid sm:place-items-center">
    <section className="mx-auto w-full max-w-md rounded-[28px] border border-[#28263f] bg-[#0d0e20] p-6 shadow-[0_24px_80px_rgba(0,0,0,.45)] sm:p-8">
      <button type="button" onClick={() => router.push('/')} className="icon-button mb-6" aria-label="Back to MatchUp"><ArrowLeft size={18} /></button>
      <div className="wordmark">Match<span>Up</span></div>
      <div className="mt-8"><div className="flex size-12 items-center justify-center rounded-2xl bg-[#241545] text-[#aa7aff]"><ShieldCheck size={24} /></div><h1 className="mt-5 text-3xl font-black">{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'verify' ? 'Verify your email' : 'Welcome back'}</h1><p className="mt-2 text-sm leading-6 text-[#918da3]">{mode === 'verify' ? 'We need to confirm you control this email before your MatchUp account is activated.' : 'Join the home of competitive eFootball tournaments.'}</p></div>
      {mode === 'verify' ? <div className="mt-7 rounded-2xl border border-[#30284a] bg-[#151329] p-5"><CheckCircle2 className="text-[#78d442]" size={25} /><p className="mt-3 text-sm font-bold text-white">Verification email sent</p><p className="mt-1 text-xs leading-5 text-[#8f8ba0]">Open the email sent to <strong className="text-white">{email}</strong>. The link expires and can only be used once by the authentication provider.</p><button type="button" disabled={busy} onClick={resend} className="mt-5 w-full rounded-xl bg-[#7026f5] px-4 py-3 text-xs font-black disabled:opacity-60">{busy ? 'Sending…' : 'Resend verification email'}</button></div> : <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block"><span className="mb-2 block text-xs font-bold text-[#aaa7b9]">Email address</span><span className="flex items-center gap-3 rounded-2xl border border-[#292840] bg-[#080916] px-4 focus-within:border-[#7843ee]"><Mail size={17} className="text-[#77738b]" /><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none" placeholder="you@example.com" /></span></label>
        {mode !== 'forgot' ? <label className="block"><span className="mb-2 block text-xs font-bold text-[#aaa7b9]">Password</span><span className="flex items-center gap-3 rounded-2xl border border-[#292840] bg-[#080916] px-4 focus-within:border-[#7843ee]"><LockKeyhole size={17} className="text-[#77738b]" /><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="text-[#77738b]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label> : null}
        {mode === 'signup' ? <label className="block"><span className="mb-2 block text-xs font-bold text-[#aaa7b9]">Confirm password</span><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-2xl border border-[#292840] bg-[#080916] px-4 py-3.5 text-sm outline-none focus:border-[#7843ee]" placeholder="Repeat your password" /></label> : null}
        {error ? <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">{error}</p> : null}{message ? <p role="status" className="rounded-xl border border-[#4b3a73] bg-[#1a1430] px-3 py-2.5 text-xs text-[#d0baff]">{message}</p> : null}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,#7026f5,#8e37ff)] px-4 py-3.5 text-sm font-black disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={17} /> : null}{mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset email' : 'Sign in'}</button>
        {mode === 'signin' ? <button type="button" onClick={google} disabled={busy} className="w-full rounded-2xl border border-[#2b2b43] bg-[#121326] px-4 py-3.5 text-sm font-black text-white disabled:opacity-60">Continue with Google</button> : null}
      </form>}
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-[#858195]">{mode === 'signin' ? <><span>New to MatchUp?</span><button onClick={() => setMode('signup')} className="font-bold text-[#ad7cff]">Create account</button><span>·</span><button onClick={() => setMode('forgot')} className="font-bold text-[#ad7cff]">Forgot password?</button></> : mode === 'signup' ? <><span>Already have an account?</span><button onClick={() => setMode('signin')} className="font-bold text-[#ad7cff]">Sign in</button></> : <button onClick={() => setMode('signin')} className="font-bold text-[#ad7cff]">Back to sign in</button>}</div>
    </section>
  </main>;
}
