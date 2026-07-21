/*******************************************************************
 * BACKEND_DIAG_BOOKING_STATE.gs — Top Hills
 * =================================================================
 * READ-ONLY. Potret kondisi data booking apa adanya, untuk tahu KENAPA
 * booking tidak muncul di menu Kamar dashboard / ketersediaan /info.
 * TIDAK menampilkan nama/WA customer (privasi) — cukup status & kamar.
 *
 * Run: `diagBookingState` → cek View → Logs → paste hasilnya ke Claude.
 *******************************************************************/

function _dbsBookSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var names = ['BOOKINGS', 'Booking', 'Bookings'];
  for (var i = 0; i < names.length; i++) { var sh = ss.getSheetByName(names[i]); if (sh) return sh; }
  return null;
}

function diagBookingState() {
  var L = [];
  L.push('===== POTRET DATA BOOKING — ' + new Date() + ' =====');

  var sh = _dbsBookSheet_();
  if (!sh) { L.push('GAGAL: sheet booking tak ketemu.'); Logger.log(L.join('\n')); return L.join('\n'); }
  L.push('Sheet booking: "' + sh.getName() + '"');

  var data = sh.getDataRange().getValues();
  if (data.length < 2) { L.push('Sheet kosong.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var H = data[0].map(function (h) { return String(h); });
  var col = {};
  H.forEach(function (h, i) { if (col[h] === undefined) col[h] = i; });
  L.push('Total baris booking: ' + (data.length - 1));
  L.push('Kolom RoomID ada? ' + (col.RoomID !== undefined ? 'YA (kolom ke-' + (col.RoomID + 1) + ')' : 'TIDAK ADA'));
  L.push('Kolom CheckIn/CheckOut ada? ' + (col.CheckIn !== undefined ? 'CheckIn ok' : 'CheckIn TIDAK ADA') + ' / ' + (col.CheckOut !== undefined ? 'CheckOut ok' : 'CheckOut TIDAK ADA'));

  // Distribusi status
  var byBooking = {}, byBayar = {};
  var withRoomId = 0, withoutRoomId = 0;
  for (var i = 1; i < data.length; i++) {
    var sbk = String(col.Status_Booking !== undefined ? data[i][col.Status_Booking] : '').trim().toUpperCase() || '(kosong)';
    var sby = String(col.Status_Bayar !== undefined ? data[i][col.Status_Bayar] : '').trim().toUpperCase() || '(kosong)';
    byBooking[sbk] = (byBooking[sbk] || 0) + 1;
    byBayar[sby] = (byBayar[sby] || 0) + 1;
    var rid = String(col.RoomID !== undefined ? data[i][col.RoomID] : '').trim();
    if (rid) withRoomId++; else withoutRoomId++;
  }
  L.push('');
  L.push('Distribusi Status_Booking:');
  Object.keys(byBooking).forEach(function (k) { L.push('  ' + k + ' = ' + byBooking[k]); });
  L.push('Distribusi Status_Bayar:');
  Object.keys(byBayar).forEach(function (k) { L.push('  ' + k + ' = ' + byBayar[k]); });
  L.push('Punya RoomID: ' + withRoomId + ' | RoomID kosong: ' + withoutRoomId);

  // Daftar booking yang SEHARUSNYA memblok kamar (Lunas/DP, bukan batal/menunggu/selesai)
  L.push('');
  L.push('--- Booking yang SEHARUSNYA tampil di menu Kamar (Lunas/DP aktif) ---');
  var n = 0;
  for (var j = 1; j < data.length; j++) {
    var bk = String(col.Status_Booking !== undefined ? data[j][col.Status_Booking] : '').toUpperCase();
    var by = String(col.Status_Bayar !== undefined ? data[j][col.Status_Bayar] : '').toUpperCase();
    if (bk.indexOf('BATAL') >= 0 || bk.indexOf('CANCEL') >= 0 || bk.indexOf('TOLAK') >= 0 ||
        bk.indexOf('REJECT') >= 0 || bk.indexOf('SELESAI') >= 0 || bk.indexOf('MENUNGGU') >= 0) continue;
    var isPaid = by.indexOf('LUNAS') >= 0 || by.indexOf('DP') >= 0 || by.indexOf('PARSIAL') >= 0 ||
                 by.indexOf('SEBAGIAN') >= 0 || by.indexOf('CICIL') >= 0;
    if (!isPaid) continue;
    n++;
    if (n <= 60) {
      var rid2 = String(col.RoomID !== undefined ? data[j][col.RoomID] : '').trim() || '(RoomID KOSONG)';
      var kamar = String(col.Nama_Kamar !== undefined ? data[j][col.Nama_Kamar] : '');
      var ged = String(col.Gedung !== undefined ? data[j][col.Gedung] : '');
      var lay = String(col.Layanan !== undefined ? data[j][col.Layanan] : '');
      var ci = String(col.CheckIn !== undefined ? data[j][col.CheckIn] : '');
      var co = String(col.CheckOut !== undefined ? data[j][col.CheckOut] : '');
      L.push('  baris ' + (j + 1) + ' | RoomID=' + rid2 + ' | kamar="' + kamar + '" ged="' + ged +
        '" | ' + lay + ' | ' + bk + '/' + by + ' | CI=' + (ci || '-') + ' CO=' + (co || '-'));
    }
  }
  L.push('TOTAL booking Lunas/DP aktif: ' + n + (n > 60 ? ' (ditampilkan 60 pertama)' : ''));

  L.push('');
  L.push('===== SELESAI. Paste SEMUA teks ini ke Claude. =====');
  var out = L.join('\n');
  Logger.log(out);
  return out;
}
