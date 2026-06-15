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
 * STEP B — Di file router (Api.js / dispatchV1_), ganti 5 baris `case 'submit...'`
 *          agar memanggil versi *_bukti (cara wrapper). Detail di "BAGIAN 2".
 *
 * STEP C — Kolom "Bukti_URLs" dibuat OTOMATIS oleh script saat pertama dipakai
 *          (tidak perlu menambah header manual). Kalau mau langsung dibuat di
 *          semua sheet sekaligus, jalankan fungsi setupBuktiColumns() sekali.
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
 * Kolom Bukti_URLs dibuat OTOMATIS kalau belum ada — tidak perlu menambah
 * header manual di sheet. Pakai SPREADSHEET_ID yang sama dengan backend (B7).
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
  var header = values[0] || [];
  var idCol = header.indexOf(idColName);
  if (idCol < 0) throw new Error('Kolom ' + idColName + ' tidak ada di ' + sheetName);

  // Buat kolom Bukti_URLs otomatis kalau belum ada (di kolom kosong berikutnya).
  var urlCol = header.indexOf(urlColName);
  if (urlCol < 0) {
    urlCol = header.length;
    sh.getRange(1, urlCol + 1).setValue(urlColName);
  }

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(idValue)) {
      sh.getRange(r + 1, urlCol + 1).setValue(urls.join('\n'));
      return;
    }
  }
}

/**
 * (OPSIONAL, jalankan sekali dari editor) Buat kolom "Bukti_URLs" di semua
 * sheet sekaligus, supaya langsung ada tanpa menunggu upload pertama.
 * Tidak wajib — attachBuktiToSheet_ juga sudah membuatnya otomatis saat dipakai.
 */
function setupBuktiColumns() {
  var sheets = [SHEETS.BOOKINGS, SHEETS.PAYMENTS, SHEETS.REFUNDS, SHEETS.FEES, SHEETS.EXPENSES];
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  for (var i = 0; i < sheets.length; i++) {
    var sh = ss.getSheetByName(sheets[i]);
    if (!sh) { Logger.log('Lewati (tidak ada): ' + sheets[i]); continue; }
    var header = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0] || [];
    if (header.indexOf('Bukti_URLs') < 0) {
      sh.getRange(1, header.length + 1).setValue('Bukti_URLs');
      Logger.log('Tambah kolom Bukti_URLs di: ' + sheets[i]);
    } else {
      Logger.log('Sudah ada Bukti_URLs di: ' + sheets[i]);
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
 * BAGIAN 1B — WRAPPER (REKOMENDASI: tidak perlu mengedit isi fungsi submit)
 *
 * Tempel SEMUA fungsi di bawah ini juga ke paling bawah TopHillsLogic.gs.
 * Tiap wrapper memanggil fungsi asli Anda, lalu menyimpan bukti pakai id yang
 * dikembalikan fungsi itu. Dibungkus try/catch supaya — kalau penyimpanan bukti
 * gagal — pencatatan utama (booking/bayar/dst) TIDAK ikut gagal.
 * ===================================================================== */

// Ambil id dari hasil return fungsi (cek beberapa kemungkinan key).
function _buktiPickId_(res, keys) {
  if (!res) return '';
  var d = (res && res.data) ? res.data : res; // jaga2 kalau dibungkus {data:...}
  for (var i = 0; i < keys.length; i++) {
    if (d && d[keys[i]]) return String(d[keys[i]]);
  }
  return '';
}

function submitBooking_bukti(data) {
  var res = submitBooking(data);
  try { handleBukti_(data, 'BOOKING', _buktiPickId_(res, ['bookingId', 'BookingID'])); }
  catch (e) { Logger.log('handleBukti_ BOOKING gagal: ' + e); }
  return res;
}

function submitPayment_bukti(data) {
  var res = submitPayment(data);
  try { handleBukti_(data, 'PAYMENT', _buktiPickId_(res, ['paymentId', 'PaymentID'])); }
  catch (e) { Logger.log('handleBukti_ PAYMENT gagal: ' + e); }
  return res;
}

function submitRefund_bukti(data) {
  var res = submitRefund(data);
  try { handleBukti_(data, 'REFUND', _buktiPickId_(res, ['refundId', 'RefundID'])); }
  catch (e) { Logger.log('handleBukti_ REFUND gagal: ' + e); }
  return res;
}

function submitStaffFee_bukti(data) {
  var res = submitStaffFee(data);
  try { handleBukti_(data, 'FEE', _buktiPickId_(res, ['feeId', 'FeeID'])); }
  catch (e) { Logger.log('handleBukti_ FEE gagal: ' + e); }
  return res;
}

function submitExpense_bukti(data) {
  var res = submitExpense(data);
  try { handleBukti_(data, 'EXPENSE', _buktiPickId_(res, ['expenseId', 'ExpenseID'])); }
  catch (e) { Logger.log('handleBukti_ EXPENSE gagal: ' + e); }
  return res;
}


/* =====================================================================
 * BAGIAN 2 — AKTIFKAN (REKOMENDASI: cara wrapper, tanpa edit isi fungsi)
 *
 * Di file ROUTER Anda (Api.js → function dispatchV1_, blok ===== WRITES =====),
 * ada baris-baris seperti:  case 'submitPayment': return submitPayment(data);
 * GANTI 5 baris ini supaya memanggil versi *_bukti:
 *
 *   SEBELUM                                           SESUDAH
 *   case 'submitBooking':   return submitBooking(data);   -> return submitBooking_bukti(data);
 *   case 'submitPayment':   return submitPayment(data);   -> return submitPayment_bukti(data);
 *   case 'submitRefund':    return submitRefund(data);    -> return submitRefund_bukti(data);
 *   case 'submitStaffFee':  return submitStaffFee(data);  -> return submitStaffFee_bukti(data);
 *   case 'submitExpense':   return submitExpense(data);   -> return submitExpense_bukti(data);
 *
 * Cukup ubah bagian setelah "return" (nama action di 'case' biarkan sama).
 * Selesai — tidak perlu menyentuh isi fungsi submit yang asli.
 *
 * ---------------------------------------------------------------------
 * CARA B (alternatif) — kalau lebih suka tanpa wrapper:
 * Di tiap fungsi submit, tambahkan 1 baris tepat sebelum `return`-nya:
 *   submitPayment   : handleBukti_(data, 'PAYMENT', paymentId);
 *   submitBooking   : handleBukti_(data, 'BOOKING', bookingId);
 *   submitRefund    : handleBukti_(data, 'REFUND',  refundId);
 *   submitStaffFee  : handleBukti_(data, 'FEE',     feeId);
 *   submitExpense   : handleBukti_(data, 'EXPENSE', expenseId);
 * (ganti paymentId/bookingId/dst sesuai variabel id di fungsi Anda)
 *
 * CATATAN:
 * - Semua aman dipanggil walau tidak ada bukti (langsung return).
 * - Untuk BOOKING, pastikan SHEETS.BOOKINGS benar (lihat objek SHEETS; di B7 ada
 *   SHEETS.PAYMENTS/REFUNDS/FEES/EXPENSES). Kalau nama sheet booking beda, ubah
 *   baris BOOKING di config handleBukti_.
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
