'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingFullData } from '@/lib/api';
import { KkCard, KkButton } from './ui';

export function PendingConfirmations() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pending-bookings'], queryFn: api.getPendingBookings, retry: 0, refetchInterval: 60_000 });
  const list = Array.isArray(data) ? data : [];

  const confirm = useMutation({
    mutationFn: (v: { id: string; status: 'DP' | 'Lunas' }) => api.confirmBooking(v.id, v.status),
    onSuccess: () => {
      toast.success('✓ Booking diterima — catat pembayarannya ya');
      qc.invalidateQueries({ queryKey: ['pending-bookings'] });
      qc.invalidateQueries({ queryKey: ['initial-data'] });
    },
    onError: (e) => toast.error('Gagal: ' + (e as Error).message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectBooking(id),
    onSuccess: () => { toast.success('Booking ditolak'); qc.invalidateQueries({ queryKey: ['pending-bookings'] }); },
    onError: (e) => toast.error('Gagal: ' + (e as Error).message),
  });

  if (!list.length) return null;
  const busy = confirm.isPending || reject.isPending;

  return (
    <KkCard className="mb-4 !border-2 !border-kk-navy">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[20px]">🔔</span>
        <h3 className="font-heading font-black text-[18px] text-kk-navy m-0">Butuh Konfirmasi</h3>
        <span className="ml-auto text-[12px] font-bold px-2.5 py-1 rounded-full bg-kk-navy text-white">{list.length}</span>
      </div>
      <p className="text-caption text-kk-ink mb-3 mt-0">Booking dari halaman /info. Cek bukti &amp; data, lalu Terima (DP/Lunas) atau Tolak.</p>
      <div className="flex flex-col gap-3">
        {list.map((b) => (
          <PendingItem key={b.BookingID} b={b} busy={busy}
            onConfirm={(s) => confirm.mutate({ id: b.BookingID, status: s })}
            onReject={() => { if (confirm.isPending || reject.isPending) return; if (window.confirm(`Tolak booking ${b.Nama_Customer}?`)) reject.mutate(b.BookingID); }}
          />
        ))}
      </div>
    </KkCard>
  );
}

function PendingItem({ b, busy, onConfirm, onReject }: {
  b: BookingFullData; busy: boolean; onConfirm: (s: 'DP' | 'Lunas') => void; onReject: () => void;
}) {
  const bukti = b.Bukti_Bayar;
  const layanan = String(b.Layanan).toUpperCase() === 'KOS' ? 'Kost' : 'Penginapan';
  return (
    <div className="rounded-kk-card border border-kk-mauve p-3.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="font-bold text-kk-navy text-[16px]">{b.Nama_Customer || '(tanpa nama)'}</div>
          <div className="text-[13px] text-kk-ink">{b.Nama_Kamar}{b.Gedung ? ' · ' + b.Gedung : ''} · {layanan}</div>
          <div className="text-[12.5px] text-kk-ink mt-0.5">
            {b.Paket || b.Durasi || '-'}{b.Jumlah_Orang ? ' · ' + b.Jumlah_Orang + ' org' : ''}{b.WhatsApp ? ' · ' + b.WhatsApp : ''}
          </div>
          {b.Catatan && <div className="text-[12px] text-kk-ink/80 mt-1.5 leading-snug whitespace-pre-line">{b.Catatan}</div>}
        </div>
        {bukti ? (
          <a href={bukti} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-center no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bukti} alt="bukti" className="w-[64px] h-[64px] rounded-[10px] object-cover border border-kk-mauve" />
            <span className="block text-[10px] text-kk-navy font-semibold mt-0.5">Lihat bukti</span>
          </a>
        ) : (
          <span className="text-[11px] text-kk-ink/60 flex-shrink-0">tanpa bukti</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <KkButton variant="success" onClick={() => onConfirm('DP')} disabled={busy}>Terima · DP</KkButton>
        <KkButton variant="success" onClick={() => onConfirm('Lunas')} disabled={busy}>Terima · Lunas</KkButton>
      </div>
      <KkButton variant="ghost" block onClick={onReject} disabled={busy} className="mt-2">Tolak</KkButton>
    </div>
  );
}
