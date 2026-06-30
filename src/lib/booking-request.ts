import { api, type BookingRequestPayload } from '@/lib/api';

// Apakah error ini menandakan backend/aksi BELUM ter-deploy (bukan kegagalan
// nyata)? Hanya sinyal POSITIF "belum deploy" yang boleh jatuh ke mode demo:
//   • Endpoint Apps Script belum dipublish → HTTP 404/405.
//   • Dispatcher backend tidak mengenali aksi submitBookingRequest.
// Error lain (jaringan putus, server error, validasi, "kamar sudah dibooking",
// dll.) BUKAN demo → harus ditampilkan sebagai GAGAL supaya booking tidak
// dianggap terkirim padahal tidak tersimpan.
function looksUndeployed(e: unknown): boolean {
  const code = String((e as { code?: string })?.code || '').toUpperCase();
  const msg = String((e as Error)?.message || '').toLowerCase();
  if (code === 'HTTP_404' || code === 'HTTP_405') return true;
  return /unknown action|aksi tidak dikenal|tidak dikenal|tidak didukung|not handled|no handler|unsupported action|action not found|aksi tidak ditemukan|tidak ditemukan.*aksi/.test(
    msg,
  );
}

// Submit booking publik → PENDING.
//   { ok:true,  demo:false } → tersimpan ke backend.
//   { ok:true,  demo:true  } → backend belum deploy (anggap terkirim, mode demo).
//   { ok:false, error }      → GAGAL nyata (jaringan/validasi/server) → tampilkan ke user.
export async function submitBookingRequest(
  p: BookingRequestPayload,
): Promise<{ ok: boolean; demo: boolean; error?: string }> {
  try {
    await api.submitBookingRequest(p);
    return { ok: true, demo: false };
  } catch (e) {
    if (looksUndeployed(e)) return { ok: true, demo: true };
    return {
      ok: false,
      demo: false,
      error: (e as Error)?.message || 'Gagal mengirim booking. Periksa koneksi internet lalu coba lagi.',
    };
  }
}
