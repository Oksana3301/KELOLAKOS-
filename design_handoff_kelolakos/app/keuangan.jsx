// ===== KelolaKos · Menu Keuangan (4 jenis pencatatan + riwayat + hapus) =====
const { Btn: KB, Card: KCard, ScreenHead: KHead, Sheet: KSheet, Dialog: KDialog,
        InfoRow: KRow, RUPIAH: KRP, RUPIAH_SHORT: KRPS, TANGGAL_SHORT: KTGLS } = window;

const KHARI_INI = '2026-06-15';
const _kinp = { width: '100%', fontFamily: 'var(--body)', fontWeight: 500, fontSize: 20, color: 'var(--navy)', padding: '15px 16px', border: '2px solid var(--mauve)', borderRadius: 12, background: '#fff' };

// 4 jenis pencatatan
const JENIS = {
  pembayaran: {
    label: 'Pembayaran', ic: 'pembayaran', arah: 'masuk',
    ringkas: 'Uang sewa yang diterima dari penyewa.',
    f1: { label: 'Diterima dari', contoh: 'Contoh: Pak Budi Santoso' },
    judulJumlah: 'Jumlah uang diterima',
    contohJumlah: 'Contoh: 850000',
  },
  refund: {
    label: 'Refund', ic: 'refund', arah: 'keluar',
    ringkas: 'Uang yang dikembalikan ke penyewa, misal saat booking dibatalkan.',
    f1: { label: 'Dikembalikan ke', contoh: 'Contoh: Bu Siti Aminah' },
    judulJumlah: 'Jumlah dikembalikan',
    contohJumlah: 'Contoh: 400000',
  },
  fee: {
    label: 'Fee Penjaga', ic: 'akun', arah: 'keluar',
    ringkas: 'Gaji atau upah untuk penjaga kos yang membantu Anda.',
    f1: { label: 'Nama penjaga', contoh: 'Contoh: Mas Agus' },
    judulJumlah: 'Jumlah dibayar',
    contohJumlah: 'Contoh: 1500000',
  },
  belanja: {
    label: 'Belanja Operasional', ic: 'belanja', arah: 'keluar',
    ringkas: 'Pengeluaran untuk keperluan kos, misal beli galon, bayar listrik.',
    f1: { label: 'Untuk apa?', contoh: 'Contoh: Beli galon air' },
    judulJumlah: 'Jumlah uang',
    contohJumlah: 'Contoh: 50000',
  },
};

function _arahWarna(arah) {
  return arah === 'masuk'
    ? { c: 'var(--green)', soft: 'var(--mint-soft)', border: 'var(--mint)', tag: 'Pemasukan', tagBg: 'var(--green)', tagFg: '#fff', tanda: '+' }
    : { c: 'var(--orange)', soft: '#FBEFE9', border: '#E7BCAD', tag: 'Pengeluaran', tagBg: 'var(--orange)', tagFg: '#fff', tanda: '−' };
}

// =================== LAYAR KEUANGAN ===================
function Keuangan({ ctx }) {
  const [periode, setPeriode] = useState({ preset: 'bulan' });
  const [detail, setDetail] = useState(null);
  const [formJenis, setFormJenis] = useState(null);   // jenis yang sedang dicatat
  const [hapusTarget, setHapusTarget] = useState(null);
  const [list, setList] = useState(() => window.TRANSAKSI.slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));

  const data = window.resolvePeriode(periode);

  function tambah(tx) {
    setList(prev => [tx, ...prev]);
    setFormJenis(null);
    ctx.toast('✓ ' + JENIS[tx.jenisId].label + ' berhasil dicatat');
  }
  function hapus(tx) {
    setList(prev => prev.filter(x => x.id !== tx.id));
    setHapusTarget(null);
    ctx.toast('Catatan telah dihapus');
  }

  return (
    <div>
      <KHead title="Keuangan" sub="Catat & lihat uang masuk dan keluar" onHelp={() => ctx.openHelp('keuangan')} />

      {/* ---- 4 JENIS PENCATATAN ---- */}
      <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Catat Transaksi Baru</div>
      <p style={{ margin: '0 0 14px', fontSize: 16.5, color: 'var(--ink-soft)' }}>Pilih jenis yang sesuai. Hijau = uang masuk, oranye = uang keluar.</p>
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        {Object.entries(JENIS).map(([id, j]) => {
          const w = _arahWarna(j.arah);
          return (
            <button key={id} onClick={() => setFormJenis(id)} style={{ textAlign: 'left', cursor: 'pointer', background: '#fff',
              border: '2px solid ' + w.border, borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 150 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: w.soft, display: 'grid', placeItems: 'center', color: w.c }}>
                  <window.LineIcon name={j.ic} size={26} sw={2.2} color={w.c} />
                </div>
                <span style={{ fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16, padding: '4px 10px', borderRadius: 999, background: w.tagBg, color: w.tagFg }}>{w.tag}</span>
              </div>
              <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, color: 'var(--navy)' }}>{j.label}</div>
              <div style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.35 }}>{j.ringkas}</div>
            </button>
          );
        })}
      </div>

      {/* ---- RINGKASAN UANG ---- */}
      <window.PeriodFilter value={periode} onChange={setPeriode} />
      <window.MoneyKpiGrid data={data} onDetail={setDetail} style={{ marginBottom: 28 }} />

      {/* ---- RIWAYAT TRANSAKSI ---- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 23, margin: 0 }}>Riwayat Transaksi</h2>
        <span style={{ fontSize: 16, color: 'var(--ink-soft)', fontWeight: 600 }}>{list.length} catatan</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 && <KCard style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 17 }}>Belum ada transaksi.</KCard>}
        {list.map(t => {
          const masuk = t.jenis === 'masuk';
          const w = _arahWarna(masuk ? 'masuk' : 'keluar');
          return (
            <KCard key={t.id} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: w.soft, color: w.c }}>
                <window.LineIcon name={t.ic || (masuk ? 'masuk' : 'keluar')} size={24} sw={2.2} color={w.c} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18 }}>{t.kategori}</div>
                <div style={{ fontSize: 16, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nama} · {KTGLS(t.tanggal)}</div>
              </div>
              <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18, color: w.c, whiteSpace: 'nowrap' }}>{w.tanda} {KRPS(t.jumlah)}</div>
              <button onClick={() => setHapusTarget(t)} aria-label="Hapus" style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 12, border: '2px solid var(--mauve)', background: '#fff', color: 'var(--ink-soft)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <window.LineIcon name="hapus" size={20} sw={2.2} color="currentColor" />
              </button>
            </KCard>
          );
        })}
      </div>

      {detail && <window.MoneyKpiDetail id={detail} data={data} onClose={() => setDetail(null)} />}
      <TransaksiForm jenisId={formJenis} onClose={() => setFormJenis(null)} onSave={tambah} />
      <HapusTransaksi target={hapusTarget} onClose={() => setHapusTarget(null)} onConfirm={() => hapus(hapusTarget)} />
    </div>
  );
}

// =================== FORM CATAT TRANSAKSI ===================
function TransaksiForm({ jenisId, onClose, onSave }) {
  const j = jenisId ? JENIS[jenisId] : null;
  const [nama, setNama] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [tgl, setTgl] = useState(KHARI_INI);
  useEffect(() => { if (jenisId) { setNama(''); setJumlah(''); setTgl(KHARI_INI); } }, [jenisId]);
  if (!j) return null;
  const w = _arahWarna(j.arah);
  const valid = nama.trim().length > 0 && Number(jumlah) > 0;

  function simpan() {
    onSave({
      id: 'T' + Date.now(),
      jenisId, jenis: j.arah, ic: j.ic,
      kategori: j.label, nama: nama.trim(), jumlah: Number(jumlah), tanggal: tgl,
    });
  }

  return (
    <KSheet open={!!jenisId} onClose={onClose}>
      <div style={{ padding: '20px 22px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: w.soft, display: 'grid', placeItems: 'center', color: w.c }}>
              <window.LineIcon name={j.ic} size={26} sw={2.2} color={w.c} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 23, margin: 0 }}>{j.label}</h2>
              <span style={{ fontFamily: 'var(--body)', fontWeight: 600, fontSize: 15, color: w.c }}>{w.tag}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--mauve)', background: '#fff', color: 'var(--navy)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ background: w.soft, border: '2px solid ' + w.border, borderRadius: 12, padding: '12px 16px', fontSize: 16, marginBottom: 22, color: 'var(--navy)' }}>{j.ringkas}</div>

        <window.BookingField label={j.f1.label} contoh={j.f1.contoh}>
          <input autoFocus value={nama} onChange={e => setNama(e.target.value)} placeholder="Tulis di sini…" style={_kinp} />
        </window.BookingField>

        <window.BookingField label={j.judulJumlah} contoh={j.contohJumlah} hint="Tulis angka saja, tanpa titik atau Rp.">
          <input value={jumlah} onChange={e => setJumlah(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" style={_kinp} />
        </window.BookingField>

        <window.BookingField label="Tanggal">
          <input type="date" value={tgl} onChange={e => setTgl(e.target.value)} style={_kinp} />
        </window.BookingField>

        {/* Pratinjau jumlah berwarna */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '2px solid ' + w.border, borderRadius: 14, padding: '14px 18px', marginBottom: 22 }}>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18 }}>{j.arah === 'masuk' ? 'Uang masuk' : 'Uang keluar'}</span>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 24, color: w.c, whiteSpace: 'nowrap' }}>{w.tanda} {KRP(Number(jumlah) || 0)}</span>
        </div>

        <KB variant={j.arah === 'masuk' ? 'success' : 'primary'} size="lg" block onClick={() => valid && simpan()} style={{ opacity: valid ? 1 : .45 }}>
          <window.LineIcon name="cek" size={22} sw={2.4} color="#fff" /> Simpan Catatan
        </KB>
      </div>
    </KSheet>
  );
}

// =================== KONFIRMASI HAPUS TRANSAKSI ===================
function HapusTransaksi({ target, onClose, onConfirm }) {
  return (
    <KDialog open={!!target}>
      {target && (<>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--navy)' }}><window.LineIcon name="hapus" size={28} sw={2.2} /></div>
        <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 24, margin: '0 0 10px' }}>Hapus catatan ini?</h3>
        <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 18px', lineHeight: 1.45 }}>
          Catatan <b style={{ color: 'var(--navy)' }}>{target.kategori}</b> sebesar <b style={{ color: 'var(--navy)' }}>{KRP(target.jumlah)}</b> akan dihapus. Tenang, catatan lain tidak terpengaruh.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <KB variant="secondary" block onClick={onClose}>Tidak Jadi</KB>
          <KB variant="primary" block onClick={onConfirm}>Ya, Hapus</KB>
        </div>
      </>)}
    </KDialog>
  );
}

Object.assign(window, { Keuangan });
