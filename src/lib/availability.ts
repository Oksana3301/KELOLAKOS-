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

/** Deteksi kamar penginapan (harian) vs kost — konsisten dgn form /info booking. */
export function isPenginapanRoom(r: { layanan?: string; gedung?: string; nama?: string }): boolean {
  const lay = String(r.layanan || '').toUpperCase();
  if (lay.includes('PENGINAP') || lay.includes('INAP')) return true;
  if (lay.includes('KOS')) return false;
  const g = String(r.gedung || '').toUpperCase();
  return g.includes('C') || g.includes('PENGINAPAN') || /\bD0?\d+/i.test(String(r.nama || ''));
}

// Sentinel "diblok selamanya" (DP kost tanpa tanggal) — end eksplisit, BUKAN kosong,
// supaya rangeEndOf tidak menganggapnya cuma 1 malam.
export const FAR_FUTURE_ISO = '9999-12-31';

/**
 * Batas efektif sebuah rentang booking untuk cek ketersediaan.
 * CheckOut KOSONG = data belum lengkap → JANGAN blok sampai tak-hingga
 * (itu bikin "Terisi palsu" di semua tanggal ke depan). Anggap 1 malam saja
 * (start + 1 hari) — default wajar untuk penginapan harian. Blok "selamanya"
 * yang disengaja pakai sentinel FAR_FUTURE_ISO (end eksplisit, tak tersentuh).
 */
export function rangeEndOf(start: string, end?: string): string {
  if (end) return end;
  return addDaysISO(start, 1);
}

/**
 * Sebagian kamar berstatus dp/terisi di dashboard TAPI `bookedRanges`-nya kosong
 * (mis. booking DP kost yang belum ada CheckIn — backend butuh CheckIn utk bikin
 * rentang tanggal). Tanpa fallback ini, kamar itu tampil "kosong" (hijau) di /info
 * & Layout Properti utk SEMUA tanggal, padahal sudah di-DP — bisa bikin calon
 * penyewa pilih kamar yang sudah dipesan. Sintesis SATU rentang blok penuh
 * (open-ended dari awal waktu) sebagai fallback konservatif: murni derivasi
 * tampilan, TIDAK mengubah/menulis data booking apa pun.
 */
export function withStatusFallbackRanges<
  T extends {
    status?: string;
    layanan?: string;
    gedung?: string;
    nama?: string;
    bookedRanges?: { start: string; end: string; status?: 'lunas' | 'dp' }[];
  },
>(rooms: T[]): T[] {
  return rooms.map((r) => {
    if (Array.isArray(r.bookedRanges) && r.bookedRanges.length > 0) return r;
    if (r.status !== 'dp' && r.status !== 'terisi') return r;
    // HANYA kost yang diblok penuh saat tak ada tanggal: sewa jangka panjang,
    // konservatif biar tak dobel-DP. PENGINAPAN (harian) tanpa tanggal JANGAN
    // disintesis jadi blok — kalau tidak, kamar tampil "Terisi palsu" di /info
    // & booking flow untuk SEMUA tanggal padahal belum ada booking di tanggal itu.
    if (isPenginapanRoom(r)) return r;
    const synthStatus: 'lunas' | 'dp' = r.status === 'terisi' ? 'lunas' : 'dp';
    // end = sentinel eksplisit (bukan kosong) → blok "selamanya" yang disengaja.
    return { ...r, bookedRanges: [{ start: '1970-01-01', end: FAR_FUTURE_ISO, status: synthStatus }] };
  });
}

/** Potongan waktu BEBAS dalam [qs, qe) setelah dikurangi semua booking. */
export function freeIntervals(booked: { start: string; end: string }[], qs: string, qe: string): Interval[] {
  let free: Interval[] = [{ start: qs, end: qe }];
  for (const b of booked) {
    if (!b.start) continue;
    const bs = b.start, be = rangeEndOf(b.start, b.end);
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
    const be = rangeEndOf(b.start, b.end);
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

/** Tanggal HARI INI zona WIB (Asia/Jakarta) → yyyy-mm-dd.
 *  Jangan pakai new Date().toISOString() (UTC): dini hari WIB (00:00–07:00)
 *  UTC masih "kemarin" → ketersediaan/tanggal bisa mundur 1 hari. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
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
