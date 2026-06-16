/*******************************************************
 * PATCH: HAPUS BOOKING ikut hapus DATA UANG-nya (biar tidak membingungkan)
 *
 * Aturan yang diminta:
 *   - HAPUS booking  -> hapus juga semua pembayaran/uang-masuk milik booking itu.
 *   - REFUND / BATAL -> JANGAN dihapus. Itu tetap menyisakan jejak di data uang
 *                       (memang sengaja, supaya ada catatan uang keluar).
 *
 * Semua ASCII (tanpa karakter aneh). Fungsi diakhiri "_" itu pembantu (tidak
 * muncul di dropdown Run - itu normal).
 *
 * CARA PAKAI:
 *   Di dalam fungsi HAPUS booking Anda (mis. submitBookingDelete / aksi
 *   "hapus booking" di submitTransactionDelete), tambahkan SEBELUM/observe
 *   menghapus baris booking:
 *
 *       deleteBookingMoney_(bookingId);
 *
 *   Itu akan menghapus baris pembayaran milik bookingId tsb. JANGAN panggil
 *   fungsi ini di alur REFUND atau BATAL - di sana jejak uang harus tetap ada.
 *
 *   Daftar sheet uang yang dibersihkan ada di MONEY_SHEETS_FOR_BOOKING di bawah.
 *   Sesuaikan nama tab + nama kolom BookingID kalau di sheet Anda beda.
 *******************************************************/

// Sheet uang yang barisnya milik-booking dan boleh ikut terhapus saat booking
// dihapus. CATATAN: REFUND sengaja TIDAK dimasukkan di sini supaya jejaknya tetap.
var MONEY_SHEETS_FOR_BOOKING = ['PEMBAYARAN', 'UANG_MASUK'];

// Kemungkinan nama header kolom yang menyimpan BookingID (dicocokkan fleksibel).
var BOOKING_ID_HEADERS = ['bookingid', 'booking_id', 'idbooking', 'kodebooking'];

function deleteBookingMoney_(bookingId) {
  if (!bookingId) return 0;
  var ss = _delSS_();
  var totalHapus = 0;
  for (var i = 0; i < MONEY_SHEETS_FOR_BOOKING.length; i++) {
    var nama = MONEY_SHEETS_FOR_BOOKING[i];
    var sh = ss.getSheetByName(nama);
    if (!sh || sh.getLastRow() < 2) continue;

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var idxBooking = -1;
    for (var c = 0; c < header.length; c++) {
      var key = String(header[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (BOOKING_ID_HEADERS.indexOf(key) >= 0) { idxBooking = c; break; }
    }
    if (idxBooking < 0) continue; // sheet ini tidak punya kolom BookingID

    // Hapus dari bawah ke atas supaya nomor baris tidak bergeser.
    var data = sh.getRange(2, idxBooking + 1, sh.getLastRow() - 1, 1).getValues();
    for (var r = data.length - 1; r >= 0; r--) {
      if (String(data[r][0]) === String(bookingId)) {
        sh.deleteRow(r + 2);
        totalHapus++;
      }
    }
  }
  Logger.log('deleteBookingMoney_: ' + totalHapus + ' baris uang dihapus utk booking ' + bookingId);
  return totalHapus;
}

function _delSS_() {
  try {
    if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
  } catch (e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

/*******************************************************
 * CONTOH penempatan di submitBookingDelete Anda:
 *
 *   function submitBookingDelete(data) {
 *     var bookingId = data.bookingId || data.id;
 *     // ... validasi ...
 *     deleteBookingMoney_(bookingId);     // <-- hapus uang milik booking ini
 *     // ... hapus baris booking di sheet BOOKING ...
 *     return { success: true, message: 'Booking & data uangnya dihapus' };
 *   }
 *
 * Untuk REFUND / BATAL: JANGAN panggil deleteBookingMoney_. Cukup catat baris
 * refund (uang keluar) seperti biasa supaya jejaknya tetap terlihat di menu Uang.
 *******************************************************/
