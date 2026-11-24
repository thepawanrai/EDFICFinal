import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead } from '../../components/seo/SeoHead';
import { ServiceInspectorPanel } from '../../components/public/ServiceInspectorPanel';
import { QuickAppointmentModal } from '../../components/public/QuickAppointmentModal';
import { apiFetch } from '../../lib/api';
import { FALLBACK_PUBLIC_CATEGORIES } from '../../lib/publicCatalogFallback';

interface ServiceDetail {
  id: string;
  slug: string;
  code: string;
  name: string;
  categoryId?: string;
  summary: string;
  clinicalDescription: string;
  preparationNotes: string;
  durationMinutes: number;
  requiresDoctorMorning: boolean;
  category: {
    id: string;
    slug: string;
    name: string;
  };
}

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [callbackServiceName, setCallbackServiceName] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-service', slug],
    queryFn: async () => {
      try {
        return await apiFetch<{ service: ServiceDetail }>(`/api/v1/public/services/${slug}`);
      } catch (err) {
        for (const cat of FALLBACK_PUBLIC_CATEGORIES) {
          const match = cat.services.find((s) => s.slug === slug);
          if (match) {
            return {
              service: {
                ...match,
                category: { id: cat.id, slug: cat.slug, name: cat.name },
              },
            };
          }
        }
        throw err;
      }
    },
    enabled: Boolean(slug),
    retry: 1,
  });

  const svc = data?.service;

  return (
    <PublicLayout>
      <SeoHead
        title={
          svc
            ? `${svc.name} | EDFIC Lucknow`
            : 'Diagnostic Service Details | EDFIC Lucknow'
        }
        description={
          svc
            ? `${svc.summary} Preparation guidelines and appointment scheduling at EDFIC, Sushant Golf City, Lucknow.`
            : 'View preparation instructions and clinical details for diagnostic ultrasound investigations at EDFIC Lucknow.'
        }
        canonicalPath={slug ? `/services/${slug}` : '/services'}
        structuredData={
          svc
            ? {
                '@context': 'https://schema.org',
                '@type': 'MedicalProcedure',
                name: svc.name,
                code: {
                  '@type': 'MedicalCode',
                  codeValue: svc.code,
                },
                description: svc.clinicalDescription,
                preparation: svc.preparationNotes,
                howPerformed: svc.summary,
              }
            : undefined
        }
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/services"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D4A5A] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Diagnostic Services</span>
          </Link>
          {svc && (
            <Link
              to={`/services?category=${svc.category.slug}`}
              className="text-xs font-medium text-[#287887] hover:underline"
            >
              More in {svc.category.name} →
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="mt-6 h-80 rounded-2xl border border-[#DCE7E9] bg-white animate-pulse" />
        ) : isError || !svc ? (
          <div className="mt-6 rounded-xl border border-[#DCE7E9] bg-white p-8">
            <h1 className="font-display text-xl font-bold text-[#083642]">
              Service Information Unavailable
            </h1>
            <p className="mt-2 text-sm text-[#65747B]">
              The requested diagnostic service could not be located in the public catalogue.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-7 lg:grid-cols-12 items-start">
            {/* Left Clinical Information & Preparation Overview */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-2xl border border-[#DCE7E9] bg-white p-6 sm:p-8">
                <p className="text-xs text-[#65747B]">
                  <span className="font-medium text-[#287887]">{svc.category.name}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-tabular">{svc.code}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-tabular">{svc.durationMinutes} minutes</span>
                </p>
                <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#083642] text-balance">
                  {svc.name}
                </h1>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#24343B]">
                  {svc.summary}
                </p>

                <div className="mt-6 border-t border-[#DCE7E9] pt-5 space-y-4">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-[#083642]">
                      Clinical Scope
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#65747B]">
                      {svc.clinicalDescription}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm pt-2">
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-[#0D4A5A] mt-1 shrink-0" />
                      <div>
                        <p className="font-medium text-[#24343B]">Slot Duration</p>
                        <p className="text-xs text-[#65747B] font-mono-tabular">
                          {svc.durationMinutes} min appointment
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Calendar className="h-4 w-4 text-[#0D4A5A] mt-1 shrink-0" />
                      <div>
                        <p className="font-medium text-[#24343B]">Session Availability</p>
                        <p className="text-xs text-[#65747B]">
                          {svc.requiresDoctorMorning
                            ? 'Morning specialist session (Dr. Varun Agrawal)'
                            : 'Mon–Sat 9 AM–8 PM · Sun by appt'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DCE7E9] bg-[#E9F3F3]/60 p-5 flex items-start gap-3 text-xs leading-relaxed text-[#083642]">
                <ShieldCheck className="h-5 w-5 text-[#0D4A5A] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">What to Bring &amp; Statutory Notice</p>
                  <p className="mt-1 text-[#354B54]">
                    Bring your referring clinician prescription, prior scan reports, and valid government photo ID (mandatory for obstetric studies under PCPNDT Act rules).
                  </p>
                </div>
              </div>
            </div>

            {/* Right Interactive Checklist & Live Slot Booking Panel */}
            <div className="lg:col-span-6">
              <ServiceInspectorPanel
                service={{
                  ...svc,
                  categoryId: svc.categoryId ?? svc.category.id,
                }}
                categoryName={svc.category.name}
                categorySlug={svc.category.slug}
                showFullPageLink={false}
                onRequestCallback={(item) => setCallbackServiceName(item.name)}
              />
            </div>
          </div>
        )}
      </div>

      <QuickAppointmentModal
        open={Boolean(callbackServiceName)}
        onClose={() => setCallbackServiceName(null)}
        initialServiceName={callbackServiceName || ''}
      />
    </PublicLayout>
  );
}
