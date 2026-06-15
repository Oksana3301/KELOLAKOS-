/*******************************************************
 * AUDIT SHEETS — bantu rapikan tab Google Sheet KelolaKos
 *
 * Tujuan: kasih tahu tab mana yang BENAR-BENAR dipakai aplikasi (dibaca/ditulis)
 * vs tab yang tidak dikenal — supaya Anda gampang memutuskan mana yang aman
 * dibereskan. TIDAK ADA yang dihapus otomatis (aman). Penghapusan tetap manual.
 *
 * CARA PAKAI:
 *   1) Paste seluruh file ini ke salah satu file .gs backend Anda
 *      (mis. TopHillsLogic.gs), Save.
 *   2) Pilih fungsi `auditSheets` di dropdown atas → Run.
 *   3) Buka Execution log (View → Logs / Ctrl+Enter) → baca laporannya.
 *      (Atau buka tab baru "_AUDIT" yang otomatis dibuat berisi tabel ringkas.)
 *
 * Catatan: butuh konstanta SPREADSHEET_ID. Kalau backend Anda belum punya,
 * paste juga baris ini di salah satu .gs:
 *   var SPREADSHEET_ID = '1TjTgYh8UFnvIMWkP1uTYVVYBzREFynyIjlfiPXT51QI';
 *******************************************************/

/**
 * Daftar tab yang DIPAKAI aplikasi. Sumber utama: objek SHEETS milik backend
 * Anda (kalau ada). Plus daftar cadangan nama-nama umum yang dipakai app.
 * Sesuaikan/ tambah kalau ada nama tab khusus Anda.
 */
function _knownUsedSheetNames_() {
  var used = {};

  // 1) Ambil dari objek SHEETS backend kalau tersedia (paling akurat).
  try {
    if (typeof SHEETS !== 'undefined' && SHEETS) {
      Object.keys(SHEETS).forEach(function (k) {
        var v = SHEETS[k];
        if (typeof v === 'string' && v) used[v] = 'SHEETS.' + k;
      });
    }
  } catch (e) { /* abaikan */ }

  // 2) Daftar cadangan (kalau SHEETS tidak ada / belum lengkap).
  //    Sesuaikan nama persis dengan tab Anda bila berbeda.
  var fallback = [
    'BOOKINGS', 'PAYMENTS', 'REFUNDS', 'FEES', 'EXPENSES',
    'ROOMS', 'KAMAR', 'ROOM_STATUS',
    'PRICES', 'HARGA', 'PRICE_SETTING', 'ROOM_PRICE_RULES',
    'FASILITAS', 'FACILITIES', 'ROOM_FACILITIES',
    'KWITANSI', 'KWITANSI_SETTINGS', 'SETTINGS',
    'BUILDING_LAYOUT', 'LAYOUT', 'PENGHUNI'
  ];
  fallback.forEach(function (n) { if (!(n in used)) used[n] = '(daftar cadangan)'; });

  return used;
}

/**
 * Jalankan ini. Membuat/menyegarkan tab "_AUDIT" + menulis laporan ke Logger.
 */
function auditSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var used = _knownUsedSheetNames_();
  var sheets = ss.getSheets();

  var rows = [['Nama Tab', 'Baris Data', 'Kolom', 'Status', 'Keterangan']];
  var summary = { used: 0, unknown: 0, empty: 0 };

  Logger.log('=== AUDIT TAB SHEET: ' + ss.getName() + ' ===');
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var name = sh.getName();
    if (name === '_AUDIT') continue; // jangan audit tab audit sendiri

    var dataRows = Math.max(0, sh.getLastRow() - 1);
    var cols = sh.getLastColumn();
    var isUsed = (name in used);
    var status = isUsed ? 'DIPAKAI' : 'TIDAK DIKENAL';
    var ket = isUsed ? used[name] : 'tidak terdeteksi dipakai app';
    if (dataRows === 0) { status += ' · KOSONG'; summary.empty++; }

    if (isUsed) summary.used++; else summary.unknown++;
    rows.push([name, dataRows, cols, status, ket]);
    Logger.log(
      '• ' + name + '  | baris=' + dataRows + ' kolom=' + cols + ' | ' + status + ' | ' + ket
    );
  }

  Logger.log(
    '--- RINGKASAN: ' + summary.used + ' dipakai, ' + summary.unknown +
    ' tidak dikenal, ' + summary.empty + ' kosong. Total tab: ' + (sheets.length) + ' ---'
  );
  Logger.log('Tab "TIDAK DIKENAL" = kandidat untuk Anda rapikan (CEK DULU isinya sebelum hapus).');

  // Tulis tabel ke tab _AUDIT supaya gampang dibaca tanpa buka Logger.
  var out = ss.getSheetByName('_AUDIT');
  if (!out) out = ss.insertSheet('_AUDIT');
  out.clearContents();
  out.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  out.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  out.setFrozenRows(1);
  try { out.autoResizeColumns(1, rows[0].length); } catch (e) {}

  SpreadsheetApp.flush();
  return { summary: summary, totalTabs: sheets.length };
}

/*******************************************************
 * REFERENSI — tab yang dipakai aplikasi KelolaKos (per fitur)
 * (untuk Anda bandingkan saat merapikan)
 * ------------------------------------------------------
 *  - BOOKINGS            : data booking/penyewa (Beranda, Booking, Kwitansi)
 *  - PAYMENTS            : pembayaran masuk (Uang, Laporan)
 *  - REFUNDS            : pengembalian uang (Uang, Laporan)
 *  - FEES               : fee/gaji penjaga (Uang, Laporan)
 *  - EXPENSES           : belanja operasional (Uang, Laporan)
 *  - (master kamar)     : daftar kamar/status (Kamar, Layout, picker Booking)
 *  - (harga / PRICES)   : Harga Umum + Harga Massal (Pengaturan → harga, Booking)
 *  - (room price rules) : harga khusus per kamar
 *  - (FASILITAS)        : daftar fasilitas + harga (Pengaturan, add-on Booking)
 *  - (KWITANSI settings): profil bisnis/kwitansi (Pengaturan, Kwitansi)
 *  - (building layout)  : Layout Properti (opsional)
 *  - License Master     : SPREADSHEET TERPISAH (kode akses) — bukan di sini
 *
 * Tab di luar daftar ini kemungkinan besar TIDAK dipakai app. Tapi tetap
 * CEK ISINYA dulu sebelum dihapus — bisa jadi catatan manual Anda sendiri.
 *******************************************************/
