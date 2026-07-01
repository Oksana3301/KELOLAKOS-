/*******************************************************************
 * BACKEND_PATCH_SUBMIT_BOOKING_EDIT_FIX.gs — Top Hills
 * -----------------------------------------------------------------
 * FIX BUG FATAL: "ubah 1 booking → SEMUA kartu ikut berubah".
 *
 * Penyebab: fungsi submitBookingEdit LAMA (di file logic-mu, dipanggil dari
 * dispatchV1_) menulis ke banyak/semua baris. Versi ini menulis HANYA ke 1
 * baris sesuai BookingID lewat _setBookingStatus_ (helper yang sudah ada).
 *
 * ================= CARA PASANG (paling aman — MENCEGAT) =================
 * Urutan dispatch di Api.gs: dispatchLicense_ → dispatchV2_ → dispatchV1_
 * (yang pertama mengembalikan non-null menang). Jadi kita cegat di dispatchV2_
 * SEBELUM sampai ke submitBookingEdit lama di dispatchV1_. TIDAK perlu cari /
 * hapus fungsi lama.
 *
 * 1) Buka apiv2.gs → fungsi dispatchV2_(action, payload) → tambahkan 1 baris
 *    SEBELUM `default:` :
 *
 *        case 'submitBookingEdit': return submitBookingEdit_fixed_(payload);
 *
 * 2) Paste file ini sebagai .gs baru (mendefinisikan submitBookingEdit_fixed_).
 *
 * 3) Deploy → Manage deployments → ✏️ Edit → New version → Deploy.
 *
 * (Opsional) Jalankan diagBookingEditFix() → View → Logs untuk cek helper.
 *
 * Catatan: kolom uang final (Total/Dibayar/Sisa) tetap dikunci confirmBooking
 * yang dipanggil frontend SETELAH ini — jadi angka akhir selalu benar.
 *******************************************************************/

function submitBookingEdit_fixed_(data) {
  data = data || {};
  var id = String(data.bookingId || data.booking_id || '').trim();
  if (!id) throw new Error('bookingId wajib diisi');

  // Ambil nilai pertama yang terdefinisi (frontend kirim camelCase + snake_case).
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
    throw new Error('_setBookingStatus_ belum ada — pastikan apiv2.gs / patch Perpanjang terpasang.');
  }
  // ⬇️ INTI FIX: _setBookingStatus_ hanya menulis 1 baris (BookingID cocok) lalu return.
  var res = _setBookingStatus_(id, updates);
  return { ok: res && res.ok, bookingId: id, message: 'Booking diperbarui (1 baris).' };
}

// Diagnostik: pastikan helper & fungsi fix terbaca. Lihat View → Logs.
function diagBookingEditFix() {
  Logger.log('_setBookingStatus_ ada       : %s', typeof _setBookingStatus_ === 'function');
  Logger.log('_perpanjangNormWa_ ada       : %s', typeof _perpanjangNormWa_ === 'function');
  Logger.log('_ensureBookingCol_ ada       : %s', typeof _ensureBookingCol_ === 'function');
  Logger.log('submitBookingEdit_fixed_ ada : %s', typeof submitBookingEdit_fixed_ === 'function');
  Logger.log('👉 Pastikan di dispatchV2_ sudah ada: case "submitBookingEdit": return submitBookingEdit_fixed_(payload);');
  return 'OK — cek Logs';
}
