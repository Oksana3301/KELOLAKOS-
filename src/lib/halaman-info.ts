// Shared content model for the public /info landing (Top Hills) + its editor
// (Pengaturan → Halaman Info). The page renders DEFAULT_INFO merged with the
// owner's saved values, so it always works even before the backend is wired.

export interface PenginapanTipe {
  nama: string;
  sub: string;
  malam: string;
  bulan: string;
  tahun: string;
}

export interface HalamanInfo {
  // Dasar
  nama: string;
  tagline: string; // big hero line (boleh pakai baris baru)
  deskripsi: string; // hero subtext
  alamat: string;
  maps: string;
  // WhatsApp
  waResmi: string; // booking & bukti bayar
  waMezi: string; // survey / penjaga
  waPesan: string; // pesan pembuka WA
  // Kost
  kostTeaser: string; // angka besar, mis. "1,3 jutaan"
  kostTeaserUnit: string; // mis. "per bulan*"
  // Penginapan (harga bisa diubah)
  penginapan: PenginapanTipe[];
  // Media (URL — foto/video diupload ke Drive lalu URL-nya disimpan)
  fotoHero: string;
  galeri: string[]; // hingga 8
  videoUrl: string;
}

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
    { nama: 'Executive', sub: 'Paling besar · kasur queen size', malam: 'Rp 300.000', bulan: 'Rp 4.000.000', tahun: 'Rp 40.000.000' },
    { nama: 'Superior', sub: 'Menengah · twin bunk (ranjang susun)', malam: 'Rp 250.000', bulan: 'Rp 3.000.000', tahun: 'Rp 30.000.000' },
    { nama: 'Deluxe', sub: 'Kecil · twin bunk (ranjang susun)', malam: 'Rp 200.000', bulan: 'Rp 2.500.000', tahun: 'Rp 25.000.000' },
  ],
  fotoHero: '',
  galeri: [],
  videoUrl: '',
};

/** Merge saved (partial) values over the defaults so missing fields never break. */
export function mergeInfo(saved: Partial<HalamanInfo> | null | undefined): HalamanInfo {
  if (!saved || typeof saved !== 'object') return DEFAULT_INFO;
  const peng =
    Array.isArray(saved.penginapan) && saved.penginapan.length === 3
      ? saved.penginapan.map((p, i) => ({ ...DEFAULT_INFO.penginapan[i], ...p }))
      : DEFAULT_INFO.penginapan;
  return {
    ...DEFAULT_INFO,
    ...saved,
    penginapan: peng,
    galeri: Array.isArray(saved.galeri) ? saved.galeri.filter(Boolean) : DEFAULT_INFO.galeri,
  };
}
