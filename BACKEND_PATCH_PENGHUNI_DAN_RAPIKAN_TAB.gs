/*******************************************************
 * PATCH: (1) auto-isi sheet PENGHUNI saat booking baru
 *        (2) rapikan tab - sembunyikan sheet yang kosong / tak terpakai
 *
 * Semua ASCII (tanpa karakter aneh) supaya tidak ada "Invalid or unexpected
 * token" saat di-paste ke Apps Script.
 *
 * Fungsi yang diakhiri "_" itu PEMBANTU (private) - tidak muncul di dropdown
 * Run, itu normal. Yang muncul di dropdown: rapikanTabSheet().
 *******************************************************/

var PENGHUNI_SHEET = 'PENGHUNI';

/*******************************************************
 * BAGIAN 1 - AUTO ISI PENGHUNI
 *
 * PENTING (penyebab error "upsertPenghuni_ is not defined"):
 *   Error itu muncul kalau fungsi upsertPenghuni_ BELUM ADA di project yang
 *   sama saat submitBooking dipanggil. Pastikan:
 *     1) File .gs ini sudah di-PASTE ke project Apps Script yang SAMA, lalu
 *        SAVE (Ctrl+S). Satu project boleh banyak file .gs - semua fungsinya
 *        saling kenal.
 *     2) Setelah itu DEPLOY ULANG (Deploy > Manage deployments > Edit > Deploy)
 *        supaya Web App memakai kode terbaru.
 *
 * Panggil SATU baris ini di dalam submitBooking Anda, SETELAH bookingId &
 * data kamar (room) didapat dan SEBELUM return. PAKAI bentuk AMAN di bawah ini
 * supaya kalaupun fungsinya belum ada, booking TIDAK gagal:
 *
 *     if (typeof upsertPenghuni_ === 'function') upsertPenghuni_(data, bookingId, room);
 *
 * (Boleh juga langsung "upsertPenghuni_(data, bookingId, room);" kalau Anda
 *  yakin file ini sudah kepasang dan ke-save.)
 *
 * Keterangan argumen:
 *   data      = payload booking (punya .nama, .noHp, .checkIn, .checkOut, dst.)
 *   bookingId = id booking yang baru dibuat
 *   room      = objek/baris kamar (punya Nama_Kamar, Gedung) - boleh null
 *
 * Fungsi ini HEADER-AWARE: dia baca baris header sheet PENGHUNI lalu mengisi
 * kolom yang cocok namanya. Jadi urutan kolom Anda bebas. Kalau sheet PENGHUNI
 * belum ada, dibuat otomatis dengan header standar.
 *******************************************************/

function upsertPenghuni_(data, bookingId, room) {
  try {
    if (!data) return;
    var ss = _patchSS_();
    var sh = ss.getSheetByName(PENGHUNI_SHEET);
    if (!sh) {
      sh = ss.insertSheet(PENGHUNI_SHEET);
      sh.appendRow(['BookingID', 'Nama', 'No HP', 'Kamar', 'Gedung',
                    'Tanggal Masuk', 'Tanggal Keluar', 'Status', 'Dibuat']);
      sh.getRange(1, 1, 1, 9).setFontWeight('bold');
      sh.setFrozenRows(1);
    }

    // Nilai yang mau ditulis (ambil dari beberapa kemungkinan nama field).
    var nama   = data.nama || data.namaCustomer || data.customerName || '';
    var noHp   = data.noHp || data.no_hp || data.telepon || data.phone || data.hp || '';
    var kamar  = (room && (room.Nama_Kamar || room.nama_kamar)) || data.namaKamar || data.nama_kamar || '';
    var gedung = (room && (room.Gedung || room.gedung)) || data.gedung || '';
    var masuk  = data.checkIn || data.tanggalMasuk || data.tanggal_masuk || '';
    var keluar = data.checkOut || data.tanggalKeluar || data.tanggal_keluar || '';
    var status = data.statusBooking || data.status || 'AKTIF';

    // Peta nama-header (huruf kecil, tanpa spasi) -> nilai.
    var vals = {
      'bookingid': bookingId || '',
      'nama': nama,
      'namapenghuni': nama,
      'namacustomer': nama,
      'nohp': noHp,
      'notelepon': noHp,
      'telepon': noHp,
      'hp': noHp,
      'kamar': kamar,
      'namakamar': kamar,
      'gedung': gedung,
      'tanggalmasuk': masuk,
      'checkin': masuk,
      'masuk': masuk,
      'tanggalkeluar': keluar,
      'checkout': keluar,
      'keluar': keluar,
      'status': status,
      'dibuat': new Date(),
      'timestamp': new Date(),
      'waktu': new Date()
    };

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = header.map(function (h) {
      var key = String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return Object.prototype.hasOwnProperty.call(vals, key) ? vals[key] : '';
    });

    // Update kalau BookingID sudah ada, kalau tidak append baris baru.
    var idxBooking = -1;
    for (var c = 0; c < header.length; c++) {
      var k = String(header[c] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (k === 'bookingid') { idxBooking = c; break; }
    }
    var targetRow = 0;
    if (idxBooking >= 0 && bookingId && sh.getLastRow() > 1) {
      var col = sh.getRange(2, idxBooking + 1, sh.getLastRow() - 1, 1).getValues();
      for (var r = 0; r < col.length; r++) {
        if (String(col[r][0]) === String(bookingId)) { targetRow = r + 2; break; }
      }
    }
    if (targetRow > 0) {
      sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  } catch (e) {
    Logger.log('upsertPenghuni_ gagal: ' + e);
  }
}

/*******************************************************
 * BAGIAN 2 - RAPIKAN TAB (sembunyikan sheet kosong / tak terpakai)
 *
 * Jalankan rapikanTabSheet() dari dropdown Run. Dia akan SEMBUNYIKAN (bukan
 * hapus) tiap sheet yang:
 *   - tidak ada di daftar KEEP_SHEETS (sheet inti yang selalu tampil), DAN
 *   - tidak punya baris data (cuma header / benar-benar kosong).
 *
 * Aman: data tidak dihapus, cuma disembunyikan biar tab tidak ramai. Untuk
 * memunculkan lagi: klik kanan area tab -> Show sheet.
 *
 * SESUAIKAN daftar KEEP_SHEETS dengan nama tab inti Anda kalau perlu.
 *******************************************************/

var KEEP_SHEETS = [
  'BOOKING', 'PEMBAYARAN', 'KAMAR', 'HARGA', 'PENGHUNI',
  'UANG_MASUK', 'UANG_KELUAR', 'REFUND', 'FEE', 'BELANJA',
  'FASILITAS', 'PENGATURAN', 'KWITANSI', 'ACTIVITY_LOG'
];

function rapikanTabSheet() {
  var ss = _patchSS_();
  var sheets = ss.getSheets();
  var keepUpper = KEEP_SHEETS.map(function (s) { return s.toUpperCase(); });
  var disembunyikan = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var nama = sh.getName();
    if (keepUpper.indexOf(nama.toUpperCase()) >= 0) continue; // sheet inti, lewati
    var lastRow = sh.getLastRow();
    var kosong = (lastRow <= 1); // cuma header atau benar-benar kosong
    if (kosong && !sh.isSheetHidden()) {
      // Jangan sembunyikan kalau ini satu-satunya sheet yang terlihat.
      try { sh.hideSheet(); disembunyikan.push(nama); } catch (e) {}
    }
  }
  Logger.log('Tab disembunyikan (' + disembunyikan.length + '): ' + disembunyikan.join(', '));
  return disembunyikan;
}

// Kebalikannya: munculkan lagi semua sheet yang tersembunyi.
function tampilkanSemuaTab() {
  var ss = _patchSS_();
  var sheets = ss.getSheets();
  var n = 0;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].isSheetHidden()) { sheets[i].showSheet(); n++; }
  }
  Logger.log('Tab dimunculkan: ' + n);
  return n;
}

// Ambil spreadsheet dengan aman (pakai SPREADSHEET_ID kalau ada).
function _patchSS_() {
  try {
    if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
  } catch (e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}
