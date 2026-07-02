// Teks WhatsApp untuk INVOICE (masih ada sisa/DP) atau KUITANSI (lunas), lengkap
// dengan rincian item + rekening. Dipakai di /kwitansi dan auto-kirim saat
// owner mengonfirmasi booking (DP → invoice, Lunas → kuitansi pelunasan).
import type { KwitansiSettings } from './api-v2';
import { JAM_NOTE } from './booking-rules';
import {
  type Invoice,
  type InvoiceIdentity,
  type Layanan,
  deriveInvoice,
  rp,
  DEFAULT_IDENTITY,
} from './invoice';

/** Pilih rekening & QR sesuai jenis (kost / penginapan), fallback ke field lama. */
export function resolveIdentity(s: KwitansiSettings | undefined, layanan: Layanan): InvoiceIdentity {
  const isKost = layanan === 'kost';
  const t = (v: unknown) => String(v ?? '').trim(); // aman walau value berupa angka
  const bank = isKost ? s?.inv_kost_bank_name : s?.inv_png_bank_name;
  const acc = isKost ? s?.inv_kost_account_no : s?.inv_png_account_no;
  const accName = isKost ? s?.inv_kost_account_name : s?.inv_png_account_name;
  // QRIS hanya untuk PENGINAPAN. Kost = tanpa QR (transfer manual).
  const qr = isKost ? '' : (s?.inv_png_qris_base64 || s?.inv_qris_base64);
  return {
    bankName: t(bank) || t(s?.inv_bank_name) || DEFAULT_IDENTITY.bankName,
    accountNo: t(acc) || t(s?.inv_account_no) || DEFAULT_IDENTITY.accountNo,
    accountName: t(accName) || t(s?.inv_account_name) || DEFAULT_IDENTITY.accountName,
    waResmi: t(s?.inv_wa_resmi) || DEFAULT_IDENTITY.waResmi,
    ownerName: t(s?.inv_owner_name) || t(s?.sig_name) || DEFAULT_IDENTITY.ownerName,
    ownerTitle: t(s?.inv_owner_title) || t(s?.sig_title) || DEFAULT_IDENTITY.ownerTitle,
    qrisBase64: isKost ? '' : String(qr || ''),
  };
}

/** Susun pesan WA invoice/kuitansi lengkap: identitas, kamar, periode, rincian
 *  item, total, pembayaran (DP), sisa ATAU status LUNAS, + rekening pembayaran. */
export function buildInvoiceWaText(inv: Invoice, id: InvoiceIdentity): string {
  const { subtotal, balance, fullyPaid } = deriveInvoice(inv);
  const isKost = inv.layanan === 'kost';
  const L: string[] = [];

  L.push(fullyPaid ? '🧾 *KUITANSI PELUNASAN — Top Hills*' : '🧾 *INVOICE / TAGIHAN — Top Hills*');
  L.push(`No: ${inv.id} · ${inv.date}`);
  L.push('');
  L.push(`Halo Kak *${inv.customer.name}* 🌸`);
  L.push(fullyPaid
    ? 'Pembayaranmu sudah *LUNAS*. Terima kasih! Berikut kuitansinya:'
    : 'Terima kasih sudah booking. Berikut rincian & tagihannya:');
  L.push('');

  // Kamar & periode
  if (inv.booking.room) L.push(`🏠 Kamar: *${inv.booking.room}*`);
  L.push(`🛏️ Layanan: ${inv.customer.kind || (isKost ? 'Kost Putri' : 'Penginapan')}`);
  if (inv.booking.period) L.push(`📅 Periode: ${inv.booking.period}`);
  L.push('');

  // Rincian item
  L.push('*Rincian:*');
  inv.items.forEach((it) => {
    const sub = it.qty * it.price;
    L.push(`• ${it.desc}${it.qty > 1 ? ` — ${it.qty} × ${rp(it.price)}` : ''} = ${rp(sub)}`);
    if (it.note) L.push(`   _${it.note}_`);
  });
  L.push(`*Total: ${rp(subtotal)}*`);
  L.push('');

  // Pembayaran + status
  inv.payments.forEach((p) => L.push(`✅ ${p.label}: ${rp(p.amount)}`));
  L.push(fullyPaid ? '*Status: LUNAS ✓*' : `*💰 Sisa tagihan: ${rp(balance)}*`);
  L.push('');

  // Rekening pembayaran (DP → untuk lunasi sisa; Lunas → arsip)
  L.push(fullyPaid ? '*Rekening pembayaran (arsip):*' : '*Silakan lunasi sisa ke rekening:*');
  L.push(`🏦 ${id.bankName}`);
  L.push(`No. Rek: *${id.accountNo}* (a.n. ${id.accountName})`);
  L.push('');

  if (!isKost) L.push(`⏰ ${JAM_NOTE}`);
  if (!fullyPaid) L.push('Setelah transfer, kirim buktinya ke chat ini ya 🙏');
  L.push('Terima kasih 🌸 — Top Hills');
  return L.join('\n');
}

/** Bangun link wa.me berisi invoice/kuitansi untuk sebuah booking. */
export function invoiceWaUrl(text: string, whatsapp?: string | number | null): string {
  let p = String(whatsapp ?? '').replace(/[^0-9]/g, '');
  if (p.startsWith('620')) p = '62' + p.slice(3);
  else if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  const msg = encodeURIComponent(text);
  return p ? `https://wa.me/${p}?text=${msg}` : `https://wa.me/?text=${msg}`;
}
