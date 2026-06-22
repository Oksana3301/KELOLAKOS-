/*****************************************************************
 * KelolaKos Property OS — API V2 EXTENSION
 *
 * Adds new endpoints for:
 *   1. Fasilitas master CRUD (AC, KM Dalam, TV, etc + price adjustment)
 *   2. Room-Facility assignment (which kamar has which fasilitas)
 *   3. Building Layout config (floors, rooms per side per floor)
 *   4. Booking extra request field + isEkstra flag
 *   5. Kwitansi settings (logo image base64, color, font, layout)
 *   6. Halaman Info (konten + foto/video halaman publik /info)
 *   7. Kamar Publik (ketersediaan kamar untuk /info — Tahap 2)
 *
 * INSTALL:
 *   Drop this file alongside existing Api.gs, TopHillsLogic.gs, etc.
 *
 * CATATAN: jangan lupa di Api.gs, tambahkan ke WHITELIST_ACTIONS:
 *   'getHalamanInfo': true,
 *   'getPublicRooms': true,
 *****************************************************************/

// ======================================================
// SHEET NAMES & SCHEMAS
// ======================================================
const V2_SHEETS = {
  FASILITAS: 'Fasilitas',
  ROOM_FAC: 'RoomFacilities',
  LAYOUT: 'BuildingLayout',
  KWITANSI: 'KwitansiSettings'
};

const V2_SCHEMAS = {
    Fasilitas: ['id', 'kode', 'nama', 'emoji', 'price_adjust', 'is_active', 'description', 'updated_at', 'satuan'],
  RoomFacilities: ['id', 'kamar_id', 'fasilitas_id', 'created_at'],
  BuildingLayout: ['id', 'gedung_kode', 'floor', 'side', 'col_index', 'room_id', 'facing_arah', 'updated_at'],
  KwitansiSettings: ['key', 'value', 'updated_at']
};

// Default facilities seed data
const V2_DEFAULT_FASILITAS = [
  { kode: 'AC',   nama: 'AC (Air Conditioner)', emoji: '❄️', price_adjust: 200000, description: 'Pendingin ruangan' },
  { kode: 'KM',   nama: 'Kamar Mandi Dalam',    emoji: '🚿', price_adjust: 150000, description: 'KM pribadi dalam kamar' },
  { kode: 'TV',   nama: 'TV LED',                emoji: '📺', price_adjust: 100000, description: 'TV 32" dengan channel kabel' },
  { kode: 'LMR',  nama: 'Lemari Pakaian',       emoji: '🗄️', price_adjust: 0,      description: 'Lemari standar tiap kamar (termasuk)' },
  { kode: 'WIFI', nama: 'WiFi Premium',         emoji: '📶', price_adjust: 50000,  description: 'Internet kencang 200 Mbps' },
  { kode: 'BLK',  nama: 'Balkon Pribadi',       emoji: '🪟', price_adjust: 200000, description: 'Balkon view luar' },
  { kode: 'DPR',  nama: 'Akses Dapur Bersama',  emoji: '🍳', price_adjust: 0,      description: 'Dapur shared di lantai (gratis)' }
];

// ======================================================
// UTILITY HELPERS (V2)
// ======================================================
function v2_getOrCreateSheet_(sheetName, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F5F5F4');
    sh.setFrozenRows(1);
  }
  return sh;
}

function v2_sheetToObjects_(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(o => o.id || o.kode || o.key); // filter out empty rows
}

function v2_findRowById_(sh, id) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1; // 1-indexed row
  }
  return -1;
}

function v2_generateId_(prefix) {
  return prefix + '_' + Utilities.getUuid().substring(0, 8);
}

function v2_now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// ======================================================
// SEEDING (auto-run on first Fasilitas call)
// ======================================================
function v2_ensureSeeded_() {
  const sh = v2_getOrCreateSheet_(V2_SHEETS.FASILITAS, V2_SCHEMAS.Fasilitas);
  const existing = v2_sheetToObjects_(sh);
  if (existing.length === 0) {
    V2_DEFAULT_FASILITAS.forEach(f => {
      sh.appendRow([
        v2_generateId_('fac'),
        f.kode,
        f.nama,
        f.emoji,
        f.price_adjust,
        true,
        f.description,
        v2_now_()
      ]);
    });
  }
}

// ======================================================
// FASILITAS CRUD
// ======================================================
function v2_getFasilitas() {
  v2_ensureSeeded_();
  const sh = v2_getOrCreateSheet_(V2_SHEETS.FASILITAS, V2_SCHEMAS.Fasilitas);
  return v2_sheetToObjects_(sh).filter(f => f.is_active !== false && f.is_active !== 'false');
}

function v2_saveFasilitas(payload) {
  const sh = v2_getOrCreateSheet_(V2_SHEETS.FASILITAS, V2_SCHEMAS.Fasilitas);
  v2_ensureFasilitasSatuanColumn_(sh); // pastikan kolom 'satuan' ada di sheet lama

  const id = payload.id || v2_generateId_('fac');
  const satuan = (payload.satuan === 'per_hari' || payload.satuan === 'per_tahun')
    ? payload.satuan
    : 'per_bulan';

  // Header-aware: tulis sesuai posisi kolom asli di sheet (aman walau urutannya beda).
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const rowObj = {
    id: id,
    kode: payload.kode || '',
    nama: payload.nama || '',
    emoji: payload.emoji || '',
    price_adjust: Number(payload.price_adjust) || 0,
    is_active: payload.is_active !== false,
    description: payload.description || '',
    updated_at: v2_now_(),
    satuan: satuan
  };
  const row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(rowObj, h) ? rowObj[h] : '';
  });

  const existingRow = v2_findRowById_(sh, id);
  if (existingRow > 0) {
    sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return { ok: true, id: id, fasilitas: payload };
}

// Tambah kolom 'satuan' ke sheet Fasilitas lama kalau belum ada.
function v2_ensureFasilitasSatuanColumn_(sh) {
  const headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  if (headers.indexOf('satuan') < 0) {
    sh.getRange(1, headers.length + 1).setValue('satuan');
  }
}

// ======================================================
// ROOM-FACILITY ASSIGNMENT
// ======================================================
function v2_getRoomFacilities(payload) {
  const sh = v2_getOrCreateSheet_(V2_SHEETS.ROOM_FAC, V2_SCHEMAS.RoomFacilities);
  const data = v2_sheetToObjects_(sh);
  const kamarId = payload && payload.kamar_id;
  if (kamarId) {
    // Return facilities assigned to specific kamar (with full facility info)
    const facMap = {};
    v2_getFasilitas().forEach(f => facMap[f.id] = f);
    return data
      .filter(rf => rf.kamar_id === kamarId)
      .map(rf => facMap[rf.fasilitas_id])
      .filter(f => f);
  }
  // Return all room-facility assignments as map: { kamarId: [facId, facId, ...] }
  const result = {};
  data.forEach(rf => {
    if (!result[rf.kamar_id]) result[rf.kamar_id] = [];
    result[rf.kamar_id].push(rf.fasilitas_id);
  });
  return result;
}

function v2_setRoomFacilities(payload) {
  // payload: { kamar_id, fasilitas_ids: [id1, id2, ...] }
  const sh = v2_getOrCreateSheet_(V2_SHEETS.ROOM_FAC, V2_SCHEMAS.RoomFacilities);
  const kamarId = payload.kamar_id;
  const newFacIds = payload.fasilitas_ids || [];
  if (!kamarId) return { ok: false, error: 'kamar_id required' };

  // Clear existing assignments for this kamar
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(kamarId)) sh.deleteRow(i + 1);
  }
  // Add new assignments
  newFacIds.forEach(facId => {
    sh.appendRow([v2_generateId_('rf'), kamarId, facId, v2_now_()]);
  });
  return { ok: true, kamar_id: kamarId, count: newFacIds.length };
}

// ======================================================
// CALCULATE ROOM PRICE WITH FACILITIES
// ======================================================
function v2_calculateRoomPrice(payload) {
  // payload: { base_price, fasilitas_ids: [...] }
  const basePrice = Number(payload.base_price) || 0;
  const facIds = payload.fasilitas_ids || [];
  const allFac = v2_getFasilitas();
  let facTotal = 0;
  const facDetails = [];
  facIds.forEach(id => {
    const f = allFac.find(x => x.id === id);
    if (f) {
      facTotal += Number(f.price_adjust) || 0;
      facDetails.push({ id: f.id, kode: f.kode, nama: f.nama, price_adjust: f.price_adjust });
    }
  });
  return {
    base_price: basePrice,
    facility_total: facTotal,
    total_per_period: basePrice + facTotal,
    facilities: facDetails
  };
}

// ======================================================
// BUILDING LAYOUT CONFIG
// ======================================================
function v2_getBuildingLayout(payload) {
  const sh = v2_getOrCreateSheet_(V2_SHEETS.LAYOUT, V2_SCHEMAS.BuildingLayout);
  const data = v2_sheetToObjects_(sh);
  const gedungKode = payload && payload.gedung_kode;
  if (gedungKode) return data.filter(r => r.gedung_kode === gedungKode);
  return data;
}

function v2_saveBuildingLayout(payload) {
  // payload: { gedung_kode, rooms: [ { floor, side, col_index, room_id, facing_arah }, ... ] }
  const sh = v2_getOrCreateSheet_(V2_SHEETS.LAYOUT, V2_SCHEMAS.BuildingLayout);
  const gedungKode = payload.gedung_kode;
  if (!gedungKode) return { ok: false, error: 'gedung_kode required' };

  // Clear existing layout for this gedung
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(gedungKode)) sh.deleteRow(i + 1);
  }
  // Insert new layout
  (payload.rooms || []).forEach(r => {
    sh.appendRow([
      v2_generateId_('lay'),
      gedungKode,
      Number(r.floor) || 1,
      r.side || 'N',
      Number(r.col_index) || 0,
      r.room_id || '',
      r.facing_arah || r.side || 'N',
      v2_now_()
    ]);
  });
  return { ok: true, gedung_kode: gedungKode, count: (payload.rooms || []).length };
}

// ======================================================
// KWITANSI SETTINGS
// ======================================================
function v2_getKwitansiSettings() {
  const sh = v2_getOrCreateSheet_(V2_SHEETS.KWITANSI, V2_SCHEMAS.KwitansiSettings);
  const data = v2_sheetToObjects_(sh);
  const result = {};
  data.forEach(row => {
    if (row.key) result[row.key] = row.value;
  });
  // Defaults
  return Object.assign({
    business_name: 'KelolaKos',
    tagline: 'Kos & Penginapan',
    logo_mode: 'letter',
    logo_letter: 'K',
    logo_image_base64: '',
    accent_color: '#0C0A09',
    font_style: 'default',
    layout: 'standard',
    show_stamp: true,
    show_tagline: true,
    title_text: 'KWITANSI PEMBAYARAN',
    thankyou_text: 'Terima kasih atas pembayaran Anda',
    sig_name: 'Admin',
    sig_title: 'KelolaKos',
    alamat: '',
    kontak: ''
  }, result);
}

function v2_saveKwitansiSettings(payload) {
  const sh = v2_getOrCreateSheet_(V2_SHEETS.KWITANSI, V2_SCHEMAS.KwitansiSettings);
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'invalid payload' };

  // Clear existing settings
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, V2_SCHEMAS.KwitansiSettings.length).clearContent();

  // Write all settings (logo_image_base64 might be large; that's OK, Sheets supports up to 50K chars per cell)
  Object.keys(payload).forEach(key => {
    let value = payload[key];
    if (typeof value === 'boolean') value = String(value);
    sh.appendRow([key, value, v2_now_()]);
  });
  return { ok: true, count: Object.keys(payload).length };
}

// ======================================================
// BOOKING EXTRA REQUEST (extends existing booking)
// ======================================================
function v2_ensureBookingColumns_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Booking');
  if (!sh) return;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let changed = false;
  if (headers.indexOf('extra_request') < 0) {
    sh.getRange(1, sh.getLastColumn() + 1).setValue('extra_request');
    changed = true;
  }
  if (headers.indexOf('is_ekstra') < 0) {
    sh.getRange(1, sh.getLastColumn() + 1).setValue('is_ekstra');
    changed = true;
  }
  if (changed) {
    SpreadsheetApp.flush();
  }
}

function v2_saveBookingExtra(payload) {
  // payload: { booking_id, extra_request, is_ekstra }
  v2_ensureBookingColumns_();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Booking');
  if (!sh) return { ok: false, error: 'Booking sheet not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const erCol = headers.indexOf('extra_request');
  const ekCol = headers.indexOf('is_ekstra');
  if (idCol < 0) return { ok: false, error: 'id column not found in Booking sheet' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(payload.booking_id)) {
      if (erCol >= 0) sh.getRange(i + 1, erCol + 1).setValue(payload.extra_request || '');
      if (ekCol >= 0) sh.getRange(i + 1, ekCol + 1).setValue(payload.is_ekstra ? true : false);
      return { ok: true, booking_id: payload.booking_id };
    }
  }
  return { ok: false, error: 'Booking not found' };
}

function v2_getEkstraBookings() {
  v2_ensureBookingColumns_();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Booking');
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const ekCol = headers.indexOf('is_ekstra');
  if (ekCol < 0) return [];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][ekCol] === true || data[i][ekCol] === 'true') {
      const obj = {};
      headers.forEach((h, j) => obj[h] = data[i][j]);
      result.push(obj);
    }
  }
  return result;
}

// ======================================================
// HEALTH CHECK
// ======================================================
function v2_health() {
  return {
    ok: true,
    version: 'v2',
    sheets_status: {
      Fasilitas: !!SpreadsheetApp.getActive().getSheetByName(V2_SHEETS.FASILITAS),
      RoomFacilities: !!SpreadsheetApp.getActive().getSheetByName(V2_SHEETS.ROOM_FAC),
      BuildingLayout: !!SpreadsheetApp.getActive().getSheetByName(V2_SHEETS.LAYOUT),
      KwitansiSettings: !!SpreadsheetApp.getActive().getSheetByName(V2_SHEETS.KWITANSI)
    },
    timestamp: new Date().getTime()
  };
}

// ======================================================
// SETUP: Run this once to initialize V2 sheets + seed data
// ======================================================
function setupV2() {
  v2_getOrCreateSheet_(V2_SHEETS.FASILITAS, V2_SCHEMAS.Fasilitas);
  v2_getOrCreateSheet_(V2_SHEETS.ROOM_FAC, V2_SCHEMAS.RoomFacilities);
  v2_getOrCreateSheet_(V2_SHEETS.LAYOUT, V2_SCHEMAS.BuildingLayout);
  v2_getOrCreateSheet_(V2_SHEETS.KWITANSI, V2_SCHEMAS.KwitansiSettings);
  v2_ensureSeeded_();
  v2_ensureBookingColumns_();
  Logger.log('V2 setup complete. Sheets created & default facilities seeded.');
  return v2_health();
}

// ======================================================
// V2 DISPATCH (called from Api.gs dispatch_)
// Returns null if action not handled by V2
// ======================================================
function dispatchV2_(action, payload) {
  switch (action) {
    // Fasilitas
    case 'getFasilitas':         return { ok: true, data: v2_getFasilitas() };
    case 'saveFasilitas':        return v2_saveFasilitas(payload);
    case 'deleteFasilitas':      return v2_deleteFasilitas(payload);
    // Room-Facility
    case 'getRoomFacilities':    return { ok: true, data: v2_getRoomFacilities(payload) };
    case 'setRoomFacilities':    return v2_setRoomFacilities(payload);
    case 'calculateRoomPrice':   return { ok: true, data: v2_calculateRoomPrice(payload) };
    // Building Layout
    case 'getBuildingLayout':    return { ok: true, data: v2_getBuildingLayout(payload) };
    case 'saveBuildingLayout':   return v2_saveBuildingLayout(payload);
    // Kwitansi
    case 'getKwitansiSettings':  return { ok: true, data: v2_getKwitansiSettings() };
    case 'saveKwitansiSettings': return v2_saveKwitansiSettings(payload);
    // Booking extras
    case 'saveBookingExtra':     return v2_saveBookingExtra(payload);
    case 'getEkstraBookings':    return { ok: true, data: v2_getEkstraBookings() };
    // Health
    case 'v2health':             return v2_health();
    case 'setupV2':              return setupV2();
    // Halaman Info
    case 'getHalamanInfo':       return { ok: true, data: v2_getHalamanInfo() };
    case 'saveHalamanInfo':      return v2_saveHalamanInfo(payload);
    case 'uploadInfoMedia':      return v2_uploadInfoMedia(payload);
    // Kamar Publik (ketersediaan untuk /info)
    case 'getPublicRooms':       return { ok: true, data: v2_getPublicRooms() };
    default:                     return null; // Not a V2 action
  }
}

function debugV2Sheets() {
  const ss = SpreadsheetApp.getActive();

  const result = {
    '📄 spreadsheet_name': ss.getName(),
    '🔗 spreadsheet_url': ss.getUrl(),
    '🆔 spreadsheet_id': ss.getId(),
    '📊 total_sheets': ss.getSheets().length,
    '📋 all_sheet_names': ss.getSheets().map(s => s.getName()),
    '✅ v2_sheets_status': {}
  };

  ['Fasilitas', 'RoomFacilities', 'BuildingLayout', 'KwitansiSettings'].forEach(name => {
    const sh = ss.getSheetByName(name);
    result['✅ v2_sheets_status'][name] = sh
      ? `EXISTS · ${sh.getLastRow()} rows × ${sh.getLastColumn()} cols`
      : '❌ NOT FOUND';
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// ======================================================
// HALAMAN INFO (konten + foto/video halaman publik /info)
// ======================================================
var HALAMAN_INFO_SHEET = 'HalamanInfo';
var HALAMAN_INFO_FOLDER = 'KelolaKos HalamanInfo';

function v2_getHalamanInfo() {
  try {
    var sh = v2_getOrCreateSheet_(HALAMAN_INFO_SHEET, ['key', 'value', 'updated_at']);
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === 'json') {
        try { return JSON.parse(String(data[i][1] || '{}')); } catch (e) { return {}; }
      }
    }
    return {};
  } catch (e) {
    return {};
  }
}

function v2_saveHalamanInfo(payload) {
  var sh = v2_getOrCreateSheet_(HALAMAN_INFO_SHEET, ['key', 'value', 'updated_at']);
  var json = (payload && payload.json) ? String(payload.json) : '{}';
  var data = sh.getDataRange().getValues();
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === 'json') { rowIdx = i + 1; break; }
  }
  if (rowIdx > 0) {
    sh.getRange(rowIdx, 1, 1, 3).setValues([['json', json, v2_now_()]]);
  } else {
    sh.appendRow(['json', json, v2_now_()]);
  }
  return { ok: true };
}

function v2_uploadInfoMedia(payload) {
  var f = payload && payload.file;
  if (!f || !f.base64) return { ok: false, error: 'Tidak ada berkas.' };

  var folder = v2_infoFolder_();
  var mime = f.mimeType || 'application/octet-stream';
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyyMMdd-HHmmss');
  var name = stamp + '-' + String(f.name || 'media').replace(/[^\w.\-]+/g, '_');

  var bytes = Utilities.base64Decode(f.base64);
  var blob = Utilities.newBlob(bytes, mime, name);
  var file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* abaikan kalau policy domain melarang */ }

  var id = file.getId();
  var url = 'https://drive.google.com/uc?export=view&id=' + id;
  return { ok: true, url: url, id: id, name: name };
}

function v2_infoFolder_() {
  var it = DriveApp.getFoldersByName(HALAMAN_INFO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(HALAMAN_INFO_FOLDER);
}

// ======================================================
// KAMAR PUBLIK — ketersediaan kamar untuk /info (Tahap 2)
// Data AMAN: nama kamar, gedung, tipe, lantai, status. Tanpa nama
// penghuni / uang / detail booking.
// ======================================================
function v2_getPublicRooms() {
  try {
    var rooms = (typeof getRoomStatusList_ === 'function') ? getRoomStatusList_() : [];
    return rooms.map(function (r) {
      var code = String(r.Status_Code || '').toUpperCase();
      var status = 'terisi';
      if (code === 'READY' || code === 'TERSEDIA' || code === 'KOSONG') status = 'kosong';
      else if (code === 'NONAKTIF' || code.indexOf('MAINT') >= 0 || code.indexOf('PERBAIKAN') >= 0) status = 'perbaikan';

      // Lantai diambil dari Tipe_Kamar / Catatan ("Lantai 2" -> 2), kalau ada.
      var src = String(r.Tipe_Kamar || '') + ' ' + String(r.Catatan || '');
      var m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
      var lantai = m ? Number(m[1]) : 0;

      return {
        nama: r.Nama_Kamar || '',
        gedung: r.Gedung || '',
        tipe: r.Tipe_Kamar || '',
        layanan: r.Layanan_Default || '',
        lantai: lantai,
        status: status
      };
    });
  } catch (e) {
    return [];
  }
}
