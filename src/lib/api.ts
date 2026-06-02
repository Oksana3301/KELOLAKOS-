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
    throw new ApiError(`Network error: ${(e as Error).message}. Cek koneksi internet atau Apps Script URL.`, 'NETWORK');
  }
  if (!response.ok) throw new ApiError(`HTTP ${response.status}: ${response.statusText}`, 'HTTP_' + response.status);

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
  return body.data as T;
}

// ============================================
// Types
// ============================================

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

export interface SubmitBookingPayload {
  roomId: string; customerName: string; whatsapp?: string;
  checkIn: string; checkOut: string; paket: string; jumlahPeriode: number;
  hargaKamar: number; extraCharge?: number; diskon?: number; dpAwal?: number;
  dpMetode?: string; catatan?: string; extraRequest?: string;
  isEkstra?: boolean; fasilitasIds?: string[];
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
}

export interface SubmitStaffFeePayload {
  bookingId?: string; roomId?: string; namaPenjaga: string;
  jenisFee?: string; nominal: number; statusBayar?: string;
  tanggal?: string; catatan?: string;
}

export interface SubmitExpensePayload {
  unit?: string; kategori: string; item: string; nominal: number;
  metode?: string; dibeliOleh?: string; tanggal?: string; catatan?: string;
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

// ============================================
// [B4] Laporan types
// ============================================

export interface ReportTransaction {
  type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE';
  icon: string;
  date: string;
  nominal: number;
  direction: 'IN' | 'OUT';
  title: string;
  subtitle: string;
  bookingId: string;
  diterimaOleh: string;
  catatan: string;
}

export interface ReportData {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    totalIn: number;
    totalRefund: number;
    totalFee: number;
    totalExpense: number;
    totalOut: number;
    netCash: number;
    countPayment: number;
    countRefund: number;
    countFee: number;
    countExpense: number;
    countAll: number;
  };
  bookingStats: {
    totalBooking: number;
    booking_aktif: number;
    booking_selesai: number;
    booking_cancel: number;
    omzet: number;
  };
  transactions: ReportTransaction[];
  chart: Array<{
    date: string;
    in: number;
    out: number;
  }>;
}

// ============================================
// API methods
// ============================================
export const api = {
  ping: () => callApi<{ pong: boolean; timestamp: number }>('ping', {}, { skipLicense: true }),
  verifyAccessCode: (accessCode: string) =>
    callApi<{
      status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'INVALID';
      tier?: string; daysRemaining?: number; expireDate?: string; message?: string;
    }>('verifyAccessCode', { accessCode }, { accessCode, skipLicense: true }),

  getInitialData: () => callApi<InitialData>('getInitialData'),
  getBookingFormData: () => callApi<BookingFormData>('getBookingFormData'),

  submitBooking: (data: SubmitBookingPayload) =>
    callApi<{ bookingId: string; message?: string; warning?: string }>('submitBooking', data),
  submitBookingEdit: (data: SubmitBookingEditPayload) =>
    callApi<{ bookingId: string; message?: string }>('submitBookingEdit', data),
  submitBookingDelete: (bookingId: string) =>
    callApi<{ message?: string; removed?: { payments: number; refunds: number; fees: number } }>(
      'submitBookingDelete', { bookingId }),

  submitPayment: (data: SubmitPaymentPayload) =>
    callApi<{ paymentId: string; message?: string }>('submitPayment', data),
  submitStatusAction: (data: SubmitStatusActionPayload) =>
    callApi<{ message?: string }>('submitStatusAction', data),

  getBookingDetail: (bookingId: string) =>
    callApi<BookingDetail>('getBookingDetail', { bookingId }),
  getBookingPayments: (bookingId: string) =>
    callApi<{ payments: PaymentRecord[]; refunds: RefundRecord[] }>('getBookingPayments', { bookingId }),

  submitRefund: (data: SubmitRefundPayload) =>
    callApi<{ refundId: string; bookingId: string; message?: string; availableAfter?: number }>('submitRefund', data),
  submitStaffFee: (data: SubmitStaffFeePayload) =>
    callApi<{ feeId: string; message?: string }>('submitStaffFee', data),
  submitExpense: (data: SubmitExpensePayload) =>
    callApi<{ expenseId: string; message?: string }>('submitExpense', data),
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

  /** [B4] Get period-filtered report data */
  getReportData: (startDate: string, endDate: string) =>
    callApi<ReportData>('getReportData', { startDate, endDate }),

  /** [B7] Delete a single transaction (Payment/Refund/Fee/Expense) */
  submitTransactionDelete: (data: {
    type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE';
    id: string;
  }) =>
    callApi<{
      message: string;
      deletedId: string;
      type: string;
      linkedBookingId: string;
      recompute: string;
    }>('submitTransactionDelete', data),
};
