/*******************************************************************
 * BACKEND_DIAG_NOTIF_BOOKING.gs — Top Hills
 * =================================================================
 * DIAGNOSTIK notifikasi booking /info: kenapa email/WA nggak kekirim.
 * READ-ONLY (kecuali `diagResendBookingNotif` yang sengaja kirim ulang).
 *
 * CARA PAKAI:
 *  1) Paste file ini sebagai .gs BARU. Save.
 *     → Kalau Save GAGAL / muncul error merah = ADA SYNTAX ERROR di project
 *       (dari paste sebelumnya). Itu penyebabnya: seluruh Apps Script mati.
 *       Perbaiki file yang error dulu, baru notif jalan lagi.
 *  2) Pilih fungsi `diagNotifBooking` → Run → lihat Logs (Ctrl+Enter).
 *     Report: project hidup?, FONNTE_TOKEN?, ADMIN_EMAIL, MEZI_WA, kuota Gmail,
 *     + booking TERAKHIR (ID, jam, Email, WhatsApp, Status, Layanan).
 *  3) (opsional) Test kirim ULANG buat booking terakhir:
 *     - Edit `diagResendBookingNotif` → biarkan bookingId '' (pakai terakhir)
 *       atau isi BookingID tertentu → Run → cek inbox/HP + Logs.
 *******************************************************************/

function _dgBookSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { if (typeof SHEETS !== 'undefined' && SHEETS && SHEETS.BOOKINGS) { var s = ss.getSheetByName(SHEETS.BOOKINGS); if (s) return s; } } catch (e) {}
  var names = ['BOOKINGS', 'Booking', 'Bookings'];
  for (var i = 0; i < names.length; i++) { var sh = ss.getSheetByName(names[i]); if (sh) return sh; }
  var all = ss.getSheets();
  for (var j = 0; j < all.length; j++) {
    var lc = all[j].getLastColumn(); if (lc < 1) continue;
    var H = all[j].getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h); });
    if (H.indexOf('BookingID') >= 0) return all[j];
  }
  return null;
}

// Ambil booking paling akhir (baris terbawah) sebagai objek {header: value}.
function _dgLastBooking_(bookingId) {
  var sh = _dgBookSheet_();
  if (!sh) return { err: 'Sheet booking tak ketemu' };
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { err: 'Sheet booking kosong' };
  var H = data[0].map(function (h) { return String(h); });
  var idCol = H.indexOf('BookingID');
  var target = -1;
  if (bookingId) {
    for (var i = data.length - 1; i >= 1; i--) { if (String(data[i][idCol]).trim() === String(bookingId).trim()) { target = i; break; } }
    if (target < 0) return { err: 'BookingID tak ketemu: ' + bookingId };
  } else {
    target = data.length - 1; // baris terakhir = booking terbaru
  }
  var obj = {};
  H.forEach(function (h, c) { obj[h] = data[target][c]; });
  return { obj: obj, row: target + 1, headers: H };
}

// ============ DIAGNOSTIK UTAMA (read-only) ============
function diagNotifBooking() {
  var L = [];
  L.push('===== DIAG NOTIF BOOKING — ' + new Date() + ' =====');

  // 1) Project hidup? (kalau fungsi ini jalan, berarti tidak ada syntax error fatal)
  L.push('[1] Project Apps Script: HIDUP (fungsi diag jalan → tidak ada syntax error fatal).');

  // 2) Fungsi notif ada?
  function has(fn) { return (typeof this[fn] === 'function') ? 'ADA' : 'TIDAK ADA'; }
  L.push('[2] Fungsi notif:');
  L.push('    submitBookingRequest    : ' + (typeof submitBookingRequest === 'function' ? 'ADA' : 'TIDAK ADA'));
  L.push('    sendBookingConfirmEmail_: ' + (typeof sendBookingConfirmEmail_ === 'function' ? 'ADA (customer email+WA)' : 'TIDAK ADA ← customer TIDAK dapat email!'));
  L.push('    _notifyAdminNewBooking_ : ' + (typeof _notifyAdminNewBooking_ === 'function' ? 'ADA (admin email)' : 'TIDAK ADA'));
  L.push('    _notifyMeziNewBooking_  : ' + (typeof _notifyMeziNewBooking_ === 'function' ? 'ADA (Mezi WA)' : 'TIDAK ADA'));
  L.push('    _fonnteSend_ / _sendWa_ : ' + ((typeof _fonnteSend_ === 'function' || typeof _sendWa_ === 'function') ? 'ADA' : 'TIDAK ADA ← WA mati'));

  // 3) Konfigurasi
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('FONNTE_TOKEN') || '';
  var adminEmail = props.getProperty('ADMIN_EMAIL') || '(kosong → fallback pemilik script)';
  var meziWaProp = props.getProperty('MEZI_WA') || '(kosong → coba dari HalamanInfo.waMezi)';
  // Resolusi nomor Mezi yang BENAR-BENAR dipakai runtime (property → _meziWa_ → HalamanInfo).
  var meziResolved = '';
  try { if (typeof _meziWa_ === 'function') meziResolved = _meziWa_(); } catch (e) {}
  if (!meziResolved) { try { if (typeof v2_getHalamanInfo === 'function') { var hi = v2_getHalamanInfo(); meziResolved = (hi && hi.waMezi) || ''; } } catch (e) {} }
  L.push('[3] Config:');
  L.push('    FONNTE_TOKEN : ' + (token ? ('ADA (' + token.length + ' char)') : 'KOSONG ← semua WA (Mezi!) GAGAL'));
  L.push('    ADMIN_EMAIL  : ' + adminEmail);
  L.push('    MEZI_WA (prop): ' + meziWaProp);
  L.push('    Mezi terpakai: ' + (meziResolved || '(KOSONG → Mezi TIDAK dapat WA!)') + '   ← nomor yang benar2 dikirimi');
  L.push('    LAST_MAIL_OK : ' + (props.getProperty('LAST_MAIL_OK') || '(belum pernah)'));
  L.push('    LAST_MAIL_ERROR: ' + (props.getProperty('LAST_MAIL_ERROR') || '(tidak ada)'));

  // 4) Kuota Gmail (consumer Gmail biasanya 100/hari)
  try { L.push('[4] Sisa kuota email hari ini: ' + MailApp.getRemainingDailyQuota() + ' (kalau 0 → semua email GAGAL diam-diam)'); }
  catch (e) { L.push('[4] Kuota email: gagal baca (' + e + ')'); }

  // 5) Booking terakhir
  var last = _dgLastBooking_('');
  if (last.err) {
    L.push('[5] Booking terakhir: ' + last.err);
  } else {
    var b = last.obj;
    L.push('[5] Booking TERAKHIR di sheet (baris ' + last.row + '):');
    L.push('    BookingID    : ' + (b.BookingID || '-') + (String(b.BookingID || '').indexOf('TH-REQ-') === 0 ? '  ← dari /info' : '  ← BUKAN /info (mungkin dari dashboard)'));
    L.push('    Nama         : ' + (b.Nama_Customer || '-'));
    L.push('    Email        : ' + (b.Email || '(KOSONG → customer tak dapat email)'));
    L.push('    WhatsApp     : ' + (b.WhatsApp || '(KOSONG → customer/WA tak dapat)'));
    L.push('    Layanan      : ' + (b.Layanan || '-'));
    L.push('    Status_Booking: ' + (b.Status_Booking || '-'));
    L.push('    Timestamp    : ' + (b.Created_At || b.Timestamp || '-'));
  }

  L.push('===== SELESAI. Kirim (paste) semua teks ini ke Claude. =====');
  var out = L.join('\n');
  Logger.log(out);
  return out;
}

// ============ TEST KHUSUS WA MEZI (BENERAN kirim) ============
// Jawab "kenapa Mezi nggak dapet WA": resolve nomor Mezi + kirim tes langsung.
function diagTestMeziWa() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('FONNTE_TOKEN') || '';
  var to = '';
  try { if (typeof _meziWa_ === 'function') to = _meziWa_(); } catch (e) {}
  if (!to) { try { if (typeof v2_getHalamanInfo === 'function') { var hi = v2_getHalamanInfo(); to = (hi && hi.waMezi) || ''; } } catch (e) {} }

  var res = { fonnteToken: token ? ('ADA (' + token.length + ' char)') : 'KOSONG', meziNomor: to || '(KOSONG)' };
  if (!token) { res.hasil = 'GAGAL: FONNTE_TOKEN kosong → semua WA (termasuk Mezi) gagal senyap. Set token dulu.'; Logger.log(JSON.stringify(res, null, 2)); return res; }
  if (!to) { res.hasil = 'GAGAL: nomor Mezi tak ketemu (MEZI_WA kosong & HalamanInfo.waMezi kosong). Set MEZI_WA di Script Properties.'; Logger.log(JSON.stringify(res, null, 2)); return res; }

  var msg = '🔔 TES notifikasi Mezi — Top Hills. Kalau ini masuk, WA Mezi AKTIF. (' + new Date() + ')';
  var r = null;
  if (typeof _sendWa_ === 'function') { try { r = _sendWa_(to, msg); } catch (e) { r = { ok: false, error: String(e) }; } }
  else if (typeof _fonnteSend_ === 'function') { try { r = _fonnteSend_(to, msg); } catch (e) { r = { ok: false, error: String(e) }; } }
  else { res.hasil = 'GAGAL: fungsi _sendWa_/_fonnteSend_ tak ada.'; Logger.log(JSON.stringify(res, null, 2)); return res; }

  res.respFonnte = r;
  res.hasil = (r && r.ok) ? ('OK — WA tes dikirim ke Mezi ' + to + '. Cek HP Mezi.') :
    ('GAGAL kirim ke ' + to + '. Cek body Fonnte (nomor tak terdaftar? device disconnect? kuota?).');
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

// ============ TEST KIRIM ULANG notif buat 1 booking (BENERAN kirim) ============
// bookingId '' = pakai booking terakhir. Isi BookingID buat spesifik.
function diagResendBookingNotif() {
  var bookingId = ''; // ← isi 'TH-REQ-2026....' kalau mau spesifik; kosong = terakhir
  var last = _dgLastBooking_(bookingId);
  if (last.err) { Logger.log('GAGAL: ' + last.err); return last; }
  var b = last.obj;
  var res = { bookingId: b.BookingID, customer: null, admin: null, mezi: null };

  if (typeof sendBookingConfirmEmail_ === 'function') {
    try { res.customer = sendBookingConfirmEmail_(b); } catch (e) { res.customer = { err: String(e) }; }
  } else { res.customer = 'sendBookingConfirmEmail_ TIDAK ADA'; }

  if (typeof _notifyAdminNewBooking_ === 'function') {
    try { _notifyAdminNewBooking_(b, b.Bukti_Bayar || ''); res.admin = 'dikirim (cek inbox admin)'; } catch (e) { res.admin = { err: String(e) }; }
  } else { res.admin = '_notifyAdminNewBooking_ TIDAK ADA'; }

  if (typeof _notifyMeziNewBooking_ === 'function') {
    try { _notifyMeziNewBooking_(b, b.Bukti_Bayar || ''); res.mezi = 'dikirim (cek WA Mezi)'; } catch (e) { res.mezi = { err: String(e) }; }
  } else { res.mezi = '_notifyMeziNewBooking_ TIDAK ADA'; }

  Logger.log(JSON.stringify(res, null, 2));
  return res;
}
