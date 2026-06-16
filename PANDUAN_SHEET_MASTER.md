# 📒 Panduan Google Sheet Master — KelolaKos

Penjelasan tiap **tab/sheet** yang dipakai aplikasi, supaya kamu tahu mana yang
penting (jangan dihapus) dan mana yang aman dibereskan.

> ⚠️ **PENTING sebelum hapus/rename tab apa pun:**
> Backend membaca tab **berdasarkan nama persis** lewat konstanta `SHEETS` di
> Apps Script. Kalau kamu **rename** sebuah tab, kamu **wajib** mengubah juga
> nilai di `SHEETS` agar cocok — kalau tidak, aplikasi akan error
> (`getSheetByName` gagal). Karena itu **jangan rename sembarangan**.
> Untuk rename ke CAPS dengan aman, lihat bagian "Cara rename aman" di bawah.

---

## 1) Sheet yang DIPAKAI aplikasi (JANGAN dihapus)

| Sheet (umum) | Fungsi | Dipakai di menu |
|---|---|---|
| **BOOKINGS** | Data booking/penyewa: nama, kamar, periode, total, status bayar | Beranda, Booking, Kwitansi, Laporan |
| **PAYMENTS** | Catatan **uang masuk** (pembayaran sewa/DP/pelunasan) | Uang, Laporan, Beranda |
| **REFUNDS** | Catatan **pengembalian uang** ke penyewa | Uang, Laporan |
| **FEES** | Catatan **fee/gaji penjaga** | Uang, Laporan |
| **EXPENSES** | Catatan **belanja operasional** (listrik, galon, dll.) | Uang, Laporan |
| **ROOMS** (master kamar) | Daftar kamar + status + gedung/lantai | Kamar, Layout Properti, pilih kamar saat Booking |
| **PRICES** (harga) | Harga Umum & Harga Massal (per Layanan+Gedung+Tipe+Paket) | Pengaturan → Harga, perhitungan Booking |
| **ROOM_PRICE_RULES** | Harga khusus per kamar (override harga umum) | Pengaturan, Booking |
| **FASILITAS** | Daftar fasilitas + harganya (AC, WiFi, dll.) | Pengaturan, add-on saat Booking |
| **ROOM_FACILITIES** | Penugasan fasilitas ke kamar tertentu | Pengaturan, Booking |
| **KWITANSI_SETTINGS** | Profil bisnis (nama, tagline, alamat) untuk kwitansi | Pengaturan → Profil Bisnis, Kwitansi |
| **BUILDING_LAYOUT** | Konfigurasi tata letak gedung (opsional) | Layout Properti |

> Nama tab di atas adalah **nama umum**. Nama persis di spreadsheet-mu bisa
> sedikit beda — cek lewat fungsi `auditSheets` / objek `SHEETS` di backend.

---

## 2) Sheet TERPISAH (bukan di spreadsheet ini)

- **License Master** — daftar **kode akses** (BETA-/PENJAGA-/dll.) + tier + expire.
  Ini di **spreadsheet/CSV terpisah** (yang dipublish jadi CSV). Jangan dicampur ke sini.

---

## 3) Tab yang AMAN dihapus

- **`_AUDIT`** dan **`_AUDIT_TGL`** → tab hasil audit yang aku buat. Murni untuk
  pengecekan, **tidak dipakai aplikasi**. Aman dihapus kapan saja.
- Tab apa pun yang **tidak muncul** di daftar bagian (1) dan **bukan catatan
  manualmu sendiri**. Cek dulu isinya sebelum hapus.

> Jalankan **`auditSheets`** (file `BACKEND_AUDIT_SHEETS.gs`) → tab "TIDAK
> DIKENAL" = kandidat untuk dibereskan. Tetap **cek isinya** dulu.

---

## 4) Cara rename ke CAPS dengan AMAN (tidak bikin error)

Karena backend mengandalkan `SHEETS`, urutannya HARUS:

1. Buka Apps Script → cari objek **`SHEETS`** (mis. `var SHEETS = { BOOKINGS: 'Bookings', ... }`).
2. Untuk tiap tab yang mau di-CAPS:
   - **Rename tab** di Google Sheet (klik kanan tab → Rename → mis. `Bookings` → `BOOKINGS`).
   - **Ubah nilai di `SHEETS`** agar sama persis (mis. `BOOKINGS: 'BOOKINGS'`).
3. Save Apps Script + **Deploy ulang**.

> Kalau langkah (2) terlewat, aplikasi akan error. Jadi **rename tab dan update
> `SHEETS` harus selalu barengan**.

**Cara paling aman:** kirim isi objek `SHEETS`-mu ke aku — nanti aku kasih versi
`SHEETS` yang sudah CAPS + daftar tab mana yang harus di-rename, sehingga cocok
100% dan tidak ada yang error.

---

## 5) Helper aman (opsional)

File `BACKEND_SHEET_CLEANUP.gs` berisi:
- `listAllTabs()` — menampilkan semua nama tab + apakah dipakai aplikasi.
- `deleteAuditTabs()` — hapus **hanya** tab `_AUDIT` & `_AUDIT_TGL` (aman).
- `hideTabs(['NamaTab1','NamaTab2'])` — **sembunyikan** tab (reversible, tidak
  menghapus data) untuk merapikan tampilan tanpa risiko.

> Aku sengaja **tidak** membuat fungsi yang menghapus tab data otomatis —
> terlalu berisiko menghilangkan data. Penghapusan tetap keputusan manualmu.
