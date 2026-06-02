'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, type BookingItem, type RecentTransaction, type ReportTransaction } from '@/lib/api';
import { formatRupiah, formatDate } from '@/lib/utils';
import { Topbar } from '@/components/topbar';
import { PaymentForm, RefundForm, FeeForm, ExpenseForm } from '@/components/keuangan-forms';
import { PeriodFilter, resolvePeriod, type PeriodValue } from '@/components/period-filter';
import { toast } from 'sonner';

type TabType = 'pembayaran' | 'refund' | 'fee' | 'belanja';

// Unified type that handles both RecentTransaction and ReportTransaction
interface UnifiedTx {
  type: 'PAYMENT' | 'REFUND' | 'FEE' | 'EXPENSE';
  icon: string;
  id: string; // for delete (from RecentTransaction.id); ReportTransaction has no per-row ID so we extract from title
  date: string;
  title: string;
  subtitle: string;
  nominal: number;
  direction: 'IN' | 'OUT';
  bookingId: string;
  catatan: string;
}

export default function KeuanganPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('pembayaran');
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'all' });
  const [deletingTxKey, setDeletingTxKey] = useState<string | null>(null);

  const { data: initialData } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // Resolved period for filter
  const resolvedPeriod = useMemo(() => resolvePeriod(period), [period]);

  // When period is active → use getReportData, else use getRecentTransactions
  const { data: recentData, isLoading: loadingRecent } = useQuery({
    queryKey: ['recent-transactions', 30],
    queryFn: () => api.getRecentTransactions(30),
    enabled: !resolvedPeriod,
  });

  const { data: reportData, isLoading: loadingReport } = useQuery({
    queryKey: ['report-data', resolvedPeriod?.start, resolvedPeriod?.end],
    queryFn: () => api.getReportData(resolvedPeriod!.start, resolvedPeriod!.end),
    enabled: !!resolvedPeriod,
  });

  const loadingTx = resolvedPeriod ? loadingReport : loadingRecent;

  // Unify transactions from either source
  const transactions: UnifiedTx[] = useMemo(() => {
    if (resolvedPeriod && reportData) {
      return reportData.transactions.map((t: ReportTransaction) => {
        // ReportTransaction doesn't have explicit ID — derive from title
        // Format examples: "DP 1 · bunga", "Refund · bunga", etc.
        // We need to look up actual ID from somewhere — for now, can't delete period-filtered without backend exposure
        return {
          type: t.type,
          icon: t.icon,
          id: '', // unknown — delete disabled for period-filtered
          date: t.date,
          title: t.title,
          subtitle: t.subtitle,
          nominal: t.nominal,
          direction: t.direction,
          bookingId: t.bookingId,
          catatan: t.catatan,
        };
      });
    }
    if (!resolvedPeriod && recentData) {
      return recentData.transactions.map((t: RecentTransaction) => ({
        type: t.type,
        icon: t.icon,
        id: t.id,
        date: t.date,
        title: t.title,
        subtitle: t.subtitle,
        nominal: t.nominal,
        direction: t.direction,
        bookingId: t.bookingId,
        catatan: t.catatan,
      }));
    }
    return [];
  }, [resolvedPeriod, reportData, recentData]);

  // Summary
  const summary = useMemo(() => {
    if (resolvedPeriod && reportData) {
      return {
        totalPayment: reportData.summary.totalIn,
        totalRefund: reportData.summary.totalRefund,
        totalFee: reportData.summary.totalFee,
        totalExpense: reportData.summary.totalExpense,
        netCash: reportData.summary.netCash,
      };
    }
    return recentData?.summary;
  }, [resolvedPeriod, reportData, recentData]);

  // Combine all booking lists for dropdown choices
  const allBookings = useMemo(() => {
    if (!initialData) return [];
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

  async function handleDelete(tx: UnifiedTx) {
    if (!tx.id) {
      toast.error('Tidak bisa hapus dari mode periode — switch ke "Semua" dulu');
      return;
    }
    const label = tx.type === 'PAYMENT' ? 'pembayaran'
                : tx.type === 'REFUND' ? 'refund'
                : tx.type === 'FEE' ? 'fee'
                : 'belanja';
    const ok = confirm(
      `Hapus ${label} berikut?\n\n` +
      `${tx.title}\n` +
      `${tx.subtitle}\n` +
      `Nominal: ${formatRupiah(tx.nominal)}\n\n` +
      `⚠️ Aksi ini tidak bisa di-undo. ` +
      (tx.bookingId ? `Saldo booking ${tx.bookingId} akan otomatis di-recompute.` : '')
    );
    if (!ok) return;

    const key = `${tx.type}-${tx.id}`;
    setDeletingTxKey(key);
    try {
      const result = await api.submitTransactionDelete({ type: tx.type, id: tx.id });
      toast.success(result.message || `✓ ${label} dihapus`);
      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      queryClient.invalidateQueries({ queryKey: ['report-data'] });
    } catch (e) {
      toast.error('Gagal hapus: ' + (e as Error).message);
    } finally {
      setDeletingTxKey(null);
    }
  }

  return (
    <>
      <Topbar />

      <div className="px-6 py-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <Link href="/" className="text-tx3 text-xs hover:text-ac inline-flex items-center gap-1 mb-1">
            ← Beranda
          </Link>
          <h1 className="font-serif text-3xl tracking-tight">Keuangan</h1>
          <p className="text-tx3 text-sm mt-1">
            Catat pemasukan, pengeluaran, dan refund · klik 🗑️ untuk hapus
          </p>
        </div>

        {/* [B7] Period Filter */}
        <div className="card mb-4 !p-3">
          <PeriodFilter value={period} onChange={setPeriod} compact />
        </div>

        {/* Summary KPI strip */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            <KpiCard label="💵 Total Pembayaran" value={summary.totalPayment} accent="text-gr" />
            <KpiCard label="↩️ Total Refund" value={summary.totalRefund} accent="text-rd" />
            <KpiCard label="🧹 Fee Penjaga" value={summary.totalFee} accent="text-am" />
            <KpiCard label="🛒 Belanja" value={summary.totalExpense} accent="text-bl" />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT: Forms */}
          <div className="bg-sf border border-bd rounded-md p-5">
            <div className="flex gap-1 mb-5 border-b border-bd -mx-5 px-5 -mt-5 pt-5 overflow-x-auto">
              <FormTab label="💵 Pembayaran" active={activeTab === 'pembayaran'} onClick={() => setActiveTab('pembayaran')} />
              <FormTab label="↩️ Refund" active={activeTab === 'refund'} onClick={() => setActiveTab('refund')} />
              <FormTab label="🧹 Fee" active={activeTab === 'fee'} onClick={() => setActiveTab('fee')} />
              <FormTab label="🛒 Belanja" active={activeTab === 'belanja'} onClick={() => setActiveTab('belanja')} />
            </div>

            {activeTab === 'pembayaran' && <PaymentForm bookings={allBookings} />}
            {activeTab === 'refund' && <RefundForm bookings={allBookings} />}
            {activeTab === 'fee' && <FeeForm bookings={allBookings} />}
            {activeTab === 'belanja' && <ExpenseForm />}
          </div>

          {/* RIGHT: Recent transactions */}
          <div>
            <div className="flex justify-between items-baseline mb-3">
              <h2 className="font-bold text-sm">
                {resolvedPeriod ? '📊 Transaksi Periode' : '📜 Transaksi Terbaru'}
              </h2>
              <span className="text-tx3 text-[11px] tabular-nums">
                {loadingTx
                  ? '...'
                  : resolvedPeriod
                  ? `${transactions.length} item`
                  : recentData
                  ? `${transactions.length} dari ${recentData.total}`
                  : '...'}
              </span>
            </div>

            {resolvedPeriod && (
              <div className="bg-blb border border-bl rounded-md p-2 mb-2 text-[10px] text-bl">
                ℹ️ Mode periode aktif. Delete button disabled — switch ke "Semua" untuk hapus transaksi.
              </div>
            )}

            {loadingTx ? (
              <div className="text-tx3 text-sm text-center py-8 bg-sf border border-bd rounded-md">
                Loading...
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-sf2 border border-bd border-dashed rounded-md p-8 text-center text-tx3 text-sm">
                Belum ada transaksi
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {transactions.map((tx, idx) => (
                  <TransactionRow
                    key={`${tx.type}-${tx.id || idx}`}
                    tx={tx}
                    onDelete={() => handleDelete(tx)}
                    isDeleting={deletingTxKey === `${tx.type}-${tx.id}`}
                    deleteDisabled={!tx.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ===========================================
// Sub-components
// ===========================================

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-sf border border-bd rounded-md p-3">
      <div className="text-tx3 text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-bold text-sm tabular-nums ${accent || 'text-tx'}`}>{formatRupiah(value)}</div>
    </div>
  );
}

function FormTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-2 text-xs font-semibold border-b-2 border-ac text-tx -mb-px whitespace-nowrap'
          : 'px-3 py-2 text-xs font-medium text-tx3 hover:text-tx whitespace-nowrap'
      }
    >
      {label}
    </button>
  );
}

function TransactionRow({
  tx,
  onDelete,
  isDeleting,
  deleteDisabled,
}: {
  tx: UnifiedTx;
  onDelete: () => void;
  isDeleting: boolean;
  deleteDisabled: boolean;
}) {
  const isIn = tx.direction === 'IN';

  return (
    <div className="bg-sf border border-bd rounded-md p-2.5 hover:bg-sf2 transition-colors group">
      <div className="flex justify-between items-start gap-2">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="text-base flex-shrink-0">{tx.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xs truncate">{tx.title}</div>
            <div className="text-tx3 text-[10px] truncate mt-0.5">{tx.subtitle}</div>
            <div className="text-tx3 text-[10px] mt-0.5">{formatDate(tx.date)}</div>
            {tx.catatan && (
              <div className="text-tx3 text-[10px] italic mt-0.5 truncate">&quot;{tx.catatan}&quot;</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className={`font-bold text-xs tabular-nums whitespace-nowrap ${isIn ? 'text-gr' : 'text-rd'}`}>
            {isIn ? '+' : '-'}
            {formatRupiah(tx.nominal)}
          </div>
          <button
            onClick={onDelete}
            disabled={isDeleting || deleteDisabled}
            className={
              deleteDisabled
                ? 'opacity-30 cursor-not-allowed p-1 text-[10px]'
                : 'opacity-0 group-hover:opacity-100 hover:bg-rd/10 hover:text-rd p-1 rounded transition-all text-[10px]'
            }
            title={
              deleteDisabled
                ? 'Switch ke "Semua" untuk hapus'
                : isDeleting
                ? 'Menghapus...'
                : 'Hapus transaksi ini'
            }
          >
            {isDeleting ? '⏳' : '🗑️'}
          </button>
        </div>
      </div>
    </div>
  );
}
