/*******************************************************
 * PATCH BOOKING v2 — DP + PELUNASAN (dengan tanggal) + ACTIVITY LOG
 *
 * Versi ini MENGGANTIKAN submitBooking dari BACKEND_PATCH_DPAWAL.gs.
 * Tambahannya dibanding versi lama:
 *   1. Tanggal DP bisa dikirim dari form (data.dp_tanggal). Kalau kosong,
 *      pakai tanggal hari ini (perilaku lama).
 *   2. Bisa mencatat PELUNASAN terpisah (data.pelunasan_nominal +
 *      data.pelunasan_tanggal) sekaligus saat booking dibuat.
 *   3. Mencatat activity log (kalau fungsi logActivity_ tersedia) tiap
 *      booking dibuat — aman walau BACKEND_ACTIVITY_LOG.gs belum dipasang.
 *
 * Semua field opsional & backward-compatible: kalau form lama yang dipakai,
 * hasilnya sama persis seperti sebelumnya.
 *
 * === CARA PASANG ===
 *  1. Buka Apps Script project Anda.
 *  2. Di file BACKEND_PATCH_DPAWAL.gs, HAPUS / komentari fungsi
 *     `function submitBooking(data) { ... }` yang lama (supaya tidak ada
 *     dua fungsi dengan nama sama — Apps Script error kalau duplikat).
 *  3. Tambahkan file ini (atau tempel isinya) ke project.
 *  4. (Opsional, untuk activity log menyeluruh) Jalankan setupActivityLog()
 *     sekali, lalu pasang blok AUTO-LOG di router Anda — lihat bagian paling
 *     bawah file ini.
 *  5. Deploy ulang: Manage deployments → Edit → New version → Deploy.
 *******************************************************/

function submitBooking(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.BOOKINGS);

  if (!sheet) throw new Error('Sheet BOOKINGS belum ada. Jalankan setup dulu.');
  if (!data.roomId) throw new Error('Kamar wajib dipilih.');
  if (!data.nama) throw new Error('Nama customer wajib diisi.');
  if (!data.paket) throw new Error('Paket wajib dipilih.');

  const room = getRoomById_(data.roomId);
  if (!room) throw new Error('RoomID tidak ditemukan di master ROOMS.');
  if (!isRoomMasterActive_(room)) throw new Error('Kamar ini sedang NONAKTIF/MAINTENANCE, jadi tidak bisa dibuat booking baru. Aktifkan dulu di menu Kelola Kamar.');

  const existingActiveBookings = findActiveBookingsByRoom_(room.RoomID);

  const activeWarning = existingActiveBookings.length > 0
    ? `PERINGATAN: Saat booking dibuat, kamar ini sudah aktif/terisi oleh: ${existingActiveBookings.map(b => formatActiveBookingText_(b)).join(' | ')}`
    : '';

  const layanan = room.Layanan_Default || data.layanan || '';
  const bookingId = generateBookingId_(room.RoomID);

  const checkIn = data.checkIn ? new Date(data.checkIn) : '';
  const checkOut = data.checkOut ? new Date(data.checkOut) : '';
  const jumlahPeriode = Math.max(Number(data.jumlahPeriode || 1), 1);

  const priceDetail = calculateBookingPriceDetail_(data, room);

  const hargaKamar = data.hargaKamar !== '' && data.hargaKamar !== undefined
    ? Number(data.hargaKamar || 0)
    : priceDetail.hargaKamar;

  const extraCharge = data.extraChargeFinal !== '' && data.extraChargeFinal !== undefined
    ? Number(data.extraChargeFinal || 0)
    : priceDetail.extraChargeFinal;

  const diskon = Number(data.diskon || 0);

  const hargaTotalNet = data.hargaTotal !== '' && data.hargaTotal !== undefined
    ? Number(data.hargaTotal || 0)
    : Math.max(hargaKamar + extraCharge - diskon, 0);

  const jumlahOrang = Number(data.jumlahOrang || room.Kapasitas_Normal || 1);
  const extraBedQty = Number(data.extraBedQty || 0);

  const extraPersonQty = data.extraPersonQty !== '' && data.extraPersonQty !== undefined
    ? Number(data.extraPersonQty || 0)
    : Math.max(jumlahOrang - Number(room.Kapasitas_Normal || 1), 0);

  const durasi = calculateDuration_(layanan, checkIn, checkOut, data.paket, jumlahPeriode);

  const catatanFinal = [
    data.catatan || '',
    activeWarning
  ].filter(Boolean).join(' | ');

  sheet.appendRow([
    bookingId,
    new Date(),
    layanan,
    data.nama || '',
    data.whatsapp || '',
    room.RoomID,
    room.Nama_Kamar,
    room.Gedung,
    room.Tipe_Kamar,
    data.paket || '',
    jumlahPeriode,
    checkIn || '',
    checkOut || '',
    durasi,
    jumlahOrang,
    extraBedQty,
    extraPersonQty,
    hargaKamar,
    extraCharge,
    diskon,
    hargaTotalNet,
    'BOOKED',
    'BELUM BAYAR',
    0,
    0,
    0,
    hargaTotalNet,
    0,
    catatanFinal,
    new Date()
  ]);

  updateBookingFinancials_(bookingId);

  // === Catat pembayaran awal: DP &/atau PELUNASAN (opsional, dengan tanggal) ===
  var _tz = Session.getScriptTimeZone() || 'GMT+7';
  function _fmtTgl_(v) {
    if (!v) return Utilities.formatDate(new Date(), _tz, 'yyyy-MM-dd');
    try { return Utilities.formatDate(new Date(v), _tz, 'yyyy-MM-dd'); } catch (e) { return String(v); }
  }

  var _dpAwal = Number(data.dp_awal || data.dpAwal || 0);
  var _pelunasan = Number(data.pelunasan_nominal || data.pelunasanNominal || 0);
  var _dpTgl = data.dp_tanggal || data.dpTanggal || '';
  var _pelTgl = data.pelunasan_tanggal || data.pelunasanTanggal || '';

  if (_dpAwal > 0) {
    try {
      // Kalau DP saja sudah >= total dan tidak ada pelunasan terpisah → tandai PELUNASAN.
      var _lunasByDp = (_dpAwal >= hargaTotalNet) && (_pelunasan <= 0);
      submitPayment({
        bookingId: bookingId, booking_id: bookingId,
        nominal: _dpAwal,
        jenisBayar: _lunasByDp ? 'PELUNASAN' : 'DP',
        jenis_bayar: _lunasByDp ? 'PELUNASAN' : 'DP',
        metode: data.dp_metode || data.dpMetode || 'CASH',
        diterimaOleh: data.diterima_oleh || data.diterimaOleh || '',
        diterima_oleh: data.diterima_oleh || data.diterimaOleh || '',
        tanggalBayar: _fmtTgl_(_dpTgl),
        tanggal_bayar: _fmtTgl_(_dpTgl),
        catatan: 'DP saat booking dibuat'
      });
    } catch (e) {
      Logger.log('submitBooking: gagal catat DP: ' + e);
    }
  }

  if (_pelunasan > 0) {
    try {
      submitPayment({
        bookingId: bookingId, booking_id: bookingId,
        nominal: _pelunasan,
        jenisBayar: 'PELUNASAN',
        jenis_bayar: 'PELUNASAN',
        metode: data.dp_metode || data.dpMetode || 'CASH',
        diterimaOleh: data.diterima_oleh || data.diterimaOleh || '',
        diterima_oleh: data.diterima_oleh || data.diterimaOleh || '',
        tanggalBayar: _fmtTgl_(_pelTgl),
        tanggal_bayar: _fmtTgl_(_pelTgl),
        catatan: 'Pelunasan saat booking dibuat'
      });
    } catch (e) {
      Logger.log('submitBooking: gagal catat pelunasan: ' + e);
    }
  }

  // === Activity log (aman walau fungsi/sheet belum dipasang) ===
  try {
    if (typeof logActivity_ === 'function') {
      logActivity_(
        'BUAT_BOOKING',
        [data.nama || '', room.Nama_Kamar, data.paket || '', 'Rp' + hargaTotalNet].filter(Boolean).join(' · '),
        bookingId,
        data
      );
    }
  } catch (e) { /* abaikan, jangan ganggu booking */ }

  return {
    success: true,
    message: existingActiveBookings.length > 0
      ? `Booking berhasil dibuat untuk ${room.Nama_Kamar}, tapi kamar ini sebelumnya sudah aktif. Cek catatan booking.`
      : `Booking berhasil dibuat untuk ${room.Nama_Kamar}.`,
    bookingId: bookingId,
    warning: activeWarning
  };
}

/*******************************************************
 * (OPSIONAL) AUTO-LOG SEMUA PERUBAHAN
 * Supaya SEMUA aksi tulis (submit*) tercatat — bukan cuma booking — pasang
 * blok ini di router utama Anda (Api.gs), DI ATAS switch/case yang menangani
 * action. Sesuaikan nama variabel `action` / `data` bila di router Anda beda.
 *
 *   try {
 *     if (action && String(action).indexOf('submit') === 0) {
 *       var _ref = (data && (data.bookingId || data.booking_id || data.id ||
 *                            data.roomId || data.room_id)) || '';
 *       logActivity_(action, _logDetail_(data), _ref, data);
 *     }
 *   } catch (e) {}
 *
 * Jalankan setupActivityLog() sekali untuk membuat sheet ACTIVITY_LOG,
 * lalu Deploy ulang. (Fungsi logActivity_ & _logDetail_ ada di
 * BACKEND_ACTIVITY_LOG.gs.)
 *******************************************************/
