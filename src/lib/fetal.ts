export const RISK_CATEGORY_OPTIONS = [
  { value: 'ROUTINE', label: 'Routine Antenatal' },
  { value: 'HIGH_RISK', label: 'High-Risk Pregnancy' },
  { value: 'TWINS_MULTIPLE', label: 'Multiple / Twins Gestation' },
  { value: 'BAD_OBSTETRIC_HISTORY', label: 'Bad Obstetric History (BOH)' },
  { value: 'DIABETES_HYPERTENSION', label: 'GDM / Hypertension Watch' },
] as const;

export const BLOOD_GROUP_OPTIONS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

export interface GestationalMetrics {
  gaWeeks: number;
  gaDays: number;
  gaLabel: string;
  trimester: string;
  progressPct: number;
  computedEdd: string | null;
  daysRemaining: number | null;
  recommendedScanWindow: string;
}

export function computeEddFromLmpDate(lmpDate?: string | null): string | null {
  if (!lmpDate || !/^\d{4}-\d{2}-\d{2}$/.test(lmpDate)) return null;
  const dt = new Date(`${lmpDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + 280);
  return dt.toISOString().slice(0, 10);
}

export function calculateGestationalMetrics(
  lmpDate?: string | null,
  eddDate?: string | null
): GestationalMetrics | null {
  const hasLmp = Boolean(lmpDate && /^\d{4}-\d{2}-\d{2}$/.test(lmpDate));
  const hasEdd = Boolean(eddDate && /^\d{4}-\d{2}-\d{2}$/.test(eddDate));
  if (!hasLmp && !hasEdd) return null;

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  let lmpMs: number;
  let eddStr: string | null = hasEdd ? eddDate! : null;

  if (hasLmp) {
    lmpMs = new Date(`${lmpDate}T00:00:00Z`).getTime();
    if (!eddStr) {
      eddStr = computeEddFromLmpDate(lmpDate);
    }
  } else {
    const eddMs = new Date(`${eddDate}T00:00:00Z`).getTime();
    lmpMs = eddMs - 280 * 86400000;
  }

  const totalDays = Math.max(0, Math.floor((todayUtc - lmpMs) / 86400000));
  const gaWeeks = Math.floor(totalDays / 7);
  const gaDays = totalDays % 7;

  let trimester = 'Pre-conceptional / Early';
  if (gaWeeks < 14) trimester = '1st Trimester (0–13w)';
  else if (gaWeeks < 28) trimester = '2nd Trimester (14–27w)';
  else trimester = '3rd Trimester (28–40w+)';

  let recommendedScanWindow = 'Consult Sonologist for next scan schedule';
  if (gaWeeks < 10) {
    recommendedScanWindow = 'Early Viability & Dating Scan (6–9w) · Next: NT/NB at 11–13w 6d';
  } else if (gaWeeks <= 14) {
    recommendedScanWindow = '11–13w 6d NT / NB & First Trimester Screening Window';
  } else if (gaWeeks < 18) {
    recommendedScanWindow = 'Upcoming: Level-II TIFFA Anomaly Scan (18–22w)';
  } else if (gaWeeks <= 22) {
    recommendedScanWindow = 'Active Window: Level-II TIFFA Anomaly Scan (18–22w)';
  } else if (gaWeeks <= 26) {
    recommendedScanWindow = 'Fetal Echocardiography Window (22–26w)';
  } else if (gaWeeks <= 37) {
    recommendedScanWindow = 'Growth, AFI & Colour Doppler Assessment (28–36w)';
  } else {
    recommendedScanWindow = 'Term Biophysical Profile & Colour Doppler (37w+)';
  }

  const eddMs = eddStr ? new Date(`${eddStr}T00:00:00Z`).getTime() : lmpMs + 280 * 86400000;
  const daysRemaining = Math.ceil((eddMs - todayUtc) / 86400000);
  const progressPct = Math.min(100, Math.max(0, Math.round((totalDays / 280) * 100)));

  return {
    gaWeeks,
    gaDays,
    gaLabel: `${gaWeeks}w ${gaDays}d`,
    trimester,
    progressPct,
    computedEdd: eddStr,
    daysRemaining,
    recommendedScanWindow,
  };
}

export function formatObsFormula(
  gravida?: number | null,
  para?: number | null,
  living?: number | null,
  abortions?: number | null
): string | null {
  if (
    gravida === null &&
    para === null &&
    living === null &&
    abortions === null
  ) {
    return null;
  }
  if (
    gravida === undefined &&
    para === undefined &&
    living === undefined &&
    abortions === undefined
  ) {
    return null;
  }
  return `G${gravida ?? '-'} P${para ?? '-'} L${living ?? '-'} A${abortions ?? '-'}`;
}

export function getRiskLabel(risk?: string | null): string {
  const match = RISK_CATEGORY_OPTIONS.find((o) => o.value === risk);
  return match ? match.label : 'Routine Antenatal';
}
