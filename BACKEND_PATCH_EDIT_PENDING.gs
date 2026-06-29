/*******************************************************
 * PATCH EDIT BOOKING PENDING — ubah data booking "Menunggu Konfirmasi"
 * langsung dari /booking (owner/penjaga) TANPA harus mengubah status bayar.
 *
 * Bisa mengubah: nama, WhatsApp, kamar/tipe (pindah kamar), layanan,
 * durasi/paket, jumlah orang, tanggal masuk, catatan. Status booking tetap
 * MENUNGGU_KONFIRMASI sampai owner menekan Terima.
 *
 * ============================================================
 *  CARA PASANG
 * ============================================================
 * 1) Tempel SELURUH isi file ini ke project Apps Script (file/tab baru).
 *    (Memakai _setBookingStatus_ & _perpanjangNormWa_ dari patch Perpanjang.)
 * 2) Di apiv2.gs → dispatchV2_(action, payload), tambahkan 1 case sebelum
 *    "default:":
 *      case 'editPendingBooking': return editPendingBooking(payload);
 * 3) Save → Deploy ulang (Manage deployments → Edit → New version → Deploy).
 *
 * Catatan: ini aksi INTERNAL (owner) → JANGAN dimasukkan WHITELIST_ACTIONS.
 *******************************************************/

function editPendingBooking(data) {
  data = data || {};
  var id = String(data.bookingId || data.booking_id || '').trim();
  if (!id) throw new Error('bookingId wajib diisi');

  var updates = {};
  if (data.nama !== undefined)        updates.Nama_Customer = data.nama;
  if (data.whatsapp !== undefined)    updates.WhatsApp = (typeof _perpanjangNormWa_ === 'function')
                                        ? _perpanjangNormWa_(data.whatsapp) : String(data.whatsapp);
  if (data.roomId !== undefined && String(data.roomId) !== '') updates.RoomID = data.roomId;
  if (data.kamar !== undefined && String(data.kamar) !== '') {
    // "Nama — Gedung" → pisah jadi Nama_Kamar & Gedung.
    var kamar = String(data.kamar);
    var namaKamar = kamar, gedung = '';
    var parts = kamar.split('—');
    if (parts.length >= 2) { namaKamar = parts[0].trim(); gedung = parts.slice(1).join('—').trim(); }
    updates.Nama_Kamar = namaKamar;
    updates.Gedung = gedung;
  }
  if (data.tipe !== undefined)        updates.Tipe_Kamar = data.tipe;
  if (data.layanan !== undefined)     updates.Layanan = String(data.layanan).toUpperCase();
  if (data.durasi !== undefined)     { updates.Paket = data.durasi; updates.Durasi = data.durasi; }
  if (data.jumlahOrang !== undefined) updates.Jumlah_Orang = Number(data.jumlahOrang) || 1;
  if (data.tglMulai !== undefined)    updates.CheckIn = data.tglMulai;
  if (data.catatan !== undefined)     updates.Catatan = data.catatan;

  // Bukti bayar: HAPUS atau GANTI (upload baru → Drive). Pakai _buktiBookingFolder_
  // dari patch Perpanjang. Gagal-aman: error upload tak menggagalkan edit lain.
  if (data.hapusBukti) {
    updates.Bukti_Bayar = '';
  } else if (data.buktiFile && data.buktiFile.base64 && typeof _buktiBookingFolder_ === 'function') {
    try {
      var bf = data.buktiFile;
      var blob = Utilities.newBlob(Utilities.base64Decode(bf.base64), bf.mimeType || 'image/jpeg', id + '-' + (bf.name || 'bukti'));
      var file = _buktiBookingFolder_().createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      updates.Bukti_Bayar = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    } catch (e) {}
  }

  if (typeof _setBookingStatus_ !== 'function') {
    throw new Error('_setBookingStatus_ belum ada — pastikan patch Perpanjang sudah terpasang.');
  }
  return _setBookingStatus_(id, updates); // { ok, bookingId }
}
