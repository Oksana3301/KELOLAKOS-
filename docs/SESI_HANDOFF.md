# SESI HANDOFF — KELOLAKOS (Top Hills)

> **Buat chat baru:** baca file ini + `CLAUDE.md` dulu sebelum kerja. Ini ringkasan
> keputusan owner, apa yang sudah dibangun, dan apa yang masih perlu diklik owner.
> Terakhir diperbarui: sesi 16 Juli 2026 (lihat §11–§13 untuk yang terbaru).

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

## 11. Status kamar — SATU sumber kebenaran (16 Jul, SELESAI di frontend)

Audit lengkap: `docs/AUDIT_STATUS_KAMAR.md`. Keputusan owner ("gas rekomendasi"):
**DP tampil terpisah dari Terisi** + **SELESAI/lewat-CheckOut → kamar auto-kosong**.

- `src/components/kk/status.ts` → **`deriveRoomStatus(room, bookings, today?)`** =
  helper kanonik booking-derived by-RoomID (abaikan CANCEL/BATAL/TOLAK/MENUNGGU/SELESAI
  + lewat CheckOut; Lunas→terisi, DP→dp, else kosong, maintenance→perbaikan) +
  `liveToDisplay()`. `mapRoomStatus` (Status_Code) TIDAK dipakai lagi utk status hunian.
- Menu **Kamar** + **Beranda** pakai helper ini (badge/filter DP kuning). Denah/Layout//info
  sudah DP-aware via `getPublicRooms`. 11 unit test logika lolos.
- Backend `.gs` (APIV2_SIAP_PASTE + BACKEND_PATCH_KAMAR_PUBLIK): `_publicPayStatus_`
  abaikan SELESAI; `_publicBookingStatusByRoom_` skip CheckOut lewat. **Blok B** = seksi
  KAMAR PUBLIK lengkap utk di-paste owner ke `apiv2.gs` (sudah dipandu, statusnya cek §13).

## 12. Fitur booking baru (16 Jul, SELESAI — frontend live via Vercel)

1. **Flag anak baru/lama** di card booking: 🌱 Baru (0 pelunasan) vs ⭐ Lama · Nx lunas.
   Identitas = WA normalized 62xx (fallback nama). `custIdentityKey` + `lunasCycles`
   di `src/app/booking/page.tsx`. Aturan bisnis owner (BELUM diimplement — write-path,
   butuh approval): perpanjangan anak lama yang lunasi lebih cepat → checkout baru
   dihitung dari checkout terakhir, bukan tgl pelunasan; anak baru ikut tgl pelunasan.
2. **Jatuh tempo realtime WIB**: chip ⏰ Lewat tempo N hari / Jatuh tempo hari ini
   (`tempoDays`, Asia/Jakarta, tick 60s; exclude Batal/SELESAI).
3. **Filter "⏰ Jatuh tempo"** + counter di menu Booking.
4. **/info**: warning merah tegas bila pilih tanggal tapi backend belum kirim
   `bookedRanges` (fallback = status HARI INI, jangan menyesatkan).
5. **Upload bukti**: max 10 file per booking (`file-upload.tsx` MAX_FILES).

## 13. Progress paste backend owner (16 Jul) — SEBAGIAN SELESAI

Error bukti "editPendingBooking_multibukti_ is not defined" = fungsi hilang dari project
owner. Solusi yang SUDAH dilakukan owner:
- ✅ Paste `BACKEND_PATCH_BOOKING_ALL.gs` (versi robust `_bkBookingSheet_()` — sheet
  booking owner bernama **"BOOKINGS"** bukan "Booking"). `setupBookingAll` log BERSIH.
- ✅ Paste `BACKEND_PATCH_BUKTI.gs` (`saveBuktiFiles_` dkk — sebelumnya TIDAK ADA di
  project owner; bukti edit tak pernah tersimpan).
- ✅ Dispatcher `dispatchV1_`: 5 case submit* → versi `_bukti`.
- ✅ Deploy New version (setelah BOOKING_ALL; cek apakah SETELAH Blok B juga).
- 🔄 **Blok B** (seksi KAMAR PUBLIK di `apiv2.gs`) — terakhir owner bilang "oke gw coba";
  status paste+deploy BELUM dikonfirmasi. Kalau /info masih ngaco per-tanggal → ini belum.
- ❓ Tes akhir belum dikonfirmasi: (a) tambah foto di edit booking; (b) /info cek 1 Agu.

**⚠️ Temuan data:** header sheet BOOKINGS punya kolom **`Jumlah_Orang` DUA KALI**
(posisi ~15 dan ~33, yang kedua di antara `tag_perpanjangan` dan `Bukti_Bayar`).
Owner diminta cek: kolom kedua kosong → hapus; ada isi → konsultasi dulu. BELUM dikonfirmasi.

Header BOOKINGS lengkap (16 Jul): BookingID | Tanggal_Input | Layanan | Nama_Customer |
WhatsApp | RoomID | Nama_Kamar | Gedung | Tipe_Kamar | Paket | Jumlah_Periode | CheckIn |
CheckOut | Durasi | Jumlah_Orang | Extra_Bed_Qty | Extra_Person_Qty | Harga_Kamar |
Extra_Charge | Diskon | Harga_Total_Net | Status_Booking | Status_Bayar | Total_Bayar |
Refund_Total | Net_Diterima | Sisa_Bayar | DP_Hangus | Catatan | Timestamp_Update |
Bukti_URLs | tag_perpanjangan | Jumlah_Orang | Bukti_Bayar | Tgl_Pembayaran |
Fasilitas_IDs | Email | Notif_Email_At | Notif_Email_Info | Notif_WA_At | Notif_WA_Info |
Created_At | Updated_At

---

### TODO ringkas buat chat baru (urutan prioritas)
1. [ ] **Konfirmasi Blok B** (§13): owner sudah paste seksi KAMAR PUBLIK ke `apiv2.gs` +
       Deploy New version? → tes /info pilih 1 Agu (kamar kosong harus hijau).
2. [ ] **Tes foto bukti**: edit booking → tambah 2–3 foto → simpan → preview muncul,
       tanpa error multibukti. (Juga: sudah Run `_testSaveBukti` + Allow izin Drive?)
3. [ ] **Kolom `Jumlah_Orang` dobel** di sheet BOOKINGS (§13) → cek isi → rapikan.
4. [ ] Owner Run `previewAutoSelesaiPenginapan` (owner mau cek ulang preview dulu) →
       approve → `autoSelesaiPenginapanDP` + `setupAutoSelesaiTrigger` (§5), paste log.
5. [ ] Owner tambah 2 case `dispatchV2_` di `apiv2.gs` (§4) → tombol "Kirim ke Customer" jalan.
6. [ ] Owner Run `previewNotifAdmin` → approve → `testNotifAdmin` (notif admin 2 email).
7. [ ] Owner Run `diagTestMeziWa()` → paste log (kenapa Mezi tak dapat WA).
8. [ ] Owner **rotate FONNTE_TOKEN** di Fonnte (token lama bocor di git).
9. [ ] Customer /info email: tunggu approval owner utk edit `submitBookingRequest`.
10. [ ] (Butuh approval, write-path) Aturan checkout perpanjangan anak lama (§12.1).
11. [ ] (Terpisah, hati-hati) Denah /info masih hardcoded `building-layout.ts` + match
        by-nama — rapikan ke by-RoomID + baca dari sheet (lihat AUDIT_STATUS_KAMAR.md).
12. [ ] Merge PR #233 kalau owner sudah puas.
13. [ ] (Parked) Email ulang tahun.
