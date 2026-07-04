/*******************************************************************
 * BACKEND_PATCH_FONNTE_WA.gs — Top Hills
 * =================================================================
 * Auto-kirim WhatsApp KE CUSTOMER via Fonnte (WA gateway). Dipakai bareng
 * BACKEND_PATCH_CUSTOMER_EMAIL.gs (butuh helper _custBayar_/_custRekening_/
 * _custKamar_/_custTglID_/_custRp_/_custKontak_/_custIsKost_ dari file itu).
 *
 * Alur (otomatis, tanpa klik):
 *   • Booking dari /info      → WA "Booking Diterima" ke customer.
 *   • Admin Terima DP/Lunas   → WA Invoice / Kuitansi ke customer.
 *   • Reminder pelunasan      → WA reminder ke customer.
 * (Email tetap jalan; WA ini tambahan.)
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ CARA PASANG:                                                   │
 * │ 1) Paste file ini sebagai .gs BARU. Save.                     │
 * │ 2) SIMPAN TOKEN (jangan ditulis di kode yang di-share):        │
 * │    Project Settings ⚙️ → Script properties → Add:             │
 * │      Property: FONNTE_TOKEN   Value: <token Fonnte kamu>       │
 * │    (atau isi TOKEN di setFonnteToken() lalu Run sekali,        │
 * │     habis itu kosongkan lagi barisnya.)                        │
 * │ 3) Di BACKEND_PATCH_CUSTOMER_EMAIL.gs → fungsi                 │
 * │    sendBookingDocToCustomer_, TEPAT SEBELUM `return { ok:true` │
 * │    tambahkan:                                                  │
 * │      try { if (typeof _fonnteSend_==='function')               │
 * │        _fonnteSend_(b.WhatsApp,_fonnteCustomerText_(b,mode)); } │
 * │        catch(e){}                                              │
 * │ 4) Di submitBookingRequest (apiv2.gs), SETELAH sh.appendRow,   │
 * │    tambahkan:                                                  │
 * │      try { _fonnteCustomerReceived_(vals); } catch(e){}        │
 * │ 5) Run `diagFonnte` → cek WA masuk ke nomor uji di Logs.      │
 * │ 6) Deploy → New version.                                       │
 * └───────────────────────────────────────────────────────────────┘
 *******************************************************************/

function _fonnteToken_() { return PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || ''; }

// Isi TOKEN, Run SEKALI, lalu boleh kosongkan lagi (token tersimpan di properties).
function setFonnteToken() {
  var TOKEN = ''; // ← tempel token Fonnte kamu di sini, Run, lalu hapus lagi
  if (!TOKEN) return 'Isi dulu TOKEN di fungsi setFonnteToken.';
  PropertiesService.getScriptProperties().setProperty('FONNTE_TOKEN', TOKEN);
  return 'Token Fonnte tersimpan ✓';
}

// Normalisasi nomor ke 62… lalu kirim via Fonnte.
function _fonnteSend_(target, message) {
  var token = _fonnteToken_();
  if (!token) { Logger.log('FONNTE_TOKEN belum di-set'); return { ok: false, error: 'no token' }; }
  var to = String(target == null ? '' : target).replace(/[^0-9]/g, '');
  if (to.indexOf('620') === 0) to = '62' + to.slice(3);
  else if (to.indexOf('0') === 0) to = '62' + to.slice(1);
  else if (to.indexOf('8') === 0) to = '62' + to;
  if (!to) return { ok: false, error: 'no target' };
  try {
    var res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { Authorization: token },
      payload: { target: to, message: message, countryCode: '62' },
      muteHttpExceptions: true,
    });
    var body = res.getContentText();
    Logger.log('Fonnte → ' + to + ' [' + res.getResponseCode() + '] ' + body);
    return { ok: res.getResponseCode() === 200 && body.indexOf('"status":true') >= 0, body: body };
  } catch (e) { Logger.log('Fonnte error: ' + e); return { ok: false, error: String(e) }; }
}

// Teks WA untuk customer. mode: 'received' | 'invoice' | 'kwitansi' | 'reminder'.
// Butuh helper dari BACKEND_PATCH_CUSTOMER_EMAIL.gs.
function _fonnteCustomerText_(b, mode) {
  var isKost = (typeof _custIsKost_ === 'function') ? _custIsKost_(b) : String(b.Layanan || '').toUpperCase().indexOf('KOS') >= 0;
  var pay = (typeof _custBayar_ === 'function') ? _custBayar_(b) : { total: 0, dibayar: 0, sisa: 0, lunas: false };
  var rek = (typeof _custRekening_ === 'function') ? _custRekening_(isKost) : { bank: '-', no: '-', atasNama: '-' };
  var kontak = (typeof _custKontak_ === 'function') ? _custKontak_() : { helpdesk: '0811-6646-615', mezi: '0838-4161-4871' };
  var rp = (typeof _custRp_ === 'function') ? _custRp_ : function (n) { return 'Rp' + (Number(n) || 0); };
  var tgl = (typeof _custTglID_ === 'function') ? _custTglID_ : function (v) { return String(v || '-'); };
  var nama = String(b.Nama_Customer || 'Kak');
  var kamar = (typeof _custKamar_ === 'function') ? _custKamar_(b) : String(b.Nama_Kamar || '-');
  var periode = b.CheckIn ? (tgl(b.CheckIn) + (b.CheckOut ? (' – ' + tgl(b.CheckOut)) : '')) : (b.Paket || b.Durasi || '-');
  var L = [];
  if (mode === 'received') { L.push('✅ *Booking Diterima — Top Hills* 🌸'); L.push(''); L.push('Halo Kak *' + nama + '*, terima kasih! Booking kamu sudah kami terima & sedang *menunggu konfirmasi admin* (maks 1×24 jam).'); }
  else if (mode === 'kwitansi') { L.push('🧾 *KUITANSI PELUNASAN — Top Hills*'); L.push(''); L.push('Halo Kak *' + nama + '*, pembayaranmu sudah *LUNAS*. Terima kasih! 🌸'); }
  else if (mode === 'reminder') { L.push('⏰ *Reminder Pelunasan — Top Hills*'); L.push(''); L.push('Halo Kak *' + nama + '*, mengingatkan pelunasan booking kamu ya 🙏'); }
  else { L.push('🧾 *INVOICE / TAGIHAN — Top Hills*'); L.push(''); L.push('Halo Kak *' + nama + '*, terima kasih sudah booking. Berikut rincian & tagihannya:'); }
  L.push('');
  L.push('🏠 Kamar: *' + kamar + '*');
  L.push('🛏️ Layanan: ' + (isKost ? 'Kost Putri' : 'Penginapan'));
  L.push('📅 Periode: ' + periode);
  if (pay.total > 0) L.push('💰 Total: ' + rp(pay.total));
  if (pay.dibayar > 0) L.push('✅ Sudah dibayar: ' + rp(pay.dibayar));
  if (mode === 'kwitansi' || pay.lunas) L.push('*Status: LUNAS ✓*');
  else if (pay.sisa > 0) L.push('*💰 Sisa tagihan: ' + rp(pay.sisa) + '*');
  L.push('');
  if (mode !== 'kwitansi' && !pay.lunas && pay.sisa > 0) {
    L.push('*Silakan lunasi ke rekening:*');
    L.push('🏦 ' + rek.bank);
    L.push('No. Rek: *' + rek.no + '* (a.n. ' + rek.atasNama + ')');
    L.push('Setelah transfer, kirim buktinya ke chat ini ya 🙏');
    L.push('');
  }
  if (mode === 'received') { L.push('📄 Invoice/kuitansi resmi menyusul setelah admin konfirmasi.'); L.push(''); }
  L.push('*Butuh bantuan?*');
  L.push('💬 Helpdesk: ' + kontak.helpdesk);
  L.push('💬 Bang Mezi (penjaga): ' + kontak.mezi);
  L.push('Terima kasih 🌸 — Top Hills');
  return L.join('\n');
}

// Kirim WA "Booking Diterima" ke customer (dipanggil dari submitBookingRequest).
function _fonnteCustomerReceived_(b) {
  try {
    var wa = String((b && b.WhatsApp) || '').trim();
    if (!wa) return;
    return _fonnteSend_(wa, _fonnteCustomerText_(b, 'received'));
  } catch (e) { Logger.log('received wa gagal: ' + e); }
}

// ACTION opsional (kalau mau dipanggil dari frontend): { bookingId, kind }
function sendCustomerWa_(data) {
  data = data || {};
  var b = (typeof _custFindById_ === 'function') ? _custFindById_(String(data.bookingId || data.booking_id || '').trim()) : null;
  if (!b) return { ok: false, error: 'booking tak ditemukan' };
  var pay = (typeof _custBayar_ === 'function') ? _custBayar_(b) : { lunas: false };
  var kind = String(data.kind || '').toLowerCase();
  var mode = (kind === 'received' || kind === 'invoice' || kind === 'kwitansi' || kind === 'reminder') ? kind : (pay.lunas ? 'kwitansi' : 'invoice');
  return _fonnteSend_(b.WhatsApp, _fonnteCustomerText_(b, mode));
}

// Cek koneksi + kirim WA uji. GANTI nomor uji ke nomor kamu.
function diagFonnte() {
  var NOMOR_UJI = '62895610524580'; // ← ganti ke nomor WA-mu untuk tes
  Logger.log('Token ada: ' + (!!_fonnteToken_()));
  var r = _fonnteSend_(NOMOR_UJI, '✅ Tes Fonnte Top Hills — kalau kamu terima ini, WA gateway AKTIF. ' + new Date());
  Logger.log('Hasil: ' + JSON.stringify(r));
  return r;
}
