/*******************************************************
 * PATCH B4-5 — Backend untuk Laporan + Layout 3D
 *
 * Tambahan:
 *   - getReportData(data) — period-filtered transactions + summary + chart
 *
 * Layout 3D dan Kwitansi reuse endpoint V2 yang udah ada
 * (layoutApi + kwitansiApi), gak perlu function baru.
 *
 * CARA APLIKASIIN:
 * =============================================================
 *
 * STEP A — TopHillsLogic.gs (1 function baru)
 *
 * 1. Buka TopHillsLogic.gs di Apps Script
 * 2. Scroll ke paling bawah (Cmd+End)
 * 3. Paste SECTION 1 di bawah
 * 4. Save (Cmd+S)
 *
 * STEP B — Api.js (1 dispatch case)
 *
 * 5. Buka Api.js
 * 6. Cari function dispatchV1_, di blok ===== READS =====
 * 7. Tambahin 1 baris di blok itu (kalo belum ada):
 *
 *      case 'getReportData':              return getReportData(data);
 *
 * 8. Save (Cmd+S)
 *
 * STEP C — Deploy
 *
 * Deploy → Manage deployments → ✏️ Edit → Version: NEW VERSION → Deploy
 *
 * VERIFY setelah re-deploy:
 *   <URL>?action=getReportData&apiKey=<KEY>&accessCode=BETA-4RQQ8R&data={"startDate":"2026-05-01","endDate":"2026-06-30"}
 *
 * Harus return: { ok: true, data: { period, summary, transactions, chart } }
 *******************************************************/


/* ============================================================
 * SECTION 1 — Paste di paling bawah TopHillsLogic.gs
 * ============================================================ */

function getReportData(data) {
  const startStr = String((data && data.startDate) || '');
  const endStr = String((data && data.endDate) || '');

  if (!startStr || !endStr) {
    throw new Error('startDate dan endDate wajib diisi (format: YYYY-MM-DD).');
  }

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Format tanggal invalid. Pakai YYYY-MM-DD.');
  }
  if (startDate > endDate) {
    throw new Error('startDate harus sebelum endDate.');
  }

  // Helper: filter by date range
  function withinRange(dateValue) {
    if (!dateValue) return false;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return false;
    return d >= startDate && d <= endDate;
  }

  // Helper: format date as YYYY-MM-DD for grouping
  function dateKey(dateValue) {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  // ===== Payments (IN) =====
  const payments = getSheetObjects_(SHEETS.PAYMENTS)
    .filter(function(p) { return withinRange(p.Tanggal_Bayar); })
    .map(function(p) {
      return {
        type: 'PAYMENT',
        icon: '💵',
        date: p.Tanggal_Bayar || '',
        nominal: Number(p.Nominal || 0),
        direction: 'IN',
        title: (p.Jenis_Bayar || 'Pembayaran') + ' · ' + (p.Nama_Customer || '-'),
        subtitle: (p.Nama_Kamar || '-') + ' · ' + (p.Metode || '-'),
        bookingId: p.BookingID || '',
        diterimaOleh: p.Diterima_Oleh || '',
        catatan: p.Catatan || ''
      };
    });

  // ===== Refunds (OUT) =====
  const refunds = getSheetObjects_(SHEETS.REFUNDS)
    .filter(function(r) { return withinRange(r.Tanggal_Refund); })
    .map(function(r) {
      return {
        type: 'REFUND',
        icon: '↩️',
        date: r.Tanggal_Refund || '',
        nominal: Number(r.Nominal || 0),
        direction: 'OUT',
        title: 'Refund · ' + (r.Nama_Customer || '-'),
        subtitle: (r.Nama_Kamar || '-') + ' · ' + (r.Metode_Refund || r.Metode || '-'),
        bookingId: r.BookingID || '',
        diterimaOleh: r.Dikembalikan_Oleh || '',
        catatan: r.Alasan || r.Catatan || ''
      };
    });

  // ===== Fees (OUT) =====
  const fees = getSheetObjects_(SHEETS.FEES)
    .filter(function(f) { return withinRange(f.Tanggal_Fee || f.Tanggal); })
    .map(function(f) {
      return {
        type: 'FEE',
        icon: '🧹',
        date: f.Tanggal_Fee || f.Tanggal || '',
        nominal: Number(f.Nominal || 0),
        direction: 'OUT',
        title: (f.Jenis_Fee || 'Fee') + ' · ' + (f.Nama_Penjaga || '-'),
        subtitle: (f.Nama_Kamar || 'Tanpa kamar') + ' · ' + (f.Status_Bayar || '-'),
        bookingId: f.BookingID || '',
        diterimaOleh: f.Nama_Penjaga || '',
        catatan: f.Catatan || ''
      };
    });

  // ===== Expenses (OUT) =====
  const expenses = getSheetObjects_(SHEETS.EXPENSES)
    .filter(function(e) { return withinRange(e.Tanggal); })
    .map(function(e) {
      return {
        type: 'EXPENSE',
        icon: '🛒',
        date: e.Tanggal || '',
        nominal: Number(e.Nominal || 0),
        direction: 'OUT',
        title: (e.Item || 'Belanja') + ' · ' + (e.Kategori || '-'),
        subtitle: (e.Unit || '-') + ' · ' + (e.Metode || '-'),
        bookingId: '',
        diterimaOleh: e.Dibeli_Oleh || '',
        catatan: e.Catatan || ''
      };
    });

  // Combine all transactions
  const allTx = payments.concat(refunds).concat(fees).concat(expenses);

  allTx.sort(function(a, b) {
    var ta = a.date ? new Date(a.date).getTime() : 0;
    var tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });

  // ===== Summary aggregates =====
  const totalIn = payments.reduce(function(s, p) { return s + p.nominal; }, 0);
  const totalRefund = refunds.reduce(function(s, r) { return s + r.nominal; }, 0);
  const totalFee = fees.reduce(function(s, f) { return s + f.nominal; }, 0);
  const totalExpense = expenses.reduce(function(s, e) { return s + e.nominal; }, 0);
  const totalOut = totalRefund + totalFee + totalExpense;
  const netCash = totalIn - totalOut;

  // ===== Daily chart aggregation =====
  const dailyMap = {}; // dateKey -> { in, out }

  allTx.forEach(function(tx) {
    const k = dateKey(tx.date);
    if (!k) return;
    if (!dailyMap[k]) dailyMap[k] = { date: k, in: 0, out: 0 };
    if (tx.direction === 'IN') dailyMap[k].in += tx.nominal;
    else dailyMap[k].out += tx.nominal;
  });

  // Fill in days with no transactions (for continuous chart)
  const chart = [];
  const cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    const k = dateKey(cursor);
    chart.push(dailyMap[k] || { date: k, in: 0, out: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // ===== Booking activity =====
  const bookings = getSheetObjects_(SHEETS.BOOKINGS)
    .filter(function(b) { return withinRange(b.Timestamp) || withinRange(b.CheckIn); });

  const bookingStats = {
    totalBooking: bookings.length,
    booking_aktif: bookings.filter(function(b) { return !isClosedStatus_(b.Status_Booking); }).length,
    booking_selesai: bookings.filter(function(b) { return b.Status_Booking === 'SELESAI'; }).length,
    booking_cancel: bookings.filter(function(b) {
      return String(b.Status_Booking || '').indexOf('CANCEL') === 0;
    }).length,
    omzet: bookings.reduce(function(s, b) { return s + Number(b.Harga_Total_Net || 0); }, 0)
  };

  return {
    period: {
      startDate: Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      endDate: Utilities.formatDate(endDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      days: chart.length
    },
    summary: {
      totalIn: totalIn,
      totalRefund: totalRefund,
      totalFee: totalFee,
      totalExpense: totalExpense,
      totalOut: totalOut,
      netCash: netCash,
      countPayment: payments.length,
      countRefund: refunds.length,
      countFee: fees.length,
      countExpense: expenses.length,
      countAll: allTx.length
    },
    bookingStats: bookingStats,
    transactions: allTx,
    chart: chart
  };
}
