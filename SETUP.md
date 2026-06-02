# 🚀 KelolaKos — FINAL Setup (Batch 1-8, complete)

**Status:** Production-ready, full CRUD termasuk Cancel/Refund.

## ⚡ 3 Command Setup

```bash
cd ~/Downloads/kelolakos-app
npm install
npm run dev
```

Buka `http://localhost:3000` → input **`BETA-4RQQ8R`**.

## 🆕 Yang Baru di Batch 8

### 💸 Cancel/Refund Modal — di setiap booking aktif

Klik row booking → drawer kebuka → klik tombol **"💸 Cancel/Refund"** (button merah-pink, di antara Edit dan Hapus).

**Modal 2-step wizard:**

**Step 1: Pilih jenis aksi (3 opsi)**

| Opsi | Use case | Backend |
|---|---|---|
| 💸 **Refund Saja** | Customer minta refund sebagian (lebih bayar, complaint service). Booking **tetap aktif**. | `submitRefund` (standalone) |
| ❌ **Cancel + DP Hangus** | Customer batal mendadak. Semua uang **TIDAK** dikembaliin, jadi pendapatan kos. | `submitStatusAction` → `CANCEL_DP_HANGUS` |
| ↩️ **Cancel + Refund** | Batal dengan refund (masalah dari kos, dll). | `submitStatusAction` → `CANCEL_DENGAN_REFUND` |

**Step 2: Form detail**

- Nominal refund (auto max-cap di sisa yang bisa direfund)
- Metode: Tunai / Transfer / E-Wallet / Lainnya
- Detail transfer (rekening / e-wallet — optional buat catatan)
- Tanggal refund
- PIC yang ngembaliin
- Alasan (textarea — required)
- Konfirmasi summary sebelum submit

**Visibility:** Tombol Cancel/Refund **muncul untuk semua booking aktif** (BOOKED, AKTIF_DP, AKTIF_LUNAS, LEBIH_BAYAR, etc) — tidak muncul kalau booking udah closed (SELESAI / CANCEL_*).

### ✏️ Edit Booking — Already Available

Edit data sudah ada dari Batch 1:
- Klik row → drawer → button **"✏️ Edit Booking"**
- Modal sama dengan create form
- Bisa edit: Nama customer, WA, check-in/out date, paket, harga kamar, extra charge, diskon, catatan, extra request (ekstra mode), fasilitas

**Belum bisa diedit:** RoomID (kalau salah pilih kamar, workaround → hapus booking lalu create baru di kamar yang benar).

## 📋 Module Status

| Module | CRUD Status |
|---|---|
| 🏠 Beranda | Read + period filter ✓ |
| 🛏️ Kamar | CRUD via Setting > Kelola Kamar ✓ |
| 📋 Booking | **Create + Read + Update + Cancel/Refund + Delete** + period filter ✓ |
| 💰 Keuangan | **Create + Read + Delete** transaksi + period filter ✓ |
| 📊 Laporan | Read + Export Print/CSV/Excel GL ✓ |
| 🧾 Kwitansi | Customizer + PNG/Clipboard export ✓ |
| 🏗️ Layout | 2D top-down view ✓ |
| ⚙️ Setting | 5 panel full CRUD ✓ |

## ⚠️ Backend Endpoints yang Dipakai

Semua endpoint ini **harus udah deployed** dari batch-batch sebelumnya. Test gampang dengan trigger error:

```
https://script.google.com/macros/s/AKfycbxcuITZulHkn7ytAxbaKp2KL0CGXRKRi7MMTOG3NelqmUmohVVyF73DFPqgOZqVvXsOrQ/exec?action=submitStatusAction&apiKey=89d9722714d1ce9db85780180a76341ce765b22e49e0d3e0&accessCode=BETA-4RQQ8R&data=%7B%22bookingId%22%3A%22NON_EXISTENT%22%2C%22statusBooking%22%3A%22CANCEL_DP_HANGUS%22%7D
```

Result:
- ✅ `"Booking dengan ID NON_EXISTENT tidak ditemukan"` → ready, function dispatched
- ⚠️ `"Unknown action: submitStatusAction"` → backend belum complete, check Api.js dispatch case

Test untuk `submitRefund` (B2) dan `submitTransactionDelete` (B7) — udah ada dari batch-batch sebelumnya.

## 🧪 Test Checklist B8

1. **`/booking`** → klik row booking → drawer kebuka → cek tombol **"💸 Cancel/Refund"** muncul (warna merah-pink, di antara Edit dan Hapus)
2. Klik tombol → modal kebuka di step 1 dengan 3 opsi
3. Pilih **"Refund Saja"** → klik Lanjut → form muncul dengan nominal, metode, etc → fill → submit → toast "Refund X berhasil dicatat" → check di sheet REFUNDS
4. Pilih **"Cancel + DP Hangus"** → klik Lanjut → form lebih simple (no nominal/metode) → fill alasan → submit → booking status berubah jadi `CANCEL_DP_HANGUS`
5. Pilih **"Cancel + Refund"** → fill → submit → status `CANCEL_DENGAN_REFUND` + refund record dibuat
6. Cek di Keuangan → transaksi refund muncul di list
7. Cek di Laporan periode hari ini → totals updated

## 🐛 Troubleshooting

| Issue | Fix |
|---|---|
| Cancel/Refund modal gak kebuka | Hard refresh `Cmd+Shift+R`. Cek browser console (F12). |
| Submit error "Unknown action" | Backend `submitStatusAction` atau `submitRefund` belum dispatched di Api.js. |
| Submit error "Status booking invalid" | Backend pakai nama status berbeda. Bisa di-edit di `cancel-refund-modal.tsx` line ~135 `statusBooking: 'CANCEL_DP_HANGUS'` ke nama yang sesuai (mis. `CANCEL_HANGUS` atau lainnya). |
| Refund nominal exceeds max | Pastiin nominal <= sisa yg bisa direfund (Total Bayar - Total Refund Existing). |
| Booking status gak update setelah submit | Tunggu 1-2 detik (React Query invalidate). Atau hard refresh browser. |

## 📂 New Files in Batch 8

```
kelolakos-app/
└── src/
    └── components/
        └── cancel-refund-modal.tsx  ← 2-step wizard (new)
```

## 🚀 Ready to Deploy ke Vercel

Setelah confirm semua jalan, baca **`VERCEL_GUIDE.md`** untuk deploy ke production:
1. Push project ke GitHub (private repo)
2. Import di Vercel, set 3 env var
3. Tunggu 2-3 menit, dapet URL production
4. Future updates: edit code → `git push` → auto-deploy

