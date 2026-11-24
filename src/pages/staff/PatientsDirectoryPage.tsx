import { StaffLayout } from '../../components/layout/StaffLayout';
import { PatientManagementWorkspace } from '../../components/staff/PatientManagementWorkspace';

export function PatientsDirectoryPage() {
  return (
    <StaffLayout title="Patient Management System" breadcrumb="Operations / Patients">
      <PatientManagementWorkspace />
    </StaffLayout>
  );
}
