import { NextRequest, NextResponse } from 'next/server';
import { fetchAdminOnlineUsers, requireAdmin } from '../../../../lib/admin/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ids = request.nextUrl.searchParams.getAll('id').filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  try {
    const users = await fetchAdminOnlineUsers(admin.accessToken, ids);
    return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load online users.' }, { status: 500 });
  }
}
