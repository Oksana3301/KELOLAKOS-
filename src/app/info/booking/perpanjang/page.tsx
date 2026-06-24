'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookingShell, BookingDone, THCard, THBtn, THField, THInput, THSelect, SectionTitle } from '@/components/info/booking-shell';
import { FasilitasEstimasi } from '@/components/info/fasilitas-estimasi';
import { PostFormActions } from '@/components/info/post-form-actions';
import { TH, TH_SERIF, isValidWa, normWa } from '@/lib/tophills-theme';
import { lookupPenyewa, DEMO_HINT } from '@/lib/perpanjang-demo';
import { submitBookingRequest } from '@/lib/booking-request';
import { halamanInfoApi } from '@/lib/api-v2';
import { DEFAULT_INFO, mergeInfo } from '@/lib/halaman-info';
import { fetchFasilitas, parseRupiah, formatRupiah, isExtraBed, kostBasePrice } from '@/lib/booking-pricing';
import { api, type PenyewaLookup } from '@/lib/api';

type Step = 'input' | 'pilih' | 'form';

function tglPanjang(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
function dayAfter(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PerpanjangPage() {
  const [step, setStep] = useState<Step>('input');
  const [wa, setWa] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [kamarPilih, setKamarPilih] = useState('');
  const [waErr, setWaErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PenyewaLookup[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [demo, setDemo] = useState(false);
  const [sel, setSel] = useState<PenyewaLookup | null>(null);

  // Form perpanjangan
  const [durasi, setDurasi] = useState('');
  const [tglMulai, setTglMulai] = useState('');
  const [bayar, setBayar] = useState<'DP' | 'Full'>('Full');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitDemo, setSubmitDemo] = useState(false);
  const [selFac, setSelFac] = useState<string[]>([]);
  const [extraBedQty, setExtraBedQty] = useState(0);
  const [orang, setOrang] = useState(1);

  const { data: rooms } = useQuery({ queryKey: ['public-rooms'], queryFn: api.getPublicRooms, retry: 0, staleTime: 60_000 });
  const { data: infoRaw } = useQuery({ queryKey: ['halaman-info'], queryFn: halamanInfoApi.get, retry: 0, staleTime: 60_000 });
  const { data: fasData } = useQuery({ queryKey: ['public-fasilitas'], queryFn: fetchFasilitas, retry: 0, staleTime: 60_000 });
  const info = mergeInfo(infoRaw || DEFAULT_INFO);
  const fasilitas = fasData?.list || [];
  const kamarTerisi = useMemo(() => {
    const arr = Array.isArray(rooms) ? rooms : [];
    const terisi = arr.filter((r) => r.status === 'terisi');
    return terisi.length ? terisi : arr; // fallback: kalau status belum rapi, tampilkan semua
  }, [rooms]);

  async function cari() {
    setWaErr('');
    if (!kamarPilih && !bookingId.trim() && !isValidWa(wa)) {
      setWaErr('Isi salah satu: nomor WA, ID booking, atau pilih nomor kamar.');
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await lookupPenyewa(kamarPilih ? { room: kamarPilih } : bookingId.trim() ? { bookingId } : { wa });
      setDemo(res.demo);
      const active = res.rows.filter((r) => !['BATAL', 'CANCELLED', 'DITOLAK', 'REJECTED'].includes(String(r.status || '').toUpperCase()));
      setRows(active);
      if (active.length === 0) {
        setNotFound(true);
      } else if (active.length === 1) {
        choose(active[0]);
      } else {
        setStep('pilih');
      }
    } finally {
      setLoading(false);
    }
  }

  function choose(p: PenyewaLookup) {
    setSel(p);
    setDurasi(String(p.layanan).toUpperCase() === 'KOS' ? '6 Bulan' : 'Per Malam');
    setTglMulai(dayAfter(p.tglAkhirKontrak));
    setStep('form');
  }

  const isKost = String(sel?.layanan).toUpperCase() === 'KOS';

  const base = useMemo(() => {
    if (!sel) return { price: 0, label: 'Perpanjangan' };
    const room = (Array.isArray(rooms) ? rooms : []).find((r) => sel.kamar.toLowerCase().startsWith(r.nama.toLowerCase()));
    const parts = sel.kamar.split('—');
    const roomLike = room || { nama: parts[0]?.trim(), gedung: parts[1]?.trim() };
    if (isKost) return kostBasePrice(info, durasi, roomLike);
    const tipe = info.penginapan.find((p) => { const pn = p.nama.toLowerCase(); const rt = (sel.tipe || '').toLowerCase(); return rt && (rt.includes(pn) || pn.includes(rt)); });
    return { price: tipe ? parseRupiah(tipe.malam) : room?.harga || 0, label: 'Per malam' };
  }, [sel, rooms, isKost, durasi, info]);

  const addonTotal = useMemo(() => {
    const eb = fasilitas.find(isExtraBed);
    return selFac.reduce((s, id) => { const f = fasilitas.find((x) => x.id === id); return s + (f ? Number(f.price_adjust) || 0 : 0); }, 0)
      + (eb ? extraBedQty * (Number(eb.price_adjust) || 0) : 0);
  }, [selFac, extraBedQty, fasilitas]);

  const maxOrang = isKost ? info.kostMaxOrang || 2 : info.penginapanMaxOrang || 3;
  const extraOrang = useMemo(() => {
    if (!sel) return 0;
    if (isKost) return Math.max(0, orang - 1) * (info.kostExtraPerOrang || 0);
    const extra = Math.max(0, orang - (info.penginapanBaseOrang || 1));
    if (!extra) return 0;
    const tipe = info.penginapan.find((p) => { const pn = p.nama.toLowerCase(); const rt = (sel.tipe || '').toLowerCase(); return rt && (rt.includes(pn) || pn.includes(rt)); });
    return extra * (tipe?.extraPerOrang || 0);
  }, [sel, isKost, orang, info]);

  function toggleFac(id: string) { setSelFac((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }

  async function kirim() {
    if (!sel) return;
    const facNames = fasilitas.filter((f) => selFac.includes(f.id) && !isExtraBed(f)).map((f) => f.nama);
    const catat = [
      `Perpanjangan dari ${sel.bookingId}`,
      orang > 1 ? `${orang} orang` : '',
      facNames.length ? 'Fasilitas: ' + facNames.join(', ') : '',
      extraBedQty > 0 ? `Extra bed x${extraBedQty}` : '',
      base.price > 0 ? `Estimasi: ${formatRupiah(base.price + addonTotal + extraOrang)}` : '',
    ].filter(Boolean).join(' — ');
    setSubmitting(true);
    const res = await submitBookingRequest({
      jenis: 'perpanjang', nama: sel.nama, whatsapp: normWa(sel.whatsapp), layanan: sel.layanan, kamar: sel.kamar,
      durasi, tglMulai, bayar, catatan: catat, tagPerpanjangan: sel.bookingId, jumlahOrang: orang,
    });
    setSubmitting(false);
    setSubmitDemo(res.demo);
    setDone(true);
  }

  if (done) {
    return (
      <BookingShell back={{ href: '/info', label: 'Beranda' }}>
        <BookingDone nama={sel?.nama} demo={submitDemo} />
      </BookingShell>
    );
  }

  return (
    <BookingShell back={{ href: '/info/booking', label: 'Pilihan' }}>
      <SectionTitle sub="Masukkan nomor WA-mu, data kontrak lama kami tarik otomatis.">Perpanjang Kontrak</SectionTitle>

      {/* STEP 1 — input */}
      {step === 'input' && (
        <THCard className="space-y-4">
          <THField label="Nomor WhatsApp penyewa lama" hint="Yang dipakai saat booking sebelumnya" error={waErr || undefined}>
            <THInput inputMode="numeric" placeholder="Contoh: 6281234567890" value={wa} onChange={(e) => setWa(e.target.value)} />
          </THField>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: TH.border }} />
            <span className="text-[12px]" style={{ color: TH.brownSoft }}>atau</span>
            <div className="flex-1 h-px" style={{ background: TH.border }} />
          </div>
          <THField label="ID Booking lama (opsional)" hint="Contoh: TH-2026-0148">
            <THInput placeholder="TH-2026-XXXX" value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
          </THField>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: TH.border }} />
            <span className="text-[12px]" style={{ color: TH.brownSoft }}>atau lupa keduanya?</span>
            <div className="flex-1 h-px" style={{ background: TH.border }} />
          </div>
          <THField label="Pilih nomor kamar (yang masih kamu tempati)" hint={!rooms ? 'Memuat data kamar…' : kamarTerisi.length === 0 ? 'Belum ada data kamar' : 'Khusus penyewa yang kontraknya masih berjalan'}>
            <THSelect value={kamarPilih} onChange={(e) => setKamarPilih(e.target.value)}>
              <option value="">— pilih kamar —</option>
              {kamarTerisi.map((r) => (
                <option key={`${r.nama}-${r.gedung}`} value={`${r.nama} — ${r.gedung}`}>
                  {r.nama} — {r.gedung}{r.tipe ? ` (${r.tipe})` : ''}
                </option>
              ))}
            </THSelect>
          </THField>
          <THBtn variant="gold" block onClick={cari} disabled={loading}>
            {loading ? 'Mencari…' : '🔎 Cari Data Saya'}
          </THBtn>
          <p className="text-[11.5px] text-center" style={{ color: TH.brownSoft }}>Coba demo: {DEMO_HINT}</p>

          {notFound && (
            <div className="rounded-[14px] p-5 text-center" style={{ background: TH.cream, border: `1px dashed ${TH.goldSoft}` }}>
              <div className="text-[34px]">🔍</div>
              <div className="text-[15px] font-bold mt-1" style={{ color: TH.brown }}>Belum pernah booking di Top Hills</div>
              <div className="text-[13px] mt-1 mb-4" style={{ color: TH.brownSoft }}>Nomor / ID ini tidak ditemukan di data kami.</div>
              <THBtn variant="primary" href="/info/booking/baru">🆕 Booking Kamar Baru</THBtn>
            </div>
          )}
        </THCard>
      )}

      {/* STEP 2 — pilih (jika >1) */}
      {step === 'pilih' && (
        <div className="space-y-3">
          {demo && <DemoBadge />}
          <p className="text-[14px]" style={{ color: TH.brown }}>Ada <b>{rows.length}</b> kontrak atas nomor ini. Pilih yang mau diperpanjang:</p>
          {rows.map((p) => (
            <button key={p.bookingId} onClick={() => choose(p)} className="block w-full text-left rounded-[16px] p-4" style={{ background: TH.card, border: `1.5px solid ${TH.border}` }}>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="text-[16px] font-bold" style={{ color: TH.brown }}>{p.kamar}</div>
                  <div className="text-[13px] mt-0.5" style={{ color: TH.brownSoft }}>{p.tipe} · {p.durasiTerakhir} · {p.layanan === 'KOS' ? 'Kost' : 'Penginapan'}</div>
                  <div className="text-[12.5px] mt-1" style={{ color: TH.brownSoft }}>Kontrak berakhir: {tglPanjang(p.tglAkhirKontrak)}</div>
                </div>
                <span className="text-[14px] font-bold" style={{ color: TH.gold }}>Pilih ›</span>
              </div>
            </button>
          ))}
          <THBtn variant="ghost" block onClick={() => setStep('input')}>‹ Kembali</THBtn>
        </div>
      )}

      {/* STEP 3 — konfirmasi + form */}
      {step === 'form' && sel && (
        <div className="space-y-4">
          {demo && <DemoBadge />}
          {/* Kartu konfirmasi */}
          <div className="rounded-[18px] p-5" style={{ background: TH.greenSoft, border: `1px solid #BFE0CD` }}>
            <div className="text-[13px] font-bold" style={{ color: TH.green }}>DATA DITEMUKAN ✓</div>
            <div className="mt-2 text-[16px]" style={{ color: TH.brown }}>
              Halo <b style={{ fontFamily: TH_SERIF }}>{sel.nama}</b>, kamar <b>{sel.kamar}</b> (tipe {sel.tipe}), benar?
            </div>
            <div className="text-[12.5px] mt-1.5" style={{ color: TH.brownSoft }}>
              {sel.layanan === 'KOS' ? 'Kost' : 'Penginapan'} · kontrak lama berakhir {tglPanjang(sel.tglAkhirKontrak)} · ID {sel.bookingId}
            </div>
            <div className="mt-3">
              <button onClick={() => { setStep(rows.length > 1 ? 'pilih' : 'input'); }} className="text-[13px] font-semibold underline" style={{ color: TH.brownSoft }}>Bukan saya / pilih lain</button>
            </div>
          </div>

          <THCard className="space-y-4">
            <THField label="Durasi perpanjangan">
              <THSelect value={durasi} onChange={(e) => setDurasi(e.target.value)}>
                {(isKost ? ['6 Bulan', '1 Tahun'] : ['Per Malam']).map((d) => <option key={d} value={d}>{d}</option>)}
              </THSelect>
            </THField>
            <THField label="Tanggal mulai perpanjangan" hint="Default: sehari setelah kontrak lama berakhir">
              <THInput type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} />
            </THField>

            <THField label="Jumlah orang" hint={isKost ? `Maks ${maxOrang} orang. Orang ke-2 +${formatRupiah(info.kostExtraPerOrang || 0)}` : `Maks ${maxOrang} per kamar`}>
              <THInput type="number" min={1} max={maxOrang} value={orang}
                onChange={(e) => setOrang(Math.max(1, Math.min(maxOrang, Number(e.target.value) || 1)))} />
            </THField>

            <FasilitasEstimasi
              fasilitas={fasilitas} demo={fasData?.demo}
              selectedIds={selFac} onToggle={toggleFac}
              extraBedQty={extraBedQty} onExtraBed={setExtraBedQty}
              basePrice={base.price} baseLabel={base.label}
              orang={orang} extraOrangCharge={extraOrang}
            />

            <THField label="Pembayaran">
              <div className="grid grid-cols-2 gap-2">
                {(['DP', 'Full'] as const).map((b) => (
                  <button key={b} onClick={() => setBayar(b)} className="min-h-[48px] rounded-[12px] font-bold text-[14px]"
                    style={bayar === b ? { background: TH.gold, color: '#FBF7EC', border: `1px solid ${TH.gold}` } : { background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                    {b === 'DP' ? 'Bayar DP dulu' : 'Bayar Lunas'}
                  </button>
                ))}
              </div>
            </THField>
          </THCard>

          <PostFormActions
            nama={sel.nama}
            ringkas={`${sel.kamar}${durasi ? ' · ' + durasi : ''}${orang > 1 ? ' · ' + orang + ' org' : ''}${base.price > 0 ? ' · est ' + formatRupiah(base.price + addonTotal + extraOrang) : ''}`}
            onLanjut={kirim}
            submitting={submitting}
          />
        </div>
      )}
    </BookingShell>
  );
}

function DemoBadge() {
  return (
    <div className="text-[11.5px] rounded-full px-3 py-1.5 inline-block" style={{ background: '#FBF1D8', color: '#8A6A24', border: '1px solid #E7D3A0' }}>
      ⚙️ Data contoh (backend lookup belum di-deploy)
    </div>
  );
}
