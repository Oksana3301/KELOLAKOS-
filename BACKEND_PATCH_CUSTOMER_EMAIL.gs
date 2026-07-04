/*******************************************************************
 * BACKEND_PATCH_CUSTOMER_EMAIL.gs — Top Hills
 * =================================================================
 * Email OTOMATIS ke CUSTOMER (bukan owner) + reminder pelunasan.
 * Gratis: Gmail (MailApp) + Apps Script time-trigger.
 *
 *  • Saat owner konfirmasi:
 *      - DP    → email INVOICE (ada sisa + rekening) ke email customer.
 *      - Lunas → email KUITANSI ke email customer. (info WA tetap dari app.)
 *  • Reminder pelunasan OTOMATIS (harian) — hanya untuk yang MASIH DP:
 *      - Penginapan → H-1 sebelum check-in.
 *      - Kost       → +7, +14, +30 hari setelah tanggal DP.
 *      Tiap reminder juga berisi rincian + rekening.
 *
 * Butuh kolom "Email" di sheet Booking (dibuat otomatis).
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG:                                                   │
 * │ 1) Paste file ini sebagai .gs BARU. Save.                     │
 * │ 2) Di apiv2.gs → dispatchV2_ → tambah 2 case SEBELUM default:  │
 * │      case 'setBookingEmail': return setBookingEmail_(payload); │
 * │      case 'sendBookingDoc':  return sendBookingDocToCustomer_(payload);
 * │ 3) (Agar email dari /info tersimpan) di submitBookingRequest,  │
 * │    objek `vals`, tambah:  Email: data.email || '',            │
 * │ 4) Run `diagCustomerEmail` (Allow izin email) → cek Logs.     │
 * │ 5) Run `setupCustomerEmailTriggers` → pasang reminder harian.  │
 * │ 6) Deploy → New version (supaya case dispatch aktif).         │
 * └───────────────────────────────────────────────────────────────┘
 *******************************************************************/

var CUST_CFG = { bookingSheet: 'Booking', settingsSheet: 'KwitansiSettings', bisnis: 'Top Hills' };

/* ---------- util ---------- */
function _custTz_() { return Session.getScriptTimeZone() || 'GMT+7'; }
function _custFmt_(d, p) { return Utilities.formatDate(d, _custTz_(), p); }
function _custToday_() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function _custAddDays_(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function _custISO_(v) {
  if (v == null || v === '') return '';
  var d = (v instanceof Date) ? v : new Date(String(v));
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, _custTz_(), 'yyyy-MM-dd');
}
function _custTglID_(v) { var iso = _custISO_(v); return iso ? _custFmt_(new Date(iso + 'T00:00:00'), 'd MMM yyyy') : '-'; }
function _custRp_(n) {
  n = Math.round(Number(n) || 0);
  var s = String(Math.abs(n)), out = '';
  while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
  return 'Rp' + (n < 0 ? '-' : '') + s + out;
}
// Cari sheet booking robust: SHEETS.BOOKINGS → CUST_CFG.bookingSheet → auto-deteksi
// sheet mana pun yang punya kolom "BookingID".
function _custSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var s2 = ss.getSheetByName(CUST_CFG.bookingSheet); if (s2) return s2;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var lc = all[i].getLastColumn(); if (lc < 1) continue;
    var H = all[i].getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h); });
    if (H.indexOf('BookingID') >= 0) return all[i];
  }
  throw new Error('Sheet booking tak ketemu (tak ada sheet dgn kolom BookingID). Set CUST_CFG.bookingSheet manual. Sheet yang ada: ' + all.map(function (x) { return x.getName(); }).join(', '));
}
function _custRows_() {
  var data = _custSheet_().getDataRange().getValues();
  if (data.length < 2) return [];
  var H = data[0].map(function (h) { return String(h); });
  return data.slice(1).map(function (r) { var o = {}; H.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}
function _custFindById_(id) {
  var rows = _custRows_(), t = String(id || '').trim();
  for (var i = 0; i < rows.length; i++) if (String(rows[i].BookingID || '').trim() === t) return rows[i];
  return null;
}
function _custIsKost_(b) { return String(b.Layanan || '').toUpperCase().indexOf('KOS') >= 0; }
function _custActive_(b) {
  var s = String(b.Status_Booking || '').toUpperCase();
  return !(s.indexOf('BATAL') >= 0 || s.indexOf('CANCEL') >= 0 || s.indexOf('TOLAK') >= 0 || s.indexOf('REJECT') >= 0 || s.indexOf('MENUNGGU') >= 0);
}
function _custBayar_(b) {
  var total = Number(b.Harga_Total_Net || 0);
  var refund = Number(b.Refund_Total || 0);
  var net = b.Net_Diterima;
  // dibayar = net-of-refund: Net_Diterima bila terisi (pakai ?? bukan ||, supaya 0
  // tidak jatuh ke Total_Bayar KOTOR), else Total_Bayar − Refund.
  var dibayar = (net === '' || net === null || net === undefined) ? Math.max(0, Number(b.Total_Bayar || 0) - refund) : Number(net || 0);
  var sisa = Math.max(0, total - dibayar);
  // LUNAS murni dari uang (bukan Status_Bayar yang bisa basi / refund-blind).
  var lunas = total > 0 && sisa <= 0 && dibayar > 0;
  return { total: total, dibayar: dibayar, sisa: sisa, lunas: lunas, refund: refund };
}
function _custKamar_(b) {
  return String(b.Nama_Kamar || '-') + (b.Gedung ? (' · ' + b.Gedung) : '') + (b.Tipe_Kamar ? (' (' + b.Tipe_Kamar + ')') : '');
}
function _custSettings_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CUST_CFG.settingsSheet);
  var m = {}; if (!sh) return m;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { var k = String(data[i][0] || ''); if (k) m[k] = data[i][1]; }
  return m;
}
function _custRekening_(isKost) {
  var s = _custSettings_(), t = function (v) { return String(v == null ? '' : v).trim(); };
  return {
    bank: t(isKost ? s.inv_kost_bank_name : s.inv_png_bank_name) || t(s.inv_bank_name) || '-',
    no: t(isKost ? s.inv_kost_account_no : s.inv_png_account_no) || t(s.inv_account_no) || '-',
    atasNama: t(isKost ? s.inv_kost_account_name : s.inv_png_account_name) || t(s.inv_account_name) || '-',
  };
}
// Kontak follow-up untuk customer: Helpdesk (dari Pengaturan) + Bang Mezi (penjaga).
function _custKontak_() {
  var s = _custSettings_(), t = function (v) { return String(v == null ? '' : v).trim(); };
  return { helpdesk: t(s.inv_wa_resmi) || '0811-6646-615', mezi: '0838-4161-4871' };
}
function ensureBookingEmailCol_() {
  var sh = _custSheet_();
  var H = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (H.indexOf('Email') < 0) sh.getRange(1, H.length + 1).setValue('Email');
  return 'OK — kolom Email siap.';
}
function _custSetCol_(id, col, val) {
  var sh = _custSheet_();
  var data = sh.getDataRange().getValues(), H = data[0].map(String);
  var idCol = H.indexOf('BookingID'); if (idCol < 0) throw new Error('Kolom BookingID tak ada');
  var c = H.indexOf(col); if (c < 0) { sh.getRange(1, H.length + 1).setValue(col); c = H.length; }
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) { sh.getRange(i + 1, c + 1).setValue(val); return true; }
  }
  return false;
}

/* ---------- ACTION: simpan email customer ---------- */
function setBookingEmail_(data) {
  data = data || {};
  var id = String(data.bookingId || data.booking_id || '').trim();
  var email = String(data.email || '').trim();
  if (!id) return { ok: false, error: 'bookingId wajib' };
  if (email && email.indexOf('@') < 0) return { ok: false, error: 'email tidak valid' };
  _custSetCol_(id, 'Email', email);
  return { ok: true, bookingId: id, email: email };
}

/* ---------- Email invoice / kuitansi / reminder ---------- */
function _custTr_(k, v) { return '<tr><td style="padding:4px 12px 4px 0;color:#888">' + k + '</td><td style="padding:4px 0"><b>' + v + '</b></td></tr>'; }
function _custSubject_(b, mode) {
  var nama = String(b.Nama_Customer || '');
  if (mode === 'kwitansi') return '🧾 Kuitansi Pelunasan ' + CUST_CFG.bisnis + ' — ' + nama;
  if (mode === 'reminder') return '⏰ Reminder Pelunasan ' + CUST_CFG.bisnis + ' — ' + nama;
  return '🧾 Invoice ' + CUST_CFG.bisnis + ' — ' + nama;
}
function _custDocHtml_(b, mode) {
  var isKost = _custIsKost_(b), pay = _custBayar_(b), rek = _custRekening_(isKost);
  var nama = String(b.Nama_Customer || 'Kak'), kamar = _custKamar_(b);
  var periode = b.CheckIn ? (_custTglID_(b.CheckIn) + (b.CheckOut ? (' – ' + _custTglID_(b.CheckOut)) : '')) : (b.Paket || b.Durasi || '-');
  var judul, intro, statusLine, rekTitle;
  if (mode === 'kwitansi') { judul = '🧾 KUITANSI PELUNASAN'; intro = 'Pembayaranmu sudah <b>LUNAS</b>. Terima kasih! Berikut kuitansinya:'; statusLine = '<b style="color:#178A43">Status: LUNAS ✓</b>'; rekTitle = 'Rekening (arsip)'; }
  else if (mode === 'reminder') { judul = '⏰ REMINDER PELUNASAN'; intro = 'Mengingatkan pelunasan booking Top Hills ya 🙏 Berikut rinciannya:'; statusLine = '<b style="color:#c0392b">💰 Sisa tagihan: ' + _custRp_(pay.sisa) + '</b>'; rekTitle = 'Silakan lunasi ke rekening'; }
  else { judul = '🧾 INVOICE / TAGIHAN'; intro = 'Terima kasih sudah booking. Berikut rincian & tagihannya:'; statusLine = '<b style="color:#c0392b">💰 Sisa tagihan: ' + _custRp_(pay.sisa) + '</b>'; rekTitle = 'Silakan lunasi sisa ke rekening'; }
  var jam = isKost ? '' : '<p style="color:#888;font-size:12px">⏰ Check-in mulai 13.00 WIB · Check-out maksimal 12.00 WIB</p>';
  var rekBox = (mode === 'kwitansi')
    ? '<p style="color:#888;font-size:13px">Rekening: ' + rek.bank + ' · ' + rek.no + ' (a.n. ' + rek.atasNama + ')</p>'
    : '<div style="background:#FBF3E0;border:1px solid #E7D3A0;border-radius:8px;padding:10px 12px;margin:8px 0"><b>' + rekTitle + ':</b><br>🏦 ' + rek.bank + '<br>No. Rek: <b>' + rek.no + '</b> (a.n. ' + rek.atasNama + ')</div>';
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#0C0A09;max-width:600px">' +
    '<h2 style="margin:0 0 2px">' + judul + ' — ' + CUST_CFG.bisnis + '</h2>' +
    '<div style="color:#888;margin-bottom:10px">' + _custFmt_(new Date(), 'd MMM yyyy') + ' · ' + String(b.BookingID || '') + '</div>' +
    '<p>Halo Kak <b>' + nama + '</b> 🌸<br>' + intro + '</p>' +
    '<table style="border-collapse:collapse;font-size:14px;margin:8px 0">' +
      _custTr_('🏠 Kamar', kamar) +
      _custTr_('🛏️ Layanan', isKost ? 'Kost Putri' : 'Penginapan') +
      _custTr_('📅 Periode', periode) +
      _custTr_('💰 Total', _custRp_(pay.total)) +
      _custTr_('✅ Sudah dibayar', _custRp_(pay.dibayar)) +
      (pay.refund > 0 ? _custTr_('↩️ Refund', '-' + _custRp_(pay.refund)) : '') +
    '</table>' +
    '<p>' + statusLine + '</p>' + rekBox + jam +
    '<div style="border-top:1px solid #eee;margin-top:14px;padding-top:10px;color:#888;font-size:12px">' +
      '<b>Butuh bantuan?</b><br>💬 Helpdesk Top Hills: ' + _custKontak_().helpdesk + '<br>💬 Bang Mezi (penjaga): ' + _custKontak_().mezi +
    '</div>' +
    '<p style="color:#888;font-size:12px">Setelah transfer, kirim bukti ke WhatsApp admin ya 🙏 — ' + CUST_CFG.bisnis + '</p>' +
    '</div>';
}

/* ---------- ACTION: kirim invoice/kuitansi ke customer ---------- */
function sendBookingDocToCustomer_(data) {
  data = data || {};
  var b = _custFindById_(String(data.bookingId || data.booking_id || '').trim());
  if (!b) return { ok: false, error: 'booking tak ditemukan' };
  var pay = _custBayar_(b), kind = String(data.kind || '').toLowerCase();
  var mode = (kind === 'kwitansi' || kind === 'invoice' || kind === 'reminder') ? kind : (pay.lunas ? 'kwitansi' : 'invoice');
  var out = { ok: false, mode: mode, email: false, wa: false };
  // 1) EMAIL (kalau customer isi email)
  var email = String(b.Email || data.email || '').trim();
  if (email && email.indexOf('@') >= 0) {
    try { MailApp.sendEmail({ to: email, subject: _custSubject_(b, mode), htmlBody: _custDocHtml_(b, mode) }); out.email = true; out.to = email; }
    catch (e) { out.emailErr = String(e); }
  }
  // 2) WHATSAPP via Fonnte (kalau ada nomor & gateway BACKEND_PATCH_FONNTE_WA.gs terpasang)
  var wa = String(b.WhatsApp || '').trim();
  if (wa && typeof _fonnteSend_ === 'function') {
    try { var r = _fonnteSend_(wa, _fonnteCustomerText_(b, mode)); out.wa = !!(r && r.ok); } catch (e) { out.waErr = String(e); }
  }
  out.ok = out.email || out.wa;
  return out;
}

/* ---------- Reminder pelunasan (harian) ---------- */
function remindPelunasan() { return _remindPelunasan_(false); }
function _remindPelunasan_(force) {
  var todayISO = _custFmt_(_custToday_(), 'yyyy-MM-dd');
  var rows = _custRows_(), props = PropertiesService.getScriptProperties(), sent = 0;
  rows.forEach(function (b) {
    if (!_custActive_(b)) return;
    var email = String(b.Email || '').trim(); if (!email || email.indexOf('@') < 0) return;
    var pay = _custBayar_(b); if (pay.lunas || pay.sisa <= 0) return;
    if (pay.refund > 0) return; // ada refund → jangan tagih pelunasan (bisa salah tagih) // sudah lunas → skip
    var milestones = [];
    if (_custIsKost_(b)) {
      var dpISO = _custISO_(b.Tgl_Pembayaran); if (!dpISO) return;
      [7, 14, 30].forEach(function (d) {
        if (_custISO_(_custAddDays_(new Date(dpISO + 'T00:00:00'), d)) === todayISO) milestones.push('kost' + d);
      });
    } else {
      var ciISO = _custISO_(b.CheckIn); if (!ciISO) return;
      if (_custISO_(_custAddDays_(new Date(ciISO + 'T00:00:00'), -1)) === todayISO) milestones.push('pngH1');
    }
    milestones.forEach(function (ms) {
      var gk = 'PLNS_' + String(b.BookingID) + '_' + ms;
      if (!force && props.getProperty(gk)) return;
      var r = sendBookingDocToCustomer_({ bookingId: b.BookingID, kind: 'reminder' });
      if (r && r.ok) { props.setProperty(gk, todayISO); sent++; }
    });
  });
  Logger.log('reminder pelunasan terkirim: ' + sent);
  return 'terkirim ' + sent;
}

/* ---------- SETUP & DIAG ---------- */
function setupCustomerEmailTriggers() {
  ensureBookingEmailCol_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'remindPelunasan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('remindPelunasan').timeBased().everyDays(1).atHour(9).inTimezone(_custTz_()).create();
  return 'OK — reminder pelunasan tiap 09:00; kolom Email siap.';
}
function diagCustomerEmail() {
  ensureBookingEmailCol_();
  Logger.log('KwitansiSettings ada : ' + !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CUST_CFG.settingsSheet));
  var rk = _custRekening_(false), rkk = _custRekening_(true);
  Logger.log('Rekening penginapan  : ' + rk.bank + ' · ' + rk.no + ' · ' + rk.atasNama);
  Logger.log('Rekening kost        : ' + rkk.bank + ' · ' + rkk.no + ' · ' + rkk.atasNama);
  Logger.log('Sisa kuota email     : ' + MailApp.getRemainingDailyQuota());
  Logger.log('remindPelunasan (uji): ' + _remindPelunasan_(true));
  return 'OK — cek Logs. (Email ke customer hanya terkirim bila kolom Email terisi.)';
}
