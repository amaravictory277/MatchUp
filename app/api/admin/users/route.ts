import { NextRequest, NextResponse } from 'next/server';
import { fetchAdminProfiles, requireAdmin } from '../../../../lib/admin/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const search = request.nextUrl.searchParams.get('q') ?? '';
    const data = await fetchAdminProfiles(admin.accessToken, search);
    return NextResponse.json(data, { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load admin user data.' }, { status: 500 });
  }
}
