import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type AuthUser = { id: string };

type AdminProfile = {
  id: string;
  display_name: string | null;
  username: string;
};

export type AdminUser = {
  id: string;
  display_name: string | null;
  username: string;
  avatar_path: string | null;
  created_at: string;
  last_seen_at: string | null;
  auth_provider: string;
  email_verified: boolean;
  last_sign_in_at: string | null;
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
  return (await response.json()) === true;
}

export async function requireAdmin() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const session = await getAdminAccessToken();
  if (!session || !(await databaseSaysAdmin(session.accessToken))) return null;

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

async function callAdminRpc<T>(accessToken: string, functionName: string, body: Record<string, unknown> = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Admin RPC ${functionName} failed.`);
  return await response.json() as T;
}

export async function fetchAdminProfiles(accessToken: string, search = '', limit = 50, offset = 0) {
  return callAdminRpc<{ users: AdminUser[]; total: number; activeToday: number }>(accessToken, 'get_admin_users', {
    p_search: search.trim().slice(0, 80),
    p_limit: limit,
    p_offset: offset,
  });
}

export type AdminDashboardData = {
  overview: Record<string, number>;
  analytics: Record<string, number>;
  recentUsers: AdminUser[];
  recentPosts: Array<Record<string, unknown>>;
  recentComments: Array<Record<string, unknown>>;
  recentTournaments: Array<Record<string, unknown>>;
  recentGroups: Array<Record<string, unknown>>;
  notificationStats: Record<string, number>;
};

export async function fetchAdminDashboardData(accessToken: string) {
  return callAdminRpc<AdminDashboardData>(accessToken, 'get_admin_dashboard_data');
}

export async function fetchAdminUserDetail(accessToken: string, userId: string) {
  return callAdminRpc<Record<string, unknown> | null>(accessToken, 'get_admin_user_detail', { p_user_id: userId });
}
