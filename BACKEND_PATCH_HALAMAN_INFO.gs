/*******************************************************
 * PATCH HALAMAN INFO — konten + foto/video halaman publik /info
 *
 * Menambah 3 endpoint (dipasang di apiv2.gs, modul v2 kamu):
 *   - getHalamanInfo   : baca konten (HARUS publik / tanpa access code)
 *   - saveHalamanInfo  : simpan konten (owner, ada access code)
 *   - uploadInfoMedia  : upload 1 foto/video ke Drive -> balikin URL publik
 *
 * Sheet baru otomatis dibuat: "HalamanInfo" (key | value | updated_at).
 * Konten disimpan sebagai 1 baris JSON (key = 'json').
 *
 * ============================================================
 *  CARA PASANG (di apiv2.gs)
 * ============================================================
 * 1) Tempel SEMUA fungsi di bawah ini ke bagian bawah apiv2.gs.
 * 2) Di fungsi dispatchV2_(action, payload), tambahkan 3 case ini di dalam
 *    switch (sebelum "default:"):
 *
 *      case 'getHalamanInfo':   return { ok: true, data: v2_getHalamanInfo() };
 *      case 'saveHalamanInfo':  return v2_saveHalamanInfo(payload);
 *      case 'uploadInfoMedia':  return v2_uploadInfoMedia(payload);
 *
 * 3) PENTING — buat getHalamanInfo BISA DIBUKA TANPA ACCESS CODE (publik),
 *    supaya halaman /info (pengunjung umum) bisa membacanya. Di router utama
 *    (Api.gs) kamu, cari tempat action publik diizinkan (yang sama dengan
 *    'verifyAccessCode' / skipLicense) lalu IZINKAN juga 'getHalamanInfo'.
 *    Contoh pola (sesuaikan dengan kode kamu):
 *
 *      var PUBLIC_ACTIONS = ['verifyAccessCode', 'getHalamanInfo'];
 *      // ...lalu lewati cek lisensi kalau action ada di PUBLIC_ACTIONS.
 *
 *    Kalau langkah 3 belum dilakukan, halaman /info tetap JALAN (pakai konten
 *    bawaan), tapi edit/foto kamu belum tampil ke pengunjung umum.
 *
 * 4) Save -> Deploy ulang (Manage deployments > Edit > New version > Deploy).
 *
 * Kalau mau aku wiring-kan langkah 2 & 3 persis, paste Api.gs (router) kamu.
 *******************************************************/

var HALAMAN_INFO_SHEET = 'HalamanInfo';
var HALAMAN_INFO_FOLDER = 'KelolaKos HalamanInfo';

// Baca konten (object). Kosong -> {} (frontend pakai default).
function v2_getHalamanInfo() {
  try {
    var sh = v2_getOrCreateSheet_(HALAMAN_INFO_SHEET, ['key', 'value', 'updated_at']);
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === 'json') {
        try { return JSON.parse(String(data[i][1] || '{}')); } catch (e) { return {}; }
      }
    }
    return {};
  } catch (e) {
    return {};
  }
}

// Simpan konten. payload.json = string JSON dari seluruh objek konten.
function v2_saveHalamanInfo(payload) {
  var sh = v2_getOrCreateSheet_(HALAMAN_INFO_SHEET, ['key', 'value', 'updated_at']);
  var json = (payload && payload.json) ? String(payload.json) : '{}';
  // Cari baris 'json', update; kalau tidak ada, append.
  var data = sh.getDataRange().getValues();
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === 'json') { rowIdx = i + 1; break; }
  }
  if (rowIdx > 0) {
    sh.getRange(rowIdx, 1, 1, 3).setValues([['json', json, v2_now_()]]);
  } else {
    sh.appendRow(['json', json, v2_now_()]);
  }
  return { ok: true };
}

// Upload 1 berkas (foto/video) ke Drive, balikin URL yang bisa dibuka publik.
// payload.file = { name, mimeType, size, base64 }
function v2_uploadInfoMedia(payload) {
  var f = payload && payload.file;
  if (!f || !f.base64) return { ok: false, error: 'Tidak ada berkas.' };

  var folder = v2_infoFolder_();
  var mime = f.mimeType || 'application/octet-stream';
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyyMMdd-HHmmss');
  var name = stamp + '-' + String(f.name || 'media').replace(/[^\w.\-]+/g, '_');

  var bytes = Utilities.base64Decode(f.base64);
  var blob = Utilities.newBlob(bytes, mime, name);
  var file = folder.createFile(blob);

  // Bisa dibuka lewat link (supaya muncul di halaman publik).
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* abaikan kalau policy domain melarang */ }

  var id = file.getId();
  // URL yang langsung bisa dipakai di <img>/<video> (bukan halaman preview Drive).
  var url = 'https://drive.google.com/uc?export=view&id=' + id;
  return { ok: true, url: url, id: id, name: name };
}

function v2_infoFolder_() {
  var it = DriveApp.getFoldersByName(HALAMAN_INFO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(HALAMAN_INFO_FOLDER);
}
