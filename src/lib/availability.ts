// Ketersediaan kamar berbasis RENTANG tanggal — dipakai bersama oleh /info
// (cek ketersediaan) & form booking (user /info dan dashboard) supaya SINKRON.

import { type RoomStatus3 } from './building-layout';

export type Interval = { start: string; end: string };
export type BookedInterval = { start: string; end: string; status: 'lunas' | 'dp' };

export interface RoomAvail {
  status?: string; // snapshot hari ini: 'kosong'|'dp'|'terisi'|'perbaikan'
  bookedRanges?: { start: string; end: string; status?: 'lunas' | 'dp' }[];
}

/** Apakah backend sudah mengirim rentang booking? (untuk cek per-tanggal) */
export function hasRangeData(rooms: RoomAvail[]): boolean {
  return rooms.some((r) => Array.isArray(r.bookedRanges));
}

/** Potongan waktu BEBAS dalam [qs, qe) setelah dikurangi semua booking. */
export function freeIntervals(booked: { start: string; end: string }[], qs: string, qe: string): Interval[] {
  let free: Interval[] = [{ start: qs, end: qe }];
  for (const b of booked) {
    if (!b.start) continue;
    const bs = b.start, be = b.end || qe;
    free = free.flatMap((iv) => {
      if (be <= iv.start || bs >= iv.end) return [iv];
      const out: Interval[] = [];
      if (bs > iv.start) out.push({ start: iv.start, end: bs < iv.end ? bs : iv.end });
      if (be < iv.end) out.push({ start: be > iv.start ? be : iv.start, end: iv.end });
      return out;
    });
  }
  return free.filter((iv) => iv.start < iv.end);
}

/** Potongan TERPESAN dalam [qs, qe) + status bayarnya (lunas/dp). */
export function bookedWithin(r: RoomAvail, qs: string, qe: string): BookedInterval[] {
  const fallback: 'lunas' | 'dp' = r.status === 'terisi' ? 'lunas' : 'dp';
  const out: BookedInterval[] = [];
  for (const b of r.bookedRanges || []) {
    if (!b.start) continue;
    const be = b.end || qe;
    const s = b.start > qs ? b.start : qs;
    const e = be < qe ? be : qe;
    if (s < e) out.push({ start: s, end: e, status: b.status === 'lunas' || b.status === 'dp' ? b.status : fallback });
  }
  return out;
}

/** Status kamar untuk RENTANG: terisi hanya bila ada LUNAS yg menutupi; DP-only → dp. */
export function rangeStatusOf(r: RoomAvail, qs: string, qe: string): RoomStatus3 {
  if (r.status === 'perbaikan') return 'perbaikan';
  const booked = bookedWithin(r, qs, qe);
  if (booked.length === 0) return 'kosong';
  if (booked.some((b) => b.status === 'lunas')) return 'terisi';
  return 'dp';
}

/**
 * Status "saat ini" — pakai SNAPSHOT backend (sudah hitung okupansi terkini,
 * termasuk DP kost yang belum punya tanggal). Untuk kost = otoritatif; untuk
 * penginapan dipakai sebagai pratinjau sebelum tanggal diisi.
 */
export function statusTodayOf(r: RoomAvail): RoomStatus3 {
  const s = r.status;
  if (s === 'perbaikan' || s === 'terisi' || s === 'dp' || s === 'kosong') return s;
  return 'kosong';
}

/** + N hari → ISO yyyy-mm-dd. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** + N bulan → ISO yyyy-mm-dd (jaga akhir bulan). */
export function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
