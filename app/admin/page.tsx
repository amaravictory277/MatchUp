import { redirect } from 'next/navigation';
import { fetchAdminDashboardData, fetchAdminProfiles, requireAdmin } from '../../lib/admin/server';
import { AdminDashboard } from '../../components/admin/admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/home?error=forbidden');

  const [dashboard, users] = await Promise.all([
    fetchAdminDashboardData(admin.accessToken),
    fetchAdminProfiles(admin.accessToken, '', 50, 0),
  ]);

  return (
    <AdminDashboard
      initialDashboard={dashboard}
      initialUsers={users.users}
      initialTotal={users.total}
      adminName={admin.profile.display_name || admin.profile.username}
    />
  );
}
