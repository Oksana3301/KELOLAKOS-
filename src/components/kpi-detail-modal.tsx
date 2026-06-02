'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type DashboardStats } from '@/lib/api';
import { formatRupiah, formatDate } from '@/lib/utils';

export type KpiDetailType = 'pendapatan_net' | 'uang_masuk' | 'uang_keluar' | 'net_cash';

interface KpiDetailModalProps {
  type: KpiDetailType;
  stats: DashboardStats;
  onClose: () => void;
}

const CONFIG: Record<KpiDetailType, { title: string; emoji: string; description: string }> = {
  pendapatan_net: {
    title: 'Pendapatan Net',
    emoji: '📈',
    description: 'Pendapatan setelah dikurangi refund customer',
  },
  uang_masuk: {
    title: 'Uang Masuk (Pendapatan Kotor)',
    emoji: '💰',
    description: 'Total semua pembayaran yang diterima sebelum dikurangi refund',
  },
  uang_keluar: {
    title: 'Uang Keluar (Pengeluaran)',
    emoji: '🛒',
    description: 'Total fee penjaga + belanja operasional',
  },
  net_cash: {
    title: 'Net Cash',
    emoji: '💵',
    description: 'Sisa uang real setelah semua pemasukan, pengeluaran, dan refund',
  },
};

export function KpiDetailModal({ type, stats, onClose }: KpiDetailModalProps) {
  const config = CONFIG[type];

  // Fetch recent transactions (100 latest) for detail breakdown
  const { data: txData, isLoading } = useQuery({
    queryKey: ['recent-transactions-detail', 100],
    queryFn: () => api.getRecentTransactions(100),
  });

  const transactions = txData?.transactions || [];

  // Filter transactions based on KPI type
  const filteredTx = (() => {
    if (type === 'pendapatan_net') {
      // Show payments + refunds (both contribute to net)
      return transactions.filter((t) => t.type === 'PAYMENT' || t.type === 'REFUND');
    }
    if (type === 'uang_masuk') {
      return transactions.filter((t) => t.type === 'PAYMENT');
    }
    if (type === 'uang_keluar') {
      return transactions.filter((t) => t.type === 'FEE' || t.type === 'EXPENSE');
    }
    // net_cash → show all
    return transactions;
  })();

  return (
    <div
      className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-sf w-full max-w-2xl rounded-lg shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-bd flex justify-between items-start">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <span className="text-xl">{config.emoji}</span>
              {config.title}
            </h2>
            <p className="text-tx3 text-xs mt-0.5">{config.description}</p>
          </div>
          <button onClick={onClose} className="text-tx3 hover:text-tx p-1" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Breakdown / Formula */}
          <FormulaBreakdown type={type} stats={stats} />

          {/* Transaction list */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="font-bold text-sm">Detail Transaksi Terbaru</h3>
              <span className="text-tx3 text-[11px] tabular-nums">
                {isLoading ? 'Loading...' : `${filteredTx.length} item`}
              </span>
            </div>
            {isLoading ? (
              <div className="text-tx3 text-sm text-center py-6">⏳ Loading transaksi...</div>
            ) : filteredTx.length === 0 ? (
              <div className="bg-sf2 border border-bd border-dashed rounded-md p-6 text-center text-tx3 text-sm">
                Belum ada transaksi
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTx.slice(0, 30).map((tx) => (
                  <div
                    key={`${tx.type}-${tx.id}`}
                    className="bg-sf2 border border-bd rounded-md p-2.5 flex justify-between items-center gap-2"
                  >
                    <div className="flex gap-2 flex-1 min-w-0">
                      <div className="text-base flex-shrink-0">{tx.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs truncate">{tx.title}</div>
                        <div className="text-tx3 text-[10px] truncate">{tx.subtitle}</div>
                        <div className="text-tx3 text-[10px]">{formatDate(tx.date)}</div>
                      </div>
                    </div>
                    <div
                      className={`font-bold text-xs tabular-nums whitespace-nowrap ${
                        tx.direction === 'IN' ? 'text-gr' : 'text-rd'
                      }`}
                    >
                      {tx.direction === 'IN' ? '+' : '-'}
                      {formatRupiah(tx.nominal)}
                    </div>
                  </div>
                ))}
                {filteredTx.length > 30 && (
                  <div className="text-tx3 text-[11px] text-center pt-2">
                    + {filteredTx.length - 30} transaksi lainnya. Untuk detail lengkap, buka{' '}
                    <a href="/laporan" className="text-bl font-semibold hover:underline">
                      Laporan
                    </a>
                    .
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-bd flex justify-between items-center bg-sf2 rounded-b-lg">
          <span className="text-tx3 text-[11px]">
            💡 Klik <strong>Laporan</strong> untuk filter periode & export
          </span>
          <button onClick={onClose} className="btn btn-pri text-xs">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function FormulaBreakdown({ type, stats }: { type: KpiDetailType; stats: DashboardStats }) {
  if (type === 'pendapatan_net') {
    return (
      <div className="bg-sf2 border border-bd rounded-md p-3 space-y-1.5 text-xs">
        <div className="text-tx3 text-[11px] font-bold uppercase tracking-wider mb-2">Formula</div>
        <Row label="Pendapatan Kotor (semua pembayaran)" value={stats.pendapatanKotor} accent="text-gr" />
        <Row label="Total Refund Customer" value={-stats.totalRefund} accent="text-rd" />
        <div className="border-t border-bd pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
          <span>Pendapatan Net</span>
          <span className="tabular-nums text-gr">{formatRupiah(stats.pendapatanNet)}</span>
        </div>
      </div>
    );
  }

  if (type === 'uang_masuk') {
    return (
      <div className="bg-sf2 border border-bd rounded-md p-3 space-y-1.5 text-xs">
        <div className="text-tx3 text-[11px] font-bold uppercase tracking-wider mb-2">Detail</div>
        <Row label="Uang Kos (Layanan KOS)" value={stats.uangKos} accent="text-gr" />
        <Row label="Uang Penginapan (Layanan PENGINAPAN)" value={stats.uangPenginapan} accent="text-gr" />
        <div className="text-tx3 text-[10px] italic pt-1">
          *Per layanan dihitung dari Net_Diterima per booking.
        </div>
        <div className="border-t border-bd pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
          <span>Total Pendapatan Kotor</span>
          <span className="tabular-nums text-gr">{formatRupiah(stats.pendapatanKotor)}</span>
        </div>
      </div>
    );
  }

  if (type === 'uang_keluar') {
    return (
      <div className="bg-sf2 border border-bd rounded-md p-3 space-y-1.5 text-xs">
        <div className="text-tx3 text-[11px] font-bold uppercase tracking-wider mb-2">Detail</div>
        <Row label="🧹 Fee Penjaga" value={stats.totalFee} accent="text-am" />
        <Row label="🛒 Belanja Operasional" value={stats.totalBelanja} accent="text-am" />
        <div className="border-t border-bd pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
          <span>Total Uang Keluar</span>
          <span className="tabular-nums text-am">{formatRupiah(stats.totalFee + stats.totalBelanja)}</span>
        </div>
      </div>
    );
  }

  // net_cash
  return (
    <div className="bg-sf2 border border-bd rounded-md p-3 space-y-1.5 text-xs">
      <div className="text-tx3 text-[11px] font-bold uppercase tracking-wider mb-2">Formula Lengkap</div>
      <Row label="Pendapatan Kotor" value={stats.pendapatanKotor} accent="text-gr" />
      <Row label="Refund Customer" value={-stats.totalRefund} accent="text-rd" />
      <Row label="Fee Penjaga" value={-stats.totalFee} accent="text-rd" />
      <Row label="Belanja Operasional" value={-stats.totalBelanja} accent="text-rd" />
      <div className="border-t border-bd pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
        <span>Net Cash</span>
        <span className={`tabular-nums ${stats.netCash >= 0 ? 'text-gr' : 'text-rd'}`}>
          {formatRupiah(stats.netCash)}
        </span>
      </div>
      <div className="text-tx3 text-[10px] italic pt-1">
        *Pendapatan Net - (Refund + Fee + Belanja) = Net Cash
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const isNegative = value < 0;
  return (
    <div className="flex justify-between text-xs">
      <span className="text-tx3">{label}</span>
      <span className={`font-semibold tabular-nums ${accent || 'text-tx'}`}>
        {isNegative ? '-' : ''}
        {formatRupiah(Math.abs(value))}
      </span>
    </div>
  );
}
