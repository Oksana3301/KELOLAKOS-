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
  var nama = _thFirstName_(b), nomorKamar = String(b.Nama_Kamar || '-');
  var keluar = b.CheckOut ? _custTglID_(b.CheckOut) : '';
  var roomTitle = isKost ? ('Kost Putri — Kamar ' + nomorKamar + (_custHasAc_(b) ? ' · AC' : ''))
    : ('Penginapan' + (b.Tipe_Kamar ? (' · ' + b.Tipe_Kamar) : ''));
  var subParts = [];
  if (b.Gedung) subParts.push(String(b.Gedung));
  if (b.CheckIn) subParts.push('Check-in ' + _custTglID_(b.CheckIn));
  var roomSub = subParts.join(' · ');
  var pills = (!isKost && _custHasAc_(b)) ? ['AC'] : null;

  var body = _thDivider_('KAMARMU') + _thRoomCard_(nomorKamar, roomTitle, roomSub, pills, false);
  if (isKost) {
    body += _thDivider_('GABUNG GRUP PENGHUNI') +
      _thNote_('💬', 'Biar nggak ketinggalan info penting (jadwal, pengumuman, kendala air/listrik, dll), yuk masuk grup WA penghuni. Di grup juga boleh banget tanya-tanya atau lapor kendala 😊') +
      _thNote_('📖', 'Aturan rumah lengkap ada di grup WA penghuni — singkatnya: saling jaga, tamu lapor, tenang setelah jam 22.00.') +
      _thCta_('Gabung Grup WA Penghuni', 'Kenalan sama tetangga barumu 🌸', grup);
  } else {
    body += _thDivider_('JAM CHECK-OUT') +
      _thNote_('⏰', 'Check-out maksimal <b>12.00 WIB' + (keluar ? (' · ' + keluar) : '') + '</b>. Lewat dari jam check-out bisa dihitung tambah 1 malam ya 🙏') +
      _thCta_('Chat Helpdesk', 'Butuh bantuan selama menginap? WA ' + kontak.helpdesk, _thWaUrl_(kontak.helpdesk, 'Halo Top Hills 🌸, saya ' + String(b.Nama_Customer || '') + ' (kamar ' + nomorKamar + '). Mau tanya sesuatu.'));
  }

  var headline = isKost ? ('Selamat datang di rumah, ' + nama + '.') : ('Selamat datang, ' + nama + '.');
  var sub = isKost
    ? 'Mulai hari ini, kamar ' + nomorKamar + ' resmi jadi milikmu. Semoga betah, semoga banyak cerita baik dimulai dari sini.'
    : 'Semoga nyaman selama menginap di Top Hills. Kalau butuh apa-apa, Bang Mezi & Helpdesk siap bantu kapan saja.';
  var pre = isKost ? ('Kunci kamar ' + nomorKamar + ' sudah di tanganmu — selamat datang di rumah 🏡')
    : ('Selamat datang di Top Hills — kamar ' + nomorKamar + ' 🌸');

  return _thShell_(pre,
    _thHero_({ pill: 'SELAMAT DATANG', headline: headline, sub: sub }) +
    _thBodyWrap_(body) +
    _thFooter_(isKost ? 'Selamat menempati rumah barumu, ya.' : 'Selamat beristirahat di Top Hills, ya.', 'Welcome check-in · Kamar ' + nomorKamar));
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
