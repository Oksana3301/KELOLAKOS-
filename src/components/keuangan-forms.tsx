'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type BookingItem } from '@/lib/api';
import { formatRupiah, formatRupiahShort } from '@/lib/utils';
import { toast } from 'sonner';

// =====================================================
// Shared sub-components
// =====================================================

export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-tx2 mb-1 block">
        {label}
        {required && <span className="text-rd ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-tx3 text-[10px] mt-1">{hint}</div>}
    </div>
  );
}

export function RupiahInput({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3 text-xs font-semibold pointer-events-none">
        Rp
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="input pl-9 tabular-nums"
        min={0}
        max={max}
      />
    </div>
  );
}

// =====================================================
// 1. Payment Form (Pembayaran)
// =====================================================

export function PaymentForm({ bookings }: { bookings: BookingItem[] }) {
  const queryClient = useQueryClient();
  const [bookingId, setBookingId] = useState('');
  const [nominal, setNominal] = useState(0);
  const [jenisBayar, setJenisBayar] = useState('DP');
  const [metode, setMetode] = useState('CASH');
  const [diterimaOleh, setDiterimaOleh] = useState('');
  const [tanggalBayar, setTanggalBayar] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.BookingID === bookingId),
    [bookings, bookingId],
  );

  const sisaBayar = selectedBooking?.Sisa_Bayar || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId) {
      toast.error('Pilih booking dulu');
      return;
    }
    if (nominal <= 0) {
      toast.error('Nominal wajib lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitPayment({
        bookingId,
        nominal,
        jenisBayar,
        metode,
        diterimaOleh,
        tanggalBayar,
        catatan,
      });
      toast.success(`✓ Pembayaran ${formatRupiah(nominal)} berhasil dicatat`);
      // Reset
      setBookingId('');
      setNominal(0);
      setDiterimaOleh('');
      setCatatan('');
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Pilih Booking" required>
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="input" required>
          <option value="">— Pilih booking dengan sisa bayar —</option>
          {bookings
            .filter((b) => b.Sisa_Bayar > 0)
            .map((b) => (
              <option key={b.BookingID} value={b.BookingID}>
                {b.Nama_Customer} · {b.Nama_Kamar} · sisa {formatRupiahShort(b.Sisa_Bayar)}
              </option>
            ))}
        </select>
      </FormField>

      {selectedBooking && (
        <div className="bg-sf2 border border-bd rounded-md p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-tx3">Total tagihan</span>
            <span className="font-semibold tabular-nums">{formatRupiah(selectedBooking.Harga_Total_Net)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tx3">Sudah dibayar</span>
            <span className="font-semibold tabular-nums text-gr">{formatRupiah(selectedBooking.Net_Diterima)}</span>
          </div>
          <div className="flex justify-between border-t border-bd pt-1 mt-1">
            <span className="font-bold">Sisa</span>
            <span className="font-bold tabular-nums text-rd">{formatRupiah(sisaBayar)}</span>
          </div>
        </div>
      )}

      <FormField label="Nominal Pembayaran" required>
        <RupiahInput value={nominal} onChange={setNominal} max={sisaBayar || undefined} />
        {selectedBooking && (
          <div className="flex gap-1 mt-2">
            <button type="button" onClick={() => setNominal(sisaBayar)} className="btn btn-sec btn-sm text-[10px]">
              Bayar Lunas ({formatRupiahShort(sisaBayar)})
            </button>
            <button type="button" onClick={() => setNominal(Math.round(sisaBayar / 2))} className="btn btn-sec btn-sm text-[10px]">
              Setengah
            </button>
          </div>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Jenis">
          <select value={jenisBayar} onChange={(e) => setJenisBayar(e.target.value)} className="input">
            <option value="DP">DP</option>
            <option value="CICILAN">Cicilan</option>
            <option value="PELUNASAN">Pelunasan</option>
          </select>
        </FormField>
        <FormField label="Metode">
          <select value={metode} onChange={(e) => setMetode(e.target.value)} className="input">
            <option value="CASH">Cash</option>
            <option value="TRANSFER">Transfer Bank</option>
            <option value="QRIS">QRIS</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Diterima Oleh">
          <input
            type="text"
            value={diterimaOleh}
            onChange={(e) => setDiterimaOleh(e.target.value)}
            placeholder="Nama penerima"
            className="input"
          />
        </FormField>
        <FormField label="Tanggal Bayar">
          <input
            type="date"
            value={tanggalBayar}
            onChange={(e) => setTanggalBayar(e.target.value)}
            className="input"
          />
        </FormField>
      </div>

      <FormField label="Catatan">
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Optional..."
          rows={2}
          className="input resize-y"
        />
      </FormField>

      <button type="submit" disabled={submitting} className="btn btn-pri w-full">
        {submitting ? '⏳ Saving...' : '💵 Catat Pembayaran'}
      </button>
    </form>
  );
}

// =====================================================
// 2. Refund Form
// =====================================================

export function RefundForm({ bookings }: { bookings: BookingItem[] }) {
  const queryClient = useQueryClient();
  const [bookingId, setBookingId] = useState('');
  const [nominal, setNominal] = useState(0);
  const [jenisRefund, setJenisRefund] = useState('REFUND_PARTIAL');
  const [metodeRefund, setMetodeRefund] = useState('CASH');
  const [dikembalikanOleh, setDikembalikanOleh] = useState('');
  const [tanggalRefund, setTanggalRefund] = useState(new Date().toISOString().split('T')[0]);
  const [alasanRefund, setAlasanRefund] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.BookingID === bookingId),
    [bookings, bookingId],
  );

  // Bookings that have payments available for refund
  const refundableBookings = useMemo(
    () => bookings.filter((b) => b.Net_Diterima > 0),
    [bookings],
  );

  const availableToRefund = selectedBooking
    ? Math.max(selectedBooking.Total_Bayar - selectedBooking.Refund_Total, 0)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId) {
      toast.error('Pilih booking dulu');
      return;
    }
    if (nominal <= 0) {
      toast.error('Nominal refund wajib lebih dari 0');
      return;
    }
    if (nominal > availableToRefund) {
      toast.error(`Maksimal refund: ${formatRupiah(availableToRefund)}`);
      return;
    }

    setSubmitting(true);
    try {
      await api.submitRefund({
        bookingId,
        nominal,
        jenisRefund,
        metodeRefund,
        dikembalikanOleh,
        tanggalRefund,
        alasanRefund,
      });
      toast.success(`✓ Refund ${formatRupiah(nominal)} berhasil dicatat`);
      // Reset
      setBookingId('');
      setNominal(0);
      setDikembalikanOleh('');
      setAlasanRefund('');
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blb border border-bl rounded-md p-3 text-xs text-bl leading-relaxed">
        💡 Refund ini tidak mengubah status booking. Untuk cancel booking dengan refund, pakai menu Cancel di booking detail.
      </div>

      <FormField label="Pilih Booking" required hint={`${refundableBookings.length} booking punya saldo yang bisa di-refund`}>
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="input" required>
          <option value="">— Pilih booking yang punya pembayaran —</option>
          {refundableBookings.map((b) => (
            <option key={b.BookingID} value={b.BookingID}>
              {b.Nama_Customer} · {b.Nama_Kamar} · paid {formatRupiahShort(b.Net_Diterima)}
            </option>
          ))}
        </select>
      </FormField>

      {selectedBooking && (
        <div className="bg-sf2 border border-bd rounded-md p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-tx3">Total dibayar</span>
            <span className="font-semibold tabular-nums">{formatRupiah(selectedBooking.Total_Bayar)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tx3">Sudah di-refund</span>
            <span className="font-semibold tabular-nums text-rd">{formatRupiah(selectedBooking.Refund_Total)}</span>
          </div>
          <div className="flex justify-between border-t border-bd pt-1 mt-1">
            <span className="font-bold">Maksimal refund</span>
            <span className="font-bold tabular-nums text-am">{formatRupiah(availableToRefund)}</span>
          </div>
        </div>
      )}

      <FormField label="Nominal Refund" required>
        <RupiahInput value={nominal} onChange={setNominal} max={availableToRefund || undefined} />
        {selectedBooking && availableToRefund > 0 && (
          <div className="flex gap-1 mt-2">
            <button type="button" onClick={() => setNominal(availableToRefund)} className="btn btn-sec btn-sm text-[10px]">
              Refund Full ({formatRupiahShort(availableToRefund)})
            </button>
            <button type="button" onClick={() => setNominal(Math.round(availableToRefund / 2))} className="btn btn-sec btn-sm text-[10px]">
              Setengah
            </button>
          </div>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Jenis Refund">
          <select value={jenisRefund} onChange={(e) => setJenisRefund(e.target.value)} className="input">
            <option value="REFUND_PARTIAL">Refund Sebagian</option>
            <option value="REFUND_FULL">Refund Penuh</option>
            <option value="REFUND_KOREKSI">Koreksi Pembayaran</option>
          </select>
        </FormField>
        <FormField label="Metode">
          <select value={metodeRefund} onChange={(e) => setMetodeRefund(e.target.value)} className="input">
            <option value="CASH">Cash</option>
            <option value="TRANSFER">Transfer Bank</option>
            <option value="QRIS">QRIS</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Dikembalikan Oleh">
          <input
            type="text"
            value={dikembalikanOleh}
            onChange={(e) => setDikembalikanOleh(e.target.value)}
            placeholder="Nama yang refund"
            className="input"
          />
        </FormField>
        <FormField label="Tanggal Refund">
          <input
            type="date"
            value={tanggalRefund}
            onChange={(e) => setTanggalRefund(e.target.value)}
            className="input"
          />
        </FormField>
      </div>

      <FormField label="Alasan Refund" required>
        <textarea
          value={alasanRefund}
          onChange={(e) => setAlasanRefund(e.target.value)}
          placeholder="Alasan refund (wajib untuk audit trail)..."
          rows={2}
          className="input resize-y"
          required
        />
      </FormField>

      <button type="submit" disabled={submitting} className="btn btn-pri w-full">
        {submitting ? '⏳ Saving...' : '↩️ Catat Refund'}
      </button>
    </form>
  );
}

// =====================================================
// 3. Fee Form (Fee Penjaga)
// =====================================================

const JENIS_FEE_OPTIONS = [
  'Bersih-bersih Penginapan',
  'Cuci Sprei/Handuk',
  'Antar/Jemput Tamu',
  'Tukang Bangunan',
  'Tukang Servis (AC/Listrik/Air)',
  'Gaji Penjaga Tetap',
  'Lainnya',
];

export function FeeForm({ bookings }: { bookings: BookingItem[] }) {
  const queryClient = useQueryClient();
  const [bookingId, setBookingId] = useState('');
  const [namaPenjaga, setNamaPenjaga] = useState('');
  const [jenisFee, setJenisFee] = useState('Bersih-bersih Penginapan');
  const [nominal, setNominal] = useState(0);
  const [statusBayar, setStatusBayar] = useState('SUDAH DIBAYAR');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!namaPenjaga.trim()) {
      toast.error('Nama penjaga wajib diisi');
      return;
    }
    if (nominal <= 0) {
      toast.error('Nominal wajib lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitStaffFee({
        bookingId: bookingId || undefined,
        namaPenjaga: namaPenjaga.trim(),
        jenisFee,
        nominal,
        statusBayar,
        tanggal,
        catatan,
      });
      toast.success(`✓ Fee ${formatRupiah(nominal)} berhasil dicatat`);
      // Reset
      setBookingId('');
      setNamaPenjaga('');
      setNominal(0);
      setCatatan('');
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Booking Terkait" hint="Kosongkan kalau fee umum (bukan untuk booking spesifik)">
        <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="input">
          <option value="">— Tidak terkait booking spesifik —</option>
          {bookings.map((b) => (
            <option key={b.BookingID} value={b.BookingID}>
              {b.Nama_Customer} · {b.Nama_Kamar}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Nama Penjaga" required>
          <input
            type="text"
            value={namaPenjaga}
            onChange={(e) => setNamaPenjaga(e.target.value)}
            placeholder="Mis: Pak Budi"
            className="input"
            required
          />
        </FormField>
        <FormField label="Jenis Fee">
          <select value={jenisFee} onChange={(e) => setJenisFee(e.target.value)} className="input">
            {JENIS_FEE_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Nominal Fee" required>
        <RupiahInput value={nominal} onChange={setNominal} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Status Bayar">
          <select value={statusBayar} onChange={(e) => setStatusBayar(e.target.value)} className="input">
            <option value="SUDAH DIBAYAR">Sudah Dibayar</option>
            <option value="BELUM DIBAYAR">Belum Dibayar (Utang)</option>
          </select>
        </FormField>
        <FormField label="Tanggal">
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="input"
          />
        </FormField>
      </div>

      <FormField label="Catatan">
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Optional..."
          rows={2}
          className="input resize-y"
        />
      </FormField>

      <button type="submit" disabled={submitting} className="btn btn-pri w-full">
        {submitting ? '⏳ Saving...' : '🧹 Catat Fee Penjaga'}
      </button>
    </form>
  );
}

// =====================================================
// 4. Expense Form (Belanja Operasional)
// =====================================================

const KATEGORI_BELANJA = [
  { value: 'Maintenance', label: '🔧 Maintenance / Perbaikan' },
  { value: 'Listrik & Air', label: '💡 Listrik & Air' },
  { value: 'Kebersihan & Laundry', label: '🧺 Kebersihan & Laundry' },
  { value: 'Gaji / Penjaga', label: '👷 Gaji / Penjaga' },
  { value: 'Pajak / Retribusi', label: '🧾 Pajak / Retribusi' },
  { value: 'Lain-lain', label: '📦 Lain-lain' },
];

const UNIT_OPTIONS = ['Umum', 'Gedung A', 'Gedung B', 'Gedung C'];

export function ExpenseForm() {
  const queryClient = useQueryClient();
  const [unit, setUnit] = useState('Umum');
  const [kategori, setKategori] = useState('Maintenance');
  const [item, setItem] = useState('');
  const [nominal, setNominal] = useState(0);
  const [metode, setMetode] = useState('CASH');
  const [dibeliOleh, setDibeliOleh] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim()) {
      toast.error('Nama item wajib diisi');
      return;
    }
    if (nominal <= 0) {
      toast.error('Nominal wajib lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitExpense({
        unit,
        kategori,
        item: item.trim(),
        nominal,
        metode,
        dibeliOleh,
        tanggal,
        catatan,
      });
      toast.success(`✓ Belanja ${formatRupiah(nominal)} berhasil dicatat`);
      // Reset
      setItem('');
      setNominal(0);
      setDibeliOleh('');
      setCatatan('');
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Unit / Lokasi">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input">
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Kategori" required>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="input">
            {KATEGORI_BELANJA.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Item / Deskripsi" required>
        <input
          type="text"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Mis: Sabun mandi, lampu, galon air..."
          className="input"
          required
        />
      </FormField>

      <FormField label="Nominal" required>
        <RupiahInput value={nominal} onChange={setNominal} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Metode Bayar">
          <select value={metode} onChange={(e) => setMetode(e.target.value)} className="input">
            <option value="CASH">Cash</option>
            <option value="TRANSFER">Transfer Bank</option>
            <option value="QRIS">QRIS</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
        </FormField>
        <FormField label="Tanggal">
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="input"
          />
        </FormField>
      </div>

      <FormField label="Dibeli Oleh">
        <input
          type="text"
          value={dibeliOleh}
          onChange={(e) => setDibeliOleh(e.target.value)}
          placeholder="Nama yang belanja"
          className="input"
        />
      </FormField>

      <FormField label="Catatan">
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Optional..."
          rows={2}
          className="input resize-y"
        />
      </FormField>

      <button type="submit" disabled={submitting} className="btn btn-pri w-full">
        {submitting ? '⏳ Saving...' : '🛒 Catat Belanja'}
      </button>
    </form>
  );
}
