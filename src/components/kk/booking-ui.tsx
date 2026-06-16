'use client';

// KelolaKos · Booking page UI (elderly-friendly reskin).
// Presentational + flow components for the Booking page. Wires the SAME
// submit payloads the legacy modals used (api.submitBooking / submitBookingEdit
// / submitStatusAction / submitRefund). Reuses the shared KK primitives.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  type RoomStatus,
  type PriceItem,
  type RoomPriceRule,
  type BookingFullData,
  type BuktiFile,
  type PaymentRecord,
} from '@/lib/api';
import { type Fasilitas } from '@/lib/api-v2';
import { Sheet, SheetHead, KkButton, KkCard, BayarBadge, InfoRow, Dialog } from './ui';
import { FileUpload } from './file-upload';
import { MoneyInput } from './money-input';
import { KkIcon } from './icons';
import { rupiah, tglPanjang, tglPendek, mapPayStatus, mapRoomStatus, type PayStatus, type RoomDisplayStatus } from './status';

const TODAY = () => new Date().toISOString().split('T')[0];

function addMonths(iso: string, n: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(n || 0));
  return d.toISOString().split('T')[0];
}

function addDays(iso: string, n: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(n || 0));
  return d.toISOString().split('T')[0];
}

// Real number of days in the calendar month of `iso` (akurat, bukan 30 tetap).
function daysInMonth(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 30;
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export type Satuan = 'Bulanan' | 'Harian';

// ── Paket (rental period) model ──────────────────────────────────────────────
// Settings let the owner price each room per Harian / Mingguan / Bulanan /
// 6 Bulan / Setahun. Booking must use the price of the SAME paket and multiply
// by the count of that unit — never silently convert a daily price to monthly.
export type PaketKind = 'harian' | 'mingguan' | 'bulanan' | '6bulan' | 'setahun';

interface PaketMeta {
  label: string; // selector label
  unitLong: string; // "bulan", "hari"
  unitShort: string; // chip label
  months: number; // calendar months per 1 unit (0 ⇒ measured in days)
  days: number; // days per 1 unit (when months = 0)
  order: number;
}
export const PAKET_META: Record<PaketKind, PaketMeta> = {
  harian: { label: 'Per Hari', unitLong: 'hari', unitShort: 'hr', months: 0, days: 1, order: 1 },
  mingguan: { label: 'Per Minggu', unitLong: 'minggu', unitShort: 'mgg', months: 0, days: 7, order: 2 },
  bulanan: { label: 'Per Bulan', unitLong: 'bulan', unitShort: 'bln', months: 1, days: 0, order: 3 },
  '6bulan': { label: 'Per 6 Bulan', unitLong: '×6 bulan', unitShort: '6bln', months: 6, days: 0, order: 4 },
  setahun: { label: 'Per Tahun', unitLong: 'tahun', unitShort: 'thn', months: 12, days: 0, order: 5 },
};

// Classify a backend Paket string ("HARIAN", "1_BULAN", "Setahun"…) into a kind.
export function classifyPaket(p: string): PaketKind | null {
  const s = (p || '').toUpperCase();
  if (/HARI/.test(s)) return 'harian';
  if (/MINGGU|PEKAN/.test(s)) return 'mingguan';
  if (/TAHUN/.test(s)) return 'setahun';
  if (/6\s*BULAN|ENAM\s*BULAN/.test(s)) return '6bulan';
  if (/BULAN/.test(s)) return 'bulanan';
  return null;
}

// Backend Paket label to send for a kind (what the price rows are keyed by).
const PAKET_BACKEND: Record<PaketKind, string> = {
  harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan', '6bulan': '6 Bulan', setahun: 'Setahun',
};

// Check-out date = check-in + count × paket duration.
function addPaket(iso: string, kind: PaketKind, count: number): string {
  const m = PAKET_META[kind];
  return m.months ? addMonths(iso, m.months * count) : addDays(iso, m.days * count);
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ───────────────────────── Field (label + example + hint) ─────────────────────────
export function BookingField({
  label,
  children,
  contoh,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  contoh?: string;
  hint?: string;
}) {
  return (
    <div className="mb-5">
      <label className="block font-heading font-bold text-[19px] text-kk-navy mb-2">{label}</label>
      {children}
      {contoh && <div className="text-caption text-kk-ink mt-2">{contoh}</div>}
      {hint && (
        <div className="text-caption text-kk-ink mt-2 flex gap-2 items-start">
          <span className="text-kk-green flex-shrink-0 mt-0.5">
            <KkIcon name="bantuan" size={17} strokeWidth={2} />
          </span>
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Numbered step header ─────────────────────────
function StepHead({ step }: { step: number }) {
  const langkah = [
    { n: 1, l: 'Data Penyewa' },
    { n: 2, l: 'Pilih Kamar' },
    { n: 3, l: 'Lama Sewa' },
    { n: 4, l: 'Pembayaran' },
  ];
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {langkah.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-1.5 flex-shrink-0 flex-1 last:flex-none">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`w-[34px] h-[34px] rounded-full flex-shrink-0 grid place-items-center font-heading font-black text-[17px] ${
                  done
                    ? 'bg-kk-green text-white'
                    : active
                    ? 'bg-kk-navy text-white'
                    : 'bg-kk-mauve-soft text-kk-ink'
                }`}
              >
                {done ? <KkIcon name="cek" size={18} strokeWidth={2.6} /> : s.n}
              </div>
              <span
                className={`font-heading font-bold text-[16px] ${
                  active ? 'block text-kk-navy' : 'hidden text-kk-ink'
                }`}
              >
                {s.l}
              </span>
            </div>
            {i < 3 && (
              <div
                className={`flex-1 h-[3px] rounded-full min-w-[8px] ${
                  done ? 'bg-kk-green' : 'bg-kk-mauve'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// A room option enriched with its resolved monthly price.
export interface RoomOption {
  room: RoomStatus;
  /** Representative price for list display (the primary paket's price, or 0). */
  harga: number;
  /** The paket used for `harga` (for the "/bulan" vs "/hari" label). */
  primaryKind: PaketKind | null;
  /** Configured price per paket (override-aware, no cross-paket borrowing). */
  paketPrices: Partial<Record<PaketKind, number>>;
}

// Small status pill for a room (Terisi / Kosong / Perlu Perhatian) — mirrors
// the colour coding on the Layout Properti page.
function RoomStatusBadge({ room, className = '' }: { room: RoomStatus; className?: string }) {
  const s = mapRoomStatus(room);
  const map: Record<RoomDisplayStatus, { bg: string; label: string }> = {
    Terisi: { bg: 'bg-kk-green text-white', label: 'Terisi' },
    Tersedia: { bg: 'bg-kk-mauve text-kk-navy', label: 'Kosong' },
    'Perlu Perhatian': { bg: 'bg-kk-orange text-white', label: 'Perlu Perhatian' },
  };
  const m = map[s];
  return (
    <span
      className={`inline-flex items-center rounded-full font-body font-semibold text-caption px-3 py-1 leading-none whitespace-nowrap ${m.bg} ${className}`}
    >
      {m.label}
    </span>
  );
}

// Derive a floor number from the room's tipe/catatan ("Lantai 2" → 2).
// Mirrors the logic on the Kelola Kamar page (src/app/kamar/page.tsx).
function floorForRoom(room: RoomStatus): number | null {
  const src = `${room.Tipe_Kamar} ${room.Catatan}`;
  const m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
  return m ? Number(m[1]) : null;
}

/** Build the list of pickable rooms (available + the current one when editing).
 *  Price is resolved for the chosen unit: monthly, or daily (with a /30 fallback
 *  when no explicit daily price row exists). */
export function buildRoomOptions(
  rooms: RoomStatus[],
  prices: PriceItem[],
  currentRoomId?: string,
  roomRules: RoomPriceRule[] = [],
): RoomOption[] {
  // Normalize so "Superior", " superior " and "SUPERIOR" all match — string
  // mismatches (case/spasi) were making configured prices show "belum diatur".
  const norm = (s: string | undefined) => (s || '').trim().toUpperCase();

  // Does a price row's Tipe_Kamar describe this room? In KOS the type is in
  // Tipe_Kamar; in PENGINAPAN the type IS the room name (Deluxe / Superior 1 /
  // Eksekutif), while Tipe_Kamar may just be a "Lantai N" placeholder. So match
  // the price type against BOTH the room's Tipe_Kamar and its Nama_Kamar.
  function tipeMatch(priceTipe: string, r: RoomStatus): boolean {
    const pt = norm(priceTipe);
    if (!pt) return false;
    if (norm(r.Tipe_Kamar) === pt) return true;
    const nm = norm(r.Nama_Kamar);
    // "SUPERIOR 1" / "SUPERIOR-2" → matches type "SUPERIOR"
    return nm === pt || nm.startsWith(pt + ' ') || nm.startsWith(pt + '-') || nm.startsWith(pt + '_');
  }

  // Price rows for a room, matched TYPE-FIRST so a Superior never borrows a
  // Deluxe price. After narrowing to type-matching rows we prefer the ones that
  // also match gedung/layanan, but never relax the type — if no type match
  // exists, the room shows "harga belum diatur" (so the owner sets it).
  function rowsFor(r: RoomStatus): PriceItem[] {
    const tipeRows = prices.filter((p) => tipeMatch(p.Tipe_Kamar, r));
    if (!tipeRows.length) return [];
    const gedung = norm(r.Gedung);
    const layanan = norm(r.Layanan_Default);
    const exact = tipeRows.filter((p) => norm(p.Gedung) === gedung && norm(p.Layanan) === layanan);
    if (exact.length) return exact;
    const byGedung = tipeRows.filter((p) => norm(p.Gedung) === gedung);
    if (byGedung.length) return byGedung;
    const byLayanan = tipeRows.filter((p) => norm(p.Layanan) === layanan);
    if (byLayanan.length) return byLayanan;
    return tipeRows;
  }
  // Per-room override rows (set via Kelola Kamar / Harga Massal), keyed by RoomID.
  function ruleRowsFor(r: RoomStatus): RoomPriceRule[] {
    return roomRules.filter((rule) => rule.RoomID === r.RoomID && Number(rule.Harga_Satuan) > 0);
  }
  // Configured price PER PAKET for a room. Per-room override (Harga Massal) wins
  // over the generic type table (Harga Umum), and a price is ONLY used for the
  // paket it was set for — never borrowed across pakets (which caused a daily
  // price to be multiplied as monthly → totals jomplang).
  function paketPricesFor(r: RoomStatus): Partial<Record<PaketKind, number>> {
    const out: Partial<Record<PaketKind, number>> = {};
    const apply = (rows: { Paket: string; Harga_Satuan: number }[], override: boolean) => {
      rows.forEach((row) => {
        const kind = classifyPaket(row.Paket);
        const harga = Number(row.Harga_Satuan) || 0;
        if (!kind || harga <= 0) return;
        // Table fills only gaps; override always wins.
        if (override || out[kind] === undefined) out[kind] = harga;
      });
    };
    apply(rowsFor(r), false); // Harga Umum first (base)
    apply(ruleRowsFor(r), true); // Harga Massal overrides
    return out;
  }
  // Primary paket for list display: prefer Bulanan, else the smallest unit set.
  function primaryKindOf(pp: Partial<Record<PaketKind, number>>): PaketKind | null {
    if (pp.bulanan) return 'bulanan';
    const kinds = (Object.keys(pp) as PaketKind[]).sort(
      (a, b) => PAKET_META[a].order - PAKET_META[b].order,
    );
    return kinds[0] || null;
  }
  // Show ALL rooms (kosong first), so the owner can also book an occupied room
  // when needed — a warning is shown before saving. The current room (edit
  // mode) stays at the very top.
  const sorted = [...rooms].sort((a, b) => {
    const av = a.Status_Code === 'READY' ? 0 : 1;
    const bv = b.Status_Code === 'READY' ? 0 : 1;
    if (av !== bv) return av - bv;
    return (a.Nama_Kamar || '').localeCompare(b.Nama_Kamar || '', 'id', { numeric: true });
  });
  if (currentRoomId) {
    const idx = sorted.findIndex((r) => r.RoomID === currentRoomId);
    if (idx > 0) {
      const [cur] = sorted.splice(idx, 1);
      sorted.unshift(cur);
    } else if (idx < 0) {
      const cur = rooms.find((r) => r.RoomID === currentRoomId);
      if (cur) sorted.unshift(cur);
    }
  }
  return sorted.map((r) => {
    const paketPrices = paketPricesFor(r);
    const primaryKind = primaryKindOf(paketPrices);
    return { room: r, paketPrices, primaryKind, harga: primaryKind ? paketPrices[primaryKind] || 0 : 0 };
  });
}

// ═════════════════════════ TAMBAH / UBAH BOOKING FLOW ═════════════════════════
export function BookingFlow({
  open,
  onClose,
  rooms,
  prices,
  roomPriceRules = [],
  editBooking,
  facilities = [],
  editFacilityIds,
}: {
  open: boolean;
  onClose: () => void;
  rooms: RoomStatus[];
  prices: PriceItem[];
  /** Per-room price overrides (Kelola Kamar / Harga Massal). */
  roomPriceRules?: RoomPriceRule[];
  editBooking?: BookingFullData | null;
  /** Active facilities (with per-period price_adjust). */
  facilities?: Fasilitas[];
  /** Facility ids already attached to the booking being edited. */
  editFacilityIds?: string[];
}) {
  const qc = useQueryClient();
  const isEdit = !!editBooking;
  // Selected rental paket (price unit). Options come from the chosen room's
  // configured prices so the count is always multiplied against the right paket.
  const [paketKind, setPaketKind] = useState<PaketKind>('bulanan');
  // "Atur tanggal sendiri" mode: pick check-in/check-out, bill per day.
  const [customDate, setCustomDate] = useState(false);
  const [keluarDate, setKeluarDate] = useState('');
  // Selected extra facilities (ids) — adds price_adjust per period.
  const [selFas, setSelFas] = useState<Set<string>>(new Set());
  // Anchors for the room-list up/down scroll buttons (step 2).
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Scroll the sheet back to the top whenever the step changes.
  const headRef = useRef<HTMLDivElement>(null);
  // Confirm dialog when booking a room that's already occupied.
  const [warnOccupied, setWarnOccupied] = useState(false);

  const [step, setStep] = useState<number | 'sukses'>(1);
  const [nama, setNama] = useState('');
  const [hp, setHp] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lama, setLama] = useState(1);
  const [masuk, setMasuk] = useState(TODAY());
  const [bayar, setBayar] = useState<PayStatus>('Lunas');
  const [dp, setDp] = useState('');
  const [bukti, setBukti] = useState<BuktiFile[]>([]);

  // Step-2 room filters (UI only — never affects submit payload).
  const [fLayanan, setFLayanan] = useState<'Semua' | 'Kos' | 'Penginapan'>('Semua');
  const [fCari, setFCari] = useState('');
  const [fGedung, setFGedung] = useState('Semua');
  const [fLantai, setFLantai] = useState<'Semua' | number>('Semua');

  // Reset / prefill whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (editBooking) {
      setNama(editBooking.Nama_Customer || '');
      setHp(String(editBooking.WhatsApp || ''));
      setRoomId(editBooking.RoomID || '');
      setLama(editBooking.Jumlah_Periode || 1);
      setPaketKind(classifyPaket(editBooking.Paket || '') || 'bulanan');
      setMasuk(
        editBooking.CheckIn ? new Date(editBooking.CheckIn).toISOString().split('T')[0] : TODAY(),
      );
      setCustomDate(false);
      setKeluarDate(
        editBooking.CheckOut ? new Date(editBooking.CheckOut).toISOString().split('T')[0] : '',
      );
      const ps = mapPayStatus(editBooking);
      setBayar(ps === 'Batal' ? 'Lunas' : ps);
      setDp(ps === 'DP' ? String(editBooking.Net_Diterima || 0) : '');
    } else {
      setNama('');
      setHp('');
      setRoomId('');
      setLama(1);
      setPaketKind('bulanan');
      setMasuk(TODAY());
      setCustomDate(false);
      setKeluarDate('');
      setBayar('Lunas');
      setDp('');
    }
    setSelFas(new Set(editBooking ? editFacilityIds || [] : []));
    setBukti([]);
    setFLayanan('Semua');
    setFCari('');
    setFGedung('Semua');
    setFLantai('Semua');
    setStep(1);
  }, [open, editBooking]);

  // Scroll the sheet to the top each time the step changes.
  useEffect(() => {
    if (!open) return;
    headRef.current?.scrollIntoView({ block: 'start' });
  }, [step, open]);

  const options = useMemo(
    () => buildRoomOptions(rooms, prices, editBooking?.RoomID, roomPriceRules),
    [rooms, prices, editBooking, roomPriceRules],
  );
  const chosen = options.find((o) => o.room.RoomID === roomId) || null;

  // Pakets this room actually has a price for (sorted Harian→Setahun).
  const availablePakets = useMemo<PaketKind[]>(() => {
    if (!chosen) return [];
    return (Object.keys(chosen.paketPrices) as PaketKind[]).sort(
      (a, b) => PAKET_META[a].order - PAKET_META[b].order,
    );
  }, [chosen]);

  // When the chosen room (or its pakets) changes, keep paketKind valid: prefer
  // the current pick if still available, else the room's primary paket.
  useEffect(() => {
    if (!chosen) return;
    if (!availablePakets.includes(paketKind)) {
      setPaketKind(chosen.primaryKind || availablePakets[0] || 'bulanan');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, availablePakets.join(',')]);

  // Distinct buildings & floors across the pickable rooms (for the pill filters).
  const gedungList = useMemo(() => {
    const set = new Set<string>();
    options.forEach((o) => {
      const g = (o.room.Gedung || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [options]);

  const lantaiList = useMemo(() => {
    const set = new Set<number>();
    options.forEach((o) => {
      const f = floorForRoom(o.room);
      if (f != null) set.add(f);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [options]);

  // Apply all step-2 filters together. UI-only: never touches the submit list.
  const filteredOptions = useMemo(() => {
    const cari = fCari.trim().toLowerCase();
    return options.filter((o) => {
      const r = o.room;
      // Jenis layanan: rooms whose value isn't Kos/Penginapan show under any.
      if (fLayanan !== 'Semua') {
        const lay = (r.Layanan_Default || '').trim().toLowerCase();
        const known = lay === 'kos' || lay === 'penginapan';
        if (known && lay !== fLayanan.toLowerCase()) return false;
      }
      // Gedung
      if (fGedung !== 'Semua' && (r.Gedung || '').trim() !== fGedung) return false;
      // Lantai
      if (fLantai !== 'Semua' && floorForRoom(r) !== fLantai) return false;
      // Cari: nama kamar OR gedung, case-insensitive substring.
      if (cari) {
        const hay = `${r.Nama_Kamar || ''} ${r.Gedung || ''}`.toLowerCase();
        if (!hay.includes(cari)) return false;
      }
      return true;
    });
  }, [options, fLayanan, fGedung, fLantai, fCari]);

  // Effective duration: from the custom date range, or the stepper.
  const customHari = customDate ? daysBetween(masuk, keluarDate) : 0;
  const lamaEff = customDate ? Math.max(0, customHari) : lama;

  // Unit label + stepper max for the active paket (custom mode always per day).
  const unit = customDate ? 'hari' : PAKET_META[paketKind].unitLong;
  const maxLama = customDate ? 365 : paketKind === 'harian' ? 90 : paketKind === 'mingguan' ? 52 : 24;

  // Tanggal keluar (untuk menghitung jumlah hari kalender ASLI): check-in +
  // count × paket (custom mode → +count hari).
  const keluar = customDate ? keluarDate : addPaket(masuk, paketKind, lama);
  const actualDays = Math.max(1, daysBetween(masuk, keluar) || lamaEff);

  // Room unit price for the active paket. Custom (per-day) mode uses the daily
  // price, deriving from the monthly one (/30) only when no daily price is set.
  const hargaSatuanRoom = customDate
    ? chosen?.paketPrices.harian ??
      (chosen?.paketPrices.bulanan ? Math.round(chosen.paketPrices.bulanan / 30) : 0)
    : chosen?.paketPrices[paketKind] || 0;

  // Biaya fasilitas — pakai satuan tiap fasilitas (per bulan / per hari),
  // dikonversi memakai jumlah hari kalender nyata (bukan 30 tetap).
  const activeFas = facilities.filter((f) => f.is_active);
  function facCost(f: Fasilitas): number {
    const rate = f.price_adjust || 0;
    const fUnit = f.satuan || 'per_bulan';
    if (fUnit === 'per_hari') return Math.round(rate * actualDays);
    // Jumlah bulan sewa (paket bulanan/6 bulan/setahun bila bukan custom).
    const totalBulan =
      !customDate && PAKET_META[paketKind].months >= 1 ? PAKET_META[paketKind].months * lamaEff : 0;
    if (fUnit === 'per_tahun') {
      // Per tahun → prorate: × (jumlah bulan ÷ 12), atau pakai hari nyata ÷ 365.
      if (totalBulan > 0) return Math.round((rate * totalBulan) / 12);
      return Math.round((rate / 365) * actualDays);
    }
    // per_bulan: × total bulan; sewa harian/mingguan/custom → prorate per hari.
    if (totalBulan > 0) return Math.round(rate * totalBulan);
    return Math.round((rate / daysInMonth(masuk)) * actualDays);
  }
  const fasTotal = activeFas.reduce((s, f) => (selFas.has(f.id) ? s + facCost(f) : s), 0);

  // Money math. Total selalu dihitung ulang = (harga kamar × jumlah paket) +
  // fasilitas. Di edit, harga kamar pakai nilai per-unit tersimpan booking.
  const hargaSatuan = hargaSatuanRoom;
  const hargaKamarEff = isEdit ? Number(editBooking!.Harga_Kamar) || hargaSatuan : hargaSatuan;
  const total = hargaKamarEff * lamaEff + fasTotal;
  const dibayar = bayar === 'Lunas' ? total : bayar === 'DP' ? Math.min(Number(dp || 0), total || Infinity) : 0;
  const sisa = Math.max(total - dibayar, 0);

  const bisaLanjut =
    step === 1
      ? nama.trim().length > 0
      : step === 2
      ? !!chosen
      : step === 3
      ? !!masuk && (customDate ? customHari >= 1 : lama >= 1)
      : // Step 4: DP only needs a positive amount (sisa is computed). Lunas/Belum
        // Bayar always valid.
        bayar !== 'DP' || Number(dp) > 0;

  // Booking an occupied / attention room is allowed, but warn first.
  const roomOccupied = !!chosen && chosen.room.Status_Code !== 'READY';

  function handleSave() {
    if (!bisaLanjut || saveMutation.isPending) return;
    if (roomOccupied && !isEdit) {
      setWarnOccupied(true);
      return;
    }
    saveMutation.mutate();
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && editBooking) {
        return api.submitBookingEdit({
          bookingId: editBooking.BookingID,
          customerName: nama.trim(),
          whatsapp: hp,
          checkIn: masuk,
          checkOut: keluar,
          hargaKamar: editBooking.Harga_Kamar,
          extraCharge: editBooking.Extra_Charge,
          diskon: editBooking.Diskon,
          hargaTotal: total,
          catatan: editBooking.Catatan,
          extraRequest: editBooking.Extra_Request,
          isEkstra: editBooking.Is_Ekstra === 'YA',
          fasilitasIds: Array.from(selFas),
        });
      }
      if (!chosen) throw new Error('Kamar belum dipilih');
      return api.submitBooking({
        roomId: chosen.room.RoomID,
        customerName: nama.trim(),
        whatsapp: hp,
        checkIn: masuk,
        checkOut: keluar,
        paket: PAKET_BACKEND[customDate ? 'harian' : paketKind],
        jumlahPeriode: lamaEff,
        hargaKamar: hargaSatuan,
        hargaTotal: total,
        dpAwal: dibayar,
        fasilitasIds: Array.from(selFas),
        buktiFiles: bukti,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions'] });
      qc.invalidateQueries({ queryKey: ['report-data'] });
      if (editBooking) {
        qc.invalidateQueries({ queryKey: ['booking-detail', editBooking.BookingID] });
      }
      setStep('sukses');
    },
    onError: (e) => toast.error('Gagal menyimpan: ' + (e as Error).message),
  });

  const judul = isEdit ? 'Ubah Booking' : 'Booking Baru';

  // ----- Success state -----
  if (step === 'sukses') {
    return (
      <Sheet open={open} onClose={onClose}>
        <div className="px-6 pt-7 pb-8 text-center">
          <div className="w-[84px] h-[84px] rounded-full bg-kk-mint-soft border-[3px] border-kk-mint grid place-items-center mx-auto mb-5 text-kk-green">
            <KkIcon name="cek" size={46} strokeWidth={2.4} />
          </div>
          <h2 className="font-heading font-black text-page text-kk-navy m-0 mb-2">
            {isEdit ? 'Perubahan Tersimpan!' : 'Booking Tersimpan!'}
          </h2>
          <p className="text-body text-kk-ink mt-0 mb-6">
            Booking untuk <b className="text-kk-navy">{nama}</b> berhasil dicatat.
          </p>
          <KkCard tone="mauve" className="text-left mb-6">
            <InfoRow label="Penyewa" value={nama} />
            <InfoRow label="Kamar" value={chosen ? chosen.room.Nama_Kamar : '—'} />
            <InfoRow
              label="Periode"
              value={`${tglPendek(masuk)} – ${keluar ? tglPendek(keluar) : '—'}`}
            />
            <InfoRow label="Total sewa" value={rupiah(total)} />
            <InfoRow
              label="Status"
              value={bayar}
              accent={bayar === 'Lunas' ? 'green' : bayar === 'Belum Bayar' ? 'orange' : 'navy'}
            />
          </KkCard>
          <KkButton variant="primary" size="lg" block onClick={onClose}>
            Selesai
          </KkButton>
        </div>
      </Sheet>
    );
  }

  const curStep = step as number;

  return (
    <>
      {/* Floating up/down scroll buttons — only on step 2 (banyak kamar). */}
      {open && curStep === 2 && (
        <div className="fixed z-[80] right-5 bottom-6 flex flex-col gap-2.5">
          <button
            onClick={() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            aria-label="Ke atas"
            className="w-[52px] h-[52px] rounded-full bg-kk-navy text-white shadow-[0_8px_22px_rgba(12,44,71,.45)] grid place-items-center active:translate-y-0.5"
          >
            <KkIcon name="panahAtas" size={26} strokeWidth={2.4} />
          </button>
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
            aria-label="Ke bawah"
            className="w-[52px] h-[52px] rounded-full bg-kk-orange text-white shadow-[0_8px_22px_rgba(143,60,32,.5)] grid place-items-center active:translate-y-0.5"
          >
            <KkIcon name="panahAtas" size={26} strokeWidth={2.4} className="rotate-180" />
          </button>
        </div>
      )}
      <Sheet open={open} onClose={onClose}>
        <SheetHead title={judul} onClose={onClose} />
      <div className="px-6 pb-8 pt-2">
        <div ref={headRef} />
        <StepHead step={curStep} />

        {/* LANGKAH 1 — DATA PENYEWA */}
        {curStep === 1 && (
          <div>
            <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-5">
              1. Siapa penyewanya?
            </h3>
            <BookingField
              label="Nama Lengkap Penyewa"
              contoh="Contoh: Pak Budi Santoso"
              hint="Tulis nama lengkap supaya mudah dikenali."
            >
              <input
                autoFocus
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Tulis nama di sini…"
                className="kk-input"
              />
            </BookingField>
            <BookingField
              label="Nomor HP / WhatsApp"
              contoh="Contoh: 0812 3456 7890 atau 62812 3456 7890"
              hint="Untuk fitur Tagih lewat WhatsApp. Boleh ketik 0812… — otomatis diubah ke format 62. (boleh dikosongkan)"
            >
              <input
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="Tulis nomor HP…"
                inputMode="tel"
                className="kk-input"
              />
              {hp.trim() && (
                <div className="mt-2 text-caption text-kk-ink">
                  Disimpan sebagai:{' '}
                  <b className="text-kk-navy tabular-nums">+{waPhone(hp)}</b>{' '}
                  <span className="text-kk-green">(siap untuk WhatsApp)</span>
                </div>
              )}
            </BookingField>
          </div>
        )}

        {/* LANGKAH 2 — PILIH KAMAR */}
        {curStep === 2 && (
          <div>
            <div ref={topRef} />
            <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-5">
              2. Pilih kamar
            </h3>

            <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">
              Daftar kamar
            </div>

            {/* ── Pencarian & filter kamar (UI saja, tidak mengubah data) ── */}
            {options.length > 0 && (
              <div className="mb-4">
                {/* Jenis layanan */}
                <div className="text-caption font-semibold text-kk-ink mb-1.5">Jenis layanan</div>
                <div className="flex gap-2 mb-3">
                  {(['Semua', 'Kos', 'Penginapan'] as const).map((v) => {
                    const active = fLayanan === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFLayanan(v)}
                        className={`flex-1 min-h-[48px] rounded-kk-pill font-body font-semibold text-caption border-2 ${
                          active
                            ? 'border-kk-navy bg-kk-navy text-white'
                            : 'border-kk-mauve bg-white text-kk-navy'
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>

                {/* Cari kamar / gedung */}
                <div className="relative mb-3">
                  <input
                    value={fCari}
                    onChange={(e) => setFCari(e.target.value)}
                    placeholder="Cari kamar atau gedung… (contoh: A1)"
                    className="kk-input text-body pr-12"
                  />
                  {fCari && (
                    <button
                      type="button"
                      onClick={() => setFCari('')}
                      aria-label="Hapus pencarian"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-kk-ink grid place-items-center"
                    >
                      <KkIcon name="silang" size={18} strokeWidth={2.4} />
                    </button>
                  )}
                </div>

                {/* Filter gedung */}
                {gedungList.length > 1 && (
                  <div className="mb-3">
                    <div className="text-caption font-semibold text-kk-ink mb-1.5">Gedung</div>
                    <div className="flex flex-wrap gap-2">
                      {(['Semua', ...gedungList] as string[]).map((g) => {
                        const active = fGedung === g;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setFGedung(g)}
                            className={`min-h-[48px] px-4 rounded-kk-pill font-body font-semibold text-caption border-2 ${
                              active
                                ? 'border-kk-navy bg-kk-navy text-white'
                                : 'border-kk-mauve bg-white text-kk-navy'
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filter lantai */}
                {lantaiList.length > 1 && (
                  <div className="mb-3">
                    <div className="text-caption font-semibold text-kk-ink mb-1.5">Lantai</div>
                    <div className="flex flex-wrap gap-2">
                      {(['Semua', ...lantaiList] as ('Semua' | number)[]).map((l) => {
                        const active = fLantai === l;
                        return (
                          <button
                            key={String(l)}
                            type="button"
                            onClick={() => setFLantai(l)}
                            className={`min-h-[48px] px-4 rounded-kk-pill font-body font-semibold text-caption border-2 ${
                              active
                                ? 'border-kk-navy bg-kk-navy text-white'
                                : 'border-kk-mauve bg-white text-kk-navy'
                            }`}
                          >
                            {l === 'Semua' ? 'Semua' : `Lantai ${l}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Jumlah hasil */}
                <div className="text-caption text-kk-ink">
                  Menampilkan {filteredOptions.length} kamar
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 mb-6">
              {options.length === 0 && (
                <KkCard className="text-body text-kk-ink">Belum ada kamar. Tambahkan kamar dulu di menu Kamar.</KkCard>
              )}
              {options.length > 0 && filteredOptions.length === 0 && (
                <KkCard className="text-body text-kk-ink">
                  Tidak ada kamar yang cocok dengan pencarian atau filter.
                </KkCard>
              )}
              {filteredOptions.map((o) => {
                const sel = chosen?.room.RoomID === o.room.RoomID;
                const st = mapRoomStatus(o.room);
                const border = sel
                  ? 'border-kk-navy bg-kk-mint-soft'
                  : st === 'Perlu Perhatian'
                  ? 'border-kk-orange bg-white'
                  : st === 'Terisi'
                  ? 'border-kk-green bg-white'
                  : 'border-kk-mauve bg-white';
                return (
                  <button
                    key={o.room.RoomID}
                    onClick={() => setRoomId(o.room.RoomID)}
                    className={`text-left p-[18px] rounded-kk-card border-2 flex justify-between items-center gap-3 ${border}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-heading font-bold text-[20px] text-kk-navy">
                          {o.room.Nama_Kamar}
                        </span>
                        <RoomStatusBadge room={o.room} />
                      </div>
                      <div className="text-caption text-kk-ink">
                        {o.room.Gedung} ·{' '}
                        {o.harga > 0 && o.primaryKind
                          ? `${rupiah(o.harga)}/${PAKET_META[o.primaryKind].unitLong}`
                          : 'harga belum diatur'}
                      </div>
                    </div>
                    {sel && (
                      <span className="w-8 h-8 rounded-full flex-shrink-0 bg-kk-green text-white grid place-items-center">
                        <KkIcon name="cek" size={19} strokeWidth={2.6} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div ref={bottomRef} />
          </div>
        )}

        {/* LANGKAH 3 — LAMA SEWA */}
        {curStep === 3 && (
          <div>
            <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-5">
              3. Berapa lama menyewa?
            </h3>

            {/* Kamar yang dipilih — dibawa dari langkah sebelumnya */}
            {chosen && (
              <div className="bg-kk-mauve-soft border-2 border-kk-mauve rounded-kk-card p-4 mb-5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-[12px] bg-white text-kk-navy grid place-items-center flex-shrink-0">
                  <KkIcon name="kamar" size={24} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <div className="text-caption text-kk-ink">Kamar dipilih</div>
                  <div className="font-heading font-bold text-[19px] text-kk-navy truncate">
                    {chosen.room.Nama_Kamar} · {chosen.room.Gedung}
                  </div>
                </div>
                <RoomStatusBadge room={chosen.room} className="ml-auto flex-shrink-0" />
              </div>
            )}

            {/* Mode: pilihan cepat (per bulan/hari) atau atur tanggal sendiri */}
            <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">Lama sewa</div>
            <div className="flex gap-2.5 mb-5">
              <button
                onClick={() => setCustomDate(false)}
                className={`flex-1 min-h-[52px] rounded-kk-pill font-body font-semibold text-body border-2 ${
                  !customDate ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy'
                }`}
              >
                Pilihan cepat
              </button>
              <button
                onClick={() => {
                  setCustomDate(true);
                  if (!keluarDate) setKeluarDate(addDays(masuk, 1));
                }}
                className={`flex-1 min-h-[52px] rounded-kk-pill font-body font-semibold text-body border-2 ${
                  customDate ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy'
                }`}
              >
                Atur tanggal
              </button>
            </div>

            {!customDate ? (
              <>
                {/* Paket harga — hanya yang sudah diatur untuk kamar ini, supaya
                    hitungan selalu pakai harga paket yang benar (tidak jomplang). */}
                {availablePakets.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 mb-4">
                    {availablePakets.map((k) => (
                      <button
                        key={k}
                        onClick={() => {
                          setPaketKind(k);
                          setLama(1);
                        }}
                        className={`min-h-[48px] px-4 rounded-kk-pill font-body font-semibold text-body border-2 ${
                          paketKind === k
                            ? 'border-kk-navy bg-kk-navy text-white'
                            : 'border-kk-mauve bg-white text-kk-navy'
                        }`}
                      >
                        {PAKET_META[k].label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-kk-orange-soft border-2 border-kk-orange rounded-kk-card p-3.5 mb-4 text-body text-kk-navy">
                    Harga kamar ini belum diatur. Set dulu di <b>Pengaturan → Harga</b> (Umum/Massal)
                    sesuai paket (harian / bulanan / …), lalu hitungannya otomatis benar.
                  </div>
                )}

                <div className="flex items-center gap-4 mb-3.5">
                  <button
                    onClick={() => setLama(Math.max(1, lama - 1))}
                    aria-label="Kurangi"
                    className="w-14 h-14 rounded-kk-card border-2 border-kk-navy bg-white text-kk-navy text-[30px] leading-none flex-shrink-0 grid place-items-center"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center font-heading font-black text-[26px] text-kk-navy">
                    {lama} {unit}
                  </div>
                  <button
                    onClick={() => setLama(Math.min(maxLama, lama + 1))}
                    aria-label="Tambah"
                    className="w-14 h-14 rounded-kk-card border-2 border-kk-navy bg-white text-kk-navy text-[30px] leading-none flex-shrink-0 grid place-items-center"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {(paketKind === 'harian'
                    ? [1, 3, 7, 14, 30]
                    : paketKind === 'mingguan'
                    ? [1, 2, 4, 8]
                    : paketKind === 'bulanan'
                    ? [1, 3, 6, 12]
                    : [1, 2, 3, 4]
                  ).map((m) => (
                    <button
                      key={m}
                      onClick={() => setLama(m)}
                      className={`flex-1 min-w-[56px] min-h-[48px] rounded-kk-pill font-body font-semibold text-caption border-2 ${
                        lama === m
                          ? 'border-kk-navy bg-kk-navy text-white'
                          : 'border-kk-mauve bg-white text-kk-navy'
                      }`}
                    >
                      {m} {PAKET_META[paketKind].unitShort}
                    </button>
                  ))}
                </div>

                <BookingField label="Tanggal Mulai Masuk" hint="Tanggal penyewa mulai menempati kamar.">
                  <input
                    type="date"
                    value={masuk}
                    onChange={(e) => setMasuk(e.target.value)}
                    className="kk-input"
                  />
                </BookingField>
              </>
            ) : (
              <>
                {/* Atur tanggal sendiri: dari–sampai, ditagih per hari */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <BookingField label="Dari tanggal">
                    <input
                      type="date"
                      value={masuk}
                      onChange={(e) => setMasuk(e.target.value)}
                      className="kk-input"
                    />
                  </BookingField>
                  <BookingField label="Sampai tanggal">
                    <input
                      type="date"
                      value={keluarDate}
                      min={masuk}
                      onChange={(e) => setKeluarDate(e.target.value)}
                      className="kk-input"
                    />
                  </BookingField>
                </div>
                {customHari >= 1 ? (
                  <div className="text-body text-kk-navy mb-6">
                    Lama menginap: <b>{customHari} hari</b> (dihitung per hari)
                  </div>
                ) : (
                  <div className="text-caption text-kk-orange font-semibold mb-6">
                    Pastikan tanggal &quot;sampai&quot; setelah tanggal &quot;dari&quot;.
                  </div>
                )}
              </>
            )}

            {/* Fasilitas tambahan (opsional) — harga otomatis ditambah ke total */}
            {activeFas.length > 0 && (
              <div className="mb-6">
                <div className="font-heading font-bold text-[18px] text-kk-navy mb-1">
                  Tambah fasilitas?
                </div>
                <p className="kk-help mb-3">Boleh dilewati. Harganya otomatis ditambah ke total sewa.</p>
                <div className="space-y-2.5">
                  {activeFas.map((f) => {
                    const on = selFas.has(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setSelFas((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.id)) next.delete(f.id);
                            else next.add(f.id);
                            return next;
                          })
                        }
                        className={`w-full text-left p-3.5 rounded-kk-card border-2 flex items-center gap-3 ${
                          on ? 'border-kk-navy bg-kk-mint-soft' : 'border-kk-mauve bg-white'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-md flex-shrink-0 border-2 grid place-items-center ${
                            on ? 'bg-kk-green border-kk-green text-white' : 'border-kk-mauve text-transparent'
                          }`}
                        >
                          <KkIcon name="cek" size={16} strokeWidth={2.8} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-heading font-bold text-[18px] text-kk-navy">{f.nama}</span>
                          <span className="text-caption text-kk-ink">
                            {rupiah(f.price_adjust)}/
                            {f.satuan === 'per_hari' ? 'hari' : f.satuan === 'per_tahun' ? 'tahun' : 'bulan'}
                            {on ? ` · total + ${rupiah(facCost(f))}` : ''}
                          </span>
                        </span>
                        <span className="font-heading font-bold text-[17px] text-kk-green whitespace-nowrap">
                          + {rupiah(facCost(f))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {chosen && (
              <div className="bg-kk-mint-soft border-2 border-kk-mint rounded-kk-card p-[18px]">
                <div className="text-caption text-kk-ink font-semibold mb-1.5">
                  Perhitungan otomatis
                </div>
                <div className="flex justify-between items-baseline text-body mb-1.5">
                  <span className="text-kk-navy">
                    Kamar {rupiah(hargaKamarEff)} × {lamaEff} {unit}
                  </span>
                  <span className="text-caption text-kk-ink">
                    sampai {keluar ? tglPendek(keluar) : '—'}
                  </span>
                </div>
                {fasTotal > 0 && (
                  <div className="flex justify-between items-baseline text-body mb-1.5">
                    <span className="text-kk-navy">Fasilitas tambahan</span>
                    <span className="text-caption font-semibold text-kk-green">+ {rupiah(fasTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline border-t-2 border-dashed border-kk-mint pt-2.5 mt-1.5">
                  <span className="font-heading font-bold text-[19px] text-kk-navy">Total Sewa</span>
                  <span className="font-heading font-black text-[26px] text-kk-navy">
                    {rupiah(total)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LANGKAH 4 — PEMBAYARAN */}
        {curStep === 4 && (
          <div>
            <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-5">
              4. Bagaimana pembayarannya?
            </h3>

            <div className="bg-kk-navy rounded-kk-card px-5 py-[18px] mb-5 text-white">
              <div className="text-caption font-semibold text-kk-mint">Total yang harus dibayar</div>
              <div className="font-heading font-black text-[34px] mt-1 tracking-tight">
                {rupiah(total)}
              </div>
            </div>

            {isEdit && (
              <div className="bg-kk-orange-soft border-2 border-kk-orange rounded-kk-card p-4 mb-5 flex items-start gap-3">
                <KkIcon name="info" size={24} className="text-kk-orange flex-shrink-0 mt-0.5" />
                <p className="text-body text-kk-navy m-0 leading-snug">
                  Mengubah status di sini <b>tidak mencatat uang masuk</b>. Untuk mencatat pembayaran,
                  tutup lalu tekan <b>&quot;Catat Pembayaran&quot;</b> di detail booking.
                </p>
              </div>
            )}

            <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">
              Status pembayaran
            </div>
            <div className="flex flex-col gap-3 mb-4">
              {(
                [
                  { s: 'Lunas', d: 'Penyewa membayar penuh sekarang' },
                  { s: 'DP', d: 'Membayar sebagian dulu (uang muka)' },
                  { s: 'Belum Bayar', d: 'Belum membayar, ditagih nanti' },
                ] as { s: PayStatus; d: string }[]
              ).map((o) => {
                const sel = bayar === o.s;
                return (
                  <button
                    key={o.s}
                    onClick={() => setBayar(o.s)}
                    className={`text-left p-4 rounded-kk-card border-2 flex justify-between items-center gap-3 ${
                      sel ? 'border-kk-navy bg-kk-mint-soft' : 'border-kk-mauve bg-white'
                    }`}
                  >
                    <div>
                      <div className="mb-1">
                        <BayarBadge status={o.s} big />
                      </div>
                      <div className="text-caption text-kk-ink">{o.d}</div>
                    </div>
                    {sel && (
                      <span className="w-[30px] h-[30px] rounded-full flex-shrink-0 bg-kk-green text-white grid place-items-center">
                        <KkIcon name="cek" size={18} strokeWidth={2.6} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {bayar === 'DP' && (
              <BookingField
                label="Jumlah dibayar sekarang (DP)"
                contoh={'Maksimal ' + rupiah(total)}
                hint="Sisanya akan ditagih kemudian."
              >
                <MoneyInput
                  value={dp}
                  onChange={(n) => setDp(n ? String(n) : '')}
                  placeholder="Contoh: 400.000"
                />
              </BookingField>
            )}

            <FileUpload value={bukti} onChange={setBukti} label="Bukti booking / pembayaran" />

            <KkCard tone="mauve">
              <InfoRow label="Penyewa" value={nama || '—'} />
              <InfoRow label="Kamar" value={chosen ? chosen.room.Nama_Kamar : '—'} />
              <InfoRow
                label="Periode"
                value={`${tglPendek(masuk)} – ${keluar ? tglPendek(keluar) : '—'}`}
              />
              <InfoRow label="Total sewa" value={rupiah(total)} />
              <InfoRow label="Dibayar sekarang" value={rupiah(dibayar)} accent="green" />
              {sisa > 0 && <InfoRow label="Sisa tagihan" value={rupiah(sisa)} accent="orange" />}
            </KkCard>
          </div>
        )}

        {/* Navigasi */}
        <div className="flex gap-3 mt-6">
          {curStep > 1 && (
            <KkButton
              variant="secondary"
              className="flex-1"
              onClick={() => setStep(curStep - 1)}
              disabled={saveMutation.isPending}
            >
              Kembali
            </KkButton>
          )}
          {curStep < 4 && (
            <KkButton
              variant="primary"
              size="lg"
              className="flex-[2]"
              disabled={!bisaLanjut}
              onClick={() => bisaLanjut && setStep(curStep + 1)}
            >
              Lanjut
            </KkButton>
          )}
          {curStep === 4 && (
            <KkButton
              variant="success"
              size="lg"
              className="flex-[2]"
              disabled={!bisaLanjut || saveMutation.isPending}
              onClick={handleSave}
            >
              <KkIcon name="cek" size={22} strokeWidth={2.4} />{' '}
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Booking'}
            </KkButton>
          )}
        </div>
      </div>
      </Sheet>

      {/* Konfirmasi kalau kamar yang dipilih sudah terisi */}
      <Dialog open={warnOccupied}>
        <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
          <KkIcon name="info" size={30} />
        </div>
        <h3 className="font-heading font-bold text-subhead text-center m-0 mb-2">
          Kamar ini sudah terisi
        </h3>
        <p className="text-body text-kk-ink text-center mt-0 mb-6 leading-snug">
          Kamar <b className="text-kk-navy">{chosen?.room.Nama_Kamar}</b> statusnya{' '}
          <b className="text-kk-navy">
            {chosen ? (mapRoomStatus(chosen.room) === 'Terisi' ? 'Terisi' : 'Perlu Perhatian') : ''}
          </b>
          . Yakin tetap mau membuat booking di kamar ini?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <KkButton variant="secondary" onClick={() => setWarnOccupied(false)} disabled={saveMutation.isPending}>
            Tidak Jadi
          </KkButton>
          <KkButton
            variant="primary"
            onClick={() => {
              setWarnOccupied(false);
              saveMutation.mutate();
            }}
            disabled={saveMutation.isPending}
          >
            Ya, Lanjut
          </KkButton>
        </div>
      </Dialog>
    </>
  );
}

// ═════════════════════════ DETAIL BOOKING ═════════════════════════
export function BookingDetail({
  booking,
  payments = [],
  onClose,
  onPay,
  onEdit,
  onCancel,
  onRefund,
  onTagih,
  onDelete,
  onDeletePayment,
  deletingPaymentId,
}: {
  booking: BookingFullData;
  payments?: PaymentRecord[];
  onClose: () => void;
  onPay: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onRefund?: () => void;
  onTagih?: () => void;
  onDelete: () => void;
  onDeletePayment?: (paymentId: string) => void;
  deletingPaymentId?: string | null;
}) {
  const status = mapPayStatus(booking);
  const batal = status === 'Batal';
  const sisa = booking.Sisa_Bayar ?? 0;
  const dibayar = booking.Net_Diterima ?? 0;

  return (
    <Sheet open onClose={onClose}>
      <div className="px-6 pt-5 pb-8">
        <div className="flex justify-between items-start gap-3 mb-5">
          <div className="min-w-0">
            <h2 className="font-heading font-black text-[27px] text-kk-navy m-0">
              {booking.Nama_Customer || '(tanpa nama)'}
            </h2>
            <div className="text-body text-kk-ink mt-1">
              {booking.Nama_Kamar} · {booking.Gedung}
            </div>
          </div>
          <BayarBadge status={status} big />
        </div>

        <KkCard className="mb-5">
          {booking.WhatsApp && <InfoRow label="Nomor HP" value={booking.WhatsApp} />}
          <InfoRow label="Tanggal masuk" value={tglPanjang(booking.CheckIn)} />
          <InfoRow label="Tanggal keluar" value={tglPanjang(booking.CheckOut)} />
          <InfoRow label="Total sewa" value={rupiah(booking.Harga_Total_Net)} />
          <InfoRow label="Sudah dibayar" value={rupiah(dibayar)} accent="green" />
          {sisa > 0 && !batal && (
            <InfoRow label="Sisa tagihan" value={rupiah(sisa)} accent="orange" />
          )}
        </KkCard>

        {/* Riwayat pembayaran — bisa dihapus untuk koreksi status (mis. Lunas → ada sisa) */}
        {payments.length > 0 && (
          <div className="mb-5">
            <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">
              Riwayat Pembayaran
            </div>
            <div className="space-y-2.5">
              {payments.map((p) => (
                <div
                  key={p.PaymentID}
                  className="flex items-center gap-3 bg-white border-2 border-kk-mauve rounded-kk-card p-3.5"
                >
                  <div className="w-10 h-10 rounded-[11px] bg-kk-mint-soft text-kk-green grid place-items-center flex-shrink-0">
                    <KkIcon name="pembayaran" size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-[18px] text-kk-green">
                      + {rupiah(p.Nominal)}
                    </div>
                    <div className="text-caption text-kk-ink truncate">
                      {(p.Jenis_Bayar || 'Pembayaran') + ' · ' + tglPanjang(p.Tanggal_Bayar)}
                    </div>
                  </div>
                  {onDeletePayment && (
                    <button
                      onClick={() => onDeletePayment(p.PaymentID)}
                      disabled={!!deletingPaymentId}
                      aria-label="Hapus pembayaran ini"
                      className="w-11 h-11 flex-shrink-0 rounded-[11px] border-2 border-kk-mauve bg-white text-kk-ink grid place-items-center disabled:opacity-40 hover:text-kk-orange hover:border-kk-orange"
                    >
                      <KkIcon name="hapus" size={20} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="kk-help mt-2">
              Hapus pembayaran untuk mengoreksi status (mis. dari Lunas kembali ada sisa). Daftar
              booking & kwitansi ikut terupdate otomatis.
            </p>
          </div>
        )}

        {batal ? (
          <div>
            <KkCard tone="mauve" className="flex gap-3 items-center mb-5">
              <span className="text-kk-ink flex-shrink-0">
                <KkIcon name="refund" size={24} />
              </span>
              <span className="text-body text-kk-navy">
                Booking ini sudah dibatalkan. Kamar sudah kembali tersedia.
              </span>
            </KkCard>
            <KkButton variant="ghost" block onClick={onDelete}>
              <KkIcon name="hapus" size={20} strokeWidth={2.2} /> Hapus dari Daftar
            </KkButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sisa > 0 && (
              <>
                <KkButton variant="success" size="lg" block onClick={onPay}>
                  <KkIcon name="cek" size={22} strokeWidth={2.4} /> Catat Pembayaran
                </KkButton>
                {onTagih && (
                  <KkButton variant="primary" block onClick={onTagih}>
                    <KkIcon name="kirim" size={20} strokeWidth={2.2} /> Tagih lewat WhatsApp
                  </KkButton>
                )}
              </>
            )}
            <div className="flex gap-3">
              <KkButton variant="secondary" block onClick={onEdit}>
                Ubah Booking
              </KkButton>
              {dibayar > 0 && onRefund && (
                <KkButton variant="secondary" block onClick={onRefund}>
                  Refund
                </KkButton>
              )}
            </div>
            <KkButton variant="ghost" block onClick={onCancel}>
              <KkIcon name="refund" size={20} strokeWidth={2.2} /> Batalkan Booking
            </KkButton>
            <KkButton variant="ghost" block onClick={onDelete}>
              <KkIcon name="hapus" size={20} strokeWidth={2.2} /> Hapus Booking
            </KkButton>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ═════════════════════════ KONFIRMASI BATAL / REFUND ═════════════════════════
export function CancelConfirm({
  booking,
  loading,
  onClose,
  onConfirm,
}: {
  booking: BookingFullData;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dibayar = booking.Total_Bayar ?? 0;
  return (
    <Dialog open>
      <div className="w-14 h-14 rounded-kk-card bg-kk-mauve-soft grid place-items-center mb-4 text-kk-navy">
        <KkIcon name="refund" size={28} strokeWidth={2.2} />
      </div>
      <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-2.5">
        Batalkan booking {booking.Nama_Customer}?
      </h3>
      <p className="text-body text-kk-ink mt-0 mb-2 leading-snug">
        Tenang, ini tidak menghapus data. Kamar <b className="text-kk-navy">{booking.Nama_Kamar}</b>{' '}
        akan kembali tersedia untuk disewakan.
      </p>
      {dibayar > 0 && (
        <div className="bg-kk-mint-soft border-2 border-kk-mint rounded-kk-pill px-4 py-3 text-caption text-kk-navy mb-2">
          Penyewa sudah membayar <b>{rupiah(dibayar)}</b>. Uang ini bisa Anda kembalikan (refund)
          sebagai catatan.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <KkButton variant="secondary" onClick={onClose} disabled={loading}>
          Tidak Jadi
        </KkButton>
        <KkButton variant="primary" onClick={onConfirm} disabled={loading}>
          {loading ? 'Memproses…' : 'Ya, Batalkan'}
        </KkButton>
      </div>
    </Dialog>
  );
}

// ═════════════════════════ REFUND (SEBAGIAN / PENUH) ═════════════════════════
export function RefundForm({
  booking,
  loading,
  onClose,
  onConfirm,
}: {
  booking: BookingFullData;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (nominal: number, metode: string, alasan: string) => void;
}) {
  const dibayar = Number(booking.Net_Diterima ?? booking.Total_Bayar ?? 0);
  const [nominal, setNominal] = useState(String(dibayar));
  const [metode, setMetode] = useState('CASH');
  const [alasan, setAlasan] = useState('');
  const n = Number(nominal) || 0;
  const penuh = n >= dibayar && dibayar > 0;
  const valid = n > 0 && n <= dibayar;

  return (
    <Dialog open>
      <div className="w-14 h-14 rounded-kk-card bg-kk-mauve-soft grid place-items-center mb-4 text-kk-navy">
        <KkIcon name="refund" size={28} strokeWidth={2.2} />
      </div>
      <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-1.5">
        Refund ke {booking.Nama_Customer}
      </h3>
      <p className="text-body text-kk-ink mt-0 mb-4 leading-snug">
        Sudah dibayar <b className="text-kk-navy">{rupiah(dibayar)}</b>. Refund sebagian → booking
        tetap lanjut (jadi ada sisa lagi).
      </p>

      <BookingField label="Jumlah refund" contoh={'Maksimal ' + rupiah(dibayar)}>
        <MoneyInput value={nominal} onChange={(n) => setNominal(n ? String(n) : '')} />
      </BookingField>
      <div className="flex gap-2 mb-4 -mt-2">
        {[
          { l: 'Sebagian (½)', v: Math.floor(dibayar / 2) },
          { l: 'Semua', v: dibayar },
        ].map((q) => (
          <button
            key={q.l}
            type="button"
            onClick={() => setNominal(String(q.v))}
            className="flex-1 min-h-[44px] rounded-kk-pill border-2 border-kk-mauve bg-white text-kk-navy font-body font-semibold text-caption"
          >
            {q.l}
          </button>
        ))}
      </div>

      <BookingField label="Metode">
        <select value={metode} onChange={(e) => setMetode(e.target.value)} className="kk-input">
          <option value="CASH">Tunai (Cash)</option>
          <option value="TRANSFER">Transfer</option>
          <option value="LAINNYA">Lainnya</option>
        </select>
      </BookingField>
      <BookingField label="Alasan (opsional)">
        <input
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Mis. pindah kamar, kelebihan bayar…"
          className="kk-input"
        />
      </BookingField>

      {penuh && (
        <div className="bg-kk-orange-soft border-2 border-kk-orange rounded-kk-pill px-4 py-2.5 text-caption text-kk-navy mb-3">
          Ini refund <b>penuh</b>. Kalau memang mau membatalkan booking & mengosongkan kamar, pakai
          tombol <b>Batalkan Booking</b>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <KkButton variant="secondary" onClick={onClose} disabled={loading}>
          Batal
        </KkButton>
        <KkButton variant="primary" onClick={() => valid && onConfirm(n, metode, alasan)} disabled={!valid || loading}>
          {loading ? 'Memproses…' : 'Proses Refund'}
        </KkButton>
      </div>
    </Dialog>
  );
}

// ═════════════════════════ TAGIH LEWAT WHATSAPP ═════════════════════════
// Normalize an Indonesian phone to wa.me format (no "+", country code 62):
//   0812…  → 62812…   ·   812…  → 62812…   ·   620812… → 62812…   ·   +62… → 62…
function waPhone(raw: string | number | null | undefined): string {
  // Coerce first: Google Sheets often returns the phone as a NUMBER, and
  // calling .replace on a number throws (client-side exception on Tagih).
  let p = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!p) return '';
  if (p.startsWith('620')) p = '62' + p.slice(3); // "62" typed then a local "0…"
  else if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}

export function TagihWa({
  booking,
  businessName,
  onClose,
}: {
  booking: BookingFullData;
  businessName?: string;
  onClose: () => void;
}) {
  const nama = booking.Nama_Customer || 'Bapak/Ibu';
  const kamar = booking.Nama_Kamar || '';
  const periode = `${tglPanjang(booking.CheckIn)} – ${tglPanjang(booking.CheckOut)}`;
  const total = rupiah(booking.Harga_Total_Net);
  const dibayar = rupiah(booking.Net_Diterima ?? booking.Total_Bayar ?? 0);
  const sisa = rupiah(booking.Sisa_Bayar ?? 0);
  const biz = businessName ? ` di ${businessName}` : '';

  const templates = useMemo(
    () => [
      {
        id: 'sopan',
        label: 'Sopan',
        text:
          `Halo Bapak/Ibu ${nama},\n\nIni pengingat pembayaran sewa kamar ${kamar}${biz}.\n` +
          `Periode: ${periode}\nTotal sewa: ${total}\nSudah dibayar: ${dibayar}\n*Sisa tagihan: ${sisa}*\n\n` +
          `Mohon dapat diselesaikan ya. Terima kasih 🙏`,
      },
      {
        id: 'ramah',
        label: 'Ramah',
        text:
          `Halo Kak ${nama} 😊\n\nReminder ya untuk sisa pembayaran kamar ${kamar}${biz}:\n` +
          `*Sisa: ${sisa}* (dari total ${total}, sudah bayar ${dibayar}).\nPeriode ${periode}.\n\n` +
          `Ditunggu ya kak, makasih banyak 🙏`,
      },
      {
        id: 'singkat',
        label: 'Singkat',
        text: `Halo ${nama}, sisa tagihan sewa kamar ${kamar}${biz}: *${sisa}*. Mohon segera dibayar ya. Terima kasih.`,
      },
    ],
    [nama, kamar, biz, periode, total, dibayar, sisa],
  );

  const [pilih, setPilih] = useState(0);
  const [teks, setTeks] = useState(templates[0].text);

  function pickTemplate(i: number) {
    setPilih(i);
    setTeks(templates[i].text);
  }

  // Build the wa.me link reactively so the button is a real <a> (opens
  // reliably on tap — window.open was getting blocked / not opening WA).
  const phone = waPhone(booking.WhatsApp);
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(teks)}`
    : `https://wa.me/?text=${encodeURIComponent(teks)}`;

  return (
    <Sheet open onClose={onClose}>
      <SheetHead title="Tagih lewat WhatsApp" onClose={onClose} />
      <div className="px-6 pb-7">
        {!booking.WhatsApp ? (
          <div className="bg-kk-orange-soft border-2 border-kk-orange rounded-kk-card p-3.5 mb-4 text-body text-kk-navy">
            Nomor HP penyewa belum ada. WhatsApp tetap terbuka, tapi nomor tujuannya harus diisi manual.
            Tambahkan nomornya lewat <b>Ubah Booking</b> agar bisa langsung tertuju.
          </div>
        ) : (
          <div className="bg-kk-mint-soft border-2 border-kk-mint rounded-kk-card p-3.5 mb-4 text-body text-kk-navy">
            Akan dikirim ke <b className="tabular-nums">+{phone}</b>
          </div>
        )}

        <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">Pilih template</div>
        <div className="flex gap-2 mb-4">
          {templates.map((t, i) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(i)}
              className={`flex-1 min-h-[48px] rounded-kk-pill font-body font-semibold text-body border-2 ${
                pilih === i ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="font-heading font-bold text-[18px] text-kk-navy mb-2">Pesan (bisa diedit)</div>
        <textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          rows={8}
          className="kk-input mb-4 resize-y leading-snug"
        />

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onClose()}
          className="kk-btn kk-btn-success kk-btn-lg w-full flex items-center justify-center gap-2 no-underline"
        >
          <KkIcon name="kirim" size={22} strokeWidth={2.2} /> Buka WhatsApp
        </a>
      </div>
    </Sheet>
  );
}
