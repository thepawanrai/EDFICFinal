import { StaffLayout } from '../../components/layout/StaffLayout';
import { CrmWorkspace } from '../../components/staff/CrmWorkspace';

export function CrmDashboardPage() {
  return (
    <StaffLayout title="Integrated CRM & Inquiries" breadcrumb="Operations / CRM">
      <CrmWorkspace />
    </StaffLayout>
  );
}
