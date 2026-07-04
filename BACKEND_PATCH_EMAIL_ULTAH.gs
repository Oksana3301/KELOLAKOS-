/*******************************************************************
 * BACKEND_PATCH_EMAIL_ULTAH.gs — Top Hills
 * =================================================================
 * EMAIL #5 — Ucapan Ulang Tahun. HANYA penghuni KOST aktif yang punya
 * email + tanggal_lahir (dari profil rumah, kolom di sheet Booking).
 *
 * Kado (voucher) = configurable via config `kado_ultah` (KwitansiSettings).
 * Keputusan owner: kalau kado BELUM diatur → email TETAP terkirim (ucapan saja,
 * tanpa blok voucher). "Jangan skip email ulang tahun."
 *
 * Butuh helper dari BACKEND_PATCH_CUSTOMER_EMAIL.gs (_custRows_, _custIsKost_,
 * _custActive_, _custKamar_, _custKontak_, _custFmt_, _custSettings_).
 *
 * PASANG: paste → Run `setupUltahTrigger` (harian 08:00). Test: `diagUltah`.
 *******************************************************************/

function _kadoUltah_() {
  var s = (typeof _custSettings_ === 'function') ? _custSettings_() : {};
  return String(s.kado_ultah == null ? '' : s.kado_ultah).trim(); // kosong = tanpa blok voucher
}
function _ultahEmailOf_(b) { return String((b && (b.email || b.Email)) || '').trim(); }

// tanggal_lahir jatuh HARI INI (bandingkan bulan-tanggal, abaikan tahun).
function _ultahIsToday_(tglLahir) {
  if (!tglLahir) return false;
  var d = (tglLahir instanceof Date) ? tglLahir : new Date(String(tglLahir));
  if (isNaN(d.getTime())) return false;
  var tz = Session.getScriptTimeZone() || 'GMT+7';
  return Utilities.formatDate(d, tz, 'MM-dd') === Utilities.formatDate(new Date(), tz, 'MM-dd');
}

function _ultahSubject_(b) { return '🎂 Selamat Ulang Tahun dari Top Hills — ' + String(b.Nama_Customer || ''); }

function _ultahHtml_(b) {
  var kontak = _custKontak_(), kado = _kadoUltah_();
  var nama = String(b.Nama_Customer || 'Kak'), kamar = _custKamar_(b);
  var waHelp = String(kontak.helpdesk || '').replace(/[^0-9]/g, '');
  if (waHelp.indexOf('0') === 0) waHelp = '62' + waHelp.slice(1);
  var claimUrl = 'https://wa.me/' + waHelp + '?text=' + encodeURIComponent('Halo Top Hills 🌸, saya ' + nama + ' mau klaim kado ulang tahun saya 🎂');

  var kadoBlok = kado
    ? '<div style="background:#FBF3E0;border:1px solid #E7D3A0;border-radius:12px;padding:16px;margin:16px 0;text-align:center">' +
        '<div style="color:#8A6A24;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;margin-bottom:6px">🎁 Kado Spesial Untukmu</div>' +
        '<div style="color:#3E2F1C;font-size:14px;line-height:1.6">' + kado.replace(/\n/g, '<br>') + '</div>' +
        '<div style="margin-top:12px"><a href="' + claimUrl + '" style="display:inline-block;background:linear-gradient(135deg,#B98C34,#8A6A24);color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:10px;font-size:14px">Klaim Kado via WhatsApp →</a></div>' +
        '<div style="color:#A99C7E;font-size:11px;margin-top:8px">Atau tunjukkan email ini ke penjaga gedung ya 🌸</div>' +
      '</div>'
    : '';

  return '<div style="margin:0;padding:0;background:#F2EADA">' +
    '<div style="max-width:600px;margin:0 auto;padding:24px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
      '<div style="background:#ffffff;border:1px solid #E7DCC4;border-radius:18px;overflow:hidden">' +
        '<div style="background:#8A6A24;background:linear-gradient(135deg,#B98C34,#8A6A24);padding:28px;text-align:center">' +
          '<div style="color:#FBF7EC;font-size:12px;letter-spacing:4px;font-weight:bold;font-family:Arial,sans-serif">TOP HILLS</div>' +
          '<div style="font-size:40px;margin-top:6px">🎂</div>' +
          '<div style="color:#ffffff;font-size:24px;font-style:italic;margin-top:4px">Hari Spesialmu</div>' +
        '</div>' +
        '<div style="padding:26px 28px;font-family:Arial,Helvetica,sans-serif;text-align:center">' +
          '<p style="color:#3E2F1C;font-size:16px;line-height:1.6;margin:0 0 8px">Selamat ulang tahun, Kak <b>' + nama + '</b>! 🌸</p>' +
          '<p style="color:#5A5446;font-size:14px;line-height:1.6;margin:0 0 8px">Semoga tahun ini penuh kebahagiaan, kesehatan, dan kelancaran. Terima kasih sudah jadi bagian dari keluarga Top Hills' + (kamar ? ' (kamar ' + String(b.Nama_Kamar || '') + ')' : '') + ' 💛</p>' +
          kadoBlok +
        '</div>' +
        '<div style="background:#FAF6EC;border-top:1px solid #E7DCC4;padding:20px 28px;text-align:center;font-family:Arial,sans-serif">' +
          '<div style="color:#8A6A24;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:8px">HUBUNGI KAMI</div>' +
          '<div style="color:#5A5446;font-size:13px;line-height:1.7">💬 Helpdesk Top Hills: <b>' + kontak.helpdesk + '</b><br>💬 Bang Mezi (penjaga): <b>' + kontak.mezi + '</b></div>' +
          '<div style="color:#A99C7E;font-size:11px;margin-top:14px">Top Hills — Kost Putri &amp; Penginapan 🌸</div>' +
        '</div>' +
      '</div>' +
    '</div></div>';
}

function sendUltahEmail_(b) {
  var out = { ok: false, email: false, wa: false };
  var email = _ultahEmailOf_(b);
  if (email && email.indexOf('@') >= 0) {
    try { MailApp.sendEmail({ to: email, subject: _ultahSubject_(b), htmlBody: _ultahHtml_(b) }); out.email = true; }
    catch (e) { out.emailErr = String(e); }
  }
  var wa = String((b && b.WhatsApp) || '').trim();
  if (wa && typeof _fonnteSend_ === 'function') {
    var kado = _kadoUltah_();
    var msg = '🎂 Selamat ulang tahun, Kak ' + String(b.Nama_Customer || '') + '! 🌸 Semoga sehat & bahagia selalu. Terima kasih sudah jadi keluarga Top Hills 💛' + (kado ? ('\n\n🎁 ' + kado) : '');
    try { var r = _fonnteSend_(wa, msg); out.wa = !!(r && r.ok); } catch (e) { out.waErr = String(e); }
  }
  out.ok = out.email || out.wa;
  return out;
}

// Trigger harian: penghuni KOST aktif yang ULANG TAHUN hari ini.
function remindUltahHarian() { return _ultahHarian_(false); }
function _ultahHarian_(force) {
  var year = _custFmt_(new Date(), 'yyyy');
  var rows = _custRows_(), props = PropertiesService.getScriptProperties(), seen = {}, sent = 0;
  rows.forEach(function (b) {
    if (!_custIsKost_(b) || !_custActive_(b)) return;         // KOST aktif only
    if (!_ultahIsToday_(b.tanggal_lahir)) return;
    var email = _ultahEmailOf_(b), key = email || String(b.WhatsApp || '');
    if (!key || seen[key]) return;                            // dedupe per orang
    seen[key] = true;
    var gk = 'ULTAH_' + key + '_' + year;
    if (!force && props.getProperty(gk)) return;              // idempoten per tahun
    var r = sendUltahEmail_(b);
    if (r && r.ok) { props.setProperty(gk, year); sent++; }
  });
  Logger.log('ultah terkirim: ' + sent);
  return 'terkirim ' + sent;
}

function setupUltahTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'remindUltahHarian') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('remindUltahHarian').timeBased().everyDays(1).atHour(8).inTimezone(Session.getScriptTimeZone() || 'GMT+7').create();
  return 'OK — ucapan ulang tahun tiap 08:00.';
}

function diagUltah() {
  var admin = (typeof _adminEmail_ === 'function') ? _adminEmail_() : 'dewiatika4295@gmail.com';
  var b = { Nama_Customer: 'Aisyah Putri', Layanan: 'KOS', Nama_Kamar: '12A', Gedung: 'Gedung A', Tipe_Kamar: 'Standard', Catatan: 'Fasilitas: AC', Email: admin };
  MailApp.sendEmail({ to: admin, subject: '[TEST] ' + _ultahSubject_(b), htmlBody: _ultahHtml_(b) });
  Logger.log('kado_ultah config: "' + _kadoUltah_() + '" (kosong = tanpa blok voucher)');
  return 'Terkirim email ultah uji ke ' + admin;
}
