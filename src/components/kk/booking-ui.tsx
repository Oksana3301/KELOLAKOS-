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
import { ScrollFab } from './scroll-fab';
import { KkIcon } from './icons';
import { rupiah, tglPanjang, tglPendek, mapPayStatus, type PayStatus } from './status';

const TODAY = () => new Date().toISOString().split('T')[0];

function addMonths(iso: string, n: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(n || 0));
  return d.toISOString().split('T')[0];
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
    { n: 3, l: 'Pembayaran' },
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
            {i < 2 && (
              <div
                className={`flex-1 h-[3px] rounded-full min-w-[10px] ${
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

// Derive a floor number from the room's tipe/catatan ("Lantai 2" → 2).
// Mirrors the logic on the Kelola Kamar page (src/app/kamar/page.tsx).
function floorForRoom(room: RoomStatus): number | null {
  const src = `${room.Tipe_Kamar} ${room.Catatan}`;
  const m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
  return m ? Number(m[1]) : null;
}

/** Build the list of pickable rooms (available + the current one when editing). */
export function buildRoomOptions(
  rooms: RoomStatus[],
  prices: PriceItem[],
  paket: string,
  currentRoomId?: string,
): RoomOption[] {
  function priceFor(r: RoomStatus): number {
    const match = prices.find(
      (p) =>
        p.Layanan === r.Layanan_Default &&
        p.Gedung === r.Gedung &&
        p.Tipe_Kamar === r.Tipe_Kamar &&
        p.Paket === paket,
    );
    return match?.Harga_Satuan || 0;
  }
  const available = rooms.filter((r) => r.Status_Code === 'READY');
  if (currentRoomId && !available.some((r) => r.RoomID === currentRoomId)) {
    const cur = rooms.find((r) => r.RoomID === currentRoomId);
    if (cur) available.unshift(cur);
  }
  return available.map((r) => ({ room: r, harga: priceFor(r) }));
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
  const PAKET = 'Bulanan';

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

  // Scroll container for the floating scroll button: the bottom-sheet body
  // (closest scrollable ancestor of the step-2 list). Resolved from a ref.
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  // Reset / prefill whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (editBooking) {
      setNama(editBooking.Nama_Customer || '');
      setHp(editBooking.WhatsApp || '');
      setRoomId(editBooking.RoomID || '');
      setLama(editBooking.Jumlah_Periode || 1);
      setMasuk(
        editBooking.CheckIn ? new Date(editBooking.CheckIn).toISOString().split('T')[0] : TODAY(),
      );
      const ps = mapPayStatus(editBooking);
      setBayar(ps === 'Batal' ? 'Lunas' : ps);
      setDp(ps === 'DP' ? String(editBooking.Net_Diterima || 0) : '');
    } else {
      setNama('');
      setHp('');
      setRoomId('');
      setLama(1);
      setMasuk(TODAY());
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

  const options = useMemo(
    () => buildRoomOptions(rooms, prices, PAKET, editBooking?.RoomID),
    [rooms, prices, editBooking],
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

  // Resolve the scroll container (the bottom-sheet body) for the floating button.
  useEffect(() => {
    if (step !== 2) return;
    let el: HTMLElement | null = listRef.current;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) break;
      el = el.parentElement;
    }
    scrollRef.current = el && el !== document.body ? el : null;
  }, [step, filteredOptions.length]);

  // Money math. In edit mode the existing total is authoritative for display.
  const hargaBulanan = chosen?.harga || 0;
  const total = isEdit
    ? editBooking!.Harga_Total_Net || hargaBulanan * lama
    : hargaBulanan * lama;
  const dibayar = bayar === 'Lunas' ? total : bayar === 'DP' ? Number(dp || 0) : 0;
  const sisa = Math.max(total - dibayar, 0);
  const keluar = addMonths(masuk, lama);

  const bisaLanjut =
    step === 1
      ? nama.trim().length > 0
      : step === 2
      ? !!chosen && lama >= 1 && !!masuk
      : bayar !== 'DP' || (Number(dp) > 0 && Number(dp) < total);

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
        paket: PAKET,
        jumlahPeriode: lama,
        hargaKamar: hargaBulanan,
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
    <Sheet open={open} onClose={onClose}>
      <SheetHead title={judul} onClose={onClose} />
      <div className="px-6 pb-8 pt-2">
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

        {/* LANGKAH 2 — PILIH KAMAR & LAMA SEWA */}
        {curStep === 2 && (
          <div ref={listRef}>
            <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-5">
              2. Pilih kamar &amp; lama sewa
            </h3>

            <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">
              Kamar yang kosong
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
                <KkCard className="text-body text-kk-ink">Belum ada kamar kosong saat ini.</KkCard>
              )}
              {options.length > 0 && filteredOptions.length === 0 && (
                <KkCard className="text-body text-kk-ink">
                  Tidak ada kamar yang cocok dengan pencarian atau filter.
                </KkCard>
              )}
              {filteredOptions.map((o) => {
                const sel = chosen?.room.RoomID === o.room.RoomID;
                return (
                  <button
                    key={o.room.RoomID}
                    onClick={() => setRoomId(o.room.RoomID)}
                    className={`text-left p-[18px] rounded-kk-card border-2 flex justify-between items-center gap-3 ${
                      sel ? 'border-kk-navy bg-kk-mint-soft' : 'border-kk-mauve bg-white'
                    }`}
                  >
                    <div>
                      <div className="font-heading font-bold text-[20px] text-kk-navy">
                        {o.room.Nama_Kamar}
                      </div>
                      <div className="text-caption text-kk-ink">
                        {o.room.Gedung} · {rupiah(o.harga)}/bulan
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

            <div className="font-heading font-bold text-[18px] text-kk-navy mb-2.5">Lama sewa</div>
            <div className="flex items-center gap-4 mb-3.5">
              <button
                onClick={() => setLama(Math.max(1, lama - 1))}
                aria-label="Kurangi"
                className="w-14 h-14 rounded-kk-card border-2 border-kk-navy bg-white text-kk-navy text-[30px] leading-none flex-shrink-0 grid place-items-center"
              >
                −
              </button>
              <div className="flex-1 text-center font-heading font-black text-[26px] text-kk-navy">
                {lama} bulan
              </div>
              <button
                onClick={() => setLama(Math.min(24, lama + 1))}
                aria-label="Tambah"
                className="w-14 h-14 rounded-kk-card border-2 border-kk-navy bg-white text-kk-navy text-[30px] leading-none flex-shrink-0 grid place-items-center"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 mb-6">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setLama(m)}
                  className={`flex-1 min-h-[48px] rounded-kk-pill font-body font-semibold text-caption border-2 ${
                    lama === m
                      ? 'border-kk-navy bg-kk-navy text-white'
                      : 'border-kk-mauve bg-white text-kk-navy'
                  }`}
                >
                  {m} bln
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

            {chosen && (
              <div className="bg-kk-mint-soft border-2 border-kk-mint rounded-kk-card p-[18px]">
                <div className="text-caption text-kk-ink font-semibold mb-1.5">
                  Perhitungan otomatis
                </div>
                <div className="flex justify-between items-baseline text-body mb-1.5">
                  <span className="text-kk-navy">
                    {rupiah(hargaBulanan)} × {lama} bulan
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

            {/* Tombol gulir cepat untuk daftar kamar yang panjang. */}
            <ScrollFab containerRef={scrollRef} />
          </div>
        )}

        {/* LANGKAH 3 — PEMBAYARAN */}
        {curStep === 3 && (
          <div>
            <h3 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-5">
              3. Bagaimana pembayarannya?
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
          {curStep < 3 && (
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
          {curStep === 3 && (
            <KkButton
              variant="success"
              size="lg"
              className="flex-[2]"
              disabled={!bisaLanjut || saveMutation.isPending}
              onClick={() => bisaLanjut && saveMutation.mutate()}
            >
              <KkIcon name="cek" size={22} strokeWidth={2.4} />{' '}
              {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Booking'}
            </KkButton>
          )}
        </div>
      </div>
    </Sheet>
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
