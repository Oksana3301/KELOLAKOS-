/**
 * PATCH PERPANJANG — lookup penyewa lama (publik, read-only) untuk fitur
 * "Perpanjang Kontrak" di /info/booking/perpanjang.
 *
 * ENDPOINT BARU:
 *   - lookupPenyewaByWa(data)   → array booking yang match nomor WA
 *   - lookupPenyewaById(data)   → 1 booking (atau null)
 * Keduanya WAJIB publik (tanpa access code), seperti getPublicRooms.
 *
 * ┌─ CARA DEPLOY (Apps Script editor) ────────────────────────────────────────┐
 * │ 1) Tempel seluruh isi file ini ke project Apps Script (paling bawah).      │
 * │ 2) Di router doPost/doGet, tambahkan 3 case:                               │
 * │      case 'lookupPenyewaByWa':    return { ok: true, data: lookupPenyewaByWa(data) };    │
 * │      case 'lookupPenyewaById':    return { ok: true, data: lookupPenyewaById(data) };    │
 * │      case 'submitBookingRequest': return { ok: true, data: submitBookingRequest(data) }; │
 * │ 3) Masukkan 3 action ini ke daftar PUBLIC (skip cek lisensi), sejajar      │
 * │    'getPublicRooms' / 'getHalamanInfo'. Contoh:                            │
 * │      var PUBLIC_ACTIONS = ['verifyAccessCode','getHalamanInfo','getPublicRooms', │
 * │        'lookupPenyewaByWa','lookupPenyewaById','submitBookingRequest'];    │
 * │ 4) Jalankan SEKALI fungsi tambahKolomTagPerpanjangan() (tambah kolom        │
 * │    'tag_perpanjangan' ke sheet BOOKINGS).                                   │
 * │ 5) Deploy ulang Web App (New deployment / kelola versi).                    │
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

/**
 * Submit booking dari halaman publik /info → tersimpan sebagai booking PENDING
 * (Status_Booking = MENUNGGU_KONFIRMASI, Status_Bayar = Belum Bayar).
 * Owner menerima/menolak manual via /booking. Header-driven append: hanya mengisi
 * kolom yang dikenal, sisanya dibiarkan kosong/0 — tidak mengubah struktur sheet.
 * Booking PENDING TIDAK memblokir kamar (harga di-set owner saat menerima).
 */
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

  var vals = {
    BookingID: id,
    Nama_Customer: data.nama || '',
    WhatsApp: _perpanjangNormWa_(data.whatsapp),
    Nama_Kamar: namaKamar,
    Gedung: gedung,
    Layanan: String(data.layanan || '').toUpperCase(),
    Paket: data.durasi || '',
    Durasi: data.durasi || '',
    CheckIn: data.tglMulai || '',
    Status_Booking: 'MENUNGGU_KONFIRMASI',
    Status_Bayar: 'Belum Bayar',
    Catatan: (data.catatan || '') + (data.jenis === 'perpanjang' ? ' [perpanjang/web]' : ' [baru/web]'),
    tag_perpanjangan: data.tagPerpanjangan || '',
    Timestamp: new Date()
  };

  var row = headers.map(function (h) { return Object.prototype.hasOwnProperty.call(vals, h) ? vals[h] : ''; });
  sh.appendRow(row);
  return { bookingId: id, message: 'Permintaan booking tersimpan (PENDING).' };
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
