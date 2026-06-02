/**
 * KelolaKos API Client — V2 Extensions
 *
 * Typed wrappers untuk endpoint V2:
 *   - Fasilitas CRUD
 *   - Room-Facility assignment + price calc
 *   - Building Layout 3D config
 *   - Kwitansi customization
 *   - Booking ekstra request
 */

import { callApi } from './api';

// ============================================
// Types
// ============================================
export interface Fasilitas {
  id: string;
  kode: string;
  nama: string;
  emoji: string;
  price_adjust: number;
  is_active: boolean;
  description: string;
  updated_at: string;
}

export interface RoomPriceCalculation {
  base_price: number;
  facility_total: number;
  total_per_period: number;
  facilities: Array<{
    id: string;
    kode: string;
    nama: string;
    price_adjust: number;
  }>;
}

export interface BuildingLayoutRoom {
  id?: string;
  gedung_kode: string;
  floor: number;
  side: 'N' | 'S' | 'E' | 'W';
  col_index: number;
  room_id: string;
  facing_arah?: string;
  updated_at?: string;
}

export interface KwitansiSettings {
  business_name: string;
  tagline: string;
  logo_mode: 'letter' | 'image';
  logo_letter: string;
  logo_image_base64: string;
  accent_color: string;
  font_style: 'default' | 'serif' | 'elegant' | 'classic';
  layout: 'standard' | 'center' | 'compact';
  show_stamp: boolean;
  show_tagline: boolean;
  title_text: string;
  thankyou_text: string;
  sig_name: string;
  sig_title: string;
  alamat: string;
  kontak: string;
}

export interface BookingExtraPayload {
  booking_id: string;
  extra_request: string;
  is_ekstra: boolean;
}

// ============================================
// FASILITAS API
// ============================================
export const facilityApi = {
  list: () => callApi<Fasilitas[]>('getFasilitas'),
  save: (data: Partial<Fasilitas>) =>
    callApi<{ ok: boolean; id: string }>('saveFasilitas', data),
  delete: (id: string) =>
    callApi<{ ok: boolean; id: string }>('deleteFasilitas', { id }),
};

// ============================================
// ROOM-FACILITY ASSIGNMENT
// ============================================
export const roomFacilityApi = {
  get: (kamarId?: string) =>
    callApi<Fasilitas[] | Record<string, string[]>>(
      'getRoomFacilities',
      kamarId ? { kamar_id: kamarId } : {},
    ),
  set: (kamarId: string, fasilitasIds: string[]) =>
    callApi<{ ok: boolean; kamar_id: string; count: number }>('setRoomFacilities', {
      kamar_id: kamarId,
      fasilitas_ids: fasilitasIds,
    }),
  calculatePrice: (basePrice: number, fasilitasIds: string[]) =>
    callApi<RoomPriceCalculation>('calculateRoomPrice', {
      base_price: basePrice,
      fasilitas_ids: fasilitasIds,
    }),
};

// ============================================
// BUILDING LAYOUT 3D
// ============================================
export const layoutApi = {
  get: (gedungKode?: string) =>
    callApi<BuildingLayoutRoom[]>(
      'getBuildingLayout',
      gedungKode ? { gedung_kode: gedungKode } : {},
    ),
  save: (gedungKode: string, rooms: Omit<BuildingLayoutRoom, 'id' | 'gedung_kode' | 'updated_at'>[]) =>
    callApi<{ ok: boolean; gedung_kode: string; count: number }>('saveBuildingLayout', {
      gedung_kode: gedungKode,
      rooms,
    }),
};

// ============================================
// KWITANSI
// ============================================
export const kwitansiApi = {
  get: () => callApi<KwitansiSettings>('getKwitansiSettings'),
  save: (settings: Partial<KwitansiSettings>) =>
    callApi<{ ok: boolean; count: number }>('saveKwitansiSettings', settings),
};

// ============================================
// BOOKING EKSTRA
// ============================================
export const bookingExtraApi = {
  save: (data: BookingExtraPayload) =>
    callApi<{ ok: boolean; booking_id: string }>('saveBookingExtra', data),
  listEkstra: () => callApi<unknown[]>('getEkstraBookings'),
};

// ============================================
// HEALTH
// ============================================
export const v2Api = {
  health: () =>
    callApi<{ ok: boolean; version: string; sheets_status: Record<string, boolean> }>('v2health'),
};

// Combined export
export const apiV2 = {
  facility: facilityApi,
  roomFacility: roomFacilityApi,
  layout: layoutApi,
  kwitansi: kwitansiApi,
  bookingExtra: bookingExtraApi,
  v2: v2Api,
};

export default apiV2;
