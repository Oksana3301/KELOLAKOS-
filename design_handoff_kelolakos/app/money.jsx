// ===== KelolaKos · Komponen uang bersama: filter waktu + kartu angka =====
// Dipakai di Beranda, Keuangan, dan Laporan agar tampilan & bahasa seragam.

const PERIODE_PRESETS = [
  { id: 'hari', label: 'Hari Ini' },
  { id: 'minggu', label: 'Minggu Ini' },
  { id: 'bulan', label: 'Bulan Ini' },
  { id: 'tahun', label: 'Tahun Ini' },
];

function _fmtTgl(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function _fmtTglPendek(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// value: { preset:'bulan' } atau { preset:'custom', start:'YYYY-MM-DD', end:'YYYY-MM-DD' }
function resolvePeriode(value) {
  const v = value || { preset: 'bulan' };
  if (v.preset !== 'custom') {
    const p = window.PERIODE[v.preset] || window.PERIODE.bulan;
    return { label: p.label, masuk: p.masuk, keluar: p.keluar, sisa: p.sisa };
  }
  const days = Math.max(1, Math.round((new Date(v.end) - new Date(v.start)) / 86400000) + 1);
  return {
    label: _fmtTglPendek(v.start) + ' – ' + _fmtTglPendek(v.end),
    masuk: Math.round((12400000 / 30) * days),
    keluar: Math.round((4550000 / 30) * days),
    sisa: 23800000,
  };
}

const _dateInput = { display: 'block', width: '100%', marginTop: 6, fontFamily: 'var(--body)', fontWeight: 500, fontSize: 18, color: 'var(--navy)', padding: '13px 14px', border: '2px solid var(--mauve)', borderRadius: 12, background: '#fff' };

function _pill(active) {
  return { flexShrink: 0, minHeight: 48, padding: '0 18px', borderRadius: 12, cursor: 'pointer',
    fontFamily: 'var(--body)', fontWeight: 600, fontSize: 17, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
    border: '2px solid ' + (active ? 'var(--navy)' : 'var(--mauve)'), background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--navy)' };
}

function PeriodFilter({ value, onChange }) {
  const v = value || { preset: 'bulan' };
  const isCustom = v.preset === 'custom';
  const [open, setOpen] = React.useState(false);
  const [dari, setDari] = React.useState(v.start || '');
  const [sampai, setSampai] = React.useState(v.end || '');
  const valid = dari && sampai && new Date(dari) <= new Date(sampai);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginInline: -4, paddingInline: 4 }}>
        {PERIODE_PRESETS.map(o => (
          <button key={o.id} onClick={() => { setOpen(false); onChange({ preset: o.id }); }} style={_pill(!isCustom && v.preset === o.id)}>{o.label}</button>
        ))}
        <button onClick={() => setOpen(s => !s)} style={_pill(isCustom)}>
          <window.LineIcon name="kalender" size={18} sw={2} color="currentColor" />
          {isCustom ? resolvePeriode(v).label : 'Pilih Tanggal'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, background: '#fff', border: '2px solid var(--mauve)', borderRadius: 14, padding: 18 }}>
          <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Pilih rentang tanggal sendiri</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <label style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)' }}>Dari tanggal
              <input type="date" value={dari} onChange={e => setDari(e.target.value)} style={_dateInput} />
            </label>
            <label style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)' }}>Sampai tanggal
              <input type="date" value={sampai} onChange={e => setSampai(e.target.value)} style={_dateInput} />
            </label>
          </div>
          <window.Btn variant="primary" block onClick={() => { if (valid) { onChange({ preset: 'custom', start: dari, end: sampai }); setOpen(false); } }} style={{ opacity: valid ? 1 : 0.5 }}>Terapkan Rentang Ini</window.Btn>
          {!valid && (dari || sampai) && <div style={{ fontSize: 16, color: 'var(--orange)', marginTop: 10, fontWeight: 600 }}>Pastikan tanggal "sampai" tidak lebih awal dari "dari".</div>}
        </div>
      )}
    </div>
  );
}

// ----- Kartu angka -----
const _ANGKA_META = {
  bersih: { label: 'Pendapatan Bersih', jelas: 'Untung Anda — uang masuk dikurangi uang keluar', jenis: 'green' },
  masuk:  { label: 'Uang Masuk', jelas: 'Semua uang yang Anda terima', jenis: 'in' },
  keluar: { label: 'Uang Keluar', jelas: 'Semua uang yang Anda keluarkan', jenis: 'out' },
  sisa:   { label: 'Sisa Uang', jelas: 'Uang tunai yang Anda punya sekarang', jenis: 'navy' },
};
function _angka(d) { return { bersih: d.masuk - d.keluar, masuk: d.masuk, keluar: d.keluar, sisa: d.sisa }; }

function MoneyKpiCard({ id, nilai, onClick }) {
  const m = _ANGKA_META[id];
  const feat = m.jenis === 'green' || m.jenis === 'navy';
  const bg = m.jenis === 'green' ? 'var(--green)' : m.jenis === 'navy' ? 'var(--navy)' : '#fff';
  const valC = feat ? '#fff' : (m.jenis === 'in' ? 'var(--green)' : 'var(--orange)');
  const subC = feat ? 'rgba(220,232,242,.92)' : 'var(--ink-soft)';
  return (
    <button onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', background: bg, border: '2px solid ' + (feat ? bg : 'var(--mauve)'),
      borderRadius: 18, padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 156 }}>
      <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, color: feat ? '#fff' : 'var(--navy)' }}>{m.label}</div>
      <div style={{ fontSize: 16, color: subC, lineHeight: 1.3, minHeight: 40 }}>{m.jelas}</div>
      <div style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 28, color: valC, lineHeight: 1.05, marginTop: 'auto', letterSpacing: '-.02em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{window.RUPIAH(nilai)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 600, color: subC, marginTop: 4 }}>Lihat rincian <window.LineIcon name="chevron" size={15} sw={2.6} color="currentColor" /></div>
    </button>
  );
}

function MoneyKpiGrid({ data, onDetail, style }) {
  const a = _angka(data);
  return (
    <div className="kpi-grid" style={style}>
      {['bersih', 'masuk', 'keluar', 'sisa'].map(id => <MoneyKpiCard key={id} id={id} nilai={a[id]} onClick={() => onDetail(id)} />)}
    </div>
  );
}

function MoneyKpiDetail({ id, data, onClose }) {
  const m = _ANGKA_META[id];
  const a = _angka(data);
  const nilai = a[id];
  const rp = window.RUPIAH;
  const penjelasan = {
    bersih: 'Inilah keuntungan Anda pada periode ini — uang yang masuk dikurangi semua uang yang keluar.',
    masuk: 'Total semua uang yang Anda terima dari penyewa pada periode ini (pembayaran sewa dan uang muka).',
    keluar: 'Total semua uang yang Anda keluarkan pada periode ini, seperti listrik, gaji penjaga, dan perbaikan.',
    sisa: 'Perkiraan uang tunai yang Anda miliki saat ini. Angka ini tidak ikut berubah saat Anda mengganti filter waktu.',
  };
  const rincian = {
    masuk: [
      { l: 'Pembayaran sewa', v: Math.round(data.masuk * 0.78) },
      { l: 'Uang muka (DP)', v: data.masuk - Math.round(data.masuk * 0.78) },
    ],
    keluar: [
      { l: 'Listrik & air', v: Math.round(data.keluar * 0.3) },
      { l: 'Gaji penjaga', v: Math.round(data.keluar * 0.45) },
      { l: 'Perbaikan', v: data.keluar - Math.round(data.keluar * 0.3) - Math.round(data.keluar * 0.45) },
    ],
  };
  return (
    <window.Dialog open={true}>
      <div style={{ fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16, color: 'var(--ink-soft)' }}>{data.label}</div>
      <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 25, margin: '2px 0 8px' }}>{m.label}</h3>
      <div style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 36, color: m.jenis === 'out' ? 'var(--orange)' : 'var(--green)', letterSpacing: '-.01em', marginBottom: 14 }}>{rp(nilai)}</div>
      <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 18px', lineHeight: 1.45 }}>{penjelasan[id]}</p>

      {id === 'bersih' && (
        <div style={{ background: 'var(--paper)', border: '2px solid var(--mauve-soft)', borderRadius: 14, padding: '6px 16px 14px', marginBottom: 18 }}>
          <window.InfoRow label="Uang masuk" value={'+ ' + rp(data.masuk)} accent="var(--green)" />
          <window.InfoRow label="Uang keluar" value={'− ' + rp(data.keluar)} accent="var(--orange)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12 }}>
            <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19 }}>Pendapatan bersih</span>
            <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 21 }}>{rp(nilai)}</span>
          </div>
        </div>
      )}
      {(id === 'masuk' || id === 'keluar') && data.masuk + data.keluar > 0 && (
        <div style={{ background: 'var(--paper)', border: '2px solid var(--mauve-soft)', borderRadius: 14, padding: '6px 16px 8px', marginBottom: 18 }}>
          {rincian[id].map((row, i) => <window.InfoRow key={i} label={row.l} value={rp(row.v)} />)}
        </div>
      )}

      <window.Btn variant="primary" block onClick={onClose}>Mengerti</window.Btn>
    </window.Dialog>
  );
}

Object.assign(window, { PeriodFilter, resolvePeriode, MoneyKpiGrid, MoneyKpiDetail });
