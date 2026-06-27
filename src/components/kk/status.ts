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
export function mapPayStatus(
  b: Pick<
    BookingItem,
    'Status_Booking' | 'Status_Bayar' | 'Sisa_Bayar' | 'Net_Diterima' | 'Total_Bayar' | 'Harga_Total_Net'
  >,
): PayStatus {
  const booking = (b.Status_Booking || '').toUpperCase();
  if (booking.includes('CANCEL') || booking.includes('BATAL')) return 'Batal';

  // The money actually received (after any refund) and what is still owed.
  const total = Number(b.Harga_Total_Net ?? 0);
  const dibayar = Number(b.Net_Diterima ?? b.Total_Bayar ?? 0);
  const sisaRaw = b.Sisa_Bayar;
  const sisa =
    sisaRaw === undefined || sisaRaw === null ? Math.max(total - dibayar, 0) : Number(sisaRaw);

  // Trust an explicit paid-status string, but never call something "Lunas" when
  // nothing was actually received — a fresh DP/unpaid booking often arrives with
  // Sisa_Bayar still 0 before the backend recomputes, which used to flip it to
  // Lunas by mistake.
  const bayar = (b.Status_Bayar || '').toUpperCase();
  if (bayar.includes('BELUM')) return dibayar > 0 ? 'DP' : 'Belum Bayar';
  if (bayar.includes('LUNAS')) return dibayar > 0 ? 'Lunas' : 'Belum Bayar';
  if (bayar.includes('DP') || bayar.includes('PARSIAL') || bayar.includes('SEBAGIAN') || bayar.includes('CICIL'))
    return 'DP';

  // No reliable status string → decide purely by the amounts.
  if (dibayar <= 0) return 'Belum Bayar';
  if (total > 0 && sisa <= 0) return 'Lunas';
  return 'DP';
}

/** Map a room's backend Status_Code to one of the 3 plain room statuses. */
export function mapRoomStatus(r: Pick<RoomStatus, 'Status_Code'>): RoomDisplayStatus {
  const code = (r.Status_Code || '').toUpperCase();
  if (code === 'READY' || code === 'TERSEDIA' || code === 'KOSONG') return 'Tersedia';
  if (code === 'BELUM_BAYAR' || code === 'LEWAT_CHECKOUT' || code.includes('MASALAH')) return 'Perlu Perhatian';
  return 'Terisi';
}

// Status kamar untuk DENAH (peta 2D/3D), berdasarkan pembayaran booking aktifnya:
//   Lunas → terisi · DP → dp · Belum Bayar / tidak ada booking → kosong (masih
//   tersedia) · kamar perbaikan/maintenance → perbaikan.
// Beda dari mapRoomStatus (yang murni dari Status_Code) — di sini DP & Belum Bayar
// dibedakan supaya owner tahu kamar yang baru DP belum benar-benar terisi.
type DenahStatus3 = 'kosong' | 'dp' | 'terisi' | 'perbaikan';
export function denahRoomStatus(
  room: Pick<RoomStatus, 'Status_Code'>,
  bookings: Array<Parameters<typeof mapPayStatus>[0]>,
): DenahStatus3 {
  const code = (room.Status_Code || '').toUpperCase();
  if (code === 'NONAKTIF' || code.includes('MAINT') || code.includes('PERBAIKAN')) return 'perbaikan';
  let hasDp = false;
  for (const b of bookings) {
    const pay = mapPayStatus(b);
    if (pay === 'Lunas') return 'terisi'; // lunas → benar-benar terisi
    if (pay === 'DP') hasDp = true;
    // 'Belum Bayar' & 'Batal' → tidak memblokir kamar (tetap tersedia)
  }
  return hasDp ? 'dp' : 'kosong';
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
