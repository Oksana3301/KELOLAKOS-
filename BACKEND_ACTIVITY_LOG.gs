/*******************************************************
 * ACTIVITY LOG — catat semua perubahan ke sheet ACTIVITY_LOG (audit jejak penjaga)
 *
 * Tujuan: tiap ada create/update/delete (booking, pembayaran, refund, fee,
 * belanja, kamar, harga, dll.), tulis 1 baris ke sheet "ACTIVITY_LOG":
 *   Waktu | Aksi | Oleh (kode akses/tier) | Detail | Ref ID
 *
 * Supaya Anda tahu kalau penjaga melakukan langkah yang salah.
 *
 * ===================================================================
 *  PENTING — kenapa dropdown Run bilang "No functions" / error?
 * ===================================================================
 *  Di Apps Script, fungsi yang namanya DIAKHIRI underscore "_"
 *  (logActivity_, ensureActivityLogSheet_, _logDetail_) SENGAJA
 *  DISEMBUNYIKAN dari menu Run. Itu fungsi PEMBANTU (private), dipanggil
 *  otomatis oleh fungsi submit / router Anda — BUKAN untuk di-Run sendiri.
 *  Jadi "No functions" itu NORMAL, bukan kerusakan.
 *
 *  Untuk MENGETES, jalankan salah satu fungsi PUBLIK di bawah (muncul di
 *  dropdown Run):
 *    • setupActivityLog()  -> bikin sheet ACTIVITY_LOG + header (sekali saja)
 *    • testActivityLog()   -> tulis 1 baris contoh untuk memastikan jalan
 *
 * CARA PAKAI:
 *   1) Paste file ini ke project .gs. Save.
 *   2) Run -> pilih "setupActivityLog" -> Run (sekali). Cek sheet ACTIVITY_LOG.
 *   3) (opsional) Run "testActivityLog" untuk memastikan baris tertulis.
 *   4) Pasang AUTO-LOG 1 blok di router (lihat bawah) ATAU panggil
 *      logActivity_(...) di akhir tiap fungsi submit (contoh di paling bawah).
 *******************************************************/

var ACTIVITY_LOG_SHEET = 'ACTIVITY_LOG';

/*******************************************************
 * FUNGSI PUBLIK (muncul di dropdown Run) — untuk setup & tes manual
 *******************************************************/

// Jalankan SEKALI untuk membuat sheet ACTIVITY_LOG + header.
function setupActivityLog() {
  var sh = ensureActivityLogSheet_();
  Logger.log('OK: sheet "' + ACTIVITY_LOG_SHEET + '" siap. Baris saat ini: ' + sh.getLastRow());
  return 'OK';
}

// Jalankan untuk menulis 1 baris contoh (memastikan log berfungsi).
function testActivityLog() {
  logActivity_('TES_LOG', 'Baris percobaan dari testActivityLog()', 'TES-001', { accessCode: 'TES' });
  Logger.log('OK: 1 baris tes ditulis ke ' + ACTIVITY_LOG_SHEET + '. Buka sheet untuk cek.');
  return 'OK';
}

/*******************************************************
 * CARA TERMUDAH (DISARANKAN) — pasang 1 blok di ROUTER, semua aksi auto-tercatat
 *
 * Tidak perlu edit tiap fungsi submit. Tambahkan blok ini SEKALI di router Anda
 * (mis. Api.js -> dispatchV1_, di blok ===== WRITES =====), DI ATAS switch/case.
 * Setiap aksi yang diawali 'submit' otomatis dicatat.
 *
 * CATATAN: ganti nama variabel `action` & `data` di blok ini kalau di router
 * Anda namanya beda (mis. `params`/`payload`).
 *
 *   // >>> AUTO-LOG semua aksi tulis ke ACTIVITY_LOG <<<
 *   try {
 *     if (action && String(action).indexOf('submit') === 0) {
 *       var _ref = (data && (data.bookingId || data.booking_id || data.id ||
 *                            data.roomId || data.room_id)) || '';
 *       logActivity_(action, _logDetail_(data), _ref, data);
 *     }
 *   } catch (e) {}
 *   // >>> END AUTO-LOG <<<
 *
 * Selesai — semua create/update/delete tercatat. Lalu Deploy ulang.
 *******************************************************/

// Ringkasan detail otomatis dari payload (biar log enak dibaca).
function _logDetail_(data) {
  if (!data) return '';
  var p = [];
  var nama = data.nama || data.customerName || data.namaPenjaga || data.nama_penjaga || data.item;
  if (nama) p.push(String(nama));
  var kamar = data.namaKamar || data.nama_kamar || data.roomId || data.room_id;
  if (kamar) p.push('kamar ' + kamar);
  var nominal = data.nominal || data.hargaTotal || data.harga_total || data.hargaSatuan;
  if (nominal) p.push('Rp' + nominal);
  if (data.type) p.push(String(data.type)); // utk submitTransactionDelete
  return p.join(' · ');
}

// Ambil spreadsheet dengan AMAN: pakai SPREADSHEET_ID kalau ada (global di
// backend Anda), kalau tidak ada jatuh ke spreadsheet aktif. Ini mencegah
// error "SPREADSHEET_ID is not defined".
function _activityLogSS_() {
  try {
    if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
  } catch (e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureActivityLogSheet_() {
  var ss = _activityLogSS_();
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
