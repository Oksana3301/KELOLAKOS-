'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingItem, type BookingFullData, type PaymentRecord } from '@/lib/api';
import { facilityApi, kwitansiApi } from '@/lib/api-v2';
import { ScreenHead, KkButton, KkCard, BayarBadge, StickyCTA } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { PaymentConfirm, DeleteConfirm } from '@/components/kk/confirm';
import { mapPayStatus, rupiah, tglPendek, type PayStatus } from '@/components/kk/status';
import { BookingFlow, BookingDetail, CancelConfirm, RefundForm, TagihWa } from '@/components/kk/booking-ui';
import { PendingConfirmations } from '@/components/kk/pending-confirmations';

const HELP = {
  title: 'Booking',
  tips: [
    'Di sini Anda melihat semua penyewa dan mengelola booking mereka.',
    'Tekan tombol oranye "Tambah Penyewa Baru" untuk mencatat penyewa baru — cukup ikuti langkahnya.',
    'Saat memilih kamar, harga mengikuti tipe & gedung kamar itu. Kalau tertulis "harga belum diatur", set dulu di menu Kamar / Pengaturan → Harga.',
    'Untuk penyewa yang baru bayar sebagian (DP), kartunya menampilkan jumlah Dibayar dan Sisa langsung — tidak perlu buka detail.',
    'Tekan satu kartu penyewa untuk melihat rincian, mencatat pembayaran, menagih lewat WhatsApp, mengubah, refund, atau membatalkan booking.',
  ],
};

type TabId = 'semua' | 'Belum Bayar' | 'DP' | 'Lunas' | 'Batal';

const TABS: { id: TabId; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'Belum Bayar', label: 'Belum Bayar' },
  { id: 'DP', label: 'DP' },
  { id: 'Lunas', label: 'Lunas' },
  { id: 'Batal', label: 'Batal' },
];

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingPageInner />
    </Suspense>
  );
}

function BookingPageInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabId>('semua');
  const [cari, setCari] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // Add / edit flow
  const [showFlow, setShowFlow] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingFullData | null>(null);
  const [editFacilityIds, setEditFacilityIds] = useState<string[]>([]);

  // Detail sheet + its derived dialogs
  const [detail, setDetail] = useState<BookingFullData | null>(null);
  const [detailPayments, setDetailPayments] = useState<PaymentRecord[]>([]);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<BookingFullData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingFullData | null>(null);
  const [refundTarget, setRefundTarget] = useState<BookingFullData | null>(null);
  const [tagihTarget, setTagihTarget] = useState<BookingFullData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingFullData | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // Active facilities (offered as add-ons during booking).
  const { data: facilities } = useQuery({
    queryKey: ['fasilitas'],
    queryFn: facilityApi.list,
  });

  // Business name for the WhatsApp billing template.
  const { data: bizSettings } = useQuery({
    queryKey: ['kwitansi-settings'],
    queryFn: kwitansiApi.get,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat data: ' + (error as Error).message);
  }, [isError, error]);

  // Auto-open the new-booking flow when navigated with ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditBooking(null);
      setShowFlow(true);
      router.replace('/booking');
    }
  }, [searchParams, router]);

  // Combine all booking lists into one (preserve existing dedupe behavior).
  const allBookings = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const combined: BookingItem[] = [];
    [
      ...(data.paymentBookings || []),
      ...(data.statusActionBookings || []),
      ...(data.closingBookings || []),
      ...(data.feeBookingOptions || []),
    ].forEach((b) => {
      if (!seen.has(b.BookingID)) {
        seen.add(b.BookingID);
        combined.push(b);
      }
    });
    return combined;
  }, [data]);

  // Deep-link from the Uang menu: ?open=<BookingID> opens that booking's detail.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || !data) return;
    const found = allBookings.find((b) => b.BookingID === openId);
    if (found) openDetail(found);
    router.replace('/booking');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, data, allBookings]);

  const filtered = useMemo(() => {
    let list = allBookings;
    if (tab !== 'semua') {
      list = list.filter((b) => mapPayStatus(b) === (tab as PayStatus));
    }
    if (cari) {
      const q = cari.toLowerCase();
      list = list.filter(
        (b) =>
          b.Nama_Customer.toLowerCase().includes(q) || b.Nama_Kamar.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allBookings, tab, cari]);

  // Open the detail sheet — fetch full data first so all fields are present.
  function openDetail(b: BookingItem) {
    // Open immediately with the list data so the tap feels instant, then
    // enrich with the full detail (payments + facilities) in the background.
    setDetail(b as BookingFullData);
    setDetailPayments([]);
    setEditFacilityIds([]);
    refreshDetail(b.BookingID);
  }

  // (Re)load the open booking's full detail — used on open and after a payment
  // is deleted, so the sheet reflects the recomputed status/sisa immediately.
  function refreshDetail(bookingId: string) {
    api
      .getBookingDetail(bookingId)
      .then((d) => {
        setDetail(d.booking);
        setDetailPayments(d.payments || []);
        setEditFacilityIds((d.facilities || []).map((f) => f.id));
      })
      .catch((e) => toast.error('Gagal memuat detail lengkap: ' + (e as Error).message));
  }

  async function handleDeletePayment(paymentId: string) {
    if (!detail) return;
    setDeletingPaymentId(paymentId);
    try {
      await api.submitTransactionDelete({ type: 'PAYMENT', id: paymentId });
      toast.success('Pembayaran dihapus. Status booking diperbarui.');
      invalidateAll(detail.BookingID); // daftar booking, kwitansi (initial-data), uang, laporan
      refreshDetail(detail.BookingID); // perbarui sheet detail yang sedang terbuka
    } catch (e) {
      toast.error('Gagal menghapus pembayaran: ' + (e as Error).message);
    } finally {
      setDeletingPaymentId(null);
    }
  }

  function openEdit(b: BookingFullData) {
    setDetail(null);
    setEditBooking(b);
    setShowFlow(true);
  }

  // ── Mutations ──
  function invalidateAll(id?: string) {
    qc.invalidateQueries({ queryKey: ['initial-data'] });
    if (id) qc.invalidateQueries({ queryKey: ['booking-detail', id] });
    qc.invalidateQueries({ queryKey: ['recent-transactions'] });
    qc.invalidateQueries({ queryKey: ['report-data'] });
  }

  const payMutation = useMutation({
    mutationFn: (b: BookingFullData) =>
      api.submitPayment({ bookingId: b.BookingID, nominal: b.Sisa_Bayar, jenisBayar: 'PELUNASAN' }),
    onSuccess: (_r, b) => {
      toast.success('✓ Pembayaran tercatat');
      invalidateAll(b.BookingID);
      setPayTarget(null);
    },
    onError: (e) => toast.error('Gagal mencatat: ' + (e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (b: BookingFullData) => {
      const dibayar = Number(b.Total_Bayar) || 0;
      const existingRefund = Number(b.Refund_Total) || 0;
      const maxRefund = Math.max(0, dibayar - existingRefund);
      if (maxRefund > 0) {
        // Tenant already paid → cancel with a recorded refund.
        return api.submitStatusAction({
          bookingId: b.BookingID,
          statusBooking: 'CANCEL_DENGAN_REFUND',
          refundNominal: maxRefund,
          jenisRefund: 'CANCEL_REFUND',
          metodeRefund: 'TUNAI',
          dikembalikanOleh: 'admin',
          alasanRefund: 'Booking dibatalkan',
          tanggalRefund: new Date().toISOString().split('T')[0],
          catatanTambahan: 'Booking dibatalkan',
        });
      }
      // Nothing paid → plain cancel.
      return api.submitStatusAction({
        bookingId: b.BookingID,
        statusBooking: 'CANCEL_TANPA_DP',
        catatanTambahan: 'Booking dibatalkan',
      });
    },
    onSuccess: (_r, b) => {
      toast.success('✓ Booking dibatalkan');
      invalidateAll(b.BookingID);
      setCancelTarget(null);
      setDetail(null);
    },
    onError: (e) => toast.error('Gagal membatalkan: ' + (e as Error).message),
  });

  // Partial refund — booking stays active; backend recomputes net & sisa.
  const refundMutation = useMutation({
    mutationFn: (v: { b: BookingFullData; nominal: number; metode: string; alasan: string }) =>
      api.submitRefund({
        bookingId: v.b.BookingID,
        nominal: v.nominal,
        jenisRefund: 'REFUND_SEBAGIAN',
        metodeRefund: v.metode,
        dikembalikanOleh: 'admin',
        alasanRefund: v.alasan || 'Refund',
        tanggalRefund: new Date().toISOString().split('T')[0],
      }),
    onSuccess: (_r, v) => {
      toast.success('✓ Refund tercatat');
      invalidateAll(v.b.BookingID);
      setRefundTarget(null);
      refreshDetail(v.b.BookingID);
    },
    onError: (e) => toast.error('Gagal refund: ' + (e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (b: BookingFullData) => api.submitBookingDelete(b.BookingID),
    onSuccess: (r, b) => {
      toast.success(r.message || '✓ Booking dihapus');
      invalidateAll(b.BookingID);
      setDeleteTarget(null);
      setDetail(null);
    },
    onError: (e) => toast.error('Gagal menghapus: ' + (e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
        <div className="text-body text-kk-ink">Memuat data…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <KkCard className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
          <KkIcon name="info" size={30} />
        </div>
        <h2 className="font-heading font-bold text-subhead mb-2">Gagal memuat data</h2>
        <p className="text-body text-kk-ink mb-5">{(error as Error)?.message || 'Terjadi kesalahan'}</p>
        <KkButton variant="primary" onClick={() => refetch()}>
          Coba Lagi
        </KkButton>
      </KkCard>
    );
  }

  return (
    <>
      <ScreenHead
        title="Booking"
        sub={`${allBookings.length} penyewa terdaftar`}
        onHelp={() => setHelpOpen(true)}
      />

      <StickyCTA>
        <KkButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            setEditBooking(null);
            setShowFlow(true);
          }}
        >
          <KkIcon name="tambah" size={24} /> Tambah Penyewa Baru
        </KkButton>
      </StickyCTA>

      {/* Booking dari /info yang butuh konfirmasi */}
      <PendingConfirmations />

      {/* Search */}
      <div className="mb-4">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama penyewa…"
          className="kk-input"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-5 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[17px] border-2 ${
              tab === t.id
                ? 'border-kk-navy bg-kk-navy text-white'
                : 'border-kk-mauve bg-white text-kk-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <KkCard className="text-center text-body text-kk-ink py-7">
            {cari || tab !== 'semua'
              ? 'Tidak ada penyewa di kategori ini.'
              : 'Belum ada booking. Tekan tombol Tambah Penyewa di atas untuk mencatat penyewa pertama Anda.'}
          </KkCard>
        ) : (
          filtered.map((b) => <BookingCard key={b.BookingID} booking={b} onClick={() => openDetail(b)} />)
        )}
      </div>

      {/* ── Modals & sheets ── */}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />

      <BookingFlow
        open={showFlow}
        onClose={() => {
          setShowFlow(false);
          setEditBooking(null);
          setEditFacilityIds([]);
        }}
        rooms={data.roomStatus || []}
        prices={data.prices || []}
        roomPriceRules={data.roomPriceRules || []}
        editBooking={editBooking}
        facilities={facilities || []}
        editFacilityIds={editFacilityIds}
      />

      {detail && (
        <BookingDetail
          booking={detail}
          payments={detailPayments}
          deletingPaymentId={deletingPaymentId}
          onClose={() => {
            setDetail(null);
            setDetailPayments([]);
          }}
          onPay={() => setPayTarget(detail)}
          onEdit={() => openEdit(detail)}
          onCancel={() => setCancelTarget(detail)}
          onRefund={() => setRefundTarget(detail)}
          onTagih={() => setTagihTarget(detail)}
          onDelete={() => setDeleteTarget(detail)}
          onDeletePayment={handleDeletePayment}
        />
      )}

      {refundTarget && (
        <RefundForm
          booking={refundTarget}
          loading={refundMutation.isPending}
          onClose={() => setRefundTarget(null)}
          onConfirm={(nominal, metode, alasan) =>
            refundMutation.mutate({ b: refundTarget, nominal, metode, alasan })
          }
        />
      )}

      {tagihTarget && (
        <TagihWa
          booking={tagihTarget}
          businessName={bizSettings?.business_name}
          onClose={() => setTagihTarget(null)}
        />
      )}

      <PaymentConfirm
        open={!!payTarget}
        name={payTarget?.Nama_Customer || ''}
        amount={payTarget?.Sisa_Bayar || 0}
        loading={payMutation.isPending}
        onConfirm={() => payTarget && payMutation.mutate(payTarget)}
        onCancel={() => setPayTarget(null)}
      />

      {cancelTarget && (
        <CancelConfirm
          booking={cancelTarget}
          loading={cancelMutation.isPending}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => cancelMutation.mutate(cancelTarget)}
        />
      )}

      <DeleteConfirm
        open={!!deleteTarget}
        title={`Hapus data ${deleteTarget?.Nama_Customer || ''}?`}
        message="Tenang, data lain tidak terpengaruh. Booking ini beserta catatan pembayarannya akan dihapus dari daftar."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

// ───────────────────────── Booking card ─────────────────────────
function BookingCard({ booking: b, onClick }: { booking: BookingItem; onClick: () => void }) {
  const status = mapPayStatus(b);
  const batal = status === 'Batal';
  const total = Number(b.Harga_Total_Net) || 0;
  const dibayar = Number(b.Net_Diterima ?? b.Total_Bayar) || 0;
  const sisa = b.Sisa_Bayar != null ? Number(b.Sisa_Bayar) : Math.max(total - dibayar, 0);
  // Show the paid/remaining split whenever money is still owed (DP / belum lunas).
  const showSplit = !batal && sisa > 0;
  return (
    <KkCard onClick={onClick} className={batal ? 'opacity-[0.72]' : ''}>
      <div className="flex justify-between items-start gap-3 mb-2.5">
        <div className="min-w-0">
          <div
            className={`font-heading font-bold text-[20px] text-kk-navy truncate ${
              batal ? 'line-through decoration-kk-ink' : ''
            }`}
          >
            {b.Nama_Customer || '(tanpa nama)'}
          </div>
          <div className="text-[17px] text-kk-ink mt-0.5 truncate">{b.Nama_Kamar}</div>
        </div>
        <BayarBadge status={status} />
      </div>
      <div className="flex justify-between items-baseline border-t border-kk-mauve-soft pt-2.5">
        <span className="text-caption text-kk-ink">
          {tglPendek(b.CheckIn)} → {tglPendek(b.CheckOut)}
        </span>
        <span className="font-heading font-bold text-[19px] text-kk-navy">{rupiah(total)}</span>
      </div>
      {showSplit && (
        <div className="flex justify-between items-baseline gap-2 mt-1.5">
          <span className="text-caption font-semibold text-kk-green">Dibayar {rupiah(dibayar)}</span>
          <span className="text-caption font-semibold text-kk-orange">Sisa {rupiah(sisa)}</span>
        </div>
      )}
      <div className="flex items-center justify-end gap-1 mt-2.5 text-caption font-semibold text-kk-orange">
        Ketuk untuk detail &amp; ubah
        <KkIcon name="chevron" size={16} strokeWidth={2.6} />
      </div>
    </KkCard>
  );
}
