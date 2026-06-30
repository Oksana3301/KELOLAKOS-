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
import { hasRangeData, rangeStatusOf, statusTodayOf, addDaysISO, todayISO } from '@/lib/availability';
import { JAM_NOTE_LONG } from '@/lib/booking-rules';
import type { RoomStatus3 } from '@/lib/building-layout';

const numOf = (s?: string) => { const m = String(s || '').match(/\d+/); return m ? Number(m[0]) : 9999; };
const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000));
function fmtTgl(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Badge status kamar (selaras denah).
const BADGE: Record<RoomStatus3, { label: string; bg: string; border: string; text: string }> = {
  kosong:    { label: '✅ Tersedia',  bg: '#DCFCE7', border: '#16A34A', text: '#15803D' },
  dp:        { label: '🟡 DP',        bg: '#FEF3C7', border: '#D97706', text: '#B45309' },
  terisi:    { label: '⬛ Terisi',     bg: '#E2E8F0', border: '#475569', text: '#334155' },
  perbaikan: { label: '🔧 Perbaikan', bg: '#FEE2E2', border: '#DC2626', text: '#B91C1C' },
  unknown:   { label: 'Belum ada data', bg: '#F1F5F9', border: '#CBD5E1', text: '#64748B' },
};
const ORDER: Record<string, number> = { kosong: 0, dp: 1, terisi: 2, perbaikan: 3, unknown: 4 };

export default function BookingBaruPage() {
  const [nama, setNama] = useState('');
  const [wa, setWa] = useState('');
  const [waErr, setWaErr] = useState('');
  const [layanan, setLayanan] = useState<'KOS' | 'PENGINAPAN'>('KOS');
  const [kamar, setKamar] = useState(''); // KOST: kamar tunggal
  const [pickedPng, setPickedPng] = useState<string[]>([]); // PENGINAPAN: bisa banyak kamar
  const [durasi, setDurasi] = useState('6 Bulan');
  const today = todayISO();
  const [mulai, setMulai] = useState(today);
  const [keluar, setKeluar] = useState(addDaysISO(today, 1)); // check-out (khusus Per Malam)
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
  // Kost: sembunyikan AC (paket 6 bulan non-AC) & extra bed (konsep per-malam
  // penginapan — tidak berlaku untuk kontrak kost) agar tak ikut terhitung.
  const fasilitas = allFasilitas.filter((f) => !(acDisabled && isAcFacility(f)) && !(isKost && isExtraBed(f)));
  useEffect(() => {
    if (!acDisabled) return;
    setSelFac((prev) => prev.filter((id) => { const f = allFasilitas.find((x) => x.id === id); return !(f && isAcFacility(f)); }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acDisabled]);

  const durasiOpts = isKost ? ['6 Bulan', '1 Tahun'] : ['Per Malam', 'Mingguan', 'Bulanan'];
  const perMalam = !isKost && durasi === 'Per Malam';

  // ── Tanggal & rentang menginap (penginapan) ──
  // Per Malam → check-out dipilih user. Mingguan/Bulanan → otomatis +7/+30.
  const checkOut = isKost ? '' : perMalam ? keluar : addDaysISO(mulai, durasi === 'Mingguan' ? 7 : 30);
  const rangeReady = !isKost && !!mulai && !!checkOut && mulai < checkOut;
  const nights = !isKost ? (rangeReady ? daysBetween(mulai, checkOut) : (durasi === 'Mingguan' ? 7 : durasi === 'Bulanan' ? 30 : 1)) : 0;

  const isPenginapan = (r: PublicRoom) => {
    const g = String(r.gedung || '').toUpperCase();
    const lay = String(r.layanan || '').toUpperCase();
    if (lay.includes('PENGINAP') || lay.includes('INAP')) return true;
    if (lay.includes('KOS')) return false;
    return g.includes('C') || g.includes('PENGINAPAN') || /\bD0?\d+/i.test(String(r.nama || ''));
  };

  // Semua kamar (layanan terpilih) + status untuk tanggal yang diminta.
  const classified = useMemo(() => {
    const arr = Array.isArray(rooms) ? rooms : [];
    const rangeOk = hasRangeData(arr);
    const matched = arr.filter((r) => (isKost ? !isPenginapan(r) : isPenginapan(r)));
    const stOf = (r: PublicRoom): RoomStatus3 =>
      isKost ? statusTodayOf(r) : (rangeReady && rangeOk ? rangeStatusOf(r, mulai, checkOut) : statusTodayOf(r));
    return matched
      .map((r) => ({ r, st: stOf(r) }))
      .sort((a, b) => (ORDER[a.st] - ORDER[b.st]) || (numOf(a.r.nama) - numOf(b.r.nama)) || String(a.r.nama).localeCompare(String(b.r.nama)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, isKost, mulai, checkOut, rangeReady]);

  const kosongRooms = useMemo(() => classified.filter((x) => x.st === 'kosong').map((x) => x.r), [classified]);
  const dpRooms = useMemo(() => classified.filter((x) => x.st === 'dp').map((x) => x.r), [classified]);

  const roomKeyOf = (r: PublicRoom) => `${r.nama} — ${r.gedung}`;

  // Kamar terpilih jadi tak tersedia → buang dari pilihan (single & multi).
  useEffect(() => {
    const avail = new Set(kosongRooms.map(roomKeyOf));
    if (kamar && !avail.has(kamar)) setKamar('');
    setPickedPng((prev) => { const next = prev.filter((k) => avail.has(k)); return next.length === prev.length ? prev : next; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kosongRooms]);

  // Kamar terpilih: KOST = tunggal (kamar) · PENGINAPAN = bisa banyak (pickedPng).
  const selectedKeys = isKost ? (kamar ? [kamar] : []) : pickedPng;
  const selRooms = useMemo(
    () => selectedKeys.map((k) => kosongRooms.find((r) => roomKeyOf(r) === k)).filter(Boolean) as PublicRoom[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKeys.join('|'), kosongRooms],
  );
  const selRoom = selRooms[0]; // kamar pertama → acuan tipe (kost & extra orang)
  const roomCount = selRooms.length;

  // Harga dasar SATU kamar (sesuai paket & tanggal).
  function perRoomBasePrice(r: PublicRoom | undefined): number {
    if (!r) return 0;
    if (isKost) return kostBasePrice(info, durasi, r).price;
    const tipe = info.penginapan.find((p) => {
      const pn = p.nama.toLowerCase();
      const rt = (r.tipe || '').toLowerCase();
      const rn = (r.nama || '').toLowerCase();
      return (rt && (rt.includes(pn) || pn.includes(rt))) || rn.includes(pn);
    });
    if (perMalam) return (tipe ? parseRupiah(tipe.malam) : r.harga || 0) * Math.max(1, nights);
    if (durasi === 'Mingguan') return tipe ? parseRupiah(tipe.mingguan) : 0;
    return tipe ? parseRupiah(tipe.bulan) : r.harga || 0;
  }

  // Total harga kamar = jumlah SELURUH kamar terpilih.
  const baseSum = useMemo(
    () => selRooms.reduce((s, r) => s + perRoomBasePrice(r), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selRooms, isKost, durasi, perMalam, nights, info],
  );
  const base = (() => {
    if (isKost) return { price: baseSum, label: kostBasePrice(info, durasi, selRoom).label };
    const lbl = perMalam ? `${Math.max(1, nights)} malam` : durasi === 'Mingguan' ? 'Per minggu' : 'Per bulan';
    return { price: baseSum, label: lbl + (roomCount > 1 ? ` · ${roomCount} kamar` : '') };
  })();

  // Fasilitas & extra bed = dibebankan SEKALI untuk satu pesanan (bukan per kamar).
  const addonTotal = useMemo(() => {
    const eb = fasilitas.find(isExtraBed);
    return selFac.reduce((s, id) => { const f = fasilitas.find((x) => x.id === id); return s + (f ? Number(f.price_adjust) || 0 : 0); }, 0)
      + (eb ? extraBedQty * (Number(eb.price_adjust) || 0) : 0);
  }, [selFac, extraBedQty, fasilitas]);

  const maxOrang = isKost ? info.kostMaxOrang || 2 : info.penginapanMaxOrang || 3;
  // DP minimal PER KAMAR (penginapan): 100rb/kamar → 3 kamar = 300rb.
  const dpUnit = isKost ? (info.kostDpMin || 0) : (info.penginapanDpMin || 0);
  const dpMin = dpUnit * (isKost ? 1 : Math.max(1, roomCount));
  // Default & jaga: DP minimal mengikuti jumlah kamar (naikkan bila di bawah min).
  useEffect(() => { if (bayar === 'DP') setDpAmount((cur) => (cur < dpMin ? dpMin : cur)); }, [dpMin, bayar]); // eslint-disable-line react-hooks/exhaustive-deps
  const extraOrang = useMemo(() => {
    if (isKost) return Math.max(0, orang - 1) * (info.kostExtraPerOrang || 0);
    const baseOrang = info.penginapanBaseOrang || 1;
    const extra = Math.max(0, orang - baseOrang);
    if (!extra) return 0;
    const tipe = info.penginapan.find((p) => { const pn = p.nama.toLowerCase(); const rt = (selRoom?.tipe || '').toLowerCase(); const rn = (selRoom?.nama || '').toLowerCase(); return (rt && (rt.includes(pn) || pn.includes(rt))) || rn.includes(pn); });
    const n = perMalam ? Math.max(1, nights) : durasi === 'Mingguan' ? 7 : 30;
    return extra * (tipe?.extraPerOrang || 0) * n;
  }, [isKost, orang, info, selRoom, perMalam, nights, durasi]);

  function toggleFac(id: string) { setSelFac((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }

  const meziNo = info.waMezi || DEFAULT_INFO.waMezi;
  const meziLink = `https://wa.me/${normWa(meziNo)}?text=${encodeURIComponent('Halo Penjaga Mezi 🌸, saya mau tanya ketersediaan kamar yang masih DP di Top Hills.')}`;

  function lanjut() {
    setWaErr('');
    if (!nama.trim()) { toast.error('Nama wajib diisi'); return; }
    if (!isValidWa(wa)) { setWaErr('Format WA belum benar. Contoh: 6281234567890'); return; }
    if (perMalam && !rangeReady) { toast.error('Tanggal check-out harus setelah check-in'); return; }
    if (selectedKeys.length === 0) { toast.error('Pilih kamar yang tersedia dulu'); return; }
    if (bayar === 'DP') {
      if (dpAmount < dpMin) {
        toast.error(`DP minimal ${formatRupiah(dpMin)}${!isKost && roomCount > 1 ? ` (${roomCount} kamar × ${formatRupiah(dpUnit)})` : ''}`);
        return;
      }
      if (base.price > 0 && dpAmount > base.price + addonTotal + extraOrang) { toast.error('DP tidak boleh melebihi total'); return; }
    }
    setPayStep(true);
  }

  async function doSubmit(bukti: BuktiFile | null) {
    const targets = selRooms;
    if (!targets.length) { toast.error('Pilih kamar dulu'); return; }
    const n = targets.length;
    const facNames = fasilitas.filter((f) => selFac.includes(f.id) && !isExtraBed(f)).map((f) => f.nama);
    const rincQty = perMalam ? Math.max(1, nights) : 1;
    // DP total dibagi rata ke tiap kamar (sisa pembulatan → kamar pertama).
    const totalDp = bayar === 'DP' ? dpAmount : 0;
    const dpEach = n > 0 ? Math.floor(totalDp / n) : 0;
    const dpRemainder = totalDp - dpEach * n;
    setSubmitting(true);
    let demoFlag = false;
    let failMsg = '';
    for (let i = 0; i < n; i++) {
      const r = targets[i];
      const roomBase = perRoomBasePrice(r);
      // Fasilitas + extra bed + tambahan orang dibebankan SEKALI di kamar pertama.
      const addonForRoom = i === 0 ? addonTotal + extraOrang : 0;
      const roomEstimasi = roomBase + addonForRoom;
      const rincUnit = rincQty > 0 ? Math.round(roomBase / rincQty) : roomBase;
      const dpRoom = bayar === 'DP' ? dpEach + (i === 0 ? dpRemainder : 0) : 0;
      const catat = [
        catatan.trim(),
        orang > 1 ? `${orang} orang` : '',
        perMalam ? `Check-out: ${fmtTgl(checkOut)}` : '',
        n > 1 ? `Booking grup ${i + 1}/${n} kamar` : '',
        i === 0 && facNames.length ? 'Fasilitas: ' + facNames.join(', ') : '',
        i === 0 && extraBedQty > 0 ? `Extra bed x${extraBedQty}` : '',
        roomEstimasi > 0 ? `Estimasi: ${formatRupiah(roomEstimasi)}` : '',
        bayar === 'DP' && dpRoom > 0 ? `DP: ${formatRupiah(dpRoom)}` : '',
        roomEstimasi > 0 ? `[RINC u=${rincUnit} q=${rincQty} a=${addonForRoom}]` : '',
      ].filter(Boolean).join(' — ');
      const res = await submitBookingRequest({
        jenis: 'baru', nama: nama.trim(), whatsapp: normWa(wa), layanan, kamar: roomKeyOf(r),
        durasi: perMalam ? `${Math.max(1, nights)} malam` : durasi,
        // Kost dgn kunci tanggal → tanggal di-set admin saat konfirmasi (lunas).
        tglMulai: kostLockTanggal ? '' : mulai, bayar, catatan: catat, jumlahOrang: orang,
        bukti: bukti || undefined, dpAmount: bayar === 'DP' ? dpRoom : undefined,
      });
      if (!res.ok) { failMsg = res.error || 'Gagal mengirim booking.'; break; }
      demoFlag = res.demo;
    }
    setSubmitting(false);
    // GAGAL nyata → JANGAN tampilkan "Terkirim". Tetap di langkah pembayaran
    // (bukti tetap tersimpan) supaya user bisa coba lagi / hubungi admin.
    if (failMsg) {
      toast.error(failMsg + ' Periksa koneksi lalu coba lagi, atau hubungi admin.');
      return;
    }
    setDemo(demoFlag);
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
          ringkas={`${selectedKeys.join(', ')} · ${durasi}${perMalam ? ' · s/d ' + fmtTgl(checkOut) : ''}${roomCount > 1 ? ` · ${roomCount} kamar` : ''}${orang > 1 ? ' · ' + orang + ' org' : ''}`}
          bayar={bayar}
          onSubmit={doSubmit}
          submitting={submitting}
          onBack={() => setPayStep(false)}
        />
      </BookingShell>
    );
  }

  const needDates = !isKost && perMalam && !rangeReady;
  const showRooms = !!rooms && !needDates;

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
              <button key={l} onClick={() => {
                  setLayanan(l); setKamar(''); setPickedPng([]); setDurasi(l === 'KOS' ? '6 Bulan' : 'Per Malam');
                  // Reset tambahan yang nempel ke layanan supaya estimasi tidak terbawa
                  // dari layanan sebelumnya (mis. extra bed/fasilitas penginapan ke kost).
                  setSelFac([]); setExtraBedQty(0); setOrang(1); setDpAmount(0);
                }}
                className="min-h-[48px] rounded-[12px] font-bold text-[14px]"
                style={layanan === l ? { background: TH.gold, color: '#FBF7EC', border: `1px solid ${TH.gold}` } : { background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                {l === 'KOS' ? '🏠 Kost Putri' : '🛏️ Penginapan'}
              </button>
            ))}
          </div>
        </THField>

        {/* 2) Durasi */}
        <THField label="2. Durasi / paket">
          <THSelect value={durasi} onChange={(e) => { setDurasi(e.target.value); setKamar(''); setPickedPng([]); }}>
            {durasiOpts.map((d) => <option key={d} value={d}>{d}</option>)}
          </THSelect>
        </THField>

        {/* 3) Tanggal — DULUKAN sebelum pilih kamar */}
        {!isKost ? (
          perMalam ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <THField label="3. Check-in">
                  <THInput type="date" value={mulai} min={today}
                    onChange={(e) => { setMulai(e.target.value); setKamar(''); if (e.target.value >= keluar) setKeluar(addDaysISO(e.target.value, 1)); }} />
                </THField>
                <THField label="Check-out">
                  <THInput type="date" value={keluar} min={addDaysISO(mulai, 1)}
                    onChange={(e) => { setKeluar(e.target.value); setKamar(''); }} />
                </THField>
              </div>
              {rangeReady ? (
                <p className="text-[12.5px] -mt-1 rounded-[10px] px-3 py-2" style={{ background: '#EAF5EE', border: '1px solid #BFE0CD', color: TH.brown }}>
                  🗓️ Check-in <b>{fmtTgl(mulai)}</b> → Check-out <b>{fmtTgl(checkOut)}</b> · <b>{nights} malam</b>
                </p>
              ) : (
                <p className="text-[12px] -mt-1" style={{ color: TH.danger }}>Tanggal check-out harus setelah check-in.</p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <THField label="3. Check-in">
                <THInput type="date" value={mulai} min={today} onChange={(e) => { setMulai(e.target.value); setKamar(''); }} />
              </THField>
              <THField label="Check-out (otomatis)">
                <div className="rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: TH.cream, border: `1.5px solid ${TH.border}`, color: TH.brownSoft }}>
                  {fmtTgl(checkOut)}
                </div>
              </THField>
            </div>
          )
        ) : kostLockTanggal ? (
          <div className="rounded-[12px] px-3.5 py-2.5 text-[12.5px] leading-snug" style={{ background: '#FBF3E0', border: `1px solid ${TH.gold}`, color: TH.brown }}>
            📅 Untuk <b>kost</b>, tanggal check-in &amp; check-out di-set <b>otomatis</b> = tanggal pelunasan + periode ({durasi}) saat admin konfirmasi. Daftar kamar = yang <b>kosong saat ini</b>.
          </div>
        ) : (
          // Kunci tanggal kost DIMATIKAN owner → user memilih tanggal mulai sendiri
          // (check-out otomatis = mulai + periode). Tanpa picker, dulu diam-diam
          // terkirim "hari ini" padahal note bilang "otomatis" — tidak logis.
          <THField label="3. Tanggal mulai (check-in)" hint={`Check-out otomatis = check-in + ${durasi}`}>
            <THInput type="date" value={mulai} min={today} onChange={(e) => { setMulai(e.target.value); setKamar(''); }} />
          </THField>
        )}

        {/* Aturan jam check-in / check-out penginapan */}
        {!isKost && (
          <p className="text-[12px] leading-relaxed rounded-[12px] px-3 py-2.5" style={{ background: '#EAF1FB', border: '1px solid #B9D0EE', color: '#1E4E8C' }}>
            ⏰ {JAM_NOTE_LONG}
          </p>
        )}

        {/* 4) Pilih kamar — tap yang Tersedia. Status lain (DP/Terisi) ditampilkan juga. */}
        <THField
          label={`${isKost ? '3' : '4'}. Pilih kamar (tap yang ✅ Tersedia)${!isKost ? ' — boleh lebih dari 1' : ''}`}
          hint={!rooms ? 'Memuat data kamar…' : needDates ? '⬆️ Isi tanggal check-in & check-out dulu' : !isKost ? `Bisa pilih beberapa kamar sekaligus. ${rangeReady ? `Status untuk ${fmtTgl(mulai)} → ${fmtTgl(checkOut)}` : ''}`.trim() : 'Status kamar saat ini'}
        >
          {showRooms && (
            classified.length === 0 ? (
              <div className="text-[13px] rounded-[12px] px-3.5 py-3" style={{ background: TH.cream, border: `1px solid ${TH.border}`, color: TH.brownSoft }}>
                Tidak ada kamar {isKost ? 'kost' : 'penginapan'}.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {classified.map(({ r, st }) => {
                  const b = BADGE[st];
                  const val = `${r.nama} — ${r.gedung}`;
                  const selectable = st === 'kosong';
                  const selected = selectedKeys.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={!selectable}
                      onClick={() => {
                        if (!selectable) return;
                        if (isKost) setKamar(val);
                        else setPickedPng((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
                      }}
                      className="flex items-center justify-between gap-2 rounded-[12px] px-3.5 py-3 text-left border-2 transition-colors"
                      style={{
                        borderColor: selected ? TH.gold : b.border,
                        background: selected ? '#FBF3E0' : selectable ? '#fff' : '#FAF7F2',
                        opacity: selectable ? 1 : 0.75,
                        cursor: selectable ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <span className="min-w-0">
                        <span className="font-bold text-[15px]" style={{ color: TH.brown }}>{r.nama}</span>
                        <span className="text-[12.5px]" style={{ color: TH.brownSoft }}> · {r.gedung}{r.tipe ? ` (${r.tipe})` : ''}</span>
                        {selected && <span className="text-[12px] font-bold" style={{ color: TH.gold }}> · dipilih ✓</span>}
                      </span>
                      <span className="flex-shrink-0 text-[11.5px] font-bold rounded-full px-2.5 py-1" style={{ background: b.bg, color: b.text, border: `1px solid ${b.border}` }}>
                        {b.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </THField>

        {/* Ringkas kamar terpilih (penginapan multi) */}
        {!isKost && roomCount > 0 && (
          <div className="rounded-[12px] p-3.5 text-[12.5px] leading-relaxed" style={{ background: '#EAF5EE', border: '1px solid #BFE0CD', color: TH.brown }}>
            ✅ <b>{roomCount} kamar</b> dipilih: {selectedKeys.join(', ')}.{' '}
            {bayar === 'DP' && <>Minimal DP <b>{formatRupiah(dpMin)}</b> ({roomCount} × {formatRupiah(dpUnit)}).</>}
          </div>
        )}

        {/* Kamar yang masih DP → arahkan ke Penjaga Mezi */}
        {showRooms && dpRooms.length > 0 && (
          <div className="rounded-[12px] p-3.5 text-[12.5px] leading-relaxed" style={{ background: '#FEF3C7', border: '1px solid #E7D3A0', color: TH.brown }}>
            🟡 <b>Kamar yang masih DP</b> (dipesan, belum lunas){!isKost ? ' untuk tanggal ini' : ''}:{' '}
            <b>{dpRooms.map((r) => r.nama).join(', ')}</b>. Masih ada kemungkinan tersedia — untuk info lebih lanjut hubungi{' '}
            <b>Penjaga Mezi</b>:{' '}
            <a href={meziLink} target="_blank" rel="noopener noreferrer" style={{ color: TH.gold, fontWeight: 700 }}>{meziNo} (chat WA)</a>
          </div>
        )}

        {/* 5) Jumlah orang */}
        <THField label="Jumlah orang" hint={isKost ? `Maks ${maxOrang} orang. Orang ke-2 +${formatRupiah(info.kostExtraPerOrang || 0)}` : `Maks ${maxOrang} per kamar. Lebih dari ${info.penginapanBaseOrang || 1} kena +rate/orang/malam`}>
          <THInput type="number" min={1} max={maxOrang} value={orang}
            onChange={(e) => setOrang(Math.max(1, Math.min(maxOrang, Number(e.target.value) || 1)))} />
        </THField>

        {!isKost && !perMalam && (
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
          <THField label="Nominal DP" hint={`Minimal ${formatRupiah(dpMin)}${!isKost && roomCount > 1 ? ` (${roomCount} kamar × ${formatRupiah(dpUnit)})` : ''} · sisa ditagih saat pelunasan`}>
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
        ringkas={selectedKeys.length ? `${selectedKeys.join(', ')}${roomCount > 1 ? ` (${roomCount} kamar)` : ''}${durasi ? ' · ' + durasi : ''}${perMalam ? ' · ' + nights + ' malam' : ''}${orang > 1 ? ' · ' + orang + ' org' : ''}${base.price > 0 ? ' · est ' + formatRupiah(base.price + addonTotal + extraOrang) : ''}` : ''}
        onLanjut={lanjut}
        submitting={submitting}
        meziWa={normWa(meziNo)}
      />
    </BookingShell>
  );
}
