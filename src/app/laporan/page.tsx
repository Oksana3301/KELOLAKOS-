'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ReportData, type RoomStatus } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, StickyCTA } from '@/components/kk/ui';
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
import { rupiah } from '@/components/kk/status';
import { exportGeneralLedgerExcel } from '@/lib/excel-export';
import { kwitansiApi } from '@/lib/api-v2';
import { mapRoomStatus } from '@/components/kk/status';
import { BreakBar } from '@/components/kk/laporan-ui';
import { cn } from '@/lib/utils';

const HELP = {
  title: 'Laporan',
  tips: [
    'Pilih periode di atas (Bulan Ini, dll.) untuk melihat ringkasan keuangan pada rentang waktu tersebut.',
    'Kartu hijau berarti Anda untung, kartu oranye berarti pengeluaran lebih besar dari pemasukan.',
    'Tekan tombol oranye "Unduh Laporan PDF" untuk menyimpan atau mencetak laporan ini.',
  ],
};

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Plain-language category labels for the income / expense breakdowns.
const MASUK_LABEL: Record<string, string> = { PAYMENT: 'Pembayaran sewa' };
const KELUAR_LABEL: Record<string, string> = {
  FEE: 'Gaji penjaga',
  EXPENSE: 'Belanja operasional',
  REFUND: 'Pengembalian (refund)',
};

export default function LaporanPage() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'this_month' });
  const [detailKpi, setDetailKpi] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const resolved = useMemo(() => resolvePeriod(period), [period]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report-data', resolved?.start, resolved?.end],
    queryFn: () => api.getReportData(resolved!.start, resolved!.end),
    enabled: !!resolved,
  });

  // Room occupancy comes from the dashboard init data (room master + status).
  const { data: initData } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  async function handleExportPDF() {
    // Preserve the existing PDF export mechanism (browser print → Save as PDF).
    window.print();
  }

  async function handleExportExcel() {
    if (!data) return;
    const toastId = toast.loading('⏳ Menyiapkan file Excel…');
    try {
      let businessName = 'Top Hills & Co';
      try {
        const settings = await kwitansiApi.get();
        if (settings?.business_name) businessName = settings.business_name;
      } catch (e) {
        console.warn('Failed to fetch business name:', e);
      }
      await exportGeneralLedgerExcel({ reportData: data, businessName, saldoAwal: 0 });
      toast.success('✓ File Excel berhasil diunduh', { id: toastId });
    } catch (e) {
      toast.error('Gagal membuat Excel: ' + (e as Error).message, { id: toastId });
    }
  }

  return (
    <>
      <ScreenHead
        title="Laporan"
        sub="Ringkasan keuangan properti Anda."
        onHelp={() => setHelpOpen(true)}
      />

      <StickyCTA>
        <KkButton variant="primary" size="lg" block disabled={!data} onClick={handleExportPDF}>
          <KkIcon name="unduh" size={22} strokeWidth={2.2} /> Unduh Laporan PDF
        </KkButton>
      </StickyCTA>

      <KkPeriodFilter value={period} onChange={setPeriod} />

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
          <div className="text-body text-kk-ink">Memuat laporan…</div>
        </div>
      ) : isError || !data ? (
        <KkCard className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
            <KkIcon name="info" size={30} />
          </div>
          <h2 className="font-heading font-bold text-subhead mb-2">Gagal memuat laporan</h2>
          <p className="text-body text-kk-ink mb-5">{(error as Error)?.message || 'Terjadi kesalahan'}</p>
          <KkButton variant="primary" onClick={() => refetch()}>
            Coba Lagi
          </KkButton>
        </KkCard>
      ) : (
        <ReportBody
          data={data}
          rooms={initData?.roomStatus}
          label={periodLabel(period)}
          detailKpi={detailKpi}
          setDetailKpi={setDetailKpi}
          onExportExcel={handleExportExcel}
        />
      )}

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
        }
      `}</style>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-3 mt-8">{children}</h2>;
}

function ReportBody({
  data,
  rooms,
  label,
  detailKpi,
  setDetailKpi,
  onExportExcel,
}: {
  data: ReportData;
  rooms: RoomStatus[] | undefined;
  label: string;
  detailKpi: string | null;
  setDetailKpi: (id: string | null) => void;
  onExportExcel: () => void;
}) {
  const masuk = data.summary.totalIn;
  const keluar = data.summary.totalOut;
  const net = masuk - keluar;
  const untung = net >= 0;

  const money: MoneyData = { masuk, keluar, sisa: data.summary.netCash, label };

  // ── Category breakdowns, derived from real transactions ──
  const { masukRinci, keluarRinci, maxMasuk, maxKeluar } = useMemo(() => {
    const inAgg = new Map<string, number>();
    const outAgg = new Map<string, number>();
    for (const t of data.transactions) {
      if (t.direction === 'IN') {
        const l = MASUK_LABEL[t.type] || t.title || 'Pemasukan lain';
        inAgg.set(l, (inAgg.get(l) || 0) + t.nominal);
      } else {
        const l = KELUAR_LABEL[t.type] || t.title || 'Pengeluaran lain';
        outAgg.set(l, (outAgg.get(l) || 0) + t.nominal);
      }
    }
    const toRows = (m: Map<string, number>) =>
      [...m.entries()].map(([l, v]) => ({ l, v })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
    const masukRinci = toRows(inAgg);
    const keluarRinci = toRows(outAgg);
    return {
      masukRinci,
      keluarRinci,
      maxMasuk: Math.max(...masukRinci.map((x) => x.v), 1),
      maxKeluar: Math.max(...keluarRinci.map((x) => x.v), 1),
    };
  }, [data.transactions]);

  const breakdown = {
    masuk: masukRinci,
    keluar: keluarRinci,
  };

  // ── Trend: adaptive buckets built from the SELECTED period's daily chart ──
  // ≤ ~31 days → daily (merged to ≤ MAX_BARS), > ~31 days → calendar months.
  const trend = useMemo(() => {
    const MAX_BARS = 12;

    // Normalize + sort the daily series.
    const days = data.chart
      .map((c) => ({ d: new Date(c.date), masuk: c.in, keluar: c.out }))
      .filter((c) => !isNaN(c.d.getTime()))
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    if (days.length === 0) return [];

    const spanDays =
      (days[days.length - 1].d.getTime() - days[0].d.getTime()) / 86_400_000 + 1;

    if (spanDays > 31) {
      // Group by calendar month.
      const byMonth = new Map<string, { masuk: number; keluar: number; key: string; bln: string }>();
      for (const c of days) {
        const key = `${c.d.getFullYear()}-${c.d.getMonth()}`;
        const cur = byMonth.get(key) || { masuk: 0, keluar: 0, key, bln: MONTH_ID[c.d.getMonth()] };
        cur.masuk += c.masuk;
        cur.keluar += c.keluar;
        byMonth.set(key, cur);
      }
      const months = [...byMonth.values()];
      // Keep the most recent buckets if somehow > MAX_BARS (e.g. very long ranges).
      return months.slice(-MAX_BARS);
    }

    // Daily: merge consecutive days into ≤ MAX_BARS groups so phones don't overflow.
    const group = Math.max(1, Math.ceil(days.length / MAX_BARS));
    const bars: { masuk: number; keluar: number; key: string; bln: string }[] = [];
    for (let i = 0; i < days.length; i += group) {
      const slice = days.slice(i, i + group);
      const first = slice[0].d;
      bars.push({
        key: `${first.getFullYear()}-${first.getMonth()}-${first.getDate()}`,
        // Label the start of each bucket, e.g. "5 Jun".
        bln: `${first.getDate()} ${MONTH_ID[first.getMonth()]}`,
        masuk: slice.reduce((s, c) => s + c.masuk, 0),
        keluar: slice.reduce((s, c) => s + c.keluar, 0),
      });
    }
    return bars;
  }, [data.chart]);
  const maxTrend = Math.max(...trend.flatMap((d) => [d.masuk, d.keluar]), 1);

  // ── Hunian Kamar (occupancy) from room master/status ──
  const roomList = rooms || [];
  const totalKamar = roomList.length;
  const terisi = roomList.filter((r) => mapRoomStatus(r) === 'Terisi').length;
  const huniPct = totalKamar > 0 ? Math.round((terisi / totalKamar) * 100) : 0;

  return (
    <div>
      {/* Insight bahasa sederhana */}
      <div
        className={cn(
          'rounded-kk-card p-[22px] mb-[18px] text-white',
          untung ? 'bg-kk-green' : 'bg-kk-orange',
        )}
      >
        <div className="text-body font-semibold mb-1 text-white/90">
          {label} · {untung ? 'Untung Bersih' : 'Rugi Bersih'}
        </div>
        <div className="font-heading font-black text-[34px] leading-[1.05] tracking-tight tabular-nums">
          {rupiah(Math.abs(net))}
        </div>
        <p className="mt-3 mb-0 text-body leading-relaxed text-white">
          Anda menerima <b>{rupiah(masuk)}</b> dan mengeluarkan <b>{rupiah(keluar)}</b>
          {untung ? ', jadi ada keuntungan bersih.' : ', sehingga pengeluaran lebih besar.'}
        </p>
      </div>

      {/* 4 angka */}
      <MoneyKpiGrid data={money} onDetail={setDetailKpi} />

      {/* Tren */}
      <SectionTitle>Tren {label}</SectionTitle>
      <KkCard>
        <div className="flex gap-5 mb-5">
          <span className="inline-flex items-center gap-2 text-body font-semibold text-kk-navy">
            <span className="w-3.5 h-3.5 rounded bg-kk-green" /> Masuk
          </span>
          <span className="inline-flex items-center gap-2 text-body font-semibold text-kk-navy">
            <span className="w-3.5 h-3.5 rounded bg-kk-orange" /> Keluar
          </span>
        </div>
        {trend.length === 0 ? (
          <p className="text-body text-kk-ink m-0">Belum ada data pada periode ini.</p>
        ) : (
          <div className="flex items-end justify-between gap-2.5 h-[190px]">
            {trend.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex gap-[5px] items-end h-[150px]">
                  <div
                    className="w-[18px] bg-kk-green rounded-t-[5px]"
                    style={{ height: `${Math.max(d.masuk > 0 ? 3 : 0, (d.masuk / maxTrend) * 150)}px` }}
                  />
                  <div
                    className="w-[18px] bg-kk-orange rounded-t-[5px]"
                    style={{ height: `${Math.max(d.keluar > 0 ? 3 : 0, (d.keluar / maxTrend) * 150)}px` }}
                  />
                </div>
                <span className="text-body font-semibold text-kk-ink">{d.bln}</span>
              </div>
            ))}
          </div>
        )}
      </KkCard>

      {/* Dari mana uang masuk */}
      <SectionTitle>Dari Mana Uang Masuk</SectionTitle>
      <KkCard className="pb-2">
        {masukRinci.length === 0 ? (
          <p className="text-body text-kk-ink m-0 pb-2">Belum ada pemasukan pada periode ini.</p>
        ) : (
          masukRinci.map((x, i) => (
            <BreakBar key={i} label={x.l} val={x.v} max={maxMasuk} color="green" />
          ))
        )}
      </KkCard>

      {/* Ke mana uang keluar */}
      <SectionTitle>Ke Mana Uang Keluar</SectionTitle>
      <KkCard className="pb-2">
        {keluarRinci.length === 0 ? (
          <p className="text-body text-kk-ink m-0 pb-2">Belum ada pengeluaran pada periode ini.</p>
        ) : (
          keluarRinci.map((x, i) => (
            <BreakBar key={i} label={x.l} val={x.v} max={maxKeluar} color="orange" />
          ))
        )}
      </KkCard>

      {/* Hunian kamar */}
      <SectionTitle>Hunian Kamar</SectionTitle>
      <KkCard>
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-body font-semibold text-kk-ink">Kamar terisi</span>
          <span className="font-heading font-black text-[22px] tabular-nums">
            {terisi} dari {totalKamar}
          </span>
        </div>
        <div className="h-[18px] rounded-kk-pill bg-kk-mauve-soft overflow-hidden">
          <div className="h-full bg-kk-navy rounded-kk-pill" style={{ width: `${huniPct}%` }} />
        </div>
        <div className="text-body text-kk-ink mt-2.5">
          {totalKamar > 0
            ? `${huniPct}% kamar Anda sedang disewa.`
            : 'Belum ada data kamar.'}
        </div>
      </KkCard>

      {/* Unduh Excel (Buku Besar) — sekunder */}
      <div className="mt-7">
        <KkButton variant="secondary" block onClick={onExportExcel}>
          <KkIcon name="unduh" size={22} strokeWidth={2.2} /> Unduh Excel (Buku Besar)
        </KkButton>
      </div>

      {detailKpi && (
        <MoneyKpiDetail
          id={detailKpi}
          data={money}
          breakdown={breakdown}
          onClose={() => setDetailKpi(null)}
        />
      )}
    </div>
  );
}
