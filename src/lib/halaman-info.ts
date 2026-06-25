// Shared content model for the public /info landing (Top Hills) + its editor
// (Pengaturan → Halaman Info). The page renders DEFAULT_INFO merged with the
// owner's saved values, so it always works even before the backend is wired.

export interface PenginapanTipe {
  nama: string;
  sub: string;
  malam: string;
  bulan: string;
  tahun: string;
  foto: string[]; // maks 10 per tipe kamar
  extraPerOrang?: number; // +Rp per orang per malam di atas base
}

export interface HalamanInfo {
  // Dasar
  nama: string;
  tagline: string;
  deskripsi: string;
  alamat: string;
  maps: string;
  // WhatsApp
  waResmi: string;
  waMezi: string;
  waPesan: string;
  // Kost
  kostTeaser: string;
  kostTeaserUnit: string;
  // Penginapan
  penginapan: PenginapanTipe[];
  // Media
  fotoHero: string;
  fotoKost: string[]; // maks 10
  fotoArea: string[]; // maks 10 (galeri umum: gedung, rooftop, dll)
  videos: string[]; // maks 6 (URL YouTube/Drive/mp4)
  videoPenipuan: string; // URL video peringatan penipuan (opsional)
  // Kapasitas & biaya orang tambahan
  kostMaxOrang: number;        // kost 6bln/1thn (mis. 2)
  kostExtraPerOrang: number;   // +Rp per orang di atas 1 (kost 6bln/1thn)
  penginapanBaseOrang: number; // jumlah orang yang sudah termasuk harga base
  penginapanMaxOrang: number;  // mis. 3
  // Harga paket kost (flat, bukan per bulan)
  kostHarga6Bulan: number;
  kostHargaSetahun: number;
  kostHarga6BulanLt4: number;   // lantai 4 (Gedung A 61A–80A)
  kostHargaSetahunLt4: number;
  // Minimum DP (editable)
  kostDpMin: number;
  penginapanDpMin: number;
  // Pembayaran
  caraBayar: string;
  rekeningKost: BankInfo;
  rekeningPenginapan: BankInfo;
  qrKost: string;        // URL gambar QR
  qrPenginapan: string;  // URL gambar QR
}

export interface BankInfo {
  bank: string;
  nomor: string;
  atasNama: string;
}

export const MAX_FOTO = 10;
export const MAX_VIDEO = 6;

export const DEFAULT_INFO: HalamanInfo = {
  nama: 'Top Hills Kost Putri',
  tagline: 'Kost Putri & Penginapan\nyang nyaman, aman, dekat UNAND',
  deskripsi:
    'Limau Manis, Pauh — Padang. Harian, mingguan, bulanan & tahunan. Lengkap dengan AC, kamar mandi dalam, WiFi unlimited, security & CCTV. 🌸',
  alamat: 'Limau Manis, Pauh, Kota Padang, Sumatera Barat 25176',
  maps: 'https://maps.app.goo.gl/6sJz6tiH9Px1b1AGA',
  waResmi: '08116646615',
  waMezi: '083841614871',
  waPesan: 'Halo Top Hills 🌸, saya lihat dari halaman info. Saya mau tanya / booking kamar ...',
  kostTeaser: '1,3 jutaan',
  kostTeaserUnit: 'per bulan*',
  penginapan: [
    { nama: 'Executive', sub: 'Ukuran paling luas · kasur queen size', malam: 'Rp 350.000', bulan: 'Rp 4.000.000', tahun: 'Rp 40.000.000', foto: [], extraPerOrang: 50000 },
    { nama: 'Superior', sub: 'Ukuran menengah · 1 kasur + kasur sorong di bawah', malam: 'Rp 250.000', bulan: 'Rp 3.000.000', tahun: 'Rp 30.000.000', foto: [], extraPerOrang: 60000 },
    { nama: 'Deluxe', sub: 'Ukuran cozy · 1 kasur + kasur sorong di bawah', malam: 'Rp 200.000', bulan: 'Rp 2.500.000', tahun: 'Rp 25.000.000', foto: [], extraPerOrang: 75000 },
  ],
  fotoHero: '',
  fotoKost: [],
  fotoArea: [],
  videos: [],
  videoPenipuan: '',
  kostMaxOrang: 2,
  kostExtraPerOrang: 2000000,
  penginapanBaseOrang: 1,
  penginapanMaxOrang: 3,
  kostHarga6Bulan: 8000000,
  kostHargaSetahun: 15000000,
  kostHarga6BulanLt4: 8000000,
  kostHargaSetahunLt4: 14000000,
  kostDpMin: 4000000,
  penginapanDpMin: 100000,
  caraBayar:
    'Transfer ke rekening atau scan QRIS di atas sesuai nominal. Setelah bayar, upload bukti di bawah. Booking aktif setelah admin verifikasi (maks 1×24 jam). 🌸',
  rekeningKost: { bank: 'BCA', nomor: '-', atasNama: 'Top Hills' },
  rekeningPenginapan: { bank: 'BCA', nomor: '-', atasNama: 'Top Hills' },
  qrKost: '',
  qrPenginapan: '',
};

const arr = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? (v as unknown[]).map(String).filter(Boolean).slice(0, max) : [];

/** Extract a Google Drive file id from any common Drive URL form. */
export function driveFileId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?&]id=([\w-]+)/) || url.match(/\/file\/d\/([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  return m ? m[1] : null;
}

/** Drive share/uc URLs are flaky in <img>. Convert to the reliable thumbnail URL. */
export function driveImageUrl(url: string): string {
  if (!url) return url;
  const id = url.includes('drive.google.com') ? driveFileId(url) : null;
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : url;
}

/** Embeddable preview URL for a Drive video, or null if not a Drive link. */
export function drivePreviewUrl(url: string): string | null {
  const id = url && url.includes('drive.google.com') ? driveFileId(url) : null;
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** Merge saved (partial) values over the defaults so missing fields never break. */
export function mergeInfo(saved: Partial<HalamanInfo> & { galeri?: unknown; videoUrl?: unknown } | null | undefined): HalamanInfo {
  if (!saved || typeof saved !== 'object') return DEFAULT_INFO;
  const peng =
    Array.isArray(saved.penginapan) && saved.penginapan.length === 3
      ? saved.penginapan.map((p, i) => ({ ...DEFAULT_INFO.penginapan[i], ...p, foto: arr((p as PenginapanTipe).foto, MAX_FOTO) }))
      : DEFAULT_INFO.penginapan;
  return {
    ...DEFAULT_INFO,
    ...saved,
    penginapan: peng,
    fotoHero: typeof saved.fotoHero === 'string' ? saved.fotoHero : '',
    fotoKost: arr(saved.fotoKost, MAX_FOTO),
    // migrasi dari versi lama: galeri -> fotoArea, videoUrl -> videos[0]
    fotoArea: arr(saved.fotoArea ?? saved.galeri, MAX_FOTO),
    videos: arr(saved.videos ?? (saved.videoUrl ? [saved.videoUrl] : []), MAX_VIDEO),
  };
}
