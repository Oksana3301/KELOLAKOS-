/*******************************************************************
 * BACKEND_PATCH_KIRIM_KE_CUSTOMER_MANUAL.gs — Top Hills
 * =================================================================
 * Kirim Email (branded _custDocHtml_ / _bookingConfirmHtml_) + WA
 * (_fonnteCustomerText_) ke customer SECARA MANUAL — dipanggil dari tombol
 * "Kirim ke Customer" di dashboard owner/penjaga.
 *
 * KENAPA MANUAL: booking dari dashboard di-input owner; takut salah input lalu
 * kesimpen → jangan auto-kirim. Owner review dulu, baru klik kirim.
 *
 * TRACKING (biar ketahuan sistem sehat / Gmail-Fonnte error): tiap kirim
 * dicatat ke kolom flag di sheet Booking (dibuat OTOMATIS kalau belum ada):
 *   • Notif_Email_At    — kapan email terakhir dikirim (d MMM yyyy HH:mm)
 *   • Notif_Email_Info  — "<tipe> · OK → email"  atau  "<tipe> · GAGAL: <alasan>"
 *   • Notif_WA_At       — kapan WA terakhir dikirim
 *   • Notif_WA_Info     — "<tipe> · OK → 62xx"   atau  "<tipe> · GAGAL: <alasan>"
 * tipe = invoice | kwitansi | reminder | received.
 *
 * ANTI-SPAM: kalau sudah pernah dikirim (flag ada) & tidak `force` → DITOLAK,
 * minta konfirmasi (frontend munculkan "kirim ulang?"). force=true → kirim ulang.
 *
 * TOGGLE (default MANUAL): Pengaturan key `notif_customer_mode` = manual | auto.
 * File ini fungsi MANUAL saja (selalu kirim saat dipanggil). `_notifMode_()`
 * disediakan untuk fitur AUTO nanti — belum dipakai di sini.
 *
 * STANDALONE: reuse helper dari BACKEND_PATCH_CUSTOMER_EMAIL.gs, FONNTE_WA.gs,
 * EMAIL_BOOKING_CONFIRM.gs. TIDAK menyentuh kode penulis data booking.
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │ TEST SEKARANG (tanpa frontend): edit `diagKirimManual` → ganti  │
 * │   bookingId ke booking REAL → Run → cek Logs + HP/inbox.       │
 * │ WIRING (nanti pas tombol frontend dibuat) — di apiv2.gs         │
 * │   dispatchV2_ tambah 2 case:                                    │
 * │     case 'kirimKeCustomerManual': return kirimKeCustomerManual(payload);
 * │     case 'getNotifStatus':        return { ok:true, data:getNotifStatus(payload) };
 * └───────────────────────────────────────────────────────────────┘
 *******************************************************************/

// Mode notif dari Pengaturan (buat AUTO nanti). Default 'manual'.
function _notifMode_() {
  try {
    var s = (typeof _custSettings_ === 'function') ? _custSettings_() : {};
    var m = String((s && s.notif_customer_mode) || '').trim().toLowerCase();
    return (m === 'auto') ? 'auto' : 'manual';
  } catch (e) { return 'manual'; }
}

// Tentukan tipe dokumen: param kind, else auto (lunas→kwitansi, else invoice).
function _kkMode_(b, kindParam) {
  var kind = String(kindParam || '').toLowerCase();
  if (kind === 'invoice' || kind === 'kwitansi' || kind === 'reminder' || kind === 'received') return kind;
  var pay = (typeof _custBayar_ === 'function') ? _custBayar_(b) : { lunas: false };
  return pay.lunas ? 'kwitansi' : 'invoice';
}
function _kkTs_() {
  var tz = (typeof _custTz_ === 'function') ? _custTz_() : 'GMT+7';
  return Utilities.formatDate(new Date(), tz, 'd MMM yyyy HH:mm');
}
// HTML email branded per tipe (received = booking-confirm; sisanya = doc).
function _kkEmailHtml_(b, mode) {
  if (mode === 'received' && typeof _bookingConfirmHtml_ === 'function') return _bookingConfirmHtml_(b);
  return (typeof _custDocHtml_ === 'function') ? _custDocHtml_(b, mode) : '';
}
function _kkEmailSubject_(b, mode) {
  if (mode === 'received' && typeof _bookingConfirmSubject_ === 'function') return _bookingConfirmSubject_(b);
  if (typeof _custSubject_ === 'function') return _custSubject_(b, mode);
  return 'Top Hills — ' + String(b.Nama_Customer || '');
}
// Set kolom flag (buat kolom kalau belum ada) — reuse _custSetCol_ dari file email.
function _kkSet_(id, col, val) {
  try { if (typeof _custSetCol_ === 'function') return _custSetCol_(id, col, val); } catch (e) { Logger.log('_kkSet_ gagal (' + col + '): ' + e); }
}

// ============ INTI: kirim Email + WA manual ke 1 booking, catat flag ============
function kirimKeCustomerManual(data) {
  data = data || {};
  var id = String(data.bookingId || data.booking_id || '').trim();
  if (!id) return { ok: false, error: 'bookingId wajib' };
  var b = (typeof _custFindById_ === 'function') ? _custFindById_(id) : null;
  if (!b) return { ok: false, error: 'booking tak ditemukan: ' + id };

  var force = (data.force === true || data.force === 'true');
  var mode = _kkMode_(b, data.kind);

  // Anti-spam: sudah pernah kirim & tidak force → minta konfirmasi.
  var emailAt = String(b.Notif_Email_At || '').trim();
  var waAt = String(b.Notif_WA_At || '').trim();
  if (!force && (emailAt || waAt)) {
    return {
      ok: false, alreadySent: true, mode: mode,
      email: { at: emailAt, info: String(b.Notif_Email_Info || '') },
      wa: { at: waAt, info: String(b.Notif_WA_Info || '') },
      message: 'Booking ini sudah pernah dikirimi notifikasi. Kirim ulang? (force=true)'
    };
  }

  var out = { ok: false, mode: mode, email: { sent: false }, wa: { sent: false } };
  var ts = _kkTs_();

  // ---- EMAIL (branded) ----
  var email = String(b.Email || data.email || '').trim();
  if (email && email.indexOf('@') >= 0) {
    try {
      MailApp.sendEmail({ to: email, subject: _kkEmailSubject_(b, mode), htmlBody: _kkEmailHtml_(b, mode) });
      out.email = { sent: true, tipe: mode, status: 'OK', at: ts, to: email };
      _kkSet_(id, 'Notif_Email_At', ts);
      _kkSet_(id, 'Notif_Email_Info', mode + ' · OK -> ' + email);
    } catch (e) {
      out.email = { sent: false, tipe: mode, status: 'GAGAL', err: String(e), at: ts };
      _kkSet_(id, 'Notif_Email_At', ts);
      _kkSet_(id, 'Notif_Email_Info', mode + ' · GAGAL: ' + String(e));
    }
  } else {
    out.email = { sent: false, status: 'SKIP', reason: 'customer tidak isi email' };
  }

  // ---- WA (Fonnte) ----
  var wa = String(b.WhatsApp || '').trim();
  if (wa && typeof _fonnteSend_ === 'function' && typeof _fonnteCustomerText_ === 'function') {
    try {
      var r = _fonnteSend_(wa, _fonnteCustomerText_(b, mode));
      var okWa = !!(r && r.ok);
      out.wa = { sent: okWa, tipe: mode, status: okWa ? 'OK' : 'GAGAL', at: ts, to: wa, body: (r && r.body) || '' };
      _kkSet_(id, 'Notif_WA_At', ts);
      _kkSet_(id, 'Notif_WA_Info', mode + (okWa ? ' · OK -> ' : ' · GAGAL -> ') + wa);
    } catch (e) {
      out.wa = { sent: false, tipe: mode, status: 'GAGAL', err: String(e), at: ts };
      _kkSet_(id, 'Notif_WA_At', ts);
      _kkSet_(id, 'Notif_WA_Info', mode + ' · GAGAL: ' + String(e));
    }
  } else {
    out.wa = { sent: false, status: 'SKIP', reason: 'customer tidak isi WA / Fonnte belum terpasang' };
  }

  out.ok = (out.email.sent || out.wa.sent);
  Logger.log('kirimKeCustomerManual ' + id + ' [' + mode + '] → email:' + out.email.status + ' wa:' + out.wa.status);
  return out;
}

// Baca status notif 1 booking (buat frontend nampilin badge "sudah dikirim").
function getNotifStatus(data) {
  data = data || {};
  var id = String(data.bookingId || data.booking_id || '').trim();
  var b = (typeof _custFindById_ === 'function') ? _custFindById_(id) : null;
  if (!b) return { ok: false, error: 'booking tak ditemukan' };
  return {
    ok: true, bookingId: id,
    email: { at: String(b.Notif_Email_At || ''), info: String(b.Notif_Email_Info || '') },
    wa: { at: String(b.Notif_WA_At || ''), info: String(b.Notif_WA_Info || '') }
  };
}

// Uji tanpa frontend. GANTI bookingId ke booking REAL, lalu Run.
function diagKirimManual() {
  var r = kirimKeCustomerManual({ bookingId: 'GANTI-BOOKING-ID', force: true });
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
