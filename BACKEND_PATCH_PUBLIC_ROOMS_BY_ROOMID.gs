/*******************************************************************
 * BACKEND_PATCH_PUBLIC_ROOMS_BY_ROOMID.gs — Top Hills
 * =================================================================
 * TUJUAN: bikin ketersediaan kamar di /info (tampilan + booking flow)
 * SAMA PERSIS dengan menu Kamar dashboard.
 *
 * MASALAH: dashboard mencocokkan booking↔kamar by **RoomID**
 * (src/app/kamar/page.tsx: bookingsByRoom di-group per RoomID), sedangkan
 * /info mencocokkan by **NAMA** (_publicRoomKey_). Beda cara → bisa beda hasil
 * (nama sedikit beda = gagal senyap, atau RoomID kosong = kebalikannya).
 *
 * SOLUSI: file ini MENGGANTI 3 fungsi di apiv2.gs supaya /info juga
 * cocokkan by **RoomID** — identik dgn dashboard:
 *   - _publicBookingStatusByRoom_
 *   - _publicBookedRangesByRoom_
 *   - v2_getPublicRooms
 * Fungsi lain (_publicPayStatus_, _publicRoomKey_) TIDAK diubah.
 *
 * ⚠️ URUTAN WAJIB (kalau tidak, kamar yang RoomID-nya masih kosong akan
 *    tampil "kosong" di /info — sama seperti di dashboard sekarang):
 *   1) Pasang BACKEND_PATCH_ROOMID_SYNC.gs + Run previewBackfillBookingRoomId
 *      lalu backfillBookingRoomId (isi RoomID booking lama).
 *   2) BARU pasang file ini + Deploy New version.
 *
 * CARA PASANG:
 *   A) Tempel file ini ke Apps Script (file/tab baru).
 *   B) Di apiv2.gs, HAPUS 3 fungsi lama (_publicBookingStatusByRoom_,
 *      _publicBookedRangesByRoom_, v2_getPublicRooms) supaya tak bentrok
 *      dua definisi — biarkan versi file ini yang jalan.
 *   C) Deploy → Manage deployments → New version.
 *******************************************************************/

// Status hunian per RoomID (Lunas→terisi, DP→dp). Lewat CheckOut & SELESAI
// TIDAK memblok. Booking tanpa RoomID DILEWATI — identik perilaku dashboard.
function _publicBookingStatusByRoom_() {
  var map = {};
  try {
    var rows = (typeof getSheetObjects_ === 'function') ? (getSheetObjects_(SHEETS.BOOKINGS) || []) : [];
    var tz = Session.getScriptTimeZone() || 'GMT+7';
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    for (var i = 0; i < rows.length; i++) {
      var st = _publicPayStatus_(rows[i]);
      if (st !== 'lunas' && st !== 'dp') continue;
      // Kamar bebas lagi kalau tanggal checkout sudah lewat (seragam dgn dashboard).
      if (rows[i].CheckOut) {
        var co = Utilities.formatDate(new Date(rows[i].CheckOut), tz, 'yyyy-MM-dd');
        if (co && co < today) continue;
      }
      var key = String(rows[i].RoomID || '').trim();   // ← by RoomID (bukan nama)
      if (!key) continue;                                // no RoomID → skip (identik dashboard)
      if (map[key] === 'terisi') continue;
      map[key] = (st === 'lunas') ? 'terisi' : 'dp';
    }
  } catch (e) {}
  return map;
}

// Rentang tanggal terbooking per RoomID (buat cek per-tanggal /info).
function _publicBookedRangesByRoom_() {
  var map = {};
  try {
    var rows = (typeof getSheetObjects_ === 'function') ? (getSheetObjects_(SHEETS.BOOKINGS) || []) : [];
    var tz = Session.getScriptTimeZone() || 'GMT+7';
    for (var i = 0; i < rows.length; i++) {
      try {
        var b = rows[i];
        var st = _publicPayStatus_(b);
        if (st !== 'lunas' && st !== 'dp') continue;
        if (!b.CheckIn) continue;
        var ci = Utilities.formatDate(new Date(b.CheckIn), tz, 'yyyy-MM-dd');
        var co = b.CheckOut ? Utilities.formatDate(new Date(b.CheckOut), tz, 'yyyy-MM-dd') : '';
        var key = String(b.RoomID || '').trim();   // ← by RoomID
        if (!key) continue;
        if (!map[key]) map[key] = [];
        map[key].push({ start: ci, end: co, status: st });   // st = 'lunas' | 'dp'
      } catch (e) {}
    }
  } catch (e) {}
  return map;
}

// Daftar kamar publik + status/rentang — dicocokkan by RoomID (identik dashboard).
function v2_getPublicRooms() {
  try {
    var rooms = (typeof getRoomStatusList_ === 'function') ? getRoomStatusList_() : [];
    var bookStatus = _publicBookingStatusByRoom_();
    var bookedRanges = _publicBookedRangesByRoom_();
    return rooms.map(function (r) {
      var rid = String(r.RoomID || '').trim();
      var code = String(r.Status_Code || '').toUpperCase();
      var status;
      if (code === 'NONAKTIF' || code.indexOf('MAINT') >= 0 || code.indexOf('PERBAIKAN') >= 0) {
        status = 'perbaikan';
      } else {
        status = bookStatus[rid] || 'kosong';
      }
      var src = String(r.Tipe_Kamar || '') + ' ' + String(r.Catatan || '');
      var m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
      var lantai = m ? Number(m[1]) : 0;
      return {
        roomId: rid,
        nama: r.Nama_Kamar || '',
        gedung: r.Gedung || '',
        tipe: r.Tipe_Kamar || '',
        layanan: r.Layanan_Default || '',
        lantai: lantai,
        status: status,
        harga: Number(r.Harga_Kamar || r.Harga || r.Harga_Sewa || r.Harga_Bulanan || 0) || 0,
        bookedRanges: bookedRanges[rid] || []
      };
    });
  } catch (e) {
    return [];
  }
}
