import { NextRequest, NextResponse } from 'next/server';

const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json().catch(() => ({}));
  if (!access_token || !refresh_token) return NextResponse.json({ error: 'Invalid session payload.' }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set('matchup-access-token', access_token, { ...options, maxAge: 60 * 60 });
  response.cookies.set('matchup-refresh-token', refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
  return response;
}
