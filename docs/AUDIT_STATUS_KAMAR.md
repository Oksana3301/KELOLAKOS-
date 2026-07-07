# AUDIT — Sinkronisasi Status Kamar (KELOLAKOS / Top Hills)

> Kenapa status kamar beda-beda antar menu. Audit 7 Jul 2026 (read-only, belum ada perubahan kode).

## Temuan inti: ADA 3 DEFINISI STATUS KAMAR yang jalan bareng

| Sub-sistem | View | Sumber | Cara hitung | Bucket |
|---|---|---|---|---|
| **A** | Menu **Kamar** + **Beranda** | `Status_Code` dari backend (`getRoomStatusList_`) | backend, **tak terverifikasi** (lihat blind spot) | 3: Terisi / Tersedia / Perlu Perhatian |
| **B** | **Layout Properti** (/layout3d) + **Denah 2D/3D** + **/info** | `getPublicRooms` (backend `_publicPayStatus_`) | booking-derived, DP-aware | 4: kosong / dp / terisi / perbaikan |
| **C** | (nganggur) `denahRoomStatus` di `status.ts` | booking list + `mapPayStatus` | booking-derived | 4 (sama konsep B, tapi tak dipakai) |

**Menu Booking sendiri** (`mapPayStatus`, `status.ts:33`) = status **pembayaran** (Lunas/DP/Belum/Batal), cuma exclude CANCEL/BATAL. Ini yang owner anggap sumber kebenaran.

## Divergensi konkret (kenapa keliatan beda)

**Skenario 1 — booking kamar A, status DP (bayar sebagian):**
- Menu Booking → tab **DP** ✅
- Menu Kamar + Beranda → kemungkinan **"Terisi"** (hijau solid) — `Status_Code` nggak bedain DP vs Lunas
- Layout Properti + Denah + /info → **"DP"** (kuning, "belum benar-benar terisi")
- → **kamar sama, "Terisi" di Beranda tapi "DP" di denah.**

**Skenario 2 — booking MENUNGGU_KONFIRMASI (dari /info):**
- Menu Booking → ikut kehitung tab DP (mapPayStatus nggak exclude MENUNGGU) + muncul di card "Butuh Konfirmasi"
- Denah/info → **nggak blok kamar** (`_publicPayStatus_` exclude MENUNGGU) → kamar "kosong"

**Skenario 3 — booking SELESAI (tamu sudah checkout):**
- **Tak ada satu view pun** yang exclude SELESAI → kamar **terhitung terisi selamanya** walau tamu sudah keluar.

## Masalah lain yang ketemu

1. **Denah pakai daftar kamar HARDCODED** (`src/lib/building-layout.ts` `FLOORS`) — bukan dari sheet. Kamar baru/ganti nama di menu Kamar **nggak muncul/nggak update** di denah.
2. **Cocokin kamar by-NAMA (regex), bukan by-RoomID** (`_publicRoomKey_` di backend + `roomKey()` di building-layout). Kalau `Nama_Kamar` di sheet Booking beda dikit sama sheet Rooms (spasi/kapital/penomoran) → **gagal senyap** → kamar keliatan kosong di /info & denah padahal ada booking. Risiko tinggi buat kost (nomor polos "12A" dll).
3. **`getRoomStatusList_` & `getInitialData` TIDAK ADA di repo** — cuma ada di Apps Script editor owner. Jadi logika Status_Code (sumber menu Kamar/Beranda) **tak bisa diverifikasi dari kode**. Ini blind spot terbesar.
4. **Dua salinan `v2_getPublicRooms`** di repo (`BACKEND_PATCH_KAMAR_PUBLIK.gs` lama vs `APIV2_SIAP_PASTE.gs` baru). Kalau owner paste yang lama, fitur cek-per-tanggal (`bookedRanges`) hilang senyap.
5. `layout3d-viewer.tsx` kemungkinan dead code (nggak diimpor).
6. **Cache invalidation SUDAH benar** untuk semua menu dashboard (`query-sync.ts`) — jadi masalahnya **bukan cache basi**, tapi **beda definisi**. /info (browser publik) nggak kena invalidation lintas-sesi → stale ~60 detik (wajar).

## Rencana fix (aman, read-only / frontend — TIDAK nyentuh kode tulis booking)

**Tujuan: semua view pakai SATU definisi booking-derived (bukan Status_Code yang tak terverifikasi).**

1. Bikin 1 helper kanonik `deriveRoomStatus(room, bookingsForRoom)` di `src/lib` — cocokin **by-RoomID**, exclude CANCEL/BATAL/TOLAK/MENUNGGU/**SELESAI** + past-checkout, lalu Lunas→terisi / DP→dp / else kosong / maintenance→perbaikan. (Menyatukan A & B, sesuai `_publicPayStatus_`.)
2. Wire **Menu Kamar** + **Beranda** ke helper itu (ganti `mapRoomStatus`). Tambah state visual "DP" biar sama dengan denah.
3. Denah/Layout/`/info` sudah booking-derived; samakan backend `_publicPayStatus_` (read-only .gs, owner paste): exclude SELESAI + (opsi) cocok by-RoomID.
4. Room picker di alur booking (`booking-ui.tsx`) — DP tetap **blok** kamar (biar nggak dobel-booking); cuma label yang diselaraskan.
5. `building-layout.ts` hardcode + salinan `.gs` ganda + dead code → dirapikan terpisah, hati-hati.

**Keputusan owner yang dibutuhkan (nentuin logika semua view):**
- **DP** tampil "DP/dipesan" (beda dari Terisi) atau dihitung "Terisi"? → rekomendasi: **DP terpisah** (sesuai denah + menu Booking).
- Kamar **SELESAI**/lewat-checkout auto jadi "kosong" lagi? → rekomendasi: **Ya**.
