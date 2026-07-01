/*******************************************************************
 * BACKEND_PATCH_BOOKING_ALL.gs — Top Hills (GABUNGAN, sekali paste)
 * =================================================================
 * Isi (semua yang MASIH pending untuk dashboard booking):
 *   1. getBookingFasilitas_   → badge fasilitas di kartu + flag "DP > pelunasan".
 *   2. editPendingBooking_multibukti_ → Ubah booking simpan SEMUA bukti (append) & nempel BookingID.
 *   3. Created_At / Updated_At → jejak waktu tiap booking (urutan terbaru + "Diperbarui").
 *
 * submitBookingEdit_fixed_ TIDAK ada di sini (kamu sudah deploy — biarkan).
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG (SEKALI, urut):                                    │
 * ├───────────────────────────────────────────────────────────────┤
 * │ 1) HAPUS file .gs lama ini kalau TERLANJUR di-paste (biar fungsi
 * │    tidak dobel): BACKEND_PATCH_BOOKING_FASILITAS_LIST.gs,
 * │    BACKEND_PATCH_EDIT_BOOKING_MULTIBUKTI.gs,
 * │    BACKEND_PATCH_BOOKING_TIMESTAMPS.gs. (Kalau belum pernah, skip.)
 * │
 * │ 2) Paste SELURUH file ini sebagai 1 file .gs BARU. Save.
 * │
 * │ 3) Di apiv2.gs → fungsi dispatchV2_ → pastikan 3 case ini ada
 * │    (ubah/tambah SEBELUM `default:`):
 * │      case 'getBookingFasilitas': return { ok: true, data: getBookingFasilitas_(payload) };
 * │      case 'editPendingBooking':  return editPendingBooking_multibukti_(payload);  // <- UBAH dari editPendingBooking
 * │      case 'submitBookingEdit':   return submitBookingEdit_fixed_(payload);        // (harusnya sudah ada)
 * │
 * │ 4) Di fungsi _setBookingStatus_ (apiv2.gs / patch Perpanjang),
 * │    TEPAT SEBELUM loop menulis updates, tambahkan 1 baris:
 * │      updates.Updated_At = new Date();
 * │
 * │ 5) Created_At saat CREATE:
 * │    a. submitBookingRequest → objek `vals` → tambah:  Created_At: new Date(),
 * │    b. submitBooking (dashboard) → set kolom Created_At = new Date() saat buat baris.
 * │       (Kalau lupa: backfillBookingCreatedAt() mengisi dari Timestamp.)
 * │
 * │ 6) Jalankan SEKALI dari editor:  setupBookingAll()  → lihat View → Logs.
 * │
 * │ 7) Deploy → Manage deployments → ✏️ Edit → New version → Deploy.
 * └───────────────────────────────────────────────────────────────┘
 * Frontend sudah siap & graceful — tanpa file ini pun app tetap jalan,
 * hanya badge fasilitas / flag DP-ketuker / edit-multibukti / timestamp
 * yang belum aktif.
 *******************************************************************/

/* ============================================================== *
 *  BAGIAN A — SETUP SEKALI JALAN                                  *
 * ============================================================== */
function setupBookingAll() {
  var log = [];
  try { log.push(ensureBookingTimestampCols_()); } catch (e) { log.push('kolom timestamp: ' + e); }
  try { log.push(backfillBookingCreatedAt()); } catch (e) { log.push('backfill: ' + e); }
  Logger.log(log.join('\n'));
  try { diagBookingFasilitas(); } catch (e) { Logger.log('diagBookingFasilitas: ' + e); }
  return 'Selesai — cek View → Logs.';
}

/* ============================================================== *
 *  BAGIAN 1 — FASILITAS DI KARTU + FLAG "DP > PELUNASAN"          *
 * ============================================================== */
var BK_FAS_CFG = {
  bookingSheet: 'Booking',
  fasilitasSheet: 'Fasilitas',
  idColumns: ['Fasilitas_IDs', 'Fasilitas_Ids', 'FasilitasIDs', 'Fasilitas_ID',
              'Fasilitas_Tambahan', 'Fasilitas', 'Add_Ons', 'Addons', 'Addon_IDs'],
  bookingIdColumns: ['BookingID', 'Booking_ID', 'ID'],
  mappingSheet: ['BookingFacilities', 'Booking_Fasilitas', 'BookingFasilitas', 'Booking_Facility'],
  mapBookingCol: ['booking_id', 'BookingID', 'Booking_ID'],
  mapFasilitasCol: ['fasilitas_id', 'Fasilitas_ID', 'fasilitas_ids', 'id'],
  maxNames: 6,
  paymentsSheet: ['Payments', 'Pembayaran', 'Payment', 'Pembayaran_Booking'],
  payBookingCol: ['booking_id', 'BookingID', 'Booking_ID', 'bookingId'],
  payJenisCol: ['jenis_bayar', 'Jenis_Bayar', 'jenis', 'tipe', 'kategori'],
  payTanggalCol: ['tanggal_bayar', 'Tanggal_Bayar', 'tgl_bayar', 'tanggal', 'date'],
};

function getBookingFasilitas_(payload) {
  var only = null;
  if (payload && payload.bookingIds && payload.bookingIds.length) {
    only = {};
    payload.bookingIds.forEach(function (id) { only[String(id).trim()] = true; });
  }
  var master = _bkFasMaster_();
  var perBooking = {};

  var sh = _bkSheet_(BK_FAS_CFG.bookingSheet);
  if (sh) {
    var headers = _bkHeaders_(sh);
    var idCol = _bkColIndex_(headers, BK_FAS_CFG.idColumns);
    var bIdCol = _bkColIndex_(headers, BK_FAS_CFG.bookingIdColumns);
    if (idCol !== -1 && bIdCol !== -1) {
      var vals = sh.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var bId = String(vals[i][bIdCol] || '').trim();
        if (!bId || (only && !only[bId])) continue;
        var toks = _bkSplit_(vals[i][idCol]);
        if (toks.length) perBooking[bId] = (perBooking[bId] || []).concat(toks);
      }
    }
  }

  var mapSh = _bkFirstSheet_(BK_FAS_CFG.mappingSheet);
  if (mapSh) {
    var mh = _bkHeaders_(mapSh);
    var mb = _bkColIndex_(mh, BK_FAS_CFG.mapBookingCol);
    var mf = _bkColIndex_(mh, BK_FAS_CFG.mapFasilitasCol);
    if (mb !== -1 && mf !== -1) {
      var mv = mapSh.getDataRange().getValues();
      for (var j = 1; j < mv.length; j++) {
        var mbId = String(mv[j][mb] || '').trim();
        if (!mbId || (only && !only[mbId])) continue;
        var mToks = _bkSplit_(mv[j][mf]);
        if (mToks.length) perBooking[mbId] = (perBooking[mbId] || []).concat(mToks);
      }
    }
  }

  var out = {};
  Object.keys(perBooking).forEach(function (bId) {
    var names = [], seen = {};
    perBooking[bId].forEach(function (tok) {
      var key = String(tok).trim();
      if (!key) return;
      var m = master[key.toLowerCase()];
      var nama = m ? (m.emoji ? (m.emoji + ' ' + m.nama) : m.nama) : key;
      var dk = nama.toLowerCase();
      if (seen[dk]) return;
      seen[dk] = true; names.push(nama);
    });
    if (!names.length) return;
    var shown = names.slice(0, BK_FAS_CFG.maxNames);
    var extra = names.length - shown.length;
    out[bId] = { count: names.length, names: names, ringkas: shown.join(' · ') + (extra > 0 ? ' (+' + extra + ')' : '') };
  });

  var issues = _bkDateIssues_(only);
  Object.keys(issues).forEach(function (bId) {
    if (out[bId]) out[bId].dateIssue = issues[bId];
    else out[bId] = { count: 0, names: [], ringkas: '', dateIssue: issues[bId] };
  });
  return out;
}

function _bkDateIssues_(only) {
  var res = {};
  var sh = _bkFirstSheet_(BK_FAS_CFG.paymentsSheet);
  if (!sh) return res;
  var headers = _bkHeaders_(sh);
  var bCol = _bkColIndex_(headers, BK_FAS_CFG.payBookingCol);
  var jCol = _bkColIndex_(headers, BK_FAS_CFG.payJenisCol);
  var tCol = _bkColIndex_(headers, BK_FAS_CFG.payTanggalCol);
  if (bCol === -1 || jCol === -1 || tCol === -1) return res;
  var vals = sh.getDataRange().getValues();
  var dp = {}, lunas = {};
  for (var i = 1; i < vals.length; i++) {
    var bId = String(vals[i][bCol] || '').trim();
    if (!bId || (only && !only[bId])) continue;
    var jenis = String(vals[i][jCol] || '').toUpperCase();
    var iso = _bkIso_(vals[i][tCol]);
    if (!iso) continue;
    if (/DP|MUKA/.test(jenis)) { if (!dp[bId] || iso < dp[bId]) dp[bId] = iso; }
    else if (/LUNAS|PELUNAS/.test(jenis)) { if (!lunas[bId] || iso > lunas[bId]) lunas[bId] = iso; }
  }
  Object.keys(dp).forEach(function (bId) {
    if (lunas[bId] && dp[bId] > lunas[bId]) res[bId] = 'DP setelah pelunasan (urutan tanggal ketuker)';
  });
  return res;
}
function _bkIso_(v) {
  if (v == null || v === '') return '';
  var d = (v instanceof Date) ? v : new Date(String(v));
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd');
}
function diagBookingFasilitas() {
  var sh = _bkSheet_(BK_FAS_CFG.bookingSheet);
  if (!sh) { Logger.log('❌ Sheet "%s" tidak ada.', BK_FAS_CFG.bookingSheet); return; }
  var headers = _bkHeaders_(sh);
  Logger.log('Header Booking: %s', headers.join(' | '));
  Logger.log('Kolom fasilitas: %s', _bkColIndex_(headers, BK_FAS_CFG.idColumns) === -1 ? '(TIDAK ADA)' : 'OK');
  var res = getBookingFasilitas_({});
  Logger.log('Total booking dgn fasilitas/flag: %s', Object.keys(res).length);
}
function _bkSheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function _bkFirstSheet_(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < names.length; i++) { var s = ss.getSheetByName(names[i]); if (s) return s; }
  return null;
}
function _bkHeaders_(sh) { return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h); }); }
function _bkLc_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function _bkColIndex_(headers, names) {
  var hLc = headers.map(_bkLc_);
  for (var i = 0; i < names.length; i++) { var idx = hLc.indexOf(_bkLc_(names[i])); if (idx !== -1) return idx; }
  return -1;
}
function _bkSplit_(cell) {
  if (cell == null) return [];
  return String(cell).split(/[,;|]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
}
function _bkFasMaster_() {
  var map = {};
  var sh = _bkSheet_(BK_FAS_CFG.fasilitasSheet);
  if (!sh) return map;
  var headers = _bkHeaders_(sh);
  var idC = _bkColIndex_(headers, ['id', 'fasilitas_id', 'ID']);
  var namaC = _bkColIndex_(headers, ['nama', 'name', 'Nama']);
  var emojiC = _bkColIndex_(headers, ['emoji', 'icon']);
  if (namaC === -1) return map;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var nama = String(vals[i][namaC] || '').trim();
    if (!nama) continue;
    var rec = { nama: nama, emoji: emojiC !== -1 ? String(vals[i][emojiC] || '').trim() : '' };
    if (idC !== -1) { var id = String(vals[i][idC] || '').trim(); if (id) map[id.toLowerCase()] = rec; }
    map[nama.toLowerCase()] = rec;
  }
  return map;
}

/* ============================================================== *
 *  BAGIAN 2 — UBAH BOOKING SIMPAN SEMUA BUKTI (append, by ID)     *
 * ============================================================== */
function editPendingBooking_multibukti_(data) {
  data = data || {};
  var res = editPendingBooking(data); // edit normal + hapusBukti (kosongkan Bukti_Bayar)
  var id = String(data.bookingId || data.booking_id || '').trim();
  if (!id) return res;
  try {
    if (data.hapusBukti) {
      if (typeof _setBookingStatus_ === 'function') _setBookingStatus_(id, { Bukti_URLs: '' });
      return res;
    }
    var files = data.bukti_files || data.buktiFiles;
    if (files && files.length && typeof saveBuktiFiles_ === 'function') {
      var newUrls = saveBuktiFiles_(files, 'Booking', id) || [];
      var row = (typeof _bookingFindById_ === 'function') ? (_bookingFindById_(id) || {}) : {};
      var existing = String(row.Bukti_URLs || '').split(/[\s,;|]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      var merged = existing.concat(newUrls);
      var seen = {}, dedup = [];
      merged.forEach(function (u) { if (u && !seen[u]) { seen[u] = 1; dedup.push(u); } });
      var updates = { Bukti_URLs: dedup.join('\n') };
      if (!String(row.Bukti_Bayar || '').trim() && dedup.length) updates.Bukti_Bayar = dedup[0];
      if (typeof _setBookingStatus_ === 'function') _setBookingStatus_(id, updates);
    }
  } catch (e) { Logger.log('editPendingBooking_multibukti_ bukti gagal: ' + e); }
  return res;
}

/* ============================================================== *
 *  BAGIAN 3 — Created_At / Updated_At                             *
 * ============================================================== */
var BK_TS_SHEET = 'Booking';

function ensureBookingTimestampCols_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BK_TS_SHEET);
  if (!sh) throw new Error('Sheet "' + BK_TS_SHEET + '" tidak ada');
  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h); });
  ['Created_At', 'Updated_At'].forEach(function (col) {
    if (headers.indexOf(col) === -1) { sh.getRange(1, headers.length + 1).setValue(col); headers.push(col); }
  });
  return 'OK — kolom Created_At & Updated_At siap.';
}

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
    if (String(data[i][cCreated] || '').trim() !== '') continue;
    var val = (cTs !== -1 && data[i][cTs]) ? data[i][cTs] : new Date();
    sh.getRange(i + 1, cCreated + 1).setValue(val);
    n++;
  }
  return 'Backfill Created_At: ' + n + ' baris.';
}
