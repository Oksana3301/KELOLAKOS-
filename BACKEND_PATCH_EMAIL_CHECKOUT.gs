/*******************************************************************
 * BACKEND_PATCH_EMAIL_CHECKOUT.gs — Top Hills
 * =================================================================
 * EMAIL #6 — Reminder Checkout. KHUSUS KOST, H-30 sebelum masa sewa berakhir.
 *   - Jalur 1 (Perpanjang): CTA WhatsApp prefilled.
 *   - Jalur 2 (Checkout): instruksi ringkas (TANPA deposit — Top Hills tak pakai
 *     deposit). Teks checkout = USULAN, mohon owner konfirmasi/edit.
 *
 * Sumber tanggal berakhir = kolom CheckOut (sumber kebenaran). Perpanjang =
 * booking baru → CheckOut baru otomatis dipakai; reminder lama tak terulang
 * (idempoten per BookingID+CheckOut, dan CheckOut lama sudah lewat).
 *
 * Butuh helper dari BACKEND_PATCH_CUSTOMER_EMAIL.gs (_custRows_, _custIsKost_,
 * _custActive_, _custKamar_, _custKontak_, _custFmt_, _custISO_, _custToday_,
 * _custAddDays_, _custTglID_).
 *
 * PASANG: paste → Run `setupCheckoutTrigger` (harian 08:00). Test: `diagCheckout`.
 *******************************************************************/

function _checkoutSubject_(b) {
  return '🗓️ Masa Sewa Kost Akan Berakhir — Top Hills · ' + String(b.Nama_Customer || '');
}

function _checkoutHtml_(b) {
  var kontak = _custKontak_();
  var nama = _thFirstName_(b), nomorKamar = String(b.Nama_Kamar || '-');
  var berakhir = b.CheckOut ? _custTglID_(b.CheckOut) : '-';
  var roomTitle = 'Kost Putri — Kamar ' + nomorKamar + (_custHasAc_(b) ? ' · AC' : '');
  var subParts = [];
  if (b.Nama_Customer) subParts.push(String(b.Nama_Customer));
  if (b.Gedung) subParts.push(String(b.Gedung));
  var roomSub = subParts.join(' · ');

  var extendUrl = _thWaUrl_(kontak.helpdesk, 'Halo Top Hills 🌸, saya ' + String(b.Nama_Customer || '') + ' (kamar ' + nomorKamar + ') mau *perpanjang* sewa kost. Mohon dibantu ya 🙏');
  var s = (typeof _custSettings_ === 'function') ? _custSettings_() : {};
  var fbLink = String(s.link_feedback || '').trim() || 'https://tinyurl.com/feedbacktophillspdg';

  var body = _thDivider_('DETAIL') +
    _thRoomCard_(nomorKamar, roomTitle, roomSub, null, false) +
    _thNote_('✅', '<b>Mau lanjut?</b> Biar kamar kamu tetap aman, yuk kabari kami untuk perpanjang sebelum masa sewa habis 🌸', 'green') +
    _thDivider_('KALAU CHECKOUT') +
    _thSteps_([
      ['Kosongkan kamar tepat waktu', 'Paling lambat tanggal <b>' + berakhir + '</b>. Pastikan semua barang sudah dibawa — hati-hati, jangan ada yang tertinggal.'],
      ['Kembalikan kunci ke Bang Mezi', 'Tinggalkan kamar dalam kondisi bersih & tetap jaga ketertiban ya 🌸']
    ]) +
    _thNote_('💛', 'Tetap ingat Top Hills ya! Boleh dong bagikan kesan & pesan kamu tentang Top Hills — masukanmu sangat berarti. Beri kesan & pesan di <b>' + fbLink + '</b>') +
    _thCta_('Perpanjang via WhatsApp', 'Atau beri kesan & pesan di ' + fbLink, extendUrl);

  return _thShell_('Masa sewa kamar ' + nomorKamar + ' akan berakhir ± 30 hari lagi 🗓️',
    _thHero_({ pill: 'MASA SEWA AKAN BERAKHIR', headline: 'Masa sewamu sebentar lagi, ' + nama + '.',
      sub: 'Sekadar mengingatkan dengan lembut, masa sewa kost kamu akan berakhir ± 30 hari lagi. Berikut detailnya.',
      box: { label: 'MASA SEWA BERAKHIR', value: berakhir, hint: '± 30 hari lagi' } }) +
    _thBodyWrap_(body) +
    _thFooter_('Terima kasih sudah tinggal bersama kami.', 'Reminder checkout · Kamar ' + nomorKamar));
}

function sendCheckoutEmail_(b) {
  var out = { ok: false, email: false, wa: false };
  var email = String((b && (b.email || b.Email)) || '').trim();
  if (email && email.indexOf('@') >= 0) {
    try { MailApp.sendEmail({ to: email, subject: _checkoutSubject_(b), htmlBody: _checkoutHtml_(b) }); out.email = true; }
    catch (e) { out.emailErr = String(e); }
  }
  var wa = String((b && b.WhatsApp) || '').trim();
  if (wa && typeof _fonnteSend_ === 'function') {
    var sCfg = (typeof _custSettings_ === 'function') ? _custSettings_() : {};
    var fb = String(sCfg.link_feedback || '').trim() || 'https://tinyurl.com/feedbacktophillspdg';
    var msg = '🗓️ Halo Kak ' + String(b.Nama_Customer || '') + ', masa sewa kost kamu (kamar ' + String(b.Nama_Kamar || '') + ') akan berakhir ± 30 hari lagi (' + (b.CheckOut ? _custTglID_(b.CheckOut) : '-') + ').\n' +
      'Mau lanjut? Balas pesan ini untuk *perpanjang* & amankan kamar 🌸\n' +
      'Kalau checkout: pastikan semua barang dibawa (jangan ada yang tertinggal) & kembalikan kunci ke Bang Mezi.\n' +
      'Kesan & pesan untuk Top Hills: ' + fb + '\n' +
      'Helpdesk: ' + _custKontak_().helpdesk;
    try { var r = _fonnteSend_(wa, msg); out.wa = !!(r && r.ok); } catch (e) { out.waErr = String(e); }
  }
  out.ok = out.email || out.wa;
  return out;
}

// Trigger harian: KOST aktif yang CheckOut == hari ini + 30 (H-30).
function remindCheckoutHarian() { return _checkoutHarian_(false); }
function _checkoutHarian_(force) {
  var targetISO = _custFmt_(_custAddDays_(_custToday_(), 30), 'yyyy-MM-dd');
  var rows = _custRows_(), props = PropertiesService.getScriptProperties(), sent = 0;
  rows.forEach(function (b) {
    if (!_custIsKost_(b) || !_custActive_(b)) return;
    var coISO = _custISO_(b.CheckOut);
    if (coISO !== targetISO) return;
    var gk = 'CHECKOUT_' + String(b.BookingID) + '_' + coISO;  // idempoten per booking+tgl berakhir
    if (!force && props.getProperty(gk)) return;
    var r = sendCheckoutEmail_(b);
    if (r && r.ok) { props.setProperty(gk, targetISO); sent++; }
  });
  Logger.log('reminder checkout terkirim: ' + sent);
  return 'terkirim ' + sent;
}

function setupCheckoutTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'remindCheckoutHarian') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('remindCheckoutHarian').timeBased().everyDays(1).atHour(8).inTimezone(Session.getScriptTimeZone() || 'GMT+7').create();
  return 'OK — reminder checkout kost (H-30) tiap 08:00.';
}

function diagCheckout() {
  var admin = (typeof _adminEmail_ === 'function') ? _adminEmail_() : 'dewiatika4295@gmail.com';
  var b = { BookingID: 'TH-2026-0148', Nama_Customer: 'Aisyah Putri', Layanan: 'KOS', Nama_Kamar: '12A', Gedung: 'Gedung A', Tipe_Kamar: 'Standard', CheckOut: '2027-01-01', Catatan: 'Fasilitas: AC', Email: admin };
  MailApp.sendEmail({ to: admin, subject: '[TEST] ' + _checkoutSubject_(b), htmlBody: _checkoutHtml_(b) });
  return 'Terkirim email reminder checkout uji ke ' + admin;
}
