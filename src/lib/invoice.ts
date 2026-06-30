// Top Hills — Invoice data model, helpers, seed scenarios & booking mapper.

export type Payment = { label: string; amount: number };
export type LineItem = { desc: string; note?: string; qty: number; price: number };

export type Layanan = 'kost' | 'penginapan';

export type Invoice = {
  id: string; // e.g. "TH/PNG/2026-0613"
  date: string; // "20 Juni 2026"
  due: string;
  tag?: string; // optional status pill (TAGIHAN DP / PELUNASAN)
  layanan?: Layanan; // menentukan rekening & QR yang dipakai
  customer: { name: string; phone: string; kind: string };
  booking: { room: string; period: string };
  items: LineItem[];
  payments: Payment[];
};

/** Identitas pembayaran & pemilik — editable di Pengaturan → Kwitansi. */
export type InvoiceIdentity = {
  bankName: string;
  accountNo: string; // boleh berspasi; copy ambil digit saja
  accountName: string;
  waResmi: string;
  ownerName: string;
  ownerTitle: string;
  qrisBase64?: string; // gambar QRIS (opsional)
};

export const DEFAULT_IDENTITY: InvoiceIdentity = {
  bankName: 'BCA — KCP Padang',
  accountNo: '8465 0099 1234',
  accountName: 'Azhar Latif',
  waResmi: '0811-6646-615',
  ownerName: 'Azhar Latif',
  ownerTitle: 'Pemilik · Top Hills',
  qrisBase64: '',
};

export function rp(n: number): string {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}
export function digitsOnly(s: string): string {
  return String(s || '').replace(/\D/g, '');
}

export function deriveInvoice(inv: Invoice) {
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  const totalPaid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, subtotal - totalPaid);
  return { subtotal, totalPaid, balance, fullyPaid: balance === 0 };
}

// ── 5 contoh skenario (kasus nyata) ──────────────────────────────────────────
export const SEED_SCENARIOS: Record<string, Invoice> = {
  'penginapan-harian': {
    id: 'TH/PNG/2026-0613', date: '20 Juni 2026', due: '20 Juni 2026', layanan: 'penginapan',
    customer: { name: 'Sarah Amelia', phone: '0812-6644-1290', kind: 'Penginapan · Tamu Umum' },
    booking: { room: 'Executive — Gedung C', period: '3 malam · 20–23 Jun 2026' },
    items: [
      { desc: 'Kamar Executive', note: 'Per malam · maks 3 orang', qty: 3, price: 350000 },
      { desc: 'Extra bed', note: 'Tambahan 1 unit', qty: 1, price: 100000 },
    ],
    payments: [{ label: 'Dibayar Penuh', amount: 1150000 }],
  },
  'penginapan-bulanan': {
    id: 'TH/PNG/2026-0627', date: '28 Juni 2026', due: '01 Juli 2026', layanan: 'penginapan',
    customer: { name: 'Nurul Fadhilah', phone: '0813-7781-4502', kind: 'Penginapan · Bulanan' },
    booking: { room: 'Executive — Gedung C', period: 'Sewa 1 Bulan · 01–31 Jul 2026' },
    items: [{ desc: 'Sewa Kamar Executive', note: 'Per bulan · termasuk AC & WiFi', qty: 1, price: 4000000 }],
    payments: [{ label: 'Uang Muka (DP)', amount: 1000000 }],
  },
  'penginapan-bulanan-lunas': {
    id: 'TH/PNG/2026-0631', date: '01 Juli 2026', due: '01 Juli 2026', layanan: 'penginapan',
    customer: { name: 'Nurul Fadhilah', phone: '0813-7781-4502', kind: 'Penginapan · Bulanan' },
    booking: { room: 'Executive — Gedung C', period: 'Sewa 1 Bulan · 01–31 Jul 2026' },
    items: [{ desc: 'Sewa Kamar Executive', note: 'Per bulan · termasuk AC & WiFi', qty: 1, price: 4000000 }],
    payments: [{ label: 'Dibayar Penuh', amount: 4000000 }],
  },
  'kost-dp': {
    id: 'TH/KOST/2026-0148', date: '25 Juni 2026', due: '01 Juli 2026', tag: 'TAGIHAN DP', layanan: 'kost',
    customer: { name: 'Aisyah Putri', phone: '0852-6390-1187', kind: 'Kost Putri · Booking' },
    booking: { room: 'Kamar 12A — Gedung A', period: 'Paket 6 Bulan · mulai 01 Jul 2026' },
    items: [{ desc: 'Sewa Kost Putri', note: 'Paket 6 Bulan · Gedung A', qty: 6, price: 1300000 }],
    payments: [{ label: 'Uang Muka (DP)', amount: 4000000 }],
  },
  'kost-tahunan': {
    id: 'TH/KOST/2026-0152', date: '23 Juni 2026', due: '30 Juni 2026', layanan: 'kost',
    customer: { name: 'Salsabila Rahma', phone: '0878-2244-9031', kind: 'Kost Putri · Tahunan' },
    booking: { room: 'Kamar 07B — Gedung B', period: 'Paket Tahunan · Jul 2026 – Jun 2027' },
    items: [{ desc: 'Sewa Kost Putri', note: 'Paket 1 Tahun (12 bulan) · AC', qty: 1, price: 15600000 }],
    payments: [{ label: 'Dibayar Penuh', amount: 15600000 }],
  },
  'kost-pelunasan': {
    id: 'TH/KOST/2026-0148-PL', date: '02 Juli 2026', due: '02 Juli 2026', tag: 'PELUNASAN', layanan: 'kost',
    customer: { name: 'Aisyah Putri', phone: '0852-6390-1187', kind: 'Kost Putri · Pelunasan' },
    booking: { room: 'Kamar 12A — Gedung A', period: 'Pelunasan · Paket 6 Bulan' },
    items: [{ desc: 'Sewa Kost Putri', note: 'Paket 6 Bulan · Gedung A', qty: 6, price: 1300000 }],
    payments: [
      { label: 'DP · dibayar 25 Jun 2026', amount: 4000000 },
      { label: 'Pelunasan', amount: 3800000 },
    ],
  },
};

export const SCENARIO_LABELS: Record<string, string> = {
  'penginapan-harian': 'Penginapan harian (Lunas)',
  'penginapan-bulanan': 'Penginapan bulanan (DP)',
  'penginapan-bulanan-lunas': 'Penginapan bulanan (Lunas)',
  'kost-dp': 'Kost — Tagihan DP',
  'kost-tahunan': 'Kost tahunan (Lunas)',
  'kost-pelunasan': 'Kost — Pelunasan',
};

// ── Booking → Invoice ────────────────────────────────────────────────────────
function tgl(d?: string): string {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function tglShort(d?: string): string {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

type BookingLike = {
  BookingID?: string; Nama_Customer?: string; WhatsApp?: string;
  Nama_Kamar?: string; Gedung?: string; Tipe_Kamar?: string;
  Layanan?: string; Paket?: string; Jumlah_Periode?: number;
  CheckIn?: string; CheckOut?: string;
  Harga_Kamar?: number; Extra_Charge?: number; Diskon?: number;
  Harga_Total_Net?: number; Net_Diterima?: number; Sisa_Bayar?: number;
  Catatan?: string;
};
type PaymentRecordLike = { Jenis_Bayar?: string; Nominal?: number; Tanggal_Bayar?: string };

// Rincian harga satuan booking /info, disimpan di catatan: "[RINC u=.. q=.. a=..]"
// u = harga satuan kamar/periode · q = jumlah periode · a = total biaya tambahan.
export function parseRincian(catatan?: string): { unit: number; qty: number; addon: number } | null {
  const m = String(catatan || '').match(/\[RINC\s+u=(\d+)\s+q=(\d+)\s+a=(\d+)\]/i);
  if (!m) return null;
  return { unit: Number(m[1]), qty: Math.max(1, Number(m[2])), addon: Number(m[3]) };
}

/** Bangun Invoice dari sebuah booking (+ rincian pembayaran bila ada). */
export function bookingToInvoice(
  b: BookingLike,
  payments: PaymentRecordLike[] | undefined,
): Invoice {
  const isKost = String(b.Layanan || '').toUpperCase() === 'KOS';
  const pfx = isKost ? 'KOST' : 'PNG';
  const idTail = String(b.BookingID || '').replace(/[^0-9]/g, '').slice(-4) || '0000';
  const id = `TH/${pfx}/${new Date().getFullYear()}-${idTail}`;

  // Harga satuan kamar & jumlah periode. Booking /booking mengisi kolom
  // Harga_Kamar/Jumlah_Periode; booking /info menyimpannya di catatan ([RINC]).
  const rinc = parseRincian(b.Catatan);
  const colUnit = Number(b.Harga_Kamar || 0);
  const unit = colUnit > 0 ? colUnit : (rinc?.unit || 0);
  const qty = colUnit > 0 ? Math.max(Number(b.Jumlah_Periode || 1), 1) : Math.max(rinc?.qty || 1, 1);
  const extra = Number(b.Extra_Charge || 0);
  const diskon = Number(b.Diskon || 0);
  // SUMBER KEBENARAN total = Harga_Total_Net (dipakai juga dashboard & sisa DP).
  const officialTotal = Number(b.Harga_Total_Net || 0);
  const roomDesc = `Sewa ${b.Nama_Kamar || (isKost ? 'Kost Putri' : 'Kamar')}`;
  const roomNote = [b.Paket, b.Gedung].filter(Boolean).join(' · ');
  const roomSub = unit * qty;

  let items: LineItem[];
  if (unit > 0) {
    // Baris kamar: QTY × HARGA = subtotal kamar (selalu tampil).
    items = [{ desc: roomDesc, note: roomNote, qty, price: unit }];
    // Sisanya (fasilitas, biaya/orang tambahan, diskon) sebagai baris terpisah,
    // dipatok ke total resmi supaya Subtotal invoice = total booking persis.
    const addon = officialTotal > 0 ? officialTotal - roomSub : (rinc?.addon ?? 0) + extra - diskon;
    if (addon > 1) items.push({ desc: 'Fasilitas & biaya tambahan', note: '', qty: 1, price: addon });
    else if (addon < -1) items.push({ desc: 'Diskon / penyesuaian', note: '', qty: 1, price: addon });
  } else if (officialTotal > 0) {
    // Tak ada harga satuan di mana pun → satu baris memakai total resmi.
    items = [{ desc: roomDesc, note: roomNote, qty: 1, price: officialTotal }];
  } else {
    items = [{ desc: roomDesc, note: roomNote, qty: 1, price: 0 }];
  }

  // Payments: dari rincian bila ada, kalau tidak pakai Net_Diterima.
  let pays: Payment[] = [];
  if (payments && payments.length) {
    pays = payments.map((p) => ({
      label:
        (String(p.Jenis_Bayar || 'Pembayaran').toUpperCase() === 'PELUNASAN' ? 'Pelunasan' : 'Uang Muka (DP)') +
        (p.Tanggal_Bayar ? ` · ${tglShort(p.Tanggal_Bayar)}` : ''),
      amount: Number(p.Nominal || 0),
    }));
    // Nominal pembayaran bersifat KOTOR. Bila ada refund, kurangi supaya
    // "dibayar" = uang yg benar2 diterima (= Net_Diterima), sehingga SISA &
    // status LUNAS/KWITANSI tidak salah (mis. sudah refund tapi terlanjur LUNAS).
    const refund = Number(b.Refund_Total || 0);
    if (refund > 0) pays.push({ label: 'Refund (dikembalikan)', amount: -refund });
  } else {
    const net = Number(b.Net_Diterima || 0);
    if (net > 0) {
      const sisa = Number(b.Sisa_Bayar || 0);
      pays = [{ label: sisa > 0 ? 'Uang Muka (DP)' : 'Dibayar Penuh', amount: net }];
    }
  }

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, subtotal - totalPaid);
  const tag = balance > 0 ? 'TAGIHAN DP' : pays.length > 1 ? 'PELUNASAN' : undefined;

  // Check-out: bila tersimpan kosong / ≤ check-in (data kost lama salah), hitung
  // dari check-in + periode paket → period invoice tak tampil "22 Jul – 22 Jul".
  const co = (() => {
    const ci = b.CheckIn ? new Date(b.CheckIn) : null;
    const out = b.CheckOut ? new Date(b.CheckOut) : null;
    const ciOk = ci && !isNaN(ci.getTime());
    const outOk = out && !isNaN(out.getTime());
    if (ciOk && (!outOk || (out as Date).getTime() <= (ci as Date).getTime())) {
      const t = String(b.Paket || '').toUpperCase();
      const bln = /TAHUN|SETAHUN/.test(t) ? 12 : (t.match(/(\d+)\s*BULAN/) ? Number(t.match(/(\d+)\s*BULAN/)![1]) : (/6\s*BULAN/.test(t) ? 6 : 0));
      if (bln > 0) {
        const d = new Date(ci as Date);
        const day = d.getDate();
        d.setMonth(d.getMonth() + bln);
        if (d.getDate() < day) d.setDate(0);
        return d.toISOString().split('T')[0];
      }
    }
    return b.CheckOut || '';
  })();
  const period = b.CheckIn && co ? `${tglShort(b.CheckIn)} – ${tglShort(co)}` : b.Paket || '';

  return {
    id,
    date: tgl(new Date().toISOString()),
    due: b.CheckIn ? tgl(b.CheckIn) : tgl(new Date().toISOString()),
    tag,
    layanan: isKost ? 'kost' : 'penginapan',
    customer: {
      name: b.Nama_Customer || '-',
      phone: b.WhatsApp || '',
      kind: [isKost ? 'Kost Putri' : 'Penginapan', b.Paket].filter(Boolean).join(' · '),
    },
    booking: { room: [b.Nama_Kamar, b.Gedung].filter(Boolean).join(' — '), period },
    items,
    payments: pays,
  };
}
