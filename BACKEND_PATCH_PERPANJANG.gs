/**
 * PATCH PERPANJANG — lookup penyewa lama (publik, read-only) untuk fitur
 * "Perpanjang Kontrak" di /info/booking/perpanjang.
 *
 * ENDPOINT BARU:
 *   - lookupPenyewaByWa(data)   → array booking yang match nomor WA
 *   - lookupPenyewaById(data)   → 1 booking (atau null)
 * Keduanya WAJIB publik (tanpa access code), seperti getPublicRooms.
 *
 * ┌─ CARA DEPLOY (3 langkah, persis pola getPublicRooms) ─────────────────────┐
 * │ 1) Tempel SELURUH isi file ini ke project Apps Script (file/tab baru).      │
 * │ 2) Di apiv2.gs → dispatchV2_(action,payload), tambahkan 3 case sebelum      │
 * │    "default:" (SUDAH ditambahkan bila kamu re-paste APIV2_SIAP_PASTE.gs):  │
 * │      case 'lookupPenyewaByWa':    return { ok: true, data: lookupPenyewaByWa(payload) };    │
 * │      case 'lookupPenyewaById':    return { ok: true, data: lookupPenyewaById(payload) };    │
 * │      case 'submitBookingRequest': return { ok: true, data: submitBookingRequest(payload) }; │
 * │ 3) Di Api.gs → const WHITELIST_ACTIONS, tambahkan 3 baris (sama seperti     │
 * │    'getPublicRooms': true,) supaya bisa tanpa access code:                  │
 * │      'lookupPenyewaByWa': true,                                             │
 * │      'lookupPenyewaById': true,                                             │
 * │      'submitBookingRequest': true,                                          │
 * │ 4) Jalankan SEKALI tambahKolomTagPerpanjangan() (tambah kolom               │
 * │    'tag_perpanjangan' ke sheet BOOKINGS).                                   │
 * │ 5) Deploy ulang (Manage deployments → Edit → New version → Deploy).         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Catatan: pakai SHEETS.BOOKINGS & getSheetObjects_ (sama seperti getReportData).
 * Kalau di project-mu nama tab beda, sesuaikan SHEETS.BOOKINGS.
 */

// Normalisasi nomor WA → 62xxxx (digit saja). Cocokkan 08xx & 62xx & 8xx.
function _perpanjangNormWa_(raw) {
  var p = String(raw || '').replace(/[^0-9]/g, '');
  if (p.indexOf('0') === 0) p = '62' + p.slice(1);
  else if (p.indexOf('8') === 0) p = '62' + p;
  return p;
}

// Status yang TIDAK boleh muncul sebagai opsi perpanjang.
function _perpanjangStatusDibuang_(status) {
  var s = String(status || '').toUpperCase();
  return s.indexOf('BATAL') >= 0 || s.indexOf('CANCEL') >= 0 ||
         s.indexOf('TOLAK') >= 0 || s.indexOf('REJECT') >= 0;
}

function _perpanjangMap_(b) {
  var kamar = String(b.Nama_Kamar || '');
  if (b.Gedung) kamar += ' — ' + b.Gedung;
  return {
    bookingId: b.BookingID || '',
    nama: b.Nama_Customer || '',
    whatsapp: _perpanjangNormWa_(b.WhatsApp),
    layanan: String(b.Layanan || '').toUpperCase(),
    kamar: kamar,
    tipe: b.Tipe_Kamar || '',
    durasiTerakhir: b.Paket || b.Durasi || '',
    tglAkhirKontrak: b.CheckOut ? Utilities.formatDate(new Date(b.CheckOut), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    status: b.Status_Booking || ''
  };
}

/** Cari semua booking (non-batal) atas nomor WA. */
function lookupPenyewaByWa(data) {
  var wa = _perpanjangNormWa_(data && data.wa);
  if (!wa) return [];
  var rows = getSheetObjects_(SHEETS.BOOKINGS) || [];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var b = rows[i];
    if (_perpanjangNormWa_(b.WhatsApp) !== wa) continue;
    if (_perpanjangStatusDibuang_(b.Status_Booking)) continue;
    out.push(_perpanjangMap_(b));
  }
  // Urut: kontrak yang berakhir paling akhir di atas.
  out.sort(function (a, c) { return String(c.tglAkhirKontrak).localeCompare(String(a.tglAkhirKontrak)); });
  return out;
}

/** Cari 1 booking berdasarkan ID. Return objek atau null. */
function lookupPenyewaById(data) {
  var id = String((data && (data.bookingId || data.booking_id)) || '').trim();
  if (!id) return null;
  var rows = getSheetObjects_(SHEETS.BOOKINGS) || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].BookingID || '').trim() === id) {
      if (_perpanjangStatusDibuang_(rows[i].Status_Booking)) return null;
      return _perpanjangMap_(rows[i]);
    }
  }
  return null;
}

/** Cari booking AKTIF (non-batal) berdasarkan nomor/nama kamar — untuk Perpanjang
 *  ketika penyewa lupa WA & ID. Hanya kamar yang masih TERISI yang relevan. */
function lookupPenyewaByRoom(data) {
  var q = String((data && (data.kamar || data.room)) || '').trim().toLowerCase();
  if (!q) return [];
  // "Kamar 12A — Gedung A" → ambil bagian nama kamar saja untuk pencocokan.
  var qNama = q.split('—')[0].trim();
  var rows = getSheetObjects_(SHEETS.BOOKINGS) || [];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var b = rows[i];
    if (_perpanjangStatusDibuang_(b.Status_Booking)) continue;
    var nk = String(b.Nama_Kamar || '').trim().toLowerCase();
    if (nk !== qNama && nk !== q) continue;
    out.push(_perpanjangMap_(b));
  }
  out.sort(function (a, c) { return String(c.tglAkhirKontrak).localeCompare(String(a.tglAkhirKontrak)); });
  return out;
}

/**
 * Submit booking dari halaman publik /info → tersimpan sebagai booking PENDING
 * (Status_Booking = MENUNGGU_KONFIRMASI, Status_Bayar = Belum Bayar).
 * Owner menerima/menolak manual via /booking. Header-driven append: hanya mengisi
 * kolom yang dikenal, sisanya dibiarkan kosong/0 — tidak mengubah struktur sheet.
 * Booking PENDING TIDAK memblokir kamar (harga di-set owner saat menerima).
 */
function _buktiBookingFolder_() {
  var name = 'Top Hills Bukti Bayar';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function submitBookingRequest(data) {
  data = data || {};
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.BOOKINGS);
  if (!sh) throw new Error('Sheet BOOKINGS tidak ditemukan: ' + SHEETS.BOOKINGS);
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); });

  var id = 'TH-REQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  // "Nama — Gedung" → pisah.
  var kamar = String(data.kamar || '');
  var namaKamar = kamar, gedung = '';
  var parts = kamar.split('—');
  if (parts.length >= 2) { namaKamar = parts[0].trim(); gedung = parts.slice(1).join('—').trim(); }

  // Upload bukti bayar (kalau ada) → Drive → URL disimpan di row Booking (tab sama).
  var buktiUrl = '';
  if (data.bukti && data.bukti.base64) {
    try {
      var f = data.bukti;
      var blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType || 'image/jpeg', id + '-' + (f.name || 'bukti'));
      var file = _buktiBookingFolder_().createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      buktiUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    } catch (e) {}
  }

  var vals = {
    BookingID: id,
    Nama_Customer: data.nama || '',
    WhatsApp: _perpanjangNormWa_(data.whatsapp),
    Nama_Kamar: namaKamar,
    Gedung: gedung,
    Layanan: String(data.layanan || '').toUpperCase(),
    Paket: data.durasi || '',
    Durasi: data.durasi || '',
    Jumlah_Orang: Number(data.jumlahOrang) || 1,
    CheckIn: data.tglMulai || '',
    Status_Booking: 'MENUNGGU_KONFIRMASI',
    Status_Bayar: 'Belum Bayar',
    Bukti_Bayar: buktiUrl,
    Catatan: (data.catatan || '') + (data.jenis === 'perpanjang' ? ' [perpanjang/web]' : ' [baru/web]'),
    tag_perpanjangan: data.tagPerpanjangan || '',
    Timestamp: new Date()
  };

  var row = headers.map(function (h) { return Object.prototype.hasOwnProperty.call(vals, h) ? vals[h] : ''; });
  sh.appendRow(row);
  _notifyAdminNewBooking_(vals, buktiUrl); // email otomatis ke admin (gagal-aman)
  return { bookingId: id, buktiUrl: buktiUrl, message: 'Permintaan booking tersimpan (PENDING).' };
}

// ── Notifikasi EMAIL ke admin tiap ada booking baru dari /info ──────────────
// Set email tujuan: jalankan setAdminEmail() sekali (atau isi Script Property
// ADMIN_EMAIL). Bila kosong → fallback ke email pemilik script.
function _adminEmail_() {
  var p = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (p) return p;
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function setAdminEmail() {
  var EMAIL = 'dewiatika4295@gmail.com'; // ← GANTI ke email admin / Mezi
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', EMAIL);
  Logger.log('ADMIN_EMAIL di-set: ' + EMAIL);
  return { ok: true, email: EMAIL };
}

function _notifyAdminNewBooking_(v, buktiUrl) {
  try {
    var to = _adminEmail_();
    if (!to) return;
    var tz = Session.getScriptTimeZone() || 'GMT+7';
    var waktu = Utilities.formatDate(new Date(), tz, 'dd MMM yyyy, HH:mm') + ' WIB';
    var layanan = String(v.Layanan || '').toUpperCase().indexOf('KOS') >= 0 ? 'Kost' : 'Penginapan';
    var wa = String(v.WhatsApp || '');
    var subject = '🔔 Booking baru Top Hills — ' + (v.Nama_Customer || '(tanpa nama)') + ' · ' + (v.Nama_Kamar || '');
    var lines = [
      'Ada booking baru masuk dari halaman /info:',
      '',
      'Nama       : ' + (v.Nama_Customer || '-'),
      'WhatsApp   : ' + (wa || '-'),
      'Layanan    : ' + layanan,
      'Kamar      : ' + (v.Nama_Kamar || '-') + (v.Gedung ? (' · ' + v.Gedung) : ''),
      'Paket/durasi: ' + (v.Paket || v.Durasi || '-'),
      'Jumlah orang: ' + (v.Jumlah_Orang || 1),
      'Catatan    : ' + (v.Catatan || '-'),
      'Bukti bayar: ' + (buktiUrl || '(tidak ada)'),
      'Booking ID : ' + (v.BookingID || '-'),
      'Masuk      : ' + waktu,
      '',
      (wa ? ('Chat customer: https://wa.me/' + wa) : ''),
      '',
      'Buka dashboard /booking → "Butuh Konfirmasi" untuk Terima / Tolak.',
    ].filter(function (x) { return x !== null && x !== undefined; });
    MailApp.sendEmail(to, subject, lines.join('\n'));
  } catch (e) { /* jangan pernah ganggu proses booking */ }
}

// ── Konfirmasi booking online (internal /booking) ──────────────────────────
function getPendingBookings() {
  var rows = getSheetObjects_(SHEETS.BOOKINGS) || [];
  return rows.filter(function (b) {
    return String(b.Status_Booking || '').toUpperCase().indexOf('MENUNGGU') >= 0;
  });
}

function _setBookingStatus_(bookingId, updates) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.BOOKINGS);
  if (!sh) throw new Error('Sheet BOOKINGS tidak ditemukan: ' + SHEETS.BOOKINGS);
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h); });
  var idCol = headers.indexOf('BookingID');
  if (idCol < 0) throw new Error('Kolom BookingID tidak ada');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(bookingId).trim()) {
      Object.keys(updates).forEach(function (k) {
        var c = headers.indexOf(k);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(updates[k]);
      });
      return { ok: true, bookingId: bookingId };
    }
  }
  return { ok: false, error: 'Booking tidak ditemukan: ' + bookingId };
}

// Tambah bulan ke tanggal ISO (jaga akhir bulan). '' bila tak valid.
function _bookingAddBulan_(iso, months) {
  var d = new Date(String(iso) + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  var day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd');
}
// Jumlah bulan dari label paket ("6 Bulan"→6, "1 Tahun"/"Setahun"→12).
function _bookingPeriodeBulan_(paket) {
  var s = String(paket || '').toUpperCase();
  if (/TAHUN|SETAHUN/.test(s)) return 12;
  if (/6\s*BULAN|ENAM\s*BULAN/.test(s)) return 6;
  var m = s.match(/(\d+)\s*BULAN/);
  return m ? Number(m[1]) : 0;
}
function _bookingFindById_(id) {
  var rows = getSheetObjects_(SHEETS.BOOKINGS) || [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].BookingID || '').trim() === String(id).trim()) return rows[i];
  }
  return null;
}

function confirmBooking(data) {
  data = data || {};
  var status = (data.status === 'Lunas') ? 'Lunas' : 'DP';
  var updates = { Status_Booking: 'AKTIF', Status_Bayar: status };

  // ── Isi kolom UANG dari estimasi/DP yang dikirim frontend (booking /info tadinya
  //    cuma punya teks di Catatan). Supaya total, dibayar, & SISA benar di invoice.
  var total = Number(data.total) || 0;
  var dibayar = (data.dibayar === undefined || data.dibayar === null) ? 0 : Number(data.dibayar) || 0;
  if (status === 'Lunas' && total > 0 && dibayar <= 0) dibayar = total;   // lunas → bayar penuh
  if (total > 0) {
    updates.Harga_Total_Net = total;
    updates.Net_Diterima = dibayar;
    updates.Total_Bayar = dibayar;
    updates.Sisa_Bayar = Math.max(0, total - dibayar);
  }

  // ── WAKTU KONFIRMASI (saat owner Terima) → disimpan untuk pesan/invoice WA
  //    yang akurat ("telah melakukan DP/Pelunasan pada <tgl jam>"). Simpan ISO.
  _ensureBookingCol_('Tgl_Pembayaran');
  updates.Tgl_Pembayaran = data.tglBayar || new Date().toISOString();

  // ── KOST + kunci tanggal (default ON) + LUNAS → CheckIn = tanggal pelunasan
  //    (atau hari ini), CheckOut = +periode. DP → tanggal dibiarkan kosong.
  try {
    var hi = (typeof v2_getHalamanInfo === 'function') ? v2_getHalamanInfo() : null;
    var lock = !hi || hi.kostKunciTanggal !== false; // default true
    if (lock && status === 'Lunas') {
      var b = _bookingFindById_(data.bookingId);
      if (b && String(b.Layanan || '').toUpperCase().indexOf('KOS') >= 0) {
        var tz = Session.getScriptTimeZone() || 'GMT+7';
        var ci = data.tglPelunasan || Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
        var bln = _bookingPeriodeBulan_(b.Paket || b.Durasi);
        updates.CheckIn = ci;
        var co = bln > 0 ? _bookingAddBulan_(ci, bln) : '';
        if (co) updates.CheckOut = co;
      }
    }
  } catch (e) {}

  return _setBookingStatus_(data.bookingId, updates);
}

// Pastikan kolom ada di sheet BOOKINGS (untuk kolom baru spt Tgl_Pembayaran).
function _ensureBookingCol_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.BOOKINGS);
  if (!sh) return;
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); });
  if (headers.indexOf(name) < 0) sh.getRange(1, lastCol + 1).setValue(name);
}

function rejectBooking(data) {
  data = data || {};
  return _setBookingStatus_(data.bookingId, { Status_Booking: 'DITOLAK' });
}

/**
 * (Jalankan SEKALI, untuk PR-2) Tambahkan kolom 'tag_perpanjangan' ke sheet
 * BOOKINGS bila belum ada. Aman dijalankan berulang (idempotent).
 */
function tambahKolomTagPerpanjangan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.BOOKINGS);
  if (!sh) throw new Error('Sheet BOOKINGS tidak ditemukan: ' + SHEETS.BOOKINGS);
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h); });
  if (headers.indexOf('tag_perpanjangan') >= 0) return 'Kolom tag_perpanjangan sudah ada.';
  sh.getRange(1, lastCol + 1).setValue('tag_perpanjangan');
  return 'Kolom tag_perpanjangan ditambahkan di kolom ' + (lastCol + 1) + '.';
}
