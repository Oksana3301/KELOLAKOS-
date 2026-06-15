'use client';

// KelolaKos · Keuangan (Uang) page UI — elderly-friendly reskin helpers.
// Owned by the Keuangan page only. Reuses the shared KK library; does NOT
// change any business logic — submit payloads match the existing api fns.

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type BookingItem, type BuktiFile } from '@/lib/api';
import { rupiah } from './status';
import { Sheet, SheetHead, KkButton } from './ui';
import { FileUpload } from './file-upload';
import { KkIcon, type KkIconName } from './icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ───────────────────────── type metadata (lifted from reference) ─────────────────────────
export type JenisId = 'pembayaran' | 'refund' | 'fee' | 'belanja';
export type Arah = 'masuk' | 'keluar';

interface JenisMeta {
  id: JenisId;
  label: string;
  ic: KkIconName;
  arah: Arah;
  ringkas: string;
  /** "who/what" field */
  f1: { label: string; contoh: string };
  judulJumlah: string;
  contohJumlah: string;
}

export const JENIS: Record<JenisId, JenisMeta> = {
  pembayaran: {
    id: 'pembayaran',
    label: 'Pembayaran',
    ic: 'pembayaran',
    arah: 'masuk',
    ringkas: 'Uang sewa yang diterima dari penyewa.',
    f1: { label: 'Diterima dari', contoh: 'Contoh: Pak Budi Santoso' },
    judulJumlah: 'Jumlah uang diterima',
    contohJumlah: 'Contoh: 850000',
  },
  refund: {
    id: 'refund',
    label: 'Refund',
    ic: 'refund',
    arah: 'keluar',
    ringkas: 'Uang yang dikembalikan ke penyewa, misal saat booking dibatalkan.',
    f1: { label: 'Dikembalikan ke', contoh: 'Contoh: Bu Siti Aminah' },
    judulJumlah: 'Jumlah dikembalikan',
    contohJumlah: 'Contoh: 400000',
  },
  fee: {
    id: 'fee',
    label: 'Fee Penjaga',
    ic: 'akun',
    arah: 'keluar',
    ringkas: 'Gaji atau upah untuk penjaga kos yang membantu Anda.',
    f1: { label: 'Nama penjaga', contoh: 'Contoh: Mas Agus' },
    judulJumlah: 'Jumlah dibayar',
    contohJumlah: 'Contoh: 1500000',
  },
  belanja: {
    id: 'belanja',
    label: 'Belanja Operasional',
    ic: 'belanja',
    arah: 'keluar',
    ringkas: 'Pengeluaran untuk keperluan kos, misal beli galon, bayar listrik.',
    f1: { label: 'Untuk apa?', contoh: 'Contoh: Beli galon air' },
    judulJumlah: 'Jumlah uang',
    contohJumlah: 'Contoh: 50000',
  },
};

/** Map a transaction direction/type to its income/expense color tokens. */
export function arahStyle(arah: Arah) {
  return arah === 'masuk'
    ? {
        text: 'text-kk-green',
        soft: 'bg-kk-mint-soft',
        border: 'border-kk-mint',
        tagBg: 'bg-kk-green text-white',
        tag: 'Pemasukan',
        tanda: '+',
      }
    : {
        text: 'text-kk-orange',
        soft: 'bg-kk-orange-soft',
        border: 'border-[#E7BCAD]',
        tagBg: 'bg-kk-orange text-white',
        tag: 'Pengeluaran',
        tanda: '−',
      };
}

const TODAY = () => new Date().toISOString().split('T')[0];

// ───────────────────────── field wrapper (label + example + hint) ─────────────────────────
function Field({
  label,
  contoh,
  hint,
  children,
}: {
  label: string;
  contoh?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="kk-label">{label}</label>
      {contoh && <div className="kk-help mb-2">{contoh}</div>}
      {children}
      {hint && <div className="kk-help mt-2">{hint}</div>}
    </div>
  );
}

// ───────────────────────── 4 record-type cards ─────────────────────────
export function JenisCard({ jenis, onClick }: { jenis: JenisMeta; onClick: () => void }) {
  const s = arahStyle(jenis.arah);
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left cursor-pointer bg-white border-2 rounded-kk-card p-[18px] flex flex-col gap-2.5 min-h-[156px]',
        s.border,
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('w-12 h-12 rounded-[13px] grid place-items-center', s.soft, s.text)}>
          <KkIcon name={jenis.ic} size={26} strokeWidth={2.2} />
        </div>
        <span className={cn('rounded-full font-body font-semibold text-[16px] px-2.5 py-1', s.tagBg)}>
          {s.tag}
        </span>
      </div>
      <div className="font-heading font-bold text-[19px] text-kk-navy">{jenis.label}</div>
      <div className="text-caption text-kk-ink leading-snug">{jenis.ringkas}</div>
    </button>
  );
}

// ───────────────────────── riwayat row ─────────────────────────
export interface RiwayatTx {
  type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE';
  id: string;
  title: string;
  subtitle: string;
  nominal: number;
  direction: 'IN' | 'OUT';
  date: string;
}

const TYPE_ICON: Record<RiwayatTx['type'], KkIconName> = {
  PAYMENT: 'pembayaran',
  REFUND: 'refund',
  FEE: 'akun',
  EXPENSE: 'belanja',
};

export function RiwayatRow({
  tx,
  dateLabel,
  onDelete,
  deleteDisabled,
}: {
  tx: RiwayatTx;
  dateLabel: string;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  const masuk = tx.direction === 'IN';
  const s = arahStyle(masuk ? 'masuk' : 'keluar');
  return (
    <div className="kk-card !p-3.5 flex items-center gap-3.5">
      <div className={cn('w-[46px] h-[46px] rounded-xl flex-shrink-0 grid place-items-center', s.soft, s.text)}>
        <KkIcon name={TYPE_ICON[tx.type]} size={24} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-bold text-[18px] text-kk-navy break-words">{tx.title}</div>
        <div className="text-caption text-kk-ink truncate">
          {tx.subtitle ? `${tx.subtitle} · ` : ''}
          {dateLabel}
        </div>
        {/* amount drops below on phone so the title keeps full width */}
        <div className={cn('sm:hidden font-heading font-bold text-[17px] whitespace-nowrap mt-1', s.text)}>
          {s.tanda} {rupiah(tx.nominal)}
        </div>
      </div>
      <div className={cn('hidden sm:block font-heading font-bold text-[18px] whitespace-nowrap', s.text)}>
        {s.tanda} {rupiah(tx.nominal)}
      </div>
      <button
        onClick={onDelete}
        disabled={deleteDisabled}
        aria-label="Hapus"
        className={cn(
          'w-12 h-12 flex-shrink-0 rounded-xl border-2 border-kk-mauve bg-white text-kk-ink grid place-items-center',
          deleteDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-kk-orange hover:border-kk-orange',
        )}
      >
        <KkIcon name="hapus" size={20} strokeWidth={2.2} />
      </button>
    </div>
  );
}

// ───────────────────────── per-type record form Sheet ─────────────────────────
export function TransaksiFormSheet({
  jenisId,
  bookings,
  onClose,
}: {
  jenisId: JenisId | null;
  bookings: BookingItem[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const jenis = jenisId ? JENIS[jenisId] : null;
  const needsBooking = jenisId === 'pembayaran' || jenisId === 'refund';

  const [nama, setNama] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [tgl, setTgl] = useState(TODAY());
  const [bookingId, setBookingId] = useState('');
  const [bukti, setBukti] = useState<BuktiFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (jenisId) {
      setNama('');
      setJumlah('');
      setTgl(TODAY());
      setBookingId('');
      setBukti([]);
      setSubmitting(false);
    }
  }, [jenisId]);

  // Booking choices relevant per type (matches the original forms' filters).
  const bookingChoices = useMemo(() => {
    if (jenisId === 'pembayaran') return bookings.filter((b) => b.Sisa_Bayar > 0);
    if (jenisId === 'refund') return bookings.filter((b) => b.Net_Diterima > 0);
    return [];
  }, [jenisId, bookings]);

  if (!jenis) return null;
  const s = arahStyle(jenis.arah);
  const nominal = Number(jumlah) || 0;
  const valid =
    nama.trim().length > 0 && nominal > 0 && (!needsBooking || bookingId.length > 0);

  async function simpan() {
    if (!valid || !jenisId) return;
    setSubmitting(true);
    try {
      if (jenisId === 'pembayaran') {
        await api.submitPayment({
          bookingId,
          nominal,
          jenisBayar: 'CICILAN',
          metode: 'CASH',
          diterimaOleh: nama.trim(),
          tanggalBayar: tgl,
          buktiFiles: bukti,
        });
      } else if (jenisId === 'refund') {
        await api.submitRefund({
          bookingId,
          nominal,
          jenisRefund: 'REFUND_PARTIAL',
          metodeRefund: 'CASH',
          dikembalikanOleh: nama.trim(),
          tanggalRefund: tgl,
          alasanRefund: 'Refund',
          buktiFiles: bukti,
        });
      } else if (jenisId === 'fee') {
        await api.submitStaffFee({
          namaPenjaga: nama.trim(),
          jenisFee: 'Gaji Penjaga Tetap',
          nominal,
          statusBayar: 'SUDAH DIBAYAR',
          tanggal: tgl,
          buktiFiles: bukti,
        });
      } else {
        await api.submitExpense({
          unit: 'Umum',
          kategori: 'Lain-lain',
          item: nama.trim(),
          nominal,
          metode: 'CASH',
          tanggal: tgl,
          buktiFiles: bukti,
        });
      }
      toast.success(`✓ ${jenis!.label} berhasil dicatat`);
      qc.invalidateQueries({ queryKey: ['recent-transactions'] });
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['report-data'] });
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={!!jenisId} onClose={onClose}>
      <SheetHead title={jenis.label} onClose={onClose}>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('w-9 h-9 rounded-[11px] grid place-items-center', s.soft, s.text)}>
            <KkIcon name={jenis.ic} size={20} strokeWidth={2.2} />
          </span>
          <span className={cn('font-body font-semibold text-[15px]', s.text)}>{s.tag}</span>
        </div>
      </SheetHead>

      <div className="px-6 pb-7">
        <div className={cn('border-2 rounded-kk-btn px-4 py-3 text-body text-kk-navy mb-5', s.soft, s.border)}>
          {jenis.ringkas}
        </div>

        {needsBooking && (
          <Field label="Booking penyewa" hint="Pilih penyewa yang sesuai dengan catatan ini.">
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="kk-input"
            >
              <option value="">— Pilih penyewa —</option>
              {bookingChoices.map((b) => (
                <option key={b.BookingID} value={b.BookingID}>
                  {b.Nama_Customer} · {b.Nama_Kamar}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={jenis.f1.label} contoh={jenis.f1.contoh}>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Tulis di sini…"
            className="kk-input"
          />
        </Field>

        <Field
          label={jenis.judulJumlah}
          contoh={jenis.contohJumlah}
          hint="Tulis angka saja, tanpa titik atau Rp."
        >
          <input
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            inputMode="numeric"
            className="kk-input tabular-nums"
          />
        </Field>

        <Field label="Tanggal">
          <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} className="kk-input" />
        </Field>

        <FileUpload value={bukti} onChange={setBukti} label="Bukti pembayaran" />

        {/* Live colored preview */}
        <div className={cn('flex justify-between items-center bg-white border-2 rounded-kk-btn px-[18px] py-3.5 mb-5', s.border)}>
          <span className="font-heading font-bold text-[18px] text-kk-navy">
            {jenis.arah === 'masuk' ? 'Uang masuk' : 'Uang keluar'}
          </span>
          <span className={cn('font-heading font-black text-[24px] whitespace-nowrap', s.text)}>
            {s.tanda} {rupiah(nominal)}
          </span>
        </div>

        <KkButton
          variant={jenis.arah === 'masuk' ? 'success' : 'primary'}
          size="lg"
          block
          disabled={!valid || submitting}
          onClick={simpan}
        >
          <KkIcon name="cek" size={22} strokeWidth={2.4} />
          {submitting ? 'Menyimpan…' : 'Simpan Catatan'}
        </KkButton>
      </div>
    </Sheet>
  );
}
