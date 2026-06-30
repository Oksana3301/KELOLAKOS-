/**
 * BACKEND_RUMAH_CLUSTER1.gs — Top Hills · Penghuni Layer (Cluster 1)
 * ------------------------------------------------------------------
 * Login WA (OTP) + JWT, profil penghuni, loyalty tier, referral, Fonnte.
 *
 * CARA PASANG:
 * 1) Paste file ini ke Apps Script project yang sama dengan backend kamu.
 * 2) Set Script Properties (Project Settings → Script properties):
 *      FONNTE_TOKEN = RGFCuAhsJpQqEmrxmeyS
 *      FONNTE_DEVICE = 628116646615           (opsional, info saja)
 *      JWT_SECRET   = <random 32+ char, SAMA dengan env Next>
 *      MEZI_WA      = 628xxxxxxxxx             (nomor Bang Mezi; fallback ke Setting)
 * 3) Jalankan sekali: ensureRumahSetup()  → bikin kolom + sheet LoginCodes.
 * 4) Di dispatcher utama (dispatch_/dispatchV2_), TANPA accessCode (publik),
 *    route 4 action ini ke rumahHandle_(action, data):
 *      'requestLoginCode','verifyLoginCode','getMyProfile','updateMyProfile'
 *    contoh:
 *      var rumah = rumahHandle_(action, data);
 *      if (rumah !== null) return rumah;   // { ok:true, data:{...} } / { ok:false,... }
 * 5) Deploy → Manage deployments → Edit → New version.
 */

var RUMAH_CFG = {
  bookingSheet: 'Booking',
  codesSheet: 'LoginCodes',
  loyaltySheet: 'Loyalty_Log',
  settingSheet: 'Setting',
  codeTtlMin: 10,
  jwtDays: 30,
  // Kolom Booking yang dipakai (header, case-insensitive cocokkan longgar).
  col: {
    nama: ['Nama_Customer', 'Nama', 'nama'],
    wa: ['WhatsApp', 'wa', 'No_HP', 'Nomor'],
    checkIn: ['CheckIn', 'Check_In', 'Tanggal_Masuk', 'tgl_mulai'],
    kamar: ['Nama_Kamar', 'Kamar'],
    gedung: ['Gedung'],
    statusBayar: ['Status_Bayar', 'Status_Booking', 'Status'],
    bookingId: ['BookingID', 'ID'],
  },
};

// Status yang dianggap "penghuni aktif".
var RUMAH_ACTIVE = ['DP_CONFIRMED', 'LUNAS', 'CHECKED_IN', 'DP', 'AKTIF', 'ACTIVE'];

/** ========================= DISPATCH ENTRY ========================= */
function rumahHandle_(action, data) {
  try {
    if (action === 'requestLoginCode') return ok_(requestLoginCode_(data || {}));
    if (action === 'verifyLoginCode') return ok_(verifyLoginCode_(data || {}));
    if (action === 'getMyProfile') return ok_(getMyProfile_(data || {}));
    if (action === 'updateMyProfile') return ok_(updateMyProfile_(data || {}));
    return null; // bukan action /rumah → biar dispatcher lain menangani
  } catch (err) {
    return { ok: false, error: 'RUMAH_ERR', message: String(err && err.message || err) };
  }
}
function ok_(obj) { return { ok: true, data: obj }; }

/** ========================= SETUP ========================= */
function ensureRumahSetup() {
  ensureRumahColumns_();
  ensureLoginCodesSheet_();
  return 'OK';
}

function ensureRumahColumns_() {
  var sh = _sheet_(RUMAH_CFG.bookingSheet);
  var headers = _headers_(sh);
  var need = ['loyalty_tier', 'tenure_months', 'referral_code', 'referred_by',
              'tanggal_lahir', 'email', 'fakultas', 'kampung_asal', 'profile_complete'];
  var added = false;
  need.forEach(function (h) {
    if (headers.map(_lc_).indexOf(_lc_(h)) === -1) { headers.push(h); added = true; }
  });
  if (added) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function ensureLoginCodesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RUMAH_CFG.codesSheet);
  if (!sh) {
    sh = ss.insertSheet(RUMAH_CFG.codesSheet);
    sh.getRange(1, 1, 1, 5).setValues([['wa_number', 'code', 'generated_at', 'expires_at', 'used']]);
  }
  return sh;
}

/** ========================= HANDLERS ========================= */

// POST requestLoginCode { waNumber }
function requestLoginCode_(data) {
  var wa = _normWa_(data.waNumber);
  if (!wa) return { success: false, error: 'Nomor WA belum benar.' };
  var row = _findActiveBookingByWa_(wa);
  if (!row) return { success: false, error: 'Nomor tidak terdaftar sebagai penghuni aktif.' };

  cleanupLoginCodes_();
  var code = ('' + Math.floor(100000 + Math.random() * 900000));
  var now = new Date();
  var exp = new Date(now.getTime() + RUMAH_CFG.codeTtlMin * 60000);
  var sh = ensureLoginCodesSheet_();
  sh.appendRow([wa, code, now, exp, false]);

  sendWA_(wa, 'Kode login Top Hills: ' + code + '. Berlaku ' + RUMAH_CFG.codeTtlMin + ' menit.');
  return { success: true };
}

// POST verifyLoginCode { waNumber, code }
function verifyLoginCode_(data) {
  var wa = _normWa_(data.waNumber);
  var code = ('' + (data.code || '')).replace(/[^0-9]/g, '');
  if (!wa || code.length !== 6) return { success: false, error: 'Kode harus 6 digit.' };

  var sh = ensureLoginCodesSheet_();
  var values = sh.getDataRange().getValues();
  var now = new Date();
  var matchedRow = -1;
  for (var i = values.length - 1; i >= 1; i--) {
    var r = values[i];
    if (_normWa_(r[0]) === wa && ('' + r[1]) === code && r[4] !== true) {
      var exp = new Date(r[3]);
      if (now <= exp) { matchedRow = i + 1; break; }
    }
  }
  if (matchedRow === -1) return { success: false, error: 'Kode salah atau sudah kedaluwarsa.' };
  sh.getRange(matchedRow, 5).setValue(true); // used

  var profile = getProfileByWa_(wa);
  if (!profile) return { success: false, error: 'Data penghuni tidak ditemukan.' };

  var token = jwtSign_({ waNumber: wa, tenant_id: profile.tenant_id, name: profile.name, tier: profile.tier });
  return { success: true, token: token, profile: profile };
}

// GET getMyProfile { token }
function getMyProfile_(data) {
  var p = _auth_(data);
  if (!p) return { error: 'UNAUTHORIZED' };
  var profile = getProfileByWa_(p.waNumber);
  if (!profile) return { error: 'NOT_FOUND' };
  return { profile: profile };
}

// POST updateMyProfile { token, tanggal_lahir?, email?, fakultas?, kampung_asal? }
function updateMyProfile_(data) {
  var p = _auth_(data);
  if (!p) return { success: false, error: 'UNAUTHORIZED' };

  var sh = _sheet_(RUMAH_CFG.bookingSheet);
  var loc = _rowByWa_(sh, p.waNumber);
  if (!loc) return { success: false, error: 'Data penghuni tidak ditemukan.' };

  var wasComplete = _truthy_(loc.obj['profile_complete']);
  ['tanggal_lahir', 'email', 'fakultas', 'kampung_asal'].forEach(function (f) {
    if (data[f] !== undefined) _setCell_(sh, loc, f, String(data[f] || '').trim());
  });

  // Re-compute profile_complete (≥3 dari 4 optional terisi).
  var filled = ['tanggal_lahir', 'email', 'fakultas', 'kampung_asal'].filter(function (f) {
    var v = (data[f] !== undefined) ? data[f] : loc.obj[f];
    return String(v || '').trim() !== '';
  }).length;
  var nowComplete = filled >= 3;
  _setCell_(sh, loc, 'profile_complete', nowComplete);

  // Gift welcome PERTAMA kali profile_complete jadi true.
  if (nowComplete && !wasComplete) {
    _logLoyalty_('GIFT_WELCOME_PROFILE_COMPLETE', p.waNumber, loc.obj[_pick_(RUMAH_CFG.col.nama, loc) ] || p.name);
    var mezi = _meziWa_();
    if (mezi) sendWA_(mezi, 'Penghuni ' + (p.name || '-') + ' lengkapi profil — siapkan welcome surprise 🎁');
  }
  return { success: true };
}

/** ========================= PROFILE / BOOKING ========================= */
function getProfileByWa_(wa) {
  var sh = _sheet_(RUMAH_CFG.bookingSheet);
  var loc = _rowByWa_(sh, wa);
  if (!loc) return null;
  var o = loc.obj;
  var nama = _val_(o, RUMAH_CFG.col.nama);
  var checkIn = _val_(o, RUMAH_CFG.col.checkIn);
  var months = tenureMonths_(checkIn);
  var tier = computeTier_(months);

  // Auto-isi kolom turunan bila kosong (idempotent).
  if (_lc_('' + (o['loyalty_tier'] || '')) !== _lc_(tier)) _setCell_(sh, loc, 'loyalty_tier', tier);
  if (('' + (o['tenure_months'] || '')) !== ('' + months)) _setCell_(sh, loc, 'tenure_months', months);
  if (!String(o['referral_code'] || '').trim()) {
    var rc = genReferral_(nama);
    _setCell_(sh, loc, 'referral_code', rc); o['referral_code'] = rc;
  }

  return {
    waNumber: wa,
    tenant_id: String(_val_(o, RUMAH_CFG.col.bookingId) || wa),
    name: String(nama || ''),
    tier: tier,
    check_in: _iso_(checkIn),
    tenure_months: months,
    kamar: String(_val_(o, RUMAH_CFG.col.kamar) || ''),
    gedung: String(_val_(o, RUMAH_CFG.col.gedung) || ''),
    status_bayar: String(_val_(o, RUMAH_CFG.col.statusBayar) || ''),
    referral_code: String(o['referral_code'] || ''),
    referred_by: String(o['referred_by'] || ''),
    tanggal_lahir: String(o['tanggal_lahir'] || ''),
    email: String(o['email'] || ''),
    fakultas: String(o['fakultas'] || ''),
    kampung_asal: String(o['kampung_asal'] || ''),
    profile_complete: _truthy_(o['profile_complete'])
  };
}

function _findActiveBookingByWa_(wa) {
  var sh = _sheet_(RUMAH_CFG.bookingSheet);
  var loc = _rowByWa_(sh, wa);
  if (!loc) return null;
  var st = _lc_('' + (_val_(loc.obj, RUMAH_CFG.col.statusBayar) || ''));
  var active = RUMAH_ACTIVE.some(function (s) { return st.indexOf(_lc_(s)) !== -1; });
  return active ? loc : null;
}

function computeTier_(months) {
  if (months >= 24) return 'RUMAH';
  if (months >= 12) return 'KELUARGA';
  if (months >= 3) return 'SAHABAT';
  return 'TETANGGA';
}
function tenureMonths_(checkIn) {
  var d = _toDate_(checkIn); if (!d) return 0;
  var now = new Date();
  var m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  var anchor = new Date(d); anchor.setMonth(d.getMonth() + m);
  if (anchor > now) m -= 1;
  return Math.max(0, m);
}
function genReferral_(nama) {
  var short = String(nama || 'TH').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'TH';
  var n = ('' + Math.floor(100 + Math.random() * 900));
  return 'TH-' + short + '-' + n;
}

/** ========================= JWT (HS256) ========================= */
function jwtSign_(payload) {
  var secret = _prop_('JWT_SECRET');
  var header = { alg: 'HS256', typ: 'JWT' };
  var now = Math.floor(Date.now() / 1000);
  payload.iat = now; payload.exp = now + RUMAH_CFG.jwtDays * 86400;
  var p1 = _b64url_(JSON.stringify(header));
  var p2 = _b64url_(JSON.stringify(payload));
  var sig = _b64urlBytes_(Utilities.computeHmacSha256Signature(p1 + '.' + p2, secret));
  return p1 + '.' + p2 + '.' + sig;
}
function jwtVerify_(token) {
  var secret = _prop_('JWT_SECRET');
  var parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  var sig = _b64urlBytes_(Utilities.computeHmacSha256Signature(parts[0] + '.' + parts[1], secret));
  if (sig !== parts[2]) return null;
  var payload;
  try { payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString()); }
  catch (e) { return null; }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}
function _auth_(data) {
  var token = data && (data.token || data.jwt || data.authorization);
  if (token && /^Bearer\s+/i.test(token)) token = token.replace(/^Bearer\s+/i, '');
  return token ? jwtVerify_(token) : null;
}
function _b64url_(s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); }
function _b64urlBytes_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }

/** ========================= FONNTE ========================= */
function sendWA_(targetNumber, message) {
  var token = _prop_('FONNTE_TOKEN');
  if (!token) return;
  try {
    UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { 'Authorization': token },
      payload: { target: String(targetNumber), message: message },
      muteHttpExceptions: true
    });
  } catch (e) { /* jangan gagalkan flow login bila WA error */ }
}
// Versi public sesuai spec.
function sendWA(targetNumber, message) { return sendWA_(targetNumber, message); }

/** ========================= LOGIN CODES CLEANUP ========================= */
function cleanupLoginCodes_() {
  var sh = ensureLoginCodesSheet_();
  var values = sh.getDataRange().getValues();
  var cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  for (var i = values.length - 1; i >= 1; i--) {
    var gen = new Date(values[i][2]);
    if (!gen || isNaN(gen.getTime()) || gen < cutoff) sh.deleteRow(i + 1);
  }
}

/** ========================= LOYALTY LOG ========================= */
function _logLoyalty_(eventType, wa, nama) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RUMAH_CFG.loyaltySheet);
  if (!sh) { sh = ss.insertSheet(RUMAH_CFG.loyaltySheet); sh.getRange(1, 1, 1, 4).setValues([['timestamp', 'event_type', 'wa_number', 'nama']]); }
  sh.appendRow([new Date(), eventType, wa, nama || '']);
}

/** ========================= SHEET HELPERS ========================= */
function _sheet_(name) { var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); if (!sh) throw new Error('Sheet "' + name + '" tidak ada'); return sh; }
function _headers_(sh) { return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h); }); }
function _lc_(s) { return String(s || '').trim().toLowerCase(); }
function _truthy_(v) { var s = _lc_(v); return v === true || s === 'true' || s === 'ya' || s === '1' || s === 'yes'; }

// Cari baris (terbaru) berdasar nomor WA. Return {rowIndex, obj, headers}.
function _rowByWa_(sh, wa) {
  var headers = _headers_(sh);
  var values = sh.getDataRange().getValues();
  var waCols = RUMAH_CFG.col.wa.map(_lc_);
  var hLc = headers.map(_lc_);
  for (var i = values.length - 1; i >= 1; i--) {
    for (var c = 0; c < hLc.length; c++) {
      if (waCols.indexOf(hLc[c]) !== -1 && _normWa_(values[i][c]) === wa) {
        var obj = {}; for (var k = 0; k < headers.length; k++) obj[headers[k]] = values[i][k];
        return { rowIndex: i + 1, obj: obj, headers: headers };
      }
    }
  }
  return null;
}
function _colIndex_(headers, names) {
  var hLc = headers.map(_lc_);
  for (var i = 0; i < names.length; i++) { var idx = hLc.indexOf(_lc_(names[i])); if (idx !== -1) return idx; }
  return -1;
}
function _val_(obj, names) { for (var i = 0; i < names.length; i++) { for (var k in obj) { if (_lc_(k) === _lc_(names[i])) return obj[k]; } } return ''; }
function _pick_(names, loc) { for (var i = 0; i < names.length; i++) { for (var k in loc.obj) { if (_lc_(k) === _lc_(names[i])) return k; } } return names[0]; }
function _setCell_(sh, loc, header, value) {
  var idx = _colIndex_(loc.headers, [header]);
  if (idx === -1) { ensureRumahColumns_(); loc.headers = _headers_(sh); idx = _colIndex_(loc.headers, [header]); }
  if (idx !== -1) { sh.getRange(loc.rowIndex, idx + 1).setValue(value); loc.obj[loc.headers[idx]] = value; }
}

/** ========================= MISC ========================= */
function _prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function _normWa_(raw) {
  var p = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
  if (!p) return '';
  if (p.indexOf('620') === 0) p = '62' + p.slice(3);
  else if (p.charAt(0) === '0') p = '62' + p.slice(1);
  else if (p.charAt(0) === '8') p = '62' + p;
  return p;
}
function _toDate_(v) { if (!v) return null; if (v instanceof Date) return isNaN(v.getTime()) ? null : v; var d = new Date(v); return isNaN(d.getTime()) ? null : d; }
function _iso_(v) { var d = _toDate_(v); return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''; }
function _meziWa_() {
  var p = _prop_('MEZI_WA'); if (p) return _normWa_(p);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RUMAH_CFG.settingSheet);
    if (sh) {
      var v = sh.getDataRange().getValues();
      for (var i = 0; i < v.length; i++) { if (/mezi/i.test('' + v[i][0])) return _normWa_(v[i][1]); }
    }
  } catch (e) {}
  return '';
}
