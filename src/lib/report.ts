// Top Hills — Laporan Keuangan: model + mapper dari data asli (getReportData + rooms).
import type { ReportData, RoomStatus } from '@/lib/api';

export type RLine = { label: string; sub: string; amount: number };
export type TrendPoint = { inn: number; out: number; label: string };

export type PeriodReport = {
  label: string; // "Juni 2026"
  range: string; // "Periode 1 – 23 Juni 2026 · ..."
  cashIn: number;
  cashOut: number;
  openingBalance: number;
  occupancy: { occupied: number; total: number };
  trend: TrendPoint[];
  income: RLine[];
  expense: RLine[];
};

export function rp(n: number): string {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function collapseTop(rows: RLine[], n: number): RLine[] {
  if (rows.length <= n) return rows;
  const head = rows.slice(0, n - 1);
  const restSum = rows.slice(n - 1).reduce((s, r) => s + r.amount, 0);
  return [...head, { label: 'Lainnya', sub: `${rows.length - (n - 1)} pos lainnya`, amount: restSum }];
}

/** Bangun data laporan dari ReportData asli + daftar kamar. */
export function reportDataToPeriod(
  data: ReportData,
  rooms: RoomStatus[] | undefined,
  label: string,
  range: string,
): PeriodReport {
  const cashIn = Number(data.summary?.totalIn || 0);
  const cashOut = Number(data.summary?.totalOut || 0);

  // ── Uang masuk: kelompokkan pembayaran per booking (penyewa · kamar) ──
  const incMap = new Map<string, RLine>();
  (data.transactions || []).filter((t) => t.direction === 'IN').forEach((t) => {
    const key = t.bookingId || t.title;
    const cust = (t.title.split('·').pop() || t.title).trim();
    const kamar = (t.subtitle.split('·')[0] || '').trim();
    const e = incMap.get(key) || { label: cust || 'Pembayaran', sub: kamar, amount: 0 };
    e.amount += Number(t.nominal || 0);
    incMap.set(key, e);
  });
  const income = collapseTop([...incMap.values()].sort((a, b) => b.amount - a.amount), 6);

  // ── Uang keluar: kelompokkan per kategori (belanja/fee/refund) ──
  const expMap = new Map<string, RLine>();
  (data.transactions || []).filter((t) => t.direction === 'OUT').forEach((t) => {
    let lbl = 'Lainnya';
    let sub = '';
    if (t.type === 'EXPENSE') { lbl = (t.title.split('·').pop() || 'Belanja').trim(); sub = 'belanja operasional'; }
    else if (t.type === 'FEE') { lbl = 'Gaji / fee penjaga'; sub = 'operasional'; }
    else if (t.type === 'REFUND') { lbl = 'Pengembalian (refund)'; sub = 'ke tamu'; }
    const e = expMap.get(lbl) || { label: lbl, sub, amount: 0 };
    e.amount += Number(t.nominal || 0);
    expMap.set(lbl, e);
  });
  const expense = collapseTop([...expMap.values()].sort((a, b) => b.amount - a.amount), 6);

  // ── Tren harian dari chart ──
  const trend: TrendPoint[] = (data.chart || []).map((c) => {
    const d = new Date(c.date);
    const label = isNaN(d.getTime()) ? String(c.date) : String(d.getDate());
    return { inn: Number(c.in || 0), out: Number(c.out || 0), label };
  });

  // ── Hunian kamar ──
  const total = rooms?.length || 0;
  const occupied = (rooms || []).filter((r) => Number(r.Active_Count || 0) > 0).length;

  return {
    label, range, cashIn, cashOut, openingBalance: 0,
    occupancy: { occupied, total },
    trend, income, expense,
  };
}
