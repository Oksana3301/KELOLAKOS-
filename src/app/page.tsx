'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type BookingItem, type BookingFullData } from '@/lib/api';
import { kwitansiApi } from '@/lib/api-v2';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, BayarBadge } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { TagihWa } from '@/components/kk/booking-ui';
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
import { mapRoomStatus, mapPayStatus, rupiah } from '@/components/kk/status';

const HELP = {
  title: 'Beranda',
  tips: [
    'Di sini Anda melihat ringkasan uang dan kamar properti Anda hari ini.',
    'Gunakan tombol periode (Bulan Ini, dll.) untuk melihat angka pada rentang waktu lain.',
    'Bagian "Perlu Tindakan" menampilkan penyewa yang belum lunas — tekan "Tagih" untuk mengirim pengingat lewat WhatsApp.',
  ],
};

export default function BerandaPage() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'this_month' });
  const [detailKpi, setDetailKpi] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tagih, setTagih] = useState<BookingItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  const resolved = useMemo(() => resolvePeriod(period), [period]);
  const { data: periodData } = useQuery({
    queryKey: ['report-data', resolved?.start, resolved?.end],
    queryFn: () => api.getReportData(resolved!.start, resolved!.end),
    enabled: !!resolved,
  });

  const { data: bizSettings } = useQuery({
    queryKey: ['kwitansi-settings'],
    queryFn: kwitansiApi.get,
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

  const d = data.dashboard;
  const rooms = data.roomStatus;

  // Money: when a period is active, use period totals; "Sisa Uang" is an
  // all-time cash-on-hand snapshot that never changes with the filter.
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

  // Room counts (3 plain statuses)
  const roomStats = rooms.reduce(
    (acc, r) => {
      const s = mapRoomStatus(r);
      if (s === 'Terisi') acc.terisi++;
      else if (s === 'Tersedia') acc.kosong++;
      else acc.perhatian++;
      return acc;
    },
    { terisi: 0, kosong: 0, perhatian: 0 },
  );

  // Perlu Tindakan: bookings that still owe money (Belum Bayar / DP)
  const perluTindakan = [...(data.paymentBookings || []), ...(data.statusActionBookings || [])]
    .filter((b) => (b.Sisa_Bayar ?? 0) > 0)
    .filter((b, i, arr) => arr.findIndex((x) => x.BookingID === b.BookingID) === i);

  return (
    <>
      <ScreenHead
        title="Selamat datang"
        sub="Ini ringkasan properti Anda hari ini."
        onHelp={() => setHelpOpen(true)}
      />

      <KkPeriodFilter value={period} onChange={setPeriod} />

      <MoneyKpiGrid data={money} onDetail={setDetailKpi} />

      {/* Status Kamar */}
      <Link href="/kamar" className="block mt-6">
        <KkCard className="hover:border-kk-navy transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-subhead m-0">Status Kamar</h2>
            <span className="flex items-center gap-1 text-body font-semibold text-kk-ink">
              Lihat semua <KkIcon name="chevron" size={18} strokeWidth={2.4} />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <RoomStat dot="bg-kk-green" value={roomStats.terisi} label="Terisi" />
            <RoomStat dot="bg-kk-ink" value={roomStats.kosong} label="Masih Kosong" />
            <RoomStat dot="bg-kk-orange" value={roomStats.perhatian} label="Perlu Perhatian" />
          </div>
        </KkCard>
      </Link>

      {/* Perlu Tindakan */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-heading font-bold text-subhead m-0">Perlu Tindakan</h2>
          {perluTindakan.length > 0 && (
            <span className="kk-badge bg-kk-orange text-white">{perluTindakan.length}</span>
          )}
        </div>

        {perluTindakan.length === 0 ? (
          <KkCard tone="mint" className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white text-kk-green grid place-items-center flex-shrink-0">
              <KkIcon name="cek" size={28} />
            </div>
            <p className="text-body text-kk-navy m-0">Semua sudah lunas. Tidak ada yang perlu ditagih.</p>
          </KkCard>
        ) : (
          <div className="space-y-3">
            {perluTindakan.map((b) => (
              <KkCard key={b.BookingID} className="flex items-center gap-3 flex-wrap">
                <div className="basis-full sm:flex-1 sm:basis-0 min-w-0">
                  <div className="font-heading font-bold text-[20px] break-words">
                    {b.Nama_Customer || '(tanpa nama)'}
                  </div>
                  <div className="text-caption text-kk-ink mt-0.5">
                    {b.Nama_Kamar} · Sisa {rupiah(b.Sisa_Bayar)}
                  </div>
                </div>
                <BayarBadge status={mapPayStatus(b)} />
                <KkButton
                  variant="success"
                  className="min-h-[50px] px-5 text-[18px] ml-auto sm:ml-0"
                  onClick={() => setTagih(b)}
                >
                  Tagih
                </KkButton>
              </KkCard>
            ))}
          </div>
        )}
      </div>

      {/* Primary action */}
      <Link href="/booking?new=1" className="block mt-7">
        <KkButton variant="primary" size="lg" block>
          <KkIcon name="tambah" size={24} /> Tambah Penyewa Baru
        </KkButton>
      </Link>

      {/* Modals */}
      {detailKpi && (
        <MoneyKpiDetail
          id={detailKpi}
          data={money}
          breakdown={breakdown}
          onClose={() => setDetailKpi(null)}
        />
      )}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
      {tagih && (
        <TagihWa
          booking={tagih as BookingFullData}
          businessName={bizSettings?.business_name}
          onClose={() => setTagih(null)}
        />
      )}
    </>
  );
}

function RoomStat({ dot, value, label }: { dot: string; value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className={`w-3 h-3 rounded-full ${dot}`} />
      </div>
      <div className="font-heading font-black text-[30px] leading-none tabular-nums">{value}</div>
      <div className="text-caption text-kk-ink mt-1">{label}</div>
    </div>
  );
}
