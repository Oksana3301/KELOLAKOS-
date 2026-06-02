'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, type InitialData, type ReportData } from '@/lib/api';
import { formatRupiah, formatRupiahShort } from '@/lib/utils';
import { Topbar } from '@/components/topbar';
import { KpiDetailModal, type KpiDetailType } from '@/components/kpi-detail-modal';
import { PeriodFilter, resolvePeriod, type PeriodValue } from '@/components/period-filter';
import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';

export default function BerandaPage() {
  const [selectedKpi, setSelectedKpi] = useState<KpiDetailType | null>(null);
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'all' });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // [B7] Fetch period-filtered KPIs when period selected
  const resolvedPeriod = useMemo(() => resolvePeriod(period), [period]);
  const { data: periodData } = useQuery({
    queryKey: ['report-data', resolvedPeriod?.start, resolvedPeriod?.end],
    queryFn: () => api.getReportData(resolvedPeriod!.start, resolvedPeriod!.end),
    enabled: !!resolvedPeriod,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal load data: ' + (error as Error).message);
  }, [isError, error]);

  if (isLoading) {
    return (
      <main className="max-w-[1240px] mx-auto p-5">
        <Topbar />
        <div className="text-center py-20">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-tx3 text-sm">Loading data dari Apps Script…</div>
        </div>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="max-w-[1240px] mx-auto p-5">
        <Topbar />
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-tx font-bold mb-2">Gagal load data</div>
          <div className="text-tx3 text-xs mb-4">{(error as Error)?.message || 'Unknown error'}</div>
          <button onClick={() => refetch()} className="btn btn-pri">
            🔄 Coba lagi
          </button>
        </div>
      </main>
    );
  }

  const d = data.dashboard;
  const rooms = data.roomStatus;

  // [B7] When period filter active, override KPIs with period data
  const kpis = resolvedPeriod && periodData
    ? {
        pendapatanKotor: periodData.summary.totalIn,
        pendapatanNet: periodData.summary.totalIn - periodData.summary.totalRefund,
        totalRefund: periodData.summary.totalRefund,
        totalBelanja: periodData.summary.totalExpense,
        totalFee: periodData.summary.totalFee,
        netCash: periodData.summary.netCash,
        uangKos: 0, // not available per-period
        uangPenginapan: 0,
      }
    : {
        pendapatanKotor: d.pendapatanKotor,
        pendapatanNet: d.pendapatanNet,
        totalRefund: d.totalRefund,
        totalBelanja: d.totalBelanja,
        totalFee: d.totalFee,
        netCash: d.netCash,
        uangKos: d.uangKos,
        uangPenginapan: d.uangPenginapan,
      };

  const isPeriodActive = !!resolvedPeriod;

  // Count rooms by status
  const roomStats = {
    total: rooms.length,
    ready: rooms.filter((r) => r.Status_Code === 'READY').length,
    aktif: rooms.filter((r) => r.Status_Code === 'AKTIF_DP' || r.Status_Code === 'AKTIF_LUNAS').length,
    bermasalah: rooms.filter((r) => r.Status_Code === 'BELUM_BAYAR' || r.Status_Code === 'LEWAT_CHECKOUT').length,
  };

  // Perlu tindakan
  const perluBayar = data.paymentBookings || [];
  const akanCheckout = data.closingBookings || [];
  const lewatCheckout = data.statusActionBookings || [];

  return (
    <main className="max-w-[1240px] mx-auto p-5">
      <Topbar
        action={
          <Link href="/booking">
            <button className="btn btn-pri">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Booking
            </button>
          </Link>
        }
      />

      <div className="mb-5">
        <h1 className="page-title">Beranda</h1>
        <p className="text-tx3 text-[13px] mt-1 font-medium">
          Ringkasan operasional · {roomStats.total} kamar · update real-time dari Sheet
        </p>
      </div>

      {/* [B7] Period Filter */}
      <div className="card mb-4">
        <PeriodFilter value={period} onChange={setPeriod} />
        {isPeriodActive && (
          <div className="mt-2 pt-2 border-t border-bd text-[10px] text-bl font-semibold">
            ℹ️ KPI di bawah ini di-scope ke periode yang dipilih. Section "Perlu Tindakan" dan "Status Properti" tetap real-time (all-time).
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          emoji="📈"
          label={isPeriodActive ? 'Pendapatan Net (periode)' : 'Pendapatan Net'}
          value={formatRupiah(kpis.pendapatanNet)}
          hint={isPeriodActive ? 'Periode terpilih · klik detail' : 'Setelah refund · klik untuk detail'}
          featured
          onClick={() => setSelectedKpi('pendapatan_net')}
        />
        <KpiCard
          emoji="💰"
          label={isPeriodActive ? 'Uang Masuk (periode)' : 'Uang Masuk'}
          value={formatRupiah(kpis.pendapatanKotor)}
          hint={isPeriodActive ? 'Periode terpilih · klik detail' : 'Total pendapatan kotor · klik untuk detail'}
          onClick={() => setSelectedKpi('uang_masuk')}
        />
        <KpiCard
          emoji="🛒"
          label={isPeriodActive ? 'Uang Keluar (periode)' : 'Uang Keluar'}
          value={formatRupiah(kpis.totalBelanja + kpis.totalFee)}
          hint={isPeriodActive ? 'Periode terpilih · klik detail' : 'Operasional + fee · klik untuk detail'}
          onClick={() => setSelectedKpi('uang_keluar')}
        />
        <KpiCard
          emoji="💵"
          label={isPeriodActive ? 'Net Cash (periode)' : 'Net Cash'}
          value={formatRupiah(kpis.netCash)}
          hint={isPeriodActive ? 'Periode terpilih · klik detail' : 'Setelah semua biaya · klik untuk detail'}
          onClick={() => setSelectedKpi('net_cash')}
        />
      </div>

      {/* KPI Detail Modal */}
      {selectedKpi && (
        <KpiDetailModal
          type={selectedKpi}
          stats={d}
          onClose={() => setSelectedKpi(null)}
        />
      )}

      {/* 2-column: Perlu Tindakan + Status Properti */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        {/* Perlu Tindakan */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="font-bold text-sm">⚠️ Perlu Tindakan</div>
              <div className="text-tx3 text-xs">
                {perluBayar.length + lewatCheckout.length + akanCheckout.length} item
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {lewatCheckout.length > 0 && (
              <Section title={`🔴 Lewat Checkout (${lewatCheckout.length})`}>
                {lewatCheckout.slice(0, 3).map((b) => (
                  <ActionRow
                    key={b.BookingID}
                    name={b.Nama_Customer || '(tanpa nama)'}
                    room={b.Nama_Kamar}
                    detail={`Sisa ${formatRupiahShort(b.Sisa_Bayar)}`}
                  />
                ))}
              </Section>
            )}

            {perluBayar.length > 0 && (
              <Section title={`🟡 Perlu Bayar (${perluBayar.length})`}>
                {perluBayar.slice(0, 3).map((b) => (
                  <ActionRow
                    key={b.BookingID}
                    name={b.Nama_Customer || '(tanpa nama)'}
                    room={b.Nama_Kamar}
                    detail={`Sisa ${formatRupiahShort(b.Sisa_Bayar)}`}
                  />
                ))}
              </Section>
            )}

            {akanCheckout.length > 0 && (
              <Section title={`🔵 Lunas Belum Closed (${akanCheckout.length})`}>
                {akanCheckout.slice(0, 3).map((b) => (
                  <ActionRow
                    key={b.BookingID}
                    name={b.Nama_Customer || '(tanpa nama)'}
                    room={b.Nama_Kamar}
                    detail={`Net ${formatRupiahShort(b.Net_Diterima)}`}
                  />
                ))}
              </Section>
            )}

            {perluBayar.length === 0 && lewatCheckout.length === 0 && akanCheckout.length === 0 && (
              <div className="text-center text-tx3 text-xs py-8">
                <div className="text-2xl mb-2">✨</div>
                Semua bersih. Gak ada yang perlu di-handle.
              </div>
            )}
          </div>
        </div>

        {/* Status Properti */}
        <div className="card">
          <div className="font-bold text-sm mb-1">🏘️ Status Properti</div>
          <div className="text-tx3 text-xs mb-4">{roomStats.total} kamar total</div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              emoji="🟢"
              label="Tersedia"
              value={roomStats.ready}
              color="text-gr"
            />
            <StatCard
              emoji="🟣"
              label="Aktif"
              value={roomStats.aktif}
              color="text-vi"
            />
            <StatCard
              emoji="🔴"
              label="Bermasalah"
              value={roomStats.bermasalah}
              color="text-rd"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-bd">
            <Link href="/kamar" className="text-tx font-semibold text-xs hover:underline">
              Lihat peta kamar lengkap →
            </Link>
          </div>
        </div>
      </div>

      {/* Detail Finansial — 3 column */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card">
          <div className="font-bold text-xs uppercase tracking-wider text-tx3 mb-3">💰 Pendapatan</div>
          <div className="space-y-1.5">
            <Row label="Booking Aktif" value={formatRupiah(d.omzetBookingAktif)} />
            <Row label="Sisa Tagihan" value={formatRupiah(d.sisaTagihan)} accent="text-rd" />
            <Row label="Uang Kos" value={formatRupiah(d.uangKos)} />
            <Row label="Uang Penginapan" value={formatRupiah(d.uangPenginapan)} />
          </div>
        </div>
        <div className="card">
          <div className="font-bold text-xs uppercase tracking-wider text-tx3 mb-3">💸 Pengeluaran</div>
          <div className="space-y-1.5">
            <Row label="Total Belanja" value={formatRupiah(d.totalBelanja)} accent="text-rd" />
            <Row label="Fee Penjaga" value={formatRupiah(d.totalFee)} accent="text-rd" />
            <Row label="Total Refund" value={formatRupiah(d.totalRefund)} accent="text-rd" />
            <Row label="DP Hangus" value={formatRupiah(d.dpHangus)} accent="text-gr" />
          </div>
        </div>
        <div className="card">
          <div className="font-bold text-xs uppercase tracking-wider text-tx3 mb-3">📊 Booking</div>
          <div className="space-y-1.5">
            <Row label="Belum Lunas" value={String(d.jumlahBelumLunas)} />
            <Row label="Perlu Tindakan" value={String(d.jumlahStatusAction)} accent="text-rd" />
            <Row label="Lunas Belum Closed" value={String(d.jumlahLunasBelumDitutup)} />
            <Row label="Selesai" value={String(d.jumlahSelesai)} accent="text-gr" />
          </div>
        </div>
      </div>
    </main>
  );
}

function KpiCard({
  emoji,
  label,
  value,
  hint,
  featured = false,
  onClick,
}: {
  emoji: string;
  label: string;
  value: string;
  hint: string;
  featured?: boolean;
  onClick?: () => void;
}) {
  const baseClass = featured
    ? 'relative bg-ac text-inv border border-ac rounded-lg p-5 transition-all hover:-translate-y-px text-left w-full'
    : 'relative bg-sf border border-bd rounded-lg p-5 transition-all hover:-translate-y-px hover:shadow-sm hover:border-bds text-left w-full';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={onClick ? baseClass + ' cursor-pointer focus:outline-none focus:ring-2 focus:ring-ac/30' : baseClass}
    >
      <span className="absolute top-4 right-4 text-lg opacity-75">{emoji}</span>
      <div
        className={
          featured
            ? 'text-[11px] font-semibold text-inv/65 uppercase tracking-wider mb-3 pr-6'
            : 'text-[11px] font-semibold text-tx3 uppercase tracking-wider mb-3 pr-6'
        }
      >
        {label}
      </div>
      <div className="text-[26px] font-bold leading-none tracking-tight tabular-nums">{value}</div>
      <div
        className={
          featured ? 'mt-2 text-[11px] text-inv/50 font-medium' : 'mt-2 text-[11px] text-tx3 font-medium'
        }
      >
        {hint}
      </div>
    </Wrapper>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-tx2 mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ActionRow({ name, room, detail }: { name: string; room: string; detail: string }) {
  return (
    <div className="flex justify-between items-center bg-sf2 hover:bg-white border border-transparent hover:border-bd rounded-md px-3 py-2 transition-all">
      <div className="min-w-0">
        <div className="font-semibold text-xs truncate">{name}</div>
        <div className="text-tx3 text-[10px] truncate">{room}</div>
      </div>
      <div className="text-xs font-bold tabular-nums">{detail}</div>
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-sf2 rounded-md p-3 text-center">
      <div className="text-xl mb-1">{emoji}</div>
      <div className={`text-2xl font-bold leading-none tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-tx3 font-semibold uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-tx3">{label}</span>
      <span className={`font-semibold tabular-nums ${accent || 'text-tx'}`}>{value}</span>
    </div>
  );
}
