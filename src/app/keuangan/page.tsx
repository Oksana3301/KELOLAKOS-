'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type BookingItem, type RecentTransaction, type ReportTransaction } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import {
  KkPeriodFilter,
  MoneyKpiGrid,
  MoneyKpiDetail,
  periodLabel,
  resolvePeriod,
  type PeriodValue,
  type MoneyData,
} from '@/components/kk/money';
import { HelpSheet } from '@/components/kk/help-sheet';
import { DeleteConfirm } from '@/components/kk/confirm';
import { rupiah } from '@/components/kk/status';
import {
  JENIS,
  JenisCard,
  RiwayatRow,
  TransaksiFormSheet,
  type JenisId,
  type RiwayatTx,
} from '@/components/kk/keuangan-ui';

const HELP = {
  title: 'Uang',
  tips: [
    'Tekan salah satu dari 4 kotak di atas untuk mencatat uang masuk atau keluar. Hijau berarti uang masuk, oranye berarti uang keluar.',
    'Saat mengisi nominal, titik ribuan muncul otomatis (mis. 2.000.000) jadi mudah dibaca.',
    'Bagian ringkasan menunjukkan total uang Anda pada periode yang dipilih. Ganti periode dengan tombol Bulan Ini, dll.',
    'Di "Riwayat Transaksi", catatan dari sewa kamar menampilkan kamar & penyewanya — tekan "Lihat booking" untuk membuka bookingnya. Tekan tombol tempat sampah untuk menghapus satu catatan.',
  ],
};

export default function KeuanganPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'this_month' });
  const [detailKpi, setDetailKpi] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [formJenis, setFormJenis] = useState<JenisId | null>(null);
  const [hapusTarget, setHapusTarget] = useState<RiwayatTx | null>(null);

  // Dashboard / init data — for all-time money fallback + booking choices.
  const { data: initialData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // Period resolution (mirrors Beranda).
  const resolved = useMemo(() => resolvePeriod(period), [period]);
  const { data: periodData } = useQuery({
    queryKey: ['report-data', resolved?.start, resolved?.end],
    queryFn: () => api.getReportData(resolved!.start, resolved!.end),
    enabled: !!resolved,
  });

  // Recent transactions — used for the riwayat list (delete-able).
  const { data: recentData, isLoading: loadingRecent } = useQuery({
    queryKey: ['recent-transactions', 30],
    queryFn: () => api.getRecentTransactions(30),
    enabled: !resolved,
  });

  const loadingTx = resolved ? !periodData : loadingRecent;

  // Booking choices for Pembayaran/Refund forms.
  const allBookings = useMemo(() => {
    if (!initialData) return [] as BookingItem[];
    const seen = new Set<string>();
    const combined: BookingItem[] = [];
    [
      ...(initialData.paymentBookings || []),
      ...(initialData.statusActionBookings || []),
      ...(initialData.closingBookings || []),
      ...(initialData.feeBookingOptions || []),
    ].forEach((b) => {
      if (!seen.has(b.BookingID)) {
        seen.add(b.BookingID);
        combined.push(b);
      }
    });
    return combined;
  }, [initialData]);

  // BookingID → booking, so each money row can show "kamar · penyewa" and link
  // back to the exact booking it came from.
  const bookingById = useMemo(() => {
    const m = new Map<string, BookingItem>();
    allBookings.forEach((b) => m.set(b.BookingID, b));
    return m;
  }, [allBookings]);

  // Build a readable rincian (room · tenant) for a booking-linked transaction.
  function rincianFor(bookingId: string, fallback: string): string {
    const b = bookingId ? bookingById.get(bookingId) : undefined;
    if (b) return [b.Nama_Kamar, b.Nama_Customer].filter(Boolean).join(' · ');
    return fallback;
  }

  // Riwayat list from either source (period → report rows have no id → delete disabled).
  const transactions: RiwayatTx[] = useMemo(() => {
    if (resolved && periodData) {
      return periodData.transactions.map((t: ReportTransaction) => ({
        type: t.type,
        id: '',
        title: t.title,
        subtitle: t.subtitle,
        nominal: t.nominal,
        direction: t.direction,
        date: t.date,
        bookingId: t.bookingId,
        rincian: t.bookingId ? rincianFor(t.bookingId, t.subtitle) : t.subtitle,
      }));
    }
    if (!resolved && recentData) {
      return recentData.transactions.map((t: RecentTransaction) => ({
        type: t.type,
        id: t.id,
        title: t.title,
        subtitle: t.subtitle,
        nominal: t.nominal,
        direction: t.direction,
        date: t.date,
        bookingId: t.bookingId,
        rincian: t.bookingId ? rincianFor(t.bookingId, t.subtitle) : t.subtitle,
      }));
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, periodData, recentData, bookingById]);

  // Delete mutation — same api fn + invalidations as the old page.
  const deleteMutation = useMutation({
    mutationFn: (tx: RiwayatTx) =>
      api.submitTransactionDelete({ type: tx.type, id: tx.id }),
    onSuccess: (result) => {
      toast.success(result.message || 'Catatan telah dihapus');
      setHapusTarget(null);
      qc.invalidateQueries({ queryKey: ['recent-transactions'] });
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['report-data'] });
    },
    onError: (e) => toast.error('Gagal hapus: ' + (e as Error).message),
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat data: ' + (error as Error).message);
  }, [isError, error]);

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
        <div className="text-body text-kk-ink">Memuat data…</div>
      </div>
    );
  }

  if (isError || !initialData) {
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

  const d = initialData.dashboard;

  // Money summary — identical wiring to Beranda. "Sisa Uang" is all-time cash.
  const money: MoneyData = resolved && periodData
    ? {
        masuk: periodData.summary.totalIn,
        keluar: periodData.summary.totalOut,
        sisa: d.netCash,
        label: periodLabel(period),
      }
    : {
        masuk: d.pendapatanKotor,
        keluar: d.totalBelanja + d.totalFee + d.totalRefund,
        sisa: d.netCash,
        label: periodLabel(period),
      };

  const breakdown = periodData
    ? {
        keluar: [
          { l: 'Belanja operasional', v: periodData.summary.totalExpense },
          { l: 'Gaji penjaga', v: periodData.summary.totalFee },
          { l: 'Refund', v: periodData.summary.totalRefund },
        ].filter((r) => r.v > 0),
      }
    : undefined;

  return (
    <>
      <ScreenHead
        title="Uang"
        sub="Catat dan lihat uang masuk dan keluar."
        onHelp={() => setHelpOpen(true)}
      />

      {/* ── Catat Transaksi Baru ── */}
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="font-heading font-bold text-subhead text-kk-navy m-0">Catat Transaksi Baru</h2>
        <span className="text-caption text-kk-ink">Hijau masuk · oranye keluar</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {(Object.keys(JENIS) as JenisId[]).map((id) => (
          <JenisCard key={id} jenis={JENIS[id]} onClick={() => setFormJenis(id)} />
        ))}
      </div>

      {/* ── Ringkasan uang (period filter + KPI cards) ── */}
      <KkPeriodFilter value={period} onChange={setPeriod} />
      <MoneyKpiGrid data={money} onDetail={setDetailKpi} />

      {/* ── Riwayat Transaksi ── */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <h2 className="font-heading font-bold text-subhead text-kk-navy m-0">Riwayat Transaksi</h2>
        <span className="text-body font-semibold text-kk-ink">
          {loadingTx ? '…' : `${transactions.length} catatan`}
        </span>
      </div>

      {resolved && (
        <KkCard tone="mint" className="mb-3 flex items-start gap-3 !py-3">
          <KkIcon name="info" size={22} className="text-kk-navy flex-shrink-0 mt-0.5" />
          <p className="text-body text-kk-navy m-0 leading-snug">
            Sedang melihat periode tertentu. Untuk menghapus catatan, pilih &quot;Hari Ini&quot;,
            &quot;Minggu Ini&quot;, dll. lalu kembali ke daftar terbaru.
          </p>
        </KkCard>
      )}

      <div className="space-y-2.5">
        {loadingTx ? (
          <KkCard className="text-center text-body text-kk-ink py-8">Memuat…</KkCard>
        ) : transactions.length === 0 ? (
          <KkCard className="text-center text-body text-kk-ink py-8">Belum ada transaksi.</KkCard>
        ) : (
          transactions.map((tx, idx) => (
            <RiwayatRow
              key={`${tx.type}-${tx.id || idx}`}
              tx={tx}
              dateLabel={new Date(tx.date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
              })}
              deleteDisabled={!tx.id}
              onDelete={() => setHapusTarget(tx)}
              onOpen={tx.bookingId ? () => router.push(`/booking?open=${tx.bookingId}`) : undefined}
            />
          ))
        )}
      </div>

      {/* ── Modals ── */}
      {detailKpi && (
        <MoneyKpiDetail
          id={detailKpi}
          data={money}
          breakdown={breakdown}
          onClose={() => setDetailKpi(null)}
        />
      )}

      <TransaksiFormSheet
        jenisId={formJenis}
        bookings={allBookings}
        onClose={() => setFormJenis(null)}
      />

      <DeleteConfirm
        open={!!hapusTarget}
        title="Hapus catatan ini?"
        loading={deleteMutation.isPending}
        message={
          hapusTarget ? (
            <>
              Catatan{' '}
              <b className="text-kk-navy">
                {hapusTarget.type === 'PAYMENT'
                  ? 'Pembayaran'
                  : hapusTarget.type === 'REFUND'
                    ? 'Refund'
                    : hapusTarget.type === 'FEE'
                      ? 'Fee Penjaga'
                      : 'Belanja Operasional'}
              </b>{' '}
              sebesar <b className="text-kk-navy">{rupiah(hapusTarget.nominal)}</b> akan dihapus.
              Tenang, catatan lain tidak terpengaruh.
            </>
          ) : (
            ''
          )
        }
        onConfirm={() => hapusTarget && deleteMutation.mutate(hapusTarget)}
        onCancel={() => setHapusTarget(null)}
      />

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
    </>
  );
}
