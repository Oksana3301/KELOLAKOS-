/*******************************************************************
 * BACKEND_PATCH_REMINDER_CHECKIN_CHECKOUT.gs — Top Hills
 * =================================================================
 * Reminder OTOMATIS via Google Apps Script time-trigger + Gmail + link
 * wa.me prefill. 100% GRATIS, jalan sendiri walau app ditutup.
 *
 *  • PENGINAPAN — email DIGEST harian ke owner & penjaga:
 *      - "hari-H pagi" (07:00): agenda check-in/checkout HARI INI.
 *      - "H-1 sore"   (17:00): agenda check-in/checkout BESOK.
 *      Tiap orang ada tombol wa.me prefill (klik 1× → kirim reminder).
 *      Aturan: check-in yang WAKTUNYA sudah lewat (>13.00) tidak diingatkan;
 *      yang masih DP (belum lunas) diingatkan sekalian pelunasan.
 *  • KOST — tiap tanggal 1 (08:00): laporan siapa yang checkout bulan ini
 *      + wa.me prefill "lanjut/engga" (lanjut → DP, engga → kabari Mezi).
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG:                                                   │
 * │ 1) Paste file ini sebagai .gs BARU. Save.                     │
 * │ 2) (kalau nama sheet booking-mu BUKAN 'Booking', ganti di      │
 * │    REM_CFG.bookingSheet di bawah).                            │
 * │ 3) Run `diagReminder` SEKALI → muncul popup izin → Allow       │
 * │    (izin kirim email). Cek INBOX + SPAM kedua email.          │
 * │ 4) Run `setupReminderTriggers` SEKALI → pasang jadwal otomatis.│
 * │ 5) Selesai. Tak perlu Deploy (trigger jalan sendiri).         │
 * │    Cek jadwal: menu ⏰ Triggers (kiri editor).                │
 * └───────────────────────────────────────────────────────────────┘
 *******************************************************************/

var REM_CFG = {
  bookingSheet: 'Booking',                                   // ← ganti bila nama sheet beda
  emails: ['dewiatika4295@gmail.com', 'kostputritophills@gmail.com'],
  checkinTime: '13.00',
  checkoutTime: '12.00',
};

/* ---------- util ---------- */
function _remTz_() { return Session.getScriptTimeZone() || 'GMT+7'; }
function _remFmt_(d, pat) { return Utilities.formatDate(d, _remTz_(), pat); }
function _remToday_() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function _remAddDays_(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function _remISO_(v) {
  if (v == null || v === '') return '';
  var d = (v instanceof Date) ? v : new Date(String(v));
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, _remTz_(), 'yyyy-MM-dd');
}
function _remTglID_(v) { var iso = _remISO_(v); if (!iso) return '-'; return _remFmt_(new Date(iso + 'T00:00:00'), 'd MMM yyyy'); }
function _remRp_(n) {
  n = Math.round(Number(n) || 0);
  var s = String(Math.abs(n)), out = '';
  while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
  return 'Rp' + (n < 0 ? '-' : '') + s + out;
}
function _remWa_(raw) {
  if (typeof _perpanjangNormWa_ === 'function') return _perpanjangNormWa_(raw);
  var p = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
  if (p.indexOf('0') === 0) p = '62' + p.slice(1);
  else if (p.indexOf('8') === 0) p = '62' + p;
  return p;
}
function _remWaUrl_(raw, text) {
  var p = _remWa_(raw), t = encodeURIComponent(text);
  return p ? ('https://wa.me/' + p + '?text=' + t) : ('https://wa.me/?text=' + t);
}
// Cari sheet booking secara robust: pakai SHEETS.BOOKINGS bila ada, lalu nama di
// REM_CFG, lalu auto-deteksi sheet mana pun yang punya kolom "BookingID".
function _remSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var s2 = ss.getSheetByName(REM_CFG.bookingSheet); if (s2) return s2;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var lc = all[i].getLastColumn(); if (lc < 1) continue;
    var H = all[i].getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h); });
    if (H.indexOf('BookingID') >= 0) return all[i];
  }
  throw new Error('Sheet booking tak ketemu (tak ada sheet dgn kolom BookingID). Set REM_CFG.bookingSheet manual. Sheet yang ada: ' + all.map(function (x) { return x.getName(); }).join(', '));
}
function _remRows_() {
  var sh = _remSheet_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var H = data[0].map(function (h) { return String(h); });
  return data.slice(1).map(function (r) { var o = {}; H.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}
function _remIsKost_(b) { return String(b.Layanan || '').toUpperCase().indexOf('KOS') >= 0; }
function _remActive_(b) {
  var s = String(b.Status_Booking || '').toUpperCase();
  return !(s.indexOf('BATAL') >= 0 || s.indexOf('CANCEL') >= 0 || s.indexOf('TOLAK') >= 0 || s.indexOf('REJECT') >= 0 || s.indexOf('MENUNGGU') >= 0);
}
function _remBayar_(b) {
  var total = Number(b.Harga_Total_Net || 0);
  var refund = Number(b.Refund_Total || 0);
  var net = b.Net_Diterima;
  // dibayar = net-of-refund: Net_Diterima bila terisi (cek eksplisit, bukan ||,
  // supaya nilai 0 tak jatuh ke Total_Bayar KOTOR), else Total_Bayar − Refund.
  var dibayar = (net === '' || net === null || net === undefined) ? Math.max(0, Number(b.Total_Bayar || 0) - refund) : Number(net || 0);
  var sisa = Math.max(0, total - dibayar);
  // LUNAS & DP murni dari uang (bukan Status_Bayar yang bisa basi / refund-blind).
  var lunas = total > 0 && sisa <= 0 && dibayar > 0;
  var dp = !lunas && dibayar > 0;
  return { total: total, dibayar: dibayar, sisa: sisa, lunas: lunas, dp: dp, refund: refund };
}
function _remKamar_(b) {
  return String(b.Nama_Kamar || '-') + (b.Gedung ? (' · ' + b.Gedung) : '') + (b.Tipe_Kamar ? (' (' + b.Tipe_Kamar + ')') : '');
}
function _remBtn_(wa, label) {
  return wa
    ? '<a href="' + wa + '" style="background:#1FAF55;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:bold;white-space:nowrap">' + label + '</a>'
    : '<span style="color:#c0392b">no WA</span>';
}

/* ============================================================== *
 *  PENGINAPAN — digest harian                                    *
 * ============================================================== */
function remindPenginapanPagi() { return _penginapanDigest_(0, 'HARI INI', false); }   // trigger 07:00
function remindPenginapanSore() { return _penginapanDigest_(1, 'BESOK', false); }       // trigger 17:00

function _penginapanDigest_(dayOffset, label, force) {
  var target = _remAddDays_(_remToday_(), dayOffset);
  var targetISO = _remFmt_(target, 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  var guardKey = 'REM_PNG_' + targetISO + '_' + label;
  if (!force && props.getProperty(guardKey)) { Logger.log('skip (sudah dikirim): ' + guardKey); return 'skip'; }

  var now = new Date();
  var skipCheckin = (dayOffset === 0 && Number(_remFmt_(now, 'H')) >= 13); // check-in hari ini yg jamnya sudah lewat
  var rows = _remRows_(), checkin = [], checkout = [];
  rows.forEach(function (b) {
    if (_remIsKost_(b) || !_remActive_(b)) return;
    if (!skipCheckin && _remISO_(b.CheckIn) === targetISO) checkin.push(b);
    if (_remISO_(b.CheckOut) === targetISO) checkout.push(b);
  });
  if (!checkin.length && !checkout.length) { Logger.log('tidak ada agenda penginapan ' + label); return 'kosong'; }

  var tglLabel = _remFmt_(target, 'EEEE, d MMMM yyyy');
  var subject = '🔔 Reminder Check-in/out Penginapan — ' + label + ' (' + tglLabel + ')';
  var html = _penginapanHtml_(tglLabel, label, checkin, checkout);
  MailApp.sendEmail({ to: REM_CFG.emails.join(','), subject: subject, htmlBody: html });
  props.setProperty(guardKey, 'sent @' + _remFmt_(now, 'yyyy-MM-dd HH:mm'));
  Logger.log('terkirim penginapan ' + label + ' → check-in ' + checkin.length + ', check-out ' + checkout.length);
  return 'terkirim';
}

function _pngRow_(b, kind) {
  var pay = _remBayar_(b), nama = String(b.Nama_Customer || '-'), kamarShort = String(b.Nama_Kamar || '');
  var statusTxt = pay.lunas ? '✅ LUNAS' : (pay.dp ? ('🟡 DP · sisa ' + _remRp_(pay.sisa)) : '⛔ Belum bayar');
  var msg;
  if (kind === 'checkin') {
    msg = pay.lunas
      ? ('Halo Kak ' + nama + ' 🌸 Reminder *check-in* Top Hills ' + _remTglID_(b.CheckIn) + ' di kamar ' + kamarShort + '. Check-in mulai ' + REM_CFG.checkinTime + ' WIB. Ditunggu ya 🙏')
      : ('Halo Kak ' + nama + ' 🌸 Reminder *check-in* Top Hills ' + _remTglID_(b.CheckIn) + ' di kamar ' + kamarShort + '. Sisa pelunasan *' + _remRp_(pay.sisa) + '* mohon dilunasi saat check-in ya. Check-in mulai ' + REM_CFG.checkinTime + ' WIB 🙏');
  } else {
    msg = 'Halo Kak ' + nama + ' 🌸 Reminder *check-out* Top Hills ' + _remTglID_(b.CheckOut) + ', maksimal jam ' + REM_CFG.checkoutTime + ' WIB dari kamar ' + kamarShort + '. Terima kasih sudah menginap 🌸';
  }
  var wa = _remWaUrl_(b.WhatsApp, msg);
  return '<tr>' +
    '<td style="padding:9px;border-bottom:1px solid #eee">' + nama + '<br><small style="color:#888">' + _remKamar_(b) + '</small></td>' +
    '<td style="padding:9px;border-bottom:1px solid #eee">' + (b.Paket || b.Durasi || '-') + '<br><small style="color:#888">' + statusTxt + '</small></td>' +
    '<td style="padding:9px;border-bottom:1px solid #eee;text-align:right">' + _remBtn_(b.WhatsApp ? wa : '', '💬 Kirim reminder') + '</td>' +
    '</tr>';
}
function _penginapanHtml_(tglLabel, label, checkin, checkout) {
  function sec(title, list, kind) {
    if (!list.length) return '';
    var rows = list.map(function (b) { return _pngRow_(b, kind); }).join('');
    return '<h3 style="margin:18px 0 6px;color:#0C0A09">' + title + ' (' + list.length + ')</h3>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>';
  }
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#0C0A09;max-width:640px">' +
    '<h2 style="margin:0 0 4px">🏨 Reminder Penginapan — ' + label + '</h2>' +
    '<div style="color:#888;margin-bottom:6px">' + tglLabel + '</div>' +
    sec('✅ Check-in', checkin, 'checkin') +
    sec('🚪 Check-out', checkout, 'checkout') +
    '<p style="color:#888;font-size:12px;margin-top:18px">⏰ Check-in mulai ' + REM_CFG.checkinTime + ' WIB · Check-out maksimal ' + REM_CFG.checkoutTime + ' WIB. Klik tombol hijau untuk kirim reminder ke tamu via WhatsApp.</p>' +
    '</div>';
}

/* ============================================================== *
 *  KOST — laporan checkout bulanan + reminder perpanjang         *
 * ============================================================== */
function remindKostBulanan() { return _kostBulanan_(false); }   // trigger tanggal 1, 08:00

function _kostBulanan_(force) {
  var now = new Date(), monthISO = _remFmt_(now, 'yyyy-MM');
  var props = PropertiesService.getScriptProperties(), guardKey = 'REM_KOST_' + monthISO;
  if (!force && props.getProperty(guardKey)) return 'skip (sudah dikirim bulan ini)';

  var rows = _remRows_(), list = [];
  rows.forEach(function (b) {
    if (!_remIsKost_(b) || !_remActive_(b)) return;
    var coISO = _remISO_(b.CheckOut);
    if (coISO && coISO.slice(0, 7) === monthISO) list.push(b);
  });
  list.sort(function (a, b) { return _remISO_(a.CheckOut).localeCompare(_remISO_(b.CheckOut)); });

  var bulanLabel = _remFmt_(now, 'MMMM yyyy');
  var subject = '📋 Laporan Checkout Kost — ' + bulanLabel + ' (' + list.length + ' penghuni)';
  MailApp.sendEmail({ to: REM_CFG.emails.join(','), subject: subject, htmlBody: _kostHtml_(bulanLabel, list) });
  props.setProperty(guardKey, 'sent @' + _remFmt_(now, 'yyyy-MM-dd HH:mm'));
  Logger.log('terkirim laporan kost ' + bulanLabel + ' → ' + list.length + ' penghuni');
  return 'terkirim: ' + list.length + ' penghuni';
}
function _kostHtml_(bulanLabel, list) {
  var rows = list.map(function (b) {
    var nama = String(b.Nama_Customer || '-'), kamarShort = String(b.Nama_Kamar || '');
    var msg = 'Halo Kak ' + nama + ' 🌸 Kontrak kost kamu (kamar ' + kamarShort + ') berakhir ' + _remTglID_(b.CheckOut) + '. Mau lanjut perpanjang?\n' +
      '• Kalau LANJUT: mohon kabari & kasih DP untuk mengamankan kamar 🙏\n' +
      '• Kalau TIDAK lanjut: mohon kabari juga ya, kamar akan kami siapkan untuk penghuni berikutnya. Terima kasih 🌸';
    var wa = _remWaUrl_(b.WhatsApp, msg);
    return '<tr>' +
      '<td style="padding:9px;border-bottom:1px solid #eee">' + nama + '<br><small style="color:#888">' + _remKamar_(b) + '</small></td>' +
      '<td style="padding:9px;border-bottom:1px solid #eee">Checkout<br><b>' + _remTglID_(b.CheckOut) + '</b></td>' +
      '<td style="padding:9px;border-bottom:1px solid #eee;text-align:right">' + _remBtn_(b.WhatsApp ? wa : '', '💬 Tanya perpanjang') + '</td>' +
      '</tr>';
  }).join('');
  if (!list.length) rows = '<tr><td style="padding:12px;color:#888">Tidak ada penghuni kost yang checkout bulan ini. 🎉</td></tr>';
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#0C0A09;max-width:640px">' +
    '<h2 style="margin:0 0 4px">🏠 Laporan Checkout Kost — ' + bulanLabel + '</h2>' +
    '<div style="color:#888;margin-bottom:10px">' + list.length + ' penghuni akan checkout bulan ini. Tanyakan perpanjangan lewat tombol hijau.</div>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    '<p style="color:#888;font-size:12px;margin-top:16px">Lanjut → minta DP untuk amankan kamar. Tidak lanjut → kabari Bang Mezi, kamar dikosongkan in advance.</p>' +
    '</div>';
}

/* ============================================================== *
 *  SETUP & DIAGNOSTIK                                             *
 * ============================================================== */
function setupReminderTriggers() {
  var wanted = ['remindPenginapanPagi', 'remindPenginapanSore', 'remindKostBulanan'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (wanted.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('remindPenginapanPagi').timeBased().everyDays(1).atHour(7).inTimezone(_remTz_()).create();
  ScriptApp.newTrigger('remindPenginapanSore').timeBased().everyDays(1).atHour(17).inTimezone(_remTz_()).create();
  ScriptApp.newTrigger('remindKostBulanan').timeBased().onMonthDay(1).atHour(8).inTimezone(_remTz_()).create();
  Logger.log('Trigger terpasang: penginapan 07:00 (hari-H) & 17:00 (H-1) tiap hari; kost tgl 1 08:00.');
  return 'OK — trigger otomatis terpasang.';
}

function diagReminder() {
  Logger.log('Email tujuan : ' + REM_CFG.emails.join(', '));
  Logger.log('Zona waktu   : ' + _remTz_());
  Logger.log('Sisa kuota email hari ini: ' + MailApp.getRemainingDailyQuota());
  Logger.log('penginapan HARI INI : ' + _penginapanDigest_(0, 'HARI INI', true));
  Logger.log('penginapan BESOK    : ' + _penginapanDigest_(1, 'BESOK', true));
  Logger.log('kost bulan ini      : ' + _kostBulanan_(true));
  return 'OK — cek Logs & inbox (termasuk folder Spam) kedua email.';
}
