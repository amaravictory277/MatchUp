import { NextResponse } from 'next/server';
import { fetchAdminUserDetail, requireAdmin } from '../../../../../lib/admin/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 });

  try {
    const data = await fetchAdminUserDetail(admin.accessToken, id);
    if (!data) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load admin user detail.' }, { status: 500 });
  }
}
