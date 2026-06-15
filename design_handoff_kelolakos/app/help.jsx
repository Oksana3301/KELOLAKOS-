// ===== KelolaKos · Sistem Bantuan menyeluruh =====
// Onboarding tur, Panduan terpusat, Empty state memandu, Toast sukses/gagal.
const { Btn: HB, Card: HCard, ScreenHead: HHead } = window;

// ---------------------------------------------------------------------------
// 1) ONBOARDING — tur singkat saat pertama buka (bisa di-skip & diulang)
// ---------------------------------------------------------------------------
const TUR = [
  { ic: 'bantuan', warna: 'var(--navy)', judul: 'Selamat datang di KelolaKos', teks: 'Aplikasi sederhana untuk mengatur kos Anda — penyewa, kamar, dan uang, semua di satu tempat. Mari kenalan sebentar.' },
  { ic: 'beranda', warna: 'var(--green)', judul: '1. Beranda', teks: 'Halaman utama. Lihat ringkasan uang masuk, kamar terisi, dan siapa yang perlu ditagih hari ini.' },
  { ic: 'booking', warna: 'var(--orange)', judul: '2. Booking', teks: 'Catat penyewa baru dan pembayaran. Tekan tombol oranye besar "Tambah Penyewa" untuk mulai.' },
  { ic: 'pembayaran', warna: 'var(--green)', judul: '3. Uang & Laporan', teks: 'Catat pemasukan dan pengeluaran, lalu lihat untung-rugi Anda di menu Laporan dengan bahasa sederhana.' },
  { ic: 'bantuan', warna: 'var(--navy)', judul: 'Selalu ada bantuan', teks: 'Bingung? Tekan tombol tanda tanya (?) di pojok kanan atas tiap halaman, atau buka menu "Panduan" kapan saja.' },
];

function Onboarding({ open, onClose, onPanduan }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => { if (open) setI(0); }, [open]);
  if (!open) return null;
  const s = TUR[i];
  const akhir = i === TUR.length - 1;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(12,44,71,.55)', display: 'grid', placeItems: 'center', padding: 22 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 460, borderRadius: 24, padding: '22px 24px 26px', border: '2px solid var(--mauve)', animation: 'popIn .24s cubic-bezier(.2,.8,.2,1)' }}>
        {/* Lewati */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          {!akhir && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16, color: 'var(--ink-soft)', padding: 6 }}>Lewati ›</button>}
        </div>

        <div style={{ textAlign: 'center', padding: '4px 6px 0' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: 'var(--mint-soft)', border: '3px solid var(--mint)', color: s.warna }}>
            <window.LineIcon name={s.ic} size={48} sw={2} color={s.warna} />
          </div>
          <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 26, margin: '0 0 12px' }}>{s.judul}</h2>
          <p style={{ fontSize: 18.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 22px' }}>{s.teks}</p>
        </div>

        {/* titik progress */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 9, marginBottom: 22 }}>
          {TUR.map((_, n) => (
            <span key={n} onClick={() => setI(n)} style={{ width: n === i ? 26 : 11, height: 11, borderRadius: 999, background: n === i ? 'var(--orange)' : 'var(--mauve)', cursor: 'pointer', transition: 'width .2s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {i > 0 && <HB variant="secondary" onClick={() => setI(i - 1)} style={{ flex: 1 }}>Kembali</HB>}
          {!akhir && <HB variant="primary" size="lg" onClick={() => setI(i + 1)} style={{ flex: 2 }}>Lanjut</HB>}
          {akhir && <HB variant="success" size="lg" onClick={onClose} style={{ flex: 2 }}>Mulai Pakai</HB>}
        </div>
        {akhir && (
          <button onClick={() => { onClose(); onPanduan && onPanduan(); }} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16.5, color: 'var(--navy)', textDecoration: 'underline', padding: 8 }}>Buka Panduan lengkap</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3) EMPTY STATE memandu — ilustrasi + teks + panah ke tombol
// ---------------------------------------------------------------------------
function EmptyState({ icon = 'booking', title, teks, arah, actionLabel, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px 18px 28px' }}>
      {arah === 'atas' && (
        <div style={{ display: 'grid', placeItems: 'center', color: 'var(--orange)', marginBottom: 6, animation: 'naikTurun 1.2s ease-in-out infinite' }}>
          <window.LineIcon name="panahAtas" size={34} sw={2.6} color="var(--orange)" />
        </div>
      )}
      <div style={{ width: 92, height: 92, borderRadius: '50%', margin: '8px auto 18px', display: 'grid', placeItems: 'center', background: 'var(--mauve-soft)', color: 'var(--ink-soft)' }}>
        <window.LineIcon name={icon} size={46} sw={1.8} color="var(--ink-soft)" />
      </div>
      <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 22, margin: '0 0 10px' }}>{title}</h3>
      <p style={{ fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 auto 22px', maxWidth: 360 }}>{teks}</p>
      {onAction && <HB variant="primary" size="lg" onClick={onAction} style={{ maxWidth: 360, margin: '0 auto' }}>{actionLabel}</HB>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5) TOAST sukses / gagal / info — jelas & menenangkan
// ---------------------------------------------------------------------------
function KkToast({ data }) {
  const cfg = {
    success: { bg: 'var(--green)', ic: 'cek' },
    error: { bg: 'var(--orange)', ic: 'silang' },
    info: { bg: 'var(--navy)', ic: 'info' },
  }[data.type] || { bg: 'var(--navy)', ic: 'info' };
  return (
    <div className="toast">
      <span style={{ flexShrink: 0, display: 'grid' }}><window.LineIcon name={cfg.ic} size={22} sw={2.4} color="#fff" /></span>
      <span>{data.msg}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6) PANDUAN terpusat — langkah bergambar untuk task utama
// ---------------------------------------------------------------------------
const PANDUAN = [
  {
    id: 'booking', judul: 'Cara Buat Booking Baru', ic: 'booking', warna: 'var(--orange)',
    langkah: [
      { ic: 'booking', t: 'Buka menu Booking', d: 'Tekan "Booking" di menu bawah, lalu tekan tombol oranye "Tambah Penyewa".' },
      { ic: 'akun', t: 'Isi data penyewa', d: 'Tulis nama lengkap dan nomor HP. Ada contoh di tiap kolom.' },
      { ic: 'kamar', t: 'Pilih kamar & lama sewa', d: 'Pilih kamar kosong dan berapa bulan. Harga dihitung otomatis.' },
      { ic: 'pembayaran', t: 'Pilih pembayaran & simpan', d: 'Pilih Lunas / DP / Belum Bayar, lalu tekan "Simpan Booking".' },
    ],
  },
  {
    id: 'bayar', judul: 'Cara Catat Pembayaran', ic: 'pembayaran', warna: 'var(--green)',
    langkah: [
      { ic: 'beranda', t: 'Cari yang perlu ditagih', d: 'Di Beranda, lihat daftar "Perlu Tindakan", atau buka penyewa di menu Booking.' },
      { ic: 'pembayaran', t: 'Tekan "Tagih" / "Catat Pembayaran"', d: 'Tombol hijau akan muncul untuk penyewa yang masih punya sisa.' },
      { ic: 'cek', t: 'Konfirmasi lunas', d: 'Periksa jumlahnya, lalu tekan "Ya, Lunas". Selesai!' },
    ],
  },
  {
    id: 'laporan', judul: 'Cara Lihat Laporan', ic: 'laporan', warna: 'var(--navy)',
    langkah: [
      { ic: 'laporan', t: 'Buka menu Laporan', d: 'Ada di menu "Lainnya". Halaman ini merangkum keuangan Anda.' },
      { ic: 'kalender', t: 'Pilih waktu', d: 'Pilih Hari/Minggu/Bulan/Tahun Ini, atau tentukan tanggal sendiri.' },
      { ic: 'harga', t: 'Lihat untung & rincian', d: 'Lihat keuntungan bersih, dari mana uang masuk, dan ke mana keluar.' },
    ],
  },
];

function Panduan({ ctx }) {
  const [buka, setBuka] = React.useState('booking');

  return (
    <div>
      <HHead title="Panduan" sub="Cara memakai KelolaKos, langkah demi langkah" onHelp={() => ctx.openHelp('panduan')} />

      <window.StickyCTA>
        <HB variant="primary" size="lg" block onClick={() => ctx.replayTour && ctx.replayTour()}>
          <window.LineIcon name="bantuan" size={22} sw={2.2} color="#fff" /> Lihat Tur Singkat Lagi
        </HB>
      </window.StickyCTA>

      <p style={{ fontSize: 17, color: 'var(--ink-soft)', margin: '0 0 20px' }}>Pilih panduan di bawah. Tekan judulnya untuk membuka langkah-langkahnya.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PANDUAN.map(p => {
          const aktif = buka === p.id;
          return (
            <div key={p.id} style={{ background: '#fff', border: '2px solid var(--mauve)', borderRadius: 18, overflow: 'hidden' }}>
              <button onClick={() => setBuka(aktif ? null : p.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 18, background: aktif ? 'var(--mint-soft)' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: '#fff', border: '2px solid var(--mauve)', display: 'grid', placeItems: 'center', color: p.warna }}>
                  <window.LineIcon name={p.ic} size={26} sw={2.2} color={p.warna} />
                </div>
                <span style={{ flex: 1, fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19.5 }}>{p.judul}</span>
                <span style={{ color: 'var(--ink-soft)', display: 'grid', transform: aktif ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><window.LineIcon name="chevron" size={22} sw={2.4} /></span>
              </button>

              {aktif && (
                <div style={{ padding: '4px 18px 20px' }}>
                  {p.langkah.map((l, n) => (
                    <div key={n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid var(--mauve-soft)' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 50, height: 50, borderRadius: 13, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', color: 'var(--navy)' }}>
                          <window.LineIcon name={l.ic} size={26} sw={2.2} color="var(--navy)" />
                        </div>
                        <span style={{ position: 'absolute', top: -8, left: -8, width: 26, height: 26, borderRadius: '50%', background: 'var(--orange)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 16, border: '2px solid #fff' }}>{n + 1}</span>
                      </div>
                      <div style={{ flex: 1, paddingTop: 2 }}>
                        <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18 }}>{l.t}</div>
                        <div style={{ fontSize: 16.5, color: 'var(--ink-soft)', lineHeight: 1.45, marginTop: 3 }}>{l.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <HCard tone="mint" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20, padding: 18 }}>
        <span style={{ color: 'var(--green)', flexShrink: 0, display: 'grid' }}><window.LineIcon name="bantuan" size={28} sw={2.2} color="var(--green)" /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18 }}>Masih bingung?</div>
          <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Tim kami siap membantu lewat WhatsApp.</div>
        </div>
        <HB variant="success" onClick={() => ctx.toast('Contoh: membuka chat WhatsApp.')} style={{ minHeight: 48, fontSize: 16, padding: '0 18px', flexShrink: 0 }}>Chat</HB>
      </HCard>
    </div>
  );
}

Object.assign(window, { Onboarding, EmptyState, KkToast, Panduan });
