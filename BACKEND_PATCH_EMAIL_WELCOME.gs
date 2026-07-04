/*******************************************************************
 * BACKEND_PATCH_EMAIL_WELCOME.gs — Top Hills
 * =================================================================
 * EMAIL #3 — Welcome Check-in. Dikirim otomatis di HARI check-in penghuni.
 *   - KOST      → sambutan + ajakan JOIN GRUP WA PENGHUNI (link dari config).
 *   - PENGINAPAN→ sambutan tamu + jam check-out ditonjolkan (tanpa grup WA).
 *
 * Butuh helper dari BACKEND_PATCH_CUSTOMER_EMAIL.gs (_custRows_, _custIsKost_,
 * _custActive_, _custKamar_, _custTglID_, _custKontak_, _custFmt_, _custISO_,
 * _custToday_, _custSettings_).
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ PASANG: paste file ini. Run `setupWelcomeTrigger` (harian 08:00).│
 * │ Test: `diagWelcome` (kirim contoh kost+penginapan ke email owner)│
 * │ Link grup WA: isi di config `wa_grup_penghuni` (KwitansiSettings)│
 * │   atau pakai fallback yang sudah diisi di _custWaGrup_ di bawah. │
 * └───────────────────────────────────────────────────────────────┘
 *******************************************************************/

// Link grup WA penghuni — dari config (Pengaturan) atau fallback resmi.
function _custWaGrup_() {
  var s = (typeof _custSettings_ === 'function') ? _custSettings_() : {};
  var t = function (v) { return String(v == null ? '' : v).trim(); };
  return t(s.wa_grup_penghuni) || t(s.inv_wa_grup) || 'https://chat.whatsapp.com/HRm6kPl2qFgFnSYed7wgXw';
}

function _welcomeSubject_(b) {
  var isKost = _custIsKost_(b), nama = String(b.Nama_Customer || '');
  return (isKost ? '🎉 Selamat Bergabung di Top Hills' : '🌸 Selamat Datang di Top Hills') + ' — ' + nama;
}

function _welcomeHtml_(b) {
  var isKost = _custIsKost_(b);
  var kontak = _custKontak_(), grup = _custWaGrup_();
  var nama = String(b.Nama_Customer || 'Kak'), kamar = _custKamar_(b);
  var masuk = b.CheckIn ? _custTglID_(b.CheckIn) : '-';
  var keluar = b.CheckOut ? _custTglID_(b.CheckOut) : '';

  function row(k, v) {
    return '<tr><td style="padding:9px 0;color:#8A7A5A;font-size:13px;border-bottom:1px solid #EDE3CE">' + k + '</td>' +
      '<td align="right" style="padding:9px 0;color:#3E2F1C;font-size:13px;font-weight:bold;border-bottom:1px solid #EDE3CE">' + v + '</td></tr>';
  }
  var detail = row('Kamar', kamar) + row('Layanan', isKost ? 'Kost Putri' : 'Penginapan') + row('Tanggal masuk', masuk) +
    (keluar && !isKost ? row('Check-out', keluar) : '');

  var judul = isKost ? 'Selamat Bergabung' : 'Selamat Datang';
  var intro = isKost
    ? 'Halo Kak <b>' + nama + '</b>, selamat bergabung di Top Hills! 🎉 Kamu resmi jadi penghuni kamar <b>' + String(b.Nama_Kamar || '') + '</b>. Semoga betah ya 🌸'
    : 'Halo Kak <b>' + nama + '</b>, selamat datang di Top Hills! 🌸 Semoga nyaman selama menginap di kamar <b>' + String(b.Nama_Kamar || '') + '</b>.';

  // KOST: ajakan join grup WA penghuni. PENGINAPAN: tonjolkan jam check-out.
  var blok = isKost
    ? '<div style="background:#E9F7EE;border:1px solid #BFE6CE;border-radius:12px;padding:16px;margin:16px 0">' +
        '<div style="color:#178A43;font-size:13px;font-weight:bold;margin-bottom:6px">💬 Gabung Grup WhatsApp Penghuni</div>' +
        '<div style="color:#3E5A48;font-size:13px;line-height:1.6">Biar nggak ketinggalan info penting (jadwal, pengumuman, kendala air/listrik, dll), yuk masuk grup WA penghuni. Di grup juga boleh banget tanya-tanya atau lapor kendala 😊</div>' +
        '<div style="text-align:center;margin-top:12px"><a href="' + grup + '" style="display:inline-block;background:linear-gradient(135deg,#1FAF55,#178A43);color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:10px;font-size:14px">Gabung Grup Penghuni →</a></div>' +
      '</div>'
    : '<div style="background:#FBF3E0;border:1px solid #E7D3A0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">' +
        '<div style="color:#8A6A24;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:bold">Jam Check-out</div>' +
        '<div style="color:#3E2F1C;font-size:18px;font-weight:bold;margin-top:3px">Maksimal 12.00 WIB' + (keluar ? ' · ' + keluar : '') + '</div>' +
        '<div style="color:#8A7A5A;font-size:12px;margin-top:4px">Lewat dari jam check-out bisa dihitung tambah 1 malam ya 🙏</div>' +
      '</div>';

  return '<div style="margin:0;padding:0;background:#F2EADA">' +
    '<div style="max-width:600px;margin:0 auto;padding:24px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
      '<div style="background:#ffffff;border:1px solid #E7DCC4;border-radius:18px;overflow:hidden">' +
        '<div style="background:#8A6A24;background:linear-gradient(135deg,#B98C34,#8A6A24);padding:26px 28px;text-align:center">' +
          '<div style="color:#FBF7EC;font-size:12px;letter-spacing:4px;font-weight:bold;font-family:Arial,sans-serif">TOP HILLS</div>' +
          '<div style="color:#ffffff;font-size:23px;font-style:italic;margin-top:6px">' + judul + '</div>' +
          '<div style="color:#F3E6C8;font-size:12px;margin-top:4px;font-family:Arial,sans-serif">' + _custFmt_(new Date(), 'd MMMM yyyy') + '</div>' +
        '</div>' +
        '<div style="padding:26px 28px;font-family:Arial,Helvetica,sans-serif">' +
          '<p style="color:#3E2F1C;font-size:15px;line-height:1.55;margin:0 0 16px">' + intro + '</p>' +
          '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + detail + '</table>' +
          blok +
        '</div>' +
        '<div style="background:#FAF6EC;border-top:1px solid #E7DCC4;padding:20px 28px;text-align:center;font-family:Arial,sans-serif">' +
          '<div style="color:#8A6A24;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:8px">BUTUH BANTUAN?</div>' +
          '<div style="color:#5A5446;font-size:13px;line-height:1.7">💬 Helpdesk Top Hills: <b>' + kontak.helpdesk + '</b><br>💬 Bang Mezi (penjaga): <b>' + kontak.mezi + '</b></div>' +
          '<div style="color:#A99C7E;font-size:11px;margin-top:14px">Top Hills — Kost Putri &amp; Penginapan · Sampai ketemu 🌸</div>' +
        '</div>' +
      '</div>' +
    '</div></div>';
}

function sendWelcomeEmail_(b) {
  var out = { ok: false, email: false, wa: false };
  var email = String((b && b.Email) || '').trim();
  if (email && email.indexOf('@') >= 0) {
    try { MailApp.sendEmail({ to: email, subject: _welcomeSubject_(b), htmlBody: _welcomeHtml_(b) }); out.email = true; }
    catch (e) { out.emailErr = String(e); }
  }
  // WA welcome via Fonnte (teks ringkas + link grup untuk kost).
  var wa = String((b && b.WhatsApp) || '').trim();
  if (wa && typeof _fonnteSend_ === 'function') {
    var isKost = _custIsKost_(b);
    var msg = isKost
      ? ('🎉 Halo Kak ' + String(b.Nama_Customer || '') + ', selamat bergabung di Top Hills! Kamar ' + String(b.Nama_Kamar || '') + '.\nYuk gabung grup WA penghuni: ' + _custWaGrup_() + '\nButuh bantuan? Helpdesk ' + _custKontak_().helpdesk + ' 🌸')
      : ('🌸 Halo Kak ' + String(b.Nama_Customer || '') + ', selamat datang di Top Hills! Kamar ' + String(b.Nama_Kamar || '') + '. Check-out maks 12.00 WIB' + (b.CheckOut ? ' (' + _custTglID_(b.CheckOut) + ')' : '') + '. Butuh bantuan? Helpdesk ' + _custKontak_().helpdesk);
    try { var r = _fonnteSend_(wa, msg); out.wa = !!(r && r.ok); } catch (e) { out.waErr = String(e); }
  }
  out.ok = out.email || out.wa;
  return out;
}

// Trigger harian: kirim welcome ke penghuni yang HARI INI check-in (aktif).
function remindWelcomeHarian() { return _welcomeHarian_(false); }
function _welcomeHarian_(force) {
  var todayISO = _custFmt_(_custToday_(), 'yyyy-MM-dd');
  var rows = _custRows_(), props = PropertiesService.getScriptProperties(), sent = 0;
  rows.forEach(function (b) {
    if (!_custActive_(b)) return;
    if (_custISO_(b.CheckIn) !== todayISO) return;
    var gk = 'WELCOME_' + String(b.BookingID);
    if (!force && props.getProperty(gk)) return;
    var r = sendWelcomeEmail_(b);
    if (r && r.ok) { props.setProperty(gk, todayISO); sent++; }
  });
  Logger.log('welcome terkirim: ' + sent);
  return 'terkirim ' + sent;
}

function setupWelcomeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'remindWelcomeHarian') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('remindWelcomeHarian').timeBased().everyDays(1).atHour(8).inTimezone(Session.getScriptTimeZone() || 'GMT+7').create();
  return 'OK — welcome check-in tiap 08:00.';
}

function diagWelcome() {
  var admin = (typeof _adminEmail_ === 'function') ? _adminEmail_() : 'dewiatika4295@gmail.com';
  var kost = { Nama_Customer: 'Aisyah Putri', Layanan: 'KOS', Nama_Kamar: '12A', Gedung: 'Gedung A', Tipe_Kamar: 'Standard', CheckIn: '2026-07-03', Catatan: 'Fasilitas: AC', Email: admin };
  var png = { Nama_Customer: 'Dewi Atika', Layanan: 'PENGINAPAN', Nama_Kamar: 'D01', Gedung: 'Gedung C', Tipe_Kamar: 'Executive', CheckIn: '2026-07-03', CheckOut: '2026-07-06', Email: admin };
  MailApp.sendEmail({ to: admin, subject: '[TEST] ' + _welcomeSubject_(kost), htmlBody: _welcomeHtml_(kost) });
  MailApp.sendEmail({ to: admin, subject: '[TEST] ' + _welcomeSubject_(png), htmlBody: _welcomeHtml_(png) });
  return 'Terkirim 2 email welcome uji ke ' + admin;
}
