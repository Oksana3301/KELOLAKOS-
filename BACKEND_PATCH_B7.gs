/*******************************************************
 * PATCH B7 — Transaction Delete (Payment/Refund/Fee/Expense)
 *
 * Tambahan:
 *   - submitTransactionDelete(data) — hapus 1 row dari sheet
 *     PAYMENTS/REFUNDS/FEES/EXPENSES + recompute booking state
 *
 * Frontend Keuangan akan kasih tombol 🗑️ di tiap recent transaction.
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
 * 6. Cari function dispatchV1_, di blok ===== WRITES =====
 * 7. Tambahin 1 baris di blok itu:
 *
 *      case 'submitTransactionDelete':    return submitTransactionDelete(data);
 *
 * 8. Save (Cmd+S)
 *
 * STEP C — Deploy
 *
 * Deploy → Manage deployments → ✏️ Edit → Version: NEW VERSION → Deploy
 *
 * =============================================================
 * VERIFY setelah re-deploy:
 *   <URL>?action=submitTransactionDelete&apiKey=<KEY>&accessCode=BETA-4RQQ8R&data={"type":"PAYMENT","id":"NON_EXISTENT_ID"}
 *
 * Harus return: { ok: false, message: "PAYMENT dengan ID NON_EXISTENT_ID tidak ditemukan." }
 * (Itu artinya function di-call dengan benar, cuma data yang gak ada — perilaku expected.)
 *******************************************************/


/* ============================================================
 * SECTION 1 — Paste di paling bawah TopHillsLogic.gs
 * ============================================================ */

function submitTransactionDelete(data) {
  if (!data || !data.type || !data.id) {
    throw new Error('Field "type" dan "id" wajib diisi.');
  }

  const type = String(data.type).toUpperCase();
  const id = String(data.id);

  // Config per type
  const config = {
    'PAYMENT': {
      sheetName: SHEETS.PAYMENTS,
      idColumn: 'PaymentID',
      hasBookingLink: true,
      label: 'Pembayaran'
    },
    'REFUND': {
      sheetName: SHEETS.REFUNDS,
      idColumn: 'RefundID',
      hasBookingLink: true,
      label: 'Refund'
    },
    'FEE': {
      sheetName: SHEETS.FEES,
      idColumn: 'FeeID',
      hasBookingLink: true,
      label: 'Fee Penjaga'
    },
    'EXPENSE': {
      sheetName: SHEETS.EXPENSES,
      idColumn: 'ExpenseID',
      hasBookingLink: false,
      label: 'Belanja Operasional'
    }
  };

  const cfg = config[type];
  if (!cfg) {
    throw new Error('Type harus salah satu: PAYMENT, REFUND, FEE, EXPENSE. Diberikan: ' + type);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(cfg.sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + cfg.sheetName + '" tidak ditemukan.');
  }

  // Find row
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error(cfg.label + ' dengan ID ' + id + ' tidak ditemukan (sheet kosong).');
  }

  const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = allData[0];
  const idColIdx = headers.indexOf(cfg.idColumn);

  if (idColIdx === -1) {
    throw new Error('Kolom "' + cfg.idColumn + '" tidak ditemukan di sheet ' + cfg.sheetName + '.');
  }

  let foundRow = -1;
  let linkedBookingId = '';
  const bookingIdColIdx = headers.indexOf('BookingID');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idColIdx]) === id) {
      foundRow = i + 1; // 1-indexed
      if (cfg.hasBookingLink && bookingIdColIdx !== -1) {
        linkedBookingId = String(allData[i][bookingIdColIdx] || '');
      }
      break;
    }
  }

  if (foundRow === -1) {
    throw new Error(cfg.label + ' dengan ID ' + id + ' tidak ditemukan.');
  }

  // Delete the row
  sheet.deleteRow(foundRow);

  // Recompute booking state if applicable
  let recomputeStatus = 'not_applicable';
  if (linkedBookingId) {
    try {
      if (typeof recomputeBookingStateLazily_ === 'function') {
        recomputeBookingStateLazily_(linkedBookingId);
        recomputeStatus = 'success';
      } else if (typeof recomputeBookingState_ === 'function') {
        recomputeBookingState_(linkedBookingId);
        recomputeStatus = 'success';
      } else {
        recomputeStatus = 'no_recompute_fn';
      }
    } catch (e) {
      recomputeStatus = 'failed: ' + e.message;
    }
  }

  return {
    message: cfg.label + ' (' + id + ') berhasil dihapus.',
    deletedId: id,
    type: type,
    linkedBookingId: linkedBookingId,
    recompute: recomputeStatus
  };
}
