/*******************************************************
 * PATCH KAMAR PUBLIK — ketersediaan kamar untuk halaman /info (Tahap 2)
 *
 * Endpoint baru: getPublicRooms (HARUS publik / tanpa access code).
 * Mengembalikan data kamar yang AMAN saja: nama kamar, gedung, tipe, lantai,
 * dan status (kosong / terisi / perbaikan). TIDAK ada nama penghuni, uang,
 * atau detail booking.
 *
 * ============================================================
 *  CARA PASANG
 * ============================================================
 * 1) Tempel fungsi v2_getPublicRooms() di bawah ini ke apiv2.gs (paling bawah).
 *
 * 2) Di apiv2.gs → dispatchV2_(action, payload), tambahkan 1 case (sebelum
 *    "default:"):
 *
 *      case 'getPublicRooms':   return { ok: true, data: v2_getPublicRooms() };
 *
 * 3) Di Api.gs → const WHITELIST_ACTIONS, tambahkan 1 baris supaya bisa
 *    dibuka tanpa access code (sama seperti getHalamanInfo):
 *
 *      'getPublicRooms': true,
 *
 * 4) Save → Deploy ulang (Manage deployments → Edit → New version → Deploy).
 *
 * Tanpa langkah 3, halaman /info tetap jalan tapi bagian "Ketersediaan Kamar"
 * menampilkan tombol "Tanya via WhatsApp" (fallback aman).
 *******************************************************/

function v2_getPublicRooms() {
  try {
    var rooms = (typeof getRoomStatusList_ === 'function') ? getRoomStatusList_() : [];
    return rooms.map(function (r) {
      var code = String(r.Status_Code || '').toUpperCase();
      var status = 'terisi';
      if (code === 'READY' || code === 'TERSEDIA' || code === 'KOSONG') status = 'kosong';
      else if (code === 'NONAKTIF' || code.indexOf('MAINT') >= 0 || code.indexOf('PERBAIKAN') >= 0) status = 'perbaikan';

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
