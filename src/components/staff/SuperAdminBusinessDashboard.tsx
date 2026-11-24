import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  Phone,
  Settings,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { formatDateDisplay, formatDateTimeDisplay, formatInr, humanizeStatus } from '../../lib/utils';

interface BusinessSummaryResponse {
  todayDate: string;
  clinic: {
    clinicName: string;
    fullName: string;
    parentUnitName: string;
    tagline: string;
    addressLine: string;
    landmark: string;
    cityStateCountry: string;
    primaryPhone: string;
    secondaryPhone: string;
    whatsappNumber: string;
    officialEmail: string;
    weekdayHours: string;
    sundayHours: string;
    upiId: string;
    upiMerchantName: string;
    defaultAdvanceAmountInr: number;
    slotDurationMinutes: number;
    slotCapacityPerSlot: number;
    maxDailyAppointments: number;
    morningSessionStart: string;
    morningSessionEnd: string;
    n8nConnectionStatus: string;
    whatsappConnectionStatus: string;
    upcomingHolidays: Array<{ id: string; date: string; reason: string }>;
  };
  website: {
    totalCategories: number;
    visibleCategories: number;
    totalServices: number;
    visibleServices: number;
    morningSpecialistServices: number;
    cmsTotal: number;
    cmsPublished: number;
    cmsInReview: number;
    cmsItems: Array<{
      id: string;
      slug: string;
      pageKey: string;
      title: string;
      status: string;
      publishedAt: string | null;
      updatedAt: string;
    }>;
    onlineBookings: number;
    websiteLeads: number;
    whatsappLeads: number;
    topServices: Array<{
      id: string;
      code: string;
      name: string;
      categoryName: string;
      durationMinutes: number;
      advanceAmountInr: number;
      isVisiblePublic: boolean;
      requiresDoctorMorning: boolean;
      bookingCount: number;
    }>;
  };
  business: {
    appointments: {
      total: number;
      today: number;
      upcoming: number;
      confirmed: number;
      completed: number;
      cancelled: number;
      slotUtilizationPctToday: number;
      byChannel: Array<{ channel: string; count: number }>;
      byCategory: Array<{ category: string; count: number }>;
    };
    revenue: {
      verifiedTotalInr: number;
      pendingVerificationInr: number;
      pendingPaymentsCount: number;
      refundedInr: number;
      billedServiceTotalInr: number;
      balanceDueInr: number;
      byMethod: Array<{ method: string; amountInr: number }>;
    };
    patients: {
      total: number;
      activePregnancies: number;
      highRisk: number;
      pcpndtCompleted: number;
      pcpndtPending: number;
      consentAccepted: number;
    };
    clinical: {
      totalVisits: number;
      inScanQueue: number;
      completedVisits: number;
      totalReports: number;
      publishedReports: number;
      pendingReports: number;
      totalReportDownloads: number;
    };
    crm: {
      totalLeads: number;
      newLeads: number;
      convertedLeads: number;
      urgentLeads: number;
      openTasks: number;
      overdueTasks: number;
      bySource: Array<{ source: string; count: number }>;
    };
    governance: {
      activeStaff: number;
      superAdmins: number;
      receptionStaff: number;
      patientPortalUsers: number;
      webhooksSent: number;
      webhooksFailed: number;
      whatsappTotal: number;
      recentAuditLogs: Array<{
        id: string;
        action: string;
        resourceType: string;
        summary: string;
        createdAt: string;
        actor: { fullName: string } | null;
      }>;
    };
  };
  dailyTrend: Array<{
    date: string;
    appointments: number;
    online: number;
    verifiedInr: number;
  }>;
}

export function SuperAdminBusinessDashboard() {
  const [trendMode, setTrendMode] = useState<'appointments' | 'online' | 'verifiedInr'>(
    'appointments'
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin-business-summary'],
    queryFn: () => apiFetch<BusinessSummaryResponse>('/api/v1/admin/business-summary'),
  });

  const channelChartData = useMemo(
    () =>
      (data?.business.appointments.byChannel ?? []).map((c) => ({
        channel: humanizeStatus(c.channel),
        count: c.count,
      })),
    [data]
  );

  const sourceChartData = useMemo(
    () =>
      (data?.business.crm.bySource ?? []).map((s) => ({
        source: humanizeStatus(s.source),
        count: s.count,
      })),
    [data]
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-28 rounded-xl border border-[#DCE7E9] bg-white animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-[#DCE7E9] bg-white animate-pulse" />
      </div>
    );
  }

  const { clinic, website, business, dailyTrend } = data;
  const crmConversionPct =
    business.crm.totalLeads > 0
      ? Math.round((business.crm.convertedLeads / business.crm.totalLeads) * 100)
      : 0;

  const pillars = [
    {
      title: 'Dashboard',
      subtitle: 'Website & Business Overview',
      metric: `${formatInr(business.revenue.verifiedTotalInr)}`,
      detail: `${website.visibleServices} live scans · ${business.appointments.today} today`,
      icon: LayoutDashboard,
      to: '/staff/dashboard',
      active: true,
    },
    {
      title: 'CRM & Inquiries',
      subtitle: 'Leads, Referrals & Follow-Ups',
      metric: `${business.crm.totalLeads} Leads`,
      detail: `${business.crm.newLeads} new · ${business.crm.openTasks} open tasks`,
      icon: Activity,
      to: '/staff/crm',
      active: false,
    },
    {
      title: 'Reception & Calendar',
      subtitle: 'Slots, Phone Bookings & Check-Ins',
      metric: `${business.appointments.today} / ${clinic.maxDailyAppointments} Today`,
      detail: `${business.appointments.upcoming} upcoming · ${business.appointments.slotUtilizationPctToday}% cap`,
      icon: CalendarDays,
      to: '/staff/reception',
      active: false,
    },
    {
      title: 'UPI Verification',
      subtitle: 'Advance UTR & Fee Reconciliation',
      metric: `${business.revenue.pendingPaymentsCount} Pending`,
      detail: `${formatInr(business.revenue.pendingVerificationInr)} awaiting review`,
      icon: CreditCard,
      to: '/staff/payments',
      active: false,
    },
    {
      title: 'Patient Records',
      subtitle: 'Maternal-Fetal Registry & Form-F',
      metric: `${business.patients.total} Patients`,
      detail: `${business.patients.highRisk} high-risk · ${business.patients.pcpndtPending} Form-F pending`,
      icon: Users,
      to: '/staff/patients',
      active: false,
    },
    {
      title: 'Admin & Automation',
      subtitle: 'Catalog, Roles, n8n & Audit',
      metric: `${business.governance.activeStaff} Staff Active`,
      detail: `n8n: ${humanizeStatus(clinic.n8nConnectionStatus)} · WA: ${business.governance.whatsappTotal} logs`,
      icon: Settings,
      to: '/staff/admin',
      active: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Banner + Live Public Website Link */}
      <div className="rounded-xl border border-[#DCE7E9] bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#287887]">
            <Building2 className="h-3.5 w-3.5" />
            <span>
              {clinic.fullName} ({clinic.parentUnitName}) · Reference Date{' '}
              <span className="font-mono-tabular">{formatDateDisplay(data.todayDate)}</span>
            </span>
          </div>
          <h2 className="font-display text-lg font-bold text-[#083642]">
            Super Admin Command &amp; Website Business Overview
          </h2>
          <p className="text-xs text-[#65747B]">
            Unified visibility across public website traffic, online bookings, diagnostic catalog, revenue ledger, maternal-fetal patient registry, CRM funnel, and clinic governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] px-3.5 text-xs font-medium text-[#0D4A5A] hover:border-[#0D4A5A]"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Open Public Website</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            to="/staff/admin"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0D4A5A] px-3.5 text-xs font-medium text-white hover:bg-[#083642]"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Manage Clinic &amp; Website</span>
          </Link>
        </div>
      </div>

      {/* Super Admin 6-Pillar Command Modules */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-[#083642]">
            Super Admin Operations Modules
          </h3>
          <span className="text-[11px] text-[#65747B]">
            Direct access to every operational desk and website control center
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.to}
                className={`group rounded-xl border p-4 transition-colors ${
                  item.active
                    ? 'border-[#0D4A5A] bg-[#F4FAFC]'
                    : 'border-[#DCE7E9] bg-white hover:border-[#0D4A5A] hover:bg-[#F8FBFC]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold text-[#083642]">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#65747B]">{item.subtitle}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9F3F3] text-[#0D4A5A] shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-[#E9F3F3] pt-2.5">
                  <span className="font-mono-tabular text-base font-bold text-[#083642]">
                    {item.metric}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#287887] group-hover:text-[#0D4A5A]">
                    <span>{item.detail}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Website Storefront & Business Performance KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          {
            label: 'Website Bookings',
            val: website.onlineBookings,
            sub: `of ${business.appointments.total} total`,
            icon: Globe,
            color: 'text-[#0D4A5A]',
          },
          {
            label: 'Web Inquiries',
            val: website.websiteLeads,
            sub: `+${website.whatsappLeads} WhatsApp`,
            icon: MessageSquare,
            color: 'text-[#287887]',
          },
          {
            label: 'Live Scan Catalog',
            val: `${website.visibleServices}/${website.totalServices}`,
            sub: `${website.visibleCategories} departments`,
            icon: Stethoscope,
            color: 'text-[#0D4A5A]',
          },
          {
            label: 'Published CMS',
            val: `${website.cmsPublished}/${website.cmsTotal}`,
            sub: `${website.cmsInReview} pending review`,
            icon: FileText,
            color: 'text-[#287887]',
          },
          {
            label: 'Verified Collections',
            val: formatInr(business.revenue.verifiedTotalInr),
            sub: `Bal due ${formatInr(business.revenue.balanceDueInr)}`,
            icon: TrendingUp,
            color: 'text-[#15803D]',
          },
          {
            label: 'Portal Accounts',
            val: business.governance.patientPortalUsers,
            sub: `${business.clinical.totalReportDownloads} PDF downloads`,
            icon: ShieldCheck,
            color: 'text-[#0D4A5A]',
          },
          {
            label: 'Maternal Risk Cases',
            val: business.patients.highRisk,
            sub: `${business.patients.activePregnancies} active pregnancies`,
            icon: HeartPulse,
            color: business.patients.highRisk > 0 ? 'text-[#B42318]' : 'text-[#287887]',
          },
          {
            label: 'Form-F Compliance',
            val: `${business.patients.pcpndtCompleted}/${business.patients.total}`,
            sub: `${business.patients.pcpndtPending} pending`,
            icon: ClipboardCheck,
            color: business.patients.pcpndtPending > 0 ? 'text-[#B45309]' : 'text-[#15803D]',
          },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-[#DCE7E9] bg-white p-3.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-[#65747B] truncate">{k.label}</span>
                <Icon className={`h-3.5 w-3.5 shrink-0 ${k.color}`} />
              </div>
              <p className="mt-1.5 font-mono-tabular text-lg font-bold text-[#083642] truncate">
                {k.val}
              </p>
              <p className="mt-0.5 font-mono-tabular text-[10px] text-[#65747B] truncate">
                {k.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main Analytics Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 14-Day Website vs Total Activity Chart */}
        <div className="lg:col-span-7 rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[#287887]">
                14-Day Business &amp; Website Telemetry
              </p>
              <h3 className="font-display text-base font-semibold text-[#083642]">
                {trendMode === 'appointments'
                  ? 'Total Clinic Appointments'
                  : trendMode === 'online'
                    ? 'Direct Website Bookings (Online)'
                    : 'Verified Advance Revenue (INR)'}
              </h3>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-[#E9F3F3] p-1">
              {[
                { id: 'appointments', label: 'All Bookings' },
                { id: 'online', label: 'Website Only' },
                { id: 'verifiedInr', label: 'Revenue INR' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTrendMode(m.id as typeof trendMode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                    trendMode === m.id ? 'bg-white text-[#0D4A5A] shadow-sm' : 'text-[#65747B]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {dailyTrend.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#DCE7E9] bg-[#F8FAFA] text-center px-4">
              <Activity className="h-6 w-6 text-[#287887]" />
              <p className="mt-2 text-xs font-medium text-[#083642]">
                No booking or payment telemetry recorded in the last 14 days
              </p>
              <p className="mt-1 text-[11px] text-[#65747B]">
                Bookings from the public website or Reception Desk will visualize here automatically.
              </p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="superBizFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D4A5A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0D4A5A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(40, 120, 135, 0.16)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => String(d).slice(5)}
                    tick={{ fontSize: 11, fill: 'var(--edfic-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--edfic-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#083642',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                    formatter={(value) =>
                      trendMode === 'verifiedInr'
                        ? [formatInr(Number(value ?? 0)), 'Verified INR']
                        : [String(value ?? 0), trendMode === 'online' ? 'Online' : 'Appointments']
                    }
                    labelFormatter={(label) => `Date: ${formatDateDisplay(String(label))}`}
                  />
                  <Area
                    type="monotone"
                    dataKey={trendMode}
                    stroke="var(--edfic-primary)"
                    strokeWidth={2.2}
                    fill="url(#superBizFill)"
                    activeDot={{
                      r: 5,
                      fill: 'var(--edfic-primary)',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Channel Mix & Inquiry Sources */}
        <div className="lg:col-span-5 rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-[#287887]">Acquisition &amp; Desk Mix</p>
              <h3 className="font-display text-base font-semibold text-[#083642]">
                Booking Channels &amp; Lead Sources
              </h3>
            </div>
            <span className="font-mono-tabular text-xs font-semibold text-[#0D4A5A]">
              {crmConversionPct}% CRM conv.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={channelChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(40, 120, 135, 0.14)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'var(--edfic-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="channel"
                    width={90}
                    tick={{ fontSize: 11, fill: 'var(--edfic-text)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#083642',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--edfic-primary)"
                    radius={[0, 6, 6, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-t border-[#E9F3F3] pt-3">
              <p className="text-[11px] font-medium text-[#65747B] mb-2">
                CRM Inquiry Sources ({business.crm.totalLeads} total)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {sourceChartData.length === 0 ? (
                  <p className="col-span-2 text-[#65747B]">No CRM leads logged yet.</p>
                ) : (
                  sourceChartData.map((s) => (
                    <div
                      key={s.source}
                      className="flex items-center justify-between rounded-lg border border-[#E9F3F3] bg-[#F8FAFA] px-2.5 py-1.5"
                    >
                      <span className="truncate text-[#24343B]">{s.source}</span>
                      <span className="font-mono-tabular font-semibold text-[#0D4A5A]">
                        {s.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Website Profile / Business Configuration & Top Website Diagnostic Services */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Website Business Profile & Storefront Details */}
        <div className="lg:col-span-5 rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E9F3F3] pb-3">
            <div>
              <p className="text-[11px] font-medium text-[#287887]">Public Website Profile</p>
              <h3 className="font-display text-base font-semibold text-[#083642]">
                Business Details Published Live
              </h3>
            </div>
            <Link
              to="/staff/admin"
              className="text-xs font-medium text-[#0D4A5A] hover:underline"
            >
              Edit Settings
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="rounded-lg border border-[#E9F3F3] bg-[#F8FAFA] p-3 space-y-1">
              <p className="font-semibold text-[#083642]">{clinic.fullName}</p>
              <p className="text-[#65747B]">
                {clinic.addressLine}, {clinic.landmark}, {clinic.cityStateCountry}
              </p>
              <p className="text-[#24343B] italic">{clinic.tagline}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-[#E9F3F3] p-2.5">
                <p className="text-[11px] text-[#65747B]">Reception &amp; WhatsApp</p>
                <p className="font-mono-tabular font-medium text-[#083642] mt-0.5 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-[#287887]" />
                  <span>{clinic.primaryPhone || 'Not set'}</span>
                </p>
                <p className="font-mono-tabular text-[11px] text-[#65747B]">
                  WA: {clinic.whatsappNumber || 'Not set'}
                </p>
              </div>
              <div className="rounded-lg border border-[#E9F3F3] p-2.5">
                <p className="text-[11px] text-[#65747B]">Website UPI Merchant</p>
                <p className="font-mono-tabular font-semibold text-[#0D4A5A] mt-0.5 truncate">
                  {clinic.upiId}
                </p>
                <p className="font-mono-tabular text-[11px] text-[#65747B]">
                  Default Advance: {formatInr(clinic.defaultAdvanceAmountInr)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#E9F3F3] p-3 space-y-1">
              <p className="font-medium text-[#083642]">Operating Hours &amp; Slot Rules</p>
              <p className="text-[#65747B]">{clinic.weekdayHours}</p>
              <p className="text-[#65747B]">{clinic.sundayHours}</p>
              <p className="font-mono-tabular text-[#0D4A5A] pt-1">
                {clinic.slotDurationMinutes} min/slot · {clinic.slotCapacityPerSlot} parallel rooms · Max{' '}
                {clinic.maxDailyAppointments}/day · Morning Dr: {clinic.morningSessionStart}–
                {clinic.morningSessionEnd}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-[#E9F3F3] p-2.5">
                <p className="text-[11px] text-[#65747B]">n8n Automation</p>
                <p className="font-semibold text-[#083642] mt-0.5">
                  {humanizeStatus(clinic.n8nConnectionStatus)}
                </p>
                <p className="font-mono-tabular text-[11px] text-[#65747B]">
                  {business.governance.webhooksSent} sent · {business.governance.webhooksFailed} failed
                </p>
              </div>
              <div className="rounded-lg border border-[#E9F3F3] p-2.5">
                <p className="text-[11px] text-[#65747B]">WhatsApp API</p>
                <p className="font-semibold text-[#083642] mt-0.5">
                  {humanizeStatus(clinic.whatsappConnectionStatus)}
                </p>
                <p className="font-mono-tabular text-[11px] text-[#65747B]">
                  {business.governance.whatsappTotal} messages logged
                </p>
              </div>
            </div>

            {clinic.upcomingHolidays.length > 0 && (
              <div className="rounded-lg border border-[#FEF0C7] bg-[#FFFAEB] p-2.5 text-[11px] text-[#B45309]">
                <strong>Upcoming Closed Dates:</strong>{' '}
                {clinic.upcomingHolidays
                  .map((h) => `${formatDateDisplay(h.date)} (${h.reason})`)
                  .join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* Website Diagnostic Services & Booking Demand */}
        <div className="lg:col-span-7 rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E9F3F3] pb-3">
            <div>
              <p className="text-[11px] font-medium text-[#287887]">Website Service Catalog</p>
              <h3 className="font-display text-base font-semibold text-[#083642]">
                Diagnostic Scans &amp; Booking Demand ({website.totalServices} Total)
              </h3>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0D4A5A] hover:underline"
            >
              <span>View Public Services Page</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DCE7E9] bg-[#F8FAFA] text-[#65747B]">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Diagnostic Scan</th>
                  <th className="px-3 py-2.5 font-medium">Department</th>
                  <th className="px-3 py-2.5 font-medium">Advance</th>
                  <th className="px-3 py-2.5 font-medium">Website</th>
                  <th className="px-3 py-2.5 font-medium text-right">Bookings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9F3F3]">
                {website.topServices.map((svc) => (
                  <tr key={svc.id} className="hover:bg-[#F8FBFC]">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-[#083642]">{svc.name}</p>
                      <p className="font-mono-tabular text-[11px] text-[#65747B]">
                        {svc.code} · {svc.durationMinutes} min
                        {svc.requiresDoctorMorning ? ' · Morning Dr.' : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-[#24343B]">{svc.categoryName}</td>
                    <td className="px-3 py-2.5 font-mono-tabular text-[#083642]">
                      {formatInr(svc.advanceAmountInr)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`font-medium ${
                          svc.isVisiblePublic ? 'text-[#15803D]' : 'text-[#65747B]'
                        }`}
                      >
                        {svc.isVisiblePublic ? 'Live' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tabular font-bold text-[#0D4A5A]">
                      {svc.bookingCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CMS Website Pages, Clinical Status & Security Audit Snapshot */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Website CMS & Legal Pages Compliance */}
        <div className="lg:col-span-5 rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E9F3F3] pb-2.5">
            <h3 className="font-display text-sm font-semibold text-[#083642]">
              Website Pages &amp; Clinical Desk Health
            </h3>
            <span className="font-mono-tabular text-xs text-[#287887]">
              {business.clinical.publishedReports} reports published
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-lg border border-[#E9F3F3] bg-[#F8FAFA] p-3">
              <p className="text-[#65747B]">Scan Room Visits</p>
              <p className="font-mono-tabular text-lg font-bold text-[#083642]">
                {business.clinical.totalVisits}
              </p>
              <p className="text-[11px] text-[#287887]">
                {business.clinical.inScanQueue} active in queue
              </p>
            </div>
            <div className="rounded-lg border border-[#E9F3F3] bg-[#F8FAFA] p-3">
              <p className="text-[#65747B]">Diagnostic Reports</p>
              <p className="font-mono-tabular text-lg font-bold text-[#083642]">
                {business.clinical.totalReports}
              </p>
              <p className="text-[11px] text-[#B45309]">
                {business.clinical.pendingReports} awaiting publish
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 text-xs">
            <p className="font-medium text-[#083642]">
              Published Website Legal &amp; Compliance Pages ({website.cmsTotal})
            </p>
            {website.cmsItems.length === 0 ? (
              <p className="text-[#65747B]">Standard compliance pages served by public layout.</p>
            ) : (
              <div className="divide-y divide-[#E9F3F3] max-h-40 overflow-y-auto">
                {website.cmsItems.map((c) => (
                  <div key={c.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-[#24343B]">{c.title}</span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#15803D] shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      {humanizeStatus(c.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Security & Business Activity Log */}
        <div className="lg:col-span-7 rounded-xl border border-[#DCE7E9] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E9F3F3] pb-2.5">
            <h3 className="font-display text-sm font-semibold text-[#083642]">
              Recent Business &amp; Security Activity
            </h3>
            <Link
              to="/staff/admin"
              className="text-xs font-medium text-[#0D4A5A] hover:underline"
            >
              Full Audit Trail
            </Link>
          </div>
          <div className="divide-y divide-[#E9F3F3] text-xs max-h-64 overflow-y-auto">
            {business.governance.recentAuditLogs.length === 0 ? (
              <p className="py-4 text-[#65747B]">No recent audit logs.</p>
            ) : (
              business.governance.recentAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#083642] truncate">{log.summary}</p>
                    <p className="font-mono-tabular text-[11px] text-[#65747B]">
                      {log.actor?.fullName || 'System / Website Visitor'} · {log.action}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-[#65747B] whitespace-nowrap shrink-0">
                    {formatDateTimeDisplay(log.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
