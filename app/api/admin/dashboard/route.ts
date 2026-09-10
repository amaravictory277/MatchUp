import { NextResponse } from 'next/server';
import { fetchAdminDashboardData, requireAdmin } from '../../../../lib/admin/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const data = await fetchAdminDashboardData(admin.accessToken);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load admin dashboard data.' }, { status: 500 });
  }
}
