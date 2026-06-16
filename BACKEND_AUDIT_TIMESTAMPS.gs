/*******************************************************
 * AUDIT TIMESTAMP — pastikan semua data punya tanggal (biar filter periode akurat)
 *
 * Tujuan: cek tiap sheet data (BOOKINGS/PAYMENTS/REFUNDS/FEES/EXPENSES, dll.)
 * apakah ada kolom TANGGAL dan apakah semua baris terisi tanggalnya. Kalau ada
 * baris yang kosong tanggalnya, baris itu tidak akan muncul saat Anda filter
 * "Hari Ini / Minggu Ini / Bulan Ini / Tahun Ini".
 *
 * NON-DESTRUKTIF — hanya membaca & melapor. Tidak mengubah/menghapus apa pun.
 *
 * CARA PAKAI:
 *   1) Paste file ini ke salah satu .gs backend (mis. TopHillsLogic.gs). Save.
 *   2) Pilih fungsi `auditTimestamps` → Run.
 *   3) Buka Execution log (Ctrl+Enter) ATAU lihat tab "_AUDIT_TGL" yang dibuat.
 *
 * Butuh konstanta SPREADSHEET_ID (kalau belum ada, tambahkan:
 *   var SPREADSHEET_ID = '1TjTgYh8UFnvIMWkP1uTYVVYBzREFynyIjlfiPXT51QI';
 * )
 *
 * CATATAN PENTING tentang FILTER PERIODE:
 *   Aplikasi mengirim rentang tanggal (start, end) ke getReportData(start,end).
 *   Backend HARUS memfilter transaksi berdasarkan KOLOM TANGGAL tiap baris yang
 *   ada di dalam [start, end]. Jadi pastikan:
 *     (a) setiap submit menulis tanggal saat baris dibuat (lihat di bawah),
 *     (b) getReportData membandingkan kolom tanggal itu ke rentang yang diminta.
 *******************************************************/

// Sheet yang relevan untuk filter periode + nama kolom tanggal yang dipakai
// untuk memfilter (tebakan umum; auto-deteksi kalau tidak ketemu).
function _tsTargets_() {
  function S(key, fallback) {
    try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS[key]) return SHEETS[key]; } catch (e) {}
    return fallback;
  }
  return [
    { sheet: S('BOOKINGS', 'BOOKINGS'), label: 'Booking', dateHints: ['Timestamp', 'Tanggal', 'Created', 'Check_In', 'CheckIn'] },
    { sheet: S('PAYMENTS', 'PAYMENTS'), label: 'Pembayaran', dateHints: ['Tanggal_Bayar', 'Tanggal', 'Timestamp', 'Date'] },
    { sheet: S('REFUNDS', 'REFUNDS'), label: 'Refund', dateHints: ['Tanggal_Refund', 'Tanggal', 'Timestamp', 'Date'] },
    { sheet: S('FEES', 'FEES'), label: 'Fee Penjaga', dateHints: ['Tanggal', 'Timestamp', 'Date'] },
    { sheet: S('EXPENSES', 'EXPENSES'), label: 'Belanja', dateHints: ['Tanggal', 'Timestamp', 'Date'] },
  ];
}

function _looksLikeDate_(v) {
  if (v === '' || v === null || v === undefined) return false;
  if (Object.prototype.toString.call(v) === '[object Date]') return !isNaN(v.getTime());
  var d = new Date(v);
  return !isNaN(d.getTime()) && String(v).length >= 6;
}

// Cari index kolom tanggal: cocokkan header dengan hint, kalau gagal pilih kolom
// yang isinya paling banyak terbaca sebagai tanggal.
function _findDateCol_(header, rows, hints) {
  for (var h = 0; h < hints.length; h++) {
    var idx = header.indexOf(hints[h]);
    if (idx >= 0) return { idx: idx, name: header[idx], how: 'header' };
  }
  // auto-deteksi
  var best = -1, bestScore = 0, bestName = '';
  for (var c = 0; c < header.length; c++) {
    var ok = 0, tot = 0;
    for (var r = 1; r < rows.length; r++) {
      if (rows[r][c] !== '' && rows[r][c] !== null && rows[r][c] !== undefined) {
        tot++;
        if (_looksLikeDate_(rows[r][c])) ok++;
      }
    }
    var score = tot > 0 ? ok / tot : 0;
    if (score > bestScore && ok >= 1) { bestScore = score; best = c; bestName = header[c]; }
  }
  return best >= 0 && bestScore >= 0.5 ? { idx: best, name: bestName, how: 'auto' } : null;
}

function auditTimestamps() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var targets = _tsTargets_();
  var out = [['Sheet', 'Label', 'Kolom Tanggal', 'Baris Data', 'Ada Tanggal', 'KOSONG Tanggal', 'Status']];

  Logger.log('=== AUDIT TIMESTAMP ===');
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var sh = ss.getSheetByName(t.sheet);
    if (!sh) {
      out.push([t.sheet, t.label, '-', 0, 0, 0, 'SHEET TIDAK ADA']);
      Logger.log('• ' + t.label + ' (' + t.sheet + '): SHEET TIDAK ADA');
      continue;
    }
    var rows = sh.getDataRange().getValues();
    var header = rows[0] || [];
    var dc = _findDateCol_(header, rows, t.dateHints);
    if (!dc) {
      out.push([t.sheet, t.label, 'TIDAK DITEMUKAN', Math.max(0, rows.length - 1), 0, 0, 'TANPA KOLOM TANGGAL ⚠️']);
      Logger.log('• ' + t.label + ': tidak ada kolom tanggal → filter periode tidak akan akurat ⚠️');
      continue;
    }
    var total = 0, withDate = 0;
    for (var r = 1; r < rows.length; r++) {
      var hasAny = rows[r].some(function (x) { return x !== '' && x !== null && x !== undefined; });
      if (!hasAny) continue; // baris kosong
      total++;
      if (_looksLikeDate_(rows[r][dc.idx])) withDate++;
    }
    var missing = total - withDate;
    var status = missing === 0 ? 'OK ✓' : (missing + ' baris tanpa tanggal ⚠️');
    out.push([t.sheet, t.label, dc.name + (dc.how === 'auto' ? ' (auto)' : ''), total, withDate, missing, status]);
    Logger.log('• ' + t.label + ' | kolom="' + dc.name + '" | total=' + total + ' adaTgl=' + withDate + ' kosong=' + missing + ' | ' + status);
  }

  var sheet = ss.getSheetByName('_AUDIT_TGL') || ss.insertSheet('_AUDIT_TGL');
  sheet.clearContents();
  sheet.getRange(1, 1, out.length, out[0].length).setValues(out);
  sheet.getRange(1, 1, 1, out[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, out[0].length); } catch (e) {}
  SpreadsheetApp.flush();
  Logger.log('Selesai. Lihat tab "_AUDIT_TGL". Baris dengan "tanpa tanggal" tidak akan muncul saat difilter periode.');
}

/*******************************************************
 * CHECKLIST agar setiap data tercatat tanggalnya
 * ------------------------------------------------------
 * Di tiap fungsi submit backend, pastikan menulis kolom tanggal saat append:
 *   - submitBooking   : sudah (kolom Timestamp = new Date()). ✓
 *   - submitPayment   : tulis Tanggal_Bayar (pakai data.tanggal_bayar ATAU new Date()).
 *   - submitRefund    : tulis Tanggal_Refund (data.tanggal_refund ATAU new Date()).
 *   - submitStaffFee  : tulis Tanggal (data.tanggal ATAU new Date()).
 *   - submitExpense   : tulis Tanggal (data.tanggal ATAU new Date()).
 *
 * Contoh aman (selalu ada tanggal walau frontend tidak mengirim):
 *   var tgl = data.tanggal_bayar || data.tanggal || Utilities.formatDate(
 *       new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd');
 *
 * Lalu di getReportData(start,end): filter baris yang tanggalnya >= start && <= end.
 *
 * Frontend sudah mengirim rentang tanggal yang benar untuk tiap preset
 * (Hari Ini / Minggu Ini / Bulan Ini / Tahun Ini) — tinggal pastikan backend
 * menyimpan & memfilter berdasarkan tanggal di atas.
 *******************************************************/
