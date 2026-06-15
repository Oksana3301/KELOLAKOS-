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
 * STEP B — Di tiap fungsi submit, tambahkan 1 BARIS handleBukti_(...) tepat
 *          sebelum baris `return`. Daftar barisnya ada di "BAGIAN 2".
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
 * Pakai SPREADSHEET_ID yang sama dengan backend Anda (lihat PATCH B7).
 *
 * @param {string} sheetName  nama sheet (mis. SHEETS.PAYMENTS)
 * @param {string} idColName  header kolom id (mis. "PaymentID")
 * @param {string} idValue    nilai id row yang baru dibuat
 * @param {string} urlColName header kolom bukti (default "Bukti_URLs")
 * @param {Array<string>} urls
 */
function attachBuktiToSheet_(sheetName, idColName, idValue, urlColName, urls) {
  if (!urls || !urls.length) return;
  urlColName = urlColName || 'Bukti_URLs';

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID); // konstanta yang sudah ada di backend
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

/**
 * SATU PANGGILAN untuk semua: simpan bukti + tulis URL ke sheet yang benar.
 * Cukup panggil 1 baris ini di tiap fungsi submit (lihat BAGIAN 2).
 *
 * @param {Object} data  payload submit (berisi data.bukti_files)
 * @param {string} type  'BOOKING' | 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE'
 * @param {string} id    id row yang baru dibuat (bookingId/paymentId/dst.)
 */
function handleBukti_(data, type, id) {
  if (!data || !data.bukti_files || !data.bukti_files.length || !id) return;

  // Mapping type -> sheet + kolom id + subfolder. Pakai SHEETS.* (sama spt B7).
  var cfg = {
    BOOKING: { sheet: SHEETS.BOOKINGS, idCol: 'BookingID', folder: 'Booking' },
    PAYMENT: { sheet: SHEETS.PAYMENTS, idCol: 'PaymentID', folder: 'Pembayaran' },
    REFUND:  { sheet: SHEETS.REFUNDS,  idCol: 'RefundID',  folder: 'Refund' },
    FEE:     { sheet: SHEETS.FEES,     idCol: 'FeeID',     folder: 'FeePenjaga' },
    EXPENSE: { sheet: SHEETS.EXPENSES, idCol: 'ExpenseID', folder: 'Belanja' }
  }[String(type).toUpperCase()];

  if (!cfg) throw new Error('handleBukti_: type tidak dikenal: ' + type);

  var urls = saveBuktiFiles_(data.bukti_files, cfg.folder, id);
  attachBuktiToSheet_(cfg.sheet, cfg.idCol, id, 'Bukti_URLs', urls);
  return urls;
}


/* =====================================================================
 * BAGIAN 2 — INTEGRASI (cukup 1 BARIS per fungsi submit)
 *
 * Di tiap fungsi submit di TopHillsLogic.gs, cari baris `return ...` di paling
 * akhir. Tepat SEBELUM return itu (saat id sudah dibuat), tambahkan 1 baris
 * handleBukti_. Ganti paymentId/bookingId/dst dengan nama variabel id yang
 * dipakai fungsi Anda (lihat apa yang di-return fungsi itu).
 *
 *   submitPayment(data):    handleBukti_(data, 'PAYMENT', paymentId);
 *   submitBooking(data):    handleBukti_(data, 'BOOKING', bookingId);
 *   submitRefund(data):     handleBukti_(data, 'REFUND',  refundId);
 *   submitStaffFee(data):   handleBukti_(data, 'FEE',     feeId);
 *   submitExpense(data):    handleBukti_(data, 'EXPENSE', expenseId);
 *
 * Contoh lengkap (submitPayment):
 *
 *   function submitPayment(data) {
 *     // ... logika existing Anda yang membuat row & menghasilkan paymentId ...
 *
 *     handleBukti_(data, 'PAYMENT', paymentId);   // <-- TAMBAHKAN baris ini
 *
 *     return { paymentId: paymentId, message: 'Pembayaran dicatat' };
 *   }
 *
 * CATATAN:
 * - handleBukti_ aman dipanggil walau tidak ada bukti (langsung return).
 * - Untuk BOOKING, cek konstanta SHEETS.BOOKINGS benar (lihat objek SHEETS di
 *   backend; di B7 ada SHEETS.PAYMENTS/REFUNDS/FEES/EXPENSES). Kalau nama sheet
 *   booking Anda beda, ganti baris BOOKING di config handleBukti_.
 * ===================================================================== */


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
