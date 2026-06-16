/*******************************************************
 * ACTIVITY LOG - catat semua perubahan ke sheet ACTIVITY_LOG
 *
 * "No functions" di dropdown Run itu NORMAL: fungsi yang diakhiri "_"
 * sengaja disembunyikan Apps Script. Untuk tes, Run fungsi PUBLIK di
 * bawah: setupActivityLog() atau testActivityLog().
 *******************************************************/

var ACTIVITY_LOG_SHEET = 'ACTIVITY_LOG';

// Jalankan SEKALI untuk membuat sheet ACTIVITY_LOG + header.
function setupActivityLog() {
  var sh = ensureActivityLogSheet_();
  Logger.log('OK: sheet ' + ACTIVITY_LOG_SHEET + ' siap. Baris: ' + sh.getLastRow());
  return 'OK';
}

// Jalankan untuk menulis 1 baris contoh (memastikan log berfungsi).
function testActivityLog() {
  logActivity_('TES_LOG', 'Baris percobaan dari testActivityLog', 'TES-001', { accessCode: 'TES' });
  Logger.log('OK: 1 baris tes ditulis ke ' + ACTIVITY_LOG_SHEET);
  return 'OK';
}

// Ringkasan detail otomatis dari payload.
function _logDetail_(data) {
  if (!data) return '';
  var p = [];
  var nama = data.nama || data.customerName || data.namaPenjaga || data.nama_penjaga || data.item;
  if (nama) p.push(String(nama));
  var kamar = data.namaKamar || data.nama_kamar || data.roomId || data.room_id;
  if (kamar) p.push('kamar ' + kamar);
  var nominal = data.nominal || data.hargaTotal || data.harga_total || data.hargaSatuan;
  if (nominal) p.push('Rp' + nominal);
  if (data.type) p.push(String(data.type));
  return p.join(' - ');
}

// Ambil spreadsheet dengan AMAN (cegah "SPREADSHEET_ID is not defined").
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

// Tulis 1 baris log. Aman dipanggil di mana saja.
function logActivity_(aksi, detail, refId, data) {
  try {
    var sh = ensureActivityLogSheet_();
    var oleh = '';
    try {
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
 * AUTO-LOG (DISARANKAN) - pasang 1 blok di router Anda, DI ATAS switch/case
 * (mis. di dispatchV1_, blok WRITES). Ganti nama "action"/"data" kalau di
 * router Anda beda. Semua aksi diawali "submit" otomatis tercatat:
 *
 *   try {
 *     if (action && String(action).indexOf('submit') === 0) {
 *       var _ref = (data && (data.bookingId || data.booking_id || data.id ||
 *                            data.roomId || data.room_id)) || '';
 *       logActivity_(action, _logDetail_(data), _ref, data);
 *     }
 *   } catch (e) {}
 *
 * ATAU pasang manual 1 baris di akhir tiap fungsi submit, contoh:
 *   submitBooking:   logActivity_('BUAT_BOOKING', data.nama, bookingId, data);
 *   submitPayment:   logActivity_('CATAT_BAYAR', 'Rp' + data.nominal, paymentId, data);
 *   submitRefund:    logActivity_('REFUND', 'Rp' + data.nominal, refundId, data);
 *
 * Setelah dipasang + Deploy ulang, semua perubahan tercatat di ACTIVITY_LOG.
 *******************************************************/
