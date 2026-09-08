import { NextRequest, NextResponse } from 'next/server';

const protectedPrefixes = ['/tournaments/new', '/notifications', '/leaderboard'];
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

async function getValidAccessToken(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const access = request.cookies.get('matchup-access-token')?.value;
  if (access) {
    const check = await fetch(`${base.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${access}` }, cache: 'no-store' });
    if (check.ok) return { access };
  }
  const refresh = request.cookies.get('matchup-refresh-token')?.value;
  if (!refresh) return null;
  const refreshed = await fetch(`${base.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }), cache: 'no-store' });
  if (!refreshed.ok) return null;
  const session = await refreshed.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!session.access_token || !session.refresh_token) return null;
  return session;
}

export async function middleware(request: NextRequest) {
  const needsAuth = protectedPrefixes.some((prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`));
  if (!needsAuth) return NextResponse.next();
  const session = await getValidAccessToken(request);
  if (!session) return NextResponse.redirect(new URL(`/auth?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  const response = NextResponse.next();
  if ('refresh_token' in session) {
    response.cookies.set('matchup-access-token', session.access_token!, { ...cookieOptions, maxAge: session.expires_in || 3600 });
    response.cookies.set('matchup-refresh-token', session.refresh_token!, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  }
  return response;
}

export const config = { matcher: ['/tournaments/new/:path*', '/notifications/:path*', '/leaderboard/:path*'] };
