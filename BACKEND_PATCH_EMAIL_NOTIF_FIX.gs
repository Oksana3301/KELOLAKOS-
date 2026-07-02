/*******************************************************************
 * BACKEND_PATCH_EMAIL_NOTIF_FIX.gs — Top Hills
 * =================================================================
 * Perbaiki notifikasi EMAIL ke admin saat ada booking baru dari /info
 * yang selama ini TIDAK terkirim (gagal diam-diam).
 *
 * Penyebab tersering:
 *   1) Izin MailApp belum di-Allow → MailApp.sendEmail dilempar error
 *      "authorization required", lalu ditelan `catch(e){}` (senyap).
 *   2) ADMIN_EMAIL belum di-set → email tujuan kosong → tidak dikirim.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG:                                                   │
 * │ 1) Di apiv2.gs, GANTI 3 fungsi lama ini dengan versi di bawah: │
 * │      _adminEmail_ , setAdminEmail , _notifyAdminNewBooking_    │
 * │    lalu TAMBAH fungsi baru: diagEmail. (Save)                  │
 * │ 2) Di editor, pilih fungsi `diagEmail` → Run.                  │
 * │    → Muncul popup IZIN → klik Allow (izinkan kirim email).     │
 * │      *Langkah ini WAJIB* — tanpa ini email tak akan pernah     │
 * │      terkirim (senyap).                                        │
 * │ 3) Cek INBOX + folder SPAM: dewiatika4295@gmail.com            │
 * │    (harus ada email "✅ TES notifikasi Top Hills").            │
 * │ 4) Deploy → Manage deployments → Edit → New version → Deploy.  │
 * │ 5) Coba booking dari /info → email otomatis masuk.             │
 * │                                                                │
 * │ Kalau masih gagal: Run `diagEmail` lagi → View → Logs, atau    │
 * │ cek Project Settings → Script properties → LAST_MAIL_ERROR.    │
 * └───────────────────────────────────────────────────────────────┘
 * CATATAN: email HANYA terkirim untuk booking dari /info
 * (submitBookingRequest). Booking yang dibuat manual dari dashboard
 * ("Tambah Penyewa" = submitBooking) TIDAK memicu email ini.
 *******************************************************************/

/** Email admin: prioritas ScriptProperties ADMIN_EMAIL, lalu user aktif,
 *  lalu fallback KERAS supaya tidak pernah kosong. */
function _adminEmail_() {
  var p = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (p && p.indexOf('@') > 0) return p.trim();
  try {
    var u = Session.getEffectiveUser().getEmail();
    if (u && u.indexOf('@') > 0) return u;
  } catch (e) {}
  return 'dewiatika4295@gmail.com'; // ← GANTI bila email admin berbeda
}

function setAdminEmail() {
  var EMAIL = 'dewiatika4295@gmail.com'; // ← email admin/owner
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', EMAIL);
  Logger.log('ADMIN_EMAIL di-set: ' + EMAIL);
  return { ok: true, email: EMAIL };
}

/** Kirim notifikasi booking baru ke email admin.
 *  TIDAK menelan error diam-diam: dicatat ke Logger + Script property
 *  LAST_MAIL_ERROR / LAST_MAIL_OK supaya bisa didiagnosa. */
function _notifyAdminNewBooking_(v, buktiUrl) {
  var to = _adminEmail_();
  try {
    if (!to) { Logger.log('notifyAdmin: email admin kosong'); return; }
    var tz = Session.getScriptTimeZone() || 'GMT+7';
    var waktu = Utilities.formatDate(new Date(), tz, 'dd MMM yyyy, HH:mm') + ' WIB';
    var layanan = String(v.Layanan || '').toUpperCase().indexOf('KOS') >= 0 ? 'Kost' : 'Penginapan';
    var wa = String(v.WhatsApp || '');
    var waLink = wa ? ((typeof _perpanjangNormWa_ === 'function') ? _perpanjangNormWa_(wa) : wa) : '';
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
    MailApp.sendEmail(to, subject, lines.join('\n'));
    PropertiesService.getScriptProperties().setProperty('LAST_MAIL_OK', to + ' @ ' + waktu);
    Logger.log('notifyAdmin: email terkirim ke ' + to);
  } catch (e) {
    PropertiesService.getScriptProperties().setProperty('LAST_MAIL_ERROR', String(e) + ' @ ' + new Date());
    Logger.log('notifyAdmin GAGAL: ' + e);
  }
}

/** Jalankan SEKALI dari editor untuk: set email, minta izin kirim email,
 *  dan kirim email UJI. Cek inbox + folder Spam. */
function diagEmail() {
  setAdminEmail();
  var to = _adminEmail_();
  var sisa = MailApp.getRemainingDailyQuota();
  Logger.log('Email admin terpakai : ' + to);
  Logger.log('Sisa kuota email hari ini: ' + sisa);
  MailApp.sendEmail(
    to,
    '✅ TES notifikasi Top Hills',
    'Kalau kamu terima email ini, notifikasi booking sudah AKTIF.\nWaktu: ' + new Date()
  );
  Logger.log('Email uji dikirim ke ' + to + ' — cek INBOX & folder SPAM.');
  return { ok: true, to: to, quotaSisa: sisa };
}
