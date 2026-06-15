// ===== KelolaKos · Layar inti: Beranda, Kamar, Booking =====
const { Btn, Card, BayarBadge, ScreenHead, InfoRow,
        RUPIAH, RUPIAH_SHORT, TANGGAL, TANGGAL_SHORT, ROOM_STATUS } = window;

// =================== BERANDA ===================
function Beranda({ ctx }) {
  const [periode, setPeriode] = useState({ preset: 'bulan' });
  const [detail, setDetail] = useState(null);
  const data = window.resolvePeriode(periode);

  const perlu = window.BOOKINGS.filter(b => b.status === 'Belum Bayar' || b.status === 'DP');
  const kamar = {
    kosong: window.ROOMS.filter(x => x.status === 'tersedia').length,
    terisi: window.ROOMS.filter(x => x.status === 'terisi').length,
    perhatian: window.ROOMS.filter(x => x.status === 'perhatian').length,
  };

  return (
    <div>
      {/* Sapaan + petunjuk */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 30, margin: 0, color: 'var(--navy)' }}>Selamat datang, Bu Endang.</h1>
          <p style={{ margin: '8px 0 0', fontSize: 19, color: 'var(--ink-soft)' }}>Ini ringkasan properti Anda hari ini.</p>
        </div>
        <button onClick={() => ctx.openHelp('beranda')} aria-label="Bantuan" style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', background: 'var(--mint-soft)', border: '2px solid var(--mint)', color: 'var(--navy)', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22, cursor: 'pointer' }}>?</button>
      </div>

      {/* Aksi utama — menempel di atas, selalu terjangkau tanpa scroll (di laptop sudah ada di sidebar) */}
      {!ctx.wide && (
        <window.StickyCTA><Btn variant="primary" size="lg" block onClick={() => ctx.openBooking()}>＋ Tambah Penyewa Baru</Btn></window.StickyCTA>
      )}

      {/* Filter waktu (termasuk rentang tanggal sendiri) */}
      <window.PeriodFilter value={periode} onChange={setPeriode} />

      {/* 4 angka penting */}
      <window.MoneyKpiGrid data={data} onDetail={setDetail} style={{ marginBottom: 26 }} />

      {/* Status kamar */}
      <button onClick={() => ctx.go('kamar')} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: '#fff', border: '2px solid var(--mauve)', borderRadius: 18, padding: 22, marginBottom: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21, color: 'var(--navy)' }}>Status Kamar</div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)' }}>Lihat semua <window.LineIcon name="chevron" size={16} sw={2.6} color="currentColor" /></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { n: kamar.terisi, l: 'Terisi', c: 'var(--green)' },
            { n: kamar.kosong, l: 'Masih Kosong', c: 'var(--ink-soft)' },
            { n: kamar.perhatian, l: 'Perlu Perhatian', c: 'var(--orange)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--paper)', borderRadius: 14, padding: '16px 8px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.c }} />
                <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 30, color: 'var(--navy)', lineHeight: 1 }}>{s.n}</span>
              </div>
              <div style={{ fontSize: 16, color: 'var(--ink-soft)', fontWeight: 600, marginTop: 7 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </button>

      {/* Perlu tindakan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px' }}>
        <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 23, margin: 0 }}>Perlu Tindakan</h2>
        {perlu.length > 0 && <span style={{ background: 'var(--orange)', color: '#fff', fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 16, padding: '3px 12px', borderRadius: 999 }}>{perlu.length}</span>}
      </div>

      {perlu.length === 0 ? (
        <Card tone="mint" style={{ textAlign: 'center', padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 10, color: 'var(--green)' }}><window.LineIcon name="cek" size={44} sw={2} /></div>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Semua sudah lunas. Tidak ada yang perlu diurus.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {perlu.map(b => (
            <Card key={b.id} onClick={() => ctx.openBookingDetail(b)} style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{b.nama}</div>
                <div style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 8 }}>{b.kamar} · Sisa {RUPIAH(b.total - b.dibayar)}</div>
                <BayarBadge status={b.status} />
              </div>
              <Btn variant="success" onClick={(e) => { e.stopPropagation(); ctx.openPayment(b); }} style={{ minHeight: 50, fontSize: 17, padding: '0 18px' }}>Tagih</Btn>
            </Card>
          ))}
        </div>
      )}

      {/* Rincian angka (modal) */}
      {detail && <window.MoneyKpiDetail id={detail} data={data} onClose={() => setDetail(null)} />}
    </div>
  );
}

// =================== KAMAR ===================
// (Kelola Kamar kini ada di app/kamar.jsx)

// =================== BOOKING ===================
function Booking({ ctx }) {
  const [tab, setTab] = useState('semua');
  const [cari, setCari] = useState('');
  const tabs = [
    { id: 'semua', label: 'Semua' },
    { id: 'Belum Bayar', label: 'Belum Bayar' },
    { id: 'DP', label: 'DP' },
    { id: 'Lunas', label: 'Lunas' },
    { id: 'Batal', label: 'Batal' },
  ];
  let list = window.BOOKINGS.filter(b => tab === 'semua' || b.status === tab);
  if (cari) list = list.filter(b => (b.nama + b.kamar).toLowerCase().includes(cari.toLowerCase()));

  return (
    <div>
      <ScreenHead title="Booking" sub={`${window.BOOKINGS.length} penyewa terdaftar`} onHelp={() => ctx.openHelp('booking')} />

      {!ctx.wide && (
        <window.StickyCTA><Btn variant="primary" size="lg" block onClick={() => ctx.openBooking()}>＋ Tambah Penyewa Baru</Btn></window.StickyCTA>
      )}

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama penyewa…"
          style={{ width: '100%', fontFamily: 'var(--body)', fontWeight: 500, fontSize: 19, color: 'var(--navy)',
            padding: '15px 16px', border: '2px solid var(--mauve)', borderRadius: 12, background: '#fff' }} />
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 18, marginInline: -4, paddingInline: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flexShrink: 0, minHeight: 48, padding: '0 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 17,
            border: '2px solid ' + (tab === t.id ? 'var(--navy)' : 'var(--mauve)'),
            background: tab === t.id ? 'var(--navy)' : '#fff', color: tab === t.id ? '#fff' : 'var(--navy)' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.length === 0 && (
          (cari || tab !== 'semua')
            ? <Card style={{ textAlign: 'center', padding: 28, color: 'var(--ink-soft)', fontSize: 18 }}>Tidak ada penyewa di kategori ini.</Card>
            : <Card style={{ padding: 0 }}><window.EmptyState icon="booking" arah="atas" title="Belum ada booking" teks="Tekan tombol Tambah Penyewa di atas untuk mencatat penyewa pertama Anda." actionLabel="＋ Tambah Penyewa Baru" onAction={() => ctx.openBooking()} /></Card>
        )}
        {list.map(b => {
          const batal = b.status === 'Batal';
          return (
          <Card key={b.id} onClick={() => ctx.openBookingDetail(b)} style={{ padding: 18, opacity: batal ? 0.72 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 20, textDecoration: batal ? 'line-through' : 'none', textDecorationColor: 'var(--ink-soft)' }}>{b.nama}</div>
                <div style={{ fontSize: 17, color: 'var(--ink-soft)', marginTop: 3 }}>{b.kamar}</div>
              </div>
              <BayarBadge status={b.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--mauve-soft)', paddingTop: 10 }}>
              <span style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{TANGGAL_SHORT(b.masuk)} → {TANGGAL_SHORT(b.keluar)}</span>
              <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19 }}>{RUPIAH(b.total)}</span>
            </div>
          </Card>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Beranda, Booking });
