'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingItem, type BookingFullData } from '@/lib/api';
import { facilityApi } from '@/lib/api-v2';
import { ScreenHead, KkButton, KkCard, BayarBadge, StickyCTA } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { PaymentConfirm, DeleteConfirm } from '@/components/kk/confirm';
import { mapPayStatus, rupiah, tglPendek, type PayStatus } from '@/components/kk/status';
import { BookingFlow, BookingDetail, CancelConfirm } from '@/components/kk/booking-ui';

const HELP = {
  title: 'Booking',
  tips: [
    'Di sini Anda melihat semua penyewa dan mengelola booking mereka.',
    'Tekan tombol oranye "Tambah Penyewa Baru" untuk mencatat penyewa baru — cukup ikuti 3 langkah.',
    'Tekan satu kartu penyewa untuk melihat rincian, mencatat pembayaran, mengubah, atau membatalkan booking.',
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
  const [payTarget, setPayTarget] = useState<BookingFullData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingFullData | null>(null);
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
  async function openDetail(b: BookingItem) {
    try {
      const d = await api.getBookingDetail(b.BookingID);
      setDetail(d.booking);
      setEditFacilityIds((d.facilities || []).map((f) => f.id));
    } catch (e) {
      toast.error('Gagal memuat detail: ' + (e as Error).message);
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
        editBooking={editBooking}
        facilities={facilities || []}
        editFacilityIds={editFacilityIds}
      />

      {detail && (
        <BookingDetail
          booking={detail}
          onClose={() => setDetail(null)}
          onPay={() => setPayTarget(detail)}
          onEdit={() => openEdit(detail)}
          onCancel={() => setCancelTarget(detail)}
          onDelete={() => setDeleteTarget(detail)}
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
        <span className="font-heading font-bold text-[19px] text-kk-navy">
          {rupiah(b.Harga_Total_Net)}
        </span>
      </div>
    </KkCard>
  );
}
