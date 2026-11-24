import { StaffLayout } from '../../components/layout/StaffLayout';
import { UpiVerificationWorkspace } from '../../components/staff/UpiVerificationWorkspace';

export function PaymentsVerificationPage() {
  return (
    <StaffLayout
      title="UPI Advance Payment Verification"
      breadcrumb="Operations / Payments"
    >
      <UpiVerificationWorkspace />
    </StaffLayout>
  );
}
