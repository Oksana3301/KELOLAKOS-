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
  type BookingFullData,
  type BuktiFile,
} from '@/lib/api';
import { Sheet, SheetHead, KkButton, KkCard, BayarBadge, InfoRow, Dialog } from './ui';
import { FileUpload } from './file-upload';
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

export type Satuan = 'Bulanan' | 'Harian';

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
  harga: number;
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
  satuan: Satuan,
  currentRoomId?: string,
): RoomOption[] {
  function rowsFor(r: RoomStatus): PriceItem[] {
    return prices.filter(
      (p) => p.Layanan === r.Layanan_Default && p.Gedung === r.Gedung && p.Tipe_Kamar === r.Tipe_Kamar,
    );
  }
  function monthlyPrice(r: RoomStatus): number {
    const rows = rowsFor(r);
    const m = rows.find((p) => /BULAN/i.test(p.Paket));
    return (m || rows[0])?.Harga_Satuan || 0;
  }
  function dailyPrice(r: RoomStatus): number {
    const rows = rowsFor(r);
    const d = rows.find((p) => /HARI/i.test(p.Paket));
    if (d) return d.Harga_Satuan;
    const monthly = monthlyPrice(r);
    return monthly ? Math.round(monthly / 30) : 0;
  }
  function priceFor(r: RoomStatus): number {
    return satuan === 'Harian' ? dailyPrice(r) : monthlyPrice(r);
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
  return sorted.map((r) => ({ room: r, harga: priceFor(r) }));
}

// ═════════════════════════ TAMBAH / UBAH BOOKING FLOW ═════════════════════════
export function BookingFlow({
  open,
  onClose,
  rooms,
  prices,
  editBooking,
}: {
  open: boolean;
  onClose: () => void;
  rooms: RoomStatus[];
  prices: PriceItem[];
  editBooking?: BookingFullData | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!editBooking;
  const [satuan, setSatuan] = useState<Satuan>('Bulanan');
  // "Atur tanggal sendiri" mode: pick check-in/check-out, bill per day.
  const [customDate, setCustomDate] = useState(false);
  const [keluarDate, setKeluarDate] = useState('');
  // Anchors for the room-list up/down scroll buttons (step 2).
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Scroll the sheet back to the top whenever the step changes.
  const headRef = useRef<HTMLDivElement>(null);
  // Confirm dialog when booking a room that's already occupied.
  const [warnOccupied, setWarnOccupied] = useState(false);
  // When picking custom dates we always bill per day.
  const effSatuan: Satuan = customDate ? 'Harian' : satuan;
  const unit = effSatuan === 'Harian' ? 'hari' : 'bulan';
  const maxLama = satuan === 'Harian' ? 90 : 24;

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
      setHp(editBooking.WhatsApp || '');
      setRoomId(editBooking.RoomID || '');
      setLama(editBooking.Jumlah_Periode || 1);
      setSatuan(/HARI/i.test(editBooking.Paket || '') ? 'Harian' : 'Bulanan');
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
      setSatuan('Bulanan');
      setMasuk(TODAY());
      setCustomDate(false);
      setKeluarDate('');
      setBayar('Lunas');
      setDp('');
    }
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
    () => buildRoomOptions(rooms, prices, effSatuan, editBooking?.RoomID),
    [rooms, prices, effSatuan, editBooking],
  );
  const chosen = options.find((o) => o.room.RoomID === roomId) || null;

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

  // Money math. In edit mode the existing total is authoritative for display.
  const hargaSatuan = chosen?.harga || 0;
  const total = isEdit
    ? editBooking!.Harga_Total_Net || hargaSatuan * lamaEff
    : hargaSatuan * lamaEff;
  const dibayar = bayar === 'Lunas' ? total : bayar === 'DP' ? Math.min(Number(dp || 0), total || Infinity) : 0;
  const sisa = Math.max(total - dibayar, 0);
  const keluar = customDate
    ? keluarDate
    : effSatuan === 'Harian'
    ? addDays(masuk, lama)
    : addMonths(masuk, lama);

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
        });
      }
      if (!chosen) throw new Error('Kamar belum dipilih');
      return api.submitBooking({
        roomId: chosen.room.RoomID,
        customerName: nama.trim(),
        whatsapp: hp,
        checkIn: masuk,
        checkOut: keluar,
        paket: effSatuan,
        jumlahPeriode: lamaEff,
        hargaKamar: hargaSatuan,
        dpAwal: dibayar,
        buktiFiles: bukti,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initial-data'] });
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
              contoh="Contoh: 0812 3456 7890"
              hint="Dipakai untuk mengirim kwitansi & pengingat bayar (boleh dikosongkan)."
            >
              <input
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="Tulis nomor HP…"
                inputMode="tel"
                className="kk-input"
              />
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
                        {o.room.Gedung} · {o.harga > 0 ? `${rupiah(o.harga)}/${unit}` : 'harga belum diatur'}
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
                {/* Per bulan (kos) atau per hari (penginapan) */}
                <div className="flex gap-2.5 mb-4">
                  {(['Bulanan', 'Harian'] as Satuan[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSatuan(s);
                        setLama(1);
                      }}
                      className={`flex-1 min-h-[48px] rounded-kk-pill font-body font-semibold text-body border-2 ${
                        satuan === s
                          ? 'border-kk-navy bg-kk-navy text-white'
                          : 'border-kk-mauve bg-white text-kk-navy'
                      }`}
                    >
                      {s === 'Bulanan' ? 'Per Bulan' : 'Per Hari'}
                    </button>
                  ))}
                </div>

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
                <div className="flex gap-2 mb-6">
                  {(satuan === 'Harian' ? [1, 3, 7, 14, 30] : [1, 3, 6, 12]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setLama(m)}
                      className={`flex-1 min-h-[48px] rounded-kk-pill font-body font-semibold text-caption border-2 ${
                        lama === m
                          ? 'border-kk-navy bg-kk-navy text-white'
                          : 'border-kk-mauve bg-white text-kk-navy'
                      }`}
                    >
                      {m} {satuan === 'Harian' ? 'hr' : 'bln'}
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

            {chosen && (
              <div className="bg-kk-mint-soft border-2 border-kk-mint rounded-kk-card p-[18px]">
                <div className="text-caption text-kk-ink font-semibold mb-1.5">
                  Perhitungan otomatis
                </div>
                <div className="flex justify-between items-baseline text-body mb-1.5">
                  <span className="text-kk-navy">
                    {rupiah(hargaSatuan)} × {lamaEff} {unit}
                  </span>
                  <span className="text-caption text-kk-ink">
                    sampai {keluar ? tglPendek(keluar) : '—'}
                  </span>
                </div>
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
                <input
                  value={dp}
                  onChange={(e) => setDp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 400000"
                  inputMode="numeric"
                  className="kk-input"
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
  onClose,
  onPay,
  onEdit,
  onCancel,
  onDelete,
}: {
  booking: BookingFullData;
  onClose: () => void;
  onPay: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
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
              <KkButton variant="success" size="lg" block onClick={onPay}>
                <KkIcon name="cek" size={22} strokeWidth={2.4} /> Catat Pembayaran
              </KkButton>
            )}
            <div className="flex gap-3">
              <KkButton variant="secondary" block onClick={onEdit}>
                Ubah Booking
              </KkButton>
              <KkButton variant="secondary" block onClick={onCancel}>
                Batal / Refund
              </KkButton>
            </div>
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
