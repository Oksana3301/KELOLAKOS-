'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type PublicRoom } from '@/lib/api';
import { BookingShell, BookingDone, THCard, THBtn, THField, THInput, THSelect, SectionTitle } from '@/components/info/booking-shell';
import { TH, isValidWa, normWa } from '@/lib/tophills-theme';
import { submitBookingRequest } from '@/lib/booking-request';

export default function BookingBaruPage() {
  const [nama, setNama] = useState('');
  const [wa, setWa] = useState('');
  const [waErr, setWaErr] = useState('');
  const [layanan, setLayanan] = useState<'KOS' | 'PENGINAPAN'>('KOS');
  const [kamar, setKamar] = useState('');
  const [durasi, setDurasi] = useState('6 Bulan');
  const [mulai, setMulai] = useState(new Date().toISOString().slice(0, 10));
  const [bayar, setBayar] = useState<'DP' | 'Full'>('DP');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState(false);

  const { data: rooms } = useQuery({ queryKey: ['public-rooms'], queryFn: api.getPublicRooms, retry: 0, staleTime: 60_000 });

  const kamarOptions = useMemo(() => {
    const arr = Array.isArray(rooms) ? rooms : [];
    const isKost = layanan === 'KOS';
    return arr.filter((r: PublicRoom) => {
      const lay = String(r.layanan || '').toUpperCase();
      const matchLayanan = isKost ? lay.includes('KOS') : lay.includes('PENGINAPAN') || lay.includes('INAP');
      return matchLayanan && r.status === 'kosong';
    });
  }, [rooms, layanan]);

  const durasiOpts = layanan === 'KOS' ? ['6 Bulan', '1 Tahun'] : ['Per Malam', 'Bulanan'];

  async function lanjut() {
    setWaErr('');
    if (!nama.trim()) { toast.error('Nama wajib diisi'); return; }
    if (!isValidWa(wa)) { setWaErr('Format WA belum benar. Contoh: 6281234567890'); return; }
    if (!kamar) { toast.error('Pilih kamar dulu'); return; }
    setSubmitting(true);
    const res = await submitBookingRequest({
      jenis: 'baru', nama: nama.trim(), whatsapp: normWa(wa), layanan, kamar, durasi, tglMulai: mulai, bayar, catatan: catatan.trim(),
    });
    setSubmitting(false);
    setDemo(res.demo);
    setDone(true);
  }

  if (done) {
    return (
      <BookingShell back={{ href: '/info', label: 'Beranda' }}>
        <BookingDone nama={nama} demo={demo} />
      </BookingShell>
    );
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

        <THField label="Pilih kamar (yang kosong)" hint={kamarOptions.length === 0 ? 'Memuat / belum ada kamar kosong untuk layanan ini' : undefined}>
          <THSelect value={kamar} onChange={(e) => setKamar(e.target.value)}>
            <option value="">— pilih kamar —</option>
            {kamarOptions.map((r) => (
              <option key={r.nama} value={`${r.nama} — ${r.gedung}`}>{r.nama} — {r.gedung} ({r.tipe})</option>
            ))}
          </THSelect>
        </THField>

        <div className="grid grid-cols-2 gap-3">
          <THField label="Durasi / paket">
            <THSelect value={durasi} onChange={(e) => setDurasi(e.target.value)}>
              {durasiOpts.map((d) => <option key={d} value={d}>{d}</option>)}
            </THSelect>
          </THField>
          <THField label="Tanggal mulai">
            <THInput type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
          </THField>
        </div>

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
          <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="Mis: minta extra bed, lantai bawah, dll."
            className="w-full rounded-[12px] px-3.5 py-2.5 text-[15px] outline-none resize-y" style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown }} />
        </THField>
      </THCard>

      <div className="mt-4">
        <THBtn variant="gold" block onClick={lanjut} disabled={submitting}>
          {submitting ? 'Mengirim…' : 'Kirim Permintaan Booking ›'}
        </THBtn>
        <p className="text-[11.5px] text-center mt-2" style={{ color: TH.brownSoft }}>
          Tim kami akan menghubungi via WhatsApp untuk konfirmasi &amp; pembayaran. Booking aktif setelah dikonfirmasi.
        </p>
      </div>
    </BookingShell>
  );
}
