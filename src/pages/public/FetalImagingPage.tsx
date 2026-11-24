import { useQuery } from '@tanstack/react-query';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { InteractiveServiceGrid } from '../../components/public/InteractiveServiceGrid';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { usePublicServices } from '../../hooks/usePublicClinic';
import { apiFetch } from '../../lib/api';

interface CmsItem {
  id: string;
  title: string;
  contentMarkdown: string;
}

export function FetalImagingPage() {
  const { data: cmsData } = useQuery({
    queryKey: ['public-cms', 'fetal-imaging'],
    queryFn: () => apiFetch<{ items: CmsItem[] }>('/api/v1/public/cms/fetal-imaging'),
  });
  const { data: svcData } = usePublicServices();

  const fetalCategory = svcData?.categories.find(
    (c) => c.slug === 'obstetric-fetal-imaging'
  );
  const cmsItem = cmsData?.items?.[0];

  return (
    <PublicLayout>
      <SeoHead
        title="Fetal Imaging & Obstetric Ultrasound | EDFIC Lucknow"
        description="Specialist NT Scan, Anomaly Scan (Level II), Growth Scan, Fetal Echocardiography, BPP, and Obstetric Doppler evaluations led by Dr. Varun Agrawal at EDFIC Lucknow."
        canonicalPath="/fetal-imaging"
        structuredData={buildClinicJsonLd()}
      />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div>
          <p className="text-xs font-semibold text-[#287887]">
            Specialist Fetal Medicine · Dr. Varun Agrawal (DNB Radiology)
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Fetal Imaging &amp; Obstetric Ultrasound
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-[#65747B]">
            Trimester-specific fetal screening, anomaly evaluation, fetal echocardiography, and obstetric Doppler examinations performed during daily morning specialist sessions.
          </p>
        </div>

        {cmsItem && (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-[#083642]">
              {cmsItem.title}
            </h2>
            <div className="mt-4 text-sm leading-relaxed text-[#24343B] whitespace-pre-line">
              {cmsItem.contentMarkdown}
            </div>
          </div>
        )}

        <div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-[#DCE7E9] pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#083642]">
                Obstetric &amp; Fetal Investigations
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#65747B]">
                Click any scan to review its clinical scope, check preparation steps, and preview live morning specialist slots.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <InteractiveServiceGrid
              services={fetalCategory?.services ?? []}
              categoryName={fetalCategory?.name || 'Obstetric & Fetal Imaging'}
              categorySlug={fetalCategory?.slug || 'obstetric-fetal-imaging'}
              columnsClass="grid-cols-1 gap-4 md:grid-cols-2"
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#DCE7E9] bg-[#E9F3F3] p-6 text-xs leading-relaxed text-[#083642]">
          <p className="font-semibold">PCPNDT Act Statutory Notice</p>
          <p className="mt-1">
            EWA Diagnostic and Fetal Imaging Centre strictly complies with the Pre-Conception and Pre-Natal Diagnostic Techniques (Prohibition of Sex Selection) Act, 1994. Sex determination or gender prediction of the fetus is strictly prohibited by law and is never performed or disclosed at this centre.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
