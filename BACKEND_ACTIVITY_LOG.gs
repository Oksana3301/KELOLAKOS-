/*******************************************************
 * ACTIVITY LOG — catat semua perubahan ke sheet LOG (audit jejak penjaga)
 *
 * Tujuan: tiap ada create/update/delete (booking, pembayaran, refund, fee,
 * belanja, kamar, harga, dll.), tulis 1 baris ke sheet "ACTIVITY_LOG":
 *   Waktu | Aksi | Oleh (kode akses/tier) | Detail | Booking/Ref ID
 *
 * Supaya Anda tahu kalau penjaga melakukan langkah yang salah.
 *
 * CARA PAKAI:
 *   1) Paste file ini ke .gs backend (mis. TopHillsLogic.gs). Save.
 *   2) Panggil logActivity_(...) di akhir tiap fungsi submit (lihat contoh).
 *   3) (opsional) Jalankan ensureActivityLogSheet_() sekali untuk membuat sheet
 *      + header. Kalau tidak, sheet dibuat otomatis saat log pertama.
 *
 * Kalau Anda SUDAH punya fungsi log lama yang dimatikan: cukup panggil fungsi
 * itu lagi di tiap submit — atau pakai logActivity_ ini sebagai gantinya.
 *******************************************************/

var ACTIVITY_LOG_SHEET = 'ACTIVITY_LOG';

function ensureActivityLogSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ACTIVITY_LOG_SHEET);
    sh.appendRow(['Waktu', 'Aksi', 'Oleh', 'Detail', 'Ref ID']);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Tulis 1 baris log. Aman dipanggil di mana saja (dibungkus try/catch sendiri).
 * @param {string} aksi    mis. 'BUAT_BOOKING', 'HAPUS_PEMBAYARAN'
 * @param {string} detail  keterangan ringkas (nama, nominal, dst.)
 * @param {string} refId   id terkait (bookingId/paymentId/dst.) — opsional
 * @param {Object} data    payload submit (untuk ambil siapa pelakunya) — opsional
 */
function logActivity_(aksi, detail, refId, data) {
  try {
    var sh = ensureActivityLogSheet_();
    var oleh = '';
    try {
      // Siapa pelakunya: dari accessCode di payload kalau ada, atau user properties.
      oleh = (data && (data.accessCode || data.access_code)) ||
        PropertiesService.getUserProperties().getProperty('KELOLAKOS_ACCESS_CODE') || '';
    } catch (e) {}
    sh.appendRow([
      new Date(),
      String(aksi || ''),
      String(oleh || ''),
      String(detail || ''),
      String(refId || '')
    ]);
  } catch (e) {
    Logger.log('logActivity_ gagal: ' + e);
  }
}

/*******************************************************
 * CONTOH PEMASANGAN — taruh 1 baris di akhir tiap fungsi submit, sebelum return:
 *
 *  submitBooking:      logActivity_('BUAT_BOOKING',  room.Nama_Kamar + ' · ' + data.nama + ' · Rp' + hargaTotalNet, bookingId, data);
 *  submitBookingEdit:  logActivity_('UBAH_BOOKING',  'Booking ' + bookingId + ' diubah', bookingId, data);
 *  submitBookingDelete:logActivity_('HAPUS_BOOKING', 'Booking ' + bookingId + ' dihapus', bookingId, data);
 *  submitPayment:      logActivity_('CATAT_BAYAR',   'Rp' + data.nominal + ' utk ' + (data.booking_id||''), paymentId, data);
 *  submitRefund:       logActivity_('REFUND',        'Rp' + data.nominal, refundId, data);
 *  submitStaffFee:     logActivity_('FEE_PENJAGA',   'Rp' + data.nominal + ' · ' + (data.nama_penjaga||''), feeId, data);
 *  submitExpense:      logActivity_('BELANJA',       'Rp' + data.nominal + ' · ' + (data.item||''), expenseId, data);
 *  submitTransactionDelete: logActivity_('HAPUS_TRANSAKSI', data.type + ' ' + data.id, data.id, data);
 *  submitRoomUpsert:   logActivity_('SIMPAN_KAMAR',  data.namaKamar || data.nama_kamar || '', '', data);
 *  submitRoomDelete:   logActivity_('HAPUS_KAMAR',   data.roomId || '', '', data);
 *  submitPriceSetting: logActivity_('SIMPAN_HARGA',  (data.gedung||'')+' '+(data.tipeKamar||''), '', data);
 *  submitBulkRoomPrice:logActivity_('HARGA_MASSAL',  'Rp'+(data.hargaSatuan||0), '', data);
 *
 * Setelah dipasang + Deploy ulang, semua perubahan tercatat di sheet ACTIVITY_LOG.
 *******************************************************/
