/**
 * BACKEND_PATCH_BOOKING_FASILITAS_LIST.gs — Top Hills
 * ---------------------------------------------------
 * Tujuan: kirim RINGKASAN FASILITAS per booking ke daftar /booking, supaya
 * fasilitas yang dipilih penyewa tampil LANGSUNG di tiap kartu (tanpa harus
 * buka detail). Aman & additive — TIDAK mengubah getInitialData /
 * getBookingDetail / submitBooking. Kalau sumber data tak ketemu, hasilnya
 * map kosong → kartu tetap normal (tidak ada yang rusak).
 *
 * ════════════════════ LOKASI / CARA PASANG ════════════════════
 * 1) Paste file ini sebagai file .gs BARU di project Apps Script yang sama
 *    dengan backend kamu (sebelah APIV2_SIAP_PASTE.gs).
 *
 * 2) Wiring 1 baris di dispatcher V2. Buka apiv2.gs (APIV2_SIAP_PASTE.gs) →
 *    fungsi dispatchV2_(action, payload) → di dalam switch(action), tambahkan
 *    1 case (sejajar case 'getPublicRooms' / 'getInitialData' lainnya):
 *
 *        case 'getBookingFasilitas':
 *          return { ok: true, data: getBookingFasilitas_(payload) };
 *
 *    (Action ini internal-owner: tetap lewat apiKey seperti action lain,
 *     TIDAK butuh accessCode khusus.)
 *
 * 3) Deploy → Manage deployments → Edit deployment aktif → Version: New version
 *    → Deploy. (URL /exec tidak berubah.)
 *
 * 4) PENTING — pastikan sumbernya kebaca: jalankan sekali diagBookingFasilitas()
 *    lalu lihat View → Logs. Outputnya memberi tahu kolom/sheet mana yang
 *    terbaca + contoh hasil. Kalau kosong, sesuaikan BK_FAS_CFG di bawah
 *    (idColumns / mappingSheet) sesuai struktur sheet Booking kamu.
 * ═══════════════════════════════════════════════════════════════
 */

var BK_FAS_CFG = {
  bookingSheet: 'Booking',
  fasilitasSheet: 'Fasilitas', // master fasilitas (kolom: id, kode, nama, emoji, …)

  // Kolom di sheet Booking yang menyimpan daftar fasilitas booking (boleh berisi
  // ID atau langsung nama), dipisah koma / titik-koma / pipa. Dicoba berurutan,
  // case-insensitive. Tambah nama kolommu di sini bila beda.
  idColumns: ['Fasilitas_IDs', 'Fasilitas_Ids', 'FasilitasIDs', 'Fasilitas_ID',
              'Fasilitas_Tambahan', 'Fasilitas', 'Add_Ons', 'Addons', 'Addon_IDs'],
  bookingIdColumns: ['BookingID', 'Booking_ID', 'ID'],

  // Fallback: sheet pemetaan (1 baris per fasilitas per booking).
  mappingSheet: ['BookingFacilities', 'Booking_Fasilitas', 'BookingFasilitas', 'Booking_Facility'],
  mapBookingCol: ['booking_id', 'BookingID', 'Booking_ID'],
  mapFasilitasCol: ['fasilitas_id', 'Fasilitas_ID', 'fasilitas_ids', 'id'],

  maxNames: 6, // batasi panjang ringkasan; sisanya jadi "(+N)"
};

/**
 * Map BookingID → { count, names:[...], ringkas:"AC · TV (+1)" }.
 * payload (opsional): { bookingIds: [...] } untuk membatasi (default: semua).
 */
function getBookingFasilitas_(payload) {
  var only = null;
  if (payload && payload.bookingIds && payload.bookingIds.length) {
    only = {};
    payload.bookingIds.forEach(function (id) { only[String(id).trim()] = true; });
  }

  var master = _bkFasMaster_();          // idLc → {nama, emoji}; namaLc → {nama, emoji}
  var perBooking = {};                    // bookingId → [tokens]

  // (A) Dari kolom di sheet Booking.
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

  // (B) Fallback / tambahan: sheet pemetaan.
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

  // Susun hasil: token → nama (resolve via master bila itu ID), dedupe, ringkas.
  var out = {};
  Object.keys(perBooking).forEach(function (bId) {
    var names = [];
    var seen = {};
    perBooking[bId].forEach(function (tok) {
      var key = String(tok).trim();
      if (!key) return;
      var m = master[key.toLowerCase()];
      var nama = m ? (m.emoji ? (m.emoji + ' ' + m.nama) : m.nama) : key;
      var dk = nama.toLowerCase();
      if (seen[dk]) return;
      seen[dk] = true;
      names.push(nama);
    });
    if (!names.length) return;
    var shown = names.slice(0, BK_FAS_CFG.maxNames);
    var extra = names.length - shown.length;
    out[bId] = {
      count: names.length,
      names: names,
      ringkas: shown.join(' · ') + (extra > 0 ? ' (+' + extra + ')' : ''),
    };
  });
  return out;
}

/** Diagnostik: pastikan sumber fasilitas booking kebaca. Lihat View → Logs. */
function diagBookingFasilitas() {
  var sh = _bkSheet_(BK_FAS_CFG.bookingSheet);
  if (!sh) { Logger.log('❌ Sheet "%s" tidak ada.', BK_FAS_CFG.bookingSheet); return; }
  var headers = _bkHeaders_(sh);
  var idCol = _bkColIndex_(headers, BK_FAS_CFG.idColumns);
  var bIdCol = _bkColIndex_(headers, BK_FAS_CFG.bookingIdColumns);
  Logger.log('Header sheet Booking: %s', headers.join(' | '));
  Logger.log('Kolom fasilitas terdeteksi: %s', idCol === -1 ? '(TIDAK ADA — sesuaikan BK_FAS_CFG.idColumns)' : headers[idCol]);
  Logger.log('Kolom BookingID terdeteksi: %s', bIdCol === -1 ? '(TIDAK ADA)' : headers[bIdCol]);
  var mapSh = _bkFirstSheet_(BK_FAS_CFG.mappingSheet);
  Logger.log('Sheet pemetaan: %s', mapSh ? mapSh.getName() : '(tidak ada — pakai kolom Booking saja)');
  var res = getBookingFasilitas_({});
  var keys = Object.keys(res);
  Logger.log('Total booking dengan fasilitas: %s', keys.length);
  keys.slice(0, 5).forEach(function (k) { Logger.log('  %s → %s', k, res[k].ringkas); });
  if (!keys.length) Logger.log('⚠️ Kosong. Cek nama kolom fasilitas di sheet Booking, lalu tambahkan ke BK_FAS_CFG.idColumns.');
}

/* ───────────────── helpers (prefix _bk* agar tak bentrok) ───────────────── */
function _bkSheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function _bkFirstSheet_(names) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < names.length; i++) { var s = ss.getSheetByName(names[i]); if (s) return s; }
  return null;
}
function _bkHeaders_(sh) {
  return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h); });
}
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
// Master fasilitas → key (id ATAU nama, lowercased) → {nama, emoji}.
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
    map[nama.toLowerCase()] = rec; // supaya token yang sudah berupa nama juga cocok
  }
  return map;
}
