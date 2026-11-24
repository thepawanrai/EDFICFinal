import type { PublicServiceItem } from '../hooks/usePublicClinic';

export type PrepCategoryKey =
  | 'fasting'
  | 'full_bladder'
  | 'empty_bladder'
  | 'standard';

export interface PrepClassification {
  key: PrepCategoryKey;
  label: string;
  shortHint: string;
}

export function classifyServicePrep(svc: Pick<PublicServiceItem, 'preparationNotes' | 'name' | 'slug'>): PrepClassification {
  const prep = `${svc.preparationNotes} ${svc.name}`.toLowerCase();

  if (prep.includes('fasting') || prep.includes('empty stomach') || prep.includes('6 hours') || prep.includes('6–8 hours')) {
    return {
      key: 'fasting',
      label: 'Fasting Required',
      shortHint: '6 hrs fasting prior',
    };
  }

  if (
    prep.includes('empty bladder') ||
    prep.includes('transvaginal') ||
    svc.slug.includes('tvs') ||
    svc.slug.includes('follicular')
  ) {
    return {
      key: 'empty_bladder',
      label: 'Empty Bladder',
      shortHint: 'Empty bladder before scan',
    };
  }

  if (
    prep.includes('full bladder') ||
    prep.includes('glasses of water') ||
    prep.includes('hold urine') ||
    prep.includes('moderately full')
  ) {
    return {
      key: 'full_bladder',
      label: 'Full Bladder',
      shortHint: 'Drink water 45–60 min prior',
    };
  }

  return {
    key: 'standard',
    label: 'No Fasting Needed',
    shortHint: 'Standard walk-in prep',
  };
}

export interface PrepChecklistItem {
  id: string;
  text: string;
}

export function buildPreparationChecklist(
  svc: PublicServiceItem,
  categorySlug?: string
): PrepChecklistItem[] {
  const items: PrepChecklistItem[] = [];

  if (svc.preparationNotes?.trim()) {
    items.push({
      id: 'primary-prep',
      text: svc.preparationNotes.trim(),
    });
  }

  const isObstetric =
    categorySlug === 'obstetric-fetal-imaging' ||
    svc.code.startsWith('OBS') ||
    svc.name.toLowerCase().includes('fetal') ||
    svc.name.toLowerCase().includes('pregnancy') ||
    svc.name.toLowerCase().includes('nt scan') ||
    svc.name.toLowerCase().includes('anomaly') ||
    svc.name.toLowerCase().includes('growth scan') ||
    svc.name.toLowerCase().includes('bpp');

  if (isObstetric) {
    items.push({
      id: 'pcpndt-id',
      text: 'Carry valid Government Photo ID (Aadhaar/Passport) and signed obstetrician prescription (mandatory for PCPNDT Form F).',
    });
  } else {
    items.push({
      id: 'requisition',
      text: 'Bring your referring clinician’s scan prescription and any prior ultrasound or lab reports.',
    });
  }

  items.push({
    id: 'arrival-window',
    text: svc.requiresDoctorMorning
      ? 'Arrive 15 minutes before your morning specialist slot for Form F / front-desk registration.'
      : 'Arrive 10–15 minutes prior to your appointment slot for registration.',
  });

  return items;
}

export function formatSlotTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function toLocalDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getUpcomingDates(totalDays = 5): Array<{
  iso: string;
  shortLabel: string;
  dayNum: string;
  month: string;
  isSunday: boolean;
}> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: totalDays }, (_, idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + idx);
    return {
      iso: toLocalDateIso(d),
      shortLabel:
        idx === 0
          ? 'Today'
          : idx === 1
            ? 'Tmrw'
            : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: String(d.getDate()),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      isSunday: d.getDay() === 0,
    };
  });
}
