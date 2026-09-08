'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import { syncAuthSession } from '../../lib/auth/session';

type Mode = 'signin' | 'signup' | 'forgot' | 'verify';
const RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_NEXT_PATH = '/home';

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT_PATH;
  return value;
}

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('email not confirmed')) return 'Please verify your email address before signing in.';
  if (lower.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (lower.includes('user already registered')) return 'An account already exists for this email. Try signing in instead.';
  if (lower.includes('password should be at least')) return 'Password must meet Supabase password requirements.';
  if (lower.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return message;
}

export function AuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<Mode>('signin');
  const [nextPath, setNextPath] = useState(DEFAULT_NEXT_PATH);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMode(params.get('mode') === 'signup' ? 'signup' : 'signin');
    setNextPath(getSafeNextPath(params.get('next')));
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          await syncAuthSession(session.access_token, session.refresh_token);
        } catch {
          // Explicit auth actions retry server sync.
        }
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirm('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) {
          if (authError.message.toLowerCase().includes('email not confirmed')) {
            setMode('verify');
            setMessage('Please verify your email before signing in.');
            setCooldown(0);
            return;
          }
          throw new Error(friendlyAuthError(authError.message));
        }
        if (!data.session) throw new Error('No authenticated session was returned. Please try again.');
        await syncAuthSession(data.session.access_token, data.session.refresh_token);
        document.cookie = 'matchup-guest=; Max-Age=0; Path=/; SameSite=Lax';
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (mode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirm) throw new Error('Passwords do not match.');
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Email verification always returns to the canonical MatchUp
            // callback. The callback establishes the secure server session
            // and sends the user to /home; it never redirects to Vercel auth.
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (authError) throw new Error(friendlyAuthError(authError.message));
        if (data.session) {
          await syncAuthSession(data.session.access_token, data.session.refresh_token);
          document.cookie = 'matchup-guest=; Max-Age=0; Path=/; SameSite=Lax';
          router.replace(nextPath);
          router.refresh();
          return;
        }
        setMode('verify');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setMessage('Check your email for the secure MatchUp verification link.');
        return;
      }

      if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (authError) throw new Error(friendlyAuthError(authError.message));
        setMessage('If an account exists for that email, Supabase has sent a password-reset email.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || !email.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: authError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) throw new Error(friendlyAuthError(authError.message));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage('A new verification email has been sent.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not resend verification email.');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    const redirectTo = `${window.location.origin}/auth/callback${nextPath !== DEFAULT_NEXT_PATH ? `?next=${encodeURIComponent(nextPath)}` : ''}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (authError) {
      setError(friendlyAuthError(authError.message));
      setBusy(false);
    }
  };

  const continueAsGuest = () => {
    document.cookie = 'matchup-guest=1; Max-Age=86400; Path=/; SameSite=Lax';
    router.replace(nextPath);
    router.refresh();
  };

  const showChoiceTabs = mode === 'signin' || mode === 'signup';
  const heading = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'verify' ? 'Verify your email' : 'Welcome to MatchUp';
  const description = mode === 'verify'
    ? 'Confirm your email to finish setting up your MatchUp account.'
    : mode === 'forgot'
      ? 'Enter your email and we’ll send a secure password-reset link.'
      : 'Choose how you want to enter the home of competitive eFootball tournaments.';

  return (
    <main className="auth-page min-h-[100dvh] overflow-x-hidden bg-[#070711] text-white">
      <div aria-hidden="true" className="auth-glow auth-glow-one" />
      <div aria-hidden="true" className="auth-glow auth-glow-two" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(18px+env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-between">
          <button type="button" onClick={() => router.push('/')} className="icon-button auth-back" aria-label="Back to MatchUp">
            <ArrowLeft size={19} strokeWidth={2.2} />
          </button>
          <div className="auth-brand" aria-label="MatchUp">
            <span className="auth-brand-mark">M</span>
            <span className="wordmark">Match<span>Up</span></span>
          </div>
          <span className="auth-sport-pill">eFootball</span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-7 sm:py-10">
          <div className="auth-heading text-center">
            <div className="auth-shield mx-auto" aria-hidden="true">
              <ShieldCheck size={23} strokeWidth={2.2} />
            </div>
            <h1 className="mt-5 text-[31px] font-black leading-[1.05] tracking-[-0.045em] sm:text-4xl">{heading}</h1>
            <p className="mx-auto mt-3 max-w-[390px] text-[14px] leading-6 text-[#9997aa]">{description}</p>
          </div>

          {showChoiceTabs ? (
            <div className="auth-tabs mt-7 grid grid-cols-2" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                aria-controls="auth-form"
                onClick={() => switchMode('signup')}
                className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              >
                SIGN UP
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                aria-controls="auth-form"
                onClick={() => switchMode('signin')}
                className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
              >
                SIGN IN
              </button>
            </div>
          ) : null}

          {mode === 'verify' ? (
            <div className="auth-message-panel mt-7" role="status">
              <CheckCircle2 className="text-[#9b65ff]" size={25} />
              <p className="mt-3 text-sm font-extrabold text-white">Verification email sent</p>
              <p className="mt-1 text-xs leading-5 text-[#9290a3]">
                Open the secure MatchUp email sent to <strong className="text-white">{email}</strong>. Your link is validated by Supabase.
              </p>
              <button type="button" disabled={busy || cooldown > 0} onClick={resend} className="auth-primary mt-5 w-full">
                {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                {busy ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
              </button>
            </div>
          ) : (
            <form id="auth-form" onSubmit={submit} className="auth-form mt-7" aria-label={mode === 'signup' ? 'Create MatchUp account' : mode === 'forgot' ? 'Reset MatchUp password' : 'Sign in to MatchUp'}>
              <label className="auth-field">
                <span>Email address</span>
                <span className="auth-input-wrap">
                  <Mail size={17} aria-hidden="true" />
                  <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                </span>
              </label>

              {mode !== 'forgot' ? (
                <label className="auth-field">
                  <span>Password</span>
                  <span className="auth-input-wrap">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="auth-input-action">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              ) : null}

              {mode === 'signup' ? (
                <label className="auth-field">
                  <span>Confirm password</span>
                  <span className="auth-input-wrap">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat your password" />
                  </span>
                </label>
              ) : null}

              {error ? <p role="alert" className="auth-error">{error}</p> : null}
              {message ? <p role="status" className="auth-success">{message}</p> : null}

              <button disabled={busy} className="auth-primary mt-1 w-full">
                {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset email' : 'Sign in'}
              </button>

              <div className="auth-divider" aria-hidden="true">
                <span />
                <b>OR</b>
                <span />
              </div>

              <button type="button" onClick={google} disabled={busy} className="auth-google w-full">
                <span className="google-mark" aria-hidden="true">G</span>
                Continue with Google
              </button>
            </form>
          )}

          <button type="button" onClick={continueAsGuest} className="auth-guest mt-3 w-full">
            Continue as Guest
          </button>

          <div className="mt-5 min-h-6 text-center text-xs text-[#858398]">
            {mode === 'signin' ? (
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
                <span>New to MatchUp?</span>
                <button type="button" onClick={() => switchMode('signup')} className="auth-link">Create account</button>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="auth-link">Forgot password?</button>
              </div>
            ) : mode === 'signup' ? (
              <div>Already have an account? <button type="button" onClick={() => switchMode('signin')} className="auth-link">Sign in</button></div>
            ) : (
              <button type="button" onClick={() => switchMode('signin')} className="auth-link">Back to sign in</button>
            )}
          </div>
        </section>

        <footer className="auth-footer text-center">
          <span>MatchUp</span>
          <span className="mx-2 opacity-40">•</span>
          Football. Competition. Community.
        </footer>
      </div>
    </main>
  );
}
