import { api, type PenyewaLookup } from '@/lib/api';
import { normWa } from '@/lib/tophills-theme';

// DEMO sementara (PR-1): dipakai HANYA bila endpoint backend lookup belum di-deploy.
// Setelah .gs lookupPenyewaByWa/ById live, data ASLI otomatis dipakai & demo diabaikan.
const DEMO: PenyewaLookup[] = [
  { bookingId: 'TH-2026-0148', nama: 'Aisyah Putri', whatsapp: '6285263901187', layanan: 'KOS', kamar: 'Kamar 12A — Gedung A', tipe: 'Standar AC', durasiTerakhir: 'Paket 6 Bulan', tglAkhirKontrak: '2026-12-31', status: 'AKTIF' },
  { bookingId: 'TH-2026-0207', nama: 'Nurul Fadhilah', whatsapp: '6281377814502', layanan: 'PENGINAPAN', kamar: 'Executive — Gedung C', tipe: 'Executive', durasiTerakhir: 'Bulanan', tglAkhirKontrak: '2026-07-31', status: 'AKTIF' },
  { bookingId: 'TH-2026-0151', nama: 'Nurul Fadhilah', whatsapp: '6281377814502', layanan: 'KOS', kamar: 'Kamar 07B — Gedung B', tipe: 'Deluxe', durasiTerakhir: 'Paket Tahunan', tglAkhirKontrak: '2027-06-30', status: 'AKTIF' },
];

// Nomor demo untuk diuji (PR-1): satu kamar & banyak kamar.
export const DEMO_HINT = '08522 6390 1187 (1 kamar) · 0813 7781 4502 (2 kamar)';

export type LookupResult = { rows: PenyewaLookup[]; demo: boolean };

export async function lookupPenyewa(input: { wa?: string; bookingId?: string; room?: string }): Promise<LookupResult> {
  try {
    if (input.bookingId) {
      const one = await api.lookupPenyewaById(input.bookingId.trim());
      return { rows: one ? [one] : [], demo: false };
    }
    if (input.room) {
      const rows = await api.lookupPenyewaByRoom(input.room);
      return { rows: Array.isArray(rows) ? rows : [], demo: false };
    }
    const rows = await api.lookupPenyewaByWa(normWa(input.wa || ''));
    return { rows: Array.isArray(rows) ? rows : [], demo: false };
  } catch {
    // Backend belum di-deploy → pakai data contoh supaya alur bisa diuji.
    if (input.bookingId) {
      const id = input.bookingId.trim().toUpperCase();
      return { rows: DEMO.filter((d) => d.bookingId.toUpperCase() === id), demo: true };
    }
    if (input.room) {
      const q = input.room.split('—')[0].trim().toLowerCase();
      return { rows: DEMO.filter((d) => d.kamar.toLowerCase().startsWith(q)), demo: true };
    }
    const key = normWa(input.wa || '');
    return { rows: DEMO.filter((d) => d.whatsapp === key), demo: true };
  }
}
