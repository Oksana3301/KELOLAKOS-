'use client';

import Link from 'next/link';
import { TH, TH_SERIF, TH_BODY } from '@/lib/tophills-theme';

// Shell standalone untuk halaman publik /info/booking/* (di luar app gate).
export function BookingShell({ children, back }: { children: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div style={{ background: TH.cream, fontFamily: TH_BODY, color: TH.brown }} className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur" style={{ background: 'rgba(244,236,221,0.92)', borderBottom: `1px solid ${TH.border}` }}>
        <div className="mx-auto max-w-[680px] px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/info" className="flex items-center gap-2.5 no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/invoice/logo-mark.png" alt="Top Hills" style={{ height: 36, width: 'auto', display: 'block' }} />
            <span style={{ fontFamily: TH_SERIF, color: TH.gold }} className="text-[18px] font-semibold tracking-[0.14em]">TOP HILLS</span>
          </Link>
          {back && (
            <Link href={back.href} className="text-[13px] font-semibold no-underline" style={{ color: TH.brownSoft }}>
              ‹ {back.label}
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[680px] px-4 py-7 pb-16">
        {children}
        <div className="text-center mt-9 pt-5" style={{ borderTop: `1px solid ${TH.border}` }}>
          <a
            href={`https://wa.me/628116646615?text=${encodeURIComponent('Halo Top Hills 🌸, saya butuh bantuan soal booking online.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-semibold no-underline"
            style={{ color: TH.brownSoft }}
          >
            Kesulitan mengisi? 💬 Chat Helpdesk Top Hills
          </a>
        </div>
      </main>
    </div>
  );
}

export function THCard({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={'rounded-[18px] p-5 ' + className} style={{ background: TH.card, border: `1px solid ${TH.border}`, ...style }}>
      {children}
    </div>
  );
}

export function THBtn({ children, onClick, href, variant = 'primary', block, disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'ghost' | 'gold'; block?: boolean; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[14px] font-bold text-[15px] no-underline transition-colors min-h-[50px] px-5 cursor-pointer';
  const styles: React.CSSProperties =
    variant === 'primary'
      ? { background: TH.gold, color: '#FBF7EC', border: `1px solid ${TH.gold}` }
      : variant === 'gold'
        ? { background: 'linear-gradient(135deg,#B98C34,#8A6A24)', color: '#fff', border: 'none' }
        : { background: 'transparent', color: TH.brown, border: `1.5px solid ${TH.border}` };
  const cls = base + (block ? ' w-full' : '') + (disabled ? ' opacity-50 pointer-events-none' : '');
  if (href && !disabled) return <Link href={href} className={cls} style={styles}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls} style={styles}>{children}</button>;
}

export function THField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold mb-1.5" style={{ color: TH.brown }}>{label}</span>
      {children}
      {error ? (
        <span className="block text-[12px] mt-1" style={{ color: TH.danger }}>{error}</span>
      ) : hint ? (
        <span className="block text-[12px] mt-1" style={{ color: TH.brownSoft }}>{hint}</span>
      ) : null}
    </label>
  );
}

export function THInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={'w-full min-h-[48px] rounded-[12px] px-3.5 text-[15px] outline-none ' + (props.className || '')}
      style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown, ...props.style }}
    />
  );
}

// Input rupiah dengan auto-format titik ribuan (mis. 4.000.000).
export function RupiahInput({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold pointer-events-none" style={{ color: TH.brownSoft }}>Rp</span>
      <input
        inputMode="numeric"
        placeholder={placeholder}
        value={value ? value.toLocaleString('id-ID') : ''}
        onChange={(e) => onChange(Number(String(e.target.value).replace(/[^0-9]/g, '')) || 0)}
        className="w-full min-h-[48px] rounded-[12px] pl-10 pr-3.5 text-[15px] outline-none"
        style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown }}
      />
    </div>
  );
}

export function THSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={'w-full min-h-[48px] rounded-[12px] px-3.5 text-[15px] outline-none ' + (props.className || '')}
      style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown, ...props.style }}
    />
  );
}

// Detail booking untuk pesan WA konfirmasi (dikirim ke Penjaga & Admin).
export type BookingDoneDetail = {
  nama?: string;
  jenis?: 'baru' | 'perpanjang';
  layanan?: string;          // 'KOS' | 'PENGINAPAN'
  kamar?: string;            // "2A — Gedung B" atau "3A, 3B"
  roomCount?: number;
  durasi?: string;           // "6 Bulan" / "3 malam"
  checkIn?: string;          // ISO / '' (kost kunci tanggal → kosong)
  checkOut?: string;
  orang?: number;
  fasilitas?: string[];
  extraBed?: number;
  catatan?: string;
  bayar?: 'DP' | 'Full';
  dp?: number;
  total?: number;
  bookingId?: string;        // ref booking lama (perpanjang)
};

function bd_rp(n?: number) { return typeof n === 'number' && n > 0 ? 'Rp' + n.toLocaleString('id-ID') : ''; }
function bd_tgl(iso?: string) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Susun pesan WA konfirmasi LENGKAP dengan detail booking (biar admin gampang cek).
export function buildBookingWaText(d?: BookingDoneDetail): string {
  if (!d) return 'Hi Top Hills 🌸, aku sudah melakukan pembayaran booking. Ini bukti transfernya ya, mohon dikonfirmasi 🙏';
  const isKost = String(d.layanan || '').toUpperCase().includes('KOS');
  const L: string[] = [];
  L.push(d.jenis === 'perpanjang'
    ? '🌸 *Konfirmasi Perpanjangan & Pembayaran — Top Hills*'
    : '🌸 *Konfirmasi Booking & Pembayaran — Top Hills*');
  L.push('');
  if (d.nama) L.push(`👤 Nama: *${d.nama}*`);
  L.push(`🏠 Layanan: ${isKost ? 'Kost Putri' : 'Penginapan'}`);
  if (d.kamar) L.push(`🚪 Kamar: *${d.kamar}*${d.roomCount && d.roomCount > 1 ? ` (${d.roomCount} kamar)` : ''}`);
  if (d.durasi) L.push(`🗓️ Periode: ${d.durasi}`);
  const ci = bd_tgl(d.checkIn), co = bd_tgl(d.checkOut);
  if (ci && co) L.push(`📅 ${ci} → ${co}`);
  else if (ci) L.push(`📅 Mulai: ${ci}`);
  else if (isKost && d.jenis !== 'perpanjang') L.push('📅 Tanggal: di-set admin saat konfirmasi (pelunasan)');
  if (d.orang && d.orang > 1) L.push(`👥 Jumlah orang: ${d.orang}`);
  const tambah: string[] = [];
  if (d.fasilitas && d.fasilitas.length) tambah.push(d.fasilitas.join(', '));
  if (d.extraBed && d.extraBed > 0) tambah.push(`Extra bed ×${d.extraBed}`);
  if (tambah.length) L.push(`✨ Tambahan: ${tambah.join(' · ')}`);
  if (d.catatan && d.catatan.trim()) L.push(`📝 Catatan: ${d.catatan.trim()}`);
  const total = bd_rp(d.total);
  if (d.bayar === 'DP') L.push(`💰 Pembayaran: DP${bd_rp(d.dp) ? ' ' + bd_rp(d.dp) : ''}${total ? ` · total est ${total}` : ''}`);
  else L.push(`💰 Pembayaran: Lunas${total ? ' ' + total : ''}`);
  if (d.bookingId) L.push(`🔖 Ref booking lama: ${d.bookingId}`);
  L.push('');
  L.push('Ini bukti transfernya ya, mohon dikonfirmasi 🙏');
  return L.join('\n');
}

// Layar sukses setelah submit booking publik (Baru / Perpanjang).
// Kirim konfirmasi BERURUTAN: ① Bang Mezi (Penjaga) dulu, lalu ② Admin/Helpdesk.
// Kedua tombol memuat pesan detail booking yang sama supaya gampang dicek.
export function BookingDone({ nama, demo, detail, waMezi, waResmi }: {
  nama?: string; demo?: boolean; detail?: BookingDoneDetail;
  waMezi?: string; waResmi?: string;
}) {
  const MEZI = (waMezi || '').replace(/[^0-9]/g, '') || '6283841614871';   // Penjaga (Bang Mezi)
  const ADMIN = (waResmi || '').replace(/[^0-9]/g, '') || '628116646615';  // Helpdesk / Admin
  const msg = encodeURIComponent(buildBookingWaText(detail ? { ...detail, nama: detail.nama || nama } : undefined));
  const linkMezi = `https://wa.me/${MEZI}?text=${msg}`;
  const linkAdmin = `https://wa.me/${ADMIN}?text=${msg}`;

  const isKost = String(detail?.layanan || '').toUpperCase().includes('KOS');
  const rows: Array<[string, string]> = [];
  if (detail) {
    rows.push(['🏠 Layanan', isKost ? 'Kost Putri' : 'Penginapan']);
    if (detail.kamar) rows.push(['🚪 Kamar', `${detail.kamar}${detail.roomCount && detail.roomCount > 1 ? ` (${detail.roomCount} kamar)` : ''}`]);
    if (detail.durasi) rows.push(['🗓️ Periode', detail.durasi]);
    const rci = bd_tgl(detail.checkIn), rco = bd_tgl(detail.checkOut);
    if (rci && rco) rows.push(['📅 Tanggal', `${rci} → ${rco}`]);
    else if (rci) rows.push(['📅 Mulai', rci]);
    if (detail.orang && detail.orang > 1) rows.push(['👥 Orang', String(detail.orang)]);
    const tambah = [...(detail.fasilitas || []), ...(detail.extraBed ? [`Extra bed ×${detail.extraBed}`] : [])];
    if (tambah.length) rows.push(['✨ Tambahan', tambah.join(' · ')]);
    if (detail.bayar) rows.push(['💰 Bayar', detail.bayar === 'DP' ? `DP${bd_rp(detail.dp) ? ' ' + bd_rp(detail.dp) : ''}` : `Lunas${bd_rp(detail.total) ? ' ' + bd_rp(detail.total) : ''}`]);
  }

  return (
    <div className="text-center pt-3">
      <div className="text-[56px] leading-none">✅</div>
      <h1 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[28px] font-bold mt-2 mb-2">Permintaan Terkirim!</h1>
      <p className="text-[14.5px] leading-relaxed mb-3" style={{ color: TH.brownSoft }}>
        Bukti bayarmu sudah kami terima. <b style={{ color: TH.brown }}>Satu langkah terakhir:</b> kirim konfirmasi via WhatsApp
        — <b style={{ color: TH.brown }}>ke Bang Mezi dulu</b>, lalu ke Admin — supaya booking-mu cepat diproses 🌸
      </p>

      {/* Ringkasan booking di layar (biar jelas apa yang dikirim ke WA) */}
      {rows.length > 0 && (
        <div className="rounded-[16px] p-4 text-left mb-4" style={{ background: '#fff', border: `1px solid ${TH.border}` }}>
          <div className="text-[12px] font-bold mb-2" style={{ color: TH.gold }}>
            RINGKASAN BOOKING{(detail?.nama || nama) ? ` · ${detail?.nama || nama}` : ''}
          </div>
          <div className="space-y-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 text-[13px]">
                <span className="flex-shrink-0" style={{ color: TH.brownSoft }}>{k}</span>
                <span className="ml-auto text-right font-semibold" style={{ color: TH.brown }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[13px] leading-relaxed mb-4" style={{ color: TH.brownSoft }}>
        Booking aktif <b style={{ color: TH.brown }}>setelah pembayaran dikonfirmasi admin</b> (maks 1×24 jam).
      </p>
      {demo && (
        <div className="text-[11.5px] rounded-full px-3 py-1.5 inline-block mb-4" style={{ background: '#FBF1D8', color: '#8A6A24', border: '1px solid #E7D3A0' }}>
          ⚙️ Mode demo — backend submit belum di-deploy
        </div>
      )}
      <div className="space-y-3 mt-2">
        {/* ① Bang Mezi (Penjaga) — chat duluan di sini */}
        <a href={linkMezi} target="_blank" rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-[16px] font-bold text-[16px] no-underline min-h-[58px] px-5"
          style={{ background: 'linear-gradient(135deg,#1FAF55,#178A43)', color: '#fff', boxShadow: '0 10px 26px rgba(23,138,67,0.32)' }}>
          ① 💬 Konfirmasi ke Bang Mezi (Penjaga)
        </a>
        {/* ② Admin / Helpdesk Top Hills */}
        <a href={linkAdmin} target="_blank" rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-[16px] font-bold text-[15px] no-underline min-h-[52px] px-5"
          style={{ background: '#fff', color: '#178A43', border: '1.5px solid #178A43' }}>
          ② Lalu teruskan ke Admin Top Hills
        </a>
        <p className="text-[12px]" style={{ color: TH.brownSoft }}>Bang Mezi (penjaga) dulu, lalu Admin · 0811-6646-615</p>

        {/* Pintu lembut ke Rumah Penghuni — aktif setelah jadi penghuni Top Hills */}
        <div className="rounded-[16px] p-4 text-left mt-1" style={{ background: 'linear-gradient(135deg,#FCF8F0,#F3E8CF)', border: `1px solid ${TH.border}` }}>
          <div className="flex items-start gap-3">
            <span className="text-[26px] leading-none">🏡</span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold" style={{ fontFamily: TH_SERIF, color: TH.brown }}>
                Setelah ini, kamu punya Rumah Penghuni 🌸
              </div>
              <p className="text-[13px] leading-relaxed mt-1 mb-2.5" style={{ color: TH.brownSoft }}>
                Begitu booking-mu dikonfirmasi admin, kamu bisa masuk pakai nomor WhatsApp ini untuk lihat
                <b style={{ color: TH.brown }}> status loyalitas</b>, lengkapi profil buat <b style={{ color: TH.brown }}>kejutan
                selamat datang</b>, dan ambil <b style={{ color: TH.brown }}>kode ajak teman</b>.
              </p>
              <Link href="/rumah/login" className="inline-flex items-center gap-2 rounded-[12px] font-bold text-[13.5px] no-underline px-4 min-h-[42px]" style={{ background: '#fff', color: TH.brown, border: `1.5px solid ${TH.gold}` }}>
                Buka Rumah Penghuni →
              </Link>
            </div>
          </div>
        </div>

        <THBtn variant="ghost" href="/info" block>Kembali ke beranda</THBtn>
      </div>
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[28px] font-bold leading-tight m-0">{children}</h1>
      {sub && <p className="text-[14px] mt-1.5 m-0" style={{ color: TH.brownSoft }}>{sub}</p>}
    </div>
  );
}
