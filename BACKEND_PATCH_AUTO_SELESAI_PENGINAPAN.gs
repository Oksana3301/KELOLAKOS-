/*******************************************************************
 * BACKEND_PATCH_AUTO_SELESAI_PENGINAPAN.gs — Top Hills
 * =================================================================
 * Auto-tutup booking PENGINAPAN yang masih DP TAPI tanggal masuk (CheckIn)
 * SUDAH LEWAT (< hari ini) → Status_Booking = 'SELESAI'.
 *
 * KHUSUS PENGINAPAN (bukan kost). Alasan: penginapan set CheckIn di depan,
 * jadi tanggal masuk yang sudah lewat = booking lama. Kost CheckIn di-set saat
 * pelunasan, jadi aturan ini TIDAK relevan untuk kost (sengaja dikecualikan).
 *
 * DEFINISI:
 *   • "DP"    = ada pembayaran sebagian tapi belum lunas (net-of-refund:
 *               dibayar > 0 DAN sisa > 0). Lunas / Belum Bayar / total 0 → dilewati.
 *   • "Lewat" = CheckIn (tanggal saja, tanpa jam) < HARI INI. Booking yang
 *               check-in HARI INI TIDAK disentuh (tamu baru masuk hari ini).
 *
 * AMAN:
 *   • Cuma menulis kolom Status_Booking (+ catatan audit). Kolom uang TIDAK
 *     diubah — status DP-nya tetap kelihatan, cuma booking-nya "ditutup".
 *   • Idempoten: skip yang sudah SELESAI/CANCEL/BATAL/DITOLAK/MENUNGGU.
 *   • Edit via script tidak memicu onEdit → tidak menyenggol updateBookingFinancials_.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PAKAI:                                                    │
 * │ 1) Paste sebagai .gs BARU. Save.                              │
 * │ 2) PREVIEW dulu (TANPA mengubah apa pun):                     │
 * │      Run `previewAutoSelesaiPenginapan` → cek Logs, lihat     │
 * │      daftar booking yang AKAN di-SELESAI-kan.                 │
 * │ 3) Kalau daftarnya sudah benar:                              │
 * │      Run `autoSelesaiPenginapanDP` → ubah status jadi SELESAI.│
 * │ 4) (opsional) Run `setupAutoSelesaiTrigger` → jalan otomatis  │
 * │      tiap hari 01:00 untuk booking yang tgl masuknya lewat.   │
 * └───────────────────────────────────────────────────────────────┘
 *******************************************************************/

var AUTOSEL_CFG = { bookingSheet: 'Booking', closedStatus: 'SELESAI' };

function _asTz_() { return Session.getScriptTimeZone() || 'GMT+7'; }
function _asTodayISO_() { return Utilities.formatDate(new Date(), _asTz_(), 'yyyy-MM-dd'); }
function _asISO_(v) {
  if (v == null || v === '') return '';
  var d = (v instanceof Date) ? v : new Date(String(v));
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, _asTz_(), 'yyyy-MM-dd');
}

// Sheet booking robust: SHEETS.BOOKINGS → cfg → auto-deteksi kolom BookingID.
function _asSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var s2 = ss.getSheetByName(AUTOSEL_CFG.bookingSheet); if (s2) return s2;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var lc = all[i].getLastColumn(); if (lc < 1) continue;
    var H = all[i].getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h); });
    if (H.indexOf('BookingID') >= 0) return all[i];
  }
  throw new Error('Sheet booking tak ketemu (tak ada sheet dgn kolom BookingID).');
}

function _asIsPenginapan_(layanan) {
  var s = String(layanan || '').toUpperCase();
  return s.indexOf('PENGINAP') >= 0 || s.indexOf('INAP') >= 0;   // 'PENGINAPAN' / 'INAP'
}

// Booking sudah "tertutup" / bukan kandidat (skip). Termasuk MENUNGGU (pending).
function _asIsClosed_(statusBooking) {
  var s = String(statusBooking || '').toUpperCase();
  return s.indexOf('SELESAI') >= 0 || s.indexOf('CANCEL') >= 0 || s.indexOf('BATAL') >= 0 ||
         s.indexOf('TOLAK') >= 0 || s.indexOf('REJECT') >= 0 || s.indexOf('MENUNGGU') >= 0;
}

// DP = ada bayar sebagian, belum lunas (net-of-refund). false kalau lunas / belum bayar / total 0.
function _asIsDP_(row, H) {
  function num(name) { var c = H.indexOf(name); return c < 0 ? 0 : Number(row[c] || 0); }
  var total = num('Harga_Total_Net');
  var refund = num('Refund_Total');
  var netCol = H.indexOf('Net_Diterima');
  var netRaw = netCol < 0 ? '' : row[netCol];
  var dibayar = (netRaw === '' || netRaw == null) ? Math.max(0, num('Total_Bayar') - refund) : Number(netRaw || 0);
  var sisa = total - dibayar;
  return total > 0 && dibayar > 0 && sisa > 0;   // ada DP, masih ada sisa (belum lunas)
}

// INTI: scan seluruh sheet; dryRun=true → cuma laporan (tidak mengubah).
function _autoSelesai_(dryRun) {
  var sh = _asSheet_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, total: 0, changed: 0, list: [] };
  var H = data[0].map(function (h) { return String(h); });
  var cStatus = H.indexOf('Status_Booking');
  var cCheckIn = H.indexOf('CheckIn');
  var cLayanan = H.indexOf('Layanan');
  var cCatatan = H.indexOf('Catatan');
  var cId = H.indexOf('BookingID');
  var cNama = H.indexOf('Nama_Customer');
  var cKamar = H.indexOf('Nama_Kamar');
  if (cStatus < 0 || cCheckIn < 0 || cLayanan < 0) {
    throw new Error('Kolom wajib tak ada (butuh Status_Booking, CheckIn, Layanan).');
  }
  var todayISO = _asTodayISO_();
  var list = [], changed = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!_asIsPenginapan_(row[cLayanan])) continue;   // penginapan saja
    if (_asIsClosed_(row[cStatus])) continue;          // skip yang sudah tutup / pending
    var ciISO = _asISO_(row[cCheckIn]);
    if (!ciISO || ciISO >= todayISO) continue;         // CheckIn WAJIB < hari ini (bukan hari ini/nanti)
    if (!_asIsDP_(row, H)) continue;                   // WAJIB DP (belum lunas, ada bayaran)
    var info = {
      row: i + 1,
      bookingId: cId >= 0 ? String(row[cId] || '') : '',
      nama: cNama >= 0 ? String(row[cNama] || '') : '',
      kamar: cKamar >= 0 ? String(row[cKamar] || '') : '',
      checkIn: ciISO,
      statusLama: String(row[cStatus] || '')
    };
    list.push(info);
    if (!dryRun) {
      sh.getRange(i + 1, cStatus + 1).setValue(AUTOSEL_CFG.closedStatus);
      if (cCatatan >= 0) {
        var old = String(row[cCatatan] || '');
        var note = '[auto-SELESAI: DP lewat tgl masuk ' + ciISO + ']';
        sh.getRange(i + 1, cCatatan + 1).setValue([old, note].filter(Boolean).join(' | '));
      }
      changed++;
    }
  }
  Logger.log((dryRun ? 'PREVIEW (tidak mengubah)' : 'APPLIED') + ' — kandidat: ' + list.length + ' booking penginapan DP lewat tgl masuk.');
  list.forEach(function (x) {
    Logger.log('  • ' + (x.bookingId || '(no id)') + ' · ' + x.nama + ' · ' + x.kamar + ' · masuk ' + x.checkIn + ' · status lama: ' + x.statusLama);
  });
  return { ok: true, total: list.length, changed: changed, list: list };
}

// PREVIEW — cuma laporan di Logs, TIDAK mengubah apa pun. Jalankan ini DULU.
function previewAutoSelesaiPenginapan() { return _autoSelesai_(true); }

// APPLY — ubah Status_Booking → SELESAI untuk yang memenuhi syarat.
function autoSelesaiPenginapanDP() { return _autoSelesai_(false); }

// Trigger harian 01:00 — tutup booking penginapan DP yang tgl masuknya sudah lewat.
function setupAutoSelesaiTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'autoSelesaiPenginapanDP') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('autoSelesaiPenginapanDP').timeBased().everyDays(1).atHour(1).inTimezone(_asTz_()).create();
  return 'OK — auto-SELESAI penginapan DP jalan tiap hari 01:00.';
}
