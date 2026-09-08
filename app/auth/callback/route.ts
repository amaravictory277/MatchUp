import { NextRequest, NextResponse } from 'next/server';

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 };

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') || '/';
  if (!code) return NextResponse.redirect(new URL('/auth?error=missing_code', request.url));
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return NextResponse.redirect(new URL('/auth?error=auth_configuration_missing', request.url));
  const exchange = await fetch(`${base.replace(/\/$/, '')}/auth/v1/token?grant_type=pkce`, { method: 'POST', headers: { apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ auth_code: code }) });
  if (!exchange.ok) return NextResponse.redirect(new URL('/auth?error=verification_failed', request.url));
  const session = await exchange.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!session.access_token || !session.refresh_token) return NextResponse.redirect(new URL('/auth?error=no_session', request.url));
  const response = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', request.url));
  response.cookies.set('matchup-access-token', session.access_token, { ...cookieOptions, maxAge: session.expires_in || 3600 });
  response.cookies.set('matchup-refresh-token', session.refresh_token, cookieOptions);
  return response;
}
