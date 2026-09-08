import { NextRequest, NextResponse } from 'next/server';

const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export async function POST(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { access_token, refresh_token } = await request.json().catch(() => ({}));

  if (!base || !anon || !access_token || !refresh_token) {
    return NextResponse.json({ error: 'Invalid session payload.' }, { status: 400 });
  }

  // Never trust browser-supplied tokens merely because they have the expected
  // shape. Verify the access token with Supabase before issuing HTTP-only
  // cookies used by protected server routes.
  const userResponse = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${access_token}` },
    cache: 'no-store',
  });

  if (!userResponse.ok) {
    return NextResponse.json({ error: 'Invalid or expired authentication session.' }, { status: 401 });
  }

  const user = await userResponse.json().catch(() => null) as { id?: string } | null;
  if (!user?.id) {
    return NextResponse.json({ error: 'Invalid authentication session.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('matchup-access-token', access_token, { ...options, maxAge: 60 * 60 });
  response.cookies.set('matchup-refresh-token', refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
  return response;
}
