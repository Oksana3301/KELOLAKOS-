/*******************************************************
 * PATCH BUKTI — Upload bukti (booking + transaksi uang) ke Google Drive
 *
 * Tambahan:
 *   - saveBuktiFiles_(buktiFiles, subfolder, prefix) — simpan base64 ke Drive,
 *     balikin array URL yang bisa dibuka (anyone-with-link / view).
 *   - attachBuktiToSheet_(sheetName, idCol, idValue, urlCol, urls) — tulis URL
 *     ke kolom Bukti_URLs di row yang baru dibuat.
 *
 * Frontend (src/lib/api.ts) sudah mengirim field `bukti_files` pada payload
 * submitBooking / submitPayment / submitRefund / submitStaffFee / submitExpense.
 * Tiap item berbentuk: { name, mimeType, size, base64 }  (base64 = tanpa prefix).
 *
 * =============================================================
 * CARA APLIKASIIN
 * =============================================================
 * STEP A — Tambahkan SELURUH blok helper di bawah ("BAGIAN 1") ke salah satu
 *          file .gs backend Anda (mis. TopHillsLogic.gs).
 *
 * STEP B — Di tiap fungsi submit yang ingin menerima bukti, panggil
 *          saveBuktiFiles_() lalu tulis hasilnya ke kolom Bukti_URLs.
 *          Lihat contoh integrasi di "BAGIAN 2".
 *
 * STEP C — Pastikan sheet PAYMENTS/REFUNDS/FEES/EXPENSES/BOOKINGS punya kolom
 *          header bernama "Bukti_URLs" (kalau belum ada, tambahkan).
 *
 * STEP D — Deploy ulang web app (Deploy → Manage deployments → Edit → Deploy)
 *          supaya versi /exec ikut terupdate (yang /dev otomatis ikut).
 *
 * Catatan kuota: file disimpan di Drive akun pemilik script. base64 di JSON
 * membengkak ~33%, jadi untuk file besar (mendekati 50MB) request bisa lambat.
 *******************************************************/


/* =====================================================================
 * BAGIAN 1 — HELPER (copy semua ke backend .gs Anda)
 * ===================================================================== */

// Folder induk di Drive tempat semua bukti disimpan.
var BUKTI_ROOT_FOLDER_NAME = 'KelolaKos Bukti';

// Batas & format yang diizinkan (selaras dengan validasi frontend).
var BUKTI_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
var BUKTI_ALLOWED_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf'
};
var BUKTI_ALLOWED_EXT = { png: 1, jpg: 1, jpeg: 1, svg: 1, pdf: 1 };

/** Ambil folder (buat kalau belum ada) di dalam parent. */
function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** Folder bukti untuk kategori tertentu, mis. "Booking", "Pembayaran", dst. */
function getBuktiFolder_(subfolder) {
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), BUKTI_ROOT_FOLDER_NAME);
  if (!subfolder) return root;
  return getOrCreateFolder_(root, String(subfolder));
}

/** Cek ekstensi dari nama file. */
function buktiExt_(name) {
  var p = String(name || '').split('.');
  return p.length > 1 ? p[p.length - 1].toLowerCase() : '';
}

/**
 * Simpan daftar bukti (base64) ke Drive.
 * @param {Array} buktiFiles  array {name, mimeType, size, base64}
 * @param {string} subfolder  nama subfolder kategori (mis. "Booking")
 * @param {string} prefix     prefix nama file (mis. bookingId / "BAYAR-123")
 * @return {Array<string>}    daftar URL file yang bisa dibuka
 */
function saveBuktiFiles_(buktiFiles, subfolder, prefix) {
  var urls = [];
  if (!buktiFiles || !buktiFiles.length) return urls;

  var folder = getBuktiFolder_(subfolder);
  var stamp = Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss');

  for (var i = 0; i < buktiFiles.length; i++) {
    var f = buktiFiles[i] || {};
    if (!f.base64) continue;

    var mime = String(f.mimeType || '').toLowerCase();
    var ext = buktiExt_(f.name);

    // Validasi format (terima kalau mime ATAU ekstensi dikenal).
    if (!BUKTI_ALLOWED_MIME[mime] && !BUKTI_ALLOWED_EXT[ext]) {
      throw new Error('Format bukti tidak didukung: ' + (f.name || mime));
    }
    if (!mime) mime = 'application/octet-stream';

    // Validasi ukuran (perkiraan dari panjang base64).
    var approxBytes = Math.floor(String(f.base64).length * 0.75);
    if (f.size && f.size > BUKTI_MAX_BYTES) throw new Error('Bukti melebihi 50MB: ' + f.name);
    if (approxBytes > BUKTI_MAX_BYTES) throw new Error('Bukti melebihi 50MB: ' + f.name);

    var safeName = (prefix ? prefix + '-' : '') + stamp + '-' + (i + 1) + '-' +
      String(f.name || ('bukti.' + (BUKTI_ALLOWED_MIME[mime] || ext || 'dat')))
        .replace(/[^\w.\-]+/g, '_');

    var bytes = Utilities.base64Decode(f.base64);
    var blob = Utilities.newBlob(bytes, mime, safeName);
    var file = folder.createFile(blob);

    // Bisa dibuka lewat link (supaya muncul di app & bisa dikirim ke penyewa).
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { /* abaikan kalau policy domain melarang */ }

    urls.push(file.getUrl());
  }
  return urls;
}

/**
 * Tulis daftar URL ke kolom "Bukti_URLs" pada row dengan id tertentu.
 * Disimpan sebagai teks dipisah baris baru — sesuaikan dengan cara backend
 * Anda membaca kolom Bukti_URLs menjadi array (PaymentRecord.Bukti_URLs).
 *
 * @param {string} sheetName  nama sheet (mis. "PAYMENTS")
 * @param {string} idColName  header kolom id (mis. "PaymentID")
 * @param {string} idValue    nilai id row yang baru dibuat
 * @param {string} urlColName header kolom bukti (default "Bukti_URLs")
 * @param {Array<string>} urls
 */
function attachBuktiToSheet_(sheetName, idColName, idValue, urlColName, urls) {
  if (!urls || !urls.length) return;
  urlColName = urlColName || 'Bukti_URLs';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet tidak ditemukan: ' + sheetName);

  var values = sh.getDataRange().getValues();
  var header = values[0];
  var idCol = header.indexOf(idColName);
  var urlCol = header.indexOf(urlColName);
  if (idCol < 0) throw new Error('Kolom ' + idColName + ' tidak ada di ' + sheetName);
  if (urlCol < 0) throw new Error('Kolom ' + urlColName + ' tidak ada di ' + sheetName +
    ' — tambahkan header "' + urlColName + '" dulu.');

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(idValue)) {
      sh.getRange(r + 1, urlCol + 1).setValue(urls.join('\n'));
      return;
    }
  }
}


/* =====================================================================
 * BAGIAN 2 — CONTOH INTEGRASI (tempel potongan ini di fungsi submit Anda)
 *
 * Pola umum:
 *   1) buat row seperti biasa, dapatkan id-nya (paymentId/bookingId/dst).
 *   2) panggil saveBuktiFiles_(data.bukti_files, '<Kategori>', id).
 *   3) attachBuktiToSheet_('<SHEET>', '<IdCol>', id, 'Bukti_URLs', urls).
 *
 * Ganti nama sheet/kolom sesuai struktur spreadsheet Anda.
 * ===================================================================== */

/* --- submitPayment(data) ---
function submitPayment(data) {
  // ... logika existing membuat row pembayaran, mis. menghasilkan paymentId ...
  var paymentId = ...;

  // >>> TAMBAHKAN: simpan bukti pembayaran <<<
  if (data && data.bukti_files && data.bukti_files.length) {
    var urls = saveBuktiFiles_(data.bukti_files, 'Pembayaran', paymentId);
    attachBuktiToSheet_('PAYMENTS', 'PaymentID', paymentId, 'Bukti_URLs', urls);
  }

  return ok({ paymentId: paymentId, message: 'Pembayaran dicatat' });
}
*/

/* --- submitBooking(data) ---
function submitBooking(data) {
  // ... logika existing membuat booking, menghasilkan bookingId ...
  var bookingId = ...;

  if (data && data.bukti_files && data.bukti_files.length) {
    var urls = saveBuktiFiles_(data.bukti_files, 'Booking', bookingId);
    // simpan di sheet BOOKINGS (atau ke PAYMENTS pertama kalau DP awal dicatat di sana)
    attachBuktiToSheet_('BOOKINGS', 'BookingID', bookingId, 'Bukti_URLs', urls);
  }

  return ok({ bookingId: bookingId });
}
*/

/* --- submitRefund(data) ---  (sheet REFUNDS, kolom RefundID)
  if (data.bukti_files && data.bukti_files.length) {
    var urls = saveBuktiFiles_(data.bukti_files, 'Refund', refundId);
    attachBuktiToSheet_('REFUNDS', 'RefundID', refundId, 'Bukti_URLs', urls);
  }
*/

/* --- submitStaffFee(data) ---  (sheet FEES, kolom FeeID)
  if (data.bukti_files && data.bukti_files.length) {
    var urls = saveBuktiFiles_(data.bukti_files, 'FeePenjaga', feeId);
    attachBuktiToSheet_('FEES', 'FeeID', feeId, 'Bukti_URLs', urls);
  }
*/

/* --- submitExpense(data) ---  (sheet EXPENSES, kolom ExpenseID)
  if (data.bukti_files && data.bukti_files.length) {
    var urls = saveBuktiFiles_(data.bukti_files, 'Belanja', expenseId);
    attachBuktiToSheet_('EXPENSES', 'ExpenseID', expenseId, 'Bukti_URLs', urls);
  }
*/


/* =====================================================================
 * BAGIAN 3 — TES CEPAT (jalankan dari editor Apps Script, opsional)
 * ===================================================================== */
function _testSaveBukti() {
  // PNG 1x1 transparan (base64 tanpa prefix data:)
  var tinyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  var urls = saveBuktiFiles_(
    [{ name: 'tes.png', mimeType: 'image/png', size: 100, base64: tinyPng }],
    'Tes', 'TES-1'
  );
  Logger.log(urls); // harusnya 1 URL Drive yang bisa dibuka
}
