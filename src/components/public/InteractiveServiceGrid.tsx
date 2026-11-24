import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, FileCheck2, Stethoscope } from 'lucide-react';
import type { PublicServiceItem } from '../../hooks/usePublicClinic';
import { classifyServicePrep } from '../../lib/serviceHelpers';
import { Dialog } from '../ui/Dialog';
import { QuickAppointmentModal } from './QuickAppointmentModal';
import { ServiceInspectorPanel } from './ServiceInspectorPanel';

export function ServiceQuickInspectDialog({
  service,
  categoryName,
  categorySlug,
  onClose,
}: {
  service: PublicServiceItem | null;
  categoryName?: string;
  categorySlug?: string;
  onClose: () => void;
}) {
  const [callbackService, setCallbackService] = useState<string | null>(null);

  return (
    <>
      <Dialog
        open={Boolean(service)}
        onClose={onClose}
        title={service ? service.name : 'Investigation Details'}
        description={
          service
            ? `${categoryName ? `${categoryName} · ` : ''}${service.code} · ${service.durationMinutes} min`
            : undefined
        }
        className="max-w-xl"
      >
        {service && (
          <ServiceInspectorPanel
            service={service}
            categoryName={categoryName}
            categorySlug={categorySlug}
            showFullPageLink
            className="border-0 p-0 shadow-none"
            onRequestCallback={(svc) => {
              onClose();
              setCallbackService(svc.name);
            }}
          />
        )}
      </Dialog>

      <QuickAppointmentModal
        open={Boolean(callbackService)}
        onClose={() => setCallbackService(null)}
        initialServiceName={callbackService || ''}
      />
    </>
  );
}

export function InteractiveServiceCard({
  service,
  categoryName,
  isSelected = false,
  onInspect,
  compact = false,
}: {
  service: PublicServiceItem;
  categoryName?: string;
  isSelected?: boolean;
  onInspect: (service: PublicServiceItem) => void;
  compact?: boolean;
}) {
  const prep = classifyServicePrep(service);

  return (
    <div
      onClick={() => onInspect(service)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onInspect(service);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={`edfic-card-interactive group flex flex-col justify-between rounded-xl border p-5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D4A5A] ${
        isSelected
          ? 'border-[#0D4A5A] bg-[#F4FAFC] ring-2 ring-[#0D4A5A]/15'
          : 'border-[#DCE7E9] bg-white hover:border-[#287887] edfic-card-soft'
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#65747B]">
          <p className="min-w-0">
            <span className="font-mono-tabular">{service.code}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono-tabular">{service.durationMinutes} min</span>
            {categoryName && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-[#287887] font-medium">{categoryName}</span>
              </>
            )}
          </p>
          {isSelected && (
            <span className="text-[11px] font-semibold text-[#0D4A5A] shrink-0">
              Selected
            </span>
          )}
        </div>

        <h3 className="mt-2 font-display text-base font-semibold text-[#083642] group-hover:text-[#0D4A5A] transition-colors">
          {service.name}
        </h3>

        <p
          className={`mt-2 text-xs leading-relaxed text-[#65747B] ${
            compact ? 'line-clamp-2' : ''
          }`}
        >
          {service.summary}
        </p>

        {/* Unboxed Clinical Prep & Session Signals */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#455A64]">
          <span className="inline-flex items-center gap-1">
            <FileCheck2 className="h-3.5 w-3.5 text-[#287887] shrink-0" />
            <span>{prep.shortHint}</span>
          </span>
          {service.requiresDoctorMorning && (
            <span className="inline-flex items-center gap-1 text-[#0D4A5A] font-medium">
              <Stethoscope className="h-3.5 w-3.5 shrink-0" />
              <span>Morning Specialist</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#E9F3F3] flex items-center justify-between gap-3 text-xs font-medium">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect(service);
          }}
          className="inline-flex items-center gap-1 text-[#24343B] hover:text-[#0D4A5A] cursor-pointer whitespace-nowrap"
        >
          <Calendar className="h-3.5 w-3.5 text-[#287887]" />
          <span>Prep &amp; Live Slots</span>
        </button>

        <Link
          to={`/book?service=${service.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-semibold text-[#0D4A5A] hover:underline whitespace-nowrap shrink-0"
        >
          <span>Book Slot</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function InteractiveServiceGrid({
  services,
  categoryName,
  categorySlug,
  columnsClass = 'grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
}: {
  services: Array<PublicServiceItem & { categoryName?: string; categorySlug?: string }>;
  categoryName?: string;
  categorySlug?: string;
  columnsClass?: string;
}) {
  const [inspectedService, setInspectedService] = useState<
    (PublicServiceItem & { categoryName?: string; categorySlug?: string }) | null
  >(null);

  return (
    <>
      <div className={`grid ${columnsClass}`}>
        {services.map((svc) => (
          <InteractiveServiceCard
            key={svc.id}
            service={svc}
            categoryName={svc.categoryName ?? categoryName}
            isSelected={inspectedService?.id === svc.id}
            onInspect={(item) =>
              setInspectedService({
                ...item,
                categoryName: svc.categoryName ?? categoryName,
                categorySlug: svc.categorySlug ?? categorySlug,
              })
            }
          />
        ))}
      </div>

      <ServiceQuickInspectDialog
        service={inspectedService}
        categoryName={inspectedService?.categoryName ?? categoryName}
        categorySlug={inspectedService?.categorySlug ?? categorySlug}
        onClose={() => setInspectedService(null)}
      />
    </>
  );
}
