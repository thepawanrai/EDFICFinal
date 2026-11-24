import { ReceptionLayout } from '../../components/layout/ReceptionLayout';
import { ReceptionCalendarWorkspace } from '../../components/staff/ReceptionCalendarWorkspace';

export function ReceptionDashboardPage() {
  return (
    <ReceptionLayout title="Reception & Scheduling Calendar" breadcrumb="Operations / Reception">
      <ReceptionCalendarWorkspace />
    </ReceptionLayout>
  );
}
