import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FilePlus2,
  Send,
  Stethoscope,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import { formatDateDisplay, formatDateTimeDisplay, humanizeStatus } from '../../lib/utils';

interface DoctorQueueResponse {
  todayDate: string;
  visits: Array<{
    id: string;
    visitNumber: string;
    status: string;
    checkedInAt: string;
    clinicalNotes: string | null;
    patient: {
      id: string;
      patientCode: string;
      fullName: string;
      phone: string;
      consentAccepted: boolean;
    };
    appointment: {
      id: string;
      bookingReference: string;
      appointmentDate: string;
      startTime: string;
      endTime: string;
      clinicalIndication: string | null;
      referringDoctor: string | null;
      service: { id: string; name: string; code: string };
    };
    reports: Array<{
      id: string;
      reportCode: string;
      title: string;
      revisionNumber: number;
      status: string;
      fileName: string;
      publishedAt: string | null;
      uploadedBy: { fullName: string };
      reviewedBy: { fullName: string } | null;
    }>;
  }>;
  todayAppointments: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
    clinicalIndication: string | null;
    referringDoctor: string | null;
    patient: { id: string; patientCode: string; fullName: string; phone: string };
    service: { id: string; name: string; code: string };
    visit: {
      id: string;
      visitNumber: string;
      status: string;
      reports: Array<{ id: string; reportCode: string; revisionNumber: number; status: string }>;
    } | null;
  }>;
  upcomingAppointments: Array<{
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    status: string;
    patient: { patientCode: string; fullName: string; phone: string };
    service: { name: string };
  }>;
}

export function ClinicalReportsWorkspace() {
  const queryClient = useQueryClient();
  const [visitStatusFilter, setVisitStatusFilter] = useState('ALL');
  const [activeVisitTarget, setActiveVisitTarget] = useState<
    DoctorQueueResponse['visits'][number] | null
  >(null);
  const [visitStatus, setVisitStatus] = useState<'WAITING' | 'IN_SCAN' | 'COMPLETED'>('IN_SCAN');
  const [visitNotes, setVisitNotes] = useState('');

  const [uploadTarget, setUploadTarget] = useState<{
    visitId?: string;
    appointmentId?: string;
    label: string;
  } | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => apiFetch<DoctorQueueResponse>('/api/v1/reports/doctor-queue'),
  });

  const visits = useMemo(() => {
    const list = data?.visits ?? [];
    if (visitStatusFilter === 'ALL') return list;
    return list.filter((v) => v.status === visitStatusFilter);
  }, [data?.visits, visitStatusFilter]);

  const waitingOrInScanCount = (data?.visits ?? []).filter((v) => v.status !== 'COMPLETED').length;
  const unpublishedReportsCount = (data?.visits ?? []).reduce(
    (acc, v) => acc + v.reports.filter((r) => r.status !== 'PUBLISHED').length,
    0
  );

  const refreshQueue = async () => {
    await queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['staff-patient-detail'] });
  };

  const handleSaveVisit = async () => {
    if (!activeVisitTarget) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/reports/visits/${activeVisitTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: visitStatus, clinicalNotes: visitNotes }),
      });
      setFeedback(`Updated visit ${activeVisitTarget.visitNumber} (${humanizeStatus(visitStatus)}).`);
      setActiveVisitTarget(null);
      await refreshQueue();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update clinical visit.');
    }
  };

  const handleUploadReport = async () => {
    if (!uploadTarget || !reportFile || reportTitle.trim().length < 3) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const fd = new FormData();
      fd.append('reportPdf', reportFile);
      fd.append('title', reportTitle.trim());
      if (uploadTarget.visitId) fd.append('visitId', uploadTarget.visitId);
      else if (uploadTarget.appointmentId) fd.append('appointmentId', uploadTarget.appointmentId);

      const res = await apiFetch<{ report: { reportCode: string; revisionNumber: number } }>(
        '/api/v1/reports/upload',
        { method: 'POST', body: fd, isFormData: true }
      );
      setFeedback(
        `Uploaded report ${res.report.reportCode} (Rev ${res.report.revisionNumber}).`
      );
      setUploadTarget(null);
      setReportTitle('');
      setReportFile(null);
      await refreshQueue();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Report PDF upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleReviewReport = async (reportId: string, code: string) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/reports/${reportId}/review`, { method: 'POST' });
      setFeedback(`Marked ${code} as medically reviewed.`);
      await refreshQueue();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Review action failed.');
    }
  };

  const handlePublishReport = async (reportId: string, code: string) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/reports/${reportId}/publish`, { method: 'POST' });
      setFeedback(`Published ${code} to secure Patient Portal & triggered portal notice.`);
      await refreshQueue();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Publish failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-[#083642]">
          Scan Room Queue &amp; Diagnostic Report Publishing Desk
        </h2>
        <p className="text-xs text-[#65747B]">
          Manage live scan visits (Waiting → In Scan → Completed), record clinical sonologist findings, and upload or publish PDF reports to the Patient Portal.
        </p>
      </div>

      {/* Live Clinical KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Today's Scheduled Scans",
            val: data?.todayAppointments.length ?? 0,
            icon: CalendarClock,
            color: 'text-[#0D4A5A]',
          },
          {
            label: 'Active Scan Room Queue',
            val: waitingOrInScanCount,
            icon: Stethoscope,
            color: 'text-[#287887]',
          },
          {
            label: 'Unpublished Reports',
            val: unpublishedReportsCount,
            icon: FileCheck2,
            color: unpublishedReportsCount > 0 ? 'text-[#B45309]' : 'text-[#15803D]',
          },
          {
            label: 'Upcoming Scans',
            val: data?.upcomingAppointments.length ?? 0,
            icon: ClipboardList,
            color: 'text-[#0D4A5A]',
          },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-[#DCE7E9] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#65747B]">{k.label}</span>
                <Icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#083642]">{k.val}</p>
            </div>
          );
        })}
      </div>

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

      {/* Checked-In Visits & PDF Reports */}
      <div className="rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-[#083642]">
            Checked-In Visits &amp; Report Revisions ({visits.length})
          </h3>
          <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1">
            {['ALL', 'WAITING', 'IN_SCAN', 'COMPLETED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setVisitStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  visitStatusFilter === st ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
                }`}
              >
                {st === 'ALL' ? 'All Visits' : humanizeStatus(st)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs text-[#65747B]">Loading clinical queue...</p>
        ) : visits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#DCE7E9] bg-[#F8FAFA] p-6 text-center text-xs text-[#65747B]">
            No checked-in visits match the selected stage. Check in patients from Reception Calendar or Patient Records, or upload directly against Today&apos;s Scheduled Scans below.
          </div>
        ) : (
          <div className="divide-y divide-[#E9F3F3]">
            {visits.map((v) => (
              <div key={v.id} className="py-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-tabular font-semibold text-[#0D4A5A]">
                      {v.visitNumber} · {v.appointment.bookingReference} · {humanizeStatus(v.status)}
                    </p>
                    <p className="text-sm font-semibold text-[#083642]">
                      {v.patient.fullName} ({v.patient.patientCode}) · {v.appointment.service.name}
                    </p>
                    <p className="text-[#65747B]">
                      Checked in {formatDateTimeDisplay(v.checkedInAt)}
                      {v.appointment.referringDoctor
                        ? ` · Ref: ${v.appointment.referringDoctor}`
                        : ''}
                      {v.appointment.clinicalIndication
                        ? ` · Indication: ${v.appointment.clinicalIndication}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveVisitTarget(v);
                        setVisitStatus(v.status as typeof visitStatus);
                        setVisitNotes(v.clinicalNotes || '');
                      }}
                    >
                      Scan Status &amp; Notes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setUploadTarget({
                          visitId: v.id,
                          label: `${v.visitNumber} · ${v.patient.fullName}`,
                        });
                        setReportTitle(`${v.appointment.service.name} Report`);
                        setReportFile(null);
                      }}
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                      <span>Upload PDF</span>
                    </Button>
                  </div>
                </div>

                {v.clinicalNotes && (
                  <p className="rounded border border-[#E9F3F3] bg-[#F8FAFA] px-3 py-2 text-[#24343B]">
                    <strong>Clinical Findings:</strong> {v.clinicalNotes}
                  </p>
                )}

                {v.reports.length > 0 && (
                  <div className="rounded-lg border border-[#DCE7E9] bg-[#F8FBFC] p-3 space-y-2">
                    {v.reports.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono-tabular font-semibold text-[#083642]">
                            {r.reportCode} (Rev {r.revisionNumber})
                          </span>{' '}
                          · {r.title} ·{' '}
                          <span
                            className={`font-semibold ${
                              r.status === 'PUBLISHED' ? 'text-[#15803D]' : 'text-[#B45309]'
                            }`}
                          >
                            {humanizeStatus(r.status)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {r.status !== 'PUBLISHED' && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleReviewReport(r.id, r.reportCode)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Mark Reviewed</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handlePublishReport(r.id, r.reportCode)}
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span>Publish to Portal</span>
                              </Button>
                            </>
                          )}
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
                            <span>Download</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's & Upcoming Clinical Appointments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-[#083642]">
            Today&apos;s Scheduled Scans ({data?.todayAppointments.length ?? 0})
          </h3>
          {(data?.todayAppointments ?? []).length === 0 ? (
            <p className="text-xs text-[#65747B]">No appointments scheduled for today.</p>
          ) : (
            <div className="divide-y divide-[#E9F3F3] text-xs">
              {data?.todayAppointments.map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#083642]">
                      {a.patient.fullName} ·{' '}
                      <span className="font-mono-tabular text-[#287887]">{a.bookingReference}</span>
                    </p>
                    <p className="text-[#65747B]">
                      {a.service.name} · {a.startTime}–{a.endTime} · {humanizeStatus(a.status)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUploadTarget({
                        appointmentId: a.id,
                        label: `${a.bookingReference} · ${a.patient.fullName}`,
                      });
                      setReportTitle(`${a.service.name} Report`);
                      setReportFile(null);
                    }}
                  >
                    Upload Report
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-[#083642]">
            Upcoming Diagnostic Queue ({data?.upcomingAppointments.length ?? 0})
          </h3>
          {(data?.upcomingAppointments ?? []).length === 0 ? (
            <p className="text-xs text-[#65747B]">No upcoming appointments queued.</p>
          ) : (
            <div className="divide-y divide-[#E9F3F3] text-xs">
              {data?.upcomingAppointments.slice(0, 12).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#083642]">{a.patient.fullName}</p>
                    <p className="font-mono-tabular text-[#65747B]">
                      {formatDateDisplay(a.appointmentDate)} {a.startTime} · {a.service.name}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-[#0D4A5A]">
                    {humanizeStatus(a.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visit Status & Clinical Notes Modal */}
      <Dialog
        open={Boolean(activeVisitTarget)}
        onClose={() => setActiveVisitTarget(null)}
        title="Update Scan Room Status & Clinical Findings"
        description={
          activeVisitTarget
            ? `${activeVisitTarget.visitNumber} · ${activeVisitTarget.patient.fullName}`
            : undefined
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Visit Status</Label>
            <Select
              value={visitStatus}
              onChange={(e) => setVisitStatus(e.target.value as typeof visitStatus)}
            >
              <option value="WAITING">Waiting</option>
              <option value="IN_SCAN">In Scan Room</option>
              <option value="COMPLETED">Completed</option>
            </Select>
          </div>
          <div>
            <Label>Sonologist Clinical Findings &amp; Follow-up Advice</Label>
            <Textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder="Document fetal biometry notes, Doppler parameters, or follow-up scan recommendations..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setActiveVisitTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveVisit}>
              Save Clinical Visit
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Upload PDF Report Modal */}
      <Dialog
        open={Boolean(uploadTarget)}
        onClose={() => setUploadTarget(null)}
        title="Upload Diagnostic Report PDF"
        description={uploadTarget?.label}
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Report Title</Label>
            <Input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="e.g., Fetal Echocardiography Report"
            />
          </div>
          <div>
            <Label>Verified PDF Report (Max 15 MB)</Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setUploadTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploading || !reportFile || reportTitle.trim().length < 3}
              onClick={handleUploadReport}
            >
              {uploading ? 'Uploading...' : 'Upload PDF Report'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
