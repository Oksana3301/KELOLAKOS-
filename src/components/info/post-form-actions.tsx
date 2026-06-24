'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { TH } from '@/lib/tophills-theme';
import { THBtn, THField, THInput } from '@/components/info/booking-shell';

const MEZI_WA = '6283841614871'; // Bang Mezi (penjaga)

// Pilihan setelah form terisi: janji survey / tanya Mezi / lanjut pembayaran.
export function PostFormActions({ nama, ringkas, onLanjut, submitting }: {
  nama: string;
  ringkas: string;
  onLanjut: () => void;
  submitting?: boolean;
}) {
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [tgl, setTgl] = useState('');
  const [jam, setJam] = useState('');

  function tglPanjang(iso: string) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function kirimSurvey() {
    if (!nama.trim()) { toast.error('Isi nama dulu di atas ya'); return; }
    if (!tgl || !jam) { toast.error('Pilih tanggal & jam survey'); return; }
    const msg =
      `Halo Top Hills 🌸, Aku *${nama}* mau janji *survey / lihat kamar* dulu.\n` +
      `🗓️ ${tglPanjang(tgl)}\n⏰ Jam ${jam} WIB\n` +
      (ringkas ? `\nKamar yang diminati: ${ringkas}` : '');
    window.open(`https://wa.me/${MEZI_WA}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function tanyaMezi() {
    if (!nama.trim()) { toast.error('Isi nama dulu di atas ya'); return; }
    const msg = `Halo Top Hills 🌸, Aku *${nama}* mau tanya${ringkas ? `\n(soal: ${ringkas})` : ''} ...`;
    window.open(`https://wa.me/${MEZI_WA}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-[13px] text-center font-semibold" style={{ color: TH.brown }}>Mau survey / tanya dulu, atau langsung bayar?</p>

      {/* Janji survey (expandable date + jam) */}
      <div className="rounded-[14px] overflow-hidden" style={{ border: `1.5px solid ${TH.border}`, background: '#fff' }}>
        <button onClick={() => setSurveyOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="text-[14px] font-bold" style={{ color: TH.brown }}>📅 Janji Survey / lihat kamar</span>
          <span style={{ color: TH.brownSoft }}>{surveyOpen ? '▲' : '▼'}</span>
        </button>
        {surveyOpen && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${TH.border}` }}>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <THField label="Tanggal"><THInput type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} /></THField>
              <THField label="Jam (WIB)"><THInput type="time" value={jam} onChange={(e) => setJam(e.target.value)} /></THField>
            </div>
            <THBtn variant="primary" block onClick={kirimSurvey}>Kirim Janji Survey ke Bang Mezi (WA)</THBtn>
          </div>
        )}
      </div>

      {/* Tanya lebih detail */}
      <THBtn variant="ghost" block onClick={tanyaMezi}>💬 Tanya Lebih Detail ke Bang Mezi</THBtn>

      {/* Lanjut pembayaran (submit) */}
      <THBtn variant="gold" block onClick={onLanjut} disabled={submitting}>
        {submitting ? 'Mengirim…' : 'Lanjut ke Pembayaran ›'}
      </THBtn>
      <p className="text-[11.5px] text-center" style={{ color: TH.brownSoft }}>
        Booking aktif setelah pembayaran dikonfirmasi admin.
      </p>
    </div>
  );
}
