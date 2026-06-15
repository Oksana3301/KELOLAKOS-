// KelolaKos · view-layer status mapping + formatting.
// Collapses the backend's many codes into the 4 plain payment statuses
// and 3 room statuses for display. Raw codes stay in the data layer.

import type { BookingItem, RoomStatus } from '@/lib/api';

export type PayStatus = 'Lunas' | 'DP' | 'Belum Bayar' | 'Batal';
export type RoomDisplayStatus = 'Terisi' | 'Tersedia' | 'Perlu Perhatian';

export interface BadgeStyle {
  /** Tailwind bg class */
  bg: string;
  /** Tailwind text class */
  fg: string;
  /** dot color (Tailwind bg class) */
  dot: string;
}

export const PAY_BADGE: Record<PayStatus, BadgeStyle> = {
  Lunas: { bg: 'bg-kk-green', fg: 'text-white', dot: 'bg-white' },
  'Belum Bayar': { bg: 'bg-kk-orange', fg: 'text-white', dot: 'bg-white' },
  DP: { bg: 'bg-kk-yellow', fg: 'text-kk-navy', dot: 'bg-kk-navy' },
  Batal: { bg: 'bg-kk-mauve', fg: 'text-kk-navy', dot: 'bg-kk-ink' },
};

export const ROOM_BADGE: Record<RoomDisplayStatus, BadgeStyle> = {
  Terisi: { bg: 'bg-kk-green', fg: 'text-white', dot: 'bg-white' },
  Tersedia: { bg: 'bg-kk-mint', fg: 'text-kk-navy', dot: 'bg-kk-navy' },
  'Perlu Perhatian': { bg: 'bg-kk-orange', fg: 'text-white', dot: 'bg-white' },
};

/** Map a booking's backend status to one of the 4 plain payment statuses. */
export function mapPayStatus(b: Pick<BookingItem, 'Status_Booking' | 'Status_Bayar' | 'Sisa_Bayar'>): PayStatus {
  const booking = (b.Status_Booking || '').toUpperCase();
  if (booking.includes('CANCEL') || booking.includes('BATAL') || booking.includes('REFUND')) return 'Batal';

  const bayar = (b.Status_Bayar || '').toUpperCase();
  if (bayar.includes('LUNAS')) return 'Lunas';
  if (bayar.includes('DP') || bayar.includes('PARSIAL') || bayar.includes('SEBAGIAN')) return 'DP';
  if ((b.Sisa_Bayar ?? 0) <= 0) return 'Lunas';
  return 'Belum Bayar';
}

/** Map a room's backend Status_Code to one of the 3 plain room statuses. */
export function mapRoomStatus(r: Pick<RoomStatus, 'Status_Code'>): RoomDisplayStatus {
  const code = (r.Status_Code || '').toUpperCase();
  if (code === 'READY' || code === 'TERSEDIA' || code === 'KOSONG') return 'Tersedia';
  if (code === 'BELUM_BAYAR' || code === 'LEWAT_CHECKOUT' || code.includes('MASALAH')) return 'Perlu Perhatian';
  return 'Terisi';
}

const rupiahFmt = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** "Rp 1.250.000" */
export function rupiah(amount: number | null | undefined): string {
  return rupiahFmt.format(Math.round(amount || 0));
}

/** Indonesian long date: "5 Jun 2026" */
export function tglPanjang(s: string | Date | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Indonesian short date: "5 Jun" */
export function tglPendek(s: string | Date | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
