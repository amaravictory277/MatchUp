import { NextRequest, NextResponse } from 'next/server';

type ValidSession = { access_token: string; refresh_token?: string; expires_in?: number };
const protectedPrefixes = ['/home', '/tournaments/new', '/notifications', '/leaderboard'];
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

async function getValidAccessToken(request: NextRequest): Promise<ValidSession | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const access = request.cookies.get('matchup-access-token')?.value;
  if (access) {
    const check = await fetch(`${base.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${access}` }, cache: 'no-store' });
    if (check.ok) return { access_token: access };
  }
  const refresh = request.cookies.get('matchup-refresh-token')?.value;
  if (!refresh) return null;
  const refreshed = await fetch(`${base.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }), cache: 'no-store' });
  if (!refreshed.ok) return null;
  const session = await refreshed.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!session.access_token || !session.refresh_token) return null;
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsAuth = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!needsAuth) return NextResponse.next();

  const session = await getValidAccessToken(request);
  const isHome = pathname === '/home' || pathname.startsWith('/home/');
  const guestAllowed = isHome && request.cookies.get('matchup-guest')?.value === '1';
  if (!session && !guestAllowed) return NextResponse.redirect(new URL(`/auth?next=${encodeURIComponent(pathname)}`, request.url));

  const response = NextResponse.next();
  if (session?.refresh_token) {
    response.cookies.set('matchup-access-token', session.access_token, { ...cookieOptions, maxAge: session.expires_in || 3600 });
    response.cookies.set('matchup-refresh-token', session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  }
  return response;
}

export const config = { matcher: ['/home/:path*', '/tournaments/new/:path*', '/notifications/:path*', '/leaderboard/:path*'] };
