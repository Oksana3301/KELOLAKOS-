'use client';

// Top Hills Kost Putri — public landing page (/info).
// Elegant "brochure" theme (cream + gold, serif), mobile-first. Renders OUTSIDE
// the KelolaKos access gate. Content comes from the saved Halaman Info (editable
// in Pengaturan), falling back to DEFAULT_INFO so it always works.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { halamanInfoApi } from '@/lib/api-v2';
import { DEFAULT_INFO, mergeInfo } from '@/lib/halaman-info';

// ───────────────────────── theme ─────────────────────────
const C = {
  cream: '#F4ECDD',
  creamDeep: '#EEE3CE',
  card: '#FCF8F0',
  gold: '#A9802F',
  goldSoft: '#C2A062',
  border: '#E0CFA8',
  brown: '#463720',
  brownSoft: '#7A6A4F',
};
const serif = "'Cinzel', serif";
const elegant = "'Cormorant Garamond', serif";
const body = "'Inter', system-ui, sans-serif";

const MSG_SURVEY = 'Halo Bang Mezi 🙏, saya mau janji survey lihat kamar Top Hills. Kapan boleh datang ya?';

function norm62(raw: string): string {
  let p = String(raw || '').replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}
function wa(phone: string, text: string): string {
  return `https://wa.me/${norm62(phone)}?text=${encodeURIComponent(text)}`;
}
function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

const FASILITAS = [
  { i: '🛏️', t: 'Kasur & lemari' },
  { i: '📚', t: 'Meja & kursi belajar' },
  { i: '🚿', t: 'Kamar mandi dalam' },
  { i: '❄️', t: 'AC (penginapan & opsi kost)' },
  { i: '📶', t: 'WiFi unlimited' },
  { i: '💡', t: 'Listrik token' },
  { i: '💧', t: 'Air sudah termasuk' },
  { i: '🌄', t: 'Gazebo & balkon view' },
  { i: '🧺', t: 'Laundry' },
  { i: '🏪', t: 'Minimarket' },
  { i: '🛵', t: 'Cuci motor' },
  { i: '🔒', t: 'Security & CCTV 24 jam' },
];

// Fasilitas yang ditampilkan sebagai chip di tiap section (ala Traveloka).
const KOST_FAS = [
  '🚿 KM dalam',
  '🛏️ Kasur',
  '🗄️ Lemari',
  '📚 Meja & kursi belajar',
  '❄️ AC / non-AC',
  '📶 WiFi unlimited',
  '💧 Air termasuk',
  '🌄 Balkon view',
  '🧺 Laundry',
  '🏪 Minimarket',
  '🔒 Security & CCTV',
];
const PENGINAPAN_FAS = [
  '❄️ AC',
  '🚿 KM dalam',
  '🚽 WC duduk',
  '♨️ Water heater',
  '💧 Air mineral gratis',
  '📶 WiFi unlimited',
  '🧹 Pembersihan kamar',
  '🔒 Security & CCTV',
];

const FAQ = [
  { q: 'Lokasinya di mana? Dekat UNAND tidak?', a: 'Di Limau Manis, Pauh, Padang — sangat dekat UNAND, ada akses jalan langsung ke gerbang kampus.' },
  { q: 'Harga kost berapa setahun?', a: 'Lantai 1–3: Rp15jt (non-AC) / Rp19jt (AC). Lantai 4: Rp14jt (non-AC) / Rp18jt (AC). Tersedia juga paket 6 bulan. Detail lengkap silakan tanya via WhatsApp.' },
  { q: 'Bisa sewa kost bulanan saja?', a: 'Minimal sewa kost adalah 6 bulan. Tersedia paket 6 bulan dan setahun.' },
  { q: 'Ada AC tidak?', a: 'Untuk kost ada pilihan AC dan non-AC (harga berbeda). Untuk penginapan, semua kamar sudah ber-AC.' },
  { q: 'Kamar mandi di dalam atau di luar?', a: 'Kamar mandi di dalam kamar (KM dalam), baik kost maupun penginapan.' },
  { q: 'Aman tidak untuk anak perempuan? Ada CCTV?', a: 'Ada security dan CCTV, gerbang ditutup pukul 22.00 WIB, dan tamu laki-laki hanya boleh di area luar/ruang tamu.' },
  { q: 'Boleh survey/lihat kamar dulu?', a: 'Boleh. Sebaiknya janjian dulu dengan penjaga (Bang Mezi). Jam survey 08.00–19.00 WIB.' },
  { q: 'DP bisa kembali kalau batal?', a: 'DP berfungsi mengamankan kamar. Apabila batal, DP tidak dapat dikembalikan (hangus).' },
  { q: 'Penginapan termasuk sarapan?', a: 'Belum termasuk sarapan, tetapi bisa dibantu pesankan bila diminta. Pembersihan kamar sudah termasuk.' },
];

// ───────────────────────── small UI pieces ─────────────────────────
function TopHillsMark({ size = 64, color = C.gold }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <g stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 22 L32 12 L42 22" />
        <rect x="22" y="22" width="20" height="26" />
        <rect x="26.5" y="27" width="4" height="4" />
        <rect x="33.5" y="27" width="4" height="4" />
        <rect x="26.5" y="34" width="4" height="4" />
        <rect x="33.5" y="34" width="4" height="4" />
        <path d="M29 48 L29 42 Q32 40 35 42 L35 48" />
        <path d="M10 48 Q20 44 32 48 Q44 52 54 48" />
        <path d="M14 52 Q24 49 32 52" opacity="0.7" />
      </g>
    </svg>
  );
}

function Brand({ stacked = true }: { stacked?: boolean }) {
  if (!stacked) {
    return (
      <span className="flex items-center gap-2.5">
        <TopHillsMark size={34} />
        <span style={{ fontFamily: serif, color: C.gold }} className="text-[18px] font-semibold tracking-[0.18em]">
          TOP HILLS
        </span>
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <TopHillsMark size={72} />
      <div style={{ fontFamily: serif, color: C.gold }} className="mt-3 text-[30px] sm:text-[38px] font-bold tracking-[0.16em] leading-none">
        TOP HILLS
      </div>
      <div style={{ color: C.goldSoft }} className="mt-1.5 text-[13px] font-semibold tracking-[0.42em]">
        KOST
      </div>
    </div>
  );
}

function SectionHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="text-center mb-7">
      <div className="mx-auto mb-3 w-10 h-10 rounded-full grid place-items-center text-[16px] font-bold" style={{ border: `1.5px solid ${C.gold}`, color: C.gold, fontFamily: serif }}>
        {n}
      </div>
      <h2 style={{ fontFamily: serif, color: C.brown }} className="text-[24px] sm:text-[30px] font-bold tracking-wide m-0">
        {title}
      </h2>
      <span className="block mx-auto mt-3 h-px w-16" style={{ background: C.goldSoft }} />
      {sub && (
        <p style={{ fontFamily: elegant, color: C.brownSoft }} className="mt-3 text-[19px] leading-snug max-w-[42ch] mx-auto">
          {sub}
        </p>
      )}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={'rounded-[20px] p-5 ' + className} style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 6px 22px rgba(112,86,32,0.06)' }}>
      {children}
    </div>
  );
}

function WAButton({ href, children, variant = 'gold', block = true }: { href: string; children: React.ReactNode; variant?: 'gold' | 'green' | 'ghost'; block?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[16px] font-semibold no-underline transition-transform active:scale-[0.98] ' + (block ? 'w-full ' : '');
  const styles =
    variant === 'green'
      ? { background: '#1F7A4D', color: '#fff' }
      : variant === 'ghost'
        ? { background: 'transparent', color: C.brown, border: `1.5px solid ${C.gold}` }
        : { background: C.gold, color: '#fff', boxShadow: '0 8px 22px rgba(169,128,47,0.32)' };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={base} style={{ fontFamily: body, ...styles }}>
      {children}
    </a>
  );
}

function WAIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.042zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start justify-between gap-3 py-4 text-left" style={{ fontFamily: body }}>
        <span className="text-[16px] font-semibold" style={{ color: C.brown }}>
          {q}
        </span>
        <span className="flex-shrink-0 text-[20px] leading-none mt-0.5" style={{ color: C.gold }}>
          {open ? '–' : '+'}
        </span>
      </button>
      {open && (
        <p className="pb-4 -mt-1 text-[15px] leading-relaxed" style={{ fontFamily: body, color: C.brownSoft }}>
          {a}
        </p>
      )}
    </div>
  );
}

// Traveloka-style amenity chips.
function FasChips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {items.map((t) => (
        <span
          key={t}
          className="text-[12.5px] rounded-full px-2.5 py-1 whitespace-nowrap"
          style={{ background: C.cream, border: `1px solid ${C.border}`, color: C.brown }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// Video player: YouTube link → iframe, else a plain <video>.
function VideoEmbed({ url }: { url: string }) {
  const yt = ytEmbed(url);
  if (yt) {
    return (
      <iframe
        src={yt}
        title="Video Top Hills"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full aspect-[16/9] rounded-[16px]"
        style={{ border: `1px solid ${C.border}` }}
      />
    );
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video src={url} controls className="w-full aspect-[16/9] rounded-[16px]" style={{ border: `1px solid ${C.border}`, background: '#000' }} />
  );
}

// Image slot: shows the uploaded photo (URL) or an elegant placeholder.
function Img({ src, label, ratio = 'aspect-[4/3]' }: { src?: string; label: string; ratio?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className={'rounded-[16px] object-cover w-full ' + ratio} style={{ border: `1px solid ${C.border}` }} />
    );
  }
  return (
    <div className={'rounded-[16px] grid place-items-center text-center ' + ratio} style={{ background: C.creamDeep, border: `1px dashed ${C.goldSoft}` }}>
      <div style={{ fontFamily: body, color: C.brownSoft }} className="px-3">
        <div className="text-[22px] mb-1">🖼️</div>
        <div className="text-[12px] leading-tight">{label}</div>
      </div>
    </div>
  );
}

// ───────────────────────── page ─────────────────────────
export default function InfoPage() {
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  // Saved content (public read). On any error → defaults, so the page never breaks.
  const { data } = useQuery({
    queryKey: ['halaman-info'],
    queryFn: halamanInfoApi.get,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });
  const info = mergeInfo(data || DEFAULT_INFO);

  const NAV = [
    { id: 'kost', label: 'Kost' },
    { id: 'penginapan', label: 'Penginapan' },
    { id: 'fasilitas', label: 'Fasilitas' },
    { id: 'lokasi', label: 'Lokasi' },
    { id: 'booking', label: 'Booking' },
  ];

  return (
    <div style={{ background: C.cream, fontFamily: body, color: C.brown }} className="min-h-screen">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 backdrop-blur" style={{ background: 'rgba(244,236,221,0.92)', borderBottom: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-[900px] px-4 h-14 flex items-center justify-between gap-3">
          <Brand stacked={false} />
          <nav className="hidden sm:flex items-center gap-5 text-[14px] font-semibold" style={{ color: C.brownSoft }}>
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="no-underline hover:opacity-70" style={{ color: C.brown }}>
                {n.label}
              </a>
            ))}
          </nav>
          <a href={wa(info.waResmi, info.waPesan)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold no-underline" style={{ background: C.gold, color: '#fff' }}>
            <WAIcon size={16} /> WhatsApp
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-4">
        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <Brand />
          <h1 style={{ fontFamily: elegant, color: C.brown }} className="mt-6 text-[30px] sm:text-[40px] font-semibold leading-tight whitespace-pre-line">
            {info.tagline}
          </h1>
          <p style={{ fontFamily: body, color: C.brownSoft }} className="mt-4 text-[15px] max-w-[44ch] mx-auto leading-relaxed">
            {info.deskripsi}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-center max-w-[420px] sm:max-w-none mx-auto">
            <WAButton href={wa(info.waResmi, info.waPesan)} block={false}>
              <WAIcon /> Booking / Tanya via WhatsApp
            </WAButton>
            <a href="#kost" className="inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[16px] font-semibold no-underline" style={{ fontFamily: body, background: 'transparent', color: C.brown, border: `1.5px solid ${C.gold}` }}>
              Lihat Kamar
            </a>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              ['🎓', 'Dekat UNAND'],
              ['🌸', 'Kost Putri'],
              ['🔒', 'Security & CCTV'],
              ['📶', 'WiFi Unlimited'],
            ].map(([i, t]) => (
              <div key={t} className="rounded-[14px] py-3 px-2 text-[13px] font-semibold" style={{ background: C.card, border: `1px solid ${C.border}`, color: C.brown }}>
                <div className="text-[20px] mb-1">{i}</div>
                {t}
              </div>
            ))}
          </div>

          <div className="mt-6">
            <Img src={info.fotoHero} label="Foto depan / area gedung (atur di Pengaturan → Halaman Info)" ratio="aspect-[16/9]" />
          </div>
        </section>

        {/* Tentang */}
        <section className="py-8">
          <SectionHead n="1" title="Tentang Top Hills" sub="Kost putri sekaligus penginapan di Padang — cocok untuk mahasiswi, orang tua yang mengantar anak, atau tamu yang butuh menginap sementara." />
          <Card>
            <p className="text-[15px] leading-relaxed" style={{ color: C.brownSoft }}>
              Area terdiri dari beberapa gedung: <b style={{ color: C.brown }}>Gedung A & B</b> untuk{' '}
              <b style={{ color: C.brown }}>kost — khusus putri</b> (jangka panjang), dan <b style={{ color: C.brown }}>Gedung C</b> untuk{' '}
              <b style={{ color: C.brown }}>penginapan — terbuka untuk umum</b> (putra & putri, harian/mingguan/bulanan/tahunan). Semua dalam satu lokasi yang asri & dekat kampus.
            </p>
          </Card>
        </section>

        {/* Kost */}
        <section id="kost" className="py-8 scroll-mt-20">
          <SectionHead n="2" title="Kost Putri — Gedung A & B" sub="Sewa jangka panjang, khusus putri." />
          <Card>
            <div className="text-center pb-5 mb-5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="text-[14px]" style={{ color: C.brownSoft }}>
                Mulai dari
              </div>
              <div style={{ fontFamily: serif, color: C.gold }} className="text-[34px] font-bold leading-none my-1">
                {info.kostTeaser}
              </div>
              <div className="text-[14px]" style={{ color: C.brownSoft }}>
                {info.kostTeaserUnit}
              </div>
              <div className="inline-flex items-center gap-2 mt-4 rounded-full px-4 py-2 text-[14px] font-semibold" style={{ background: '#FBF3E0', color: C.brown, border: `1px solid ${C.border}` }}>
                🔒 Amankan kamarmu — Booking DP sekarang!
              </div>
            </div>
            <ul className="space-y-2 text-[15px]" style={{ color: C.brownSoft }}>
              {[
                'Sudah termasuk: kamar mandi dalam, kasur, lemari, meja & kursi belajar.',
                'Air sudah termasuk · listrik token diisi sendiri.',
                'Pilihan AC & non-AC (harga lengkap via WhatsApp).',
                'Minimal sewa 6 bulan · tersedia paket 6 bulan & setahun.',
                'DP: mulai Rp 2 juta (6 bulan) / Rp 4 juta (setahun) untuk mengamankan kamar.',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span style={{ color: C.gold }}>✦</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] mt-4 italic" style={{ fontFamily: elegant, color: C.brownSoft }}>
              *Estimasi per bulan dari paket tahunan. Harga pasti (AC/non-AC, lantai, 2 orang) dijelaskan admin via WhatsApp.
            </p>
            <div className="text-[13px] font-semibold mt-5 mb-1" style={{ color: C.brown }}>
              Fasilitas Kost
            </div>
            <FasChips items={KOST_FAS} />
            <div className="grid grid-cols-2 gap-3 mt-5">
              {(info.fotoKost.length > 0 ? info.fotoKost : ['Kamar kost', 'Koridor gedung']).map((g, i) => (
                <Img key={i} src={info.fotoKost.length > 0 ? g : undefined} label={info.fotoKost.length === 0 ? g : 'Foto kost'} />
              ))}
            </div>
            <div className="mt-5">
              <WAButton href={wa(info.waResmi, 'Halo Top Hills 🌸, saya mau tanya kost putri (Gedung A/B).')}>
                <WAIcon /> Tanya Kost via WhatsApp
              </WAButton>
            </div>
          </Card>
        </section>

        {/* Penginapan */}
        <section id="penginapan" className="py-8 scroll-mt-20">
          <SectionHead n="3" title="Penginapan — Gedung C" sub="Harian, mingguan, bulanan & tahunan. Terbuka untuk umum (putra & putri). Semua kamar ber-AC, kamar mandi dalam (WC duduk + water heater), kasur lengkap, & gratis air mineral di kamar. 💧" />
          <div className="space-y-4">
            {info.penginapan.map((p) => (
              <Card key={p.nama} className="!p-0 overflow-hidden">
                {/* Foto kamar di atas (ala listing Traveloka) */}
                <Img src={p.foto[0]} label={`Kamar ${p.nama}`} ratio="aspect-[16/9] !rounded-none" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 style={{ fontFamily: serif, color: C.brown }} className="text-[20px] font-bold m-0">
                        {p.nama}
                      </h3>
                      <div className="text-[13px] mt-0.5" style={{ color: C.brownSoft }}>
                        {p.sub}
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold rounded-full px-3 py-1 flex-shrink-0" style={{ background: '#EAF5EE', color: '#1F7A4D' }}>
                      Maks 3 org
                    </span>
                  </div>

                  {/* Thumbnail foto lain untuk kamar ini */}
                  {p.foto.length > 1 && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {p.foto.slice(1).map((f, i) => (
                        <Img key={i} src={f} label="Foto" ratio="aspect-square" />
                      ))}
                    </div>
                  )}

                  {/* Fasilitas kamar ini */}
                  <FasChips items={PENGINAPAN_FAS} />

                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    {[
                      ['Per malam', p.malam],
                      ['Per bulan', p.bulan],
                      ['Per tahun', p.tahun],
                    ].map(([l, v]) => (
                      <div key={l} className="rounded-[12px] py-2.5" style={{ background: C.cream, border: `1px solid ${C.border}` }}>
                        <div className="text-[11px]" style={{ color: C.brownSoft }}>
                          {l}
                        </div>
                        <div style={{ fontFamily: serif, color: C.gold }} className="text-[15px] font-bold mt-0.5">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <WAButton
                      href={wa(info.waResmi, `Halo Top Hills 🌸, saya mau booking kamar ${p.nama} (penginapan). Mohon info ketersediaannya ya 🙏`)}
                      variant="green"
                    >
                      <WAIcon /> Booking {p.nama} via WhatsApp
                    </WAButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-center text-[14px] mt-4" style={{ color: C.brownSoft }}>
            Extra bed +Rp 100.000/malam · check-in 13.00 · check-out 12.00
          </p>
        </section>

        {/* Fasilitas */}
        <section id="fasilitas" className="py-8 scroll-mt-20">
          <SectionHead n="4" title="Fasilitas" sub="Tersedia di Gedung A, B & C." />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FASILITAS.map((f) => (
              <div key={f.t} className="rounded-[14px] p-4 flex items-center gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <span className="text-[22px]">{f.i}</span>
                <span className="text-[14px] font-medium" style={{ color: C.brown }}>
                  {f.t}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-[13px] mt-4 italic" style={{ fontFamily: elegant, color: C.brownSoft }}>
            Laundry, minimarket & cuci motor berbayar terpisah. Untuk cuci motor, tanyakan ke penjaga.
          </p>
        </section>

        {/* Galeri + video */}
        <section className="py-8">
          <SectionHead n="5" title="Galeri" sub="Suasana Top Hills." />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(info.fotoArea.length > 0
              ? info.fotoArea
              : ['Area gedung', 'Kamar nyaman', 'Lemari & meja', 'Balkon view', 'Gazebo atas', 'Laundry & minimarket', 'Cuci motor', 'Security & CCTV']
            ).map((g, i) => (
              <Img key={i} src={info.fotoArea.length > 0 ? g : undefined} label={info.fotoArea.length === 0 ? g : 'Foto'} />
            ))}
          </div>
          <div className="mt-4">
            {info.videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {info.videos.map((v, i) => (
                  <VideoEmbed key={i} url={v} />
                ))}
              </div>
            ) : (
              <div className="rounded-[16px] grid place-items-center text-center aspect-[16/9]" style={{ background: C.creamDeep, border: `1px dashed ${C.goldSoft}` }}>
                <div style={{ fontFamily: body, color: C.brownSoft }}>
                  <div className="text-[26px] mb-1">▶️</div>
                  <div className="text-[13px]">Video tur kamar (atur di Pengaturan → Halaman Info)</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Aturan */}
        <section className="py-8">
          <SectionHead n="6" title="Aturan" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <h3 style={{ fontFamily: serif, color: C.brown }} className="text-[17px] font-bold mb-3 m-0">
                🏠 Aturan Kost Putri
              </h3>
              <ul className="space-y-2 text-[14px]" style={{ color: C.brownSoft }}>
                {[
                  'Khusus putri, terbuka untuk umum (mahasiswi & non-mahasiswi).',
                  'Gerbang ditutup 22.00 WIB (kabari penjaga bila ada keperluan).',
                  'Tamu laki-laki hanya di area luar/ruang tamu.',
                  'Boleh masak di kamar (listrik token pribadi).',
                  'Tidak ada deposit.',
                  'Tamu menginap di kamar >2 hari: Rp 150.000/orang.',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span style={{ color: C.gold }}>•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 style={{ fontFamily: serif, color: C.brown }} className="text-[17px] font-bold mb-3 m-0">
                🛏️ Aturan Menginap
              </h3>
              <ul className="space-y-2 text-[14px]" style={{ color: C.brownSoft }}>
                {[
                  'Check-in 13.00 · check-out 12.00 (check-in lewat 13.00 tetap dihitung check-out 12.00).',
                  'Sudah bayar DP tapi batal → DP hangus.',
                  'Lebih dari 3 orang: Executive +Rp 50rb, Superior +Rp 60rb, Deluxe +Rp 75rb /orang/malam.',
                  'Extra bed +Rp 100.000/malam.',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span style={{ color: C.gold }}>•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* Cara Booking */}
        <section id="booking" className="py-8 scroll-mt-20">
          <SectionHead n="7" title="Cara Booking" />
          <Card>
            <ol className="space-y-4">
              {[
                ['Pilih kamar / tipe', 'Tentukan kost (Gedung A/B) atau penginapan (Gedung C) yang kamu mau.'],
                ['Bayar DP untuk amankan kamar', 'Kost setahun min. Rp 4jt · 6 bulan min. Rp 2jt · Penginapan harian min. Rp 100rb. Bisa transfer atau tunai di lokasi.'],
                ['Minta nomor rekening via WhatsApp Resmi', 'Demi keamanan, nomor rekening diberikan admin saat konfirmasi (rekening kost & penginapan berbeda).'],
                ['WAJIB kirim bukti pembayaran ASLI', 'Upload/kirim bukti transfer atau tunai yang asli ke WhatsApp Resmi — akan diverifikasi kembali oleh admin.'],
                ['Kamar diamankan ✅', 'Setelah bukti diterima & dicek, kamarmu langsung kami amankan.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full grid place-items-center text-[14px] font-bold" style={{ background: C.gold, color: '#fff', fontFamily: serif }}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold" style={{ color: C.brown }}>
                      {t}
                    </div>
                    <div className="text-[14px] leading-snug mt-0.5" style={{ color: C.brownSoft }}>
                      {d}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-[14px] p-4 text-[14px] leading-snug" style={{ background: '#FBF0E6', border: `1px solid ${C.goldSoft}`, color: C.brown }}>
              ⚠️ <b>Penting:</b> bukti pembayaran <b>asli wajib dikirim</b> ke WhatsApp Resmi dan akan <b>dicek ulang</b> oleh admin. Pelunasan dilakukan di awal sebelum menempati. DP tidak dapat dikembalikan bila batal.
            </div>
            <div className="mt-5">
              <WAButton href={wa(info.waResmi, 'Halo Top Hills 🌸, saya sudah baca cara booking. Saya mau lanjut booking ...')}>
                <WAIcon /> Booking via WhatsApp Resmi
              </WAButton>
            </div>
          </Card>
        </section>

        {/* Lokasi & Survey */}
        <section id="lokasi" className="py-8 scroll-mt-20">
          <SectionHead n="8" title="Lokasi & Survey" />
          <Card>
            <div className="flex gap-3 items-start">
              <span className="text-[22px]">📍</span>
              <div>
                <div className="text-[15px] font-semibold" style={{ color: C.brown }}>
                  {info.nama}
                </div>
                <div className="text-[14px]" style={{ color: C.brownSoft }}>
                  {info.alamat}
                </div>
                <div className="text-[14px] mt-1" style={{ color: C.brownSoft }}>
                  Dekat UNAND, ada akses langsung ke gerbang kampus 🎓
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <WAButton href={info.maps} variant="ghost">
                🗺️ Buka di Google Maps
              </WAButton>
              <WAButton href={wa(info.waMezi, MSG_SURVEY)} variant="green">
                <WAIcon /> Janji Survey (Bang Mezi)
              </WAButton>
            </div>
            <p className="text-[13px] mt-3 text-center" style={{ color: C.brownSoft }}>
              Boleh lihat kamar dulu sebelum booking. Jam survey 08.00–19.00 WIB — sebaiknya janjian dulu.
            </p>
          </Card>
        </section>

        {/* FAQ */}
        <section className="py-8">
          <SectionHead n="9" title="Pertanyaan Umum" />
          <Card className="!py-1">
            {FAQ.map((f) => (
              <Accordion key={f.q} q={f.q} a={f.a} />
            ))}
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-4 text-center" style={{ background: C.creamDeep, borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-[900px]">
          <Brand />
          <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-[520px] mx-auto text-left">
            <a href={wa(info.waResmi, info.waPesan)} target="_blank" rel="noopener noreferrer" className="rounded-[14px] p-4 no-underline flex items-center gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <span style={{ color: '#1F7A4D' }}>
                <WAIcon size={24} />
              </span>
              <span>
                <span className="block text-[13px]" style={{ color: C.brownSoft }}>
                  WhatsApp Resmi (booking & bukti bayar)
                </span>
                <span className="block text-[15px] font-semibold" style={{ color: '#1F7A4D' }}>
                  Klik untuk chat →
                </span>
              </span>
            </a>
            <a href={wa(info.waMezi, MSG_SURVEY)} target="_blank" rel="noopener noreferrer" className="rounded-[14px] p-4 no-underline flex items-center gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <span style={{ color: '#1F7A4D' }}>
                <WAIcon size={24} />
              </span>
              <span>
                <span className="block text-[13px]" style={{ color: C.brownSoft }}>
                  Bang Mezi (penjaga / survey)
                </span>
                <span className="block text-[15px] font-semibold" style={{ color: '#1F7A4D' }}>
                  Klik untuk chat →
                </span>
              </span>
            </a>
          </div>
          <p className="mt-6 text-[13px]" style={{ color: C.brownSoft }}>
            Admin aktif 08.00–21.00 WIB · Jam survey 08.00–19.00 WIB · Gerbang ditutup 22.00 WIB
          </p>
          <p className="mt-4 text-[12px]" style={{ color: C.brownSoft }}>
            © {new Date().getFullYear()} {info.nama} · Limau Manis, Pauh, Padang
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a href={wa(info.waResmi, info.waPesan)} target="_blank" rel="noopener noreferrer" aria-label="Booking via WhatsApp" className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full grid place-items-center shadow-lg" style={{ background: '#25D366', color: '#fff', boxShadow: '0 8px 24px rgba(37,211,102,0.5)' }}>
        <WAIcon size={28} />
      </a>
    </div>
  );
}
