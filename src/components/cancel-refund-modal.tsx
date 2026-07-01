'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type BookingFullData } from '@/lib/api';
import { invalidateBookingData } from '@/lib/query-sync';
import { formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';

type Scenario = 'refund_only' | 'cancel_hangus' | 'cancel_refund';

const SCENARIOS: Array<{
  key: Scenario;
  emoji: string;
  title: string;
  description: string;
  warningColor: string;
}> = [
  {
    key: 'refund_only',
    emoji: '💸',
    title: 'Refund Saja',
    description:
      'Booking tetap aktif. Cuma kembaliin sebagian uang ke customer (mis. ada lebih bayar atau service issue).',
    warningColor: 'border-am bg-amb text-am',
  },
  {
    key: 'cancel_hangus',
    emoji: '❌',
    title: 'Cancel + DP Hangus',
    description:
      'Booking dibatalkan. Semua uang yang sudah dibayar TIDAK dikembalikan, dianggap sebagai pendapatan kos (kompensasi).',
    warningColor: 'border-rd bg-rdb text-rd',
  },
  {
    key: 'cancel_refund',
    emoji: '↩️',
    title: 'Cancel + Refund',
    description:
      'Booking dibatalkan. Sebagian/semua uang dikembalikan ke customer (mis. masalah dari pihak kos).',
    warningColor: 'border-bl bg-blb text-bl',
  },
];

const METODE_OPTIONS = [
  { value: 'TUNAI', label: '💵 Tunai (cash)' },
  { value: 'TRANSFER', label: '🏦 Transfer Bank' },
  { value: 'E-WALLET', label: '📱 E-Wallet (OVO/Dana/Gopay/etc)' },
  { value: 'LAINNYA', label: '🔄 Lainnya' },
];

interface CancelRefundModalProps {
  booking: BookingFullData;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CancelRefundModal({ booking, onClose, onSuccess }: CancelRefundModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [scenario, setScenario] = useState<Scenario>('refund_only');

  // Form state
  const [nominal, setNominal] = useState<number>(0);
  const [metode, setMetode] = useState('TRANSFER');
  const [transferTo, setTransferTo] = useState('');
  const [pic, setPic] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [tanggal, setTanggal] = useState(today);
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsNominal = scenario !== 'cancel_hangus';
  const totalDibayar = Number(booking.Total_Bayar) || 0;
  const totalRefundExisting = Number(booking.Refund_Total) || 0;
  const maxRefund = Math.max(0, totalDibayar - totalRefundExisting);

  function handleNext() {
    setStep('form');
    // Set default nominal for cancel_refund: full refund
    if (scenario === 'cancel_refund' && nominal === 0) {
      setNominal(maxRefund);
    }
  }

  async function handleSubmit() {
    // Validation
    if (!alasan.trim()) {
      toast.error('Alasan wajib diisi');
      return;
    }
    if (needsNominal && nominal <= 0) {
      toast.error('Nominal refund wajib > 0');
      return;
    }
    if (needsNominal && nominal > maxRefund) {
      toast.error(`Nominal maksimal: ${formatRupiah(maxRefund)} (sisa yang bisa direfund)`);
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('⏳ Memproses...');
    try {
      // Catatan gabungkan: alasan + transfer detail kalau ada
      const fullCatatan = transferTo
        ? `${alasan}${transferTo ? ' | Transfer ke: ' + transferTo : ''}`
        : alasan;

      if (scenario === 'refund_only') {
        // Standalone refund without status change
        await api.submitRefund({
          bookingId: booking.BookingID,
          nominal,
          jenisRefund: 'PARSIAL',
          metodeRefund: metode,
          dikembalikanOleh: pic || 'admin',
          alasanRefund: fullCatatan,
          tanggalRefund: tanggal,
        });
        toast.success(`✓ Refund ${formatRupiah(nominal)} berhasil dicatat`, { id: toastId });
      } else if (scenario === 'cancel_hangus') {
        // Cancel + DP hangus, no refund — use backend-established status name
        await api.submitStatusAction({
          bookingId: booking.BookingID,
          statusBooking: totalDibayar > 0 ? 'CANCEL_DP_HANGUS' : 'CANCEL_TANPA_DP',
          catatanTambahan: alasan,
        });
        toast.success(`✓ Booking di-cancel${totalDibayar > 0 ? `, DP ${formatRupiah(totalDibayar)} masuk ke pendapatan` : ''}`, {
          id: toastId,
        });
      } else {
        // cancel_refund — use backend-established status name
        await api.submitStatusAction({
          bookingId: booking.BookingID,
          statusBooking: 'CANCEL_DENGAN_REFUND',
          refundNominal: nominal,
          jenisRefund: 'CANCEL_REFUND',
          metodeRefund: metode,
          dikembalikanOleh: pic || 'admin',
          alasanRefund: fullCatatan,
          tanggalRefund: tanggal,
          catatanTambahan: alasan,
        });
        toast.success(`✓ Booking di-cancel, refund ${formatRupiah(nominal)} dicatat`, {
          id: toastId,
        });
      }

      // Sinkron ke SEMUA halaman (Beranda/Kamar/Uang/Laporan/Invoice/Layout).
      invalidateBookingData(queryClient, booking.BookingID);

      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  const currentScenario = SCENARIOS.find((s) => s.key === scenario)!;

  return (
    <div
      className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-sf w-full max-w-xl rounded-lg shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-bd flex justify-between items-start">
          <div>
            <h2 className="font-bold text-base">
              {step === 'pick' ? '💸 Cancel / Refund Booking' : `${currentScenario.emoji} ${currentScenario.title}`}
            </h2>
            <p className="text-tx3 text-xs mt-0.5">
              {booking.BookingID} · {booking.Nama_Customer} · {booking.Nama_Kamar}
            </p>
          </div>
          <button onClick={onClose} className="text-tx3 hover:text-tx p-1" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 flex-1">
          {/* Booking summary */}
          <div className="bg-sf2 border border-bd rounded-md p-3 mb-4 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-tx3">Total Tagihan</span>
              <span className="font-semibold tabular-nums">{formatRupiah(Number(booking.Harga_Total_Net) || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tx3">Total Sudah Dibayar</span>
              <span className="font-semibold tabular-nums text-gr">{formatRupiah(totalDibayar)}</span>
            </div>
            {totalRefundExisting > 0 && (
              <div className="flex justify-between">
                <span className="text-tx3">Sudah Direfund Sebelumnya</span>
                <span className="font-semibold tabular-nums text-rd">- {formatRupiah(totalRefundExisting)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-bd">
              <span className="text-tx2 font-semibold">Sisa Yang Bisa Direfund</span>
              <span className="font-bold tabular-nums">{formatRupiah(maxRefund)}</span>
            </div>
          </div>

          {step === 'pick' ? (
            <div className="space-y-3">
              <p className="text-tx2 text-sm font-semibold mb-2">Apa yang mau dilakukan?</p>
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key)}
                  className={
                    scenario === s.key
                      ? 'w-full text-left border-2 border-ac bg-ac/5 rounded-md p-3'
                      : 'w-full text-left border-2 border-bd hover:border-bds rounded-md p-3'
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xl flex-shrink-0">{s.emoji}</div>
                    <div className="flex-1">
                      <div className="font-bold text-sm mb-0.5">{s.title}</div>
                      <div className="text-tx3 text-[11px] leading-relaxed">{s.description}</div>
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className={
                          scenario === s.key
                            ? 'w-4 h-4 rounded-full bg-ac border-2 border-ac flex items-center justify-center'
                            : 'w-4 h-4 rounded-full border-2 border-bd'
                        }
                      >
                        {scenario === s.key && <span className="w-1.5 h-1.5 bg-inv rounded-full" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Scenario reminder */}
              <div className={`border rounded-md p-2.5 text-[11px] leading-relaxed ${currentScenario.warningColor}`}>
                <strong>{currentScenario.emoji} {currentScenario.title}:</strong> {currentScenario.description}
              </div>

              {/* Nominal refund (skip for cancel_hangus) */}
              {needsNominal && (
                <Field label="Nominal Refund" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3 text-xs font-semibold pointer-events-none">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={nominal || ''}
                      onChange={(e) => setNominal(parseInt(e.target.value) || 0)}
                      className="input pl-9 tabular-nums"
                      min={0}
                      max={maxRefund}
                      required
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-tx3">Max: {formatRupiah(maxRefund)}</span>
                    <button
                      type="button"
                      onClick={() => setNominal(maxRefund)}
                      className="text-bl font-semibold hover:underline"
                    >
                      Set max
                    </button>
                  </div>
                </Field>
              )}

              {/* Metode (skip for cancel_hangus) */}
              {needsNominal && (
                <Field label="Metode Refund" required>
                  <select value={metode} onChange={(e) => setMetode(e.target.value)} className="input">
                    {METODE_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {/* Transfer detail (only for transfer/e-wallet) */}
              {needsNominal && (metode === 'TRANSFER' || metode === 'E-WALLET') && (
                <Field
                  label={metode === 'TRANSFER' ? 'Tujuan Transfer (Nama Bank · No Rekening · Nama)' : 'Tujuan E-Wallet (Provider · No HP)'}
                  hint="Bisa kosong, tapi sebaiknya diisi buat catatan"
                >
                  <input
                    type="text"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder={metode === 'TRANSFER' ? 'BCA · 1234567890 · Pak Budi' : 'OVO · 081234567890'}
                    className="input"
                  />
                </Field>
              )}

              {/* Tanggal */}
              <Field label="Tanggal Refund/Cancel" required>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="input" />
              </Field>

              {/* PIC (skip for cancel_hangus) */}
              {needsNominal && (
                <Field label="PIC (yang ngembaliin)" hint="Default: admin">
                  <input
                    type="text"
                    value={pic}
                    onChange={(e) => setPic(e.target.value)}
                    placeholder="Nama yang ngembaliin uang"
                    className="input"
                  />
                </Field>
              )}

              {/* Alasan */}
              <Field label="Alasan / Catatan" required>
                <textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  rows={3}
                  placeholder="Mis: Customer minta cancel karena pindah kota, atau ada keluhan service..."
                  className="input resize-y"
                  required
                />
              </Field>

              {/* Confirmation summary */}
              <div className="bg-amb border border-am rounded-md p-3 text-xs">
                <div className="font-bold text-am mb-1">⚠️ Konfirmasi sebelum submit:</div>
                <ul className="text-tx2 space-y-0.5 list-disc ml-4">
                  <li>Aksi: <strong>{currentScenario.title}</strong></li>
                  {scenario === 'cancel_hangus' && (
                    <li className="text-rd">
                      Status booking jadi: <strong>{totalDibayar > 0 ? 'CANCEL_DP_HANGUS' : 'CANCEL_TANPA_DP'}</strong>
                      {totalDibayar > 0 && (
                        <> · Rp {totalDibayar.toLocaleString('id-ID')} masuk ke pendapatan (tidak dikembalikan)</>
                      )}
                    </li>
                  )}
                  {needsNominal && nominal > 0 && (
                    <li className="text-bl">Refund <strong>{formatRupiah(nominal)}</strong> via {METODE_OPTIONS.find((m) => m.value === metode)?.label}</li>
                  )}
                  {scenario === 'cancel_refund' && (
                    <li className="text-rd">Status booking jadi: <strong>CANCEL_DENGAN_REFUND</strong></li>
                  )}
                  {scenario === 'refund_only' && (
                    <li>Status booking <strong>tetap aktif</strong> (cuma catat refund)</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-bd flex justify-between items-center bg-sf2 rounded-b-lg gap-2">
          {step === 'pick' ? (
            <>
              <button onClick={onClose} className="btn btn-sec">
                Batal
              </button>
              <button onClick={handleNext} className="btn btn-pri">
                Lanjut →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep('pick')} className="btn btn-sec" disabled={submitting}>
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="btn btn-pri">
                {submitting ? '⏳ Memproses...' : '✓ Konfirmasi Submit'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
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
