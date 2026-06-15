// ===== KelolaKos · Alur Booking (tambah, detail, edit, batal) =====
const { Btn: BB, Card: BCard, Sheet: BSheet, Dialog: BDialog, BayarBadge: BBadge,
        InfoRow: BRow, RUPIAH: BRP, TANGGAL: BTGL, TANGGAL_SHORT: BTGLS } = window;

function tambahBulan(iso, n) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return null;
  const r = new Date(d); r.setMonth(r.getMonth() + Number(n || 1)); return r;
}
const HARI_INI = '2026-06-15';
const _inp = { width: '100%', fontFamily: 'var(--body)', fontWeight: 500, fontSize: 20, color: 'var(--navy)', padding: '15px 16px', border: '2px solid var(--mauve)', borderRadius: 12, background: '#fff' };

function Field({ label, children, contoh, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, marginBottom: 8 }}>{label}</label>
      {children}
      {contoh && <div style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 7 }}>{contoh}</div>}
      {hint && (
        <div style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 7, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--green)', flexShrink: 0, display: 'grid', marginTop: 1 }}><window.LineIcon name="bantuan" size={17} sw={2} /></span>
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

// Header langkah bernomor
function StepHead({ step }) {
  const langkah = [{ n: 1, l: 'Data Penyewa' }, { n: 2, l: 'Pilih Kamar' }, { n: 3, l: 'Pembayaran' }];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22 }}>
      {langkah.map((s, i) => {
        const done = step > s.n, active = step === s.n;
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 17,
                background: done ? 'var(--green)' : active ? 'var(--navy)' : 'var(--mauve-soft)',
                color: done || active ? '#fff' : 'var(--ink-soft)' }}>
                {done ? <window.LineIcon name="cek" size={18} sw={2.6} color="#fff" /> : s.n}
              </div>
              <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 16, color: active ? 'var(--navy)' : 'var(--ink-soft)', display: active ? 'block' : 'none' }}>{s.l}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 3, borderRadius: 999, background: done ? 'var(--green)' : 'var(--mauve)', minWidth: 10 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =================== TAMBAH / UBAH BOOKING ===================
function BookingFlow({ open, onClose, onDone, editBooking }) {
  const [step, setStep] = useState(1);
  const [nama, setNama] = useState('');
  const [hp, setHp] = useState('');
  const [kamar, setKamar] = useState(null);
  const [lama, setLama] = useState(1);
  const [masuk, setMasuk] = useState(HARI_INI);
  const [bayar, setBayar] = useState('Lunas');
  const [dp, setDp] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editBooking) {
      setNama(editBooking.nama || ''); setHp(editBooking.hp || '');
      setKamar(window.ROOMS.find(r => r.nama === editBooking.kamar) || null);
      setLama(editBooking.lama || 1); setMasuk(editBooking.masuk || HARI_INI);
      setBayar(editBooking.status === 'Batal' ? 'Lunas' : editBooking.status || 'Lunas');
      setDp(editBooking.status === 'DP' ? String(editBooking.dibayar) : '');
    } else {
      setNama(''); setHp(''); setKamar(null); setLama(1); setMasuk(HARI_INI); setBayar('Lunas'); setDp('');
    }
    setStep(1);
  }, [open, editBooking]);

  // Daftar kamar yang bisa dipilih (yang kosong + kamar saat ini bila sedang edit)
  let pilihan = window.ROOMS.filter(r => r.status === 'tersedia');
  if (editBooking) {
    const cur = window.ROOMS.find(r => r.nama === editBooking.kamar);
    if (cur && !pilihan.some(r => r.id === cur.id)) pilihan = [cur, ...pilihan];
  }

  const total = kamar ? kamar.harga * lama : 0;
  const dibayar = bayar === 'Lunas' ? total : bayar === 'DP' ? Number(dp || 0) : 0;
  const sisa = total - dibayar;
  const keluar = tambahBulan(masuk, lama);

  const bisaLanjut =
    step === 1 ? nama.trim().length > 0 :
    step === 2 ? (!!kamar && lama >= 1 && !!masuk) :
    bayar !== 'DP' || (Number(dp) > 0 && Number(dp) < total);

  const judul = editBooking ? 'Ubah Booking' : 'Booking Baru';

  function simpan() { setStep('sukses'); }

  // ----- Layar sukses -----
  if (step === 'sukses') {
    return (
      <BSheet open={open} onClose={onClose}>
        <div style={{ padding: '28px 22px 30px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--mint-soft)', border: '3px solid var(--mint)', display: 'grid', placeItems: 'center', margin: '6px auto 18px', color: 'var(--green)' }}>
            <window.LineIcon name="cek" size={46} sw={2.4} />
          </div>
          <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 28, margin: '0 0 8px' }}>{editBooking ? 'Perubahan Tersimpan!' : 'Booking Tersimpan!'}</h2>
          <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 22px' }}>Booking untuk <b style={{ color: 'var(--navy)' }}>{nama}</b> berhasil dicatat.</p>
          <BCard tone="mauve" style={{ textAlign: 'left', padding: '6px 18px 12px', marginBottom: 22 }}>
            <BRow label="Penyewa" value={nama} />
            <BRow label="Kamar" value={kamar ? kamar.nama : '—'} />
            <BRow label="Periode" value={`${BTGLS(masuk)} – ${keluar ? BTGLS(keluar) : '—'}`} />
            <BRow label="Total sewa" value={BRP(total)} />
            <BRow label="Status" value={bayar} accent={bayar === 'Lunas' ? 'var(--green)' : bayar === 'Belum Bayar' ? 'var(--orange)' : 'var(--navy)'} />
          </BCard>
          <BB variant="primary" size="lg" block onClick={() => onDone(nama, !!editBooking)}>Selesai</BB>
        </div>
      </BSheet>
    );
  }

  return (
    <BSheet open={open} onClose={onClose}>
      <div style={{ padding: '20px 22px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 24, margin: 0 }}>{judul}</h2>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--mauve)', background: '#fff', color: 'var(--navy)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <StepHead step={step} />

        {/* ---------- LANGKAH 1: DATA PENYEWA ---------- */}
        {step === 1 && (
          <div>
            <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 22, margin: '0 0 18px' }}>1. Siapa penyewanya?</h3>
            <Field label="Nama Lengkap Penyewa" contoh="Contoh: Pak Budi Santoso" hint="Tulis nama lengkap supaya mudah dikenali.">
              <input autoFocus value={nama} onChange={e => setNama(e.target.value)} placeholder="Tulis nama di sini…" style={_inp} />
            </Field>
            <Field label="Nomor HP / WhatsApp" contoh="Contoh: 0812 3456 7890" hint="Dipakai untuk mengirim kwitansi & pengingat bayar (boleh dikosongkan).">
              <input value={hp} onChange={e => setHp(e.target.value)} placeholder="Tulis nomor HP…" inputMode="tel" style={_inp} />
            </Field>
          </div>
        )}

        {/* ---------- LANGKAH 2: PILIH KAMAR ---------- */}
        {step === 2 && (
          <div>
            <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 22, margin: '0 0 18px' }}>2. Pilih kamar &amp; lama sewa</h3>

            <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Kamar yang kosong</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {pilihan.length === 0 && <BCard style={{ padding: 18, color: 'var(--ink-soft)', fontSize: 17 }}>Belum ada kamar kosong saat ini.</BCard>}
              {pilihan.map(r => (
                <button key={r.id} onClick={() => setKamar(r)} style={{ textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 14,
                  border: '2px solid ' + (kamar?.id === r.id ? 'var(--navy)' : 'var(--mauve)'),
                  background: kamar?.id === r.id ? 'var(--mint-soft)' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 20 }}>{r.nama}</div>
                    <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{r.gedung} · {BRP(r.harga)}/bulan</div>
                  </div>
                  {kamar?.id === r.id && <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--green)', color: '#fff', display: 'grid', placeItems: 'center' }}><window.LineIcon name="cek" size={19} sw={2.6} color="#fff" /></span>}
                </button>
              ))}
            </div>

            <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Lama sewa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <button onClick={() => setLama(Math.max(1, lama - 1))} aria-label="Kurangi" style={{ width: 56, height: 56, borderRadius: 14, border: '2px solid var(--navy)', background: '#fff', color: 'var(--navy)', fontSize: 30, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>−</button>
              <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 26 }}>{lama} bulan</div>
              <button onClick={() => setLama(Math.min(24, lama + 1))} aria-label="Tambah" style={{ width: 56, height: 56, borderRadius: 14, border: '2px solid var(--navy)', background: '#fff', color: 'var(--navy)', fontSize: 30, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[1, 3, 6, 12].map(m => (
                <button key={m} onClick={() => setLama(m)} style={{ flex: 1, minHeight: 48, borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--body)', fontWeight: 600, fontSize: 16,
                  border: '2px solid ' + (lama === m ? 'var(--navy)' : 'var(--mauve)'), background: lama === m ? 'var(--navy)' : '#fff', color: lama === m ? '#fff' : 'var(--navy)' }}>{m} bln</button>
              ))}
            </div>

            <Field label="Tanggal Mulai Masuk" hint="Tanggal penyewa mulai menempati kamar.">
              <input type="date" value={masuk} onChange={e => setMasuk(e.target.value)} style={_inp} />
            </Field>

            {/* Harga otomatis */}
            {kamar && (
              <div style={{ background: 'var(--mint-soft)', border: '2px solid var(--mint)', borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 16, color: 'var(--ink-soft)', fontWeight: 600, marginBottom: 6 }}>Perhitungan otomatis</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 17, marginBottom: 6 }}>
                  <span>{BRP(kamar.harga)} × {lama} bulan</span>
                  <span style={{ fontSize: 16, color: 'var(--ink-soft)' }}>sampai {keluar ? BTGLS(keluar) : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px dashed var(--mint)', paddingTop: 10, marginTop: 6 }}>
                  <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19 }}>Total Sewa</span>
                  <span style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 26, color: 'var(--navy)' }}>{BRP(total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- LANGKAH 3: PEMBAYARAN ---------- */}
        {step === 3 && (
          <div>
            <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 22, margin: '0 0 18px' }}>3. Bagaimana pembayarannya?</h3>

            {/* Total besar */}
            <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, color: '#fff' }}>
              <div style={{ fontSize: 16, color: '#C9DAD3', fontWeight: 600 }}>Total yang harus dibayar</div>
              <div style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 34, marginTop: 4, letterSpacing: '-.01em' }}>{BRP(total)}</div>
            </div>

            <div style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Status pembayaran</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {[{ s: 'Lunas', d: 'Penyewa membayar penuh sekarang' }, { s: 'DP', d: 'Membayar sebagian dulu (uang muka)' }, { s: 'Belum Bayar', d: 'Belum membayar, ditagih nanti' }].map(o => (
                <button key={o.s} onClick={() => setBayar(o.s)} style={{ textAlign: 'left', cursor: 'pointer', padding: 16, borderRadius: 14,
                  border: '2px solid ' + (bayar === o.s ? 'var(--navy)' : 'var(--mauve)'), background: bayar === o.s ? 'var(--mint-soft)' : '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ marginBottom: 4 }}><BBadge status={o.s} big /></div>
                    <div style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{o.d}</div>
                  </div>
                  {bayar === o.s && <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'var(--green)', color: '#fff', display: 'grid', placeItems: 'center' }}><window.LineIcon name="cek" size={18} sw={2.6} color="#fff" /></span>}
                </button>
              ))}
            </div>

            {bayar === 'DP' && (
              <Field label="Jumlah dibayar sekarang (DP)" contoh={'Maksimal ' + BRP(total)} hint="Sisanya akan ditagih kemudian.">
                <input value={dp} onChange={e => setDp(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Contoh: 400000" inputMode="numeric" style={_inp} />
              </Field>
            )}

            {/* Ringkasan */}
            <BCard tone="mauve" style={{ padding: '6px 18px 12px' }}>
              <BRow label="Penyewa" value={nama || '—'} />
              <BRow label="Kamar" value={kamar ? kamar.nama : '—'} />
              <BRow label="Periode" value={`${BTGLS(masuk)} – ${keluar ? BTGLS(keluar) : '—'}`} />
              <BRow label="Total sewa" value={BRP(total)} />
              <BRow label="Dibayar sekarang" value={BRP(dibayar)} accent="var(--green)" />
              {sisa > 0 && <BRow label="Sisa tagihan" value={BRP(sisa)} accent="var(--orange)" />}
            </BCard>
          </div>
        )}

        {/* navigasi */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {step > 1 && <BB variant="secondary" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>Kembali</BB>}
          {step < 3 && <BB variant="primary" size="lg" onClick={() => bisaLanjut && setStep(step + 1)} style={{ flex: 2, opacity: bisaLanjut ? 1 : .45 }}>Lanjut</BB>}
          {step === 3 && <BB variant="success" size="lg" onClick={() => bisaLanjut && simpan()} style={{ flex: 2, opacity: bisaLanjut ? 1 : .45 }}><window.LineIcon name="cek" size={22} sw={2.4} color="#fff" /> Simpan Booking</BB>}
        </div>
      </div>
    </BSheet>
  );
}

// =================== DETAIL BOOKING ===================
function BookingDetail({ booking, onClose, onPay, onEdit, onCancel, onDelete }) {
  if (!booking) return null;
  const sisa = booking.total - booking.dibayar;
  const batal = booking.status === 'Batal';
  return (
    <BSheet open={!!booking} onClose={onClose}>
      <div style={{ padding: '20px 22px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 27, margin: 0 }}>{booking.nama}</h2>
            <div style={{ fontSize: 18, color: 'var(--ink-soft)', marginTop: 4 }}>{booking.kamar} · {booking.gedung}</div>
          </div>
          <BBadge status={booking.status} big />
        </div>

        <BCard style={{ marginBottom: 20, padding: '6px 20px 14px' }}>
          {booking.hp && <BRow label="Nomor HP" value={booking.hp} />}
          <BRow label="Tanggal masuk" value={BTGL(booking.masuk)} />
          <BRow label="Tanggal keluar" value={BTGL(booking.keluar)} />
          <BRow label="Total sewa" value={BRP(booking.total)} />
          <BRow label="Sudah dibayar" value={BRP(booking.dibayar)} accent="var(--green)" />
          {sisa > 0 && !batal && <BRow label="Sisa tagihan" value={BRP(sisa)} accent="var(--orange)" />}
        </BCard>

        {batal ? (
          <div>
            <BCard tone="mauve" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, padding: 16 }}>
              <span style={{ color: 'var(--ink-soft)', flexShrink: 0, display: 'grid' }}><window.LineIcon name="refund" size={24} /></span>
              <span style={{ fontSize: 16.5 }}>Booking ini sudah dibatalkan. Kamar sudah kembali tersedia.</span>
            </BCard>
            <BB variant="ghost" block onClick={() => onDelete(booking)} style={{ color: 'var(--orange)', borderColor: '#E7BCAD' }}>
              <window.LineIcon name="hapus" size={20} sw={2.2} color="currentColor" /> Hapus dari Daftar
            </BB>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Aksi utama */}
            {sisa > 0 && (
              <BB variant="success" size="lg" block onClick={() => onPay(booking)}>
                <window.LineIcon name="cek" size={22} sw={2.4} color="#fff" /> Catat Pembayaran
              </BB>
            )}
            {/* Ubah & Batal sejajar */}
            <div style={{ display: 'flex', gap: 12 }}>
              <BB variant="secondary" block onClick={() => onEdit(booking)}>Ubah Booking</BB>
              <BB variant="secondary" block onClick={() => onCancel(booking)} style={{ color: 'var(--orange)', borderColor: '#E7BCAD' }}>Batal / Refund</BB>
            </div>
            {/* Hapus */}
            <BB variant="ghost" block onClick={() => onDelete(booking)} style={{ color: 'var(--ink-soft)' }}>
              <window.LineIcon name="hapus" size={20} sw={2.2} color="currentColor" /> Hapus Booking
            </BB>
          </div>
        )}
      </div>
    </BSheet>
  );
}

// =================== KONFIRMASI BATAL / REFUND ===================
function CancelConfirm({ target, onClose, onConfirm }) {
  return (
    <BDialog open={!!target}>
      {target && (<>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--navy)' }}><window.LineIcon name="refund" size={28} sw={2.2} /></div>
        <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 24, margin: '0 0 10px' }}>Batalkan booking {target.nama}?</h3>
        <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 8px', lineHeight: 1.45 }}>Tenang, ini tidak menghapus data. Kamar <b style={{ color: 'var(--navy)' }}>{target.kamar}</b> akan kembali tersedia untuk disewakan.</p>
        {target.dibayar > 0 && (
          <div style={{ background: 'var(--mint-soft)', border: '2px solid var(--mint)', borderRadius: 12, padding: '12px 16px', fontSize: 16.5, marginBottom: 8 }}>
            Penyewa sudah membayar <b>{BRP(target.dibayar)}</b>. Uang ini bisa Anda kembalikan (refund) sebagai catatan.
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <BB variant="secondary" block onClick={onClose}>Tidak Jadi</BB>
          <BB variant="primary" block onClick={onConfirm}>Ya, Batalkan</BB>
        </div>
      </>)}
    </BDialog>
  );
}

Object.assign(window, { BookingFlow, BookingDetail, CancelConfirm, BookingField: Field });
