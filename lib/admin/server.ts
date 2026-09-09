import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Profile = {
  id: string;
  display_name: string | null;
  username: string;
  avatar_path: string | null;
  last_seen_at: string | null;
  created_at: string;
};

type AuthUser = { id: string };

type AdminProfile = {
  id: string;
  display_name: string | null;
  username: string;
};

async function authUser(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return await response.json() as AuthUser;
}

async function refreshAccessToken(refreshToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const session = await response.json() as { access_token?: string };
  return session.access_token ?? null;
}

export async function getAdminAccessToken() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('matchup-access-token')?.value ?? null;
  const refreshToken = cookieStore.get('matchup-refresh-token')?.value ?? null;

  if (!accessToken && refreshToken) accessToken = await refreshAccessToken(refreshToken);
  if (!accessToken) return null;

  const user = await authUser(accessToken);
  if (user) return { accessToken, userId: user.id };
  if (!refreshToken) return null;

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed) return null;
  const refreshedUser = await authUser(refreshed);
  return refreshedUser ? { accessToken: refreshed, userId: refreshedUser.id } : null;
}

async function databaseSaysAdmin(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_matchup_admin`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: '{}',
    cache: 'no-store',
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result === true;
}

export async function requireAdmin() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const session = await getAdminAccessToken();
  if (!session) return null;

  // The database function evaluates auth.uid() from the verified Supabase JWT.
  // No email or browser-supplied user ID is trusted for authorization.
  if (!await databaseSaysAdmin(session.accessToken)) return null;

  const url = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set('select', 'id,display_name,username');
  url.searchParams.set('id', `eq.${session.userId}`);
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const profiles = await response.json() as AdminProfile[];
  const profile = profiles[0];
  if (!profile || profile.id !== session.userId) return null;
  return { ...session, profile };
}

export async function fetchAdminProfiles(accessToken: string, search = '') {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { users: [] as Profile[], total: 0, activeToday: 0 };
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` };
  const url = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set('select', 'id,display_name,username,avatar_path,last_seen_at,created_at');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '1000');
  const trimmed = search.trim().replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 80);
  if (trimmed) url.searchParams.set('or', `(display_name.ilike.*${trimmed}*,username.ilike.*${trimmed}*)`);

  const countUrl = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  countUrl.searchParams.set('select', 'id');
  countUrl.searchParams.set('limit', '1');
  const activeUrl = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  activeUrl.searchParams.set('select', 'id');
  activeUrl.searchParams.set('last_seen_at', `gte.${new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}`);
  activeUrl.searchParams.set('limit', '1');

  const [usersResponse, countResponse, activeResponse] = await Promise.all([
    fetch(url, { headers, cache: 'no-store' }),
    fetch(countUrl, { headers: { ...headers, Prefer: 'count=exact' }, cache: 'no-store' }),
    fetch(activeUrl, { headers: { ...headers, Prefer: 'count=exact' }, cache: 'no-store' }),
  ]);
  if (!usersResponse.ok || !countResponse.ok || !activeResponse.ok) throw new Error('Could not load admin user data.');

  const users = await usersResponse.json() as Profile[];
  const parseCount = (response: Response) => {
    const range = response.headers.get('content-range');
    const total = range?.split('/')[1];
    return total && total !== '*' ? Number(total) : 0;
  };
  return { users, total: parseCount(countResponse), activeToday: parseCount(activeResponse) };
}
