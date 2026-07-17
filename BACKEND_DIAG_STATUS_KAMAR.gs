/*******************************************************************
 * BACKEND_DIAG_STATUS_KAMAR.gs — Top Hills
 * =================================================================
 * DIAGNOSTIK read-only (TIDAK mengubah data apa pun): cari booking yang bikin
 * status kamar di /info salah, terkait 2 temuan sesi 17 Jul 2026
 * (docs/SESI_HANDOFF.md §14):
 *
 *  Temuan A — booking PENGINAPAN (Gedung C) yang aktif tapi CheckOut KOSONG.
 *             Akibat: frontend anggap kamar itu terblokir SELAMANYA di semua
 *             tanggal (/info tak bisa cek ketersediaan Gedung C ke depan).
 *  Temuan B — booking KOST (Gedung A/B) berstatus DP tapi CheckIn KOSONG.
 *             (Sudah ditambal di frontend — kamar ini tetap tampil kuning/DP,
 *             bukan salah kosong — tapi baiknya tetap dirapikan di sumbernya.)
 *
 * CARA PAKAI:
 *  1) Paste file ini sebagai .gs BARU. Save.
 *  2) Pilih fungsi `diagBookingTanpaTanggal` → Run → lihat Logs (Ctrl+Enter).
 *  3) Paste SEMUA teks Logs ke Claude, atau langsung ikuti instruksi per baris:
 *     - Temuan A: buka sheet BOOKINGS, cari BookingID yang disebut → isi kolom
 *       `CheckOut` (tanggal tamu keluar), ATAU kalau tamu SUDAH checkout →
 *       ubah `Status_Booking` jadi SELESAI.
 *     - Temuan B: isi kolom `CheckIn` booking itu (tanggal mulai sewa).
 *******************************************************************/

function _dsBookSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var names = ['BOOKINGS', 'Booking', 'Bookings'];
  for (var i = 0; i < names.length; i++) { var sh = ss.getSheetByName(names[i]); if (sh) return sh; }
  var all = ss.getSheets();
  for (var j = 0; j < all.length; j++) {
    var lc = all[j].getLastColumn(); if (lc < 1) continue;
    var H = all[j].getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h); });
    if (H.indexOf('BookingID') >= 0) return all[j];
  }
  return null;
}

function _dsIsAktif_(statusBooking) {
  var s = String(statusBooking || '').toUpperCase();
  if (s.indexOf('BATAL') >= 0 || s.indexOf('CANCEL') >= 0) return false;
  if (s.indexOf('TOLAK') >= 0 || s.indexOf('REJECT') >= 0) return false;
  if (s.indexOf('SELESAI') >= 0) return false;
  return true;
}

function _dsIsPenginapan_(layanan) {
  var l = String(layanan || '').toUpperCase();
  return l.indexOf('INAP') >= 0 || l.indexOf('PENGINAP') >= 0;
}

// ============ DIAGNOSTIK UTAMA (read-only) ============
function diagBookingTanpaTanggal() {
  var L = [];
  L.push('===== DIAG STATUS KAMAR — ' + new Date() + ' =====');

  var sh = _dsBookSheet_();
  if (!sh) { L.push('GAGAL: sheet booking tak ketemu.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var data = sh.getDataRange().getValues();
  if (data.length < 2) { L.push('Sheet booking kosong.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var H = data[0].map(function (h) { return String(h); });
  var col = {};
  H.forEach(function (h, i) { col[h] = i; });
  var need = ['BookingID', 'Nama_Customer', 'WhatsApp', 'Nama_Kamar', 'Layanan', 'CheckIn', 'CheckOut', 'Status_Booking', 'Status_Bayar'];
  var missing = need.filter(function (k) { return col[k] === undefined; });
  if (missing.length) L.push('⚠️ Kolom tak ketemu (cek nama header sheet): ' + missing.join(', '));

  var tanpaCheckOut = []; // Temuan A
  var tanpaCheckIn = [];  // Temuan B

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var statusBooking = col.Status_Booking !== undefined ? row[col.Status_Booking] : '';
    if (!_dsIsAktif_(statusBooking)) continue;

    var layanan = col.Layanan !== undefined ? row[col.Layanan] : '';
    var checkIn = col.CheckIn !== undefined ? row[col.CheckIn] : '';
    var checkOut = col.CheckOut !== undefined ? row[col.CheckOut] : '';
    var statusBayar = col.Status_Bayar !== undefined ? String(row[col.Status_Bayar] || '').toUpperCase() : '';
    var isDpOrLunas = statusBayar.indexOf('LUNAS') >= 0 || statusBayar.indexOf('DP') >= 0 ||
      statusBayar.indexOf('PARSIAL') >= 0 || statusBayar.indexOf('SEBAGIAN') >= 0 || statusBayar.indexOf('CICIL') >= 0;
    if (!isDpOrLunas) continue; // hanya yang benar2 nge-block kamar (Lunas/DP)

    var info = {
      row: i + 1,
      bookingId: col.BookingID !== undefined ? row[col.BookingID] : '(kolom BookingID tak ada)',
      nama: col.Nama_Customer !== undefined ? row[col.Nama_Customer] : '',
      wa: col.WhatsApp !== undefined ? row[col.WhatsApp] : '',
      kamar: col.Nama_Kamar !== undefined ? row[col.Nama_Kamar] : '',
      layanan: layanan,
      checkIn: checkIn,
      checkOut: checkOut,
      statusBooking: statusBooking,
      statusBayar: statusBayar,
    };

    if (_dsIsPenginapan_(layanan) && checkIn && !checkOut) tanpaCheckOut.push(info);
    if (!_dsIsPenginapan_(layanan) && !checkIn) tanpaCheckIn.push(info);
  }

  L.push('');
  L.push('[TEMUAN A] Booking PENGINAPAN aktif (Lunas/DP) dengan CheckOut KOSONG: ' + tanpaCheckOut.length);
  L.push('  → Kamar ini terblokir SELAMANYA di /info (tak bisa dicek per-tanggal).');
  L.push('  → Perbaikan: isi CheckOut (tamu keluar tanggal berapa), ATAU ubah Status_Booking = SELESAI kalau tamu sudah checkout.');
  tanpaCheckOut.forEach(function (b) {
    L.push('  · baris ' + b.row + ' | ' + b.bookingId + ' | ' + b.kamar + ' | ' + b.nama + ' (' + b.wa + ') | CheckIn=' + b.checkIn + ' | Status=' + b.statusBooking + '/' + b.statusBayar);
  });

  L.push('');
  L.push('[TEMUAN B] Booking KOST aktif (Lunas/DP) dengan CheckIn KOSONG: ' + tanpaCheckIn.length);
  L.push('  → Frontend SUDAH ditambal (kamar tetap tampil DP/kuning, bukan salah kosong).');
  L.push('  → Tetap disarankan rapikan sumbernya: isi CheckIn (tanggal mulai sewa).');
  tanpaCheckIn.forEach(function (b) {
    L.push('  · baris ' + b.row + ' | ' + b.bookingId + ' | ' + b.kamar + ' | ' + b.nama + ' (' + b.wa + ') | Status=' + b.statusBooking + '/' + b.statusBayar);
  });

  L.push('');
  L.push('===== SELESAI. Kirim (paste) semua teks ini ke Claude kalau perlu bantuan lanjut. =====');
  var out = L.join('\n');
  Logger.log(out);
  return out;
}
