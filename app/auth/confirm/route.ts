import { type EmailOtpType, createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const PRODUCTION_HOME = '/home';

function errorRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL('/auth?error=email-confirmation', request.url));
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || type !== 'email') return errorRedirect(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return errorRedirect(request);

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.session?.access_token || !data.session.refresh_token) {
    return errorRedirect(request);
  }

  const response = NextResponse.redirect(new URL(PRODUCTION_HOME, request.url));
  response.cookies.set('matchup-access-token', data.session.access_token, {
    ...cookieOptions,
    maxAge: data.session.expires_in || 3600,
  });
  response.cookies.set('matchup-refresh-token', data.session.refresh_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set('matchup-guest', '', {
    ...cookieOptions,
    maxAge: 0,
  });

  return response;
}
