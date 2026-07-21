/*******************************************************************
 * BACKEND_PATCH_ROOMID_SYNC.gs — Top Hills
 * =================================================================
 * Perbaikan: booking dari /info (submitBookingRequest) tidak pernah
 * dapat RoomID, dan confirmBooking (tombol "Terima") juga tidak pernah
 * mengisinya. Akibatnya menu Kamar dashboard (src/app/kamar/page.tsx)
 * skip booking itu — `if (!b.RoomID) return;` — jadi kamar tetap
 * kelihatan kosong walau sudah dibooking & dibayar.
 *
 * ISI FILE INI:
 *   1) _kkResolveRoomId_(namaKamar, gedung)  → helper cari RoomID by nama
 *   2) confirmBooking(data)                  → GANTI versi lama di apiv2.gs
 *   3) previewBackfillBookingRoomId()        → cek dulu (read-only)
 *   4) backfillBookingRoomId()               → isi RoomID yang kosong (booking LAMA)
 *   5) diagPublicRoomKeyMismatch()           → cek /info: nama kamar Booking vs Rooms
 *
 * CARA PASANG:
 *   A) Tempel SELURUH file ini ke project Apps Script (file/tab baru).
 *   B) Di apiv2.gs, HAPUS fungsi `confirmBooking` yang LAMA (supaya tidak
 *      bentrok dua definisi) — biarkan versi di file ini yang jalan.
 *      (Case di dispatchV2_ TIDAK perlu diubah, tetap `confirmBooking(payload)`.)
 *   C) Run `previewBackfillBookingRoomId` DULU → cek Logs → kalau hasilnya
 *      masuk akal, baru Run `backfillBookingRoomId` (isi data lama).
 *   D) Run `diagPublicRoomKeyMismatch` → cek Logs → paste hasilnya ke Claude
 *      kalau ada kamar yang namanya tidak cocok antara Booking & Rooms.
 *   E) Deploy → Manage deployments → New version.
 *******************************************************************/

// ── Cari sheet Rooms/Kamar dengan nama umum yang mungkin dipakai ──────────
function _kkRoomsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ['Rooms', 'ROOMS', 'Kamar', 'KAMAR', 'Room', 'ROOM'];
  for (var i = 0; i < names.length; i++) {
    var sh = ss.getSheetByName(names[i]);
    if (sh) return sh;
  }
  return null;
}

// ── Cocokkan Nama_Kamar (+ Gedung opsional) → RoomID. Exact match dulu,
// fallback longgar (trim+lowercase, abaikan spasi ganda). '' bila tak ketemu. ──
function _kkResolveRoomId_(namaKamar, gedung) {
  var sh = _kkRoomsSheet_();
  if (!sh) return '';
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return '';
  var headers = data[0].map(function (h) { return String(h); });
  var idCol = headers.indexOf('RoomID');
  var namaCol = headers.indexOf('Nama_Kamar');
  var gedungCol = headers.indexOf('Gedung');
  if (idCol < 0 || namaCol < 0) return '';

  var normNama = String(namaKamar || '').trim().toLowerCase().replace(/\s+/g, ' ');
  var normGedung = String(gedung || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normNama) return '';

  var fallback = '';
  for (var i = 1; i < data.length; i++) {
    var rNama = String(data[i][namaCol] || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (rNama !== normNama) continue;
    var rGedung = gedungCol >= 0 ? String(data[i][gedungCol] || '').trim().toLowerCase().replace(/\s+/g, ' ') : '';
    var id = String(data[i][idCol] || '').trim();
    if (!id) continue;
    if (!normGedung || rGedung === normGedung) return id; // match nama+gedung (atau gedung kosong di query)
    if (!fallback) fallback = id; // simpan match nama-saja sebagai cadangan
  }
  return fallback;
}

// ── confirmBooking — GANTI versi lama. Tambahan SATU HAL saja: kalau
// booking ini belum punya RoomID, coba isi otomatis dari Nama_Kamar+Gedung.
// Semua logika lain (status, uang, CheckIn/CheckOut kost) SAMA PERSIS
// dengan versi lama — tidak ada perilaku existing yang berubah. ──────────
function confirmBooking(data) {
  data = data || {};
  var status = (data.status === 'Lunas') ? 'Lunas' : (data.status === 'Belum Bayar') ? 'Belum Bayar' : 'DP';
  var updates = { Status_Booking: 'AKTIF', Status_Bayar: status };

  var total = Number(data.total) || 0;
  var dibayar = (data.dibayar == null) ? 0 : Number(data.dibayar) || 0;
  if (status === 'Belum Bayar') dibayar = 0;
  if (status === 'Lunas' && total > 0 && dibayar <= 0) dibayar = total;
  if (total > 0) {
    updates.Harga_Total_Net = total;
    updates.Net_Diterima = dibayar;
    updates.Total_Bayar = dibayar;
    updates.Sisa_Bayar = Math.max(0, total - dibayar);
  }

  _ensureBookingCol_('Tgl_Pembayaran');
  updates.Tgl_Pembayaran = data.tglBayar || new Date().toISOString();

  var b = _bookingFindById_(data.bookingId);

  // ⬇️ BARU: kalau RoomID booking ini masih kosong, coba isi otomatis
  // dari Nama_Kamar + Gedung. Kalau tidak ketemu padanan, dibiarkan kosong
  // (tidak menebak sembarangan) — bisa dilengkapi manual lewat Edit.
  if (b && !String(b.RoomID || '').trim()) {
    var resolvedRoomId = _kkResolveRoomId_(b.Nama_Kamar, b.Gedung);
    if (resolvedRoomId) updates.RoomID = resolvedRoomId;
  }

  // KOST + kunci tanggal + LUNAS → CheckIn = tgl pelunasan, CheckOut = +periode.
  try {
    var hi = (typeof v2_getHalamanInfo === 'function') ? v2_getHalamanInfo() : null;
    var lock = !hi || hi.kostKunciTanggal !== false;
    if (lock && status === 'Lunas') {
      if (b && String(b.Layanan || '').toUpperCase().indexOf('KOS') >= 0) {
        var tz = Session.getScriptTimeZone() || 'GMT+7';
        var ci = data.tglPelunasan || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
        var bln = _bookingPeriodeBulan_(b.Paket || b.Durasi);
        updates.CheckIn = ci;
        var co = bln > 0 ? _bookingAddBulan_(ci, bln) : '';
        if (co) updates.CheckOut = co;
      }
    }
  } catch (e) {}

  return _setBookingStatus_(data.bookingId, updates);
}

// ── PREVIEW backfill (read-only) — jalankan DULU sebelum apply. ──────────
function previewBackfillBookingRoomId() {
  return _kkBackfillRoomId_(false);
}

// ── APPLY backfill — HANYA mengisi RoomID yang KOSONG (tidak pernah
// menimpa RoomID yang sudah ada). Booking yang tak ketemu padanan
// otomatis dibiarkan kosong (dilaporkan, untuk dicek manual). ────────────
function backfillBookingRoomId() {
  return _kkBackfillRoomId_(true);
}

function _kkIsAktifBayar_(statusBooking, statusBayar) {
  var sb = String(statusBooking || '').toUpperCase();
  if (sb.indexOf('BATAL') >= 0 || sb.indexOf('CANCEL') >= 0) return false;
  if (sb.indexOf('TOLAK') >= 0 || sb.indexOf('REJECT') >= 0) return false;
  if (sb.indexOf('SELESAI') >= 0) return false;
  var bayar = String(statusBayar || '').toUpperCase();
  return bayar.indexOf('LUNAS') >= 0 || bayar.indexOf('DP') >= 0 ||
    bayar.indexOf('PARSIAL') >= 0 || bayar.indexOf('SEBAGIAN') >= 0 || bayar.indexOf('CICIL') >= 0;
}

function _kkBackfillRoomId_(apply) {
  var L = [];
  L.push('===== ' + (apply ? 'BACKFILL' : 'PREVIEW') + ' RoomID — ' + new Date() + ' =====');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = null;
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) sh = ss.getSheetByName(SHEETS.BOOKINGS); } catch (e) {}
  if (!sh) { var names = ['BOOKINGS', 'Booking', 'Bookings']; for (var n = 0; n < names.length; n++) { sh = ss.getSheetByName(names[n]); if (sh) break; } }
  if (!sh) { L.push('GAGAL: sheet booking tak ketemu.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var data = sh.getDataRange().getValues();
  if (data.length < 2) { L.push('Sheet booking kosong.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var H = data[0].map(function (h) { return String(h); });
  var col = {};
  H.forEach(function (h, i) { col[h] = i; });
  var need = ['BookingID', 'RoomID', 'Nama_Kamar', 'Gedung', 'Status_Booking', 'Status_Bayar'];
  var missing = need.filter(function (k) { return col[k] === undefined; });
  if (missing.length) { L.push('⚠️ Kolom tak ketemu: ' + missing.join(', ')); Logger.log(L.join('\n')); return L.join('\n'); }

  var filled = 0, notFound = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!_kkIsAktifBayar_(row[col.Status_Booking], row[col.Status_Bayar])) continue;
    var roomId = String(row[col.RoomID] || '').trim();
    if (roomId) continue; // sudah ada → jangan disentuh

    var nama = String(row[col.Nama_Kamar] || '').trim();
    var gedung = String(row[col.Gedung] || '').trim();
    var resolved = _kkResolveRoomId_(nama, gedung);

    if (!resolved) {
      notFound++;
      L.push('  ✗ baris ' + (i + 1) + ' | ' + row[col.BookingID] + ' | kamar="' + nama + '" gedung="' + gedung + '" → TIDAK ketemu padanan, dilewati.');
      continue;
    }

    filled++;
    L.push('  ✓ baris ' + (i + 1) + ' | ' + row[col.BookingID] + ' | kamar="' + nama + '" → RoomID=' + resolved + (apply ? ' (DITULIS)' : ' (preview, belum ditulis)'));
    if (apply) sh.getRange(i + 1, col.RoomID + 1).setValue(resolved);
  }

  L.push('');
  L.push('Ringkasan: ' + filled + ' booking ' + (apply ? 'berhasil diisi RoomID' : 'SIAP diisi RoomID') + ', ' + notFound + ' tidak ketemu padanan (cek manual).');
  if (!apply && filled > 0) L.push('→ Kalau daftar di atas sudah benar, Run `backfillBookingRoomId` untuk menerapkan.');
  var out = L.join('\n');
  Logger.log(out);
  return out;
}

// ── Diagnostik /info: bandingkan kunci pencocokan nama kamar yang dipakai
// _publicRoomKey_ (apiv2.gs) antara sheet Booking vs sheet Rooms. Kalau ada
// nama kamar di Booking yang TIDAK match RoomID manapun di Rooms, kamar itu
// akan "kelihatan kosong" di /info walau sebenarnya ada booking aktifnya. ──
function diagPublicRoomKeyMismatch() {
  var L = [];
  L.push('===== DIAG /info — cocokkan nama kamar Booking vs Rooms — ' + new Date() + ' =====');

  var roomsSh = _kkRoomsSheet_();
  if (!roomsSh) { L.push('GAGAL: sheet Rooms/Kamar tak ketemu.'); Logger.log(L.join('\n')); return L.join('\n'); }
  var rd = roomsSh.getDataRange().getValues();
  var rh = rd[0].map(function (h) { return String(h); });
  var rNamaCol = rh.indexOf('Nama_Kamar');
  if (rNamaCol < 0) { L.push('GAGAL: kolom Nama_Kamar tak ada di sheet Rooms.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var roomKeys = {};
  for (var k = 1; k < rd.length; k++) {
    var key = (typeof _publicRoomKey_ === 'function') ? _publicRoomKey_(rd[k][rNamaCol]) : String(rd[k][rNamaCol] || '').trim().toUpperCase();
    if (key) roomKeys[key] = true;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bookSh = null;
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) bookSh = ss.getSheetByName(SHEETS.BOOKINGS); } catch (e) {}
  if (!bookSh) { var names = ['BOOKINGS', 'Booking', 'Bookings']; for (var n = 0; n < names.length; n++) { bookSh = ss.getSheetByName(names[n]); if (bookSh) break; } }
  if (!bookSh) { L.push('GAGAL: sheet booking tak ketemu.'); Logger.log(L.join('\n')); return L.join('\n'); }

  var bd = bookSh.getDataRange().getValues();
  var bh = bd[0].map(function (h) { return String(h); });
  var col = {};
  bh.forEach(function (h, i) { col[h] = i; });
  if (col.Nama_Kamar === undefined || col.Status_Booking === undefined || col.Status_Bayar === undefined) {
    L.push('GAGAL: kolom penting tak ada di sheet booking.'); Logger.log(L.join('\n')); return L.join('\n');
  }

  var seen = {}, mismatches = [];
  for (var i = 1; i < bd.length; i++) {
    var row = bd[i];
    if (!_kkIsAktifBayar_(row[col.Status_Booking], row[col.Status_Bayar])) continue;
    var nama = String(row[col.Nama_Kamar] || '').trim();
    if (!nama) continue;
    var key = (typeof _publicRoomKey_ === 'function') ? _publicRoomKey_(nama) : nama.toUpperCase();
    if (roomKeys[key]) continue; // match → aman
    if (seen[key]) continue;
    seen[key] = true;
    mismatches.push({ bookingId: row[col.BookingID !== undefined ? col.BookingID : 0], nama: nama, key: key });
  }

  L.push('');
  L.push('Nama kamar di Booking (aktif, Lunas/DP) yang TIDAK ketemu padanan di Rooms: ' + mismatches.length);
  L.push('→ Kamar-kamar ini akan tampil KOSONG di /info walau ada booking aktifnya (silent mismatch).');
  mismatches.forEach(function (m) {
    L.push('  · ' + m.bookingId + ' | Nama_Kamar="' + m.nama + '" → kunci pencocokan="' + m.key + '" (tak ada di Rooms)');
  });

  L.push('');
  L.push('===== SELESAI. Paste hasil ini ke Claude kalau ada mismatch — biasanya cuma beda spasi/kapital/penomoran. =====');
  var out = L.join('\n');
  Logger.log(out);
  return out;
}
