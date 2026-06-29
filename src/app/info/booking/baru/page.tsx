'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type PublicRoom, type BuktiFile } from '@/lib/api';
import { halamanInfoApi } from '@/lib/api-v2';
import { DEFAULT_INFO, mergeInfo } from '@/lib/halaman-info';
import { BookingShell, BookingDone, THCard, THField, THInput, THSelect, RupiahInput, SectionTitle } from '@/components/info/booking-shell';
import { FasilitasEstimasi } from '@/components/info/fasilitas-estimasi';
import { PostFormActions } from '@/components/info/post-form-actions';
import { PaymentStep } from '@/components/info/payment-step';
import { TH, isValidWa, normWa } from '@/lib/tophills-theme';
import { submitBookingRequest } from '@/lib/booking-request';
import { fetchFasilitas, parseRupiah, formatRupiah, isExtraBed, isAcFacility, kostBasePrice } from '@/lib/booking-pricing';
import { hasRangeData, rangeStatusOf, statusTodayOf, addDaysISO } from '@/lib/availability';

const numOf = (s?: string) => { const m = String(s || '').match(/\d+/); return m ? Number(m[0]) : 9999; };
function fmtTgl(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BookingBaruPage() {
  const [nama, setNama] = useState('');
  const [wa, setWa] = useState('');
  const [waErr, setWaErr] = useState('');
  const [layanan, setLayanan] = useState<'KOS' | 'PENGINAPAN'>('KOS');
  const [kamar, setKamar] = useState('');
  const [durasi, setDurasi] = useState('6 Bulan');
  const [malamQty, setMalamQty] = useState(1);
  const [mulai, setMulai] = useState(new Date().toISOString().slice(0, 10));
  const [bayar, setBayar] = useState<'DP' | 'Full'>('DP');
  const [dpAmount, setDpAmount] = useState(0);
  const [catatan, setCatatan] = useState('');
  const [selFac, setSelFac] = useState<string[]>([]);
  const [extraBedQty, setExtraBedQty] = useState(0);
  const [orang, setOrang] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [payStep, setPayStep] = useState(false);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState(false);

  const { data: rooms } = useQuery({ queryKey: ['public-rooms'], queryFn: api.getPublicRooms, retry: 0, staleTime: 60_000 });
  const { data: infoRaw } = useQuery({ queryKey: ['halaman-info'], queryFn: halamanInfoApi.get, retry: 0, staleTime: 60_000 });
  const { data: fasData } = useQuery({ queryKey: ['public-fasilitas'], queryFn: fetchFasilitas, retry: 0, staleTime: 60_000 });
  const info = mergeInfo(infoRaw || DEFAULT_INFO);
  const isKost = layanan === 'KOS';
  const acDisabled = isKost && durasi === '6 Bulan';
  const kostLockTanggal = isKost && info.kostKunciTanggal !== false;
  const allFasilitas = fasData?.list || [];
  const fasilitas = acDisabled ? allFasilitas.filter((f) => !isAcFacility(f)) : allFasilitas;
  useEffect(() => {
    if (!acDisabled) return;
    setSelFac((prev) => prev.filter((id) => { const f = allFasilitas.find((x) => x.id === id); return !(f && isAcFacility(f)); }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acDisabled]);

  const durasiOpts = isKost ? ['6 Bulan', '1 Tahun'] : ['Per Malam', 'Mingguan', 'Bulanan'];

  // ── Tanggal & rentang menginap (penginapan) untuk cek ketersediaan ──
  const nights = !isKost ? (durasi === 'Per Malam' ? Math.max(1, malamQty) : durasi === 'Mingguan' ? 7 : 30) : 0;
  const checkOut = !isKost && mulai && nights > 0 ? addDaysISO(mulai, nights) : '';
  const rangeReady = !isKost && !!mulai && !!checkOut && mulai < checkOut;

  // ── Klasifikasi ketersediaan kamar untuk tanggal yang diminta ──
  const isPenginapan = (r: PublicRoom) => {
    const g = String(r.gedung || '').toUpperCase();
    const lay = String(r.layanan || '').toUpperCase();
    if (lay.includes('PENGINAP') || lay.includes('INAP')) return true;
    if (lay.includes('KOS')) return false;
    return g.includes('C') || g.includes('PENGINAPAN') || /\bD0?\d+/i.test(String(r.nama || ''));
  };

  const { kosongRooms, dpRooms } = useMemo(() => {
    const arr = Array.isArray(rooms) ? rooms : [];
    const rangeOk = hasRangeData(arr);
    const matched = arr.filter((r) => (isKost ? !isPenginapan(r) : isPenginapan(r)));
    const stOf = (r: PublicRoom) =>
      isKost ? statusTodayOf(r) : (rangeReady && rangeOk ? rangeStatusOf(r, mulai, checkOut) : statusTodayOf(r));
    const sorter = (a: PublicRoom, b: PublicRoom) => (numOf(a.nama) - numOf(b.nama)) || String(a.nama).localeCompare(String(b.nama));
    const kosongRooms = matched.filter((r) => stOf(r) === 'kosong').sort(sorter);
    const dpRooms = matched.filter((r) => stOf(r) === 'dp').sort(sorter);
    return { kosongRooms, dpRooms };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, isKost, mulai, checkOut, rangeReady]);

  // Kamar terpilih jadi tak tersedia → kosongkan.
  useEffect(() => {
    if (kamar && !kosongRooms.some((r) => `${r.nama} — ${r.gedung}` === kamar)) setKamar('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kosongRooms]);

  const selRoom = kosongRooms.find((r) => `${r.nama} — ${r.gedung}` === kamar);

  const base = useMemo(() => {
    if (isKost) return kostBasePrice(info, durasi, selRoom);
    const tipe = info.penginapan.find((p) => {
      const pn = p.nama.toLowerCase();
      const rt = (selRoom?.tipe || '').toLowerCase();
      const rn = (selRoom?.nama || '').toLowerCase();
      return (rt && (rt.includes(pn) || pn.includes(rt))) || rn.includes(pn);
    });
    if (durasi === 'Per Malam') {
      const malam = tipe ? parseRupiah(tipe.malam) : selRoom?.harga || 0;
      const n = Math.max(1, malamQty);
      return { price: malam * n, label: `${n} malam` };
    }
    if (durasi === 'Mingguan') {
      const minggu = tipe ? parseRupiah(tipe.mingguan) : 0;
      return { price: minggu, label: 'Per minggu' };
    }
    const bulan = tipe ? parseRupiah(tipe.bulan) : selRoom?.harga || 0;
    return { price: bulan, label: 'Per bulan' };
  }, [isKost, selRoom, durasi, malamQty, info]);

  const addonTotal = useMemo(() => {
    const eb = fasilitas.find(isExtraBed);
    return selFac.reduce((s, id) => { const f = fasilitas.find((x) => x.id === id); return s + (f ? Number(f.price_adjust) || 0 : 0); }, 0)
      + (eb ? extraBedQty * (Number(eb.price_adjust) || 0) : 0);
  }, [selFac, extraBedQty, fasilitas]);

  const maxOrang = isKost ? info.kostMaxOrang || 2 : info.penginapanMaxOrang || 3;
  const dpMin = isKost ? info.kostDpMin || 0 : info.penginapanDpMin || 0;
  useEffect(() => { if (bayar === 'DP' && dpAmount === 0 && dpMin > 0) setDpAmount(dpMin); }, [dpMin, bayar]); // eslint-disable-line react-hooks/exhaustive-deps
  const extraOrang = useMemo(() => {
    if (isKost) return Math.max(0, orang - 1) * (info.kostExtraPerOrang || 0);
    const baseOrang = info.penginapanBaseOrang || 1;
    const extra = Math.max(0, orang - baseOrang);
    if (!extra) return 0;
    const tipe = info.penginapan.find((p) => { const pn = p.nama.toLowerCase(); const rt = (selRoom?.tipe || '').toLowerCase(); const rn = (selRoom?.nama || '').toLowerCase(); return (rt && (rt.includes(pn) || pn.includes(rt))) || rn.includes(pn); });
    const n = durasi === 'Per Malam' ? Math.max(1, malamQty) : durasi === 'Mingguan' ? 7 : 30;
    return extra * (tipe?.extraPerOrang || 0) * n;
  }, [isKost, orang, info, selRoom, durasi, malamQty]);

  function toggleFac(id: string) { setSelFac((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }

  // WhatsApp Penjaga Mezi (untuk kamar yang masih DP).
  const meziNo = info.waMezi || DEFAULT_INFO.waMezi;
  const meziLink = `https://wa.me/${normWa(meziNo)}?text=${encodeURIComponent('Halo Penjaga Mezi 🌸, saya mau tanya ketersediaan kamar yang masih DP di Top Hills.')}`;

  function lanjut() {
    setWaErr('');
    if (!nama.trim()) { toast.error('Nama wajib diisi'); return; }
    if (!isValidWa(wa)) { setWaErr('Format WA belum benar. Contoh: 6281234567890'); return; }
    if (!kamar) { toast.error('Pilih kamar yang tersedia dulu'); return; }
    if (bayar === 'DP') {
      if (dpAmount < dpMin) { toast.error(`DP minimal ${formatRupiah(dpMin)}`); return; }
      if (base.price > 0 && dpAmount > base.price + addonTotal + extraOrang) { toast.error('DP tidak boleh melebihi total'); return; }
    }
    setPayStep(true);
  }

  async function doSubmit(bukti: BuktiFile | null) {
    const facNames = fasilitas.filter((f) => selFac.includes(f.id) && !isExtraBed(f)).map((f) => f.nama);
    const rincQty = !isKost && durasi === 'Per Malam' ? Math.max(1, malamQty) : 1;
    const rincUnit = rincQty > 0 ? Math.round(base.price / rincQty) : base.price;
    const rincAddon = addonTotal + extraOrang;
    const catat = [
      catatan.trim(),
      orang > 1 ? `${orang} orang` : '',
      facNames.length ? 'Fasilitas: ' + facNames.join(', ') : '',
      extraBedQty > 0 ? `Extra bed x${extraBedQty}` : '',
      base.price > 0 ? `Estimasi: ${formatRupiah(base.price + addonTotal + extraOrang)}` : '',
      bayar === 'DP' && dpAmount > 0 ? `DP: ${formatRupiah(dpAmount)}` : '',
      base.price > 0 ? `[RINC u=${rincUnit} q=${rincQty} a=${rincAddon}]` : '',
    ].filter(Boolean).join(' — ');
    setSubmitting(true);
    const res = await submitBookingRequest({
      jenis: 'baru', nama: nama.trim(), whatsapp: normWa(wa), layanan, kamar,
      durasi: !isKost && durasi === 'Per Malam' ? `${Math.max(1, malamQty)} malam` : durasi,
      // Kost dgn kunci tanggal → jangan kirim tanggal; di-set admin saat konfirmasi (lunas).
      tglMulai: kostLockTanggal ? '' : mulai, bayar, catatan: catat, jumlahOrang: orang, bukti: bukti || undefined,
      dpAmount: bayar === 'DP' ? dpAmount : undefined,
    });
    setSubmitting(false);
    setDemo(res.demo);
    setDone(true);
  }

  if (done) {
    return <BookingShell back={{ href: '/info', label: 'Beranda' }}><BookingDone nama={nama} demo={demo} /></BookingShell>;
  }

  if (payStep) {
    return (
      <BookingShell back={{ href: '/info/booking', label: 'Pilihan' }}>
        <SectionTitle sub="Langkah terakhir — selesaikan pembayaran.">Pembayaran</SectionTitle>
        <PaymentStep
          layanan={layanan}
          total={base.price + addonTotal + extraOrang}
          dp={dpAmount}
          ringkas={`${kamar} · ${durasi}${orang > 1 ? ' · ' + orang + ' org' : ''}`}
          bayar={bayar}
          onSubmit={doSubmit}
          submitting={submitting}
          onBack={() => setPayStep(false)}
        />
      </BookingShell>
    );
  }

  const kamarHint = !rooms
    ? 'Memuat data kamar…'
    : (!isKost && !rangeReady)
      ? '⬆️ Isi tanggal check-in dulu untuk melihat kamar yang tersedia di tanggal itu.'
      : kosongRooms.length === 0
        ? `Tidak ada kamar ${isKost ? 'kost' : 'penginapan'} yang tersedia ${!isKost ? 'untuk tanggal ini' : 'saat ini'}.${dpRooms.length ? ' Cek info kamar DP di bawah 👇' : ''}`
        : `Menampilkan kamar yang tersedia${!isKost ? ' untuk tanggalmu' : ''}.`;

  return (
    <BookingShell back={{ href: '/info/booking', label: 'Pilihan' }}>
      <SectionTitle sub="Isi data & tanggal dulu, lalu pilih kamar yang tersedia. 🌸">Booking Kamar Baru</SectionTitle>

      <THCard className="space-y-4">
        <THField label="Nama lengkap">
          <THInput placeholder="Nama kamu" value={nama} onChange={(e) => setNama(e.target.value)} />
        </THField>
        <THField label="Nomor WhatsApp" error={waErr || undefined} hint="Untuk konfirmasi booking">
          <THInput inputMode="numeric" placeholder="Contoh: 6281234567890" value={wa} onChange={(e) => setWa(e.target.value)} />
        </THField>

        {/* 1) Layanan */}
        <THField label="1. Pilih layanan">
          <div className="grid grid-cols-2 gap-2">
            {(['KOS', 'PENGINAPAN'] as const).map((l) => (
              <button key={l} onClick={() => { setLayanan(l); setKamar(''); setDurasi(l === 'KOS' ? '6 Bulan' : 'Per Malam'); }}
                className="min-h-[48px] rounded-[12px] font-bold text-[14px]"
                style={layanan === l ? { background: TH.gold, color: '#FBF7EC', border: `1px solid ${TH.gold}` } : { background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                {l === 'KOS' ? '🏠 Kost Putri' : '🛏️ Penginapan'}
              </button>
            ))}
          </div>
        </THField>

        {/* 2) Durasi + tanggal — DULUKAN sebelum pilih kamar agar ketersediaan akurat */}
        <THField label="2. Durasi / paket">
          <THSelect value={durasi} onChange={(e) => { setDurasi(e.target.value); setKamar(''); }}>
            {durasiOpts.map((d) => <option key={d} value={d}>{d}</option>)}
          </THSelect>
        </THField>

        {!isKost ? (
          <div className="grid grid-cols-2 gap-3">
            <THField label="3. Tanggal check-in">
              <THInput type="date" value={mulai} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setMulai(e.target.value); setKamar(''); }} />
            </THField>
            {durasi === 'Per Malam' ? (
              <THField label="Jumlah malam">
                <THInput type="number" min={1} value={malamQty} onChange={(e) => { setMalamQty(Math.max(1, Number(e.target.value) || 1)); setKamar(''); }} />
              </THField>
            ) : (
              <THField label="Lama sewa">
                <div className="rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: TH.cream, border: `1.5px solid ${TH.border}`, color: TH.brownSoft }}>
                  {durasi === 'Mingguan' ? '7 malam' : '30 malam'}
                </div>
              </THField>
            )}
          </div>
        ) : (
          <div className="rounded-[12px] px-3.5 py-2.5 text-[12.5px] leading-snug" style={{ background: '#FBF3E0', border: `1px solid ${TH.gold}`, color: TH.brown }}>
            📅 Untuk <b>kost</b>, tanggal check-in &amp; check-out di-set <b>otomatis</b> = tanggal pelunasan + periode ({durasi}) saat admin konfirmasi. Daftar kamar di bawah = yang <b>kosong saat ini</b>.
          </div>
        )}

        {!isKost && rangeReady && (
          <p className="text-[12px] -mt-1" style={{ color: TH.brownSoft }}>
            🗓️ Menginap <b>{fmtTgl(mulai)}</b> → <b>{fmtTgl(checkOut)}</b> · {nights} malam
          </p>
        )}

        {/* 3) Pilih kamar — hanya yang TERSEDIA di tanggal itu */}
        <THField label={`${isKost ? '3' : '4'}. Pilih kamar yang tersedia`} hint={kamarHint}>
          <THSelect value={kamar} onChange={(e) => setKamar(e.target.value)} >
            <option value="">— pilih kamar —</option>
            {kosongRooms.map((r) => (
              <option key={`${r.nama}-${r.gedung}`} value={`${r.nama} — ${r.gedung}`}>
                {r.nama} — {r.gedung}{r.tipe ? ` (${r.tipe})` : ''}
              </option>
            ))}
          </THSelect>
        </THField>

        {/* Kamar yang masih DP → arahkan ke Penjaga Mezi */}
        {dpRooms.length > 0 && (
          <div className="rounded-[12px] p-3.5 text-[12.5px] leading-relaxed" style={{ background: '#FEF3C7', border: '1px solid #E7D3A0', color: TH.brown }}>
            🟡 <b>Ada kamar yang masih DP</b> (dipesan, belum lunas){!isKost ? ' untuk tanggal ini' : ''}:{' '}
            <b>{dpRooms.map((r) => r.nama).join(', ')}</b>. Masih ada kemungkinan tersedia — untuk info lebih lanjut hubungi{' '}
            <b>Penjaga Mezi</b>:{' '}
            <a href={meziLink} target="_blank" rel="noopener noreferrer" style={{ color: TH.gold, fontWeight: 700 }}>
              {meziNo} (chat WA)
            </a>
          </div>
        )}

        {/* 4) Jumlah orang */}
        <THField label="Jumlah orang" hint={isKost ? `Maks ${maxOrang} orang. Orang ke-2 +${formatRupiah(info.kostExtraPerOrang || 0)}` : `Maks ${maxOrang} per kamar. Lebih dari ${info.penginapanBaseOrang || 1} kena +rate/orang/malam`}>
          <THInput type="number" min={1} max={maxOrang} value={orang}
            onChange={(e) => setOrang(Math.max(1, Math.min(maxOrang, Number(e.target.value) || 1)))} />
        </THField>

        {!isKost && durasi !== 'Per Malam' && (
          <p className="text-[12px] leading-snug -mt-1" style={{ color: TH.brownSoft }}>
            ⚡ Untuk sewa lebih dari 1 hari, token listrik ditanggung tamu.
          </p>
        )}

        {acDisabled && (
          <p className="text-[12px] leading-snug rounded-[12px] px-3 py-2.5" style={{ background: '#FBF3E0', border: `1px solid ${TH.gold}`, color: TH.brown }}>
            ❄️ Kost paket <b>6 Bulan</b> seluruh lantai <b>non-AC</b> — opsi fasilitas AC tidak tersedia untuk paket ini.
          </p>
        )}

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
              <button key={b} onClick={() => { setBayar(b); if (b === 'DP' && dpAmount < dpMin) setDpAmount(dpMin); }} className="min-h-[48px] rounded-[12px] font-bold text-[14px]"
                style={bayar === b ? { background: TH.gold, color: '#FBF7EC', border: `1px solid ${TH.gold}` } : { background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                {b === 'DP' ? 'Bayar DP dulu' : 'Bayar Lunas'}
              </button>
            ))}
          </div>
        </THField>
        {bayar === 'DP' && (
          <THField label="Nominal DP" hint={`Minimal ${formatRupiah(dpMin)} · sisa ditagih saat pelunasan`}>
            <RupiahInput value={dpAmount} onChange={setDpAmount} placeholder={dpMin.toLocaleString('id-ID')} />
          </THField>
        )}

        <THField label="Catatan (opsional)">
          <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="Mis: lantai bawah, dekat tangga, dll."
            className="w-full rounded-[12px] px-3.5 py-2.5 text-[15px] outline-none resize-y" style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown }} />
        </THField>
      </THCard>

      <PostFormActions
        nama={nama}
        ringkas={kamar ? `${kamar}${durasi ? ' · ' + durasi : ''}${orang > 1 ? ' · ' + orang + ' org' : ''}${base.price > 0 ? ' · est ' + formatRupiah(base.price + addonTotal + extraOrang) : ''}` : ''}
        onLanjut={lanjut}
        submitting={submitting}
      />
    </BookingShell>
  );
}
