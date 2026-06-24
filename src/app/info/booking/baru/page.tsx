'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type PublicRoom } from '@/lib/api';
import { halamanInfoApi } from '@/lib/api-v2';
import { DEFAULT_INFO, mergeInfo } from '@/lib/halaman-info';
import { BookingShell, BookingDone, THCard, THField, THInput, THSelect, SectionTitle } from '@/components/info/booking-shell';
import { FasilitasEstimasi } from '@/components/info/fasilitas-estimasi';
import { PostFormActions } from '@/components/info/post-form-actions';
import { TH, isValidWa, normWa } from '@/lib/tophills-theme';
import { submitBookingRequest } from '@/lib/booking-request';
import { fetchFasilitas, parseRupiah, formatRupiah, isExtraBed, kostBasePrice } from '@/lib/booking-pricing';

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
  const [catatan, setCatatan] = useState('');
  const [selFac, setSelFac] = useState<string[]>([]);
  const [extraBedQty, setExtraBedQty] = useState(0);
  const [orang, setOrang] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState(false);

  const { data: rooms } = useQuery({ queryKey: ['public-rooms'], queryFn: api.getPublicRooms, retry: 0, staleTime: 60_000 });
  const { data: infoRaw } = useQuery({ queryKey: ['halaman-info'], queryFn: halamanInfoApi.get, retry: 0, staleTime: 60_000 });
  const { data: fasData } = useQuery({ queryKey: ['public-fasilitas'], queryFn: fetchFasilitas, retry: 0, staleTime: 60_000 });
  const info = mergeInfo(infoRaw || DEFAULT_INFO);
  const fasilitas = fasData?.list || [];

  const kamarOptions = useMemo(() => {
    const arr = Array.isArray(rooms) ? rooms : [];
    const isKost = layanan === 'KOS';
    const matchLayanan = (r: PublicRoom) => {
      const lay = String(r.layanan || '').toUpperCase();
      if (!lay) return true; // layanan tak diset → tampilkan di dua-duanya
      return isKost ? lay.includes('KOS') : lay.includes('PENGINAP') || lay.includes('INAP');
    };
    const matched = arr.filter(matchLayanan);
    const kosong = matched.filter((r) => r.status === 'kosong');
    // Utamakan yang kosong; kalau tidak ada (status belum rapi), tampilkan semua.
    return kosong.length ? kosong : matched.length ? matched : arr;
  }, [rooms, layanan]);

  const durasiOpts = layanan === 'KOS' ? ['6 Bulan', '1 Tahun'] : ['Per Malam', 'Bulanan'];
  const selRoom = kamarOptions.find((r) => `${r.nama} — ${r.gedung}` === kamar);

  // Harga dasar (estimasi) dari data publik.
  const base = useMemo(() => {
    if (layanan === 'KOS') return kostBasePrice(info, durasi, selRoom);
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
    const bulan = tipe ? parseRupiah(tipe.bulan) : selRoom?.harga || 0;
    return { price: bulan, label: 'Per bulan' };
  }, [layanan, selRoom, durasi, malamQty, info]);

  const addonTotal = useMemo(() => {
    const eb = fasilitas.find(isExtraBed);
    return selFac.reduce((s, id) => { const f = fasilitas.find((x) => x.id === id); return s + (f ? Number(f.price_adjust) || 0 : 0); }, 0)
      + (eb ? extraBedQty * (Number(eb.price_adjust) || 0) : 0);
  }, [selFac, extraBedQty, fasilitas]);

  const maxOrang = layanan === 'KOS' ? info.kostMaxOrang || 2 : info.penginapanMaxOrang || 3;
  const extraOrang = useMemo(() => {
    if (layanan === 'KOS') return Math.max(0, orang - 1) * (info.kostExtraPerOrang || 0);
    const baseOrang = info.penginapanBaseOrang || 1;
    const extra = Math.max(0, orang - baseOrang);
    if (!extra) return 0;
    const tipe = info.penginapan.find((p) => { const pn = p.nama.toLowerCase(); const rt = (selRoom?.tipe || '').toLowerCase(); const rn = (selRoom?.nama || '').toLowerCase(); return (rt && (rt.includes(pn) || pn.includes(rt))) || rn.includes(pn); });
    const nights = durasi === 'Per Malam' ? Math.max(1, malamQty) : 30;
    return extra * (tipe?.extraPerOrang || 0) * nights;
  }, [layanan, orang, info, selRoom, durasi, malamQty]);

  function toggleFac(id: string) { setSelFac((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }

  async function lanjut() {
    setWaErr('');
    if (!nama.trim()) { toast.error('Nama wajib diisi'); return; }
    if (!isValidWa(wa)) { setWaErr('Format WA belum benar. Contoh: 6281234567890'); return; }
    if (!kamar) { toast.error('Pilih kamar dulu'); return; }
    const facNames = fasilitas.filter((f) => selFac.includes(f.id) && !isExtraBed(f)).map((f) => f.nama);
    const catat = [
      catatan.trim(),
      orang > 1 ? `${orang} orang` : '',
      facNames.length ? 'Fasilitas: ' + facNames.join(', ') : '',
      extraBedQty > 0 ? `Extra bed x${extraBedQty}` : '',
      base.price > 0 ? `Estimasi: ${formatRupiah(base.price + addonTotal + extraOrang)}` : '',
    ].filter(Boolean).join(' — ');
    setSubmitting(true);
    const res = await submitBookingRequest({
      jenis: 'baru', nama: nama.trim(), whatsapp: normWa(wa), layanan, kamar,
      durasi: layanan === 'PENGINAPAN' && durasi === 'Per Malam' ? `${Math.max(1, malamQty)} malam` : durasi,
      tglMulai: mulai, bayar, catatan: catat, jumlahOrang: orang,
    });
    setSubmitting(false);
    setDemo(res.demo);
    setDone(true);
  }

  if (done) {
    return <BookingShell back={{ href: '/info', label: 'Beranda' }}><BookingDone nama={nama} demo={demo} /></BookingShell>;
  }

  return (
    <BookingShell back={{ href: '/info/booking', label: 'Pilihan' }}>
      <SectionTitle sub="Pertama kali booking di Top Hills? Isi data di bawah ya.">Booking Kamar Baru</SectionTitle>

      <THCard className="space-y-4">
        <THField label="Nama lengkap">
          <THInput placeholder="Nama kamu" value={nama} onChange={(e) => setNama(e.target.value)} />
        </THField>
        <THField label="Nomor WhatsApp" error={waErr || undefined} hint="Untuk konfirmasi booking">
          <THInput inputMode="numeric" placeholder="Contoh: 6281234567890" value={wa} onChange={(e) => setWa(e.target.value)} />
        </THField>

        <THField label="Layanan">
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

        <THField label="Pilih kamar" hint={!rooms ? 'Memuat data kamar…' : kamarOptions.length === 0 ? 'Belum ada data kamar — chat Helpdesk di bawah ya' : undefined}>
          <THSelect value={kamar} onChange={(e) => setKamar(e.target.value)}>
            <option value="">— pilih kamar —</option>
            {kamarOptions.map((r) => (
              <option key={`${r.nama}-${r.gedung}`} value={`${r.nama} — ${r.gedung}`}>
                {r.nama} — {r.gedung}{r.tipe ? ` (${r.tipe})` : ''}{r.status && r.status !== 'kosong' ? ` · ${r.status}` : ''}
              </option>
            ))}
          </THSelect>
        </THField>

        <div className="grid grid-cols-2 gap-3">
          <THField label="Durasi / paket">
            <THSelect value={durasi} onChange={(e) => setDurasi(e.target.value)}>
              {durasiOpts.map((d) => <option key={d} value={d}>{d}</option>)}
            </THSelect>
          </THField>
          {layanan === 'PENGINAPAN' && durasi === 'Per Malam' ? (
            <THField label="Jumlah malam">
              <THInput type="number" min={1} value={malamQty} onChange={(e) => setMalamQty(Math.max(1, Number(e.target.value) || 1))} />
            </THField>
          ) : (
            <THField label="Tanggal mulai">
              <THInput type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </THField>
          )}
        </div>
        {layanan === 'PENGINAPAN' && durasi === 'Per Malam' && (
          <THField label="Tanggal mulai">
            <THInput type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
          </THField>
        )}

        <THField label="Jumlah orang" hint={layanan === 'KOS' ? `Maks ${maxOrang} orang (6bln/1thn). Orang ke-2 +${formatRupiah(info.kostExtraPerOrang || 0)}` : `Maks ${maxOrang} per kamar. Lebih dari ${info.penginapanBaseOrang || 1} kena +rate/orang/malam`}>
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
