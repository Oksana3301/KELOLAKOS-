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
};
type PaymentRecordLike = { Jenis_Bayar?: string; Nominal?: number; Tanggal_Bayar?: string };

/** Bangun Invoice dari sebuah booking (+ rincian pembayaran bila ada). */
export function bookingToInvoice(
  b: BookingLike,
  payments: PaymentRecordLike[] | undefined,
): Invoice {
  const isKost = String(b.Layanan || '').toUpperCase() === 'KOS';
  const pfx = isKost ? 'KOST' : 'PNG';
  const idTail = String(b.BookingID || '').replace(/[^0-9]/g, '').slice(-4) || '0000';
  const id = `TH/${pfx}/${new Date().getFullYear()}-${idTail}`;

  const qty = Math.max(Number(b.Jumlah_Periode || 1), 1);
  const price = Number(b.Harga_Kamar || 0);
  const extra = Number(b.Extra_Charge || 0);
  const diskon = Number(b.Diskon || 0);
  // SUMBER KEBENARAN total = Harga_Total_Net (dipakai juga oleh dashboard & sisa DP).
  // Booking dari /info hanya mengisi Harga_Total_Net (bukan Harga_Kamar/periode),
  // jadi bila rincian per-unit tidak cocok dgn total resmi → pakai total resmi
  // sebagai SATU baris supaya invoice ⇄ data booking SELALU sinkron.
  const officialTotal = Number(b.Harga_Total_Net || 0);
  const computed = qty * price + extra - diskon;
  const roomDesc = `Sewa ${b.Nama_Kamar || (isKost ? 'Kost Putri' : 'Kamar')}`;
  const roomNote = [b.Paket, b.Gedung].filter(Boolean).join(' · ');

  let items: LineItem[];
  if (officialTotal > 0 && (price <= 0 || Math.abs(computed - officialTotal) > 1)) {
    // Per-unit tidak lengkap/tidak cocok → satu baris memakai total resmi.
    items = [{ desc: roomDesc, note: roomNote, qty: 1, price: officialTotal }];
  } else {
    items = [{ desc: roomDesc, note: roomNote, qty, price }];
    if (extra > 0) items.push({ desc: 'Biaya tambahan', note: 'Extra charge', qty: 1, price: extra });
    if (diskon > 0) items.push({ desc: 'Diskon', note: 'Potongan harga', qty: 1, price: -diskon });
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

  const period =
    b.CheckIn && b.CheckOut
      ? `${tglShort(b.CheckIn)} – ${tglShort(b.CheckOut)}`
      : b.Paket || '';

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
