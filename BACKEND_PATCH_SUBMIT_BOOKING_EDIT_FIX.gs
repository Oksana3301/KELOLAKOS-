/*******************************************************************
 * BACKEND_PATCH_SUBMIT_BOOKING_EDIT_FIX.gs — Top Hills
 * -----------------------------------------------------------------
 * FIX BUG FATAL: "ubah 1 booking → SEMUA kartu ikut berubah".
 *
 * Penyebab: fungsi submitBookingEdit LAMA (di Api.gs) menulis ke banyak/semua
 * baris (mis. setValues satu kolom penuh, atau lupa filter BookingID). Versi
 * ini menulis HANYA ke 1 baris sesuai BookingID lewat _setBookingStatus_
 * (helper yang sudah ada di project — dipakai confirmBooking/editPendingBooking).
 *
 * ================= CARA PASANG (WAJIB urut) =================
 * 1) Di SEMUA file (terutama Api.gs), CARI `function submitBookingEdit`.
 *    HAPUS seluruh fungsi lama itu (dari `function submitBookingEdit(` sampai
 *    kurung tutup `}` penutupnya). Tujuannya: BOLEH ADA HANYA SATU fungsi
 *    bernama submitBookingEdit — yaitu versi ini. (Kalau ada dua, yang lama
 *    yang rusak bisa menang tergantung urutan file → bug balik lagi.)
 *
 * 2) Paste file ini sebagai .gs baru. Router yang sudah ada (dispatch_) tetap
 *    memanggil fungsi bernama submitBookingEdit → sekarang = versi benar ini.
 *    TIDAK perlu ubah dispatchV2_ / dispatch_.
 *
 * 3) (Sekali) Jalankan diagBookingEditFix() untuk memastikan hanya ada 1
 *    submitBookingEdit & helper _setBookingStatus_ terbaca — lihat View → Logs.
 *
 * 4) Deploy → Manage deployments → ✏️ Edit → New version → Deploy.
 *
 * Catatan: kolom uang final (Total/Dibayar/Sisa) tetap dikunci oleh confirmBooking
 * yang dipanggil frontend SETELAH ini — jadi angka akhir selalu benar.
 *******************************************************************/

function submitBookingEdit(data) {
  data = data || {};
  var id = String(data.bookingId || data.booking_id || '').trim();
  if (!id) throw new Error('bookingId wajib diisi');

  // Ambil nilai pertama yang terdefinisi dari beberapa kemungkinan nama field
  // (frontend kirim camelCase + snake_case sekaligus).
  function pick() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
    }
    return undefined;
  }

  var updates = {};

  var nama = pick(data.customerName, data.nama);
  if (nama !== undefined) updates.Nama_Customer = nama;

  var wa = pick(data.whatsapp, data.wa, data.no_wa);
  if (wa !== undefined && String(wa) !== '') {
    updates.WhatsApp = (typeof _perpanjangNormWa_ === 'function') ? _perpanjangNormWa_(wa) : String(wa);
  }

  var checkIn = pick(data.checkIn, data.check_in);
  if (checkIn !== undefined) updates.CheckIn = checkIn;

  var checkOut = pick(data.checkOut, data.check_out);
  if (checkOut !== undefined) updates.CheckOut = checkOut;

  var hargaKamar = pick(data.hargaKamar, data.harga_kamar);
  if (hargaKamar !== undefined) updates.Harga_Kamar = Number(hargaKamar) || 0;

  var extraCharge = pick(data.extraCharge, data.extra_charge, data.extra_charge_final);
  if (extraCharge !== undefined) updates.Extra_Charge = Number(extraCharge) || 0;

  if (data.diskon !== undefined) updates.Diskon = Number(data.diskon) || 0;

  var hargaTotal = pick(data.hargaTotal, data.harga_total);
  if (hargaTotal !== undefined) updates.Harga_Total_Net = Number(hargaTotal) || 0;

  if (data.catatan !== undefined) updates.Catatan = data.catatan;

  var extraReq = pick(data.extraRequest, data.extra_request);
  if (extraReq !== undefined) updates.extra_request = extraReq;

  var isEkstra = pick(data.isEkstra, data.is_ekstra);
  if (isEkstra !== undefined) updates.is_ekstra = (isEkstra === true || isEkstra === 'true' || isEkstra === 'YA');

  // Fasilitas per booking → simpan ID (gabung koma) di kolom Fasilitas_IDs.
  // (Dibaca oleh getBookingFasilitas untuk badge fasilitas di kartu /booking.)
  var facIds = pick(data.fasilitasIds, data.fasilitas_ids);
  if (facIds !== undefined) {
    var arr = Array.isArray(facIds) ? facIds : String(facIds || '').split(/[\s,;|]+/);
    var joined = arr.map(function (x) { return String(x).trim(); }).filter(function (x) { return x !== ''; }).join(',');
    if (typeof _ensureBookingCol_ === 'function') _ensureBookingCol_('Fasilitas_IDs');
    updates.Fasilitas_IDs = joined;
  }

  if (typeof _setBookingStatus_ !== 'function') {
    throw new Error('_setBookingStatus_ belum ada — pastikan patch Perpanjang/apiv2 terpasang.');
  }
  // ⬇️ INTI FIX: hanya menulis ke 1 baris (BookingID yang cocok), lalu return.
  var res = _setBookingStatus_(id, updates);
  return { bookingId: id, ok: res && res.ok, message: 'Booking diperbarui.' };
}

// Diagnostik: pastikan helper terbaca. (Tidak bisa cek fungsi duplikat dari
// dalam skrip — pastikan manual di langkah 1 hanya ada SATU submitBookingEdit.)
function diagBookingEditFix() {
  Logger.log('_setBookingStatus_ ada: %s', typeof _setBookingStatus_ === 'function');
  Logger.log('_perpanjangNormWa_ ada: %s', typeof _perpanjangNormWa_ === 'function');
  Logger.log('_ensureBookingCol_ ada: %s', typeof _ensureBookingCol_ === 'function');
  Logger.log('submitBookingEdit ada: %s', typeof submitBookingEdit === 'function');
  Logger.log('👉 Pastikan di editor kamu CARI "function submitBookingEdit" dan HANYA ADA 1 (ini).');
  return 'OK — cek Logs';
}
