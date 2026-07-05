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
// Deteksi fasilitas AC (KOST) dari segmen "Fasilitas: ..." di Catatan / kolom Fasilitas_IDs.
function _custHasAc_(b) {
  var m = String(b.Catatan || '').match(/Fasilitas:\s*([^—\n]+)/i);
  var fas = (m ? m[1] : '') + ' ' + String(b.Fasilitas_IDs || '') + ' ' + String(b.Fasilitas || '');
  return /\bAC\b/i.test(fas) || /air\s*condition/i.test(fas);
}
function _custKamar_(b) {
  var ac = (_custIsKost_(b) && _custHasAc_(b)) ? ' - AC' : '';   // kost + AC → "12A - AC"
  return String(b.Nama_Kamar || '-') + ac + (b.Gedung ? (' · ' + b.Gedung) : '') + (b.Tipe_Kamar ? (' (' + b.Tipe_Kamar + ')') : '');
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
  // Fallback = rekening RESMI Top Hills (dipakai bila config Pengaturan belum diisi).
  var def = isKost
    ? { bank: 'BCA', no: '0320839912', atasNama: 'Azhar Latif' }          // KOST
    : { bank: 'BCA', no: '0321548473', atasNama: 'Atika Dewi Suryani' };  // PENGINAPAN
  return {
    bank: t(isKost ? s.inv_kost_bank_name : s.inv_png_bank_name) || t(s.inv_bank_name) || def.bank,
    no: t(isKost ? s.inv_kost_account_no : s.inv_png_account_no) || t(s.inv_account_no) || def.no,
    atasNama: t(isKost ? s.inv_kost_account_name : s.inv_png_account_name) || t(s.inv_account_name) || def.atasNama,
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
/* ===================================================================
 * TEMA EMAIL "TOP HILLS" — dark hero + serif display + gold + room card.
 * Dipakai SEMUA email (invoice/kwitansi/reminder, konfirmasi booking,
 * welcome, checkout) supaya desainnya SATU bahasa & konsisten.
 * Table-based (aman Gmail/Outlook). Web-font (Cormorant Garamond / Inter)
 * otomatis fallback ke Georgia (serif) & Arial (body) di email client.
 * =================================================================== */
var TH_BODY = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
var TH_DISPLAY = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

function _thFirstName_(b) {
  var n = String((b && (b.Nama_Customer || b.Nama)) || '').trim();
  return n ? n.split(/\s+/)[0] : 'Kak';
}
// Email resmi footer (dari config inv_email_resmi; fallback email bisnis Top Hills).
function _thEmailResmi_() {
  var s = (typeof _custSettings_ === 'function') ? _custSettings_() : {};
  var t = String((s && s.inv_email_resmi) || '').trim();
  return t || 'kostputritophills@gmail.com';
}
function _thWaUrl_(phone, text) {
  var p = String(phone || '').replace(/[^0-9]/g, '');
  if (p.indexOf('0') === 0) p = '62' + p.slice(1);
  else if (p.indexOf('8') === 0) p = '62' + p;
  return 'https://wa.me/' + p + (text ? ('?text=' + encodeURIComponent(text)) : '');
}
// No kwitansi: TH/{KOST|PNG}/{tahun}-{4 digit akhir BookingID}.
function _thKwitansiNo_(b, isKost) {
  var id = String(b.BookingID || ''), last4 = (id.replace(/[^0-9]/g, '').slice(-4) || '0000');
  var iso = _custISO_(b.CheckIn), yr = iso ? _custFmt_(new Date(iso + 'T00:00:00'), 'yyyy') : _custFmt_(new Date(), 'yyyy');
  return 'TH/' + (isKost ? 'KOST' : 'PNG') + '/' + yr + '-' + last4;
}

function _thWordmark_() {
  return '<div style="font-family:' + TH_BODY + ';font-size:13px;letter-spacing:6px;font-weight:700;color:#DDBE7F">TOP HILLS</div>' +
    '<div style="font-family:' + TH_BODY + ';font-size:10px;letter-spacing:3px;color:#C9BCA2;margin-top:6px">KOST PUTRI &amp; PENGINAPAN</div>';
}

// Hero gelap. o = {pill, pillColor, pillBorder, headline, sub, box:{label,value,vc,lc,hint}, icon}
function _thHero_(o) {
  o = o || {};
  var box = '';
  if (o.box) {
    var x = o.box;
    box = '<tr><td align="center" style="padding-top:26px"><table cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:14px 28px;background:rgba(201,168,106,.14);border:1px dashed rgba(201,168,106,.6);border-radius:14px">' +
      '<div style="font-family:' + TH_BODY + ';font-size:11px;font-weight:700;letter-spacing:2px;color:' + (x.lc || '#A9956A') + '">' + x.label + '</div>' +
      '<div style="font-family:' + TH_DISPLAY + ';font-size:26px;font-weight:700;letter-spacing:3px;color:' + (x.vc || '#DDBE7F') + ';margin-top:6px">' + x.value + '</div>' +
      (x.hint ? '<div style="font-family:' + TH_BODY + ';font-size:12px;color:#C9BCA2;margin-top:5px">' + x.hint + '</div>' : '') +
      '</td></tr></table></td></tr>';
  }
  var icon = o.icon ? ('<tr><td align="center" style="padding-top:24px"><table cellpadding="0" cellspacing="0" role="presentation"><tr>' +
    '<td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;background:rgba(122,159,101,.18);border:1px solid rgba(122,159,101,.55);border-radius:99px;font-size:30px;color:#9FBE8B">' + o.icon + '</td>' +
    '</tr></table></td></tr>') : '';
  return '<tr><td align="center" style="background:#2E2416;background:linear-gradient(165deg,#2E2416 0%,#3A2E1F 55%,#463823 100%);padding:44px 40px 40px">' +
    '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">' + _thWordmark_() + '</td></tr>' + icon +
    '<tr><td align="center" style="padding-top:22px"><span style="display:inline-block;padding:7px 18px;border:1px solid ' + (o.pillBorder || 'rgba(201,168,106,.55)') + ';border-radius:999px;font-family:' + TH_BODY + ';font-size:12px;font-weight:600;letter-spacing:2.2px;color:' + (o.pillColor || '#DDBE7F') + '">' + o.pill + '</span></td></tr>' +
    '<tr><td align="center" style="padding-top:20px"><div style="font-family:' + TH_DISPLAY + ';font-style:italic;font-weight:600;font-size:38px;line-height:1.15;color:#F5EDE0">' + o.headline + '</div></td></tr>' +
    '<tr><td align="center" style="padding-top:14px"><div style="font-family:' + TH_BODY + ';font-size:15px;line-height:1.6;color:#C9BCA2;max-width:430px">' + o.sub + '</div></td></tr>' +
    box + '</table></td></tr>';
}

function _thDivider_(label) {
  return '<tr><td style="padding:34px 44px 0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>' +
    '<td style="height:1px;background:#D8C9A8;line-height:1px;font-size:0">&nbsp;</td>' +
    '<td style="padding:0 14px;white-space:nowrap;font-family:' + TH_BODY + ';font-size:11px;font-weight:700;letter-spacing:2.4px;color:#A9956A">' + label + '</td>' +
    '<td style="height:1px;background:#D8C9A8;line-height:1px;font-size:0">&nbsp;</td>' +
    '</tr></table></td></tr>';
}

function _thRoomCard_(number, title, subtitle, pills, badge) {
  var chips = '';
  if (pills && pills.length) {
    for (var i = 0; i < pills.length; i++)
      chips += '<span style="display:inline-block;padding:4px 11px;margin:3px 5px 0 0;background:#F4EFE3;border:1px solid rgba(201,168,106,.4);border-radius:999px;font-family:' + TH_BODY + ';font-size:11.5px;font-weight:600;color:#6E5F45">' + pills[i] + '</span>';
    chips = '<div style="margin-top:8px">' + chips + '</div>';
  }
  var bdg = badge ? ('<div style="margin-top:8px"><span style="display:inline-block;padding:4px 12px;background:rgba(122,159,101,.15);border:1px solid rgba(122,159,101,.4);border-radius:999px;font-family:' + TH_BODY + ';font-size:11.5px;font-weight:700;color:#5C7A4C">&#10003; LUNAS</span></div>') : '';
  return '<tr><td style="padding:24px 44px 0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;border:1px solid rgba(58,46,31,.08);border-radius:18px;overflow:hidden"><tr>' +
    '<td width="110" valign="middle" align="center" style="width:110px;background:#3A2E1F;background:linear-gradient(160deg,#3A2E1F,#54432A);padding:22px 8px">' +
    '<div style="font-family:' + TH_BODY + ';font-size:11px;font-weight:700;letter-spacing:1.8px;color:#A9956A">KAMAR</div>' +
    '<div style="font-family:' + TH_DISPLAY + ';font-weight:700;font-size:38px;color:#DDBE7F;line-height:1.1;margin-top:2px">' + number + '</div></td>' +
    '<td valign="middle" style="padding:18px 22px">' +
    '<div style="font-family:' + TH_BODY + ';font-size:16px;font-weight:700;color:#3A2E1F">' + title + '</div>' +
    '<div style="font-family:' + TH_BODY + ';font-size:13px;color:#8A7F6B;margin-top:4px">' + subtitle + '</div>' + chips + bdg +
    '</td></tr></table></td></tr>';
}

// rows = [[label, value, (color?)], ...]; total = [label, value, (color?)] atau null.
function _thRows_(rows, total) {
  var r = '';
  for (var i = 0; i < rows.length; i++) {
    var vc = rows[i][2] || '#3A2E1F';
    r += '<tr><td style="padding:13px 0;border-bottom:1px solid rgba(58,46,31,.07);font-family:' + TH_BODY + ';font-size:13.5px;color:#8A7F6B">' + rows[i][0] + '</td>' +
      '<td align="right" style="padding:13px 0;border-bottom:1px solid rgba(58,46,31,.07);font-family:' + TH_BODY + ';font-size:14.5px;font-weight:600;color:' + vc + '">' + rows[i][1] + '</td></tr>';
  }
  var t = '';
  if (total) {
    t = '<tr><td style="padding:15px 0;font-family:' + TH_BODY + ';font-size:14px;font-weight:700;color:#3A2E1F">' + total[0] + '</td>' +
      '<td align="right" style="padding:15px 0;font-family:' + TH_DISPLAY + ';font-size:26px;font-weight:700;color:' + (total[2] || '#3A2E1F') + '">' + total[1] + '</td></tr>';
  }
  return '<tr><td style="padding:16px 44px 0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;border:1px solid rgba(58,46,31,.08);border-radius:18px;padding:2px 22px">' + r + t + '</table></td></tr>';
}

// items = [[judul, deskripsi], ...] → langkah bernomor.
function _thSteps_(items) {
  var inner = '';
  for (var i = 0; i < items.length; i++) {
    inner += '<tr><td style="padding-bottom:12px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;border:1px solid rgba(58,46,31,.07);border-radius:14px"><tr>' +
      '<td width="58" valign="top" align="center" style="width:58px;padding:16px 0 16px 16px"><table cellpadding="0" cellspacing="0" role="presentation"><tr><td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;background:#3A2E1F;border-radius:999px;font-family:' + TH_BODY + ';font-size:15px;font-weight:700;color:#DDBE7F">' + (i + 1) + '</td></tr></table></td>' +
      '<td valign="middle" style="padding:14px 18px 14px 4px"><div style="font-family:' + TH_BODY + ';font-size:14.5px;font-weight:700;color:#3A2E1F">' + items[i][0] + '</div>' +
      '<div style="font-family:' + TH_BODY + ';font-size:13.5px;color:#8A7F6B;line-height:1.55;margin-top:3px">' + items[i][1] + '</div></td></tr></table></td></tr>';
  }
  return '<tr><td style="padding:22px 44px 0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">' + inner + '</table></td></tr>';
}

function _thNote_(emoji, text, tint) {
  var bg = 'rgba(201,168,106,.16)', bd = 'rgba(201,168,106,.4)';
  if (tint === 'green') { bg = 'rgba(122,159,101,.14)'; bd = 'rgba(122,159,101,.35)'; }
  return '<tr><td style="padding:20px 44px 0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:' + bg + ';border:1px solid ' + bd + ';border-radius:14px"><tr>' +
    '<td width="42" valign="top" style="padding:15px 0 15px 18px;font-size:20px">' + emoji + '</td>' +
    '<td valign="middle" style="padding:15px 18px 15px 8px;font-family:' + TH_BODY + ';font-size:13.5px;color:#5A4F3C;line-height:1.55">' + text + '</td>' +
    '</tr></table></td></tr>';
}

function _thCta_(label, sub, href) {
  var s = sub ? ('<tr><td align="center" style="padding-top:12px;font-family:' + TH_BODY + ';font-size:12.5px;color:#A9956A">' + sub + '</td></tr>') : '';
  return '<tr><td align="center" style="padding:30px 44px 4px"><table cellpadding="0" cellspacing="0" role="presentation"><tr>' +
    '<td align="center" style="background:#C9A86A;border-radius:12px"><a href="' + (href || '#') + '" style="display:inline-block;padding:16px 42px;font-family:' + TH_BODY + ';font-size:15.5px;font-weight:700;color:#3A2E1F;text-decoration:none">' + label + '</a></td>' +
    '</tr></table></td></tr>' + s;
}

function _thFooter_(tagline, meta) {
  var kontak = _custKontak_();
  return '<tr><td align="center" style="background:#2E2416;padding:34px 44px">' + _thWordmark_() +
    '<div style="font-family:' + TH_DISPLAY + ';font-style:italic;font-size:18px;color:#C9BCA2;margin-top:12px">' + tagline + '</div>' +
    '<div style="font-family:' + TH_BODY + ';font-size:12.5px;color:#8A7F6B;margin-top:16px;line-height:1.7">Top Hills · Limau Manis, Pauh, Kota Padang, Sumatera Barat 25176<br>WA ' + kontak.helpdesk + ' &middot; <span style="color:#A9956A">' + _thEmailResmi_() + '</span></div>' +
    '<div style="font-family:' + TH_BODY + ';font-size:11px;color:#6E5F45;margin-top:14px;letter-spacing:.4px">' + meta + '</div>' +
    '</td></tr>';
}

function _thBodyWrap_(inner) {
  return '<tr><td style="background:#FBF7EF;padding:16px 0 40px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">' + inner + '</table></td></tr>';
}

// Rangka penuh: preheader + kartu (hero + body + footer).
function _thShell_(preheader, innerRows) {
  var pre = preheader ? ('<tr><td align="center" style="padding:6px 20px 16px;font-family:' + TH_BODY + ';font-size:12px;color:#A9956A;letter-spacing:.4px">' + preheader + '</td></tr>') : '';
  return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#EDE4D3"><tr><td align="center" style="padding:30px 12px">' +
    '<table width="640" cellpadding="0" cellspacing="0" role="presentation" style="width:640px;max-width:100%">' + pre +
    '<tr><td><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:24px;overflow:hidden;box-shadow:0 40px 90px -36px rgba(42,33,21,.45)">' +
    innerRows + '</table></td></tr></table></td></tr></table>';
}

// Email PROFESIONAL & branded (Top Hills) — invoice / kwitansi / reminder.
function _custDocHtml_(b, mode) {
  var isKost = _custIsKost_(b), pay = _custBayar_(b), rek = _custRekening_(isKost), kontak = _custKontak_();
  var nama = _thFirstName_(b), nomorKamar = String(b.Nama_Kamar || '-');
  var isLunas = (mode === 'kwitansi') || pay.lunas;
  var noDoc = String(b.BookingID || '');
  var periodeText = isKost ? (b.Paket || b.Durasi || 'Paket sewa')
    : ((b.CheckIn ? _custTglID_(b.CheckIn) : '') + (b.CheckOut ? (' – ' + _custTglID_(b.CheckOut)) : ''));
  var roomTitle = isKost ? ('Kost Putri — Kamar ' + nomorKamar + (_custHasAc_(b) ? ' · AC' : ''))
    : ('Penginapan' + (b.Tipe_Kamar ? (' · ' + b.Tipe_Kamar) : ''));
  var subParts = [];
  if (b.Nama_Customer) subParts.push(String(b.Nama_Customer));
  if (b.Gedung) subParts.push(String(b.Gedung));
  if (periodeText) subParts.push(periodeText);
  var roomSub = subParts.join(' · ');
  var pills = (!isKost && _custHasAc_(b)) ? ['AC'] : null;
  var tglTerima = b.Tgl_Pembayaran ? _custTglID_(b.Tgl_Pembayaran) : _custTglID_(new Date());

  // Rincian + hero box beda per mode.
  var rowsArr, totalArr, heroBox;
  if (isLunas) {
    rowsArr = [
      [isKost ? 'Paket sewa' : ('Sewa kamar' + (b.Durasi ? (' · ' + b.Durasi) : '')), periodeText || '-'],
      ['Metode pembayaran', 'Transfer ' + rek.bank],
      ['Tanggal diterima', tglTerima]
    ];
    totalArr = ['Total Diterima', _custRp_(pay.total), '#5C7A4C'];
    heroBox = { label: 'NO. KWITANSI', value: _thKwitansiNo_(b, isKost), vc: '#9FBE8B', lc: '#8FAE7C' };
  } else {
    rowsArr = [
      ['Total', _custRp_(pay.total)],
      ['Sudah dibayar' + (pay.dibayar > 0 ? ' (DP)' : ''), _custRp_(pay.dibayar), '#5C7A4C']
    ];
    if (pay.refund > 0) rowsArr.push(['Refund', '- ' + _custRp_(pay.refund), '#C0392B']);
    totalArr = ['Sisa Tagihan', _custRp_(pay.sisa), '#B0632F'];
    heroBox = { label: 'SISA TAGIHAN', value: _custRp_(pay.sisa), vc: '#F0C89A', lc: '#D8A97A', hint: 'Kamar ' + nomorKamar + (noDoc ? (' · ' + noDoc) : '') };
  }

  var pill = isLunas ? 'PEMBAYARAN DITERIMA' : (mode === 'reminder' ? 'REMINDER PELUNASAN' : 'INVOICE / TAGIHAN');
  var headline = isLunas ? ('Lunas! Makasih ya, ' + nama + '.')
    : (mode === 'reminder' ? ('Pengingat dari kami, ' + nama + '.') : ('Ini rincian tagihanmu, ' + nama + '.'));
  var sub = isLunas ? 'Pembayaranmu sudah kami terima dan tercatat penuh. Email ini berlaku sebagai bukti pembayaran (kwitansi) kamu.'
    : (mode === 'reminder' ? 'Sekadar mengingatkan dengan santai — masih ada sisa pembayaran booking kamu. Berikut rinciannya.'
      : 'Terima kasih sudah booking di Top Hills. Berikut rincian & sisa yang perlu dilunasi.');

  var waUrl = _thWaUrl_(kontak.helpdesk, 'Halo Top Hills 🌸, saya ' + String(b.Nama_Customer || '') + (noDoc ? (' (kode ' + noDoc + ')') : '') + '. ' + (isLunas ? 'Mau konfirmasi soal kwitansi/pembayaran.' : 'Saya mau kirim bukti transfer pelunasan.'));

  var body = _thDivider_(isLunas ? 'RINCIAN PEMBAYARAN' : 'RINCIAN') +
    _thRoomCard_(nomorKamar, roomTitle, roomSub, pills, isLunas) +
    _thRows_(rowsArr, totalArr);
  if (isLunas) {
    body += _thNote_('🌸', isKost ? 'Selamat menempati kamar barumu! Jangan lupa gabung grup WA penghuni ya — semua info & pengumuman ada di sana.'
      : 'Semoga nyaman menginap di Top Hills. Kalau butuh apa-apa selama menginap, Bang Mezi & Helpdesk siap bantu ya.', 'green') +
      _thCta_('Konfirmasi via WA', 'Ada yang tidak sesuai? Balas email ini atau WA kami, langsung kami cek.', waUrl);
  } else {
    body += _thDivider_('CARA BAYAR') +
      _thSteps_([
        ['Transfer ke rekening Top Hills', rek.bank + ' ' + rek.no + ' a.n ' + rek.atasNama + ' — nominal ' + _custRp_(pay.sisa) + '.'],
        ['Kirim bukti transfer via WA', 'Ke Helpdesk ' + kontak.helpdesk + (noDoc ? (' dengan kode ' + noDoc) : '') + '.']
      ]);
    if (mode === 'reminder') body += _thNote_('🌿', 'Sudah terlanjur bayar? Abaikan email ini — atau kabari kami via WA biar langsung kami catat.', 'green');
    if (!isKost) body += _thNote_('⏰', 'Check-in mulai <b>13.00 WIB</b> · Check-out maksimal <b>12.00 WIB</b>.');
    body += _thCta_('Kirim Bukti Transfer via WA', 'Ada yang tidak sesuai? Balas email ini atau WA kami.', waUrl);
  }

  var pre = isLunas ? 'Pembayaran kamu sudah kami terima — lunas ✓'
    : (mode === 'reminder' ? 'Pengingat lembut — masih ada sisa pembayaran ya 🌿'
      : ('Rincian tagihan booking kamu' + (nomorKamar !== '-' ? (' — kamar ' + nomorKamar) : '')));
  var tagline = (isLunas && isKost) ? 'Selamat menempati rumah barumu, ya.' : 'Sampai ketemu di Top Hills, ya.';
  var meta = (mode === 'kwitansi' ? 'Kwitansi pelunasan' : (mode === 'reminder' ? 'Reminder pelunasan' : 'Invoice')) + (noDoc ? (' · ' + noDoc) : '');

  return _thShell_(pre,
    _thHero_({ pill: pill, pillColor: isLunas ? '#9FBE8B' : '#DDBE7F', pillBorder: isLunas ? 'rgba(122,159,101,.55)' : 'rgba(201,168,106,.55)', headline: headline, sub: sub, box: heroBox, icon: isLunas ? '✓' : null }) +
    _thBodyWrap_(body) +
    _thFooter_(tagline, meta));
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
