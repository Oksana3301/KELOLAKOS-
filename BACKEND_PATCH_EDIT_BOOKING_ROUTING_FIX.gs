/*******************************************************************
 * BACKEND_PATCH_EDIT_BOOKING_ROUTING_FIX.gs — Top Hills
 * =================================================================
 * Perbaiki 3 hal untuk Ubah booking dari dashboard owner/penjaga:
 *   1. ROUTING dispatchV2_ (submitBookingEdit → _fixed_, editPendingBooking
 *      → _multibukti_) — tanpa duplikat case.
 *   2. submitBookingEdit_fixed_ IKUT menulis Paket / Durasi / Jumlah_Periode /
 *      Jumlah_Orang (dulu ganti periode / lama sewa / jumlah orang TIDAK nempel).
 *   3. GUARD fasilitas: Fasilitas_IDs hanya ditimpa bila daftar TIDAK kosong
 *      (kecuali ada flag hapus eksplisit) → tak lagi terhapus tak sengaja.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG (urut):                                            │
 * │                                                                │
 * │ A) GANTI fungsi submitBookingEdit_fixed_ LAMA (di file         │
 * │    BACKEND_PATCH_SUBMIT_BOOKING_EDIT_FIX.gs) dengan versi di   │
 * │    bawah. Boleh juga: HAPUS yang lama, paste file ini sbg .gs  │
 * │    baru. (Jangan sampai fungsi dobel — nanti bentrok.)         │
 * │                                                                │
 * │ B) Di apiv2.gs → dispatchV2_ → pastikan PERSIS 2 case ini ADA  │
 * │    dan TIDAK DOBEL (hapus case 'editPendingBooking' versi lama │
 * │    yang memanggil editPendingBooking biasa):                   │
 * │       case 'submitBookingEdit':  return submitBookingEdit_fixed_(payload);
 * │       case 'editPendingBooking': return editPendingBooking_multibukti_(payload);
 * │    (case pertama yang cocok yang menang — pastikan cuma SATU    │
 * │     case 'editPendingBooking'.)                                │
 * │                                                                │
 * │ C) Pastikan editPendingBooking_multibukti_ TERDEFINISI 1x saja │
 * │    (ada di BACKEND_PATCH_BOOKING_ALL.gs DAN                    │
 * │     BACKEND_PATCH_EDIT_BOOKING_MULTIBUKTI.gs → HAPUS salah satu).
 * │                                                                │
 * │ D) Deploy → Manage deployments → ✏️ Edit → New version → Deploy.
 * │                                                                │
 * │ (Opsional) Run diagBookingEditFix() → View → Logs.            │
 * └───────────────────────────────────────────────────────────────┘
 * Catatan: kolom uang final (Total/Dibayar/Sisa) tetap dikunci confirmBooking
 * yang dipanggil frontend SETELAH ini — angka akhir selalu benar.
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
  if (checkIn !== undefined && String(checkIn) !== '') updates.CheckIn = checkIn;

  var checkOut = pick(data.checkOut, data.check_out);
  if (checkOut !== undefined && String(checkOut) !== '') updates.CheckOut = checkOut;

  // ⬇️ BARU: Periode & jumlah — supaya ganti periode / lama sewa / orang NEMPEL.
  var paket = pick(data.paket, data.paket_durasi);
  if (paket !== undefined && String(paket) !== '') updates.Paket = paket;

  var durasi = pick(data.durasi, data.paket, data.paket_durasi);
  if (durasi !== undefined && String(durasi) !== '') updates.Durasi = durasi;

  var jumlahPeriode = pick(data.jumlahPeriode, data.jumlah_periode);
  if (jumlahPeriode !== undefined && String(jumlahPeriode) !== '') updates.Jumlah_Periode = Number(jumlahPeriode) || 1;

  var jumlahOrang = pick(data.jumlahOrang, data.jumlah_orang);
  if (jumlahOrang !== undefined && String(jumlahOrang) !== '') updates.Jumlah_Orang = Number(jumlahOrang) || 1;

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
  // GUARD: hanya timpa bila daftar TIDAK kosong, KECUALI ada flag hapus eksplisit
  // (fasilitasClear/fasilitas_clear). Cegah fasilitas terhapus saat form belum
  // sempat memuat pilihan lama.
  var facIds = pick(data.fasilitasIds, data.fasilitas_ids);
  if (facIds !== undefined) {
    var arr = Array.isArray(facIds) ? facIds : String(facIds || '').split(/[\s,;|]+/);
    var joined = arr.map(function (x) { return String(x).trim(); }).filter(function (x) { return x !== ''; }).join(',');
    var clear = (data.fasilitasClear === true || data.fasilitas_clear === true);
    if (joined !== '' || clear) {
      if (typeof _ensureBookingCol_ === 'function') _ensureBookingCol_('Fasilitas_IDs');
      updates.Fasilitas_IDs = joined;
    }
  }

  if (typeof _setBookingStatus_ !== 'function') {
    throw new Error('_setBookingStatus_ belum ada — pastikan apiv2.gs / patch Perpanjang terpasang.');
  }
  // INTI FIX: _setBookingStatus_ hanya menulis 1 baris (BookingID cocok) lalu return.
  var res = _setBookingStatus_(id, updates);
  return { ok: res && res.ok, bookingId: id, message: 'Booking diperbarui (1 baris).' };
}

// Diagnostik: pastikan helper & fungsi fix terbaca. Lihat View → Logs.
function diagBookingEditFix() {
  Logger.log('_setBookingStatus_ ada             : %s', typeof _setBookingStatus_ === 'function');
  Logger.log('_perpanjangNormWa_ ada             : %s', typeof _perpanjangNormWa_ === 'function');
  Logger.log('_ensureBookingCol_ ada             : %s', typeof _ensureBookingCol_ === 'function');
  Logger.log('submitBookingEdit_fixed_ ada       : %s', typeof submitBookingEdit_fixed_ === 'function');
  Logger.log('editPendingBooking_multibukti_ ada : %s', typeof editPendingBooking_multibukti_ === 'function');
  Logger.log('👉 dispatchV2_ harus punya (TANPA dobel):');
  Logger.log('   case "submitBookingEdit":  return submitBookingEdit_fixed_(payload);');
  Logger.log('   case "editPendingBooking": return editPendingBooking_multibukti_(payload);');
  return 'OK — cek Logs';
}
