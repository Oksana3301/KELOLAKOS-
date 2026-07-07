/*******************************************************************
 * BACKEND_PATCH_EMAIL_NOTIF_FIX.gs — Top Hills
 * =================================================================
 * Notifikasi ADMIN via EMAIL saat ada booking baru dari /info.
 *   • EMAIL ke SEMUA admin (default: dewiatika4295 + kostputritophills).
 * (WA ke Mezi tetap lewat _notifyMeziNewBooking_ di file booking — TAK diubah.
 *  Keputusan owner: notif cukup Mezi (WA) + email admin; TANPA WA helpdesk.)
 *
 * Dipicu otomatis oleh submitBookingRequest (baris `_notifyAdminNewBooking_(vals,…)`).
 * SIGNATURE SAMA (v, buktiUrl) → submitBookingRequest TIDAK perlu diubah.
 *
 * Sumber alamat (override via Script Properties):
 *   • ADMIN_EMAILS (comma) — default dewiatika4295@gmail.com,kostputritophills@gmail.com
 *   • ADMIN_EMAIL           — dipakai kalau ADMIN_EMAILS kosong (kompat lama)
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG:                                                   │
 * │ 1) Di apiv2.gs, GANTI _adminEmail_ + setAdminEmail +           │
 * │    _notifyAdminNewBooking_ lama dengan versi file ini, dan     │
 * │    TAMBAH _adminEmails_, setAdminEmails, previewNotifAdmin,     │
 * │    testNotifAdmin. Save.                                        │
 * │ 2) PREVIEW: Run `previewNotifAdmin` → cek Logs (emailKe = 2     │
 * │    alamat benar? sisa kuota email?). TIDAK mengirim apa pun.    │
 * │ 3) TES: Run `testNotifAdmin` → klik Allow (izin email) → cek 2  │
 * │    inbox + folder Spam.                                         │
 * │ 4) Deploy → Manage deployments → New version → Deploy.          │
 * └───────────────────────────────────────────────────────────────┘
 * CATATAN: notif ini HANYA untuk booking /info (submitBookingRequest).
 * Booking manual dari dashboard TIDAK memicu ini.
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

/* ── Normalisasi nomor WA (buat link wa.me di isi email) ─────────── */
function _adminNotifNormWa_(v) {
  if (typeof _perpanjangNormWa_ === 'function') { try { var r = _perpanjangNormWa_(v); if (r) return r; } catch (e) {} }
  var s = String(v || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.charAt(0) === '0') s = '62' + s.slice(1);
  else if (s.indexOf('62') !== 0 && s.charAt(0) === '8') s = '62' + s;
  return s;
}

/* ── Notifikasi booking baru → EMAIL ke SEMUA admin.
 *  Try/catch + jejak LAST_MAIL_OK / LAST_MAIL_ERROR biar bisa dicek. */
function _notifyAdminNewBooking_(v, buktiUrl) {
  var props = PropertiesService.getScriptProperties();
  try {
    var emails = _adminEmails_();
    if (!emails.length) { Logger.log('notifyAdmin: daftar email admin kosong'); return; }
    var tz = Session.getScriptTimeZone() || 'GMT+7';
    var waktu = Utilities.formatDate(new Date(), tz, 'dd MMM yyyy, HH:mm') + ' WIB';
    var layanan = String(v.Layanan || '').toUpperCase().indexOf('KOS') >= 0 ? 'Kost' : 'Penginapan';
    var wa = String(v.WhatsApp || '');
    var waLink = wa ? _adminNotifNormWa_(wa) : '';
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
  } catch (e) {
    props.setProperty('LAST_MAIL_ERROR', String(e) + ' @ ' + new Date());
    Logger.log('notifyAdmin EMAIL GAGAL: ' + e);
  }
}

/* ── PREVIEW (TIDAK mengirim apa pun) — jalankan DULU ────────────── */
function previewNotifAdmin() {
  var props = PropertiesService.getScriptProperties();
  var out = {
    emailKe: _adminEmails_(),
    sisaKuotaEmail: (function () { try { return MailApp.getRemainingDailyQuota(); } catch (e) { return 'n/a'; } })(),
    last: {
      mailOk: props.getProperty('LAST_MAIL_OK') || '(belum)',
      mailErr: props.getProperty('LAST_MAIL_ERROR') || '(tidak ada)',
    },
    catatan: 'PREVIEW — tidak mengirim. emailKe = penerima email admin. Cek benar sebelum testNotifAdmin.',
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/* ── TES kirim beneran (email ke semua admin) ────────────────────── */
function testNotifAdmin() {
  var sample = {
    Nama_Customer: '(TES) Dewi Atika', WhatsApp: '628116646615', Layanan: 'PENGINAPAN',
    Nama_Kamar: 'D01', Gedung: 'Gedung C', Paket: '2 malam', Jumlah_Orang: 2,
    Catatan: 'tes notifikasi admin — abaikan', BookingID: 'TH-REQ-TEST',
  };
  _notifyAdminNewBooking_(sample, '');
  var out = { ok: true, emailKe: _adminEmails_() };
  Logger.log('testNotifAdmin → ' + JSON.stringify(out));
  return out;
}

/* ── (lama) diag email admin tunggal — dipertahankan ─────────────── */
function diagEmail() {
  var to = _adminEmail_();
  var sisa = MailApp.getRemainingDailyQuota();
  Logger.log('Email admin (tunggal): ' + to + ' · sisa kuota: ' + sisa);
  MailApp.sendEmail(to, '✅ TES notifikasi Top Hills', 'Notifikasi email AKTIF.\nWaktu: ' + new Date());
  Logger.log('Email uji dikirim ke ' + to + ' — cek INBOX & SPAM.');
  return { ok: true, to: to, quotaSisa: sisa };
}
