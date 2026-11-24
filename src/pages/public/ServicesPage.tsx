import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { Input } from '../../components/ui/Input';
import {
  InteractiveServiceCard,
  ServiceQuickInspectDialog,
} from '../../components/public/InteractiveServiceGrid';
import { ServiceInspectorPanel } from '../../components/public/ServiceInspectorPanel';
import { QuickAppointmentModal } from '../../components/public/QuickAppointmentModal';
import {
  usePublicServices,
  type PublicServiceItem,
} from '../../hooks/usePublicClinic';
import { classifyServicePrep, type PrepCategoryKey } from '../../lib/serviceHelpers';

type ProtocolFilter = 'all' | 'morning' | PrepCategoryKey;

const PROTOCOL_FILTERS: Array<{ key: ProtocolFilter; label: string }> = [
  { key: 'all', label: 'All Protocols' },
  { key: 'morning', label: 'Morning Specialist' },
  { key: 'fasting', label: 'Fasting Required' },
  { key: 'full_bladder', label: 'Full Bladder' },
  { key: 'empty_bladder', label: 'Empty Bladder' },
  { key: 'standard', label: 'No Fasting Needed' },
];

export function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCat = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = usePublicServices();
  const categories = data?.categories ?? [];

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [mobileInspectedService, setMobileInspectedService] = useState<{
    service: PublicServiceItem;
    categoryName: string;
    categorySlug: string;
  } | null>(null);
  const [callbackServiceName, setCallbackServiceName] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return categories
      .filter((c) => activeCategory === 'all' || c.slug === activeCategory)
      .map((c) => ({
        ...c,
        services: c.services.filter((s) => {
          const matchesQuery =
            !q ||
            s.name.toLowerCase().includes(q) ||
            s.summary.toLowerCase().includes(q) ||
            s.clinicalDescription.toLowerCase().includes(q) ||
            s.preparationNotes.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q);
          if (!matchesQuery) return false;

          if (protocolFilter === 'all') return true;
          if (protocolFilter === 'morning') return s.requiresDoctorMorning;
          return classifyServicePrep(s).key === protocolFilter;
        }),
      }))
      .filter((c) => c.services.length > 0);
  }, [categories, activeCategory, searchTerm, protocolFilter]);

  const flatFilteredServices = useMemo(
    () =>
      filteredCategories.flatMap((cat) =>
        cat.services.map((svc) => ({
          service: svc,
          categoryName: cat.name,
          categorySlug: cat.slug,
        }))
      ),
    [filteredCategories]
  );

  // Keep desktop inspector bound to a valid visible service
  useEffect(() => {
    if (flatFilteredServices.length === 0) return;
    const stillVisible = flatFilteredServices.some(
      (item) => item.service.id === selectedServiceId
    );
    if (!stillVisible) {
      setSelectedServiceId(flatFilteredServices[0].service.id);
    }
  }, [flatFilteredServices, selectedServiceId]);

  const activeEntry =
    flatFilteredServices.find((item) => item.service.id === selectedServiceId) ??
    flatFilteredServices[0] ??
    null;

  const totalServicesCount = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.services.length, 0),
    [categories]
  );

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug);
    if (slug === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', slug);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleInspectService = (
    svc: PublicServiceItem,
    categoryName: string,
    categorySlug: string
  ) => {
    setSelectedServiceId(svc.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileInspectedService({ service: svc, categoryName, categorySlug });
    }
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setProtocolFilter('all');
    handleCategoryChange('all');
  };

  return (
    <PublicLayout>
      <SeoHead
        title="Diagnostic & Fetal Imaging Service Catalogue | EDFIC"
        description="Browse approved fetal medicine, general ultrasound, Color Doppler, breast, musculoskeletal, and pelvic diagnostic investigations at EDFIC, Sushant Golf City, Lucknow."
        canonicalPath="/services"
        structuredData={buildClinicJsonLd()}
      />

      <section className="border-b border-[#DCE7E9] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#287887]">
                EDFIC Service Explorer · A Unit of EWA DERMA
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642] text-balance">
                Diagnostic &amp; Fetal Imaging Services
              </h1>
              <p className="mt-2.5 max-w-2xl text-sm sm:text-base text-[#65747B]">
                Select any investigation to review its clinical scope, check off preparation readiness, preview live appointment slots, and book directly.
              </p>
            </div>
            <p className="text-xs font-mono-tabular text-[#65747B] shrink-0">
              Showing {flatFilteredServices.length} of {totalServicesCount} investigations
            </p>
          </div>

          {/* Search & Department Filter Controls */}
          <div className="mt-7 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search scan, symptom, or prep (e.g., NT Scan, fasting)..."
                  className="pl-9 pr-9"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#65747B] hover:text-[#083642] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 rounded-lg bg-[#E9F3F3] p-1">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeCategory === 'all'
                      ? 'bg-white text-[#0D4A5A] shadow-sm'
                      : 'text-[#65747B] hover:text-[#24343B]'
                  }`}
                >
                  All Categories ({totalServicesCount})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.slug)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      activeCategory === cat.slug
                        ? 'bg-white text-[#0D4A5A] shadow-sm'
                        : 'text-[#65747B] hover:text-[#24343B]'
                    }`}
                  >
                    {cat.name} ({cat.services.length})
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Preparation & Session Protocol Filter */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#65747B] mr-1">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#287887]" />
                <span>Filter by preparation:</span>
              </span>
              {PROTOCOL_FILTERS.map((pf) => {
                const active = protocolFilter === pf.key;
                return (
                  <button
                    key={pf.key}
                    type="button"
                    onClick={() => setProtocolFilter(pf.key)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'border-[#0D4A5A] bg-[#0D4A5A] text-white'
                        : 'border-[#DCE7E9] bg-[#F8FAFA] text-[#455A64] hover:border-[#287887] hover:text-[#083642]'
                    }`}
                  >
                    {pf.label}
                  </button>
                );
              })}

              {(activeCategory !== 'all' || protocolFilter !== 'all' || searchTerm.trim()) && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="ml-auto text-xs font-semibold text-[#0D4A5A] hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-xl border border-[#DCE7E9] bg-white animate-pulse"
                />
              ))}
            </div>
            <div className="hidden lg:block lg:col-span-5 h-96 rounded-2xl border border-[#DCE7E9] bg-white animate-pulse" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-xl border border-[#DCE7E9] bg-white p-10 text-center">
            <p className="text-sm font-medium text-[#24343B]">
              No matching diagnostic investigations found for your current filters.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-3 text-xs font-semibold text-[#0D4A5A] underline cursor-pointer"
            >
              Reset catalogue filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            {/* Left Interactive Catalogue List */}
            <div className="lg:col-span-7 space-y-10">
              {filteredCategories.map((cat) => (
                <div key={cat.id}>
                  <div className="border-b border-[#DCE7E9] pb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#083642]">
                        {cat.name}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-[#65747B]">
                        {cat.description}
                      </p>
                    </div>
                    <span className="text-xs font-mono-tabular text-[#287887] shrink-0">
                      {cat.services.length}{' '}
                      {cat.services.length === 1 ? 'study' : 'studies'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {cat.services.map((svc) => (
                      <InteractiveServiceCard
                        key={svc.id}
                        service={svc}
                        isSelected={activeEntry?.service.id === svc.id}
                        onInspect={(item) =>
                          handleInspectService(item, cat.name, cat.slug)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Sticky Live Service Inspector & Instant Slot Picker (Desktop) */}
            <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-24">
              {activeEntry && (
                <ServiceInspectorPanel
                  service={activeEntry.service}
                  categoryName={activeEntry.categoryName}
                  categorySlug={activeEntry.categorySlug}
                  onRequestCallback={(svc) => setCallbackServiceName(svc.name)}
                />
              )}
            </aside>
          </div>
        )}
      </section>

      {/* Mobile / Tablet Quick-Inspect Modal */}
      <ServiceQuickInspectDialog
        service={mobileInspectedService?.service ?? null}
        categoryName={mobileInspectedService?.categoryName}
        categorySlug={mobileInspectedService?.categorySlug}
        onClose={() => setMobileInspectedService(null)}
      />

      {/* Desktop Callback Modal */}
      <QuickAppointmentModal
        open={Boolean(callbackServiceName)}
        onClose={() => setCallbackServiceName(null)}
        initialServiceName={callbackServiceName || ''}
      />
    </PublicLayout>
  );
}
