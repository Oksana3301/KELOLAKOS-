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
  var nama = String(b.Nama_Customer || 'Kak'), kamar = _custKamar_(b);
  var berakhir = b.CheckOut ? _custTglID_(b.CheckOut) : '-';
  var waHelp = String(kontak.helpdesk || '').replace(/[^0-9]/g, '');
  if (waHelp.indexOf('0') === 0) waHelp = '62' + waHelp.slice(1);
  var extendUrl = 'https://wa.me/' + waHelp + '?text=' + encodeURIComponent('Halo Top Hills 🌸, saya ' + nama + ' (kamar ' + String(b.Nama_Kamar || '') + ') mau *perpanjang* sewa kost. Mohon dibantu ya 🙏');

  function row(k, v) {
    return '<tr><td style="padding:9px 0;color:#8A7A5A;font-size:13px;border-bottom:1px solid #EDE3CE">' + k + '</td>' +
      '<td align="right" style="padding:9px 0;color:#3E2F1C;font-size:13px;font-weight:bold;border-bottom:1px solid #EDE3CE">' + v + '</td></tr>';
  }
  var detail = row('Kamar', kamar) + row('Masa sewa berakhir', berakhir) + row('Sisa waktu', '± 30 hari lagi');

  // Jalur 1 — Perpanjang
  var perpanjang = '<div style="background:#E9F7EE;border:1px solid #BFE6CE;border-radius:12px;padding:16px;margin:16px 0">' +
    '<div style="color:#178A43;font-size:13px;font-weight:bold;margin-bottom:6px">✅ Mau Lanjut? Perpanjang Sekarang</div>' +
    '<div style="color:#3E5A48;font-size:13px;line-height:1.6">Biar kamar kamu tetap aman, yuk kabari kami untuk perpanjang sebelum masa sewa habis 🌸</div>' +
    '<div style="text-align:center;margin-top:12px"><a href="' + extendUrl + '" style="display:inline-block;background:linear-gradient(135deg,#1FAF55,#178A43);color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:10px;font-size:14px">Perpanjang via WhatsApp →</a></div>' +
  '</div>';

  // Jalur 2 — Checkout (USULAN copy; tanpa deposit)
  var checkout = '<div style="background:#FAF6EC;border:1px solid #E7DCC4;border-radius:12px;padding:14px 16px;margin:6px 0">' +
    '<div style="color:#8A6A24;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Kalau tidak lanjut (checkout)</div>' +
    '<div style="color:#5A5446;font-size:13px;line-height:1.7">• Mohon kosongkan kamar paling lambat tanggal <b>' + berakhir + '</b>.<br>• Kembalikan kunci ke penjaga (Bang Mezi).<br>• Tinggalkan kamar dalam kondisi bersih ya 🌸</div>' +
  '</div>';

  return '<div style="margin:0;padding:0;background:#F2EADA">' +
    '<div style="max-width:600px;margin:0 auto;padding:24px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
      '<div style="background:#ffffff;border:1px solid #E7DCC4;border-radius:18px;overflow:hidden">' +
        '<div style="background:#8A6A24;background:linear-gradient(135deg,#B98C34,#8A6A24);padding:26px 28px;text-align:center">' +
          '<div style="color:#FBF7EC;font-size:12px;letter-spacing:4px;font-weight:bold;font-family:Arial,sans-serif">TOP HILLS</div>' +
          '<div style="color:#ffffff;font-size:22px;font-style:italic;margin-top:6px">Masa Sewa Akan Berakhir</div>' +
          '<div style="color:#F3E6C8;font-size:12px;margin-top:4px;font-family:Arial,sans-serif">' + _custFmt_(new Date(), 'd MMMM yyyy') + '</div>' +
        '</div>' +
        '<div style="padding:26px 28px;font-family:Arial,Helvetica,sans-serif">' +
          '<p style="color:#3E2F1C;font-size:15px;line-height:1.55;margin:0 0 16px">Halo Kak <b>' + nama + '</b> 🌸<br>Sekadar mengingatkan dengan lembut, masa sewa kost kamu akan berakhir <b>± 30 hari lagi</b>. Berikut detailnya:</p>' +
          '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + detail + '</table>' +
          perpanjang + checkout +
        '</div>' +
        '<div style="background:#FAF6EC;border-top:1px solid #E7DCC4;padding:20px 28px;text-align:center;font-family:Arial,sans-serif">' +
          '<div style="color:#8A6A24;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:8px">BUTUH BANTUAN?</div>' +
          '<div style="color:#5A5446;font-size:13px;line-height:1.7">💬 Helpdesk Top Hills: <b>' + kontak.helpdesk + '</b><br>💬 Bang Mezi (penjaga): <b>' + kontak.mezi + '</b></div>' +
          '<div style="color:#A99C7E;font-size:11px;margin-top:14px">Top Hills — Kost Putri &amp; Penginapan 🌸</div>' +
        '</div>' +
      '</div>' +
    '</div></div>';
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
    var msg = '🗓️ Halo Kak ' + String(b.Nama_Customer || '') + ', masa sewa kost kamu (kamar ' + String(b.Nama_Kamar || '') + ') akan berakhir ± 30 hari lagi (' + (b.CheckOut ? _custTglID_(b.CheckOut) : '-') + ').\nMau lanjut? Balas pesan ini untuk *perpanjang* & amankan kamar 🌸\nHelpdesk: ' + _custKontak_().helpdesk;
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
