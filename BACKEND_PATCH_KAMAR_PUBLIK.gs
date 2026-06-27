/*******************************************************
 * PATCH KAMAR PUBLIK — ketersediaan kamar untuk halaman /info
 *
 * Endpoint: getPublicRooms (HARUS publik / tanpa access code).
 * Mengembalikan data kamar yang AMAN saja: nama kamar, gedung, tipe, lantai,
 * dan status. TIDAK ada nama penghuni, uang, atau detail booking.
 *
 * STATUS DENAH (baru): dihitung dari pembayaran booking aktif tiap kamar —
 *   - 'terisi'    → ada booking LUNAS (kamar benar-benar terisi)
 *   - 'dp'        → ada booking DP (dipesan, belum lunas → belum benar-benar terisi)
 *   - 'kosong'    → tidak ada booking, atau hanya "Belum Bayar" (masih tersedia)
 *   - 'perbaikan' → kamar sedang nonaktif/maintenance (dari Status_Code)
 * Booking PENDING (MENUNGGU_KONFIRMASI) & BATAL tidak memblokir kamar.
 *
 * ============================================================
 *  CARA PASANG (kalau belum)
 * ============================================================
 * 1) Tempel SELURUH isi file ini ke apiv2.gs (ganti versi lama bila ada).
 * 2) Di apiv2.gs → dispatchV2_(action, payload), pastikan ada case:
 *      case 'getPublicRooms':   return { ok: true, data: v2_getPublicRooms() };
 * 3) Di Api.gs → const WHITELIST_ACTIONS, pastikan ada baris:
 *      'getPublicRooms': true,
 * 4) Save → Deploy ulang (Manage deployments → Edit → New version → Deploy).
 *******************************************************/

// Normalisasi nama kamar untuk pencocokan booking ↔ kamar ("Executive D01"→"D01").
function _publicRoomKey_(nama) {
  var s = String(nama || '').trim().toUpperCase();
  var code = s.match(/\bD0?\d+\b/);
  return (code ? code[0] : s).replace(/\s+/g, '');
}

// Status pembayaran sebuah baris booking → 'lunas' | 'dp' | 'belum' | 'abaikan'.
function _publicPayStatus_(b) {
  var booking = String(b.Status_Booking || '').toUpperCase();
  if (booking.indexOf('BATAL') >= 0 || booking.indexOf('CANCEL') >= 0 ||
      booking.indexOf('TOLAK') >= 0 || booking.indexOf('REJECT') >= 0) return 'abaikan';
  if (booking.indexOf('MENUNGGU') >= 0) return 'abaikan'; // PENDING tidak memblok kamar

  var bayar = String(b.Status_Bayar || '').toUpperCase();
  var total = Number(b.Harga_Total_Net || 0);
  var dibayar = Number(b.Net_Diterima || b.Total_Bayar || 0);
  var sisaRaw = b.Sisa_Bayar;
  var sisa = (sisaRaw === '' || sisaRaw === null || sisaRaw === undefined)
    ? Math.max(total - dibayar, 0) : Number(sisaRaw);

  if (bayar.indexOf('LUNAS') >= 0) return dibayar > 0 ? 'lunas' : 'belum';
  if (bayar.indexOf('DP') >= 0 || bayar.indexOf('PARSIAL') >= 0 ||
      bayar.indexOf('SEBAGIAN') >= 0 || bayar.indexOf('CICIL') >= 0) return 'dp';
  if (bayar.indexOf('BELUM') >= 0) return dibayar > 0 ? 'dp' : 'belum';
  // Tanpa string status yang jelas → tentukan dari nominal.
  if (dibayar <= 0) return 'belum';
  if (total > 0 && sisa <= 0) return 'lunas';
  return 'dp';
}

// Peta: kunci kamar → 'terisi' | 'dp' (prioritas lunas > dp) dari booking aktif.
function _publicBookingStatusByRoom_() {
  var map = {};
  try {
    var rows = (typeof getSheetObjects_ === 'function') ? (getSheetObjects_(SHEETS.BOOKINGS) || []) : [];
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i];
      var st = _publicPayStatus_(b);
      if (st !== 'lunas' && st !== 'dp') continue; // 'belum'/'abaikan' tidak memblok
      var key = _publicRoomKey_(b.Nama_Kamar);
      if (!key) continue;
      if (map[key] === 'terisi') continue;          // lunas menang, jangan ditimpa
      map[key] = (st === 'lunas') ? 'terisi' : 'dp';
    }
  } catch (e) {}
  return map;
}

function v2_getPublicRooms() {
  try {
    var rooms = (typeof getRoomStatusList_ === 'function') ? getRoomStatusList_() : [];
    var bookStatus = _publicBookingStatusByRoom_();

    return rooms.map(function (r) {
      var code = String(r.Status_Code || '').toUpperCase();

      // Kamar nonaktif/maintenance → 'perbaikan' (menimpa apa pun).
      var status;
      if (code === 'NONAKTIF' || code.indexOf('MAINT') >= 0 || code.indexOf('PERBAIKAN') >= 0) {
        status = 'perbaikan';
      } else {
        // Default dari booking: terisi (lunas) / dp / kosong (belum/tidak ada).
        status = bookStatus[_publicRoomKey_(r.Nama_Kamar)] || 'kosong';
      }

      // Lantai diambil dari Tipe_Kamar / Catatan ("Lantai 2" -> 2), kalau ada.
      var src = String(r.Tipe_Kamar || '') + ' ' + String(r.Catatan || '');
      var m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
      var lantai = m ? Number(m[1]) : 0;

      return {
        nama: r.Nama_Kamar || '',
        gedung: r.Gedung || '',
        tipe: r.Tipe_Kamar || '',
        layanan: r.Layanan_Default || '',
        lantai: lantai,
        status: status
      };
    });
  } catch (e) {
    return [];
  }
}
