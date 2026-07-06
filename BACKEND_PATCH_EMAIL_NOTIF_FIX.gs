/*******************************************************************
 * BACKEND_PATCH_EMAIL_NOTIF_FIX.gs — Top Hills
 * =================================================================
 * Notifikasi ADMIN saat ada booking baru dari /info.
 *   • EMAIL ke SEMUA admin (default: dewiatika4295 + kostputritophills)
 *   • WA ke nomor admin/helpdesk (waResmi) — SELAIN WA ke Mezi
 *     (WA Mezi tetap lewat _notifyMeziNewBooking_ di file booking, tak diubah).
 *
 * Dipicu otomatis oleh submitBookingRequest (baris `_notifyAdminNewBooking_(vals,…)`).
 * SIGNATURE SAMA (v, buktiUrl) → submitBookingRequest TIDAK perlu diubah.
 *
 * Sumber alamat (semua bisa dioverride via Script Properties):
 *   • ADMIN_EMAILS  (comma) — default dewiatika4295@gmail.com,kostputritophills@gmail.com
 *   • ADMIN_WA               — default 628116646615  (= waResmi, src/lib/halaman-info.ts)
 *   • FONNTE_TOKEN           — WAJIB terisi supaya WA jalan (tanpa ini WA gagal senyap)
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG (preview dulu — belum kirim apa pun):              │
 * │ 1) Di apiv2.gs, GANTI _adminEmail_ + setAdminEmail +           │
 * │    _notifyAdminNewBooking_ yang LAMA dengan versi di file ini,  │
 * │    dan TAMBAH fungsi baru (_adminEmails_, _adminWa_, dst). Save.│
 * │ 2) PREVIEW: Run `previewNotifAdmin` → cek Logs.                 │
 * │    → pastikan emailKe = 2 email benar, waKe = 628116646615,     │
 * │      fonnteToken = ADA. TIDAK ada yang dikirim di langkah ini.  │
 * │ 3) TES kirim beneran: Run `testNotifAdmin` → klik Allow (izin   │
 * │    email) → cek 2 inbox + WA admin. (Cek juga folder Spam.)     │
 * │ 4) Deploy → Manage deployments → New version → Deploy.          │
 * │ 5) Booking dari /info → admin dapat Email (2 alamat) + WA.      │
 * └───────────────────────────────────────────────────────────────┘
 * CATATAN: notif ini HANYA untuk booking /info (submitBookingRequest).
 * Booking manual dari dashboard (submitBooking) TIDAK memicu ini —
 * untuk itu pakai tombol "Kirim ke Customer" (kirimKeCustomerManual).
 *******************************************************************/

/* ── Email admin (SATU, kompat lama) ─────────────────────────────
 * Prioritas ScriptProperties ADMIN_EMAIL → user aktif → fallback keras. */
function _adminEmail_() {
  var p = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (p && p.indexOf('@') > 0) return p.trim();
  try {
    var u = Session.getEffectiveUser().getEmail();
    if (u && u.indexOf('@') > 0) return u;
  } catch (e) {}
  return 'dewiatika4295@gmail.com'; // ← GANTI bila email admin berbeda
}

/* ── Email admin (DAFTAR — booking baru dikirim ke SEMUA ini) ─────
 * ADMIN_EMAILS (comma/semicolon/spasi) bila di-set; else union
 * _adminEmail_() + email resmi kost. Dedupe, buang yang bukan email. */
function _adminEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  var list = raw.split(/[,;\s]+/).map(function (s) { return s.trim(); })
    .filter(function (s) { return s.indexOf('@') > 0; });
  if (!list.length) list = [_adminEmail_(), 'kostputritophills@gmail.com'];
  var seen = {}, out = [];
  list.forEach(function (e) {
    var k = e.toLowerCase();
    if (e.indexOf('@') > 0 && !seen[k]) { seen[k] = 1; out.push(e); }
  });
  return out;
}

function setAdminEmail() {
  var EMAIL = 'dewiatika4295@gmail.com'; // ← email admin/owner (SATU)
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', EMAIL);
  Logger.log('ADMIN_EMAIL di-set: ' + EMAIL);
  return { ok: true, email: EMAIL };
}

function setAdminEmails() {
  var EMAILS = 'dewiatika4295@gmail.com, kostputritophills@gmail.com'; // ← daftar admin (koma)
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAILS', EMAILS);
  Logger.log('ADMIN_EMAILS di-set: ' + EMAILS);
  return { ok: true, emails: _adminEmails_() };
}

/* ── Nomor WA admin/helpdesk (SELAIN Mezi) ───────────────────────
 * ADMIN_WA bila di-set → normalisasi; else waResmi dari HalamanInfo;
 * else fallback 628116646615 (waResmi, src/lib/halaman-info.ts). */
function _adminNotifNormWa_(v) {
  if (typeof _perpanjangNormWa_ === 'function') { try { var r = _perpanjangNormWa_(v); if (r) return r; } catch (e) {} }
  var s = String(v || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.charAt(0) === '0') s = '62' + s.slice(1);
  else if (s.indexOf('62') !== 0 && s.charAt(0) === '8') s = '62' + s;
  return s;
}

function _adminWa_() {
  var p = PropertiesService.getScriptProperties().getProperty('ADMIN_WA');
  if (p) return _adminNotifNormWa_(p);
  try { if (typeof v2_getHalamanInfo === 'function') { var hi = v2_getHalamanInfo(); if (hi && hi.waResmi) return _adminNotifNormWa_(hi.waResmi); } } catch (e) {}
  return '628116646615'; // waResmi (src/lib/halaman-info.ts)
}

function setAdminWa() {
  var WA = '628116646615'; // ← nomor admin/helpdesk (waResmi)
  var norm = _adminNotifNormWa_(WA);
  PropertiesService.getScriptProperties().setProperty('ADMIN_WA', norm);
  Logger.log('ADMIN_WA di-set: ' + norm);
  return { ok: true, wa: norm };
}

/* ── Kirim WA (reuse _sendWa_/_fonnteSend_ bila ada; else langsung Fonnte) ── */
function _adminNotifSendWa_(to, msg) {
  if (!to) return { ok: false, error: 'target kosong' };
  if (typeof _sendWa_ === 'function') { try { return _sendWa_(to, msg); } catch (e) {} }
  if (typeof _fonnteSend_ === 'function') { try { return _fonnteSend_(to, msg); } catch (e) {} }
  var token = '';
  try { token = (typeof _fonnteToken_ === 'function') ? _fonnteToken_() : (PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || ''); } catch (e) {}
  if (!token) return { ok: false, error: 'FONNTE_TOKEN kosong' };
  try {
    var res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post', headers: { Authorization: token },
      payload: { target: String(to), message: String(msg) }, muteHttpExceptions: true,
    });
    return { ok: res.getResponseCode() === 200, code: res.getResponseCode(), body: res.getContentText() };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/* ── Notifikasi booking baru → EMAIL (semua admin) + WA (admin/helpdesk).
 *  Tiap kanal try/catch sendiri + dicatat ke Script property biar bisa dicek. */
function _notifyAdminNewBooking_(v, buktiUrl) {
  var props = PropertiesService.getScriptProperties();
  var tz = Session.getScriptTimeZone() || 'GMT+7';
  var waktu = Utilities.formatDate(new Date(), tz, 'dd MMM yyyy, HH:mm') + ' WIB';
  var layanan = String(v.Layanan || '').toUpperCase().indexOf('KOS') >= 0 ? 'Kost' : 'Penginapan';
  var wa = String(v.WhatsApp || '');
  var waLink = wa ? _adminNotifNormWa_(wa) : '';

  // ---- EMAIL ke SEMUA admin ----
  try {
    var emails = _adminEmails_();
    if (emails.length) {
      var subject = '🔔 Booking baru Top Hills — ' + (v.Nama_Customer || '(tanpa nama)') + ' · ' + (v.Nama_Kamar || '');
      var lines = [
        'Ada booking baru masuk dari halaman /info:', '',
        'Nama        : ' + (v.Nama_Customer || '-'),
        'WhatsApp    : ' + (wa || '-'),
        'Layanan     : ' + layanan,
        'Kamar       : ' + (v.Nama_Kamar || '-') + (v.Gedung ? (' · ' + v.Gedung) : ''),
        'Paket/durasi: ' + (v.Paket || v.Durasi || '-'),
        'Jumlah orang: ' + (v.Jumlah_Orang || 1),
        'Catatan     : ' + (v.Catatan || '-'),
        'Bukti bayar : ' + (buktiUrl || '(tidak ada)'),
        'Booking ID  : ' + (v.BookingID || '-'),
        'Masuk       : ' + waktu, '',
        (waLink ? ('Chat customer: https://wa.me/' + waLink) : ''), '',
        'Buka dashboard /booking → "Butuh Konfirmasi" untuk Terima / Tolak.',
      ].filter(function (x) { return x !== null && x !== undefined && x !== false; });
      MailApp.sendEmail(emails.join(','), subject, lines.join('\n'));
      props.setProperty('LAST_MAIL_OK', emails.join(',') + ' @ ' + waktu);
      Logger.log('notifyAdmin EMAIL → ' + emails.join(', '));
    } else {
      Logger.log('notifyAdmin: daftar email admin kosong');
    }
  } catch (e) {
    props.setProperty('LAST_MAIL_ERROR', String(e) + ' @ ' + new Date());
    Logger.log('notifyAdmin EMAIL GAGAL: ' + e);
  }

  // ---- WA ke admin/helpdesk (selain Mezi) ----
  try {
    var adminWa = _adminWa_();
    if (adminWa) {
      var waMsg = [
        '🔔 *Booking baru Top Hills*', '',
        'Nama: ' + (v.Nama_Customer || '-'),
        'WhatsApp: ' + (wa || '-'),
        'Layanan: ' + layanan,
        'Kamar: ' + (v.Nama_Kamar || '-') + (v.Gedung ? (' · ' + v.Gedung) : ''),
        'Paket: ' + (v.Paket || v.Durasi || '-'),
        'Jumlah orang: ' + (v.Jumlah_Orang || 1),
        'ID: ' + (v.BookingID || '-'),
        'Masuk: ' + waktu, '',
        (waLink ? ('Chat customer: https://wa.me/' + waLink) : ''),
        'Buka dashboard /booking → "Butuh Konfirmasi".',
      ].filter(function (x) { return x !== null && x !== undefined && x !== ''; }).join('\n');
      var r = _adminNotifSendWa_(adminWa, waMsg);
      if (r && r.ok) { props.setProperty('LAST_ADMIN_WA_OK', adminWa + ' @ ' + waktu); Logger.log('notifyAdmin WA → ' + adminWa); }
      else { props.setProperty('LAST_ADMIN_WA_ERROR', JSON.stringify(r) + ' @ ' + waktu); Logger.log('notifyAdmin WA GAGAL: ' + JSON.stringify(r)); }
    }
  } catch (e) {
    props.setProperty('LAST_ADMIN_WA_ERROR', String(e) + ' @ ' + new Date());
    Logger.log('notifyAdmin WA GAGAL: ' + e);
  }
}

/* ── PREVIEW (TIDAK mengirim apa pun) — jalankan DULU ────────────── */
function previewNotifAdmin() {
  var props = PropertiesService.getScriptProperties();
  var out = {
    emailKe: _adminEmails_(),
    waKe: _adminWa_(),
    fonnteToken: (props.getProperty('FONNTE_TOKEN') ? 'ADA' : 'KOSONG ← WA admin akan GAGAL'),
    sisaKuotaEmail: (function () { try { return MailApp.getRemainingDailyQuota(); } catch (e) { return 'n/a'; } })(),
    last: {
      mailOk: props.getProperty('LAST_MAIL_OK') || '(belum)',
      mailErr: props.getProperty('LAST_MAIL_ERROR') || '(tidak ada)',
      adminWaOk: props.getProperty('LAST_ADMIN_WA_OK') || '(belum)',
      adminWaErr: props.getProperty('LAST_ADMIN_WA_ERROR') || '(tidak ada)',
    },
    catatan: 'PREVIEW — tidak mengirim. emailKe=penerima email admin, waKe=nomor WA admin. Cek benar sebelum testNotifAdmin.',
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/* ── TES kirim beneran (email ke semua admin + WA admin) ─────────── */
function testNotifAdmin() {
  var sample = {
    Nama_Customer: '(TES) Dewi Atika', WhatsApp: '628116646615', Layanan: 'PENGINAPAN',
    Nama_Kamar: 'D01', Gedung: 'Gedung C', Paket: '2 malam', Jumlah_Orang: 2,
    Catatan: 'tes notifikasi admin — abaikan', BookingID: 'TH-REQ-TEST',
  };
  _notifyAdminNewBooking_(sample, '');
  var out = { ok: true, emailKe: _adminEmails_(), waKe: _adminWa_() };
  Logger.log('testNotifAdmin → ' + JSON.stringify(out));
  return out;
}

/* ── (lama) diag email admin tunggal — masih dipertahankan ───────── */
function diagEmail() {
  var to = _adminEmail_();
  var sisa = MailApp.getRemainingDailyQuota();
  Logger.log('Email admin (tunggal): ' + to + ' · sisa kuota: ' + sisa);
  MailApp.sendEmail(to, '✅ TES notifikasi Top Hills', 'Notifikasi email AKTIF.\nWaktu: ' + new Date());
  Logger.log('Email uji dikirim ke ' + to + ' — cek INBOX & SPAM.');
  return { ok: true, to: to, quotaSisa: sisa };
}
