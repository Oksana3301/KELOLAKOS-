/*******************************************************************
 * BACKEND_PATCH_EMAIL_BOOKING_CONFIRM.gs — Top Hills
 * =================================================================
 * EMAIL #1 — Konfirmasi Booking (dikirim SAAT booking dibuat, status MENUNGGU).
 * Beda dari invoice/kuitansi (yang dikirim saat admin KONFIRMASI):
 *   - Ini "booking diterima, silakan transfer, konfirmasi maks 1×24 jam".
 *   - Angka uang belum final → pakai Estimasi/DP dari catatan (bila ada).
 *   - TIDAK ada deposit (sistem Top Hills pakai DP/Lunas, bukan deposit).
 *
 * Butuh helper dari BACKEND_PATCH_CUSTOMER_EMAIL.gs (_custIsKost_, _custRp_,
 * _custKamar_, _custTglID_, _custRekening_, _custKontak_, _custFmt_).
 *
 * BELUM DIWIRE ke trigger (menunggu approval). Setelah di-approve:
 *   di submitBookingRequest (apiv2.gs), SETELAH sh.appendRow, tambahkan:
 *     try { sendBookingConfirmEmail_(vals); } catch(e){}
 *******************************************************************/

// Ambil Estimasi & DP dari kolom Catatan booking /info ("Estimasi: Rp .. — DP: Rp ..").
function _custParseCatatan_(c) {
  c = String(c || '');
  function grab(re) { var m = c.match(re); return m ? Number(String(m[1]).replace(/[^0-9]/g, '')) : 0; }
  return { estimasi: grab(/Estimasi:\s*Rp\s*([\d.,]+)/i), dp: grab(/DP:\s*Rp\s*([\d.,]+)/i) };
}

function _bookingConfirmSubject_(b) {
  return '🌸 Booking Diterima — Top Hills · ' + String(b.Nama_Customer || '');
}

function _bookingConfirmHtml_(b) {
  var isKost = (typeof _custIsKost_ === 'function') ? _custIsKost_(b) : String(b.Layanan || '').toUpperCase().indexOf('KOS') >= 0;
  var rek = (typeof _custRekening_ === 'function') ? _custRekening_(isKost) : { bank: '-', no: '-', atasNama: '-' };
  var kontak = (typeof _custKontak_ === 'function') ? _custKontak_() : { helpdesk: '0811-6646-615', mezi: '0838-4161-4871' };
  var rp = (typeof _custRp_ === 'function') ? _custRp_ : function (n) { return 'Rp' + (Number(n) || 0); };
  var tgl = (typeof _custTglID_ === 'function') ? _custTglID_ : function (v) { return String(v || '-'); };
  var kamar = (typeof _custKamar_ === 'function') ? _custKamar_(b) : String(b.Nama_Kamar || '-');
  var nama = String(b.Nama_Customer || 'Kak');
  var p = _custParseCatatan_(b.Catatan);
  var periode = b.Paket || b.Durasi || '-';
  // KOST kunci-tanggal: tanggal masuk di-set saat pelunasan. Penginapan: tampil tanggal.
  var tglMasuk = b.CheckIn ? tgl(b.CheckIn) : (isKost ? 'di-set saat konfirmasi (pelunasan)' : '-');

  function row(k, v, color) {
    return '<tr><td style="padding:9px 0;color:#8A7A5A;font-size:13px;border-bottom:1px solid #EDE3CE">' + k + '</td>' +
      '<td align="right" style="padding:9px 0;color:' + (color || '#3E2F1C') + ';font-size:13px;font-weight:bold;border-bottom:1px solid #EDE3CE">' + v + '</td></tr>';
  }
  var detail = row('Kode Booking', String(b.BookingID || '-')) +
    row('Kamar', kamar) + row('Layanan', isKost ? 'Kost Putri' : 'Penginapan') +
    row('Periode', periode) + row('Tanggal masuk', tglMasuk) +
    (b.CheckOut && !isKost ? row('Check-out', tgl(b.CheckOut)) : '') +
    (Number(b.Jumlah_Orang) > 1 ? row('Jumlah orang', String(b.Jumlah_Orang)) : '') +
    (p.estimasi > 0 ? row('Estimasi', rp(p.estimasi)) : '') +
    (p.dp > 0 ? row('DP dibayar', rp(p.dp), '#178A43') : '');

  var statusBlock = '<div style="text-align:center;background:#FBF3E0;border:1px solid #E7D3A0;border-radius:12px;padding:14px;margin:18px 0">' +
    '<div style="color:#8A6A24;font-size:16px;font-weight:bold">⏳ Menunggu Konfirmasi</div>' +
    '<div style="color:#8A7A5A;font-size:12px;margin-top:3px">Slot kamu kami amankan. Mohon selesaikan pembayaran maks <b>1×24 jam</b>.</div></div>';

  var langkah = '<div style="background:#FAF6EC;border:1px solid #E7DCC4;border-radius:12px;padding:14px 16px;margin:6px 0">' +
    '<div style="color:#8A6A24;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Langkah selanjutnya</div>' +
    '<div style="color:#5A5446;font-size:13px;line-height:1.7">1. Transfer ke rekening di bawah.<br>2. Kirim bukti transfer via WhatsApp admin.<br>3. Booking aktif setelah diverifikasi admin (maks 1×24 jam).</div>' +
    '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #EDE3CE">' +
      '<div style="color:#3E2F1C;font-size:15px;font-weight:bold">🏦 ' + rek.bank + '</div>' +
      '<div style="color:#3E2F1C;font-size:20px;font-weight:bold;letter-spacing:1px;margin:2px 0">' + rek.no + '</div>' +
      '<div style="color:#8A7A5A;font-size:13px">a.n. ' + rek.atasNama + '</div>' +
    '</div></div>';

  var jam = isKost ? '' : '<p style="color:#A99C7E;font-size:12px;text-align:center;margin:12px 0 0">⏰ Check-in mulai 13.00 WIB · Check-out maksimal 12.00 WIB</p>';

  return '<div style="margin:0;padding:0;background:#F2EADA">' +
    '<div style="max-width:600px;margin:0 auto;padding:24px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
      '<div style="background:#ffffff;border:1px solid #E7DCC4;border-radius:18px;overflow:hidden">' +
        '<div style="background:#8A6A24;background:linear-gradient(135deg,#B98C34,#8A6A24);padding:26px 28px;text-align:center">' +
          '<div style="color:#FBF7EC;font-size:12px;letter-spacing:4px;font-weight:bold;font-family:Arial,sans-serif">TOP HILLS</div>' +
          '<div style="color:#ffffff;font-size:22px;font-style:italic;margin-top:6px">Booking Diterima</div>' +
          '<div style="color:#F3E6C8;font-size:12px;margin-top:4px;font-family:Arial,sans-serif">' + _custFmt_(new Date(), 'd MMMM yyyy') + '  ·  ' + String(b.BookingID || '') + '</div>' +
        '</div>' +
        '<div style="padding:26px 28px;font-family:Arial,Helvetica,sans-serif">' +
          '<p style="color:#3E2F1C;font-size:15px;line-height:1.5;margin:0 0 16px">Halo Kak <b>' + nama + '</b> 🌸<br>Terima kasih! Booking kamu di Top Hills sudah kami terima. Berikut detailnya:</p>' +
          '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + detail + '</table>' +
          statusBlock + langkah + jam +
          '<p style="color:#A99C7E;font-size:12px;text-align:center;margin:14px 0 0">📄 Invoice resmi akan dikirim otomatis setelah admin mengonfirmasi pembayaran kamu.</p>' +
        '</div>' +
        '<div style="background:#FAF6EC;border-top:1px solid #E7DCC4;padding:20px 28px;text-align:center;font-family:Arial,sans-serif">' +
          '<div style="color:#8A6A24;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:8px">BUTUH BANTUAN?</div>' +
          '<div style="color:#5A5446;font-size:13px;line-height:1.7">💬 Helpdesk Top Hills: <b>' + kontak.helpdesk + '</b><br>💬 Bang Mezi (penjaga): <b>' + kontak.mezi + '</b></div>' +
          '<div style="color:#A99C7E;font-size:11px;margin-top:14px">Top Hills — Kost Putri &amp; Penginapan · Terima kasih 🌸</div>' +
        '</div>' +
      '</div>' +
    '</div></div>';
}

// Kirim email konfirmasi booking ke customer (+ WA via Fonnte bila terpasang).
function sendBookingConfirmEmail_(b) {
  var out = { ok: false, email: false, wa: false };
  var email = String((b && b.Email) || '').trim();
  if (email && email.indexOf('@') >= 0) {
    try { MailApp.sendEmail({ to: email, subject: _bookingConfirmSubject_(b), htmlBody: _bookingConfirmHtml_(b) }); out.email = true; }
    catch (e) { out.emailErr = String(e); }
  }
  var wa = String((b && b.WhatsApp) || '').trim();
  if (wa && typeof _fonnteCustomerReceived_ === 'function') {
    try { var r = _fonnteCustomerReceived_(b); out.wa = !!(r && r.ok); } catch (e) { out.waErr = String(e); }
  }
  out.ok = out.email || out.wa;
  return out;
}

// Uji: kirim contoh email konfirmasi (kost & penginapan) ke email owner.
function diagBookingConfirm() {
  var to = (typeof _custKontak_ === 'function') ? '' : '';
  var admin = (typeof _adminEmail_ === 'function') ? _adminEmail_() : 'dewiatika4295@gmail.com';
  var kost = { BookingID: 'TH-2026-0148', Nama_Customer: 'Aisyah Putri', Layanan: 'KOS', Nama_Kamar: '12A', Gedung: 'Gedung A', Tipe_Kamar: 'Standard', Paket: '6 Bulan', Jumlah_Orang: 1, Catatan: 'Estimasi: Rp 8.000.000 — DP: Rp 4.000.000', Email: admin };
  var png = { BookingID: 'TH-2026-0613', Nama_Customer: 'Dewi Atika', Layanan: 'PENGINAPAN', Nama_Kamar: 'D01', Gedung: 'Gedung C', Tipe_Kamar: 'Executive', Paket: '3 malam', CheckIn: '2026-07-10', CheckOut: '2026-07-13', Jumlah_Orang: 2, Catatan: 'Estimasi: Rp 1.150.000 — DP: Rp 400.000', Email: admin };
  MailApp.sendEmail({ to: admin, subject: '[TEST] ' + _bookingConfirmSubject_(kost), htmlBody: _bookingConfirmHtml_(kost) });
  MailApp.sendEmail({ to: admin, subject: '[TEST] ' + _bookingConfirmSubject_(png), htmlBody: _bookingConfirmHtml_(png) });
  return 'Terkirim 2 email uji (kost & penginapan) ke ' + admin + ' — cek inbox & Spam.';
}
