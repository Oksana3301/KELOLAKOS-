/*******************************************************************
 * BACKEND_PATCH_EDIT_BOOKING_MULTIBUKTI.gs — Top Hills
 * -----------------------------------------------------------------
 * Saat UBAH booking, simpan SEMUA bukti (bisa >1) dan tempelkan ke BookingID
 * yang benar — DITAMBAHKAN (append) ke bukti yang sudah ada, bukan menimpa.
 *
 * Konteks: waktu CREATE, bukti banyak sudah tersimpan ke kolom Bukti_URLs
 * (via submitBooking_bukti → handleBukti_). Tapi alur EDIT (editPendingBooking)
 * dulu hanya simpan 1 bukti ke Bukti_Bayar. Patch ini menutup gap itu.
 *
 * ================= CARA PASANG (2 langkah) =================
 * 1) Paste file ini sebagai .gs baru. (Butuh saveBuktiFiles_ dari
 *    BACKEND_PATCH_BUKTI.gs, _bookingFindById_ & _setBookingStatus_ dari
 *    apiv2.gs/Perpanjang — semuanya sudah ada di project kamu.)
 *
 * 2) Di apiv2.gs → dispatchV2_, UBAH baris case editPendingBooking menjadi:
 *
 *        case 'editPendingBooking': return editPendingBooking_multibukti_(payload);
 *
 *    (Sebelumnya: `return editPendingBooking(payload);`. Wrapper ini memanggil
 *     editPendingBooking asli lalu menambah bukti-nya.)
 *
 * 3) Deploy → Manage deployments → ✏️ Edit → New version → Deploy.
 *
 * Frontend sudah kirim `bukti_files` (array) saat Ubah, dan preview sudah baca
 * Bukti_Bayar + Bukti_URLs → semua bukti tampil di slider.
 *******************************************************************/

function editPendingBooking_multibukti_(data) {
  data = data || {};
  // 1) Jalankan edit normal (nama/kamar/tanggal/dll + hapusBukti → kosongkan Bukti_Bayar).
  var res = editPendingBooking(data);

  var id = String(data.bookingId || data.booking_id || '').trim();
  if (!id) return res;

  try {
    // 2) Hapus bukti → kosongkan juga Bukti_URLs (Bukti_Bayar sudah dikosongkan editPendingBooking).
    if (data.hapusBukti) {
      if (typeof _setBookingStatus_ === 'function') _setBookingStatus_(id, { Bukti_URLs: '' });
      return res;
    }

    // 3) Ada file bukti baru → simpan SEMUA, lalu APPEND ke Bukti_URLs booking ini.
    var files = data.bukti_files || data.buktiFiles;
    if (files && files.length && typeof saveBuktiFiles_ === 'function') {
      var newUrls = saveBuktiFiles_(files, 'Booking', id) || [];

      var row = (typeof _bookingFindById_ === 'function') ? (_bookingFindById_(id) || {}) : {};
      var existing = String(row.Bukti_URLs || '')
        .split(/[\s,;|]+/).map(function (s) { return s.trim(); }).filter(Boolean);

      var merged = existing.concat(newUrls);
      var seen = {}, dedup = [];
      merged.forEach(function (u) { if (u && !seen[u]) { seen[u] = 1; dedup.push(u); } });

      var updates = { Bukti_URLs: dedup.join('\n') };
      // Jaga Bukti_Bayar tetap terisi (dipakai preview lama) kalau sebelumnya kosong.
      if (!String(row.Bukti_Bayar || '').trim() && dedup.length) updates.Bukti_Bayar = dedup[0];

      if (typeof _setBookingStatus_ === 'function') _setBookingStatus_(id, updates);
    }
  } catch (e) {
    Logger.log('editPendingBooking_multibukti_ simpan bukti gagal: ' + e);
  }
  return res;
}
