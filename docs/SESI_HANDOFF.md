# SESI HANDOFF — KELOLAKOS (Top Hills)

> **Buat chat baru:** baca file ini + `CLAUDE.md` dulu sebelum kerja. Ini ringkasan
> keputusan owner, apa yang sudah dibangun, dan apa yang masih perlu diklik owner.
> Terakhir diperbarui: sesi 5 Juli 2026.

---

## 1. Arsitektur (ringkas — detail di CLAUDE.md)

- **Frontend:** Next.js 15 App Router → deploy Vercel.
- **Backend + "DB":** Google Apps Script + Google Sheets. File `.gs` di root repo =
  **referensi**, di-**paste MANUAL** owner ke editor Apps Script. **Tidak auto-deploy**
  dari git — merge ke main TIDAK mengubah Apps Script.
- **Email:** Gmail `MailApp` (branded HTML). **WA:** Fonnte (`_fonnteSend_`, token di
  Script Properties `FONNTE_TOKEN`). **Cron:** Apps Script time-driven triggers.
- **Sandbox Claude TIDAK bisa:** nge-Run Apps Script, akses Google Sheet, atau connect
  ke `api.fonnte.com` (diblok proxy). Semua eksekusi backend = owner klik Run sendiri.

## 2. Aturan keras (WAJIB dipatuhi tiap sesi)

- **JAGA DATA BOOKING.** Owner sudah input BANYAK booking real. Fitur baru WAJIB
  **standalone / additive** (file `.gs` baru) atau **notifikasi read-only**. DILARANG
  edit kode penulis data booking (`submitBooking`, `submitBookingRequest`,
  `confirmBooking`, `_setBookingStatus_`, dst) kecuali owner minta eksplisit.
- **DILARANG mengarang data** email (harga, rekening, WA, WiFi, aturan). Semua dari
  DB/Sheet/config. Nilai di `docs/email-design-reference.pdf` = placeholder desain, HARAM.
- Kerja di branch feature. Jangan merge ke main sebelum owner approve preview.

## 3. Keputusan owner (permanen — jangan diubah tanpa perintah)

| Topik | Keputusan |
|---|---|
| **Notif /info** (customer input sendiri) | OTOMATIS kirim Email + WA "Booking Diterima" via `sendBookingConfirmEmail_`. **SUDAH aktif.** |
| **Notif dashboard** (owner/penjaga input) | Kirim Email + WA JUGA, tapi **trigger MANUAL** (tombol), BUKAN auto — takut salah input lalu terkirim. Pakai FLAG per booking anti-spam. **SUDAH dibangun (lihat §4).** |
| **Auto-SELESAI penginapan** | Penginapan + DP + CheckOut+12.00 WIB lewat → `Status_Booking=SELESAI`. Preview approved. **Nunggu owner Run (lihat §5).** |
| **Reminder pelunasan** | Email **DAN** WA. Fire bila ada Email ATAU WA. Penginapan H-1; kost +7/+14/+30 dari tgl DP. **SUDAH aktif.** |
| **Email ulang tahun** | **PARKED.** |

## 4. Fitur "Kirim ke Customer" (owner-send manual) — STATUS: kode selesai, nunggu wiring

**Backend:** `BACKEND_PATCH_KIRIM_KE_CUSTOMER_MANUAL.gs` (standalone, reuse helper via
`typeof` guard, 0 redefinisi). Fungsi utama:
- `kirimKeCustomerManual({bookingId, kind?, force?})` → kirim Email branded
  (`_custDocHtml_` / `_bookingConfirmHtml_`) + WA (`_fonnteCustomerText_`). Anti-spam:
  kalau flag `Notif_*_At` ada & tidak `force` → tolak, minta konfirmasi. Catat ke kolom
  `Notif_Email_At/Info`, `Notif_WA_At/Info` (dibuat otomatis).
- `getNotifStatus({bookingId})` → baca flag buat badge.
- `_notifMode_()` → baca Pengaturan `notif_customer_mode` (default manual; buat AUTO nanti).
- Test live sukses: `TH-REQ-20260705-084503 [invoice] → email:OK wa:OK`.

**Frontend (PR #233, sudah di-push, typecheck lolos):**
- `src/lib/api.ts` → method `kirimKeCustomerManual` + interface `KirimCustomerResult`/
  `KirimNotifChannel` + kolom `Notif_*` di `BookingItem`.
- `src/app/booking/page.tsx` → `kirimMutation` (toast per-channel, "kirim ulang" via
  `force`), preservasi `Notif_*` saat `refreshDetail`, wiring ke `<BookingDetail>`.
- `src/components/kk/booking-ui.tsx` → tombol **"Kirim ke Customer (Email + WA)"** +
  badge "✅ Sudah dikirim" di section 📤 Kirim. Tombol lama di-rename → "Buat Invoice /
  Kwitansi (PNG)".

### ⚠️ BELUM dilakukan owner (blocker tombol jalan):
Di `apiv2.gs` fungsi `dispatchV2_`, tambah 2 case:
```javascript
case 'kirimKeCustomerManual': return kirimKeCustomerManual(payload);
case 'getNotifStatus':        return { ok: true, data: getNotifStatus(payload) };
```
Tanpa ini, tombol frontend dapet error "action tidak dikenal".

## 5. Auto-SELESAI penginapan — STATUS: nunggu owner Run

File: `BACKEND_PATCH_AUTO_SELESAI_PENGINAPAN.gs` (sudah di main, DORMANT). Preview kemarin
= 8 kandidat (semua C-PNG, DP, checkout 28 Jun–4 Jul). **Owner setuju aktifin.**

### Langkah owner di editor Apps Script (Claude tidak bisa Run ini):
1. Pastikan file ke-paste. Pilih fungsi **`autoSelesaiPenginapanDP`** → **Run** → cek Logs
   (`APPLIED — kandidat: 8 …`).
2. Pilih **`setupAutoSelesaiTrigger`** → **Run** → bikin trigger harian 13.00 WIB.
   Verifikasi di menu ⏰ Triggers.
- Nggak nge-lock (booking SELESAI tetap bisa diedit/lunasi). Kolom uang tak disentuh.
  Cuma penginapan (kost dikecualikan). Idempoten.
- **Owner diminta paste log `autoSelesaiPenginapanDP` ke Claude buat verifikasi 8 booking.**

## 6. Yang SUDAH dibangun (jangan dobel)

- Email customer: invoice (DP) / kuitansi (Lunas) / reminder pelunasan — branded tema
  Top Hills (dark hero + Cormorant serif + gold + room card) — `BACKEND_PATCH_CUSTOMER_EMAIL.gs`.
- Reminder check-in/check-out (digest harian owner) — `BACKEND_PATCH_REMINDER_CHECKIN_CHECKOUT.gs`.
- Auto-WA customer via Fonnte — `BACKEND_PATCH_FONNTE_WA.gs`.
- Booking confirm email/WA saat /info — `sendBookingConfirmEmail_` di `submitBookingRequest`.

## 7. Data BELUM ADA (owner harus isi via Pengaturan sebelum email terkait aktif)

WiFi, jadwal sampah/laundry, link grup WA penghuni, ringkasan aturan rumah (→ email Welcome);
konsep deposit; aturan deadline transfer; aturan checkout/pengembalian deposit; isi kado ultah.
Usulan simpan: sheet `KwitansiSettings` (key-value) atau `HalamanInfo`.

## 8. Git

- Branch feature aktif sesi ini: `claude/compassionate-fermat-5zvkxi` → **PR #233**.
- Author commit: `noreply@anthropic.com`.
- PR #233 isi: backend owner-send manual + reminder Email OR WA + tombol frontend + CLAUDE.md.

## 9. Audit notif booking /info (6 Jul 2026) — temuan penting

Investigasi kenapa notif booking /info tak terkirim. Peta penerima **saat booking /info masuk**:

| Penerima | Channel | Status di kode | Sumber alamat |
|---|---|---|---|
| Admin (dewiatika) | Email | wired (`_notifyAdminNewBooking_`) | `ADMIN_EMAIL` |
| **Admin (kostputritophills)** | Email | **BELUM** (kode cuma 1 alamat) → **diperbaiki**, lihat bawah | — |
| Mezi | WA | wired (`_notifyMeziNewBooking_`) | `MEZI_WA` / waMezi `6283841614871` |
| **Admin/helpdesk WA** | WA | **BELUM** → **diperbaiki** | waResmi `628116646615` |
| Customer | Email + WA | **repo TIDAK wire** `sendBookingConfirmEmail_` (live owner dulu tambah manual) | `b.Email`/`b.WhatsApp` |

**Root-cause kandidat kegagalan (urut kemungkinan), CEK via `diagNotifBooking()`:**
1. `submitBookingRequest` (repo `BACKEND_PATCH_PERPANJANG.gs`) TIDAK panggil `sendBookingConfirmEmail_` & `vals` tak punya key `Email`. Live owner dulu tambah manual → **mungkin ke-reset saat "rapihin appscript"**. Cek: kolom `Email` booking /info terakhir kosong?
2. `FONNTE_TOKEN` kosong → semua WA gagal senyap.
3. Syntax error dari paste terbaru → SELURUH project mati (cek: baris booking masuk sheet? kalau masuk → gugur).
4. Backend belum re-deploy → frontend `looksUndeployed` → demo-success (cek: baris booking ADA di sheet?).
5. Kuota Gmail habis (100/hari) → email gagal senyap.

**🔐 SECURITY:** `FONNTE_TOKEN` asli sempat ke-commit di `BACKEND_RUMAH_CLUSTER1.gs:9` (komentar). Sudah di-redact di repo. **Owner WAJIB rotate token di dashboard Fonnte** (token lama sudah bocor di git history).

## 10. Enhancement notif admin (siap, PREVIEW dulu)

**KEPUTUSAN OWNER (7 Jul):** notif booking /info cukup **Mezi (WA) + email admin**. WA
helpdesk/admin **TIDAK jadi** (dibatalkan). Jadi enhancement = email-only.

`BACKEND_PATCH_EMAIL_NOTIF_FIX.gs` di-upgrade (signature `_notifyAdminNewBooking_(v, buktiUrl)` SAMA → `submitBookingRequest` tak disentuh):
- Email admin → **SEMUA** (`ADMIN_EMAILS` comma, default dewiatika + kostputritophills).
- WA Mezi tetap lewat `_notifyMeziNewBooking_` (file booking) — TAK diubah.
- Fungsi: `previewNotifAdmin()` (dry), `testNotifAdmin()` (kirim tes), `setAdminEmails()`.
- Diverifikasi: unit test lolos (sandbox), `node --check` lolos.
- **Owner Run `previewNotifAdmin` DULU** → approve → `testNotifAdmin` → deploy.

**Kenapa Mezi tak dapat WA (booking /info ada tapi Mezi sepi):** cek via
`diagTestMeziWa()` (BACKEND_DIAG_NOTIF_BOOKING.gs) — resolve nomor Mezi + kirim tes.
Tersangka: (1) `FONNTE_TOKEN` kosong → semua WA gagal senyap; (2) `MEZI_WA` &
`HalamanInfo.waMezi` kosong → target kosong → skip; (3) Fonnte device disconnect /
nomor tak terdaftar. `diagNotifBooking()` sekarang tampilkan "Mezi terpakai" (nomor riil).

**Belum diputuskan / butuh owner:** customer /info tak dapat email butuh edit `submitBookingRequest` (tambah `Email:` ke vals + panggil `sendBookingConfirmEmail_`) — sentuh write-path, TUNGGU approval owner + hasil `diagNotifBooking`.

---

### TODO ringkas buat chat baru
1. [ ] Owner Run `diagNotifBooking()` → paste log → pastikan root-cause outage.
2. [ ] Owner **rotate FONNTE_TOKEN** di Fonnte (token lama bocor di git).
3. [ ] Owner Run `previewNotifAdmin` → approve → `testNotifAdmin` → deploy (notif admin 2 email + WA).
4. [ ] Owner tambah 2 case `dispatchV2_` di `apiv2.gs` (§4) → tombol Kirim jalan.
5. [ ] Owner Run `autoSelesaiPenginapanDP` + `setupAutoSelesaiTrigger` (§5), paste log.
6. [ ] Customer /info email: tunggu approval owner utk edit `submitBookingRequest`.
7. [ ] Merge PR #233 kalau owner sudah puas.
8. [ ] (Parked) Email ulang tahun.
