/*******************************************************
 * PATCH DP-AWAL - submitBooking mencatat pembayaran awal (DP / Lunas)
 *
 * MASALAH:
 *   submitBooking membuat baris booking dengan status 'BELUM BAYAR' dan kolom
 *   bayar = 0, lalu TIDAK pernah membaca dp_awal. Akibatnya saat user pilih
 *   "DP" atau "Lunas" waktu BUAT booking, uangnya diabaikan:
 *     - tidak masuk ke menu Uang / Pendapatan
 *     - status tetap salah (DP tidak tercatat -> bisa keliru tampil)
 *
 * SOLUSI:
 *   Setelah booking dibuat & financial-nya dihitung, kalau dp_awal > 0, catat
 *   pembayaran lewat submitPayment() yang SUDAH ADA (fungsi yang sama dipakai
 *   tombol "Catat Pembayaran"). Itu menulis ke sheet pembayaran + mengubah
 *   status bayar jadi DP / LUNAS otomatis, dan sisa terhitung benar.
 *
 * =====================================================================
 *  CARA PASANG (cuma 1 langkah)
 * =====================================================================
 *  1) Buka fungsi submitBooking Anda.
 *  2) Cari baris ini (sudah ada di kode Anda):
 *
 *         updateBookingFinancials_(bookingId);
 *
 *  3) TEPAT DI BAWAHNYA, tempel BLOK di antara garis ==== di bawah ini
 *     (jangan ikut menyalin tanda komentar). Letaknya: SETELAH
 *     updateBookingFinancials_(bookingId); dan SEBELUM "return { ... }".
 *  4) Save (Ctrl+S) lalu DEPLOY ULANG:
 *         Deploy > Manage deployments > (deployment aktif) > Edit >
 *         Version: New version > Deploy
 *
 *  Catatan: blok ini memakai variabel `data`, `bookingId`, dan `hargaTotalNet`
 *  yang SUDAH ada di submitBooking Anda. Kalau nama variabel total Anda bukan
 *  `hargaTotalNet`, ganti di baris _lunas (lihat komentar di dalam blok).
 *******************************************************/

/* ============== MULAI BLOK (salin mulai baris di bawah) ============== */

  // === Catat pembayaran awal (DP / Lunas) supaya uang langsung masuk ===
  var _dpAwal = Number(data.dp_awal || data.dpAwal || 0);
  if (_dpAwal > 0) {
    try {
      // Ganti "hargaTotalNet" di bawah kalau nama variabel total Anda beda.
      var _lunas = _dpAwal >= hargaTotalNet;
      submitPayment({
        bookingId: bookingId,
        booking_id: bookingId,
        nominal: _dpAwal,
        jenisBayar: _lunas ? 'PELUNASAN' : 'DP',
        jenis_bayar: _lunas ? 'PELUNASAN' : 'DP',
        metode: data.dp_metode || data.dpMetode || 'CASH',
        diterimaOleh: data.diterima_oleh || data.diterimaOleh || '',
        diterima_oleh: data.diterima_oleh || data.diterimaOleh || '',
        tanggalBayar: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd'),
        tanggal_bayar: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd'),
        catatan: 'Pembayaran awal saat booking dibuat'
      });
    } catch (e) {
      Logger.log('submitBooking: gagal catat pembayaran awal: ' + e);
    }
  }

/* ============== SELESAI BLOK (berhenti di baris di atas) ============== */

/*******************************************************
 * CONTOH HASIL AKHIR (potongan submitBooking Anda):
 *
 *   updateBookingFinancials_(bookingId);
 *
 *   // === Catat pembayaran awal (DP / Lunas) supaya uang langsung masuk ===
 *   var _dpAwal = Number(data.dp_awal || data.dpAwal || 0);
 *   if (_dpAwal > 0) {
 *     ... (blok di atas) ...
 *   }
 *
 *   return {
 *     success: true,
 *     message: 'Booking berhasil dibuat ...',
 *     bookingId: bookingId,
 *     warning: activeWarning
 *   };
 *
 * Setelah Deploy ulang:
 *   - DP  -> uang masuk tercatat, status DP, sisa = total - DP (benar).
 *   - Lunas -> uang penuh tercatat, status LUNAS, sisa 0.
 *   - Belum bayar (dp_awal = 0) -> tetap BELUM BAYAR, tidak ada uang masuk.
 *******************************************************/
