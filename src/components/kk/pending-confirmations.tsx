'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingFullData } from '@/lib/api';
import { KkCard, KkButton, Sheet } from './ui';
import { rupiah } from './status';

// Ambil DP / estimasi / fasilitas dari catatan /info (disimpan saat submit).
function parseCatatan(catatan?: string) {
  const c = String(catatan || '');
  const grab = (re: RegExp) => { const m = c.match(re); return m ? m[1].trim() : ''; };
  return {
    estimasi: grab(/Estimasi:\s*Rp\s*([\d.,]+)/i),
    dp: grab(/DP:\s*Rp\s*([\d.,]+)/i),
    fasilitas: grab(/Fasilitas:\s*([^—]+?)(?:\s*—|$)/i),
    extraBed: grab(/Extra bed x\s*(\d+)/i),
  };
}
const toNum = (s: string) => Number(String(s).replace(/[^0-9]/g, '')) || 0;
function tglID(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PendingConfirmations() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pending-bookings'], queryFn: api.getPendingBookings, retry: 0, refetchInterval: 60_000 });
  const list = Array.isArray(data) ? data : [];
  const [sel, setSel] = useState<BookingFullData | null>(null);

  const confirm = useMutation({
    mutationFn: (v: { id: string; status: 'DP' | 'Lunas' }) => api.confirmBooking(v.id, v.status),
    onSuccess: () => {
      toast.success('✓ Booking diterima — catat pembayarannya ya');
      setSel(null);
      qc.invalidateQueries({ queryKey: ['pending-bookings'] });
      qc.invalidateQueries({ queryKey: ['initial-data'] });
    },
    onError: (e) => toast.error('Gagal: ' + (e as Error).message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.rejectBooking(id),
    onSuccess: () => { toast.success('Booking ditolak'); setSel(null); qc.invalidateQueries({ queryKey: ['pending-bookings'] }); },
    onError: (e) => toast.error('Gagal: ' + (e as Error).message),
  });

  if (!list.length) return null;
  const busy = confirm.isPending || reject.isPending;

  return (
    <>
      <KkCard className="mb-4 !border-2 !border-kk-navy">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[20px]">🔔</span>
          <h3 className="font-heading font-black text-[18px] text-kk-navy m-0">Butuh Konfirmasi</h3>
          <span className="ml-auto text-[12px] font-bold px-2.5 py-1 rounded-full bg-kk-navy text-white">{list.length}</span>
        </div>
        <p className="text-caption text-kk-ink mb-3 mt-0">Booking dari halaman /info. Buka detail untuk cek data &amp; bukti, lalu Terima / Tolak.</p>
        <div className="flex flex-col gap-3">
          {list.map((b) => {
            const p = parseCatatan(b.Catatan);
            const layanan = String(b.Layanan).toUpperCase() === 'KOS' ? 'Kost' : 'Penginapan';
            return (
              <div key={b.BookingID} className="rounded-kk-card border border-kk-mauve p-3.5">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-kk-navy text-[16px]">{b.Nama_Customer || '(tanpa nama)'}</div>
                    <div className="text-[13px] text-kk-ink">{b.Nama_Kamar}{b.Gedung ? ' · ' + b.Gedung : ''} · {layanan}</div>
                    <div className="text-[12.5px] text-kk-ink mt-0.5">
                      {b.Paket || b.Durasi || '-'}{b.Jumlah_Orang ? ' · ' + b.Jumlah_Orang + ' org' : ''}
                    </div>
                    {(p.estimasi || p.dp) && (
                      <div className="text-[12.5px] mt-1 font-semibold text-kk-navy">
                        {p.estimasi && <>Est. Rp {p.estimasi}</>}{p.dp && <> · DP Rp {p.dp}</>}
                      </div>
                    )}
                  </div>
                  {b.Bukti_Bayar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.Bukti_Bayar} alt="bukti" className="w-[56px] h-[56px] rounded-[10px] object-cover border border-kk-mauve flex-shrink-0" />
                  ) : (
                    <span className="text-[11px] text-kk-ink/60 flex-shrink-0">tanpa bukti</span>
                  )}
                </div>
                <KkButton variant="primary" block onClick={() => setSel(b)} className="mt-3">
                  Lihat Detail &amp; Konfirmasi
                </KkButton>
              </div>
            );
          })}
        </div>
      </KkCard>

      {sel && (
        <PendingDetailSheet
          b={sel}
          busy={busy}
          onClose={() => setSel(null)}
          onConfirm={(s) => confirm.mutate({ id: sel.BookingID, status: s })}
          onReject={() => { if (window.confirm(`Tolak booking ${sel.Nama_Customer}?`)) reject.mutate(sel.BookingID); }}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === '' || value === null || value === undefined) return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-kk-mauve-soft last:border-0">
      <span className="text-[13px] text-kk-ink flex-shrink-0">{label}</span>
      <span className="text-[14px] font-semibold text-kk-navy text-right">{value}</span>
    </div>
  );
}

function PendingDetailSheet({ b, busy, onClose, onConfirm, onReject }: {
  b: BookingFullData; busy: boolean; onClose: () => void; onConfirm: (s: 'DP' | 'Lunas') => void; onReject: () => void;
}) {
  const p = parseCatatan(b.Catatan);
  const layanan = String(b.Layanan).toUpperCase() === 'KOS' ? 'Kost' : 'Penginapan';
  const sisa = p.estimasi && p.dp ? Math.max(0, toNum(p.estimasi) - toNum(p.dp)) : 0;

  return (
    <Sheet open onClose={onClose}>
      <div className="px-6 pt-5 pb-8">
        <div className="flex justify-between items-start gap-3 mb-1">
          <h2 className="font-heading font-black text-[24px] text-kk-navy m-0">{b.Nama_Customer || '(tanpa nama)'}</h2>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#FBF1D8', color: '#8A6A24' }}>MENUNGGU</span>
        </div>
        <p className="text-caption text-kk-ink mt-0 mb-4">Booking online dari /info · {b.BookingID}</p>

        {/* Bukti bayar — besar */}
        {b.Bukti_Bayar ? (
          <a href={b.Bukti_Bayar} target="_blank" rel="noopener noreferrer" className="block mb-4 no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.Bukti_Bayar} alt="bukti bayar" className="w-full rounded-kk-card border border-kk-mauve" style={{ maxHeight: 320, objectFit: 'contain', background: '#faf7f2' }} />
            <span className="block text-center text-[12px] font-semibold text-kk-navy mt-1">🔍 Buka bukti di tab baru</span>
          </a>
        ) : (
          <div className="mb-4 rounded-kk-card border border-dashed border-kk-mauve p-4 text-center text-[13px] text-kk-ink">Belum ada bukti bayar</div>
        )}

        {/* Detail */}
        <div className="rounded-kk-card border border-kk-mauve px-4 py-1 mb-4">
          <Row label="WhatsApp" value={b.WhatsApp ? <a href={`https://wa.me/${b.WhatsApp}`} target="_blank" rel="noopener noreferrer" className="text-kk-navy underline">{b.WhatsApp}</a> : ''} />
          <Row label="Kamar" value={`${b.Nama_Kamar || '-'}${b.Gedung ? ' · ' + b.Gedung : ''}`} />
          <Row label="Layanan" value={layanan} />
          <Row label="Tipe" value={b.Tipe_Kamar} />
          <Row label="Durasi / paket" value={b.Paket || b.Durasi} />
          <Row label="Jumlah orang" value={b.Jumlah_Orang ? `${b.Jumlah_Orang} orang` : ''} />
          <Row label="Fasilitas" value={p.fasilitas} />
          <Row label="Extra bed" value={p.extraBed ? `${p.extraBed} buah` : ''} />
          <Row label="Tanggal masuk" value={tglID(b.CheckIn)} />
          {b.tag_perpanjangan ? <Row label="Perpanjangan dari" value={b.tag_perpanjangan} /> : null}
        </div>

        {/* Biaya */}
        <div className="rounded-kk-card border-2 border-kk-mint p-4 mb-5" style={{ background: '#EEF6F0' }}>
          <Row label="Estimasi total" value={p.estimasi ? `Rp ${p.estimasi}` : '—'} />
          <Row label="DP dibayar" value={p.dp ? `Rp ${p.dp}` : '—'} />
          {p.estimasi && p.dp ? <Row label="Sisa (belum lunas)" value={rupiah(sisa)} /> : null}
        </div>

        {b.Catatan ? <p className="text-[12px] text-kk-ink/80 leading-snug mb-5 whitespace-pre-line">📝 {b.Catatan}</p> : null}

        {/* Aksi */}
        <div className="grid grid-cols-2 gap-2">
          <KkButton variant="success" onClick={() => onConfirm('DP')} disabled={busy}>Terima · DP</KkButton>
          <KkButton variant="success" onClick={() => onConfirm('Lunas')} disabled={busy}>Terima · Lunas</KkButton>
        </div>
        <KkButton variant="ghost" block onClick={onReject} disabled={busy} className="mt-2">Tolak booking</KkButton>
        <KkButton variant="secondary" block onClick={onClose} disabled={busy} className="mt-2">Tutup</KkButton>
      </div>
    </Sheet>
  );
}
