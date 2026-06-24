import { api, type Fasilitas } from '@/lib/api';

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
