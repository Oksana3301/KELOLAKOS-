/*******************************************************
 * SHEET CLEANUP (AMAN) — bantu merapikan tab tanpa menghilangkan data
 *
 * Fungsi:
 *   - listAllTabs()        : tampilkan semua tab + apakah dipakai aplikasi
 *   - deleteAuditTabs()    : hapus HANYA tab _AUDIT & _AUDIT_TGL (aman)
 *   - hideTabs([...])      : sembunyikan tab (REVERSIBLE, tidak hapus data)
 *   - unhideAllTabs()      : tampilkan lagi semua tab yang disembunyikan
 *
 * TIDAK ADA fungsi hapus-tab-data otomatis (sengaja, biar aman).
 * Untuk rename ke CAPS: WAJIB update objek SHEETS juga — lihat PANDUAN_SHEET_MASTER.md.
 *
 * Butuh SPREADSHEET_ID. Cara pakai: paste ke .gs, Save, pilih fungsi → Run.
 *******************************************************/

function _usedSheetSet_() {
  var used = {};
  try {
    if (typeof SHEETS !== 'undefined' && SHEETS) {
      Object.keys(SHEETS).forEach(function (k) { if (typeof SHEETS[k] === 'string') used[SHEETS[k]] = true; });
    }
  } catch (e) {}
  ['BOOKINGS','PAYMENTS','REFUNDS','FEES','EXPENSES','ROOMS','PRICES','ROOM_PRICE_RULES',
   'FASILITAS','ROOM_FACILITIES','KWITANSI_SETTINGS','BUILDING_LAYOUT']
    .forEach(function (n) { used[n] = used[n] || false; });
  return used;
}

/** Tampilkan semua tab + status dipakai/tidak. */
function listAllTabs() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var used = _usedSheetSet_();
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    var status = (n in used) ? 'DIPAKAI' : 'tidak dikenal';
    if (n === '_AUDIT' || n === '_AUDIT_TGL') status = 'tab audit (aman dihapus)';
    Logger.log('• ' + n + '  →  ' + status + (sh.isSheetHidden() ? ' [hidden]' : ''));
  });
  Logger.log('Selesai. (DIPAKAI = jangan hapus. tidak dikenal = cek dulu isinya.)');
}

/** Hapus HANYA tab audit yang aku buat (aman, tidak menyentuh data). */
function deleteAuditTabs() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ['_AUDIT', '_AUDIT_TGL'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh) { ss.deleteSheet(sh); Logger.log('Hapus tab: ' + n); }
  });
  Logger.log('Selesai.');
}

/**
 * Sembunyikan tab tertentu (REVERSIBLE — data tidak hilang). Untuk merapikan
 * tampilan tanpa risiko. Contoh: hideTabs(['Sheet1','CatatanLama']).
 */
function hideTabs(names) {
  if (!names || !names.length) { Logger.log('Isi daftar nama tab, mis. hideTabs(["Sheet1"]).'); return; }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  names.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh) { sh.hideSheet(); Logger.log('Sembunyikan: ' + n); }
    else Logger.log('Tidak ada tab bernama: ' + n);
  });
}

/** Tampilkan lagi semua tab yang disembunyikan. */
function unhideAllTabs() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.getSheets().forEach(function (sh) { if (sh.isSheetHidden()) { sh.showSheet(); Logger.log('Tampilkan: ' + sh.getName()); } });
  Logger.log('Selesai.');
}
