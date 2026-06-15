// ===== KelolaKos · Layar lain: Laporan, Kwitansi, Layout, Setting =====
const { Btn: B2, Card: C2, ScreenHead: Head2, InfoRow: Row2,
        RUPIAH: RP, RUPIAH_SHORT: RPS, TANGGAL: TGL, TANGGAL_SHORT: TGLS, ROOM_STATUS: RST } = window;

// Baris rincian dengan batang proporsional
function BreakBar({ label, val, max, color }) {
  const pct = max > 0 ? Math.max(4, Math.round((val / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 16.5, marginBottom: 6, gap: 10 }}>
        <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{RP(val)}</span>
      </div>
      <div style={{ height: 12, borderRadius: 999, background: 'var(--mauve-soft)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// =================== LAPORAN ===================
function Laporan({ ctx }) {
  const [periode, setPeriode] = useState({ preset: 'bulan' });
  const [detail, setDetail] = useState(null);
  const data = window.resolvePeriode(periode);
  const net = data.masuk - data.keluar;
  const untung = net >= 0;

  const masukRinci = [
    { l: 'Pembayaran sewa', v: Math.round(data.masuk * 0.78) },
    { l: 'Uang muka (DP)', v: data.masuk - Math.round(data.masuk * 0.78) },
  ];
  const keluarRinci = [
    { l: 'Gaji penjaga', v: Math.round(data.keluar * 0.45) },
    { l: 'Listrik & air', v: Math.round(data.keluar * 0.30) },
    { l: 'Perbaikan & lainnya', v: data.keluar - Math.round(data.keluar * 0.45) - Math.round(data.keluar * 0.30) },
  ];
  const maxMasuk = Math.max(...masukRinci.map(x => x.v), 1);
  const maxKeluar = Math.max(...keluarRinci.map(x => x.v), 1);

  const terisi = window.ROOMS.filter(r => r.status !== 'tersedia').length;
  const totalKamar = window.ROOMS.length;
  const huniPct = Math.round((terisi / totalKamar) * 100);

  const chart = [
    { bln: 'Feb', masuk: 8.2, keluar: 4.1 }, { bln: 'Mar', masuk: 9.5, keluar: 3.8 },
    { bln: 'Apr', masuk: 10.1, keluar: 4.4 }, { bln: 'Mei', masuk: 11.3, keluar: 4.0 },
    { bln: 'Jun', masuk: 12.4, keluar: 4.55 },
  ];
  const maxV = 14;

  return (
    <div>
      <Head2 title="Laporan" sub="Ringkasan keuangan properti Anda" onHelp={() => ctx.openHelp('laporan')} />

      <window.StickyCTA><B2 variant="primary" size="lg" block onClick={() => ctx.toast('Contoh: laporan PDF akan diunduh.')}>
        <window.LineIcon name="unduh" size={22} sw={2.2} color="currentColor" /> Unduh Laporan PDF
      </B2></window.StickyCTA>

      <window.PeriodFilter value={periode} onChange={setPeriode} />

      {/* Insight bahasa sederhana */}
      <div style={{ background: untung ? 'var(--green)' : 'var(--orange)', borderRadius: 18, padding: '22px 22px', marginBottom: 18, color: '#fff' }}>
        <div style={{ fontSize: 16.5, color: untung ? '#C9DAD3' : '#F4D7CC', fontWeight: 600, marginBottom: 4 }}>{data.label} · {untung ? 'Untung Bersih' : 'Rugi Bersih'}</div>
        <div style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 34, letterSpacing: '-.01em', lineHeight: 1.05 }}>{RP(Math.abs(net))}</div>
        <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.45, color: '#fff' }}>
          Anda menerima <b>{RP(data.masuk)}</b> dan mengeluarkan <b>{RP(data.keluar)}</b>{untung ? ', jadi ada keuntungan bersih.' : ', sehingga pengeluaran lebih besar.'}
        </p>
      </div>

      {/* 4 angka */}
      <window.MoneyKpiGrid data={data} onDetail={setDetail} style={{ marginBottom: 26 }} />

      {/* Tren */}
      <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21, margin: '0 0 12px' }}>Tren 5 Bulan Terakhir</h2>
      <C2 style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--green)' }} /> Masuk</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--orange)' }} /> Keluar</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, height: 190 }}>
          {chart.map(d => (
            <div key={d.bln} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 150 }}>
                <div style={{ width: 18, height: (d.masuk / maxV) * 150, background: 'var(--green)', borderRadius: '5px 5px 0 0' }} />
                <div style={{ width: 18, height: (d.keluar / maxV) * 150, background: 'var(--orange)', borderRadius: '5px 5px 0 0' }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-soft)' }}>{d.bln}</span>
            </div>
          ))}
        </div>
      </C2>

      {/* Dari mana uang masuk */}
      <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21, margin: '0 0 12px' }}>Dari Mana Uang Masuk</h2>
      <C2 style={{ marginBottom: 22, padding: '20px 22px 8px' }}>
        {masukRinci.map((x, i) => <BreakBar key={i} label={x.l} val={x.v} max={maxMasuk} color="var(--green)" />)}
      </C2>

      {/* Ke mana uang keluar */}
      <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21, margin: '0 0 12px' }}>Ke Mana Uang Keluar</h2>
      <C2 style={{ marginBottom: 26, padding: '20px 22px 8px' }}>
        {keluarRinci.map((x, i) => <BreakBar key={i} label={x.l} val={x.v} max={maxKeluar} color="var(--orange)" />)}
      </C2>

      {/* Hunian kamar */}
      <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21, margin: '0 0 12px' }}>Hunian Kamar</h2>
      <C2 style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontSize: 17, color: 'var(--ink-soft)', fontWeight: 600 }}>Kamar terisi</span>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22 }}>{terisi} dari {totalKamar}</span>
        </div>
        <div style={{ height: 18, borderRadius: 999, background: 'var(--mauve-soft)', overflow: 'hidden' }}>
          <div style={{ width: huniPct + '%', height: '100%', background: 'var(--navy)', borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 10 }}>{huniPct}% kamar Anda sedang disewa.</div>
      </C2>

      {detail && <window.MoneyKpiDetail id={detail} data={data} onClose={() => setDetail(null)} />}
    </div>
  );
}

// =================== KWITANSI ===================
function Kwitansi({ ctx }) {
  const [sel, setSel] = useState(window.BOOKINGS[0]);
  const sisa = sel.total - sel.dibayar;
  return (
    <div>
      <Head2 title="Kwitansi" sub="Buat bukti pembayaran untuk penyewa" onHelp={() => ctx.openHelp('kwitansi')} />

      {/* Aksi utama menempel di atas — langsung bisa diakses */}
      <window.StickyCTA>
        <B2 variant="primary" size="lg" block onClick={() => ctx.toast('Contoh: kwitansi ' + sel.nama + ' siap dibagikan lewat WhatsApp.')}>
          <window.LineIcon name="kirim" size={22} sw={2.2} color="currentColor" /> Kirim Kwitansi lewat WhatsApp
        </B2>
      </window.StickyCTA>
      <B2 variant="secondary" block onClick={() => ctx.toast('Contoh: kwitansi disimpan sebagai PDF.')} style={{ marginBottom: 26 }}>
        <window.LineIcon name="unduh" size={22} sw={2.2} color="currentColor" /> Simpan sebagai PDF
      </B2>

      <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, marginBottom: 12 }}>Pilih penyewa</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 24, marginInline: -4, paddingInline: 4 }}>
        {window.BOOKINGS.filter(b => b.status === 'Lunas' || b.status === 'DP').map(b => (
          <button key={b.id} onClick={() => setSel(b)} style={{ flexShrink: 0, minHeight: 48, padding: '0 18px', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'var(--body)', fontWeight: 600, fontSize: 17, whiteSpace: 'nowrap',
            border: '2px solid ' + (sel.id === b.id ? 'var(--navy)' : 'var(--mauve)'),
            background: sel.id === b.id ? 'var(--navy)' : '#fff', color: sel.id === b.id ? '#fff' : 'var(--navy)' }}>{b.nama}</button>
        ))}
      </div>

      <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, marginBottom: 12 }}>Pratinjau kwitansi</div>
      {/* Pratinjau kwitansi */}
      <div style={{ background: '#fff', border: '2px solid var(--mauve)', borderRadius: 18, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--mauve)', paddingBottom: 16, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--orange)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22 }}>K</div>
            <div style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 20 }}>KelolaKos</div>
          </div>
          <window.BayarBadge status={sel.status} />
        </div>
        <Row2 label="Nama penyewa" value={sel.nama} />
        <Row2 label="Kamar" value={sel.kamar} />
        <Row2 label="Periode sewa" value={`${TGLS(sel.masuk)} – ${TGLS(sel.keluar)}`} />
        <Row2 label="Total sewa" value={RP(sel.total)} />
        <Row2 label="Sudah dibayar" value={RP(sel.dibayar)} accent="var(--green)" />
        {sisa > 0 && <Row2 label="Sisa tagihan" value={RP(sisa)} accent="var(--orange)" />}

        <div style={{ background: sisa > 0 ? '#FBEFE9' : 'var(--mint-soft)', border: '2px solid ' + (sisa > 0 ? '#E7BCAD' : 'var(--mint)'), borderRadius: 14, padding: '14px 18px', marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18 }}>{sisa > 0 ? 'Masih harus dibayar' : 'Lunas — tidak ada sisa'}</span>
          <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22, color: sisa > 0 ? 'var(--orange)' : 'var(--green)', whiteSpace: 'nowrap' }}>{RP(sisa > 0 ? sisa : sel.total)}</span>
        </div>
      </div>
    </div>
  );
}

// =================== LAYOUT PROPERTI ===================
function LayoutProperti({ ctx }) {
  const gedungs = [...new Set(window.ROOMS.map(r => r.gedung))];
  const hitung = (st) => window.ROOMS.filter(r => r.status === st).length;
  const ringkas = [
    { st: 'terisi', n: hitung('terisi'), l: 'Terisi' },
    { st: 'tersedia', n: hitung('tersedia'), l: 'Kosong' },
    { st: 'perhatian', n: hitung('perhatian'), l: 'Perhatian' },
  ];
  const namaDepan = (p) => p ? p.replace(/^(Pak|Bu|Bpk|Ibu|Mas|Mbak)\s+/i, '').split(' ')[0] : null;

  return (
    <div>
      <Head2 title="Layout Properti" sub="Peta semua kamar dan kondisinya" onHelp={() => ctx.openHelp('layout')} />

      {/* Ringkasan hunian */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 22 }}>
        {ringkas.map(r => {
          const s = RST[r.st];
          return (
            <div key={r.st} style={{ background: s.bg, border: '2px solid ' + s.border, borderRadius: 16, padding: '16px 10px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.dot }} />
                <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 28, color: 'var(--navy)', lineHeight: 1 }}>{r.n}</span>
              </div>
              <div style={{ fontSize: 16, color: 'var(--navy)', fontWeight: 600, marginTop: 7 }}>{r.l}</div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 16.5, color: 'var(--ink-soft)', margin: '0 0 22px' }}>Tekan satu kamar untuk melihat detail penyewa dan status pembayarannya.</p>

      {gedungs.map(g => {
        const lantais = [...new Set(window.ROOMS.filter(r => r.gedung === g).map(r => r.lantai))];
        return (
          <div key={g} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ color: 'var(--navy)', display: 'grid' }}><window.LineIcon name="properti" size={22} sw={2.2} /></span>
              <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21 }}>{g}</div>
            </div>
            {lantais.map(l => (
              <div key={l} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 16, color: 'var(--ink-soft)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>Lantai {l}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {window.ROOMS.filter(r => r.gedung === g && r.lantai === l).map(r => {
                    const s = RST[r.status];
                    const nm = namaDepan(r.penyewa);
                    return (
                      <button key={r.id} onClick={() => ctx.openRoom(r)} style={{ background: s.bg, border: '2px solid ' + s.border, borderRadius: 16, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 96 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22, color: 'var(--navy)' }}>{r.nama}</span>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                        </div>
                        <div style={{ fontSize: 16, color: 'var(--navy)', fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: 16, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nm || 'Siap disewa'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// =================== SETTING ===================
function SettingRow({ item, onClick }) {
  return (
    <C2 onClick={onClick} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--navy)' }}><window.LineIcon name={item.ic} size={25} color="var(--navy)" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18.5 }}>{item.t}</div>
        <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{item.d}</div>
      </div>
      <span style={{ color: 'var(--mauve)', display: 'grid' }}><window.LineIcon name="chevron" size={22} sw={2.4} /></span>
    </C2>
  );
}
function SectionLabel({ children }) {
  return <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 16, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '24px 4px 12px' }}>{children}</div>;
}

function Setting({ ctx }) {
  const bagian = [
    { ic: 'toko', t: 'Profil Bisnis', d: 'Nama kos, alamat, dan kontak yang muncul di kwitansi.', go: () => ctx.toast('Contoh: halaman Profil Bisnis akan terbuka.') },
    { ic: 'kamar', t: 'Kelola Kamar', d: 'Tambah, ubah, atau hapus kamar di properti Anda.', go: () => ctx.go('kamar') },
    { ic: 'harga', t: 'Harga Umum', d: 'Atur harga sewa standar untuk kamar baru.', go: () => ctx.toast('Contoh: halaman Harga Umum akan terbuka.') },
    { ic: 'massal', t: 'Harga Massal', d: 'Ubah harga banyak kamar sekaligus dalam sekali atur.', go: () => ctx.toast('Contoh: halaman Harga Massal akan terbuka.') },
    { ic: 'fasilitas', t: 'Fasilitas', d: 'Daftar fasilitas kamar: AC, kamar mandi dalam, WiFi, dll.', go: () => ctx.toast('Contoh: halaman Fasilitas akan terbuka.') },
  ];

  return (
    <div>
      <Head2 title="Pengaturan" sub="Atur data properti dan akun Anda" onHelp={() => ctx.openHelp('setting')} />

      {/* Profil */}
      <C2 tone="mint" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, marginBottom: 18 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 26, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 21 }}>Bu Endang</div>
          <div style={{ fontSize: 16.5, color: 'var(--ink-soft)' }}>Pemilik · Kos Mawar Melati</div>
        </div>
        <B2 variant="secondary" onClick={() => ctx.toast('Contoh: ubah akun.')} style={{ minHeight: 48, fontSize: 16, padding: '0 18px', flexShrink: 0 }}>Akun</B2>
      </C2>

      {/* Ukuran Teks — kontrol aksesibilitas yang menonjol */}
      <div style={{ background: '#fff', border: '2px solid var(--mauve)', borderRadius: 16, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{ color: 'var(--navy)', display: 'grid', flexShrink: 0 }}><window.LineIcon name="teks" size={26} sw={2.2} /></span>
          <div>
            <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18.5 }}>Ukuran Teks</div>
            <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Perbesar tulisan agar lebih mudah dibaca.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{ v: 'normal', l: 'Normal' }, { v: 'besar', l: 'Besar' }, { v: 'sangat', l: 'Ekstra' }].map(o => {
            const aktif = (ctx.textScale || 'normal') === o.v;
            return (
              <button key={o.v} onClick={() => ctx.setTextScale(o.v)} style={{ flex: 1, minHeight: 56, borderRadius: 12, cursor: 'pointer',
                fontFamily: 'var(--body)', fontWeight: 600, fontSize: o.v === 'normal' ? 16 : o.v === 'besar' ? 18 : 20,
                border: '2px solid ' + (aktif ? 'var(--navy)' : 'var(--mauve)'), background: aktif ? 'var(--navy)' : '#fff', color: aktif ? '#fff' : 'var(--navy)' }}>{o.l}</button>
            );
          })}
        </div>
      </div>

      {/* Petunjuk menenangkan */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff', border: '2px solid var(--mauve)', borderRadius: 16, padding: 18, marginBottom: 22 }}>
        <span style={{ color: 'var(--green)', flexShrink: 0, display: 'grid', marginTop: 1 }}><window.LineIcon name="info" size={26} sw={2} /></span>
        <div>
          <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Ini menu pengaturan lanjutan</div>
          <div style={{ fontSize: 16.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>Tenang, tidak ada yang permanen di sini — semua bisa Anda ubah lagi kapan saja. Kalau ragu, tekan tombol bantuan di pojok atas.</div>
        </div>
      </div>

      {/* 5 bagian */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
        {bagian.map((it, i) => (
          <C2 key={it.t} onClick={it.go} style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--navy)' }}><window.LineIcon name={it.ic} size={26} sw={2.2} color="var(--navy)" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 16, color: 'var(--orange)' }}>{i + 1}</span>
                <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19 }}>{it.t}</span>
              </div>
              <div style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.35 }}>{it.d}</div>
            </div>
            <span style={{ color: 'var(--mauve)', display: 'grid', flexShrink: 0 }}><window.LineIcon name="chevron" size={22} sw={2.4} /></span>
          </C2>
        ))}
      </div>

      {/* Bantuan */}
      <C2 tone="mint" style={{ padding: 20, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--green)' }}><window.LineIcon name="bantuan" size={26} sw={2.2} color="var(--green)" /></div>
          <div>
            <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19 }}>Butuh bantuan mengatur?</div>
            <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Tim kami siap memandu lewat WhatsApp.</div>
          </div>
        </div>
        <B2 variant="success" size="lg" block onClick={() => ctx.toast('Contoh: membuka chat WhatsApp.')}>
          <window.LineIcon name="bantuan" size={22} sw={2.2} color="#fff" /> Chat lewat WhatsApp
        </B2>
      </C2>

      <B2 variant="ghost" block onClick={() => ctx.openLogout()} style={{ color: 'var(--orange)', borderColor: '#E7BCAD' }}>
        <window.LineIcon name="logout" size={20} sw={2.2} color="currentColor" /> Keluar dari Aplikasi
      </B2>
      <div style={{ textAlign: 'center', fontSize: 16, color: 'var(--ink-soft)', margin: '18px 0 4px' }}>KelolaKos · versi 1.0</div>
    </div>
  );
}

Object.assign(window, { Laporan, Kwitansi, LayoutProperti, Setting });
