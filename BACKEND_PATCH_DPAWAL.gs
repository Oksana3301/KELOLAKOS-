/*******************************************************
 * PATCH DP-AWAL — submitBooking mencatat pembayaran awal (DP/Lunas)
 *
 * MASALAH: submitBooking Anda meng-append row booking dengan status
 * 'BELUM BAYAR' dan kolom bayar 0, dan TIDAK pernah membaca data.dp_awal.
 * Jadi saat user pilih "Lunas/DP" waktu buat booking, uangnya diabaikan →
 * tidak masuk ke menu Uang / Pendapatan.
 *
 * SOLUSI: setelah booking dibuat & financial-nya dihitung, kalau dp_awal > 0,
 * catat pembayaran lewat fungsi submitPayment() yang SUDAH ADA (yang juga
 * dipakai tombol "Catat Pembayaran"). Itu akan menulis ke sheet PAYMENTS +
 * mengubah status bayar jadi DP/LUNAS otomatis.
 *
 * CARA PASANG (pilih salah satu):
 *  A) Ganti fungsi submitBooking lama Anda dengan versi di bawah (sudah
 *     lengkap, cuma menambah 1 blok sebelum `return`), ATAU
 *  B) Cukup TEMPEL blok "=== Catat pembayaran awal ===" di bawah ini, ke
 *     dalam submitBooking Anda, TEPAT SETELAH baris:
 *         updateBookingFinancials_(bookingId);
 *     dan SEBELUM baris `return { ... }`.
 *
 * Lalu Deploy ulang web app (Manage deployments → Edit → New version → Deploy).
 *
 * CATATAN: ini memanggil submitPayment(...) Anda. Kalau nama/parameter fungsi
 * pembayaran Anda beda, sesuaikan pemanggilannya. Field dikirim dalam bentuk
 * camelCase + snake_case sekaligus supaya cocok dengan apa pun yang dibaca
 * submitPayment.
 *******************************************************/

/* ===== BLOK YANG DITAMBAHKAN (taruh setelah updateBookingFinancials_) ===== */
/*
  // === Catat pembayaran awal (DP/Lunas) supaya uang langsung masuk ===
  var _dpAwal = Number(data.dp_awal || data.dpAwal || 0);
  if (_dpAwal > 0) {
    try {
      var _lunas = _dpAwal >= hargaTotalNet;
      submitPayment({
        bookingId: bookingId,
        booking_id: bookingId,
        nominal: _dpAwal,
        jenisBayar: _lunas ? 'PELUNASAN' : 'DP',
        jenis_bayar: _lunas ? 'PELUNASAN' : 'DP',
        metode: data.dp_metode || data.dpMetode || 'CASH',
        diterimaOleh: data.diterima_oleh || data.diterimaOleh || '',
        diterima_oleh: data.diterima_oleh || data.diterimaOleh || '',
        tanggalBayar: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd'),
        tanggal_bayar: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd'),
        catatan: 'Pembayaran awal saat booking dibuat'
      });
    } catch (e) {
      Logger.log('submitBooking: gagal catat pembayaran awal: ' + e);
    }
  }
*/


/* ===== VERSI LENGKAP (kalau mau langsung ganti fungsi lama Anda) =====
 * Sama persis dengan punya Anda, hanya menambah blok di atas sebelum return.
 */
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

  // === Catat pembayaran awal (DP/Lunas) supaya uang langsung masuk ===
  var _dpAwal = Number(data.dp_awal || data.dpAwal || 0);
  if (_dpAwal > 0) {
    try {
      var _lunas = _dpAwal >= hargaTotalNet;
      submitPayment({
        bookingId: bookingId,
        booking_id: bookingId,
        nominal: _dpAwal,
        jenisBayar: _lunas ? 'PELUNASAN' : 'DP',
        jenis_bayar: _lunas ? 'PELUNASAN' : 'DP',
        metode: data.dp_metode || data.dpMetode || 'CASH',
        diterimaOleh: data.diterima_oleh || data.diterimaOleh || '',
        diterima_oleh: data.diterima_oleh || data.diterimaOleh || '',
        tanggalBayar: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd'),
        tanggal_bayar: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd'),
        catatan: 'Pembayaran awal saat booking dibuat'
      });
    } catch (e) {
      Logger.log('submitBooking: gagal catat pembayaran awal: ' + e);
    }
  }

  return {
    success: true,
    message: existingActiveBookings.length > 0
      ? `Booking berhasil dibuat untuk ${room.Nama_Kamar}, tapi kamar ini sebelumnya sudah aktif. Cek catatan booking.`
      : `Booking berhasil dibuat untuk ${room.Nama_Kamar}.`,
    bookingId: bookingId,
    warning: activeWarning
  };
}
