/*******************************************************************
 * BACKEND_PATCH_BOOKING_TIMESTAMPS.gs — Top Hills
 * -----------------------------------------------------------------
 * Simpan jejak waktu per BookingID:
 *   • Created_At  — saat booking pertama dibuat.
 *   • Updated_At  — tiap kali booking diubah (edit/konfirmasi/status).
 *
 * Dipakai frontend utk: urutan "terbaru dibuat paling atas" + tampil di detail.
 * Kalau patch ini TIDAK dipasang, frontend tetap jalan (pakai Timestamp lama /
 * tanggal lain sebagai fallback) — hanya kurang akurat.
 *
 * ================= CARA PASANG (3 langkah kecil) =================
 * 1) Paste file ini sebagai .gs baru. Jalankan sekali: ensureBookingTimestampCols_()
 *    → bikin kolom Created_At & Updated_At di sheet Booking (kalau belum ada).
 *
 * 2) Updated_At otomatis tiap EDIT: buka fungsi _setBookingStatus_ (di apiv2.gs /
 *    patch Perpanjang). TEPAT SEBELUM loop menulis updates, tambahkan 1 baris:
 *
 *        updates.Updated_At = new Date();
 *
 *    (Semua edit — editPendingBooking, confirmBooking, submitBookingEdit_fixed_,
 *     rejectBooking — lewat sini, jadi cukup 1 tempat.)
 *
 * 3) Created_At saat CREATE:
 *    a) Booking dari /info: di submitBookingRequest, pada objek `vals`, tambah:
 *          Created_At: new Date(),
 *    b) Booking dari dashboard: di fungsi submitBooking kamu (yang menulis baris
 *       booking baru), set kolom Created_At = new Date() juga.
 *    Kalau lupa/duplikat: aman — backfillBookingCreatedAt() (di bawah) bisa
 *    mengisi Created_At yang masih kosong dari Timestamp / baris.
 *
 * 4) Deploy → Manage deployments → ✏️ Edit → New version → Deploy.
 *******************************************************************/

var BK_TS_SHEET = 'Booking';

function ensureBookingTimestampCols_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BK_TS_SHEET);
  if (!sh) throw new Error('Sheet "' + BK_TS_SHEET + '" tidak ada');
  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
    .map(function (h) { return String(h); });
  ['Created_At', 'Updated_At'].forEach(function (col) {
    if (headers.indexOf(col) === -1) {
      sh.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });
  return 'OK — kolom Created_At & Updated_At siap.';
}

/**
 * (Opsional) Isi Created_At yang masih kosong dari kolom Timestamp (booking lama
 * dari /info) supaya urutan "terbaru" tetap masuk akal untuk data lama.
 */
function backfillBookingCreatedAt() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BK_TS_SHEET);
  if (!sh) throw new Error('Sheet "' + BK_TS_SHEET + '" tidak ada');
  ensureBookingTimestampCols_();
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h); });
  var cCreated = headers.indexOf('Created_At');
  var cTs = headers.indexOf('Timestamp');
  var cId = headers.indexOf('BookingID');
  if (cCreated === -1) return 'Kolom Created_At tidak ada.';
  var n = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][cId] || '').trim() === '') continue;
    if (String(data[i][cCreated] || '').trim() !== '') continue; // sudah ada → skip
    var val = (cTs !== -1 && data[i][cTs]) ? data[i][cTs] : new Date();
    sh.getRange(i + 1, cCreated + 1).setValue(val);
    n++;
  }
  return 'Backfill Created_At: ' + n + ' baris.';
}
