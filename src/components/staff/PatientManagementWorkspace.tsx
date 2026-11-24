import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  Edit3,
  FilePlus2,
  GitMerge,
  HeartPulse,
  Phone,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import {
  BLOOD_GROUP_OPTIONS,
  calculateGestationalMetrics,
  computeEddFromLmpDate,
  formatObsFormula,
  getRiskLabel,
  RISK_CATEGORY_OPTIONS,
} from '../../lib/fetal';
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatInr,
  humanizeStatus,
} from '../../lib/utils';

interface PatientListRow {
  id: string;
  patientCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  bloodGroup: string | null;
  lmpDate: string | null;
  eddDate: string | null;
  riskCategory: string;
  pcpndtFormFCompleted: boolean;
  pcpndtFormFNumber: string | null;
  referredBy: string | null;
  consentAccepted: boolean;
  _count: { appointments: number; visits: number; reports: number; payments?: number };
}

interface PatientSummaryCounts {
  totalPatients: number;
  highRiskPatients: number;
  activePregnancies: number;
  pcpndtPending: number;
  consentPending: number;
}

interface PatientDetail {
  id: string;
  patientCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  emergencyContact: string | null;
  referredBy: string | null;
  referringDoctorPhone: string | null;
  referringHospital: string | null;
  husbandOrPartnerName: string | null;
  bloodGroup: string | null;
  lmpDate: string | null;
  eddDate: string | null;
  gravida: number | null;
  para: number | null;
  livingChildren: number | null;
  abortions: number | null;
  riskCategory: string;
  allergiesOrFlags: string | null;
  pcpndtFormFCompleted: boolean;
  pcpndtFormFNumber: string | null;
  clinicalSummaryNotes: string | null;
  consentAccepted: boolean;
  consentTimestamp: string | null;
  appointments: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    bookingChannel: string;
    service: { name: string };
  }>;
  payments: Array<{
    id: string;
    receiptNumber: string | null;
    amountSubmittedInr: number;
    utrReference: string;
    paymentMethod: string;
    status: string;
    paymentDate: string;
  }>;
  visits: Array<{
    id: string;
    visitNumber: string;
    status: string;
    checkedInAt: string;
    clinicalNotes: string | null;
    appointment: { id: string; bookingReference: string; service: { name: string } };
  }>;
  reports: Array<{
    id: string;
    reportCode: string;
    title: string;
    revisionNumber: number;
    status: string;
    fileName?: string;
    publishedAt?: string | null;
    visit: { visitNumber: string; appointment: { bookingReference: string } };
  }>;
  convertedFrom?: Array<{
    id: string;
    leadCode: string;
    source: string;
    status: string;
    interestedService: string | null;
    lmpOrGestationalWeeks: string | null;
    createdAt: string;
  }>;
}

interface DuplicateGroup {
  matchReason: string;
  patients: Array<{
    id: string;
    patientCode: string;
    fullName: string;
    phone: string;
    email: string | null;
    _count: { appointments: number; visits: number; reports: number; payments: number };
  }>;
}

interface ServiceCatalogResponse {
  categories: Array<{
    id: string;
    name: string;
    services: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      advanceAmountInr: number;
    }>;
  }>;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

type DossierTab = 'profile' | 'appointments' | 'visits' | 'reports' | 'payments' | 'crm';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  gender: 'Female',
  address: '',
  emergencyContact: '',
  husbandOrPartnerName: '',
  bloodGroup: '',
  referredBy: '',
  referringDoctorPhone: '',
  referringHospital: '',
  lmpDate: '',
  eddDate: '',
  gravida: '',
  para: '',
  livingChildren: '',
  abortions: '',
  riskCategory: 'ROUTINE',
  allergiesOrFlags: '',
  pcpndtFormFCompleted: false,
  pcpndtFormFNumber: '',
  clinicalSummaryNotes: '',
  consentAccepted: true,
  allowDuplicate: false,
};

export function PatientManagementWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'RECEPTION';
  const isClinical = user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [pcpndtFilter, setPcpndtFilter] = useState('ALL');
  const [consentFilter, setConsentFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dossierTab, setDossierTab] = useState<DossierTab>('profile');

  // Register & Edit Modals
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState(EMPTY_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // Duplicate Merge Modal
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [mergeReason, setMergeReason] = useState('Consolidated duplicate patient registration');

  // Direct Scan Booking Modal for Selected Patient
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookServiceId, setBookServiceId] = useState('');
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookTime, setBookTime] = useState('10:00');
  const [bookSlots, setBookSlots] = useState<SlotItem[]>([]);
  const [bookOverride, setBookOverride] = useState(false);
  const [bookNotes, setBookNotes] = useState('');
  const [bookIndication, setBookIndication] = useState('');

  // Clinical Visit Notes Modal (SUPER_ADMIN)
  const [visitEditTarget, setVisitEditTarget] = useState<PatientDetail['visits'][number] | null>(
    null
  );
  const [visitStatusInput, setVisitStatusInput] = useState<'WAITING' | 'IN_SCAN' | 'COMPLETED'>(
    'IN_SCAN'
  );
  const [visitNotesInput, setVisitNotesInput] = useState('');

  // Upload Diagnostic Report PDF Modal (SUPER_ADMIN)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVisitId, setUploadVisitId] = useState('');
  const [uploadApptId, setUploadApptId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['staff-patients', search, riskFilter, pcpndtFilter, consentFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (riskFilter !== 'ALL') params.set('riskCategory', riskFilter);
      if (pcpndtFilter !== 'ALL') params.set('pcpndt', pcpndtFilter);
      if (consentFilter !== 'ALL') params.set('consent', consentFilter);
      const qs = params.toString();
      return apiFetch<{ patients: PatientListRow[]; summary: PatientSummaryCounts }>(
        `/api/v1/patients${qs ? `?${qs}` : ''}`
      );
    },
  });

  const { data: detailData } = useQuery({
    queryKey: ['staff-patient-detail', selectedId],
    queryFn: () => apiFetch<{ patient: PatientDetail }>(`/api/v1/patients/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const { data: dupData, refetch: refetchDups } = useQuery({
    queryKey: ['staff-patient-duplicates'],
    queryFn: () => apiFetch<{ duplicateGroups: DuplicateGroup[] }>('/api/v1/patients/duplicates'),
    enabled: canEdit && dupDialogOpen,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['cms-services'],
    queryFn: () => apiFetch<ServiceCatalogResponse>('/api/v1/cms/services'),
  });

  const allServices = useMemo(
    () => servicesData?.categories.flatMap((c) => c.services) ?? [],
    [servicesData]
  );

  useEffect(() => {
    if (allServices.length > 0 && !bookServiceId) {
      setBookServiceId(allServices[0].id);
    }
  }, [allServices, bookServiceId]);

  useEffect(() => {
    if (!bookModalOpen || !bookServiceId || !bookDate) return;
    apiFetch<{ slots: SlotItem[] }>(
      `/api/v1/appointments/slots?date=${encodeURIComponent(bookDate)}&serviceId=${encodeURIComponent(bookServiceId)}`
    )
      .then((res) => {
        setBookSlots(res.slots);
        const firstAvail = res.slots.find((s) => s.available);
        if (firstAvail) setBookTime(firstAvail.startTime);
      })
      .catch(() => setBookSlots([]));
  }, [bookModalOpen, bookServiceId, bookDate]);

  // Auto-select first patient if list loaded & none selected yet
  const patients = data?.patients ?? [];
  useEffect(() => {
    if (!selectedId && patients.length > 0) {
      setSelectedId(patients[0].id);
    }
  }, [patients, selectedId]);

  const detail = detailData?.patient;
  const summary = data?.summary;
  const fetalMetrics = useMemo(
    () => (detail ? calculateGestationalMetrics(detail.lmpDate, detail.eddDate) : null),
    [detail]
  );
  const obsFormula = detail
    ? formatObsFormula(detail.gravida, detail.para, detail.livingChildren, detail.abortions)
    : null;

  const refreshPatientQueries = async (idToKeep?: string | null) => {
    await queryClient.invalidateQueries({ queryKey: ['staff-patients'] });
    if (idToKeep) {
      await queryClient.invalidateQueries({ queryKey: ['staff-patient-detail', idToKeep] });
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
  };

  const toNumericOrNull = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  const handleCreatePatient = async () => {
    if (!registerForm.fullName.trim() || !registerForm.phone.trim()) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ patient: { id: string; patientCode: string } }>(
        '/api/v1/patients',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName: registerForm.fullName,
            phone: registerForm.phone,
            email: registerForm.email,
            dateOfBirth: registerForm.dateOfBirth || undefined,
            gender: registerForm.gender || 'Female',
            address: registerForm.address || undefined,
            emergencyContact: registerForm.emergencyContact || undefined,
            husbandOrPartnerName: registerForm.husbandOrPartnerName || undefined,
            bloodGroup: registerForm.bloodGroup || undefined,
            referredBy: registerForm.referredBy || undefined,
            referringDoctorPhone: registerForm.referringDoctorPhone || undefined,
            referringHospital: registerForm.referringHospital || undefined,
            lmpDate: registerForm.lmpDate || undefined,
            eddDate: registerForm.eddDate || undefined,
            gravida: toNumericOrNull(registerForm.gravida),
            para: toNumericOrNull(registerForm.para),
            livingChildren: toNumericOrNull(registerForm.livingChildren),
            abortions: toNumericOrNull(registerForm.abortions),
            riskCategory: registerForm.riskCategory,
            allergiesOrFlags: registerForm.allergiesOrFlags || undefined,
            pcpndtFormFCompleted: registerForm.pcpndtFormFCompleted,
            pcpndtFormFNumber: registerForm.pcpndtFormFNumber || undefined,
            clinicalSummaryNotes: registerForm.clinicalSummaryNotes || undefined,
            consentAccepted: registerForm.consentAccepted,
            allowDuplicate: registerForm.allowDuplicate,
          }),
        }
      );
      setRegisterForm(EMPTY_FORM);
      setRegisterOpen(false);
      setSelectedId(res.patient.id);
      setFeedback(`Registered maternal-fetal patient record ${res.patient.patientCode}.`);
      await refreshPatientQueries(res.patient.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to register patient record.');
    }
  };

  const openEditDialog = (pt: PatientDetail) => {
    setEditForm({
      fullName: pt.fullName,
      phone: pt.phone,
      email: pt.email || '',
      dateOfBirth: pt.dateOfBirth || '',
      gender: pt.gender || 'Female',
      address: pt.address || '',
      emergencyContact: pt.emergencyContact || '',
      husbandOrPartnerName: pt.husbandOrPartnerName || '',
      bloodGroup: pt.bloodGroup || '',
      referredBy: pt.referredBy || '',
      referringDoctorPhone: pt.referringDoctorPhone || '',
      referringHospital: pt.referringHospital || '',
      lmpDate: pt.lmpDate || '',
      eddDate: pt.eddDate || '',
      gravida: pt.gravida !== null && pt.gravida !== undefined ? String(pt.gravida) : '',
      para: pt.para !== null && pt.para !== undefined ? String(pt.para) : '',
      livingChildren:
        pt.livingChildren !== null && pt.livingChildren !== undefined
          ? String(pt.livingChildren)
          : '',
      abortions: pt.abortions !== null && pt.abortions !== undefined ? String(pt.abortions) : '',
      riskCategory: pt.riskCategory || 'ROUTINE',
      allergiesOrFlags: pt.allergiesOrFlags || '',
      pcpndtFormFCompleted: pt.pcpndtFormFCompleted,
      pcpndtFormFNumber: pt.pcpndtFormFNumber || '',
      clinicalSummaryNotes: pt.clinicalSummaryNotes || '',
      consentAccepted: pt.consentAccepted,
      allowDuplicate: false,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/patients/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editForm.fullName,
          phone: editForm.phone,
          email: editForm.email,
          dateOfBirth: editForm.dateOfBirth || null,
          gender: editForm.gender || null,
          address: editForm.address || null,
          emergencyContact: editForm.emergencyContact || null,
          husbandOrPartnerName: editForm.husbandOrPartnerName || null,
          bloodGroup: editForm.bloodGroup || null,
          referredBy: editForm.referredBy || null,
          referringDoctorPhone: editForm.referringDoctorPhone || null,
          referringHospital: editForm.referringHospital || null,
          lmpDate: editForm.lmpDate || null,
          eddDate: editForm.eddDate || null,
          gravida: toNumericOrNull(editForm.gravida),
          para: toNumericOrNull(editForm.para),
          livingChildren: toNumericOrNull(editForm.livingChildren),
          abortions: toNumericOrNull(editForm.abortions),
          riskCategory: editForm.riskCategory,
          allergiesOrFlags: editForm.allergiesOrFlags || null,
          pcpndtFormFCompleted: editForm.pcpndtFormFCompleted,
          pcpndtFormFNumber: editForm.pcpndtFormFNumber || null,
          ...(isClinical ? { clinicalSummaryNotes: editForm.clinicalSummaryNotes || null } : {}),
          consentAccepted: editForm.consentAccepted,
        }),
      });
      setEditOpen(false);
      setFeedback('Patient demographics, obstetric timeline & compliance records updated.');
      await refreshPatientQueries(selectedId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update patient record.');
    }
  };

  const handleTogglePcpndtQuick = async (pt: PatientDetail) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/patients/${pt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pcpndtFormFCompleted: !pt.pcpndtFormFCompleted }),
      });
      setFeedback(
        `PCPNDT Form-F marked as ${!pt.pcpndtFormFCompleted ? 'Completed' : 'Pending'} for ${pt.patientCode}.`
      );
      await refreshPatientQueries(pt.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update Form-F status.');
    }
  };

  const handleDirectBookScan = async () => {
    if (!detail || !bookServiceId) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ appointment: { bookingReference: string } }>(
        '/api/v1/appointments/book',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceId: bookServiceId,
            date: bookDate,
            startTime: bookTime,
            patientName: detail.fullName,
            patientPhone: detail.phone,
            patientEmail: detail.email || '',
            referringDoctor: detail.referredBy || '',
            clinicalIndication:
              bookIndication ||
              (fetalMetrics ? `GA ${fetalMetrics.gaLabel} · ${getRiskLabel(detail.riskCategory)}` : ''),
            bookingChannel: 'WALK_IN',
            consentAccepted: true,
            isReceptionOverride: bookOverride,
            overrideReason: bookOverride ? 'Booked directly from Super Admin Patient File' : '',
            notes: bookNotes,
          }),
        }
      );
      setBookModalOpen(false);
      setBookNotes('');
      setBookIndication('');
      setDossierTab('appointments');
      setFeedback(
        `Scheduled scan ${res.appointment.bookingReference} for ${detail.fullName}.`
      );
      await refreshPatientQueries(detail.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not schedule scan.');
    }
  };

  const handleCheckInAppt = async (apptId: string) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ visit: { visitNumber: string } }>(
        `/api/v1/appointments/${apptId}/check-in`,
        { method: 'POST' }
      );
      setFeedback(`Patient checked in under Visit ${res.visit.visitNumber}.`);
      setDossierTab('visits');
      await refreshPatientQueries(selectedId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Check-in failed.');
    }
  };

  const handleSaveVisitNotes = async () => {
    if (!visitEditTarget) return;
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/reports/visits/${visitEditTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: visitStatusInput,
          clinicalNotes: visitNotesInput,
        }),
      });
      setVisitEditTarget(null);
      setFeedback(`Updated visit ${visitEditTarget.visitNumber} status & clinical notes.`);
      await refreshPatientQueries(selectedId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update clinical visit.');
    }
  };

  const handleUploadReport = async () => {
    if (!uploadFile || !uploadTitle.trim() || (!uploadVisitId && !uploadApptId)) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append('reportPdf', uploadFile);
      fd.append('title', uploadTitle.trim());
      if (uploadVisitId) fd.append('visitId', uploadVisitId);
      else if (uploadApptId) fd.append('appointmentId', uploadApptId);

      const res = await apiFetch<{ report: { reportCode: string } }>('/api/v1/reports/upload', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
      setUploadOpen(false);
      setUploadTitle('');
      setUploadFile(null);
      setDossierTab('reports');
      setFeedback(`Uploaded diagnostic report ${res.report.reportCode} for medical review.`);
      await refreshPatientQueries(selectedId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Report PDF upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handlePublishReport = async (reportId: string, code: string) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/reports/${reportId}/publish`, { method: 'POST' });
      setFeedback(`Published report ${code} to secure Patient Portal & queued portal notice.`);
      await refreshPatientQueries(selectedId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not publish diagnostic report.');
    }
  };

  const handleMergePair = async (sourceId: string, targetId: string) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        patient: { id: string; patientCode: string };
        mergedFromCode: string;
      }>('/api/v1/patients/merge', {
        method: 'POST',
        body: JSON.stringify({
          sourcePatientId: sourceId,
          targetPatientId: targetId,
          reason: mergeReason,
        }),
      });
      setSelectedId(res.patient.id);
      setFeedback(`Merged ${res.mergedFromCode} into ${res.patient.patientCode}.`);
      await refetchDups();
      await refreshPatientQueries(res.patient.id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Merge failed.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Header + Registry KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#083642]">
            Maternal &amp; Fetal Imaging Patient Management System
          </h2>
          <p className="text-xs text-[#65747B]">
            Complete longitudinal dossiers: LMP/EDD gestational tracker, obstetric risk flags, PCPNDT Form-F compliance, visits, and PDF reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDupDialogOpen(true)}
              >
                <GitMerge className="h-3.5 w-3.5" />
                <span>Duplicates &amp; Merge</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setRegisterForm(EMPTY_FORM);
                  setRegisterOpen(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Register Patient</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Interactive Filter KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: 'Total Registered',
              val: summary.totalPatients,
              icon: Activity,
              accent: 'text-[#0D4A5A]',
              active:
                riskFilter === 'ALL' && pcpndtFilter === 'ALL' && consentFilter === 'ALL',
              onClick: () => {
                setRiskFilter('ALL');
                setPcpndtFilter('ALL');
                setConsentFilter('ALL');
              },
            },
            {
              label: 'Active Pregnancies',
              val: summary.activePregnancies,
              icon: Baby,
              accent: 'text-[#287887]',
              active: false,
              onClick: () => {
                setRiskFilter('ALL');
                setPcpndtFilter('ALL');
                setConsentFilter('ALL');
              },
            },
            {
              label: 'High-Risk / Multiples',
              val: summary.highRiskPatients,
              icon: HeartPulse,
              accent: summary.highRiskPatients > 0 ? 'text-[#B42318]' : 'text-[#287887]',
              active: riskFilter === 'HIGH_RISK',
              onClick: () =>
                setRiskFilter((prev) => (prev === 'HIGH_RISK' ? 'ALL' : 'HIGH_RISK')),
            },
            {
              label: 'Form-F Pending',
              val: summary.pcpndtPending,
              icon: ClipboardCheck,
              accent: summary.pcpndtPending > 0 ? 'text-[#B45309]' : 'text-[#15803D]',
              active: pcpndtFilter === 'PENDING',
              onClick: () =>
                setPcpndtFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING')),
            },
            {
              label: 'Consent Pending',
              val: summary.consentPending,
              icon: ShieldAlert,
              accent: summary.consentPending > 0 ? 'text-[#B45309]' : 'text-[#15803D]',
              active: consentFilter === 'PENDING',
              onClick: () =>
                setConsentFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING')),
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.label}
                type="button"
                onClick={k.onClick}
                className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  k.active
                    ? 'border-[#0D4A5A] bg-[#F4FAFC]'
                    : 'border-[#DCE7E9] bg-white hover:border-[#0D4A5A] hover:bg-[#F8FBFC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#65747B] truncate">
                    {k.label}
                  </span>
                  <Icon className={`h-4 w-4 shrink-0 ${k.accent}`} />
                </div>
                <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#083642]">
                  {k.val}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {feedback && (
        <div className="rounded-md border border-[#287887] bg-[#E9F3F3] p-3 text-xs text-[#083642]">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
          {errorMsg}
        </div>
      )}

      {/* 12-Column Master-Detail Patient Directory & Clinical Dossier */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Directory Column */}
        <div className="lg:col-span-4 rounded-xl border border-[#DCE7E9] bg-white p-4 space-y-3 h-fit">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, EDF-PT, phone, Dr., Form-F..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="ALL">All Risk Levels</option>
              {RISK_CATEGORY_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Select
              value={pcpndtFilter}
              onChange={(e) => setPcpndtFilter(e.target.value)}
              className="h-8 text-xs"
            >
              <option value="ALL">All Form-F States</option>
              <option value="PENDING">Form-F Pending</option>
              <option value="COMPLETED">Form-F Verified</option>
            </Select>
          </div>

          <div className="divide-y divide-[#E9F3F3] max-h-[580px] overflow-y-auto pr-1">
            {patients.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#65747B]">
                No patient records match your current filters.
              </div>
            ) : (
              patients.map((pt) => {
                const ga = calculateGestationalMetrics(pt.lmpDate, pt.eddDate);
                const isHighRisk = pt.riskCategory && pt.riskCategory !== 'ROUTINE';
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setSelectedId(pt.id)}
                    className={`w-full text-left py-3 px-2.5 rounded-lg transition-colors cursor-pointer ${
                      selectedId === pt.id ? 'bg-[#E9F3F3]' : 'hover:bg-[#F8FAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-[11px] font-semibold text-[#287887]">
                        {pt.patientCode}
                      </span>
                      {ga && (
                        <span className="font-mono-tabular text-[11px] font-semibold text-[#0D4A5A]">
                          GA {ga.gaLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-[#083642] truncate">
                      {pt.fullName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#65747B]">
                      <span className="font-mono-tabular">{pt.phone}</span>
                      <span>
                        {pt._count.appointments} appts · {pt._count.reports} reports
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium">
                      {isHighRisk && (
                        <span className="text-[#B42318]">● {getRiskLabel(pt.riskCategory)}</span>
                      )}
                      <span
                        className={pt.pcpndtFormFCompleted ? 'text-[#15803D]' : 'text-[#B45309]'}
                      >
                        Form-F: {pt.pcpndtFormFCompleted ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Clinical Dossier Column */}
        <div className="lg:col-span-8">
          {!detail ? (
            <div className="rounded-xl border border-[#DCE7E9] bg-white p-12 text-center text-xs text-[#65747B]">
              Select a patient from the directory or register a new patient to inspect their fetal imaging profile, gestational milestone timeline, visits, and reports.
            </div>
          ) : (
            <div className="rounded-xl border border-[#DCE7E9] bg-white p-5 sm:p-6 space-y-5">
              {/* Patient Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#DCE7E9] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="font-mono-tabular font-bold text-[#287887]">
                      {detail.patientCode}
                    </span>
                    {detail.bloodGroup && (
                      <span className="font-mono-tabular font-semibold text-[#083642]">
                        · Blood Group: {detail.bloodGroup}
                      </span>
                    )}
                    {obsFormula && (
                      <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                        · {obsFormula}
                      </span>
                    )}
                    <span
                      className={`font-semibold ${
                        detail.riskCategory !== 'ROUTINE' ? 'text-[#B42318]' : 'text-[#15803D]'
                      }`}
                    >
                      · {getRiskLabel(detail.riskCategory)}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#083642]">
                    {detail.fullName}
                  </h3>
                  <p className="text-xs text-[#65747B]">
                    <span className="inline-flex items-center gap-1 font-mono-tabular">
                      <Phone className="h-3 w-3" /> {detail.phone}
                    </span>
                    {detail.email ? ` · ${detail.email}` : ''}
                    {detail.dateOfBirth ? ` · DOB ${formatDateDisplay(detail.dateOfBirth)}` : ''}
                    {detail.husbandOrPartnerName
                      ? ` · Partner: ${detail.husbandOrPartnerName}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(detail)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit Fetal Profile</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setBookModalOpen(true)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        <span>Book Scan</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Gestational Tracker & Alert Banner */}
              {fetalMetrics ? (
                <div className="rounded-xl border border-[#C9E2E8] bg-[#F4FAFC] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-[#0D4A5A]" />
                      <span className="font-display text-sm font-semibold text-[#083642]">
                        Gestational Age: <span className="font-mono-tabular">{fetalMetrics.gaLabel}</span>
                      </span>
                      <span className="text-xs font-medium text-[#287887]">
                        · {fetalMetrics.trimester}
                      </span>
                    </div>
                    <div className="font-mono-tabular text-xs text-[#083642]">
                      {detail.lmpDate ? `LMP ${formatDateDisplay(detail.lmpDate)} · ` : ''}
                      {fetalMetrics.computedEdd
                        ? `EDD ${formatDateDisplay(fetalMetrics.computedEdd)}`
                        : ''}
                      {fetalMetrics.daysRemaining !== null
                        ? ` (${fetalMetrics.daysRemaining >= 0 ? `${fetalMetrics.daysRemaining}d remaining` : 'Term reached'})`
                        : ''}
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#DCE7E9]">
                    <div
                      className="h-full rounded-full bg-[#0D4A5A] transition-all duration-300"
                      style={{ width: `${fetalMetrics.progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs font-medium text-[#0D4A5A]">
                    Recommended Protocol: {fetalMetrics.recommendedScanWindow}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#DCE7E9] bg-[#F8FAFA] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#65747B]">
                  <span>
                    No LMP / EDD recorded yet — add obstetric dates to enable automatic gestational age &amp; scan milestone recommendations.
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEditDialog(detail)}
                      className="font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                    >
                      + Add LMP / EDD
                    </button>
                  )}
                </div>
              )}

              {detail.allergiesOrFlags && (
                <div className="rounded-lg border border-[#B42318]/30 bg-[#FEF3F2] px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#B42318]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Clinical Alert / Flags:</strong> {detail.allergiesOrFlags}
                  </span>
                </div>
              )}

              {/* Dossier Sub-Navigation */}
              <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1 w-fit">
                {(
                  [
                    { id: 'profile', label: 'Maternal Profile' },
                    { id: 'appointments', label: `Appointments (${detail.appointments.length})` },
                    { id: 'visits', label: `Visits & Notes (${detail.visits.length})` },
                    { id: 'reports', label: `Reports PDF (${detail.reports.length})` },
                    { id: 'payments', label: `Payments (${detail.payments.length})` },
                    { id: 'crm', label: `CRM History (${detail.convertedFrom?.length ?? 0})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDossierTab(t.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                      dossierTab === t.id
                        ? 'bg-white text-[#0D4A5A] shadow-sm'
                        : 'text-[#65747B] hover:text-[#083642]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: Maternal & Compliance Profile */}
              {dossierTab === 'profile' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-[#E9F3F3] bg-[#F8FAFA] p-4 space-y-2">
                    <h4 className="font-semibold text-[#083642] flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-[#287887]" />
                      <span>Referring Clinician &amp; Contact</span>
                    </h4>
                    <p className="text-[#24343B]">
                      <strong>Referring Doctor:</strong> {detail.referredBy || 'Self / Direct'}
                    </p>
                    <p className="text-[#24343B]">
                      <strong>Doctor Phone:</strong>{' '}
                      <span className="font-mono-tabular">
                        {detail.referringDoctorPhone || 'Not recorded'}
                      </span>
                    </p>
                    <p className="text-[#24343B]">
                      <strong>Hospital / Clinic:</strong>{' '}
                      {detail.referringHospital || 'Not recorded'}
                    </p>
                    <p className="text-[#24343B]">
                      <strong>Emergency Contact:</strong>{' '}
                      <span className="font-mono-tabular">
                        {detail.emergencyContact || 'Not recorded'}
                      </span>
                    </p>
                    <p className="text-[#24343B]">
                      <strong>Address:</strong> {detail.address || 'Not recorded'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E9F3F3] bg-[#F8FAFA] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-[#083642] flex items-center gap-1.5">
                        <ClipboardCheck className="h-3.5 w-3.5 text-[#287887]" />
                        <span>PCPNDT &amp; Consent Compliance</span>
                      </h4>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleTogglePcpndtQuick(detail)}
                          className="text-[11px] font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                        >
                          {detail.pcpndtFormFCompleted ? 'Mark Pending' : 'Verify Form-F'}
                        </button>
                      )}
                    </div>
                    <p className="text-[#24343B]">
                      <strong>Form-F Status:</strong>{' '}
                      <span
                        className={`font-semibold ${
                          detail.pcpndtFormFCompleted ? 'text-[#15803D]' : 'text-[#B45309]'
                        }`}
                      >
                        {detail.pcpndtFormFCompleted ? 'Completed & Verified' : 'Pending Verification'}
                      </span>
                    </p>
                    <p className="text-[#24343B]">
                      <strong>Form-F Reference #:</strong>{' '}
                      <span className="font-mono-tabular">
                        {detail.pcpndtFormFNumber || 'Not entered'}
                      </span>
                    </p>
                    <p className="text-[#24343B]">
                      <strong>Privacy Consent:</strong>{' '}
                      {detail.consentAccepted
                        ? `Recorded${detail.consentTimestamp ? ` (${formatDateTimeDisplay(detail.consentTimestamp)})` : ''}`
                        : 'Pending signature'}
                    </p>
                    {isClinical && detail.clinicalSummaryNotes && (
                      <div className="border-t border-[#DCE7E9] pt-2">
                        <p className="font-semibold text-[#083642]">Senior Sonologist Summary:</p>
                        <p className="mt-0.5 text-[#24343B]">{detail.clinicalSummaryNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Appointments */}
              {dossierTab === 'appointments' && (
                <div className="space-y-3 text-xs">
                  {detail.appointments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#DCE7E9] p-6 text-center text-[#65747B]">
                      No diagnostic scan appointments recorded for this patient yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E9F3F3] border border-[#DCE7E9] rounded-lg">
                      {detail.appointments.map((a) => {
                        const hasVisit = detail.visits.some((v) => v.appointment.id === a.id);
                        return (
                          <div
                            key={a.id}
                            className="p-3.5 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div>
                              <p className="font-medium text-[#083642]">
                                <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                                  {a.bookingReference}
                                </span>{' '}
                                · {a.service.name}
                              </p>
                              <p className="font-mono-tabular text-[#65747B]">
                                {formatDateDisplay(a.appointmentDate)} · {a.startTime}–{a.endTime} ·{' '}
                                {humanizeStatus(a.status)} ({a.bookingChannel})
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {canEdit &&
                                !hasVisit &&
                                !['CANCELLED', 'COMPLETED'].includes(a.status) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleCheckInAppt(a.id)}
                                  >
                                    Check In
                                  </Button>
                                )}
                              {isClinical && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setUploadVisitId('');
                                    setUploadApptId(a.id);
                                    setUploadTitle(`${a.service.name} Diagnostic Report`);
                                    setUploadFile(null);
                                    setUploadOpen(true);
                                  }}
                                >
                                  <FilePlus2 className="h-3.5 w-3.5" />
                                  <span>Upload PDF</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: Clinical Visits & Scan Notes */}
              {dossierTab === 'visits' && (
                <div className="space-y-3 text-xs">
                  {detail.visits.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#DCE7E9] p-6 text-center text-[#65747B]">
                      No clinical visits checked in yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E9F3F3] border border-[#DCE7E9] rounded-lg">
                      {detail.visits.map((v) => (
                        <div key={v.id} className="p-3.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-[#083642]">
                                <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                                  {v.visitNumber}
                                </span>{' '}
                                · {v.appointment.service.name} ({v.appointment.bookingReference})
                              </p>
                              <p className="font-mono-tabular text-[#65747B]">
                                Checked in {formatDateTimeDisplay(v.checkedInAt)} ·{' '}
                                {humanizeStatus(v.status)}
                              </p>
                            </div>
                            {isClinical && (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setVisitEditTarget(v);
                                    setVisitStatusInput(
                                      v.status as 'WAITING' | 'IN_SCAN' | 'COMPLETED'
                                    );
                                    setVisitNotesInput(v.clinicalNotes || '');
                                  }}
                                >
                                  Update Scan Notes
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    setUploadVisitId(v.id);
                                    setUploadApptId('');
                                    setUploadTitle(`${v.appointment.service.name} Report`);
                                    setUploadFile(null);
                                    setUploadOpen(true);
                                  }}
                                >
                                  <FilePlus2 className="h-3.5 w-3.5" />
                                  <span>Upload PDF</span>
                                </Button>
                              </div>
                            )}
                          </div>
                          {v.clinicalNotes && (
                            <p className="rounded border border-[#E9F3F3] bg-[#F8FAFA] px-3 py-2 text-[#083642]">
                              <strong>Clinical Scan Notes:</strong> {v.clinicalNotes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 4: Diagnostic Reports PDF */}
              {dossierTab === 'reports' && (
                <div className="space-y-3 text-xs">
                  {detail.reports.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#DCE7E9] p-6 text-center text-[#65747B]">
                      No diagnostic reports uploaded for this patient yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E9F3F3] border border-[#DCE7E9] rounded-lg">
                      {detail.reports.map((r) => (
                        <div
                          key={r.id}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium text-[#083642]">
                              <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                                {r.reportCode}
                              </span>{' '}
                              (Rev {r.revisionNumber}) · {r.title}
                            </p>
                            <p className="font-mono-tabular text-[#65747B]">
                              {r.visit.visitNumber} · {r.visit.appointment.bookingReference} ·{' '}
                              <span
                                className={
                                  r.status === 'PUBLISHED'
                                    ? 'font-semibold text-[#15803D]'
                                    : 'font-semibold text-[#B45309]'
                                }
                              >
                                {humanizeStatus(r.status)}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {isClinical && r.status !== 'PUBLISHED' && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handlePublishReport(r.id, r.reportCode)}
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span>Publish to Portal</span>
                              </Button>
                            )}
                            {isClinical && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  downloadAuthenticatedFile(
                                    `/api/v1/reports/${r.id}/download`,
                                    `${r.reportCode}.pdf`
                                  )
                                }
                              >
                                <Download className="h-3.5 w-3.5" />
                                <span>Download PDF</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 5: Payments */}
              {dossierTab === 'payments' && (
                <div className="space-y-3 text-xs">
                  {detail.payments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#DCE7E9] p-6 text-center text-[#65747B]">
                      No payment records associated with this patient yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E9F3F3] border border-[#DCE7E9] rounded-lg">
                      {detail.payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-2 font-mono-tabular"
                        >
                          <div>
                            <p className="font-semibold text-[#083642]">
                              {p.paymentMethod} · UTR {p.utrReference}{' '}
                              {p.receiptNumber ? `(${p.receiptNumber})` : ''}
                            </p>
                            <p className="text-[#65747B]">{formatDateDisplay(p.paymentDate)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-[#083642]">
                              {formatInr(p.amountSubmittedInr)}
                            </span>
                            <span className="font-semibold text-[#0D4A5A]">
                              {humanizeStatus(p.status)}
                            </span>
                            {p.status !== 'VERIFIED' && (
                              <Link
                                to="/staff/payments"
                                className="inline-flex items-center gap-1 text-[#287887] hover:underline"
                              >
                                <CreditCard className="h-3 w-3" />
                                <span>Verify</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 6: CRM History */}
              {dossierTab === 'crm' && (
                <div className="space-y-3 text-xs">
                  {(detail.convertedFrom ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#DCE7E9] p-6 text-center text-[#65747B]">
                      Registered directly without a linked pre-visit CRM inquiry.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E9F3F3] border border-[#DCE7E9] rounded-lg">
                      {detail.convertedFrom?.map((lead) => (
                        <div
                          key={lead.id}
                          className="p-3.5 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-semibold text-[#083642]">
                              <span className="font-mono-tabular text-[#287887]">
                                {lead.leadCode}
                              </span>{' '}
                              · {humanizeStatus(lead.source)}
                            </p>
                            <p className="text-[#65747B]">
                              {lead.interestedService || 'Diagnostic Inquiry'}
                              {lead.lmpOrGestationalWeeks ? ` · ${lead.lmpOrGestationalWeeks}` : ''}
                            </p>
                          </div>
                          <span className="font-mono-tabular text-[#0D4A5A]">
                            {humanizeStatus(lead.status)} · {formatDateTimeDisplay(lead.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Register Maternal-Fetal Patient Dialog */}
      <Dialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register New Maternal / Diagnostic Patient"
        description="Capture demographics, LMP/EDD gestational timeline, obstetric parity, referring doctor, and PCPNDT compliance."
        className="max-w-3xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={registerForm.fullName}
                onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                placeholder="Patient full name"
              />
            </div>
            <div>
              <Label>Mobile Number *</Label>
              <Input
                value={registerForm.phone}
                onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                placeholder="10-digit mobile"
              />
            </div>
            <div>
              <Label>Husband / Partner Name</Label>
              <Input
                value={registerForm.husbandOrPartnerName}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, husbandOrPartnerName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={registerForm.dateOfBirth}
                onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
              />
            </div>
            <div>
              <Label>Blood Group</Label>
              <Select
                value={registerForm.bloodGroup}
                onChange={(e) => setRegisterForm({ ...registerForm, bloodGroup: e.target.value })}
              >
                <option value="">Select</option>
                {BLOOD_GROUP_OPTIONS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select
                value={registerForm.gender}
                onChange={(e) => setRegisterForm({ ...registerForm, gender: e.target.value })}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-3.5 space-y-3">
            <p className="font-semibold text-[#083642]">Obstetric &amp; Fetal Imaging Profile</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>LMP Date</Label>
                <Input
                  type="date"
                  value={registerForm.lmpDate}
                  onChange={(e) => {
                    const lmp = e.target.value;
                    setRegisterForm({
                      ...registerForm,
                      lmpDate: lmp,
                      eddDate: computeEddFromLmpDate(lmp) || registerForm.eddDate,
                    });
                  }}
                />
              </div>
              <div>
                <Label>EDD (Auto / Override)</Label>
                <Input
                  type="date"
                  value={registerForm.eddDate}
                  onChange={(e) => setRegisterForm({ ...registerForm, eddDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Risk Classification</Label>
                <Select
                  value={registerForm.riskCategory}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, riskCategory: e.target.value })
                  }
                >
                  {RISK_CATEGORY_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>PCPNDT Form-F #</Label>
                <Input
                  value={registerForm.pcpndtFormFNumber}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, pcpndtFormFNumber: e.target.value })
                  }
                  placeholder="Form-F Reg #"
                />
              </div>
              <div>
                <Label>Gravida (G)</Label>
                <Input
                  type="number"
                  min={0}
                  value={registerForm.gravida}
                  onChange={(e) => setRegisterForm({ ...registerForm, gravida: e.target.value })}
                />
              </div>
              <div>
                <Label>Para (P)</Label>
                <Input
                  type="number"
                  min={0}
                  value={registerForm.para}
                  onChange={(e) => setRegisterForm({ ...registerForm, para: e.target.value })}
                />
              </div>
              <div>
                <Label>Living (L)</Label>
                <Input
                  type="number"
                  min={0}
                  value={registerForm.livingChildren}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, livingChildren: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Abortions (A)</Label>
                <Input
                  type="number"
                  min={0}
                  value={registerForm.abortions}
                  onChange={(e) => setRegisterForm({ ...registerForm, abortions: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Referring OB/GYN Doctor</Label>
              <Input
                value={registerForm.referredBy}
                onChange={(e) => setRegisterForm({ ...registerForm, referredBy: e.target.value })}
                placeholder="Dr. Name"
              />
            </div>
            <div>
              <Label>Referring Hospital / Clinic</Label>
              <Input
                value={registerForm.referringHospital}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, referringHospital: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Clinical Alerts / Allergies</Label>
              <Input
                value={registerForm.allergiesOrFlags}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, allergiesOrFlags: e.target.value })
                }
                placeholder="e.g., Rh-Negative, GDM"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
              <input
                type="checkbox"
                checked={registerForm.consentAccepted}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, consentAccepted: e.target.checked })
                }
              />
              <span>Patient Consent Recorded</span>
            </label>
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
              <input
                type="checkbox"
                checked={registerForm.pcpndtFormFCompleted}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, pcpndtFormFCompleted: e.target.checked })
                }
              />
              <span>PCPNDT Form-F Completed</span>
            </label>
            <label className="flex items-center gap-2 text-[#65747B] cursor-pointer">
              <input
                type="checkbox"
                checked={registerForm.allowDuplicate}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, allowDuplicate: e.target.checked })
                }
              />
              <span>Allow separate record on shared phone</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!registerForm.fullName.trim() || registerForm.phone.trim().length < 10}
              onClick={handleCreatePatient}
            >
              Create Maternal-Fetal Record
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Maternal & Fetal Profile Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Maternal & Fetal Clinical Profile"
        description={detail ? `${detail.patientCode} · ${detail.fullName}` : undefined}
        className="max-w-3xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Husband / Partner Name</Label>
              <Input
                value={editForm.husbandOrPartnerName}
                onChange={(e) =>
                  setEditForm({ ...editForm, husbandOrPartnerName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
              />
            </div>
            <div>
              <Label>Blood Group</Label>
              <Select
                value={editForm.bloodGroup}
                onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
              >
                <option value="">Unspecified</option>
                {BLOOD_GROUP_OPTIONS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-3.5 space-y-3">
            <p className="font-semibold text-[#083642]">Obstetric Dates, Parity &amp; Form-F</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>LMP Date</Label>
                <Input
                  type="date"
                  value={editForm.lmpDate}
                  onChange={(e) => {
                    const lmp = e.target.value;
                    setEditForm({
                      ...editForm,
                      lmpDate: lmp,
                      eddDate: computeEddFromLmpDate(lmp) || editForm.eddDate,
                    });
                  }}
                />
              </div>
              <div>
                <Label>EDD Date</Label>
                <Input
                  type="date"
                  value={editForm.eddDate}
                  onChange={(e) => setEditForm({ ...editForm, eddDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Risk Classification</Label>
                <Select
                  value={editForm.riskCategory}
                  onChange={(e) => setEditForm({ ...editForm, riskCategory: e.target.value })}
                >
                  {RISK_CATEGORY_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>PCPNDT Form-F #</Label>
                <Input
                  value={editForm.pcpndtFormFNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, pcpndtFormFNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Gravida (G)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.gravida}
                  onChange={(e) => setEditForm({ ...editForm, gravida: e.target.value })}
                />
              </div>
              <div>
                <Label>Para (P)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.para}
                  onChange={(e) => setEditForm({ ...editForm, para: e.target.value })}
                />
              </div>
              <div>
                <Label>Living (L)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.livingChildren}
                  onChange={(e) => setEditForm({ ...editForm, livingChildren: e.target.value })}
                />
              </div>
              <div>
                <Label>Abortions (A)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.abortions}
                  onChange={(e) => setEditForm({ ...editForm, abortions: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Referring Doctor</Label>
              <Input
                value={editForm.referredBy}
                onChange={(e) => setEditForm({ ...editForm, referredBy: e.target.value })}
              />
            </div>
            <div>
              <Label>Referring Doctor Phone</Label>
              <Input
                value={editForm.referringDoctorPhone}
                onChange={(e) =>
                  setEditForm({ ...editForm, referringDoctorPhone: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Referring Hospital</Label>
              <Input
                value={editForm.referringHospital}
                onChange={(e) => setEditForm({ ...editForm, referringHospital: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Emergency Contact</Label>
              <Input
                value={editForm.emergencyContact}
                onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
              />
            </div>
            <div>
              <Label>Clinical Alerts / Allergies</Label>
              <Input
                value={editForm.allergiesOrFlags}
                onChange={(e) => setEditForm({ ...editForm, allergiesOrFlags: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Input
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>

          {isClinical && (
            <div>
              <Label>Senior Sonologist Longitudinal Summary</Label>
              <Textarea
                value={editForm.clinicalSummaryNotes}
                onChange={(e) =>
                  setEditForm({ ...editForm, clinicalSummaryNotes: e.target.value })
                }
                placeholder="Longitudinal fetal surveillance plan, previous anomaly notes..."
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.consentAccepted}
                onChange={(e) =>
                  setEditForm({ ...editForm, consentAccepted: e.target.checked })
                }
              />
              <span>Patient Diagnostic &amp; Privacy Consent Accepted</span>
            </label>
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.pcpndtFormFCompleted}
                onChange={(e) =>
                  setEditForm({ ...editForm, pcpndtFormFCompleted: e.target.checked })
                }
              />
              <span>PCPNDT Form-F Completed</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveEdit}>
              Save Maternal-Fetal Profile
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Book Scan Directly for Patient Dialog */}
      <Dialog
        open={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        title="Schedule Diagnostic Scan for Patient"
        description={detail ? `${detail.patientCode} · ${detail.fullName} (${detail.phone})` : undefined}
        className="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Diagnostic Service</Label>
            <Select value={bookServiceId} onChange={(e) => setBookServiceId(e.target.value)}>
              {allServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} min)
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Appointment Date</Label>
              <Input
                type="date"
                value={bookDate}
                onChange={(e) => setBookDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Time Slot</Label>
              {bookOverride ? (
                <Input
                  type="time"
                  value={bookTime}
                  onChange={(e) => setBookTime(e.target.value)}
                />
              ) : (
                <Select value={bookTime} onChange={(e) => setBookTime(e.target.value)}>
                  {bookSlots.map((s) => (
                    <option key={s.startTime} value={s.startTime} disabled={!s.available}>
                      {s.startTime}–{s.endTime} {!s.available ? `(${s.reason || 'Full'})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
            <input
              type="checkbox"
              checked={bookOverride}
              onChange={(e) => setBookOverride(e.target.checked)}
            />
            <span>Reception / Super Admin Slot Override (custom time or full slot)</span>
          </label>
          <div>
            <Label>Clinical Indication</Label>
            <Input
              value={bookIndication}
              onChange={(e) => setBookIndication(e.target.value)}
              placeholder={
                fetalMetrics
                  ? `e.g., ${fetalMetrics.gaLabel} anomaly / Doppler check`
                  : 'e.g., Level-II scan / NT screening'
              }
            />
          </div>
          <div>
            <Label>Operational Notes</Label>
            <Textarea
              value={bookNotes}
              onChange={(e) => setBookNotes(e.target.value)}
              placeholder="Preparation or desk notes"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBookModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleDirectBookScan}>
              Confirm Booking
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Update Clinical Visit Status & Notes Dialog */}
      <Dialog
        open={Boolean(visitEditTarget)}
        onClose={() => setVisitEditTarget(null)}
        title="Clinical Visit Status & Scan Notes"
        description={
          visitEditTarget
            ? `${visitEditTarget.visitNumber} · ${visitEditTarget.appointment.service.name}`
            : undefined
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Visit Status</Label>
            <Select
              value={visitStatusInput}
              onChange={(e) => setVisitStatusInput(e.target.value as typeof visitStatusInput)}
            >
              <option value="WAITING">Waiting</option>
              <option value="IN_SCAN">In Scan Room</option>
              <option value="COMPLETED">Completed</option>
            </Select>
          </div>
          <div>
            <Label>Sonologist Clinical Notes</Label>
            <Textarea
              value={visitNotesInput}
              onChange={(e) => setVisitNotesInput(e.target.value)}
              placeholder="Enter fetal imaging measurements, Doppler summary, or follow-up recommendation..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setVisitEditTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveVisitNotes}>
              Save Clinical Visit
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Upload Diagnostic Report PDF Dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Diagnostic Report PDF"
        description="Upload verified PDF report to private clinical storage for review and Patient Portal publication."
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Report Title</Label>
            <Input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g., Level-II Targeted Anomaly Scan Report"
            />
          </div>
          <div>
            <Label>Report PDF File (Max 15 MB)</Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploading || !uploadFile || uploadTitle.trim().length < 3}
              onClick={handleUploadReport}
            >
              {uploading ? 'Uploading...' : 'Upload PDF Report'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Duplicate Detection & Merge Dialog */}
      <Dialog
        open={dupDialogOpen}
        onClose={() => setDupDialogOpen(false)}
        title="Duplicate Patient Detection & Record Merge"
        description="Review potential duplicate patient profiles sharing mobile numbers or email addresses, and merge secondary duplicates into the primary record."
        className="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Audit Reason for Merge</Label>
            <Input
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
              placeholder="Reason recorded in security audit log"
            />
          </div>

          {(dupData?.duplicateGroups ?? []).length === 0 ? (
            <div className="rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-5 text-center text-[#65747B] flex flex-col items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
              <span>No duplicate phone or email patient groups detected.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {dupData?.duplicateGroups.map((group) => {
                const primary = group.patients[0];
                return (
                  <div
                    key={group.matchReason}
                    className="rounded-md border border-[#DCE7E9] p-4 space-y-3"
                  >
                    <p className="font-semibold text-[#083642]">{group.matchReason}</p>
                    <div className="divide-y divide-[#E9F3F3]">
                      {group.patients.map((pt, idx) => (
                        <div
                          key={pt.id}
                          className="py-2 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-mono-tabular font-semibold text-[#0D4A5A]">
                              {pt.patientCode} · {pt.fullName}
                            </p>
                            <p className="text-[#65747B]">
                              {pt.phone}
                              {pt.email ? ` · ${pt.email}` : ''} · {pt._count.appointments} appts ·{' '}
                              {pt._count.reports} reports
                            </p>
                          </div>
                          {idx === 0 ? (
                            <span className="font-mono-tabular text-[#287887]">Primary Target</span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleMergePair(pt.id, primary.id)}
                            >
                              Merge into {primary.patientCode}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
