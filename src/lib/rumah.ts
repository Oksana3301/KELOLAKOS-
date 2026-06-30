// Top Hills · Penghuni layer (/rumah) — tipe & helper bersama (tier, tenure).
// Dipakai oleh halaman /rumah, /rumah/profil, dan API routes.

export type LoyaltyTier = 'TETANGGA' | 'SAHABAT' | 'KELUARGA' | 'RUMAH';

export interface RumahProfile {
  waNumber: string;
  tenant_id: string;
  name: string;
  tier: LoyaltyTier;
  // Read-only info
  check_in: string;            // ISO date
  tenure_months: number;
  kamar?: string;
  gedung?: string;
  status_bayar?: string;
  referral_code?: string;
  referred_by?: string;
  // Editable optional
  tanggal_lahir?: string;
  email?: string;
  fakultas?: string;
  kampung_asal?: string;
  profile_complete?: boolean;
}

// Urutan tier + ambang (bulan tinggal). Konsisten dengan backend (.gs).
export const TIERS: { key: LoyaltyTier; label: string; min: number }[] = [
  { key: 'TETANGGA', label: '🤝 Tetangga', min: 0 },
  { key: 'SAHABAT', label: '🌿 Sahabat', min: 3 },
  { key: 'KELUARGA', label: '💛 Keluarga', min: 12 },
  { key: 'RUMAH', label: '🏡 Rumah', min: 24 },
];

export function tierMeta(tier: LoyaltyTier) {
  return TIERS.find((t) => t.key === tier) || TIERS[0];
}

/** Tier dari lama tinggal (bulan). */
export function tierOf(months: number): LoyaltyTier {
  let cur: LoyaltyTier = 'TETANGGA';
  for (const t of TIERS) if (months >= t.min) cur = t.key;
  return cur;
}

/** Progress menuju tier berikutnya (0..1) + sisa bulan + label tier berikut. */
export function tierProgress(months: number): { pct: number; monthsToNext: number; next: string | null } {
  const idx = TIERS.findIndex((t) => t.key === tierOf(months));
  const next = TIERS[idx + 1];
  if (!next) return { pct: 1, monthsToNext: 0, next: null };
  const pct = Math.max(0, Math.min(1, months / next.min));
  return { pct, monthsToNext: Math.max(0, next.min - months), next: next.label };
}

/** Lama tinggal sejak check-in → "8 bulan, 12 hari" (perkiraan). */
export function tenureText(checkInISO?: string): string {
  if (!checkInISO) return '—';
  const start = new Date(checkInISO);
  if (isNaN(start.getTime())) return '—';
  const now = new Date();
  if (now < start) return 'baru mulai';
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  // Koreksi bila tanggal hari ini belum mencapai tanggal check-in di bulan ini.
  const anchor = new Date(start);
  anchor.setMonth(start.getMonth() + months);
  if (anchor > now) { months -= 1; anchor.setMonth(anchor.getMonth() - 1); }
  const days = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / 86400000));
  if (months <= 0 && days <= 0) return 'baru hari ini';
  const mTxt = months > 0 ? `${months} bulan` : '';
  const dTxt = days > 0 ? `${days} hari` : '';
  return [mTxt, dTxt].filter(Boolean).join(', ') || '0 hari';
}

/** Lama tinggal dalam bulan (untuk hitung tier di frontend bila perlu). */
export function tenureMonths(checkInISO?: string): number {
  if (!checkInISO) return 0;
  const start = new Date(checkInISO);
  if (isNaN(start.getTime())) return 0;
  const now = new Date();
  let m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const anchor = new Date(start); anchor.setMonth(start.getMonth() + m);
  if (anchor > now) m -= 1;
  return Math.max(0, m);
}

/** Berapa field optional yang sudah terisi (untuk profile_complete & banner). */
export function filledOptionalCount(p: Partial<RumahProfile>): number {
  return [p.tanggal_lahir, p.email, p.fakultas, p.kampung_asal].filter((v) => !!String(v || '').trim()).length;
}

export const RUMAH_FACULTIES = [
  '', 'Teknik', 'Kedokteran', 'Ekonomi & Bisnis', 'Hukum', 'Pertanian',
  'MIPA', 'Ilmu Sosial & Politik', 'Ilmu Budaya', 'Keperawatan',
  'Kesehatan Masyarakat', 'Teknologi Informasi', 'Peternakan', 'Farmasi', 'Lainnya',
];
