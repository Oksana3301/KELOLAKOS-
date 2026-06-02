'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ReportData } from '@/lib/api';
import { formatRupiah, formatRupiahShort, formatDate } from '@/lib/utils';
import { Topbar } from '@/components/topbar';
import { exportGeneralLedgerExcel } from '@/lib/excel-export';
import { kwitansiApi } from '@/lib/api-v2';
import { toast } from 'sonner';

// Quick period presets
const PRESETS = [
  { key: 'last7', label: '7 hari', days: 7 },
  { key: 'last30', label: '30 hari', days: 30 },
  { key: 'thisMonth', label: 'Bulan ini', custom: 'thisMonth' },
  { key: 'lastMonth', label: 'Bulan lalu', custom: 'lastMonth' },
  { key: 'last90', label: '90 hari', days: 90 },
];

function presetToRange(preset: typeof PRESETS[number]): { start: string; end: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (preset.custom === 'thisMonth') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(start), end: fmt(today) };
  }
  if (preset.custom === 'lastMonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: fmt(start), end: fmt(end) };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - (preset.days || 30) + 1);
  return { start: fmt(start), end: fmt(today) };
}

export default function LaporanPage() {
  // Default: 30 days
  const defaultRange = presetToRange(PRESETS[1]);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [activePreset, setActivePreset] = useState<string>('last30');

  function applyPreset(preset: typeof PRESETS[number]) {
    const range = presetToRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset(preset.key);
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report-data', startDate, endDate],
    queryFn: () => api.getReportData(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  function handlePrint() {
    window.print();
  }

  function handleExportCSV() {
    if (!data) return;
    const rows = [
      ['Tanggal', 'Tipe', 'Judul', 'Subtitle', 'Direction', 'Nominal', 'BookingID', 'PIC', 'Catatan'],
      ...data.transactions.map((t) => [
        new Date(t.date).toISOString().split('T')[0],
        t.type,
        t.title,
        t.subtitle,
        t.direction,
        String(t.nominal),
        t.bookingId,
        t.diterimaOleh,
        t.catatan,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('✓ CSV ke-download');
  }

  async function handleExportGL() {
    if (!data) return;
    const toastId = toast.loading('⏳ Generating Excel GL...');
    try {
      // Fetch business name from kwitansi settings
      let businessName = 'KelolaKos';
      try {
        const settings = await kwitansiApi.get();
        if (settings?.business_name) businessName = settings.business_name;
      } catch (e) {
        // Fallback to default if can't fetch settings
        console.warn('Failed to fetch business name:', e);
      }

      await exportGeneralLedgerExcel({
        reportData: data,
        businessName,
        saldoAwal: 0,
      });
      toast.success('✓ Excel GL ke-download', { id: toastId });
    } catch (e) {
      toast.error('Gagal export Excel: ' + (e as Error).message, { id: toastId });
    }
  }

  return (
    <>
      <Topbar />

      <div className="px-6 py-6 max-w-7xl mx-auto print:max-w-none print:px-0 print:py-0">
        {/* Header — hidden in print */}
        <div className="mb-5 print:hidden">
          <Link href="/" className="text-tx3 text-xs hover:text-ac inline-flex items-center gap-1 mb-1">
            ← Beranda
          </Link>
          <div className="flex justify-between items-start gap-3">
            <div>
              <h1 className="font-serif text-3xl tracking-tight">Laporan</h1>
              <p className="text-tx3 text-sm mt-1">
                Ringkasan transaksi dalam periode tertentu
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handlePrint} className="btn btn-sec text-xs" disabled={!data}>
                🖨️ Print / PDF
              </button>
              <button onClick={handleExportCSV} className="btn btn-sec text-xs" disabled={!data}>
                📊 CSV
              </button>
              <button onClick={handleExportGL} className="btn btn-pri text-xs" disabled={!data}>
                📑 Excel GL
              </button>
            </div>
          </div>
        </div>

        {/* Period Picker — hidden in print */}
        <div className="bg-sf border border-bd rounded-md p-4 mb-5 print:hidden">
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={
                  activePreset === p.key
                    ? 'px-3 py-1.5 rounded-md bg-ac text-inv text-xs font-semibold'
                    : 'px-3 py-1.5 rounded-md bg-sf2 text-tx2 text-xs font-medium hover:bg-bd'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-[11px] font-semibold text-tx2 mb-1 block">Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActivePreset('custom'); }}
                className="input"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-tx2 mb-1 block">Sampai</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActivePreset('custom'); }}
                className="input"
              />
            </div>
            <button onClick={() => refetch()} className="btn btn-pri text-xs">
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Print Header — only in print */}
        <div className="hidden print:block mb-6">
          <h1 className="font-serif text-2xl">Laporan KelolaKos</h1>
          <p className="text-sm text-tx3">
            Periode: {formatDate(startDate)} – {formatDate(endDate)}
          </p>
        </div>

        {isLoading ? (
          <div className="text-tx3 text-sm text-center py-12">⏳ Loading laporan...</div>
        ) : isError ? (
          <div className="bg-rdb border border-rd rounded-md p-4 text-center text-rd text-sm">
            Gagal load: {(error as Error)?.message}
            <button onClick={() => refetch()} className="btn btn-pri text-xs ml-3">Retry</button>
          </div>
        ) : data ? (
          <ReportContent data={data} />
        ) : null}
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}

function ReportContent({ data }: { data: ReportData }) {
  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard
          label="💵 Pemasukan"
          value={data.summary.totalIn}
          accent="text-gr"
          subtitle={`${data.summary.countPayment} pembayaran`}
        />
        <KpiCard
          label="↩️ Pengeluaran Refund"
          value={data.summary.totalRefund}
          accent="text-rd"
          subtitle={`${data.summary.countRefund} refund`}
        />
        <KpiCard
          label="🧹+🛒 Operasional"
          value={data.summary.totalFee + data.summary.totalExpense}
          accent="text-am"
          subtitle={`${data.summary.countFee} fee + ${data.summary.countExpense} belanja`}
        />
        <KpiCard
          label="💰 Net Cash"
          value={data.summary.netCash}
          accent={data.summary.netCash >= 0 ? 'text-gr' : 'text-rd'}
          subtitle={data.summary.netCash >= 0 ? 'Surplus' : 'Defisit'}
          bold
        />
      </div>

      {/* Chart */}
      {data.chart.length > 0 && (
        <div className="bg-sf border border-bd rounded-md p-4">
          <h2 className="font-bold text-sm mb-3">📈 Trend Cash Flow</h2>
          <ChartBars data={data.chart} />
        </div>
      )}

      {/* Booking stats */}
      <div className="bg-sf border border-bd rounded-md p-4">
        <h2 className="font-bold text-sm mb-3">🏠 Aktivitas Booking di Periode Ini</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total Booking" value={data.bookingStats.totalBooking} />
          <Stat label="Aktif" value={data.bookingStats.booking_aktif} accent="text-bl" />
          <Stat label="Selesai" value={data.bookingStats.booking_selesai} accent="text-gr" />
          <Stat label="Cancel" value={data.bookingStats.booking_cancel} accent="text-rd" />
          <Stat label="Omzet" value={formatRupiahShort(data.bookingStats.omzet)} accent="text-tx" />
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-sf border border-bd rounded-md p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-sm">📋 Detail Transaksi ({data.transactions.length})</h2>
        </div>
        {data.transactions.length === 0 ? (
          <div className="text-tx3 text-sm text-center py-6">Tidak ada transaksi di periode ini</div>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-xs">
              <thead className="bg-sf2 border-y border-bd">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Tanggal</th>
                  <th className="text-left px-3 py-2 font-semibold">Tipe</th>
                  <th className="text-left px-3 py-2 font-semibold">Detail</th>
                  <th className="text-right px-3 py-2 font-semibold">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx, i) => (
                  <tr key={i} className="border-b border-bd hover:bg-sf2">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <span>{tx.icon}</span>
                        <span className="font-medium">{tx.type}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{tx.title}</div>
                      <div className="text-tx3 text-[10px]">{tx.subtitle}</div>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap ${
                        tx.direction === 'IN' ? 'text-gr' : 'text-rd'
                      }`}
                    >
                      {tx.direction === 'IN' ? '+' : '-'}
                      {formatRupiah(tx.nominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-sf2 border-t-2 border-bd">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-bold">Net Cash</td>
                  <td
                    className={`px-3 py-2 text-right font-bold tabular-nums ${
                      data.summary.netCash >= 0 ? 'text-gr' : 'text-rd'
                    }`}
                  >
                    {data.summary.netCash >= 0 ? '+' : ''}
                    {formatRupiah(data.summary.netCash)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  subtitle,
  bold,
}: {
  label: string;
  value: number;
  accent?: string;
  subtitle?: string;
  bold?: boolean;
}) {
  return (
    <div className="bg-sf border border-bd rounded-md p-3">
      <div className="text-tx3 text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`tabular-nums ${bold ? 'font-bold text-base' : 'font-bold text-sm'} ${accent || 'text-tx'}`}>
        {formatRupiah(value)}
      </div>
      {subtitle && <div className="text-tx3 text-[10px] mt-0.5">{subtitle}</div>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div>
      <div className="text-tx3 text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-bold text-base tabular-nums ${accent || 'text-tx'}`}>{value}</div>
    </div>
  );
}

function ChartBars({ data }: { data: ReportData['chart'] }) {
  const max = useMemo(() => {
    return Math.max(...data.map((d) => Math.max(d.in, d.out)), 1);
  }, [data]);

  // For very long periods, limit to ~30 bars by sampling
  const displayData = useMemo(() => {
    if (data.length <= 31) return data;
    // Aggregate by week
    const weeks: typeof data = [];
    for (let i = 0; i < data.length; i += 7) {
      const slice = data.slice(i, i + 7);
      weeks.push({
        date: slice[0].date,
        in: slice.reduce((s, d) => s + d.in, 0),
        out: slice.reduce((s, d) => s + d.out, 0),
      });
    }
    return weeks;
  }, [data]);

  const isWeekly = displayData.length !== data.length;

  return (
    <div>
      <div className="text-tx3 text-[10px] mb-2">
        {isWeekly ? 'Per minggu' : 'Per hari'} · Hijau = pemasukan · Merah = pengeluaran
      </div>
      <div className="flex items-end gap-0.5 h-32 overflow-x-auto pb-1">
        {displayData.map((d, i) => {
          const inH = (d.in / max) * 100;
          const outH = (d.out / max) * 100;
          return (
            <div
              key={i}
              className="flex flex-col items-center flex-shrink-0 group"
              style={{ minWidth: `${Math.max(20, 100 / displayData.length)}px` }}
              title={`${d.date}: +${formatRupiahShort(d.in)} / -${formatRupiahShort(d.out)}`}
            >
              <div className="flex items-end gap-px h-28 w-full">
                <div
                  className="bg-gr/60 group-hover:bg-gr flex-1 transition-colors rounded-t-sm"
                  style={{ height: `${inH}%`, minHeight: d.in > 0 ? '2px' : 0 }}
                />
                <div
                  className="bg-rd/60 group-hover:bg-rd flex-1 transition-colors rounded-t-sm"
                  style={{ height: `${outH}%`, minHeight: d.out > 0 ? '2px' : 0 }}
                />
              </div>
              {(i === 0 || i === displayData.length - 1 || i === Math.floor(displayData.length / 2)) && (
                <div className="text-[9px] text-tx3 mt-1 tabular-nums">{d.date.slice(5)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
