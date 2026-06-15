// ===== KelolaKos · Data contoh (mock) =====
// Semua angka & nama hanya contoh untuk prototipe.

const RUPIAH = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const RUPIAH_SHORT = (n) => {
  const a = Math.abs(n || 0);
  if (a >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace('.0','') + ' M';
  if (a >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.0','') + ' jt';
  if (a >= 1e3) return 'Rp ' + Math.round(n / 1e3) + ' rb';
  return 'Rp ' + (n || 0);
};
const TANGGAL = (d) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};
const TANGGAL_SHORT = (d) => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

// ----- Kamar -----
// status: 'terisi' | 'tersedia' | 'perhatian'
const ROOMS = [
  { id: 'A1', nama: 'Kamar A1', gedung: 'Gedung Mawar', lantai: 1, status: 'terisi',   penyewa: 'Pak Budi Santoso',  harga: 850000, bayar: 'Lunas' },
  { id: 'A2', nama: 'Kamar A2', gedung: 'Gedung Mawar', lantai: 1, status: 'terisi',   penyewa: 'Bu Siti Aminah',    harga: 850000, bayar: 'DP' },
  { id: 'A3', nama: 'Kamar A3', gedung: 'Gedung Mawar', lantai: 1, status: 'tersedia', penyewa: null,                harga: 850000, bayar: null },
  { id: 'A4', nama: 'Kamar A4', gedung: 'Gedung Mawar', lantai: 1, status: 'perhatian',penyewa: 'Mas Andi Pratama',  harga: 850000, bayar: 'Belum Bayar' },
  { id: 'A5', nama: 'Kamar A5', gedung: 'Gedung Mawar', lantai: 2, status: 'terisi',   penyewa: 'Bu Dewi Lestari',   harga: 950000, bayar: 'Lunas' },
  { id: 'A6', nama: 'Kamar A6', gedung: 'Gedung Mawar', lantai: 2, status: 'tersedia', penyewa: null,                harga: 950000, bayar: null },
  { id: 'B1', nama: 'Kamar B1', gedung: 'Gedung Melati', lantai: 1, status: 'terisi',  penyewa: 'Pak Joko Susilo',   harga: 1100000, bayar: 'Lunas' },
  { id: 'B2', nama: 'Kamar B2', gedung: 'Gedung Melati', lantai: 1, status: 'terisi',  penyewa: 'Mbak Rina Wati',    harga: 1100000, bayar: 'DP' },
  { id: 'B3', nama: 'Kamar B3', gedung: 'Gedung Melati', lantai: 1, status: 'tersedia',penyewa: null,                harga: 1100000, bayar: null },
  { id: 'B4', nama: 'Kamar B4', gedung: 'Gedung Melati', lantai: 2, status: 'terisi',  penyewa: 'Pak Hendra Gunawan',harga: 1250000, bayar: 'Lunas' },
  { id: 'B5', nama: 'Kamar B5', gedung: 'Gedung Melati', lantai: 2, status: 'perhatian',penyewa:'Bu Maya Sari',      harga: 1250000, bayar: 'Belum Bayar' },
  { id: 'B6', nama: 'Kamar B6', gedung: 'Gedung Melati', lantai: 2, status: 'tersedia',penyewa: null,               harga: 1250000, bayar: null },
];

// ----- Booking / Penyewa -----
const BOOKINGS = [
  { id: 'BK001', nama: 'Pak Budi Santoso', kamar: 'Kamar A1', gedung: 'Gedung Mawar', paket: 'Bulanan', masuk: '2026-06-01', keluar: '2026-07-01', total: 850000, dibayar: 850000, status: 'Lunas' },
  { id: 'BK002', nama: 'Bu Siti Aminah',   kamar: 'Kamar A2', gedung: 'Gedung Mawar', paket: 'Bulanan', masuk: '2026-06-05', keluar: '2026-07-05', total: 850000, dibayar: 400000, status: 'DP' },
  { id: 'BK003', nama: 'Mas Andi Pratama', kamar: 'Kamar A4', gedung: 'Gedung Mawar', paket: 'Bulanan', masuk: '2026-05-20', keluar: '2026-06-20', total: 850000, dibayar: 0,      status: 'Belum Bayar' },
  { id: 'BK004', nama: 'Bu Dewi Lestari',  kamar: 'Kamar A5', gedung: 'Gedung Mawar', paket: 'Bulanan', masuk: '2026-06-10', keluar: '2026-07-10', total: 950000, dibayar: 950000, status: 'Lunas' },
  { id: 'BK005', nama: 'Pak Joko Susilo',  kamar: 'Kamar B1', gedung: 'Gedung Melati', paket: 'Bulanan', masuk: '2026-06-02', keluar: '2026-07-02', total: 1100000, dibayar: 1100000, status: 'Lunas' },
  { id: 'BK006', nama: 'Mbak Rina Wati',   kamar: 'Kamar B2', gedung: 'Gedung Melati', paket: 'Bulanan', masuk: '2026-06-08', keluar: '2026-07-08', total: 1100000, dibayar: 600000, status: 'DP' },
  { id: 'BK007', nama: 'Bu Maya Sari',     kamar: 'Kamar B5', gedung: 'Gedung Melati', paket: 'Bulanan', masuk: '2026-05-18', keluar: '2026-06-18', total: 1250000, dibayar: 0,      status: 'Belum Bayar' },
  { id: 'BK008', nama: 'Pak Hendra Gunawan',kamar:'Kamar B4', gedung: 'Gedung Melati', paket: 'Bulanan', masuk: '2026-06-12', keluar: '2026-07-12', total: 1250000, dibayar: 1250000, status: 'Lunas' },
  { id: 'BK009', nama: 'Mas Rio Firmansyah',kamar:'Kamar A6', gedung: 'Gedung Mawar', paket: 'Bulanan', masuk: '2026-05-10', keluar: '2026-06-10', total: 950000, dibayar: 300000, status: 'Batal' },
];

// nomor HP contoh (untuk kwitansi & pengingat)
BOOKINGS.forEach((b, i) => { b.hp = b.hp || ['0812 3456 7890','0813 5566 7788','0857 1122 3344','0821 9988 7766','0811 2233 4455','0852 6677 8899','0838 4455 6677','0815 7788 9900','0819 3344 5566'][i] || '0812 0000 0000'; b.lama = b.lama || 1; });

// ----- Keuangan (transaksi) -----
const TRANSAKSI = [
  { id: 'T01', jenis: 'masuk',  kategori: 'Pembayaran Sewa', nama: 'Pak Budi Santoso', jumlah: 850000, tanggal: '2026-06-01' },
  { id: 'T02', jenis: 'masuk',  kategori: 'DP Sewa',         nama: 'Bu Siti Aminah',   jumlah: 400000, tanggal: '2026-06-05' },
  { id: 'T03', jenis: 'keluar', kategori: 'Listrik & Air',   nama: 'PLN + PDAM',       jumlah: 1200000, tanggal: '2026-06-03' },
  { id: 'T04', jenis: 'masuk',  kategori: 'Pembayaran Sewa', nama: 'Bu Dewi Lestari',  jumlah: 950000, tanggal: '2026-06-10' },
  { id: 'T05', jenis: 'keluar', kategori: 'Gaji Penjaga',    nama: 'Mas Agus',         jumlah: 1500000, tanggal: '2026-06-01' },
  { id: 'T06', jenis: 'masuk',  kategori: 'Pembayaran Sewa', nama: 'Pak Joko Susilo',  jumlah: 1100000, tanggal: '2026-06-02' },
  { id: 'T07', jenis: 'keluar', kategori: 'Perbaikan',       nama: 'Servis pompa air', jumlah: 350000, tanggal: '2026-06-07' },
  { id: 'T08', jenis: 'masuk',  kategori: 'DP Sewa',         nama: 'Mbak Rina Wati',   jumlah: 600000, tanggal: '2026-06-08' },
];

// ----- Ringkasan dashboard -----
function hitungRingkasan() {
  const masuk = TRANSAKSI.filter(t => t.jenis === 'masuk').reduce((s, t) => s + t.jumlah, 0);
  const keluar = TRANSAKSI.filter(t => t.jenis === 'keluar').reduce((s, t) => s + t.jumlah, 0);
  const terisi = ROOMS.filter(r => r.status !== 'tersedia').length;
  const tersedia = ROOMS.filter(r => r.status === 'tersedia').length;
  const belumBayar = BOOKINGS.filter(b => b.status === 'Belum Bayar').length;
  const dp = BOOKINGS.filter(b => b.status === 'DP').length;
  const sisaTagihan = BOOKINGS.reduce((s, b) => s + (b.total - b.dibayar), 0);
  return { masuk, keluar, net: masuk - keluar, terisi, tersedia, totalKamar: ROOMS.length, belumBayar, dp, sisaTagihan };
}

// status pembayaran -> gaya badge
const BAYAR_STYLE = {
  'Lunas':       { bg: 'var(--green)',  fg: '#fff',        dot: '#fff' },
  'Belum Bayar': { bg: 'var(--orange)', fg: '#fff',        dot: '#fff' },
  'DP':          { bg: 'var(--yellow)', fg: 'var(--navy)', dot: 'var(--navy)' },
  'Batal':       { bg: 'var(--mauve)',  fg: 'var(--navy)', dot: 'var(--ink-soft)' },
};
const ROOM_STATUS = {
  'terisi':    { label: 'Terisi',          bg: 'var(--mint-soft)',  border: 'var(--mint)',  dot: 'var(--green)' },
  'tersedia':  { label: 'Tersedia',        bg: '#fff',              border: 'var(--mauve)', dot: 'var(--mauve)' },
  'perhatian': { label: 'Perlu Perhatian', bg: '#FBEFE9',           border: '#E7BCAD',      dot: 'var(--orange)' },
};

// ----- Ringkasan per periode (untuk filter waktu di Beranda) -----
const PERIODE = {
  hari:   { id:'hari',   label:'Hari Ini',   masuk:850000,    keluar:0,        sisa:23800000 },
  minggu: { id:'minggu', label:'Minggu Ini', masuk:3900000,   keluar:1550000,  sisa:23800000 },
  bulan:  { id:'bulan',  label:'Bulan Ini',  masuk:12400000,  keluar:4550000,  sisa:23800000 },
  tahun:  { id:'tahun',  label:'Tahun Ini',  masuk:142000000, keluar:58000000, sisa:23800000 },
};

Object.assign(window, {
  RUPIAH, RUPIAH_SHORT, TANGGAL, TANGGAL_SHORT,
  ROOMS, BOOKINGS, TRANSAKSI, hitungRingkasan, BAYAR_STYLE, ROOM_STATUS, PERIODE,
});
