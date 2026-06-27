import { api, type Fasilitas } from '@/lib/api';
import type { HalamanInfo } from '@/lib/halaman-info';

type RoomLike = { nama?: string; gedung?: string; lantai?: number } | null | undefined;

/** Lantai 4 = Gedung A, kamar 61A–80A (harga setahun beda). */
export function isLantai4(room: RoomLike): boolean {
  if (!room) return false;
  const g = String(room.gedung || '').toUpperCase();
  const num = parseInt(String(room.nama || '').replace(/[^0-9]/g, ''), 10);
  const gedungA = g === 'A' || g.includes('GEDUNG A') || /(^|\s)A($|\s)/.test(g);
  return room.lantai === 4 || (gedungA && num >= 61 && num <= 80);
}

/** Harga paket kost (flat) sesuai durasi + lantai. */
export function kostBasePrice(info: HalamanInfo, durasi: string, room: RoomLike): { price: number; label: string } {
  const lt4 = isLantai4(room);
  const setahun = /tahun/i.test(durasi) || durasi === '1 Tahun';
  if (setahun) return { price: lt4 ? info.kostHargaSetahunLt4 : info.kostHargaSetahun, label: lt4 ? 'Kost 1 tahun (lt.4)' : 'Kost 1 tahun' };
  return { price: lt4 ? info.kostHarga6BulanLt4 : info.kostHarga6Bulan, label: lt4 ? 'Kost 6 bln (lt.4)' : 'Kost 6 bln' };
}

export function parseRupiah(s: string | number | undefined): number {
  if (typeof s === 'number') return s || 0;
  const str = String(s || '').toLowerCase();
  // Teaser bergaya "1,3 jutaan" / "950 ribu" → konversi ke angka penuh.
  const juta = str.match(/([\d.,]+)\s*juta/);
  if (juta) return Math.round(parseFloat(juta[1].replace(/\./g, '').replace(',', '.')) * 1_000_000) || 0;
  const ribu = str.match(/([\d.,]+)\s*ribu/);
  if (ribu) return Math.round(parseFloat(ribu[1].replace(/\./g, '').replace(',', '.')) * 1_000) || 0;
  const n = str.replace(/[^0-9]/g, '');
  return n ? Number(n) : 0;
}

export function formatRupiah(n: number): string {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

/** Fasilitas yang merepresentasikan extra bed (dipilih dgn qty, bukan checkbox). */
export function isExtraBed(f: Fasilitas): boolean {
  const s = (String(f.nama || '') + ' ' + String(f.kode || '')).toLowerCase();
  return /extra\s*bed/.test(s) || s.includes('extrabed') || (s.includes('extra') && s.includes('bed'));
}

/** Fasilitas AC. Kost 6 bulan selalu NON-AC → opsi ini disembunyikan untuk paket itu. */
export function isAcFacility(f: Fasilitas): boolean {
  if (String(f.kode || '').trim().toUpperCase() === 'AC') return true;
  const nama = String(f.nama || '').toLowerCase();
  return /air\s*condition/.test(nama) || /\bac\b/.test(nama);
}

// Fallback demo (dipakai bila getFasilitas belum publik/deploy).
const DEMO_FASILITAS: Fasilitas[] = [
  { id: 'demo-ac', kode: 'AC', nama: 'AC (Air Conditioner)', emoji: '❄️', price_adjust: 200000, satuan: 'per_bulan' },
  { id: 'demo-wifi', kode: 'WIFI', nama: 'WiFi Premium', emoji: '📶', price_adjust: 50000, satuan: 'per_bulan' },
  { id: 'demo-km', kode: 'KM', nama: 'Kamar Mandi Dalam', emoji: '🚿', price_adjust: 150000, satuan: 'per_bulan' },
  { id: 'demo-bed', kode: 'EXTRABED', nama: 'Extra Bed', emoji: '🛏️', price_adjust: 100000, satuan: 'per_hari' },
];

export async function fetchFasilitas(): Promise<{ list: Fasilitas[]; demo: boolean }> {
  try {
    const list = await api.getPublicFasilitas();
    if (Array.isArray(list) && list.length) {
      return { list: list.filter((f) => f.is_active !== false && f.is_active !== 'false'), demo: false };
    }
    return { list: [], demo: false };
  } catch {
    return { list: DEMO_FASILITAS, demo: true };
  }
}
