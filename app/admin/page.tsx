import { redirect } from 'next/navigation';
import { fetchAdminProfiles, requireAdmin } from '../../lib/admin/server';
import { AdminDashboard } from '../../components/admin/admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/home?error=forbidden');

  const data = await fetchAdminProfiles(admin.accessToken);
  return (
    <AdminDashboard
      initialUsers={data.users}
      initialTotal={data.total}
      initialActiveToday={data.activeToday}
      adminName={admin.profile.display_name || admin.profile.username}
    />
  );
}
