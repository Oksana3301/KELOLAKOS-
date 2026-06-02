'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type BookingItem, type SubmitStatusActionPayload } from '@/lib/api';
import { formatRupiah, formatRupiahShort, formatDate } from '@/lib/utils';
import { CancelRefundModal } from '@/components/cancel-refund-modal';
import { toast } from 'sonner';

interface BookingDetailDrawerProps {
  bookingId: string;
  onClose: () => void;
  onEdit: () => void;
}

const CLOSED_STATUSES = ['SELESAI', 'CANCEL_DP_HANGUS', 'CANCEL_DENGAN_REFUND', 'CANCEL_TANPA_DP', 'CANCEL_HANGUS', 'CANCEL_REFUND'];

export function BookingDetailDrawer({ bookingId, onClose, onEdit }: BookingDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelRefundModal, setShowCancelRefundModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['booking-detail', bookingId],
    queryFn: () => api.getBookingDetail(bookingId),
    enabled: !!bookingId,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
    queryClient.invalidateQueries({ queryKey: ['initial-data'] });
  }

  async function handleSelesaikan() {
    if (!data) return;
    const ok = confirm(
      `Tutup booking ini sebagai SELESAI?\n\n${data.booking.Nama_Customer} · ${data.booking.Nama_Kamar}\n\nKamar akan kembali tersedia.`,
    );
    if (!ok) return;

    setProcessing(true);
    try {
      await api.submitStatusAction({
        bookingId: data.booking.BookingID,
        statusBooking: 'SELESAI',
        catatanTambahan: 'Diselesaikan via Next.js app',
      });
      toast.success('Booking diselesaikan ✓');
      invalidateAll();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!data) return;
    const confirm1 = confirm(
      `⚠️ HAPUS PERMANEN booking ini?\n\n${data.booking.Nama_Customer} · ${data.booking.Nama_Kamar}\n\nSemua pembayaran, refund, dan fee yang terkait akan ikut terhapus. Tidak bisa di-undo!`,
    );
    if (!confirm1) return;

    const confirm2 = confirm('Beneran yakin? Ketik OK lagi untuk konfirmasi final.');
    if (!confirm2) return;

    setProcessing(true);
    try {
      const result = await api.submitBookingDelete(data.booking.BookingID);
      toast.success(result.message || 'Booking dihapus');
      invalidateAll();
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 bg-tx/40 backdrop-blur-sm z-40 flex items-stretch justify-end"
        onClick={onClose}
      >
        <aside className="bg-sf w-full max-w-md h-full shadow-lg p-8 text-center">
          <div className="text-4xl mb-3 mt-20">⏳</div>
          <div className="text-tx3 text-sm">Loading booking detail…</div>
        </aside>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="fixed inset-0 bg-tx/40 backdrop-blur-sm z-40 flex items-stretch justify-end"
        onClick={onClose}
      >
        <aside className="bg-sf w-full max-w-md h-full shadow-lg p-8 text-center">
          <div className="text-4xl mb-3 mt-20">⚠️</div>
          <div className="text-tx font-bold mb-2">Gagal load detail</div>
          <div className="text-tx3 text-xs mb-4">{(error as Error)?.message || 'Unknown error'}</div>
          <button onClick={() => refetch()} className="btn btn-pri">
            🔄 Coba lagi
          </button>
        </aside>
      </div>
    );
  }

  const b = data.booking;
  const isClosed = CLOSED_STATUSES.includes(b.Status_Booking);
  const isLunas = b.Status_Bayar === 'LUNAS' || b.Status_Bayar === 'LEBIH BAYAR';
  const hasSisaBayar = b.Sisa_Bayar > 0;

  const statusBookingBadge =
    b.Status_Booking === 'SELESAI'
      ? 'badge-green'
      : b.Status_Booking.startsWith('CANCEL')
      ? 'badge-red'
      : 'badge-blue';

  const statusBayarBadge =
    b.Status_Bayar === 'LUNAS'
      ? 'badge-violet'
      : b.Status_Bayar === 'DP/PARSIAL'
      ? 'badge-blue'
      : b.Status_Bayar.startsWith('LEBIH')
      ? 'badge-green'
      : b.Status_Bayar.startsWith('REFUND') || b.Status_Bayar.startsWith('DP HANGUS') || b.Status_Bayar.startsWith('CANCEL')
      ? 'badge-red'
      : 'badge-amber';

  return (
    <div
      className="fixed inset-0 bg-tx/40 backdrop-blur-sm z-40 flex items-stretch justify-end"
      onClick={onClose}
    >
      <aside
        className="bg-sf w-full max-w-md h-full shadow-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-sf border-b border-bd p-5 z-10">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-tx3 text-[11px] font-semibold uppercase tracking-wider mb-1 truncate">
                {b.BookingID}
              </div>
              <h2 className="font-bold text-lg leading-tight">
                {b.Nama_Customer || '(tanpa nama)'}
                {b.Is_Ekstra === 'YA' && <span className="ml-2">⭐</span>}
              </h2>
              <div className="text-tx3 text-xs mt-1">
                {b.Nama_Kamar} · {b.Gedung}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <span className={`badge ${statusBookingBadge}`}>{b.Status_Booking}</span>
                <span className={`badge ${statusBayarBadge}`}>{b.Status_Bayar}</span>
                {b.Is_Ekstra === 'YA' && <span className="badge badge-violet">⭐ Ekstra</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-tx3 hover:text-tx p-1" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Identitas */}
          <Section title="👤 Identitas">
            <DRow label="Nama" value={b.Nama_Customer || '—'} />
            <DRow label="WhatsApp" value={b.WhatsApp || '—'} />
            {b.WhatsApp && (
              <a
                href={`https://wa.me/${b.WhatsApp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gr font-semibold hover:underline"
              >
                💬 Chat WhatsApp →
              </a>
            )}
          </Section>

          {/* Kamar */}
          <Section title="🏠 Kamar & Layanan">
            <DRow label="Kamar" value={`${b.Nama_Kamar} (${b.RoomID})`} />
            <DRow label="Tipe" value={b.Tipe_Kamar || '—'} />
            <DRow label="Layanan" value={b.Layanan || '—'} />
            <DRow label="Paket" value={`${b.Paket} · ${b.Jumlah_Periode} periode`} />
            <DRow label="Check-in" value={formatDate(b.CheckIn)} />
            <DRow label="Check-out" value={formatDate(b.CheckOut)} />
            {b.Durasi && <DRow label="Durasi" value={b.Durasi} />}
          </Section>

          {/* Harga Breakdown */}
          <Section title="💰 Harga & Pembayaran">
            <div className="bg-sf2 border border-bd rounded-md p-3 space-y-1.5">
              <DRow label="Harga Kamar" value={formatRupiah(b.Harga_Kamar)} />
              {b.Extra_Charge > 0 && <DRow label="Extra Charge" value={formatRupiah(b.Extra_Charge)} />}
              {b.Diskon > 0 && (
                <DRow label="Diskon" value={'-' + formatRupiah(b.Diskon)} accent="text-rd" />
              )}
              <div className="border-t border-bd pt-1.5 mt-1.5 flex justify-between text-sm">
                <span className="font-bold">Total Net</span>
                <span className="font-bold tabular-nums">{formatRupiah(b.Harga_Total_Net)}</span>
              </div>
              <DRow label="Total Dibayar" value={formatRupiah(b.Total_Bayar)} accent="text-gr" />
              {b.Refund_Total > 0 && (
                <DRow label="Total Refund" value={'-' + formatRupiah(b.Refund_Total)} accent="text-rd" />
              )}
              <DRow label="Net Diterima" value={formatRupiah(b.Net_Diterima)} accent="text-gr" />
              {b.Sisa_Bayar > 0 && (
                <DRow label="Sisa Tagihan" value={formatRupiah(b.Sisa_Bayar)} accent="text-rd" />
              )}
              {b.Kelebihan_Bayar > 0 && (
                <DRow
                  label="Lebih Bayar"
                  value={formatRupiah(b.Kelebihan_Bayar)}
                  accent="text-gr"
                />
              )}
              {b.DP_Hangus > 0 && (
                <DRow label="DP Hangus" value={formatRupiah(b.DP_Hangus)} accent="text-am" />
              )}
            </div>
          </Section>

          {/* Fasilitas */}
          {data.facilities && data.facilities.length > 0 && (
            <Section title={`🛋️ Fasilitas Kamar (${data.facilities.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {data.facilities.map((f) => (
                  <div
                    key={f.id}
                    className="inline-flex items-center gap-1 bg-sf2 border border-bd rounded-md px-2 py-1 text-xs"
                  >
                    <span>{f.emoji}</span>
                    <span className="font-semibold">{f.nama}</span>
                    {f.price_adjust > 0 && (
                      <span className="text-tx3 text-[10px] tabular-nums">
                        +{formatRupiahShort(f.price_adjust)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Permintaan Khusus */}
          {b.Extra_Request && (
            <Section title="✨ Permintaan Khusus">
              <div className="bg-amb border border-am rounded-md p-3 text-sm text-am leading-relaxed whitespace-pre-wrap">
                {b.Extra_Request}
              </div>
            </Section>
          )}

          {/* Catatan Internal */}
          {b.Catatan && (
            <Section title="📝 Catatan Internal">
              <div className="bg-sf2 border border-bd rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {b.Catatan}
              </div>
            </Section>
          )}

          {/* Payment History */}
          <Section title={`💵 Riwayat Pembayaran (${data.payments.length})`}>
            {data.payments.length === 0 ? (
              <div className="text-tx3 text-xs text-center py-3 bg-sf2 rounded-md">
                Belum ada pembayaran tercatat
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.payments.map((p) => (
                  <div key={p.PaymentID} className="bg-sf2 border border-bd rounded-md p-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          {p.Jenis_Bayar || 'Pembayaran'}
                          {p.Metode && (
                            <span className="text-[10px] font-medium text-tx3">· {p.Metode}</span>
                          )}
                        </div>
                        <div className="text-tx3 text-[10px] mt-0.5">
                          {formatDate(p.Tanggal_Bayar)}
                          {p.Diterima_Oleh && ` · oleh ${p.Diterima_Oleh}`}
                        </div>
                        {p.Catatan && (
                          <div className="text-tx3 text-[10px] mt-1 italic">"{p.Catatan}"</div>
                        )}
                        {p.Bukti_URLs.length > 0 && (
                          <div className="mt-1.5 flex gap-1.5">
                            {p.Bukti_URLs.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-bl font-semibold hover:underline"
                              >
                                📎 Bukti #{i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-xs tabular-nums text-gr">
                        +{formatRupiah(p.Nominal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Refund History (if any) */}
          {data.refunds && data.refunds.length > 0 && (
            <Section title={`↩️ Riwayat Refund (${data.refunds.length})`}>
              <div className="space-y-1.5">
                {data.refunds.map((r) => (
                  <div key={r.RefundID} className="bg-rdb border border-rd rounded-md p-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs">
                          {r.Jenis_Refund || 'Refund'}
                          {r.Metode && (
                            <span className="text-[10px] font-medium text-tx3"> · {r.Metode}</span>
                          )}
                        </div>
                        <div className="text-tx3 text-[10px] mt-0.5">
                          {formatDate(r.Tanggal_Refund)}
                          {r.Dikembalikan_Oleh && ` · oleh ${r.Dikembalikan_Oleh}`}
                        </div>
                        {r.Alasan && <div className="text-tx3 text-[10px] mt-1 italic">"{r.Alasan}"</div>}
                      </div>
                      <div className="font-bold text-xs tabular-nums text-rd">
                        -{formatRupiah(r.Nominal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Action Buttons */}
          {!isClosed && (
            <div className="pt-4 border-t border-bd space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onEdit}
                  disabled={processing}
                  className="btn btn-sec text-xs"
                >
                  ✏️ Edit Booking
                </button>
                {hasSisaBayar && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    disabled={processing}
                    className="btn btn-pri text-xs"
                  >
                    💵 Bayar Cicilan
                  </button>
                )}
                {isLunas && (
                  <button
                    onClick={handleSelesaikan}
                    disabled={processing}
                    className="btn btn-pri text-xs"
                  >
                    ✓ Selesaikan
                  </button>
                )}
                <button
                  onClick={() => setShowCancelRefundModal(true)}
                  disabled={processing}
                  className="btn text-xs bg-rd/10 text-rd hover:bg-rd/20 border border-rd/30"
                  title="Cancel atau refund booking"
                >
                  💸 Cancel/Refund
                </button>
              </div>
              <button
                onClick={handleDelete}
                disabled={processing}
                className="btn btn-danger text-xs w-full"
              >
                🗑️ Hapus Permanen
              </button>
            </div>
          )}

          {isClosed && (
            <div className="pt-4 border-t border-bd">
              <div className="bg-sf2 border border-bd rounded-md p-3 text-center text-xs text-tx3">
                🔒 Booking sudah ditutup ({b.Status_Booking}). Tidak bisa diedit.
              </div>
              <button
                onClick={handleDelete}
                disabled={processing}
                className="btn btn-danger text-xs w-full mt-2"
              >
                🗑️ Hapus Permanen
              </button>
            </div>
          )}

          {/* Metadata */}
          <div className="text-[10px] text-tx3 text-center pt-2">
            Created: {formatDate(b.Timestamp || '')}
            {b.Updated_At && ` · Updated: ${formatDate(b.Updated_At)}`}
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <PaymentModal
            booking={b}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => {
              setShowPaymentModal(false);
              invalidateAll();
            }}
          />
        )}

        {/* [B8] Cancel/Refund Modal */}
        {showCancelRefundModal && (
          <CancelRefundModal
            booking={b}
            onClose={() => setShowCancelRefundModal(false)}
            onSuccess={() => {
              setShowCancelRefundModal(false);
              invalidateAll();
              // Optionally close drawer after cancel
              if (b.Status_Booking?.startsWith('CANCEL')) {
                onClose();
              }
            }}
          />
        )}
      </aside>
    </div>
  );
}

// ===========================================
// Sub-components
// ===========================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-tx3 mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-tx3 flex-shrink-0">{label}</span>
      <span className={`font-semibold text-right tabular-nums ${accent || 'text-tx'}`}>{value}</span>
    </div>
  );
}

// ===========================================
// Payment Modal (Bayar Cicilan)
// ===========================================

function PaymentModal({
  booking,
  onClose,
  onSuccess,
}: {
  booking: BookingItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nominal, setNominal] = useState(booking.Sisa_Bayar);
  const [metode, setMetode] = useState('CASH');
  const [diterimaOleh, setDiterimaOleh] = useState('');
  const [catatan, setCatatan] = useState('');
  const [jenisBayar, setJenisBayar] = useState(
    booking.Total_Bayar === 0 ? 'DP' : booking.Sisa_Bayar === nominal ? 'PELUNASAN' : 'CICILAN',
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (nominal <= 0) {
      toast.error('Nominal harus lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitPayment({
        bookingId: booking.BookingID,
        nominal,
        jenisBayar,
        metode,
        diterimaOleh,
        catatan,
      });
      toast.success(`Pembayaran ${formatRupiah(nominal)} berhasil dicatat ✓`);
      onSuccess();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-sf w-full max-w-md rounded-lg shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-base">💵 Bayar Cicilan</h3>
            <p className="text-tx3 text-xs mt-0.5">{booking.Nama_Customer} · {booking.Nama_Kamar}</p>
          </div>
          <button onClick={onClose} className="text-tx3 hover:text-tx">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-sf2 rounded-md p-3 mb-4 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-tx3">Total tagihan</span>
            <span className="font-semibold tabular-nums">{formatRupiah(booking.Harga_Total_Net)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tx3">Sudah dibayar</span>
            <span className="font-semibold tabular-nums text-gr">{formatRupiah(booking.Net_Diterima)}</span>
          </div>
          <div className="flex justify-between border-t border-bd pt-1 mt-1">
            <span className="font-bold">Sisa</span>
            <span className="font-bold tabular-nums text-rd">{formatRupiah(booking.Sisa_Bayar)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-tx2 mb-1 block">
              Nominal Pembayaran <span className="text-rd">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3 text-xs font-semibold pointer-events-none">
                Rp
              </span>
              <input
                type="number"
                value={nominal}
                onChange={(e) => setNominal(parseInt(e.target.value) || 0)}
                className="input pl-9 tabular-nums"
                min={1}
                max={booking.Sisa_Bayar}
                required
              />
            </div>
            <div className="flex gap-1 mt-1.5">
              <button
                type="button"
                onClick={() => setNominal(booking.Sisa_Bayar)}
                className="btn btn-sec btn-sm text-[10px]"
              >
                Bayar Lunas ({formatRupiahShort(booking.Sisa_Bayar)})
              </button>
              <button
                type="button"
                onClick={() => setNominal(Math.round(booking.Sisa_Bayar / 2))}
                className="btn btn-sec btn-sm text-[10px]"
              >
                Setengah
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-tx2 mb-1 block">Jenis</label>
              <select value={jenisBayar} onChange={(e) => setJenisBayar(e.target.value)} className="input">
                <option value="DP">DP</option>
                <option value="CICILAN">Cicilan</option>
                <option value="PELUNASAN">Pelunasan</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-tx2 mb-1 block">Metode</label>
              <select value={metode} onChange={(e) => setMetode(e.target.value)} className="input">
                <option value="CASH">Cash</option>
                <option value="TRANSFER">Transfer Bank</option>
                <option value="QRIS">QRIS</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-tx2 mb-1 block">Diterima Oleh</label>
            <input
              type="text"
              value={diterimaOleh}
              onChange={(e) => setDiterimaOleh(e.target.value)}
              placeholder="Nama penerima"
              className="input"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-tx2 mb-1 block">Catatan</label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Optional..."
              rows={2}
              className="input resize-y"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-sec flex-1">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="btn btn-pri flex-1">
              {submitting ? '⏳ Saving...' : '✓ Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
