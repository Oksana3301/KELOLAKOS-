/*******************************************************************
 * BACKEND_DIAG_ROOMID_MISSING.gs — Top Hills
 * =================================================================
 * Diagnostik READ-ONLY: cari booking AKTIF (Lunas/DP) yang RoomID-nya
 * kosong — inilah yang bikin menu Kamar dashboard tidak menghitung
 * booking itu sebagai "terisi/DP" (booking di-skip kalau RoomID kosong,
 * lihat src/app/kamar/page.tsx: `if (!b.RoomID) return;`).
 *
 * TIDAK MENGUBAH DATA. Cuma Logger.log(...) + return ringkasan.
 *
 * CARA PAKAI:
 *   1) Tempel file ini ke project Apps Script.
 *   2) Run fungsi `diagBookingRoomIdMissing` → cek Logs (View → Logs).
 *   3) Paste hasil Logs ke Claude untuk lanjut ke langkah backfill.
 *******************************************************************/

function _drmBookSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var names = ['BOOKINGS', 'Booking', 'Bookings'];
  for (var i = 0; i < names.length; i++) { var sh = ss.getSheetByName(names[i]); if (sh) return sh; }
  return null;
}

function _drmIsAktifBayar_(statusBooking, statusBayar) {
  var sb = String(statusBooking || '').toUpperCase();
  if (sb.indexOf('BATAL') >= 0 || sb.indexOf('CANCEL') >= 0) return false;
  if (sb.indexOf('TOLAK') >= 0 || sb.indexOf('REJECT') >= 0) return false;
  if (sb.indexOf('SELESAI') >= 0) return false;
  var bayar = String(statusBayar || '').toUpperCase();
  return bayar.indexOf('LUNAS') >= 0 || bayar.indexOf('DP') >= 0 ||
    bayar.indexOf('PARSIAL') >= 0 || bayar.indexOf('SEBAGIAN') >= 0 || bayar.indexOf('CICIL') >= 0;
}

function diagBookingRoomIdMissing() {
  var L = [];
  L.push('===== DIAG RoomID KOSONG — ' + new Date() + ' =====');

  var sh = _drmBookSheet_();
  if (!sh) { L.push('GAGAL: sheet booking tak ketemu.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var data = sh.getDataRange().getValues();
  if (data.length < 2) { L.push('Sheet booking kosong.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var H = data[0].map(function (h) { return String(h); });
  var col = {};
  H.forEach(function (h, i) { col[h] = i; });
  var need = ['BookingID', 'RoomID', 'Nama_Kamar', 'Gedung', 'Status_Booking', 'Status_Bayar'];
  var missing = need.filter(function (k) { return col[k] === undefined; });
  if (missing.length) L.push('⚠️ Kolom tak ketemu di sheet: ' + missing.join(', '));

  // Rooms sheet — untuk cek apakah Nama_Kamar+Gedung punya padanan RoomID yang jelas.
  var roomsByKey = {};
  var roomsSheet = null;
  ['Rooms', 'ROOMS', 'Kamar', 'KAMAR'].some(function (n) {
    var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
    if (s) { roomsSheet = s; return true; }
    return false;
  });
  if (roomsSheet) {
    var rd = roomsSheet.getDataRange().getValues();
    var rh = rd[0].map(function (h) { return String(h); });
    var rIdCol = rh.indexOf('RoomID');
    var rNamaCol = rh.indexOf('Nama_Kamar');
    var rGedungCol = rh.indexOf('Gedung');
    if (rIdCol >= 0 && rNamaCol >= 0) {
      for (var k = 1; k < rd.length; k++) {
        var key = String(rd[k][rNamaCol] || '').trim().toLowerCase() + '|' +
          String(rGedungCol >= 0 ? rd[k][rGedungCol] : '' || '').trim().toLowerCase();
        roomsByKey[key] = rd[k][rIdCol];
      }
    }
  } else {
    L.push('(Catatan: sheet Rooms/Kamar tak ketemu dengan nama umum — lewati cek padanan otomatis.)');
  }

  var kosong = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var statusBooking = col.Status_Booking !== undefined ? row[col.Status_Booking] : '';
    var statusBayar = col.Status_Bayar !== undefined ? row[col.Status_Bayar] : '';
    if (!_drmIsAktifBayar_(statusBooking, statusBayar)) continue;

    var roomId = col.RoomID !== undefined ? String(row[col.RoomID] || '').trim() : '';
    if (roomId) continue; // sudah ada RoomID → aman, skip

    var nama = col.Nama_Kamar !== undefined ? String(row[col.Nama_Kamar] || '').trim() : '';
    var gedung = col.Gedung !== undefined ? String(row[col.Gedung] || '').trim() : '';
    var key = nama.toLowerCase() + '|' + gedung.toLowerCase();
    var match = roomsByKey[key] || '';

    kosong.push({
      row: i + 1,
      bookingId: col.BookingID !== undefined ? row[col.BookingID] : '',
      nama: nama,
      gedung: gedung,
      statusBooking: statusBooking,
      statusBayar: statusBayar,
      roomIdMatch: match || '(TIDAK KETEMU padanan otomatis — perlu cek manual)',
    });
  }

  L.push('');
  L.push('Booking AKTIF (Lunas/DP) dengan RoomID KOSONG: ' + kosong.length);
  L.push('→ Ini penyebab menu Kamar dashboard tidak menganggap kamar ini terisi.');
  kosong.forEach(function (b) {
    L.push('  · baris ' + b.row + ' | ' + b.bookingId + ' | kamar="' + b.nama + '" gedung="' + b.gedung +
      '" | ' + b.statusBooking + '/' + b.statusBayar + ' | padanan RoomID: ' + b.roomIdMatch);
  });

  L.push('');
  L.push('===== SELESAI. Paste teks ini ke Claude untuk lanjut ke perbaikan (backfill RoomID). =====');
  var out = L.join('\n');
  Logger.log(out);
  return out;
}
