# CLAUDE.md — KELOLAKOS (Top Hills)

## Arsitektur (WAJIB baca sebelum kerja sistem email/notifikasi)
- **Frontend:** Next.js 15 App Router, deploy di Vercel.
- **Backend + "database":** **Google Apps Script + Google Sheets** (bukan DB tradisional).
  Frontend memanggil Apps Script via `callApi` (src/lib/api.ts). File `.gs` ada di root repo
  (`BACKEND_*.gs`, `APIV2_SIAP_PASTE.gs`) — di-**paste manual** ke project Apps Script oleh owner.
- **Email:** Google Apps Script `MailApp` (Gmail) — SUDAH aktif (BACKEND_PATCH_CUSTOMER_EMAIL.gs, dst).
- **WhatsApp:** **Fonnte** (WA gateway) via `_fonnteSend_` (BACKEND_PATCH_FONNTE_WA.gs). Token di
  Script Properties `FONNTE_TOKEN` (JANGAN commit token).
- **Cron/terjadwal:** **Apps Script time-driven triggers** (BUKAN Vercel Cron). Idempotency via
  ScriptProperties atau sheet log.
- **Konsekuensi:** Resend/Nodemailer TIDAK dipakai (gmail.com tak bisa sender-domain Resend; data di
  Sheet hanya bisa diakses Apps Script). Sistem email dibangun di **Apps Script**, bukan Next.js.

## Model data kunci
- **Kost vs Penginapan:** kolom `Layanan` di sheet Booking (mengandung `KOS` = kost; `INAP`/`PENGINAP` = penginapan).
- **Uang (sumber kebenaran):** `Harga_Total_Net`, `Net_Diterima` (dibayar, net-of-refund), `Sisa_Bayar`,
  `Refund_Total`, `Tgl_Pembayaran`. Status invoice/kuitansi dihitung dari kolom ini via
  `bookingPaidInfo` (src/lib/invoice.ts) — BUKAN dari string `Status_Bayar` (bisa basi).
- **Kost = PAKET flat** (6 Bulan / 1 Tahun), BUKAN tagihan bulanan → tidak ada "jatuh tempo bulanan".
  Sewa berakhir = `CheckOut`. Perpanjang = booking baru.
- **Penghuni ("rumah"):** src/lib/rumah.ts — punya `tanggal_lahir`, `email`, `check_in`,
  `tenure_months`, `kamar`, tier. Backend: BACKEND_RUMAH_CLUSTER1.gs.
- **Config properti:** src/lib/halaman-info.ts (alamat, rekeningKost/Penginapan, waResmi, waMezi, harga).
  Jam: src/lib/booking-rules.ts (check-in 13.00, check-out 12.00 WIB).
- **Kwitansi/invoice:** di-generate frontend (/kwitansi, InvoiceDocument) sebagai PNG. Nomor:
  `TH/{KOST|PNG}/{tahun}-{4 digit akhir BookingID}`. Belum ada PDF via URL publik.

## ATURAN KERAS — Sistem Email (berlaku SEMUA sesi)
1. **DILARANG mengarang data.** Semua konten email (aturan kost, harga, rekening, WA, WiFi, jadwal,
   link grup, jam) HARUS dari DB/Sheet/config/CLAUDE.md. Nilai di `docs/email-design-reference.pdf`
   (mis. "Bunga Lestari", "TH-2607-014", "BCA 7285-xxx", "Rp 1.850.000") = **placeholder desain, HARAM di-hardcode**.
2. Data dibutuhkan tapi **belum ada di sistem → STOP**, lapor ke owner, usulkan tempat simpan, tunggu keputusan.
3. Kerja di branch feature. **JANGAN merge ke `main` sebelum owner approve preview email.**
4. Tiap email **wajib bisa di-preview** (varian KOST & PENGINAPAN bila relevan) sebelum trigger production aktif.
5. Akhir tiap sesi email: ringkas logika (trigger → penerima → sumber tiap field → tipe) lalu **TUNGGU approval**.

## Data BELUM ADA (harus diisi owner via Pengaturan sebelum email terkait aktif)
- WiFi (nama + catatan password), jadwal sampah, jadwal laundry, link grup WA penghuni, ringkasan aturan
  rumah → email **Welcome check-in**.
- Konsep **deposit** (sistem saat ini TIDAK punya) → email booking/checkout.
- Aturan **deadline transfer** booking → email **konfirmasi booking**.
- Aturan **checkout & pengembalian deposit** → email **reminder checkout**.
- Isi **kado ulang tahun** (teks voucher/kode/masa berlaku) → email **ulang tahun**.
- Usulan tempat simpan: sheet `KwitansiSettings` (key-value) atau `HalamanInfo`, diinput lewat menu Pengaturan.

## Yang SUDAH dibangun (jangan dobel)
- Email customer: invoice (DP) / kuitansi (Lunas) / reminder pelunasan — BACKEND_PATCH_CUSTOMER_EMAIL.gs
  (desain profesional branded, refund-aware). Dikirim saat owner konfirmasi + trigger harian pelunasan.
- Reminder check-in/check-out (digest harian ke owner) — BACKEND_PATCH_REMINDER_CHECKIN_CHECKOUT.gs.
- Auto-WA ke customer via Fonnte — BACKEND_PATCH_FONNTE_WA.gs.
- Field email di booking `/info` + konfirmasi owner. Kolom `Email` di sheet Booking.

## Git / commit
- Author commit: `noreply@anthropic.com`.
- Backend `.gs` = file referensi di repo, di-paste manual oleh owner ke Apps Script (bukan runtime Vercel).
