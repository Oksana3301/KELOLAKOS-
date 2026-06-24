/**
 * KelolaKos API Client — Final (Batch 1-5)
 *
 * Combines: B1 (booking detail/edit), B2 (refund/fee/expense/recent),
 *           B3 (room/price/fasilitas CRUD), B4 (report data)
 */

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_APPS_SCRIPT_API_KEY || '';

const ACCESS_CODE_KEY = 'kelolakos_access_code';

export function getStoredAccessCode(): string {
  if (typeof window === 'undefined') return '';
  try { return window.localStorage.getItem(ACCESS_CODE_KEY) || ''; } catch { return ''; }
}
export function setStoredAccessCode(code: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ACCESS_CODE_KEY, code); } catch {}
}
export function clearStoredAccessCode(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(ACCESS_CODE_KEY); } catch {}
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  license?: {
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'INVALID' | 'NEED_CODE';
    message?: string; tier?: string; daysRemaining?: number; expireDate?: string;
  };
  _meta?: { action: string; elapsed_ms: number };
}

export class ApiError extends Error {
  constructor(message: string, public code: string, public response?: ApiResponse) {
    super(message);
    this.name = 'ApiError';
  }
}

export class LicenseError extends ApiError {
  constructor(
    message: string,
    public licenseStatus: 'EXPIRED' | 'REVOKED' | 'INVALID' | 'NEED_CODE',
    response?: ApiResponse,
  ) {
    super(message, licenseStatus, response);
    this.name = 'LicenseError';
  }
}

export interface CallApiOptions { accessCode?: string; skipLicense?: boolean }

/**
 * Bukti / proof file attached to a booking or money record.
 * `base64` is the raw base64 string (no "data:" prefix). Optional everywhere.
 * Sent to the backend as `bukti_files`; storing them to Drive needs a backend
 * handler that reads this field (Bukti_URLs is the existing display field).
 */
export interface BuktiFile {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}

export async function callApi<T = unknown>(
  action: string,
  data?: Record<string, unknown> | object,
  options?: CallApiOptions,
): Promise<T> {
  if (!APPS_SCRIPT_URL) throw new ApiError('NEXT_PUBLIC_APPS_SCRIPT_URL not set in .env.local', 'CONFIG');
  if (!API_KEY) throw new ApiError('NEXT_PUBLIC_APPS_SCRIPT_API_KEY not set in .env.local', 'CONFIG');

  const accessCode = options?.accessCode ?? getStoredAccessCode();
  const payload: Record<string, unknown> = { apiKey: API_KEY, action, data: data || {} };
  if (accessCode) payload.accessCode = accessCode;

  let response: Response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
  } catch (e) {
    throw new ApiError('Network error: ' + (e as Error).message + '. Cek koneksi internet atau Apps Script URL.', 'NETWORK');
  }
  if (!response.ok) throw new ApiError('HTTP ' + response.status + ': ' + response.statusText, 'HTTP_' + response.status);

  let body: ApiResponse<T>;
  try { body = await response.json(); }
  catch (e) { throw new ApiError('Invalid JSON response from server', 'PARSE'); }

  if (!body.ok) {
    const errorCode = body.error || 'UNKNOWN';
    const errorMsg = body.message || body.error || 'Unknown error';
    if (['NEED_CODE', 'EXPIRED', 'REVOKED', 'INVALID'].includes(errorCode)) {
      throw new LicenseError(errorMsg, errorCode as never, body);
    }
    throw new ApiError(errorMsg, errorCode, body);
  }
  // Most actions wrap their result in { ok, data }. Some V2 actions (e.g.
  // uploadInfoMedia / saveFasilitas) put their fields at the TOP level instead.
  // Fall back to the whole body (minus envelope) so those fields aren't lost.
  if (body.data !== undefined) return body.data as T;
  const { ok: _ok, _meta, error: _e, message: _m, ...rest } = body as Record<string, unknown> & ApiResponse<T>;
  void _ok; void _meta; void _e; void _m;
  return rest as T;
}

export interface RoomStatus {
  RoomID: string; Nama_Kamar: string; Gedung: string; Layanan_Default: string;
  Tipe_Kamar: string; Kapasitas_Normal: number; Status_Kamar: string; Catatan: string;
  Active_Count: number; Has_Bookings: 'YA' | 'TIDAK'; Status_Code: string;
  Status_Label: string; Status_Reason: string; Penghuni_Text: string;
  Is_Master_Active: 'YA' | 'TIDAK'; Can_Override: 'YA' | 'TIDAK';
}

export interface PriceItem {
  PriceID: string; Layanan: string; Gedung: string; Tipe_Kamar: string;
  Paket: string; Harga_Satuan: number; DP_Minimal: number; Fee_Default: number;
  ExtraBed_Default: number; ExtraPerson_Default: number; Aktif: string;
  Catatan: string; Label: string;
}

export interface RoomPriceRule {
  RuleID: string; RoomID: string; Nama_Kamar: string; Layanan: string;
  Gedung: string; Tipe_Kamar: string; Paket: string; Harga_Satuan: number;
  DP_Minimal: number; Fee_Default: number; ExtraBed_Default: number;
  ExtraPerson_Default: number; Aktif: string; Catatan: string; Label: string;
}

export interface BookingItem {
  BookingID: string; RoomID: string; Nama_Kamar: string; Gedung: string;
  Tipe_Kamar: string; Nama_Customer: string; WhatsApp: string;
  CheckIn: string; CheckOut: string; Catatan: string; Layanan: string;
  Paket: string; Jumlah_Periode: number; Status_Booking: string;
  Status_Bayar: string; Harga_Kamar: number; Extra_Charge: number;
  Diskon: number; Harga_Total_Net: number; Total_Bayar: number;
  Refund_Total: number; Net_Diterima: number; Sisa_Bayar: number;
  Kelebihan_Bayar: number; DP_Hangus: number; Is_Closed: string; Label: string;
}

export interface BookingFullData extends BookingItem {
  Timestamp?: string; Durasi?: string; Jumlah_Orang?: number;
  Extra_Bed_Qty?: number; Extra_Person_Qty?: number; Extra_Request?: string;
  Is_Ekstra?: 'YA' | 'TIDAK'; Updated_At?: string;
}

export interface DashboardStats {
  pendapatanKotor: number; totalRefund: number; pendapatanNet: number;
  dpHangus: number; omzetBookingAktif: number; sisaTagihan: number;
  totalKelebihanBayar: number; totalExtraCharge: number; totalBelanja: number;
  totalFee: number; netCash: number; uangKos: number; uangPenginapan: number;
  jumlahBelumLunas: number; jumlahStatusAction: number; jumlahLunasBelumDitutup: number;
  jumlahSelesai: number; jumlahCancelHangus: number; jumlahCancelRefund: number;
}

export interface InitialData {
  roomStatus: RoomStatus[]; prices: PriceItem[]; roomPriceRules: RoomPriceRule[];
  paymentBookings: BookingItem[]; statusActionBookings: BookingItem[];
  closingBookings: BookingItem[]; feeBookingOptions: BookingItem[];
  penghuniKos: unknown[]; dashboard: DashboardStats;
}

export interface BookingFormData { rooms: RoomStatus[]; prices: PriceItem[] }

/** Sanitized room info for the PUBLIC /info page (no tenant names / money). */
export interface PublicRoom {
  nama: string;
  gedung: string;
  tipe: string;
  layanan: string;
  lantai: number;
  status: 'kosong' | 'terisi' | 'perbaikan';
  harga?: number; // base harga kamar (kost) bila tersedia
}

/** Fasilitas/add-on dari Pengaturan (AC, extra bed, dll). */
export interface Fasilitas {
  id: string;
  kode: string;
  nama: string;
  emoji: string;
  price_adjust: number;
  satuan?: string; // per_bulan | per_hari | per_tahun
  is_active?: boolean | string;
}

/** Payload submit booking dari halaman publik /info (jadi booking PENDING). */
export interface BookingRequestPayload {
  jenis: 'baru' | 'perpanjang';
  nama: string;
  whatsapp: string;       // 62xxxx
  layanan: string;        // 'KOS' | 'PENGINAPAN'
  kamar: string;          // "Nama — Gedung"
  durasi: string;         // paket
  tglMulai: string;       // ISO date
  bayar: 'DP' | 'Full';
  catatan?: string;
  tagPerpanjangan?: string; // ID booking lama (khusus perpanjang)
  jumlahOrang?: number;
  bukti?: BuktiFile;        // bukti transfer (opsional)
}

/** Info pembayaran publik (rekening + QR per layanan) dari Pengaturan Invoice. */
export interface PaymentRekening { bank: string; nomor: string; atasNama: string; qr: string; }
export interface PaymentInfo {
  kost: PaymentRekening;
  penginapan: PaymentRekening;
  waResmi: string;
}

/** Hasil lookup penyewa lama untuk fitur Perpanjang Kontrak (publik, read-only). */
export interface PenyewaLookup {
  bookingId: string;        // ID booking lama (mis. TH-2026-0148)
  nama: string;
  whatsapp: string;         // 62xxxx
  layanan: string;          // 'KOS' | 'PENGINAPAN'
  kamar: string;            // nama kamar (+ gedung)
  tipe: string;             // tipe kamar
  durasiTerakhir: string;   // paket terakhir
  tglAkhirKontrak: string;  // ISO date akhir kontrak
  status: string;           // status booking (untuk menyaring Batal/Ditolak di backend)
}

export interface SubmitBookingPayload {
  roomId: string; customerName: string; whatsapp?: string;
  checkIn: string; checkOut: string; paket: string; jumlahPeriode: number;
  hargaKamar: number; extraCharge?: number; diskon?: number; dpAwal?: number;
  dpMetode?: string; catatan?: string; extraRequest?: string;
  isEkstra?: boolean; fasilitasIds?: string[];
  /** Optional: tanggal DP & pelunasan (YYYY-MM-DD). Backend backward-compatible. */
  dpTanggal?: string; pelunasanNominal?: number; pelunasanTanggal?: string;
  /** Full computed total (periode × harga + fasilitas). Authoritative on the backend. */
  hargaTotal?: number;
  buktiFiles?: BuktiFile[];
}

export interface SubmitBookingEditPayload {
  bookingId: string; customerName?: string; whatsapp?: string;
  checkIn?: string; checkOut?: string; hargaKamar?: number;
  extraCharge?: number; diskon?: number; hargaTotal?: number;
  catatan?: string; extraRequest?: string; isEkstra?: boolean; fasilitasIds?: string[];
}

export interface SubmitPaymentPayload {
  bookingId: string; nominal: number; jenisBayar?: string;
  metode?: string; diterimaOleh?: string; tanggalBayar?: string; catatan?: string;
  buktiFiles?: BuktiFile[];
}

export interface SubmitStatusActionPayload {
  bookingId: string; statusBooking: string; catatanTambahan?: string;
  refundNominal?: number; jenisRefund?: string; metodeRefund?: string;
  dikembalikanOleh?: string; alasanRefund?: string; tanggalRefund?: string;
}

export interface SubmitRefundPayload {
  bookingId: string; nominal: number; jenisRefund?: string;
  metodeRefund?: string; dikembalikanOleh?: string;
  alasanRefund?: string; tanggalRefund?: string;
  buktiFiles?: BuktiFile[];
}

export interface SubmitStaffFeePayload {
  bookingId?: string; roomId?: string; namaPenjaga: string;
  jenisFee?: string; nominal: number; statusBayar?: string;
  tanggal?: string; catatan?: string;
  buktiFiles?: BuktiFile[];
}

export interface SubmitExpensePayload {
  unit?: string; kategori: string; item: string; nominal: number;
  metode?: string; dibeliOleh?: string; tanggal?: string; catatan?: string;
  buktiFiles?: BuktiFile[];
}

export interface SubmitRoomUpsertPayload {
  roomId?: string; namaKamar: string; layananDefault: string; gedung: string;
  tipeKamar: string; kapasitasNormal: number; statusKamar?: string; catatan?: string;
}

export interface SubmitPriceSettingPayload {
  priceId?: string; layanan: string; gedung: string; tipeKamar: string; paket: string;
  hargaSatuan: number; dpMinimal?: number; feeDefault?: number;
  extraBedDefault?: number; extraPersonDefault?: number; aktif?: string; catatan?: string;
}

export interface SubmitBulkRoomPricePayload {
  roomIdsCsv: string; paket: string; hargaSatuan: number; dpMinimal?: number;
  feeDefault?: number; extraBedDefault?: number; extraPersonDefault?: number;
  aktif?: string; catatan?: string;
}

export interface PaymentRecord {
  PaymentID: string; Tanggal_Bayar: string; Jenis_Bayar: string;
  Nominal: number; Metode: string; Diterima_Oleh: string;
  Catatan: string; Bukti_URLs: string[];
}

export interface RefundRecord {
  RefundID: string; Tanggal_Refund: string; Jenis_Refund: string;
  Nominal: number; Metode: string; Dikembalikan_Oleh: string; Alasan: string;
}

export interface BookingDetail {
  booking: BookingFullData;
  payments: PaymentRecord[];
  refunds: RefundRecord[];
  facilities: Array<{
    id: string; kode: string; nama: string; emoji: string;
    price_adjust: number; is_active: boolean; description: string;
  }>;
}

export interface RecentTransaction {
  type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE';
  icon: string; id: string; date: string; timestamp: string;
  title: string; subtitle: string; nominal: number;
  direction: 'IN' | 'OUT'; bookingId: string; catatan: string;
}

export interface RecentTransactionsResponse {
  transactions: RecentTransaction[];
  total: number;
  summary: {
    totalPayment: number; totalRefund: number;
    totalFee: number; totalExpense: number; netCash: number;
  };
}

export interface ReportTransaction {
  type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE';
  icon: string; date: string; nominal: number;
  direction: 'IN' | 'OUT'; title: string; subtitle: string;
  bookingId: string; diterimaOleh: string; catatan: string;
}

export interface ReportData {
  period: { startDate: string; endDate: string; days: number; };
  summary: {
    totalIn: number; totalRefund: number; totalFee: number;
    totalExpense: number; totalOut: number; netCash: number;
    countPayment: number; countRefund: number; countFee: number;
    countExpense: number; countAll: number;
  };
  bookingStats: {
    totalBooking: number; booking_aktif: number;
    booking_selesai: number; booking_cancel: number; omzet: number;
  };
  transactions: ReportTransaction[];
  chart: Array<{ date: string; in: number; out: number; }>;
}

export const api = {
  ping: () => callApi<{ pong: boolean; timestamp: number }>('ping', {}, { skipLicense: true }),
  verifyAccessCode: (accessCode: string) =>
    callApi<{
      status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'INVALID';
      tier?: string; daysRemaining?: number; expireDate?: string; message?: string;
    }>('verifyAccessCode', { accessCode }, { accessCode, skipLicense: true }),

  getInitialData: () => callApi<InitialData>('getInitialData'),
  getBookingFormData: () => callApi<BookingFormData>('getBookingFormData'),

  // Public (no access code) — sanitized room availability for the /info page.
  getPublicRooms: () =>
    callApi<PublicRoom[]>('getPublicRooms', undefined, { skipLicense: true }),

  // Public (no access code) — lookup penyewa lama untuk Perpanjang Kontrak (read-only).
  lookupPenyewaByWa: (wa: string) =>
    callApi<PenyewaLookup[]>('lookupPenyewaByWa', { wa }, { skipLicense: true }),
  lookupPenyewaById: (bookingId: string) =>
    callApi<PenyewaLookup | null>('lookupPenyewaById', { bookingId, booking_id: bookingId }, { skipLicense: true }),
  lookupPenyewaByRoom: (kamar: string) =>
    callApi<PenyewaLookup[]>('lookupPenyewaByRoom', { kamar, room: kamar }, { skipLicense: true }),
  // Public — fasilitas/add-on dari Pengaturan (untuk form booking).
  getPublicFasilitas: () =>
    callApi<Fasilitas[]>('getFasilitas', undefined, { skipLicense: true }),
  // Public — rekening + QR per layanan (dari Pengaturan Invoice).
  getPaymentInfo: () =>
    callApi<PaymentInfo>('getPaymentInfo', undefined, { skipLicense: true }),

  // Public (no access code) — submit booking dari /info → tersimpan sebagai PENDING.
  submitBookingRequest: (data: BookingRequestPayload) =>
    callApi<{ bookingId: string; message?: string }>('submitBookingRequest', data as unknown as Record<string, unknown>, { skipLicense: true }),

  submitBooking: (data: SubmitBookingPayload) =>
    callApi<{ bookingId: string; message?: string; warning?: string }>('submitBooking', {
      ...data,
      bukti_files: data.buktiFiles || [],
      nama: data.customerName,
      no_wa: data.whatsapp || '',
      wa: data.whatsapp || '',
      check_in: data.checkIn,
      check_out: data.checkOut,
      paket_durasi: data.paket,
      jumlah_periode: data.jumlahPeriode,
      harga_kamar: data.hargaKamar,
      harga_total: data.hargaTotal,
      hargaTotal: data.hargaTotal,
      extra_charge: data.extraCharge || 0,
      extra_charge_final: data.extraCharge || 0,
      dp_awal: data.dpAwal || 0,
      dp_metode: data.dpMetode || '',
      dp_tanggal: data.dpTanggal || '',
      pelunasan_nominal: data.pelunasanNominal || 0,
      pelunasan_tanggal: data.pelunasanTanggal || '',
      extra_request: data.extraRequest || '',
      is_ekstra: data.isEkstra || false,
      fasilitas_ids: data.fasilitasIds || [],
      room_id: data.roomId,
    }),
  submitBookingEdit: (data: SubmitBookingEditPayload) =>
    callApi<{ bookingId: string; message?: string }>('submitBookingEdit', {
      ...data,
      booking_id: data.bookingId,
      nama: data.customerName,
      no_wa: data.whatsapp,
      wa: data.whatsapp,
      check_in: data.checkIn,
      check_out: data.checkOut,
      harga_kamar: data.hargaKamar,
      extra_charge: data.extraCharge,
      extra_charge_final: data.extraCharge,
      harga_total: data.hargaTotal,
      extra_request: data.extraRequest,
      is_ekstra: data.isEkstra,
      fasilitas_ids: data.fasilitasIds,
    }),
  submitBookingDelete: (bookingId: string) =>
    callApi<{ message?: string; removed?: { payments: number; refunds: number; fees: number } }>(
      'submitBookingDelete', { bookingId, booking_id: bookingId }),

  submitPayment: (data: SubmitPaymentPayload) =>
    callApi<{ paymentId: string; message?: string }>('submitPayment', {
      ...data,
      bukti_files: data.buktiFiles || [],
      booking_id: data.bookingId,
      jenis_bayar: data.jenisBayar,
      diterima_oleh: data.diterimaOleh,
      tanggal_bayar: data.tanggalBayar,
    }),
  submitStatusAction: (data: SubmitStatusActionPayload) =>
    callApi<{ message?: string }>('submitStatusAction', {
      ...data,
      booking_id: data.bookingId,
      status_booking: data.statusBooking,
      catatan_tambahan: data.catatanTambahan,
      refund_nominal: data.refundNominal,
      jenis_refund: data.jenisRefund,
      metode_refund: data.metodeRefund,
      dikembalikan_oleh: data.dikembalikanOleh,
      alasan_refund: data.alasanRefund,
      tanggal_refund: data.tanggalRefund,
    }),

  getBookingDetail: (bookingId: string) =>
    callApi<BookingDetail>('getBookingDetail', { bookingId, booking_id: bookingId }),
  getBookingPayments: (bookingId: string) =>
    callApi<{ payments: PaymentRecord[]; refunds: RefundRecord[] }>('getBookingPayments', { bookingId, booking_id: bookingId }),

  submitRefund: (data: SubmitRefundPayload) =>
    callApi<{ refundId: string; bookingId: string; message?: string; availableAfter?: number }>('submitRefund', {
      ...data,
      bukti_files: data.buktiFiles || [],
      booking_id: data.bookingId,
      jenis_refund: data.jenisRefund,
      metode_refund: data.metodeRefund,
      dikembalikan_oleh: data.dikembalikanOleh,
      alasan_refund: data.alasanRefund,
      tanggal_refund: data.tanggalRefund,
    }),
  submitStaffFee: (data: SubmitStaffFeePayload) =>
    callApi<{ feeId: string; message?: string }>('submitStaffFee', {
      ...data,
      bukti_files: data.buktiFiles || [],
      booking_id: data.bookingId,
      room_id: data.roomId,
      nama_penjaga: data.namaPenjaga,
      jenis_fee: data.jenisFee,
      status_bayar: data.statusBayar,
    }),
  submitExpense: (data: SubmitExpensePayload) =>
    callApi<{ expenseId: string; message?: string }>('submitExpense', {
      ...data,
      bukti_files: data.buktiFiles || [],
      dibeli_oleh: data.dibeliOleh,
    }),
  getRecentTransactions: (limit?: number) =>
    callApi<RecentTransactionsResponse>('getRecentTransactions', { limit: limit || 20 }),

  getRoomManagementData: () => callApi<{ rooms: RoomStatus[] }>('getRoomManagementData'),
  submitRoomUpsert: (data: SubmitRoomUpsertPayload) =>
    callApi<{ roomId: string; isNew?: boolean; message?: string }>('submitRoomUpsert', data),
  submitRoomDelete: (roomId: string) =>
    callApi<{ message?: string }>('submitRoomDelete', { roomId }),
  getPriceSettingData: () => callApi<{ prices: PriceItem[] }>('getPriceSettingData'),
  submitPriceSetting: (data: SubmitPriceSettingPayload) =>
    callApi<{ priceId: string; message?: string }>('submitPriceSetting', data),
  getBulkPriceData: () =>
    callApi<{ rooms: RoomStatus[]; rules: RoomPriceRule[] }>('getBulkPriceData'),
  submitBulkRoomPrice: (data: SubmitBulkRoomPricePayload) =>
    callApi<{ message?: string }>('submitBulkRoomPrice', data),

  getReportData: (startDate: string, endDate: string) =>
    callApi<ReportData>('getReportData', { startDate, endDate }),

  submitTransactionDelete: (data: { type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE'; id: string; }) =>
    callApi<{
      message: string; deletedId: string; type: string;
      linkedBookingId: string; recompute: string;
    }>('submitTransactionDelete', data),
};
