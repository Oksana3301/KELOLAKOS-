// ===== KelolaKos · Kelola Kamar (data master: tambah / ubah / hapus) =====
const { Btn: RB, Card: RCard, ScreenHead: RHead, Sheet: RSheet, Dialog: RDialog,
        InfoRow: RRow, RUPIAH: RRP, ROOM_STATUS: RRST } = window;

const _rinp = { width: '100%', fontFamily: 'var(--body)', fontWeight: 500, fontSize: 20, color: 'var(--navy)', padding: '15px 16px', border: '2px solid var(--mauve)', borderRadius: 12, background: '#fff' };

// =================== LAYAR KELOLA KAMAR ===================
function Kamar({ ctx }) {
  const [rooms, setRooms] = useState(() => window.ROOMS.map(r => ({ ...r })));
  const [form, setForm] = useState(null);        // {mode:'tambah'|'ubah', room}
  const [detail, setDetail] = useState(null);    // kamar yang dibuka
  const [hapus, setHapus] = useState(null);

  const gedungs = [...new Set(rooms.map(r => r.gedung))];

  function simpan(data) {
    if (data._id) {
      setRooms(prev => prev.map(r => r.id === data._id ? { ...r, ...data, id: data.id, nama: data.nama } : r));
      ctx.toast('✓ ' + data.nama + ' berhasil diubah');
    } else {
      setRooms(prev => [...prev, { ...data, status: 'tersedia', penyewa: null, bayar: null }]);
      ctx.toast('✓ ' + data.nama + ' berhasil ditambah');
    }
    setForm(null);
  }
  function hapusKamar(r) {
    setRooms(prev => prev.filter(x => x.id !== r.id));
    setHapus(null); setDetail(null);
    ctx.toast(r.nama + ' telah dihapus');
  }

  return (
    <div>
      <RHead title="Kelola Kamar" sub={rooms.length + ' kamar di ' + gedungs.length + ' gedung'} onHelp={() => ctx.openHelp('kamar')} />

      {/* Tambah Kamar — pola sama seperti Booking */}
      <window.StickyCTA>
        <RB variant="primary" size="lg" block onClick={() => setForm({ mode: 'tambah' })}>＋ Tambah Kamar Baru</RB>
      </window.StickyCTA>

      <p style={{ fontSize: 16.5, color: 'var(--ink-soft)', margin: '0 0 20px' }}>Tekan satu kamar untuk <b style={{ color: 'var(--navy)' }}>ubah</b> atau <b style={{ color: 'var(--navy)' }}>hapus</b>.</p>

      {gedungs.map(g => (
        <div key={g} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ color: 'var(--navy)', display: 'grid' }}><window.LineIcon name="properti" size={22} sw={2.2} /></span>
            <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21 }}>{g}</div>
            <span style={{ fontSize: 16, color: 'var(--ink-soft)', fontWeight: 600 }}>· {rooms.filter(r => r.gedung === g).length} kamar</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rooms.filter(r => r.gedung === g).map(r => {
              const s = RRST[r.status];
              return (
                <RCard key={r.id} onClick={() => setDetail(r)} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 13, flexShrink: 0, background: s.bg, border: '2px solid ' + s.border, display: 'grid', placeItems: 'center', color: 'var(--navy)' }}>
                    <window.LineIcon name="kamar" size={24} sw={2.2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19 }}>{r.nama}</div>
                    <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Lantai {r.lantai} · {RRP(r.harga)}/bulan</div>
                  </div>
                  <span style={{ color: 'var(--mauve)', display: 'grid', flexShrink: 0 }}><window.LineIcon name="chevron" size={22} sw={2.4} /></span>
                </RCard>
              );
            })}
          </div>
        </div>
      ))}

      <KamarDetail room={detail} onClose={() => setDetail(null)} onEdit={(r) => { setDetail(null); setForm({ mode: 'ubah', room: r }); }} onDelete={(r) => setHapus(r)} />
      <KamarForm form={form} gedungs={gedungs} onClose={() => setForm(null)} onSave={simpan} />
      <HapusKamar target={hapus} onClose={() => setHapus(null)} onConfirm={() => hapusKamar(hapus)} />
    </div>
  );
}

// =================== DETAIL KAMAR (aksi) ===================
function KamarDetail({ room, onClose, onEdit, onDelete }) {
  if (!room) return null;
  const s = RRST[room.status];
  return (
    <RSheet open={!!room} onClose={onClose} maxH="80%">
      <div style={{ padding: '20px 22px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 27, margin: 0 }}>{room.nama}</h2>
            <div style={{ fontSize: 18, color: 'var(--ink-soft)', marginTop: 4 }}>{room.gedung}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: s.bg, border: '2px solid ' + s.border, color: 'var(--navy)', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16, padding: '6px 13px', borderRadius: 999 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot }} />{s.label}
          </span>
        </div>

        <RCard style={{ marginBottom: 20, padding: '6px 20px 14px' }}>
          <RRow label="Gedung" value={room.gedung} />
          <RRow label="Lantai" value={String(room.lantai)} />
          <RRow label="Harga sewa" value={RRP(room.harga) + ' / bulan'} />
          <RRow label="Penyewa" value={room.penyewa || 'Belum ada'} />
        </RCard>

        {room.status !== 'tersedia' && (
          <RCard tone="mint" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, padding: 14 }}>
            <span style={{ color: 'var(--navy)', flexShrink: 0, display: 'grid' }}><window.LineIcon name="info" size={22} /></span>
            <span style={{ fontSize: 16 }}>Kamar ini sedang terisi. Sebaiknya jangan dihapus selama masih ada penyewa.</span>
          </RCard>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <RB variant="secondary" block onClick={() => onEdit(room)}>
            <window.LineIcon name="teks" size={20} sw={2.2} color="currentColor" /> Ubah Kamar
          </RB>
          <RB variant="secondary" block onClick={() => onDelete(room)} style={{ color: 'var(--orange)', borderColor: '#E7BCAD' }}>
            <window.LineIcon name="hapus" size={20} sw={2.2} color="currentColor" /> Hapus Kamar
          </RB>
        </div>
      </div>
    </RSheet>
  );
}

// =================== FORM TAMBAH / UBAH KAMAR ===================
function KamarForm({ form, gedungs, onClose, onSave }) {
  const ubah = form && form.mode === 'ubah';
  const [nomor, setNomor] = useState('');
  const [gedung, setGedung] = useState(gedungs[0] || '');
  const [lantai, setLantai] = useState(1);
  const [harga, setHarga] = useState('');

  useEffect(() => {
    if (!form) return;
    if (ubah) {
      const r = form.room;
      setNomor(r.nama.replace(/^Kamar\s+/i, '')); setGedung(r.gedung); setLantai(r.lantai); setHarga(String(r.harga));
    } else {
      setNomor(''); setGedung(gedungs[0] || ''); setLantai(1); setHarga('');
    }
  }, [form]);

  if (!form) return null;
  const valid = nomor.trim().length > 0 && Number(harga) > 0 && gedung;

  function simpan() {
    const nama = 'Kamar ' + nomor.trim().toUpperCase();
    onSave({
      _id: ubah ? form.room.id : null,
      id: nomor.trim().toUpperCase(), nama, gedung, lantai: Number(lantai), harga: Number(harga),
    });
  }

  return (
    <RSheet open={!!form} onClose={onClose}>
      <div style={{ padding: '20px 22px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 24, margin: 0 }}>{ubah ? 'Ubah Kamar' : 'Tambah Kamar Baru'}</h2>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--mauve)', background: '#fff', color: 'var(--navy)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <window.BookingField label="Nomor Kamar" contoh="Contoh: A7 atau B3" hint="Boleh huruf dan angka, singkat saja.">
          <input autoFocus value={nomor} onChange={e => setNomor(e.target.value)} placeholder="Tulis nomor kamar…" style={_rinp} />
        </window.BookingField>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>Gedung</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {gedungs.map(g => (
              <button key={g} onClick={() => setGedung(g)} style={{ minHeight: 48, padding: '0 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16.5,
                border: '2px solid ' + (gedung === g ? 'var(--navy)' : 'var(--mauve)'), background: gedung === g ? 'var(--navy)' : '#fff', color: gedung === g ? '#fff' : 'var(--navy)' }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>Lantai</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setLantai(Math.max(1, lantai - 1))} aria-label="Kurangi" style={{ width: 54, height: 54, borderRadius: 14, border: '2px solid var(--navy)', background: '#fff', color: 'var(--navy)', fontSize: 28, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>−</button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 24 }}>Lantai {lantai}</div>
            <button onClick={() => setLantai(Math.min(5, lantai + 1))} aria-label="Tambah" style={{ width: 54, height: 54, borderRadius: 14, border: '2px solid var(--navy)', background: '#fff', color: 'var(--navy)', fontSize: 28, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>+</button>
          </div>
        </div>

        <window.BookingField label="Harga Sewa per Bulan" contoh="Contoh: 850000" hint="Tulis angka saja, tanpa titik atau Rp.">
          <input value={harga} onChange={e => setHarga(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" style={_rinp} />
        </window.BookingField>

        {Number(harga) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--mint-soft)', border: '2px solid var(--mint)', borderRadius: 14, padding: '14px 18px', marginBottom: 22 }}>
            <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18 }}>Harga sewa</span>
            <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22, color: 'var(--navy)' }}>{RRP(Number(harga))}/bln</span>
          </div>
        )}

        <RB variant="success" size="lg" block onClick={() => valid && simpan()} style={{ opacity: valid ? 1 : .45 }}>
          <window.LineIcon name="cek" size={22} sw={2.4} color="#fff" /> {ubah ? 'Simpan Perubahan' : 'Simpan Kamar'}
        </RB>
      </div>
    </RSheet>
  );
}

// =================== KONFIRMASI HAPUS KAMAR ===================
function HapusKamar({ target, onClose, onConfirm }) {
  return (
    <RDialog open={!!target}>
      {target && (<>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--navy)' }}><window.LineIcon name="hapus" size={28} sw={2.2} /></div>
        <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 24, margin: '0 0 10px' }}>Hapus {target.nama}?</h3>
        <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 18px', lineHeight: 1.45 }}>
          {target.status !== 'tersedia'
            ? <>Kamar ini sedang ditempati <b style={{ color: 'var(--navy)' }}>{target.penyewa}</b>. Tenang, data penyewa tidak ikut terhapus.</>
            : <>Tenang, kamar lain tidak terpengaruh. Anda bisa menambah kamar baru kapan saja.</>}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <RB variant="secondary" block onClick={onClose}>Tidak Jadi</RB>
          <RB variant="primary" block onClick={onConfirm}>Ya, Hapus</RB>
        </div>
      </>)}
    </RDialog>
  );
}

Object.assign(window, { Kamar });
