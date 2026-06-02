/**
 * Excel General Ledger Export
 *
 * Format akuntansi standar (cash book / buku kas):
 *   - Header: Nama bisnis, periode, saldo awal
 *   - Detail: Tanggal | No.Voucher | Keterangan | Akun | Debit (Masuk) | Kredit (Keluar) | Saldo Berjalan
 *   - Footer: Total Debit, Total Kredit, Saldo Akhir
 *
 * Uses dynamic import for xlsx to avoid bloating main bundle.
 */

import type { ReportData } from './api';

interface GLOptions {
  reportData: ReportData;
  businessName?: string;
  saldoAwal?: number;
}

// Map transaction type to GL account name
function accountForType(type: string): string {
  switch (type) {
    case 'PAYMENT': return 'Pendapatan Penyewaan';
    case 'REFUND': return 'Refund Customer';
    case 'FEE': return 'Beban Fee Penjaga';
    case 'EXPENSE': return 'Beban Operasional';
    default: return 'Lain-lain';
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function exportGeneralLedgerExcel({
  reportData,
  businessName = 'KelolaKos',
  saldoAwal = 0,
}: GLOptions): Promise<void> {
  // Dynamic import xlsx (heavy ~1MB, load only when needed)
  const XLSX = await import('xlsx');

  const sortedTx = [...reportData.transactions].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Build rows
  const headerRows: (string | number | null)[][] = [
    [businessName],
    ['BUKU KAS / GENERAL LEDGER'],
    [`Periode: ${reportData.period.startDate} s/d ${reportData.period.endDate}`],
    [`Dibuat: ${new Date().toLocaleString('id-ID')}`],
    [], // blank row
  ];

  // Column headers
  const tableHeaders = [
    'No.',
    'Tanggal',
    'No. Voucher',
    'Akun',
    'Keterangan',
    'Debit (Masuk)',
    'Kredit (Keluar)',
    'Saldo Berjalan',
  ];

  // Saldo awal row
  const detailRows: (string | number | null)[][] = [];
  detailRows.push([
    '',
    formatDate(reportData.period.startDate),
    '',
    'Saldo Awal',
    'Saldo kas pada awal periode',
    null,
    null,
    saldoAwal,
  ]);

  let saldo = saldoAwal;
  sortedTx.forEach((tx, idx) => {
    const isDebit = tx.direction === 'IN';
    if (isDebit) saldo += tx.nominal;
    else saldo -= tx.nominal;

    detailRows.push([
      idx + 1,
      formatDate(tx.date),
      tx.title.match(/^[A-Z]+-[\w-]+/)?.[0] || `${tx.type}-${idx + 1}`,
      accountForType(tx.type),
      `${tx.title}${tx.subtitle ? ' (' + tx.subtitle + ')' : ''}${tx.diterimaOleh ? ' [' + tx.diterimaOleh + ']' : ''}`,
      isDebit ? tx.nominal : null,
      !isDebit ? tx.nominal : null,
      saldo,
    ]);
  });

  // Footer rows
  const totalDebit = sortedTx.filter((t) => t.direction === 'IN').reduce((s, t) => s + t.nominal, 0);
  const totalKredit = sortedTx.filter((t) => t.direction === 'OUT').reduce((s, t) => s + t.nominal, 0);
  const saldoAkhir = saldoAwal + totalDebit - totalKredit;

  const footerRows: (string | number | null)[][] = [
    [],
    ['', '', '', '', 'TOTAL', totalDebit, totalKredit, saldoAkhir],
    [],
    ['SUMMARY'],
    ['Saldo Awal', saldoAwal],
    ['Total Pemasukan (Debit)', totalDebit],
    ['Total Pengeluaran (Kredit)', totalKredit],
    ['Net Cash Flow Periode', totalDebit - totalKredit],
    ['Saldo Akhir', saldoAkhir],
    [],
    ['Detail Per Kategori:'],
    [`  - Pembayaran Customer (${reportData.summary.countPayment} transaksi)`, reportData.summary.totalIn],
    [`  - Refund Customer (${reportData.summary.countRefund} transaksi)`, -reportData.summary.totalRefund],
    [`  - Fee Penjaga (${reportData.summary.countFee} transaksi)`, -reportData.summary.totalFee],
    [`  - Belanja Operasional (${reportData.summary.countExpense} transaksi)`, -reportData.summary.totalExpense],
  ];

  const allRows = [...headerRows, tableHeaders, ...detailRows, ...footerRows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 12 },  // Tanggal
    { wch: 22 },  // No Voucher
    { wch: 25 },  // Akun
    { wch: 50 },  // Keterangan
    { wch: 18 },  // Debit
    { wch: 18 },  // Kredit
    { wch: 18 },  // Saldo
  ];

  // Merge cells for title (rows 0-3 span first 5 cols)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Business name
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }, // Periode
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } }, // Dibuat
  ];

  // Format number cells (currency)
  const numFmt = '#,##0;[Red]-#,##0';
  const tableStartRow = headerRows.length + 1; // after header rows + column header row
  const tableEndRow = tableStartRow + detailRows.length;

  for (let row = tableStartRow; row < tableEndRow; row++) {
    ['F', 'G', 'H'].forEach((col) => {
      const cellRef = `${col}${row + 1}`;
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = numFmt;
      }
    });
  }

  // Format footer summary cells
  const footerStartRow = tableEndRow + 1;
  for (let row = footerStartRow; row < allRows.length; row++) {
    const cellRefA = `A${row + 1}`;
    const cellRefB = `B${row + 1}`;
    if (ws[cellRefB] && typeof ws[cellRefB].v === 'number') {
      ws[cellRefB].z = numFmt;
    }
    if (ws[cellRefA] && typeof ws[cellRefA].v === 'number') {
      ws[cellRefA].z = numFmt;
    }
  }

  // Total row formatting
  const totalRowIdx = tableEndRow + 1; // +1 because of blank row before TOTAL
  ['F', 'G', 'H'].forEach((col) => {
    const cellRef = `${col}${totalRowIdx + 1}`;
    if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
      ws[cellRef].z = numFmt;
    }
  });

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');

  // Detail per transaction type as separate sheets
  ['PAYMENT', 'REFUND', 'FEE', 'EXPENSE'].forEach((type) => {
    const typeTransactions = sortedTx.filter((t) => t.type === type);
    if (typeTransactions.length === 0) return;

    const typeName = type === 'PAYMENT' ? 'Pembayaran'
                   : type === 'REFUND' ? 'Refund'
                   : type === 'FEE' ? 'Fee Penjaga'
                   : 'Belanja Operasional';

    const typeRows: (string | number | null)[][] = [
      [`${typeName} · ${typeTransactions.length} transaksi`],
      [`Total: ${typeTransactions.reduce((s, t) => s + t.nominal, 0).toLocaleString('id-ID')}`],
      [],
      ['No.', 'Tanggal', 'Keterangan', 'Sub-detail', 'PIC', 'Nominal', 'Catatan'],
      ...typeTransactions.map((t, i) => [
        i + 1,
        formatDate(t.date),
        t.title,
        t.subtitle,
        t.diterimaOleh,
        t.nominal,
        t.catatan,
      ]),
    ];

    const typeWs = XLSX.utils.aoa_to_sheet(typeRows);
    typeWs['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 35 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, typeWs, typeName.slice(0, 30));
  });

  // Generate filename and download
  const filename = `GL-${reportData.period.startDate}-to-${reportData.period.endDate}.xlsx`;
  XLSX.writeFile(wb, filename);
}
