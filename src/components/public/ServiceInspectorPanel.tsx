import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileCheck2,
  PhoneCall,
  Stethoscope,
} from 'lucide-react';
import type { PublicServiceItem } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';
import {
  buildPreparationChecklist,
  classifyServicePrep,
  formatSlotTime,
  getUpcomingDates,
  toLocalDateIso,
} from '../../lib/serviceHelpers';
import { formatDateDisplay } from '../../lib/utils';
import { Button } from '../ui/Button';

interface LiveSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  remainingCapacity: number;
  reason?: string;
}

export function ServiceInspectorPanel({
  service,
  categoryName,
  categorySlug,
  onRequestCallback,
  showFullPageLink = true,
  className = '',
}: {
  service: PublicServiceItem;
  categoryName?: string;
  categorySlug?: string;
  onRequestCallback?: (service: PublicServiceItem) => void;
  showFullPageLink?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const [infoTab, setInfoTab] = useState<'scope' | 'prep'>('scope');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const upcomingDates = useMemo(() => getUpcomingDates(5), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalDateIso(tomorrow);
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [slots, setSlots] = useState<LiveSlot[]>([]);
  const [slotsMeta, setSlotsMeta] = useState<{
    isHoliday: boolean;
    holidayReason?: string;
    isSunday: boolean;
  } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const prepClass = useMemo(() => classifyServicePrep(service), [service]);
  const checklist = useMemo(
    () => buildPreparationChecklist(service, categorySlug),
    [service, categorySlug]
  );

  // Reset checklist and selected slot when service changes
  useEffect(() => {
    setCheckedIds({});
    setSelectedSlot('');
    setInfoTab('scope');
  }, [service.id]);

  // Fetch live available slots whenever service or date changes
  useEffect(() => {
    let active = true;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot('');

    apiFetch<{
      isHoliday: boolean;
      holidayReason?: string;
      isSunday: boolean;
      slots: LiveSlot[];
    }>(
      `/api/v1/appointments/slots?date=${encodeURIComponent(
        selectedDate
      )}&serviceId=${encodeURIComponent(service.id)}`
    )
      .then((res) => {
        if (!active) return;
        setSlots(res.slots ?? []);
        setSlotsMeta({
          isHoliday: res.isHoliday,
          holidayReason: res.holidayReason,
          isSunday: res.isSunday,
        });
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
        setSlotsError('Live slots preview unavailable right now — continue to full booking.');
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [service.id, selectedDate]);

  const openSlots = useMemo(() => slots.filter((s) => s.available), [slots]);
  const checkedCount = checklist.filter((item) => checkedIds[item.id]).length;
  const minDateIso = toLocalDateIso(new Date());

  const toggleChecklist = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBookClick = () => {
    const params = new URLSearchParams();
    params.set('service', service.slug);
    params.set('date', selectedDate);
    if (selectedSlot) {
      params.set('slot', selectedSlot);
    }
    navigate(`/book?${params.toString()}`);
  };

  return (
    <div
      className={`rounded-2xl border border-[#DCE7E9] bg-white p-5 sm:p-6 space-y-5 edfic-card-soft ${className}`}
    >
      {/* Header Metadata & Title */}
      <div className="border-b border-[#E9F3F3] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#65747B]">
          <p className="min-w-0">
            {categoryName && (
              <>
                <span className="font-medium text-[#287887]">{categoryName}</span>
                <span aria-hidden="true"> · </span>
              </>
            )}
            <span className="font-mono-tabular">{service.code}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono-tabular">{service.durationMinutes} min</span>
          </p>
          {showFullPageLink && (
            <Link
              to={`/services/${service.slug}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D4A5A] hover:underline whitespace-nowrap shrink-0"
            >
              <span>Full Page</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        <h3 className="mt-2 font-display text-xl sm:text-2xl font-bold text-[#083642] leading-snug text-balance">
          {service.name}
        </h3>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#455A64]">
          {service.summary}
        </p>

        {/* Key Clinical Signal Strip */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#24343B]">
          <span className="inline-flex items-center gap-1.5">
            <FileCheck2 className="h-3.5 w-3.5 text-[#287887]" />
            <span>{prepClass.label}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-[#287887]" />
            <span>
              {service.requiresDoctorMorning
                ? 'Morning Specialist (Dr. Varun Agrawal)'
                : 'Available During Clinic Hours'}
            </span>
          </span>
        </div>
      </div>

      {/* Interactive Scope / Preparation Tabs */}
      <div>
        <div
          role="tablist"
          aria-label="Service details tabs"
          className="grid grid-cols-2 gap-1 rounded-xl bg-[#EEF5F7] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={infoTab === 'scope'}
            onClick={() => setInfoTab('scope')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              infoTab === 'scope'
                ? 'bg-white text-[#083642] shadow-xs'
                : 'text-[#55676F] hover:text-[#083642]'
            }`}
          >
            Clinical Scope
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={infoTab === 'prep'}
            onClick={() => setInfoTab('prep')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              infoTab === 'prep'
                ? 'bg-white text-[#083642] shadow-xs'
                : 'text-[#55676F] hover:text-[#083642]'
            }`}
          >
            Prep Checklist ({checkedCount}/{checklist.length})
          </button>
        </div>

        {infoTab === 'scope' ? (
          <div className="mt-3.5 space-y-3 text-xs leading-relaxed text-[#455A64]">
            <p className="text-sm leading-relaxed text-[#24343B]">
              {service.clinicalDescription}
            </p>
            <div className="rounded-xl bg-[#F4FAFC] border border-[#DCE7E9] p-3.5">
              <p className="font-semibold text-[#083642]">Quick Preparation Summary</p>
              <p className="mt-1 text-xs leading-relaxed text-[#455A64]">
                {service.preparationNotes}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#65747B]">
              <span>Tick items below to confirm visit readiness:</span>
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setCheckedIds({})}
                  className="font-medium text-[#0D4A5A] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="space-y-2">
              {checklist.map((item) => {
                const checked = Boolean(checkedIds[item.id]);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleChecklist(item.id)}
                    className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left text-xs leading-relaxed transition-colors cursor-pointer ${
                      checked
                        ? 'border-[#0D4A5A] bg-[#F4FAFC] text-[#083642]'
                        : 'border-[#DCE7E9] bg-white text-[#24343B] hover:border-[#287887]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white'
                          : 'border-[#C9D9DC] bg-white'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className={checked ? 'line-through opacity-75' : ''}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live Appointment Slot Picker */}
      <div className="border-t border-[#E9F3F3] pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#083642]">
            <Calendar className="h-4 w-4 text-[#287887]" />
            <span>Check Live Slots &amp; Book</span>
          </div>
          <input
            type="date"
            aria-label="Choose appointment date"
            min={minDateIso}
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="h-8 rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] px-2 text-xs font-mono-tabular text-[#083642] focus:border-[#0D4A5A] focus:outline-none cursor-pointer"
          />
        </div>

        {/* 5-Day Quick Date Strip */}
        <div className="grid grid-cols-5 gap-1.5">
          {upcomingDates.map((d) => {
            const active = selectedDate === d.iso;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDate(d.iso)}
                className={`flex flex-col items-center rounded-lg border py-1.5 px-1 text-center transition-colors cursor-pointer ${
                  active
                    ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white'
                    : 'border-[#DCE7E9] bg-[#FAFDFE] text-[#24343B] hover:border-[#287887]'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold ${
                    active ? 'text-[#A5E4EB]' : 'text-[#65747B]'
                  }`}
                >
                  {d.shortLabel}
                </span>
                <span className="text-xs font-bold font-mono-tabular">{d.dayNum}</span>
              </button>
            );
          })}
        </div>

        {/* Live Slots Grid */}
        {slotsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-9 rounded-lg bg-[#E9F3F3]/60 animate-pulse" />
            ))}
          </div>
        ) : slotsError ? (
          <p className="rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-3 text-xs text-[#65747B]">
            {slotsError}
          </p>
        ) : slotsMeta?.isHoliday ? (
          <p className="rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-3 text-xs text-[#24343B]">
            Centre closed on {formatDateDisplay(selectedDate)}: {slotsMeta.holidayReason}
          </p>
        ) : openSlots.length === 0 ? (
          <p className="rounded-lg border border-[#DCE7E9] bg-[#F8FAFA] p-3 text-xs text-[#65747B]">
            No remaining open slots on {formatDateDisplay(selectedDate)}. Pick another day above or request a callback.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#65747B]">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#287887]" />
                <span>
                  <span className="font-mono-tabular font-semibold text-[#083642]">
                    {openSlots.length}
                  </span>{' '}
                  open {openSlots.length === 1 ? 'slot' : 'slots'} on{' '}
                  {formatDateDisplay(selectedDate)}
                </span>
              </span>
              {selectedSlot && (
                <span className="font-medium text-[#0D4A5A]">
                  Selected: {formatSlotTime(selectedSlot)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {openSlots.slice(0, 12).map((slot) => {
                const isPicked = selectedSlot === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    onClick={() =>
                      setSelectedSlot((prev) =>
                        prev === slot.startTime ? '' : slot.startTime
                      )
                    }
                    className={`rounded-lg border py-1.5 px-2 text-xs font-mono-tabular font-semibold transition-colors cursor-pointer ${
                      isPicked
                        ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white'
                        : 'border-[#C9D9DC] bg-white text-[#083642] hover:border-[#0D4A5A] hover:bg-[#F4FAFC]'
                    }`}
                  >
                    {formatSlotTime(slot.startTime)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary & Secondary Booking Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <Button
            type="button"
            onClick={handleBookClick}
            className="flex-1 h-11"
          >
            <span>
              {selectedSlot
                ? `Book ${formatSlotTime(selectedSlot)} Slot`
                : 'Schedule Appointment'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          {onRequestCallback && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onRequestCallback(service)}
              className="h-11 px-4"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Callback</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
