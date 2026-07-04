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
  // Fallback rekening RESMI per layanan (bila Pengaturan belum diisi).
  const def = isKost
    ? { bank: 'BCA', no: '0320839912', name: 'Azhar Latif' }
    : { bank: 'BCA', no: '0321548473', name: 'Atika Dewi Suryani' };
  return {
    bankName: t(bank) || t(s?.inv_bank_name) || def.bank,
    accountNo: t(acc) || t(s?.inv_account_no) || def.no,
    accountName: t(accName) || t(s?.inv_account_name) || def.name,
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
  // Kontak untuk follow-up (Helpdesk dari Pengaturan; Bang Mezi penjaga).
  L.push('');
  L.push('*Butuh bantuan?*');
  if (id.waResmi) L.push(`💬 Helpdesk Top Hills: ${id.waResmi}`);
  L.push('💬 Bang Mezi (penjaga): 0838-4161-4871');
  L.push('Terima kasih 🌸 — Top Hills');
  return L.join('\n');
}

/** Recap INTERNAL (untuk Bang Mezi & Admin/owner) saat booking dikonfirmasi:
 *  nama + WA customer, kamar/tipe/gedung, periode, tanggal, status, total/dibayar/
 *  sisa, dan link bukti bayar. Beda dari pesan customer (yang berupa invoice). */
type InternalBooking = {
  Nama_Customer?: string; WhatsApp?: string | number; Layanan?: string;
  Nama_Kamar?: string; Gedung?: string; Tipe_Kamar?: string;
  Paket?: string; Durasi?: string; CheckIn?: string; CheckOut?: string;
  Bukti_Bayar?: string; Bukti_URLs?: string; BookingID?: string;
};
function fmtTglInternal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function buildBookingInternalWaText(
  b: InternalBooking,
  o: { status: 'DP' | 'Lunas'; total: number; dibayar: number },
): string {
  const isKost = String(b.Layanan || '').toUpperCase().includes('KOS');
  const sisa = Math.max(0, (o.total || 0) - (o.dibayar || 0));
  const seen = new Set<string>();
  const bukti = [String(b.Bukti_Bayar || ''), String(b.Bukti_URLs || '')].join('\n')
    .split(/[\s,;|]+/).map((s) => s.trim())
    .filter((u) => u && !seen.has(u) && (seen.add(u), true));
  const wa = String(b.WhatsApp ?? '');
  const L: string[] = [];
  L.push('🌸 *Booking DIKONFIRMASI — Top Hills*');
  L.push(o.status === 'Lunas' ? '(LUNAS) mohon disiapkan ya 🙏' : '(DP) mohon disiapkan ya 🙏');
  L.push('');
  L.push(`👤 Nama: *${b.Nama_Customer || '-'}*`);
  if (wa) L.push(`📱 WA: ${wa}`);
  L.push(`🏠 Layanan: ${isKost ? 'Kost Putri' : 'Penginapan'}`);
  L.push(`🚪 Kamar: *${b.Nama_Kamar || '-'}*${b.Gedung ? ` · ${b.Gedung}` : ''}${b.Tipe_Kamar ? ` (${b.Tipe_Kamar})` : ''}`);
  if (b.Paket || b.Durasi) L.push(`🗓️ Periode: ${b.Paket || b.Durasi}`);
  if (fmtTglInternal(b.CheckIn)) L.push(`📅 Masuk: ${fmtTglInternal(b.CheckIn)}`);
  if (fmtTglInternal(b.CheckOut)) L.push(`📅 Keluar: ${fmtTglInternal(b.CheckOut)}`);
  L.push(`💳 Status: ${o.status === 'Lunas' ? 'LUNAS ✓' : 'DP'}`);
  if (o.total > 0) L.push(`💰 Total: ${rp(o.total)}`);
  if (o.dibayar > 0) L.push(`✅ Dibayar: ${rp(o.dibayar)}`);
  if (sisa > 0) L.push(`⏳ Sisa: ${rp(sisa)}`);
  if (b.BookingID) L.push(`🔖 ${b.BookingID}`);
  if (bukti.length) { L.push('🧾 Bukti bayar:'); bukti.slice(0, 3).forEach((u) => L.push(u)); }
  L.push('');
  L.push('Makasih 🌸');
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
