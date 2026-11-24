import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  CalendarPlus,
  CheckSquare,
  Clock,
  Kanban,
  ListChecks,
  MessageSquarePlus,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatDateTimeDisplay, humanizeStatus } from '../../lib/utils';

interface CrmAssignee {
  id: string;
  fullName: string;
  role: string;
  email: string;
}

interface CrmTaskItem {
  id: string;
  title: string;
  dueAt: string | null;
  isCompleted: boolean;
  assignedTo: { id: string; fullName: string } | null;
}

interface CrmLead {
  id: string;
  leadCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  interestedService: string | null;
  lmpOrGestationalWeeks: string | null;
  referringDoctor: string | null;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | string;
  preferredDate: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  followUpDueAt: string | null;
  assignedTo: { id: string; fullName: string; role: string } | null;
  convertedPatient: { id: string; patientCode: string; fullName: string } | null;
  linkedAppointment: {
    id: string;
    bookingReference: string;
    appointmentDate: string;
    startTime: string;
    status: string;
    service: { name: string };
  } | null;
  tasks: CrmTaskItem[];
  createdAt: string;
}

interface CrmSummary {
  totalLeads: number;
  newCount: number;
  activeFollowUp: number;
  scheduledOrBooked: number;
  convertedOrVisited: number;
  urgentCount: number;
  overdueFollowUps: number;
  openTasksCount: number;
  conversionRatePct: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

interface ServiceCatalogResponse {
  categories: Array<{
    id: string;
    name: string;
    services: Array<{ id: string; name: string; durationMinutes: number }>;
  }>;
}

interface SlotItem {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string;
}

const STAGE_OPTIONS = [
  'NEW',
  'CONTACTED',
  'INFORMATION_PROVIDED',
  'APPOINTMENT_REQUESTED',
  'APPOINTMENT_CONFIRMED',
  'VISITED',
  'FOLLOW_UP',
  'SCHEDULED',
  'CONVERTED',
  'CLOSED',
] as const;

const KANBAN_GROUPS = [
  {
    key: 'NEW',
    title: 'New Inquiries',
    statuses: ['NEW'],
    defaultTargetStatus: 'NEW',
  },
  {
    key: 'CONTACT',
    title: 'Contacted & Info Sent',
    statuses: ['CONTACTED', 'INFORMATION_PROVIDED'],
    defaultTargetStatus: 'CONTACTED',
  },
  {
    key: 'FOLLOWUP',
    title: 'Follow-Up & Requested',
    statuses: ['FOLLOW_UP', 'APPOINTMENT_REQUESTED'],
    defaultTargetStatus: 'FOLLOW_UP',
  },
  {
    key: 'BOOKED',
    title: 'Scheduled & Confirmed',
    statuses: ['SCHEDULED', 'APPOINTMENT_CONFIRMED'],
    defaultTargetStatus: 'APPOINTMENT_CONFIRMED',
  },
  {
    key: 'CONVERTED',
    title: 'Visited & Converted',
    statuses: ['VISITED', 'CONVERTED', 'CLOSED'],
    defaultTargetStatus: 'CONVERTED',
  },
] as const;

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  URGENT: { label: 'Urgent', className: 'text-[#B42318] font-semibold' },
  HIGH: { label: 'High Priority', className: 'text-[#B45309] font-semibold' },
  NORMAL: { label: 'Normal', className: 'text-[#0D4A5A] font-medium' },
  LOW: { label: 'Low', className: 'text-[#65747B]' },
};

const EMPTY_CREATE_LEAD = {
  fullName: '',
  phone: '',
  email: '',
  source: 'WALK_IN',
  priority: 'NORMAL',
  interestedService: '',
  lmpOrGestationalWeeks: '',
  referringDoctor: '',
  preferredDate: '',
  assignedToId: '',
  followUpDueAt: '',
  notes: '',
};

export function CrmWorkspace() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'tasks'>('list');
  const [showAnalytics, setShowAnalytics] = useState(true);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [dueOnly, setDueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Inquiry Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_LEAD);

  // Selected Lead Details Modal (used from Kanban cards or Edit Details)
  const [detailLead, setDetailLead] = useState<CrmLead | null>(null);
  const [detailForm, setDetailForm] = useState({
    fullName: '',
    phone: '',
    interestedService: '',
    lmpOrGestationalWeeks: '',
    referringDoctor: '',
    priority: 'NORMAL',
    preferredDate: '',
    followUpDueAt: '',
    status: 'NEW',
    assignedToId: '',
    notes: '',
  });

  // 1-Click Book Scan Modal from Lead
  const [bookTargetLead, setBookTargetLead] = useState<CrmLead | null>(null);
  const [bookServiceId, setBookServiceId] = useState('');
  const [bookDate, setBookDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookTime, setBookTime] = useState('10:00');
  const [bookSlots, setBookSlots] = useState<SlotItem[]>([]);
  const [bookOverride, setBookOverride] = useState(false);

  // Inline states for Detailed List cards
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [taskDueInputs, setTaskDueInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [linkRefInputs, setLinkRefInputs] = useState<Record<string, string>>({});

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: assigneesData } = useQuery({
    queryKey: ['crm-assignees'],
    queryFn: () => apiFetch<{ users: CrmAssignee[] }>('/api/v1/crm/assignees'),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['cms-services'],
    queryFn: () => apiFetch<ServiceCatalogResponse>('/api/v1/cms/services'),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'crm-leads',
      statusFilter,
      sourceFilter,
      assigneeFilter,
      priorityFilter,
      dueOnly,
      searchQuery,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (assigneeFilter !== 'ALL') params.set('assignedToId', assigneeFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (dueOnly) params.set('dueOnly', 'true');
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const qs = params.toString();
      return apiFetch<{ leads: CrmLead[]; summary: CrmSummary }>(
        `/api/v1/crm${qs ? `?${qs}` : ''}`
      );
    },
  });

  const leads = data?.leads ?? [];
  const summary = data?.summary;
  const assignees = assigneesData?.users ?? [];
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
    if (!bookTargetLead || !bookServiceId || !bookDate) return;
    apiFetch<{ slots: SlotItem[] }>(
      `/api/v1/appointments/slots?date=${encodeURIComponent(bookDate)}&serviceId=${encodeURIComponent(bookServiceId)}`
    )
      .then((res) => {
        setBookSlots(res.slots);
        const first = res.slots.find((s) => s.available);
        if (first) setBookTime(first.startTime);
      })
      .catch(() => setBookSlots([]));
  }, [bookTargetLead, bookServiceId, bookDate]);

  const sourceChartData = useMemo(() => {
    if (!summary?.bySource) return [];
    return Object.entries(summary.bySource).map(([sourceKey, count]) => ({
      source: humanizeStatus(sourceKey),
      count,
    }));
  }, [summary]);

  const stageFunnelData = useMemo(() => {
    if (!summary) return [];
    return [
      { stage: 'New', count: summary.newCount },
      { stage: 'Follow-Up', count: summary.activeFollowUp },
      { stage: 'Booked', count: summary.scheduledOrBooked },
      { stage: 'Converted', count: summary.convertedOrVisited },
    ];
  }, [summary]);

  const consolidatedTasks = useMemo(() => {
    const items: Array<{ task: CrmTaskItem; lead: CrmLead }> = [];
    for (const lead of leads) {
      for (const t of lead.tasks) {
        items.push({ task: t, lead });
      }
    }
    return items.sort((a, b) => {
      if (a.task.isCompleted !== b.task.isCompleted) {
        return a.task.isCompleted ? 1 : -1;
      }
      const ad = a.task.dueAt ? new Date(a.task.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.task.dueAt ? new Date(b.task.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [leads]);

  const refreshCrm = async () => {
    await queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
  };

  const handleCreateLead = async () => {
    if (!createForm.fullName.trim() || !createForm.phone.trim()) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ lead: { leadCode: string } }>('/api/v1/crm', {
        method: 'POST',
        body: JSON.stringify({
          fullName: createForm.fullName,
          phone: createForm.phone,
          email: createForm.email || '',
          source: createForm.source,
          priority: createForm.priority,
          interestedService: createForm.interestedService || undefined,
          lmpOrGestationalWeeks: createForm.lmpOrGestationalWeeks || undefined,
          referringDoctor: createForm.referringDoctor || undefined,
          preferredDate: createForm.preferredDate || undefined,
          notes: createForm.notes || undefined,
          ...(createForm.assignedToId ? { assignedToId: createForm.assignedToId } : {}),
          ...(createForm.followUpDueAt
            ? { followUpDueAt: new Date(createForm.followUpDueAt).toISOString() }
            : {}),
        }),
      });
      setCreateForm(EMPTY_CREATE_LEAD);
      setCreateOpen(false);
      setFeedback(`Logged CRM inquiry ${res.lead.leadCode} & dispatched acknowledgment.`);
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create inquiry.');
    }
  };

  const handleUpdateLead = async (id: string, payload: Record<string, unknown>) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/crm/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update inquiry.');
    }
  };

  const openLeadModal = (lead: CrmLead) => {
    setDetailLead(lead);
    setDetailForm({
      fullName: lead.fullName,
      phone: lead.phone,
      interestedService: lead.interestedService || '',
      lmpOrGestationalWeeks: lead.lmpOrGestationalWeeks || '',
      referringDoctor: lead.referringDoctor || '',
      priority: lead.priority || 'NORMAL',
      preferredDate: lead.preferredDate || '',
      followUpDueAt: lead.followUpDueAt ? lead.followUpDueAt.slice(0, 10) : '',
      status: lead.status,
      assignedToId: lead.assignedTo?.id || '',
      notes: lead.notes || '',
    });
  };

  const handleSaveDetailModal = async () => {
    if (!detailLead) return;
    setErrorMsg(null);
    try {
      await apiFetch(`/api/v1/crm/${detailLead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: detailForm.fullName,
          phone: detailForm.phone,
          interestedService: detailForm.interestedService || null,
          lmpOrGestationalWeeks: detailForm.lmpOrGestationalWeeks || null,
          referringDoctor: detailForm.referringDoctor || null,
          priority: detailForm.priority,
          preferredDate: detailForm.preferredDate || null,
          followUpDueAt: detailForm.followUpDueAt
            ? new Date(detailForm.followUpDueAt).toISOString()
            : null,
          status: detailForm.status,
          assignedToId: detailForm.assignedToId || null,
          notes: detailForm.notes,
        }),
      });
      setFeedback(`Updated inquiry ${detailLead.leadCode}.`);
      setDetailLead(null);
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update lead details.');
    }
  };

  const openBookModalForLead = (lead: CrmLead) => {
    setBookTargetLead(lead);
    if (lead.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(lead.preferredDate)) {
      setBookDate(lead.preferredDate);
    }
    if (lead.interestedService && allServices.length > 0) {
      const matched = allServices.find((s) =>
        s.name.toLowerCase().includes(lead.interestedService!.toLowerCase())
      );
      if (matched) setBookServiceId(matched.id);
    }
  };

  const handleBookFromLead = async () => {
    if (!bookTargetLead || !bookServiceId) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const bookRes = await apiFetch<{
        appointment: { id: string; bookingReference: string };
      }>('/api/v1/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: bookServiceId,
          date: bookDate,
          startTime: bookTime,
          patientName: bookTargetLead.fullName,
          patientPhone: bookTargetLead.phone,
          patientEmail: bookTargetLead.email || '',
          referringDoctor: bookTargetLead.referringDoctor || '',
          clinicalIndication: bookTargetLead.lmpOrGestationalWeeks
            ? `Gestational Age: ${bookTargetLead.lmpOrGestationalWeeks}`
            : bookTargetLead.interestedService || '',
          bookingChannel: bookTargetLead.source === 'WALK_IN' ? 'WALK_IN' : 'PHONE',
          consentAccepted: true,
          isReceptionOverride: bookOverride,
          overrideReason: bookOverride ? 'Booked directly from CRM Inquiry Pipeline' : '',
          notes: bookTargetLead.notes || '',
        }),
      });

      await apiFetch(`/api/v1/crm/${bookTargetLead.id}/link-appointment`, {
        method: 'POST',
        body: JSON.stringify({ appointmentId: bookRes.appointment.id }),
      });

      setBookTargetLead(null);
      setFeedback(
        `Booked scan ${bookRes.appointment.bookingReference} & linked to inquiry ${bookTargetLead.leadCode}.`
      );
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to book scan from CRM lead.');
    }
  };

  const handleLinkAppointment = async (leadId: string) => {
    const ref = linkRefInputs[leadId]?.trim();
    if (!ref) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        lead: { leadCode: string; linkedAppointment?: { bookingReference: string } | null };
      }>(`/api/v1/crm/${leadId}/link-appointment`, {
        method: 'POST',
        body: JSON.stringify({ bookingReference: ref }),
      });
      setLinkRefInputs((prev) => ({ ...prev, [leadId]: '' }));
      setFeedback(
        `Linked appointment ${res.lead.linkedAppointment?.bookingReference ?? ref} to lead ${res.lead.leadCode}.`
      );
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not link appointment.');
    }
  };

  const handleAddTask = async (leadId: string) => {
    const title = taskInputs[leadId]?.trim();
    if (!title) return;
    setErrorMsg(null);
    try {
      const dueRaw = taskDueInputs[leadId];
      await apiFetch(`/api/v1/crm/${leadId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          ...(dueRaw ? { dueAt: new Date(dueRaw).toISOString() } : {}),
        }),
      });
      setTaskInputs((prev) => ({ ...prev, [leadId]: '' }));
      setTaskDueInputs((prev) => ({ ...prev, [leadId]: '' }));
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add follow-up task.');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    await apiFetch(`/api/v1/crm/tasks/${taskId}/toggle`, { method: 'PATCH' });
    await refreshCrm();
  };

  const handleConvert = async (leadId: string) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ patient: { patientCode: string } }>(
        `/api/v1/crm/${leadId}/convert`,
        { method: 'POST' }
      );
      setFeedback(`Lead converted to Patient Record ${res.patient.patientCode}.`);
      await refreshCrm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Conversion failed.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & View Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#083642]">
            Fetal Imaging CRM, Referrals &amp; Inquiry Pipeline
          </h2>
          <p className="text-xs text-[#65747B]">
            Track website, WhatsApp, walk-in, and OB/GYN referral inquiries with gestational week triage, 1-click scan booking, and follow-up task accountability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[#E9F3F3] p-1">
            {[
              { id: 'list', label: 'Detailed View', icon: ListChecks },
              { id: 'board', label: 'Pipeline Board', icon: Kanban },
              { id: 'tasks', label: `Tasks (${summary?.openTasksCount ?? 0})`, icon: CheckSquare },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id as typeof viewMode)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap ${
                    viewMode === v.id
                      ? 'bg-white text-[#0D4A5A] shadow-sm'
                      : 'text-[#65747B] hover:text-[#083642]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics((prev) => !prev)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>{showAnalytics ? 'Hide Charts' : 'Show Charts'}</span>
          </Button>

          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>Log Inquiry</span>
          </Button>
        </div>
      </div>

      {/* 6 Interactive Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: 'Total Inquiries',
              val: summary.totalLeads,
              icon: Users,
              color: 'text-[#0D4A5A]',
              onClick: () => {
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setDueOnly(false);
              },
            },
            {
              label: 'New Uncontacted',
              val: summary.newCount,
              icon: Sparkles,
              color: summary.newCount > 0 ? 'text-[#B45309]' : 'text-[#287887]',
              onClick: () => setStatusFilter((prev) => (prev === 'NEW' ? 'ALL' : 'NEW')),
            },
            {
              label: 'Active Follow-Up',
              val: summary.activeFollowUp,
              icon: Phone,
              color: 'text-[#287887]',
              onClick: () =>
                setStatusFilter((prev) => (prev === 'FOLLOW_UP' ? 'ALL' : 'FOLLOW_UP')),
            },
            {
              label: 'Scheduled / Booked',
              val: summary.scheduledOrBooked,
              icon: CalendarPlus,
              color: 'text-[#0D4A5A]',
              onClick: () =>
                setStatusFilter((prev) =>
                  prev === 'APPOINTMENT_CONFIRMED' ? 'ALL' : 'APPOINTMENT_CONFIRMED'
                ),
            },
            {
              label: 'Conversion Rate',
              val: `${summary.conversionRatePct}%`,
              icon: TrendingUp,
              color: 'text-[#15803D]',
              onClick: () =>
                setStatusFilter((prev) => (prev === 'CONVERTED' ? 'ALL' : 'CONVERTED')),
            },
            {
              label: 'Urgent / Overdue',
              val: `${summary.urgentCount} / ${summary.overdueFollowUps}`,
              icon: AlertCircle,
              color:
                summary.overdueFollowUps > 0 || summary.urgentCount > 0
                  ? 'text-[#B42318]'
                  : 'text-[#287887]',
              onClick: () => setDueOnly((prev) => !prev),
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.label}
                type="button"
                onClick={k.onClick}
                className="rounded-xl border border-[#DCE7E9] bg-white p-3.5 text-left transition-colors hover:border-[#0D4A5A] hover:bg-[#F8FBFC] cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[#65747B] truncate">{k.label}</span>
                  <Icon className={`h-4 w-4 shrink-0 ${k.color}`} />
                </div>
                <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#083642]">{k.val}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Visual Funnel & Source Charts */}
      {showAnalytics && summary && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#DCE7E9] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-[#083642]">
                Inquiry-to-Appointment Funnel
              </h3>
              <span className="font-mono-tabular text-xs text-[#287887]">
                {summary.convertedOrVisited} completed/converted
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageFunnelData} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(40, 120, 135, 0.16)" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--edfic-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--edfic-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#083642',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--edfic-primary)" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-[#DCE7E9] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-[#083642]">
                Inquiries by Acquisition Channel
              </h3>
              <span className="font-mono-tabular text-xs text-[#287887]">
                {summary.totalLeads} leads
              </span>
            </div>
            {sourceChartData.length === 0 ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[#DCE7E9] bg-[#F8FAFA] text-xs text-[#65747B]">
                Source metrics will populate once inquiries are logged.
              </div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sourceChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 6, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(40, 120, 135, 0.16)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--edfic-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="source" width={125} tick={{ fontSize: 11, fill: 'var(--edfic-text)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#083642',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="var(--edfic-secondary)" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
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

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-[#DCE7E9] bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, mobile, weeks, referring Dr., CRM code..."
              className="pl-9 text-xs"
            />
          </div>
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="text-xs">
            <option value="ALL">All Channels</option>
            <option value="WEBSITE_CONTACT">Website Contact</option>
            <option value="BOOKING_INQUIRY">Phone / Booking Inquiry</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="REFERRAL">Doctor Referral</option>
            <option value="WALK_IN">Walk-In</option>
          </Select>
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-xs">
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </Select>
          <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="text-xs">
            <option value="ALL">All Staff Assignees</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 rounded-lg border border-[#DCE7E9] px-3 text-xs text-[#24343B] cursor-pointer">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(e) => setDueOnly(e.target.checked)}
            />
            <span>Due / Overdue Callbacks</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1 w-fit">
          {['ALL', ...STAGE_OPTIONS].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                statusFilter === st ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
              }`}
            >
              {st === 'ALL' ? 'All Stages' : humanizeStatus(st)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace View */}
      {isLoading ? (
        <div className="rounded-xl border border-[#DCE7E9] bg-white p-8 text-xs text-[#65747B]">
          Loading CRM inquiries and follow-up pipeline...
        </div>
      ) : viewMode === 'board' ? (
        /* View 1: 5-Column Kanban Pipeline Board */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {KANBAN_GROUPS.map((col) => {
            const colLeads = leads.filter((l) => (col.statuses as readonly string[]).includes(l.status));
            return (
              <div
                key={col.key}
                className="rounded-xl border border-[#DCE7E9] bg-[#F8FAFA] p-3 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#DCE7E9] pb-2">
                  <h3 className="font-display text-xs font-semibold text-[#083642]">
                    {col.title}
                  </h3>
                  <span className="font-mono-tabular text-xs font-bold text-[#0D4A5A]">
                    {colLeads.length}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-0.5">
                  {colLeads.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-[#65747B]">No leads</p>
                  ) : (
                    colLeads.map((lead) => {
                      const pMeta = PRIORITY_META[lead.priority] || PRIORITY_META.NORMAL;
                      return (
                        <div
                          key={lead.id}
                          className="rounded-lg border border-[#DCE7E9] bg-white p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono-tabular text-[11px] font-semibold text-[#287887]">
                              {lead.leadCode}
                            </span>
                            <span className={`text-[10px] ${pMeta.className}`}>
                              {pMeta.label}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-[#083642]">{lead.fullName}</p>
                            <p className="font-mono-tabular text-[11px] text-[#65747B]">
                              {lead.phone} · {humanizeStatus(lead.source)}
                            </p>
                          </div>
                          {(lead.interestedService || lead.lmpOrGestationalWeeks) && (
                            <p className="text-[11px] text-[#0D4A5A]">
                              {lead.interestedService || 'Scan Inquiry'}
                              {lead.lmpOrGestationalWeeks
                                ? ` · ${lead.lmpOrGestationalWeeks}`
                                : ''}
                            </p>
                          )}
                          {lead.referringDoctor && (
                            <p className="text-[11px] text-[#65747B]">
                              Ref: {lead.referringDoctor}
                            </p>
                          )}
                          {lead.linkedAppointment && (
                            <p className="font-mono-tabular text-[11px] font-medium text-[#15803D]">
                              Booked: {lead.linkedAppointment.bookingReference}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[#E9F3F3] pt-2">
                            <button
                              type="button"
                              onClick={() => openLeadModal(lead)}
                              className="text-[11px] font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                            >
                              Details ({lead.tasks.filter((t) => !t.isCompleted).length} tasks)
                            </button>
                            {!lead.linkedAppointment && (
                              <button
                                type="button"
                                onClick={() => openBookModalForLead(lead)}
                                className="text-[11px] font-semibold text-[#287887] hover:underline cursor-pointer"
                              >
                                + Book Scan
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'tasks' ? (
        /* View 3: Consolidated Follow-Up Task Tracker */
        <div className="rounded-xl border border-[#DCE7E9] bg-white overflow-x-auto">
          {consolidatedTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#65747B]">
              No follow-up tasks logged for the selected inquiry filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DCE7E9] bg-[#F8FAFA] text-[#65747B]">
                <tr>
                  <th className="px-4 py-3 font-medium">Done</th>
                  <th className="px-4 py-3 font-medium">Follow-Up Task</th>
                  <th className="px-4 py-3 font-medium">Patient / Inquiry</th>
                  <th className="px-4 py-3 font-medium">Scan / GA Weeks</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Assigned Staff</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9F3F3]">
                {consolidatedTasks.map(({ task, lead }) => {
                  const isOverdue =
                    !task.isCompleted &&
                    task.dueAt &&
                    new Date(task.dueAt).getTime() < Date.now();
                  return (
                    <tr key={task.id} className="hover:bg-[#F8FBFC]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={task.isCompleted}
                          onChange={() => handleToggleTask(task.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            task.isCompleted
                              ? 'line-through text-[#65747B]'
                              : 'font-medium text-[#083642]'
                          }
                        >
                          {task.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#083642]">{lead.fullName}</p>
                        <p className="font-mono-tabular text-[11px] text-[#287887]">
                          {lead.leadCode} · {lead.phone}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#24343B]">
                        {lead.interestedService || '-'}
                        {lead.lmpOrGestationalWeeks ? ` (${lead.lmpOrGestationalWeeks})` : ''}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular">
                        {task.dueAt ? (
                          <span className={isOverdue ? 'font-semibold text-[#B42318]' : 'text-[#65747B]'}>
                            {formatDateDisplay(task.dueAt.slice(0, 10))}
                            {isOverdue ? ' (Overdue)' : ''}
                          </span>
                        ) : (
                          'Anytime'
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#65747B]">
                        {task.assignedTo?.fullName || lead.assignedTo?.fullName || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openLeadModal(lead)}
                        >
                          Open Inquiry
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-[#DCE7E9] bg-white p-8 text-center text-xs text-[#65747B]">
          No inquiries match your current search or stage filter.
        </div>
      ) : (
        /* View 2: Broad Detailed Inquiry List */
        <div className="space-y-4">
          {leads.map((lead) => {
            const pMeta = PRIORITY_META[lead.priority] || PRIORITY_META.NORMAL;
            return (
              <div
                key={lead.id}
                className="rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-tabular font-semibold text-[#287887]">
                        {lead.leadCode}
                      </span>
                      <span className="text-[#65747B]">· {humanizeStatus(lead.source)}</span>
                      <span className={pMeta.className}>· {pMeta.label}</span>
                      <span className="font-mono-tabular text-[#65747B]">
                        · {formatDateTimeDisplay(lead.createdAt)}
                      </span>
                      {lead.followUpDueAt && (
                        <span className="inline-flex items-center gap-1 font-mono-tabular text-[#B45309] font-medium">
                          <Clock className="h-3 w-3" /> Due{' '}
                          {formatDateDisplay(lead.followUpDueAt.slice(0, 10))}
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-base font-semibold text-[#083642]">
                      {lead.fullName} ·{' '}
                      <span className="font-mono-tabular font-normal text-sm">{lead.phone}</span>
                      {lead.email ? (
                        <span className="font-normal text-xs text-[#65747B]"> · {lead.email}</span>
                      ) : null}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#0D4A5A]">
                      {lead.interestedService && (
                        <span>
                          <strong>Scan:</strong> {lead.interestedService}
                        </span>
                      )}
                      {lead.lmpOrGestationalWeeks && (
                        <span>
                          <strong>Gestational Window:</strong> {lead.lmpOrGestationalWeeks}
                        </span>
                      )}
                      {lead.referringDoctor && (
                        <span>
                          <strong>Referring Dr:</strong> {lead.referringDoctor}
                        </span>
                      )}
                      {lead.preferredDate && (
                        <span className="font-mono-tabular">
                          <strong>Preferred Date:</strong> {formatDateDisplay(lead.preferredDate)}
                        </span>
                      )}
                    </div>

                    {lead.message && <p className="text-xs text-[#65747B]">{lead.message}</p>}

                    {lead.linkedAppointment && (
                      <p className="font-mono-tabular text-xs font-medium text-[#15803D]">
                        Linked Appointment: {lead.linkedAppointment.bookingReference} ·{' '}
                        {formatDateDisplay(lead.linkedAppointment.appointmentDate)}{' '}
                        {lead.linkedAppointment.startTime} · {lead.linkedAppointment.service.name} ·{' '}
                        {humanizeStatus(lead.linkedAppointment.status)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={lead.priority || 'NORMAL'}
                      onChange={(e) => handleUpdateLead(lead.id, { priority: e.target.value })}
                      className="h-9 w-28 text-xs"
                    >
                      <option value="URGENT">Urgent</option>
                      <option value="HIGH">High</option>
                      <option value="NORMAL">Normal</option>
                      <option value="LOW">Low</option>
                    </Select>

                    <Select
                      value={lead.status}
                      onChange={(e) => handleUpdateLead(lead.id, { status: e.target.value })}
                      className="h-9 w-44 text-xs"
                    >
                      {STAGE_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {humanizeStatus(st)}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={lead.assignedTo?.id ?? ''}
                      onChange={(e) =>
                        handleUpdateLead(lead.id, { assignedToId: e.target.value || null })
                      }
                      className="h-9 w-36 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {assignees.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openLeadModal(lead)}
                    >
                      Edit Triage
                    </Button>

                    {!lead.linkedAppointment && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openBookModalForLead(lead)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        <span>Book Scan</span>
                      </Button>
                    )}

                    {lead.convertedPatient ? (
                      <span className="inline-flex items-center gap-1 font-mono-tabular text-xs font-semibold text-[#15803D]">
                        <UserCheck className="h-3.5 w-3.5" />
                        {lead.convertedPatient.patientCode}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleConvert(lead.id)}
                      >
                        Convert to Patient
                      </Button>
                    )}
                  </div>
                </div>

                {/* Notes, Appointment Linking & Follow-Up Tasks */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 border-t border-[#E9F3F3] pt-3 text-xs">
                  <div className="space-y-2">
                    <p className="font-medium text-[#24343B]">Reception Counseling Notes</p>
                    <div className="flex gap-2">
                      <Input
                        value={noteInputs[lead.id] ?? lead.notes ?? ''}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({ ...prev, [lead.id]: e.target.value }))
                        }
                        placeholder="Add gestational window or counseling note..."
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleUpdateLead(lead.id, {
                            notes: noteInputs[lead.id] ?? lead.notes ?? '',
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-[#24343B]">Link Appointment Reference</p>
                    <div className="flex gap-2">
                      <Input
                        value={linkRefInputs[lead.id] ?? ''}
                        onChange={(e) =>
                          setLinkRefInputs((prev) => ({ ...prev, [lead.id]: e.target.value }))
                        }
                        placeholder="EDF-YYYYMMDD-XXXX"
                        className="h-8 text-xs font-mono-tabular"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLinkAppointment(lead.id)}
                      >
                        Link
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-[#24343B]">Follow-Up Tasks</p>
                    <div className="flex gap-2">
                      <Input
                        value={taskInputs[lead.id] ?? ''}
                        onChange={(e) =>
                          setTaskInputs((prev) => ({ ...prev, [lead.id]: e.target.value }))
                        }
                        placeholder="e.g., Confirm anomaly window"
                        className="h-8 text-xs"
                      />
                      <Input
                        type="date"
                        value={taskDueInputs[lead.id] ?? ''}
                        onChange={(e) =>
                          setTaskDueInputs((prev) => ({ ...prev, [lead.id]: e.target.value }))
                        }
                        className="h-8 w-36 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddTask(lead.id)}
                      >
                        Add
                      </Button>
                    </div>
                    {lead.tasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-xs text-[#24343B] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={t.isCompleted}
                          onChange={() => handleToggleTask(t.id)}
                        />
                        <span className={t.isCompleted ? 'line-through text-[#65747B]' : ''}>
                          {t.title}
                          {t.dueAt ? ` · Due ${formatDateDisplay(t.dueAt.slice(0, 10))}` : ''}
                          {t.assignedTo ? ` · ${t.assignedTo.fullName}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log New Inquiry Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Log New Inquiry / Doctor Referral"
        description="Record patient inquiry, gestational window, referring OB/GYN, and callback schedule."
        className="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Patient Name *</Label>
              <Input
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Mobile Number *</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="10-digit mobile"
              />
            </div>
            <div>
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Channel / Source</Label>
              <Select
                value={createForm.source}
                onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
              >
                <option value="WALK_IN">Walk-In</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="REFERRAL">Doctor Referral</option>
                <option value="BOOKING_INQUIRY">Phone Inquiry</option>
                <option value="WEBSITE_CONTACT">Website Contact</option>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
              >
                <option value="URGENT">Urgent (Time-sensitive GA window)</option>
                <option value="HIGH">High Priority</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </Select>
            </div>
            <div>
              <Label>Assign Staff</Label>
              <Select
                value={createForm.assignedToId}
                onChange={(e) => setCreateForm({ ...createForm, assignedToId: e.target.value })}
              >
                <option value="">Current Staff User</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Requested Scan / Service</Label>
              <Input
                value={createForm.interestedService}
                onChange={(e) =>
                  setCreateForm({ ...createForm, interestedService: e.target.value })
                }
                placeholder="e.g., Level-II Anomaly / NT Scan"
              />
            </div>
            <div>
              <Label>LMP or Gestational Weeks</Label>
              <Input
                value={createForm.lmpOrGestationalWeeks}
                onChange={(e) =>
                  setCreateForm({ ...createForm, lmpOrGestationalWeeks: e.target.value })
                }
                placeholder="e.g., 19 weeks / LMP 10-Jul"
              />
            </div>
            <div>
              <Label>Referring OB/GYN Doctor</Label>
              <Input
                value={createForm.referringDoctor}
                onChange={(e) =>
                  setCreateForm({ ...createForm, referringDoctor: e.target.value })
                }
                placeholder="Dr. Name"
              />
            </div>
            <div>
              <Label>Preferred Scan Date</Label>
              <Input
                type="date"
                value={createForm.preferredDate}
                onChange={(e) => setCreateForm({ ...createForm, preferredDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Follow-Up Due Date</Label>
              <Input
                type="date"
                value={createForm.followUpDueAt}
                onChange={(e) => setCreateForm({ ...createForm, followUpDueAt: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Reception Counseling / Clinical Triage Notes</Label>
            <Textarea
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              placeholder="Scan preparation instructions, patient timing preference, or referral details..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!createForm.fullName.trim() || createForm.phone.trim().length < 10}
              onClick={handleCreateLead}
            >
              Create Inquiry
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Lead Triage & Tasks Modal */}
      <Dialog
        open={Boolean(detailLead)}
        onClose={() => setDetailLead(null)}
        title="Inquiry Triage & Follow-Up Details"
        description={detailLead ? `${detailLead.leadCode} · ${detailLead.fullName}` : undefined}
        className="max-w-2xl"
      >
        {detailLead && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Patient Name</Label>
                <Input
                  value={detailForm.fullName}
                  onChange={(e) => setDetailForm({ ...detailForm, fullName: e.target.value })}
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={detailForm.phone}
                  onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={detailForm.priority}
                  onChange={(e) => setDetailForm({ ...detailForm, priority: e.target.value })}
                >
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </Select>
              </div>
              <div>
                <Label>Pipeline Stage</Label>
                <Select
                  value={detailForm.status}
                  onChange={(e) => setDetailForm({ ...detailForm, status: e.target.value })}
                >
                  {STAGE_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {humanizeStatus(st)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Assigned Staff</Label>
                <Select
                  value={detailForm.assignedToId}
                  onChange={(e) =>
                    setDetailForm({ ...detailForm, assignedToId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Callback Due Date</Label>
                <Input
                  type="date"
                  value={detailForm.followUpDueAt}
                  onChange={(e) =>
                    setDetailForm({ ...detailForm, followUpDueAt: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Interested Scan</Label>
                <Input
                  value={detailForm.interestedService}
                  onChange={(e) =>
                    setDetailForm({ ...detailForm, interestedService: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Gestational Age / LMP</Label>
                <Input
                  value={detailForm.lmpOrGestationalWeeks}
                  onChange={(e) =>
                    setDetailForm({ ...detailForm, lmpOrGestationalWeeks: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Referring Doctor</Label>
                <Input
                  value={detailForm.referringDoctor}
                  onChange={(e) =>
                    setDetailForm({ ...detailForm, referringDoctor: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Counseling Notes</Label>
              <Textarea
                value={detailForm.notes}
                onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDetailLead(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveDetailModal}>
                Save Inquiry Updates
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* 1-Click Book Scan & Link Appointment Dialog */}
      <Dialog
        open={Boolean(bookTargetLead)}
        onClose={() => setBookTargetLead(null)}
        title="Book Diagnostic Scan from Inquiry"
        description={
          bookTargetLead
            ? `${bookTargetLead.leadCode} · ${bookTargetLead.fullName} (${bookTargetLead.phone})`
            : undefined
        }
        className="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Diagnostic Scan Service</Label>
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
            <span>Authorize Desk Slot Override</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setBookTargetLead(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleBookFromLead}>
              Confirm Booking &amp; Link Inquiry
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
