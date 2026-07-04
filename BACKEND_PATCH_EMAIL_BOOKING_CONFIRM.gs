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
  var isKost = _custIsKost_(b);
  var rek = _custRekening_(isKost), kontak = _custKontak_();
  var nama = _thFirstName_(b), nomorKamar = String(b.Nama_Kamar || '-');
  var p = _custParseCatatan_(b.Catatan), noDoc = String(b.BookingID || '');
  var durasiText = b.Paket || b.Durasi || '-';
  var roomTitle = isKost ? ('Kost Putri — Kamar ' + nomorKamar + (_custHasAc_(b) ? ' · AC' : ''))
    : ('Penginapan' + (b.Tipe_Kamar ? (' · ' + b.Tipe_Kamar) : ''));
  var subParts = [];
  if (b.Nama_Customer) subParts.push(String(b.Nama_Customer));
  if (b.Gedung) subParts.push(String(b.Gedung));
  if (b.CheckIn) subParts.push('Check-in ' + _custTglID_(b.CheckIn));
  else if (isKost) subParts.push('Check-in saat pelunasan');
  var roomSub = subParts.join(' · ');
  var pills = (!isKost && _custHasAc_(b)) ? ['AC'] : null;

  // Rincian (angka belum final → Estimasi/DP dari Catatan bila ada).
  var rowsArr = [];
  rowsArr.push([isKost ? 'Nama Penghuni' : 'Nama Tamu', String(b.Nama_Customer || '-')]);
  rowsArr.push(['Check-in', b.CheckIn ? _custTglID_(b.CheckIn) : (isKost ? 'Saat pelunasan' : '-')]);
  if (!isKost && b.CheckOut) rowsArr.push(['Check-out', _custTglID_(b.CheckOut)]);
  rowsArr.push([isKost ? 'Paket Sewa' : 'Durasi', durasiText]);
  if (Number(b.Jumlah_Orang) > 1) rowsArr.push(['Jumlah orang', String(b.Jumlah_Orang)]);
  var totalArr = null;
  if (p.estimasi > 0 && p.dp > 0) {
    rowsArr.push(['Estimasi Total', _custRp_(p.estimasi)]);
    rowsArr.push(['DP dibayar', _custRp_(p.dp), '#5C7A4C']);
    totalArr = ['Sisa Tagihan', _custRp_(Math.max(0, p.estimasi - p.dp)), '#B0632F'];
  } else if (p.estimasi > 0) {
    totalArr = ['Estimasi Total', _custRp_(p.estimasi), '#3A2E1F'];
  } else if (p.dp > 0) {
    rowsArr.push(['DP dibayar', _custRp_(p.dp), '#5C7A4C']);
  }

  // KOST: tak ada batas 1×24 jam pelunasan → lunasi sebelum menempati.
  // PENGINAPAN: selesaikan pembayaran maks 1×24 jam (slot diamankan).
  var payLine = isKost
    ? ('Transfer ke ' + rek.bank + ' ' + rek.no + ' a.n ' + rek.atasNama + '. Jika ingin menempati kamar, diharapkan sudah melunasi semua pembayaran.')
    : ('Transfer ' + (p.dp > 0 ? 'sisa ' : '') + 'ke ' + rek.bank + ' ' + rek.no + ' a.n ' + rek.atasNama + ', maksimal 1×24 jam agar slot tetap aman.');
  var step3 = isKost
    ? 'Datang di tanggal check-in, Bang Mezi bantu tunjukkan kamarmu.'
    : 'Booking aktif setelah diverifikasi admin. Datang mulai 13.00 WIB, Bang Mezi bantu tunjukkan kamarmu.';

  var waUrl = _thWaUrl_(kontak.helpdesk, 'Halo Top Hills 🌸, saya ' + String(b.Nama_Customer || '') + (noDoc ? (' (kode ' + noDoc + ')') : '') + '. Mau konfirmasi pembayaran booking saya.');

  var body = _thDivider_('DETAIL BOOKING') +
    _thRoomCard_(nomorKamar, roomTitle, roomSub, pills, false) +
    _thRows_(rowsArr, totalArr) +
    _thDivider_('LANGKAH SELANJUTNYA') +
    _thSteps_([
      ['Lunasi pembayaran', payLine],
      ['Kirim bukti transfer via WA', 'Ke Helpdesk ' + kontak.helpdesk + (noDoc ? (' dengan kode ' + noDoc) : '') + '.'],
      ['Check-in & terima kunci', step3]
    ]);
  if (!isKost) body += _thNote_('⏰', 'Check-in mulai <b>13.00 WIB</b> · Check-out maksimal <b>12.00 WIB</b>. Lewat jam check-out bisa dihitung tambah 1 malam ya 🙏');
  body += _thNote_('📄', 'Invoice resmi akan dikirim otomatis setelah admin mengonfirmasi pembayaran kamu.') +
    _thCta_('Konfirmasi Pembayaran via WA', 'Atau balas email ini kalau ada yang mau ditanyakan', waUrl);

  var headline = isKost ? ('Kamarmu sudah kami siapkan, ' + nama + '.') : ('Booking kamu sudah kami amankan, ' + nama + '.');
  var sub = isKost
    ? 'Terima kasih sudah memilih Top Hills sebagai rumah barumu. Slot kamarmu aman — tinggal selesaikan pembayaran. Berikut detailnya.'
    : 'Terima kasih sudah memilih Top Hills. Slot kamarmu aman — tinggal selesaikan pembayaran ya. Berikut detailnya.';

  return _thShell_('Booking kamu sudah kami terima' + (nomorKamar !== '-' ? (' — kamar ' + nomorKamar + ' menunggu 🏡') : ' 🏡'),
    _thHero_({ pill: 'BOOKING DITERIMA', headline: headline, sub: sub, box: { label: 'KODE BOOKING', value: noDoc || '-' } }) +
    _thBodyWrap_(body) +
    _thFooter_(isKost ? 'Selamat datang di rumah baru, ya.' : 'Sampai ketemu di Top Hills, ya.', 'Konfirmasi booking' + (noDoc ? (' · ' + noDoc) : '')));
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
