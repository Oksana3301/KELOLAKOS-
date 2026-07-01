import type { QueryClient } from '@tanstack/react-query';

// ── SATU sumber kebenaran untuk sinkronisasi antar-halaman ──
// Semua data di Beranda, Kamar, Uang (Keuangan), Laporan, Invoice (Kwitansi), dan
// Layout Properti sebenarnya berasal dari sheet yang sama seperti Booking. Yang bikin
// mereka "ketinggalan" cuma cache React Query. Jadi: setiap kali ada perubahan booking
// (buat/ubah/hapus/status/bayar/refund), panggil invalidateBookingData(qc) agar SEMUA
// query yang bergantung pada booking ditandai stale → halaman lain ikut ter-update.
//
// Query keys ini dipetakan dari pemakaian nyata tiap halaman:
//   initial-data       → Beranda, Kamar, Uang, Laporan, Layout, Invoice, Booking
//   report-data        → Beranda, Uang, Laporan (prefix cocok utk ['report-data', from, to])
//   recent-transactions→ Uang, Booking (prefix cocok utk varian [ , 30])
//   room-management    → Kamar
//   public-rooms       → Layout Properti (status kamar)
//   booking-fasilitas  → badge fasilitas & flag tanggal di kartu Booking
//   pending-bookings   → "Butuh Konfirmasi" (booking dari /info)
//   booking-detail     → sheet detail booking (semua id)
const BOOKING_DEPENDENT_KEYS = [
  'initial-data',
  'report-data',
  'recent-transactions',
  'room-management',
  'public-rooms',
  'booking-fasilitas',
  'pending-bookings',
  'booking-detail',
] as const;

/**
 * Tandai semua data yang bergantung pada booking sebagai stale → halaman lain
 * (Beranda/Kamar/Uang/Laporan/Invoice/Layout) ikut sync saat dibuka/aktif.
 * @param bookingId  bila diisi, detail booking spesifik ikut di-refresh tepat.
 */
export function invalidateBookingData(qc: QueryClient, bookingId?: string) {
  BOOKING_DEPENDENT_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  if (bookingId) qc.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
}
