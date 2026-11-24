import { AdminLayout } from '../../components/layout/AdminLayout';
import { SuperAdminBusinessDashboard } from '../../components/staff/SuperAdminBusinessDashboard';

export function SuperAdminDashboardPage() {
  return (
    <AdminLayout
      title="Super Admin Executive Dashboard"
      breadcrumb="Dashboard / Website & Business Operations"
    >
      <SuperAdminBusinessDashboard />
    </AdminLayout>
  );
}
