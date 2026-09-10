import { NextRequest, NextResponse } from 'next/server';
import { fetchAdminProfiles, requireAdmin } from '../../../../lib/admin/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const search = request.nextUrl.searchParams.get('q') ?? '';
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 50) || 50, 1), 100);
  const offset = Math.max(Number(request.nextUrl.searchParams.get('offset') ?? 0) || 0, 0);

  try {
    const data = await fetchAdminProfiles(admin.accessToken, search, limit, offset);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load admin user data.' }, { status: 500 });
  }
}
