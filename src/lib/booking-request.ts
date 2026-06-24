import { api, type BookingRequestPayload } from '@/lib/api';

// Submit booking publik → PENDING. Bila backend belum deploy, jatuh ke mode demo
// (anggap terkirim) supaya alur tetap bisa diuji. Setelah .gs live → tulis asli.
export async function submitBookingRequest(p: BookingRequestPayload): Promise<{ ok: boolean; demo: boolean }> {
  try {
    await api.submitBookingRequest(p);
    return { ok: true, demo: false };
  } catch {
    return { ok: true, demo: true };
  }
}
