'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BuktiFile } from '@/lib/api';
import { TH, TH_SERIF } from '@/lib/tophills-theme';
import { THCard, THBtn, THField } from '@/components/info/booking-shell';
import { formatRupiah } from '@/lib/booking-pricing';
import { fileToBukti } from '@/lib/bukti-upload';

const CARA_BAYAR =
  'Transfer ke rekening atau scan QRIS sesuai nominal, lalu upload bukti transfer di bawah. Booking aktif setelah admin verifikasi (maks 1×24 jam). 🌸';

export function PaymentStep({ layanan, total, dp = 0, ringkas, bayar, onSubmit, submitting, onBack }: {
  layanan: 'KOS' | 'PENGINAPAN';
  total: number;
  dp?: number;
  ringkas: string;
  bayar: 'DP' | 'Full';
  onSubmit: (bukti: BuktiFile | null) => void;
  submitting?: boolean;
  onBack: () => void;
}) {
  const { data: pay, isLoading } = useQuery({ queryKey: ['payment-info'], queryFn: api.getPaymentInfo, retry: 0, staleTime: 60_000 });
  const rek = layanan === 'KOS' ? pay?.kost : pay?.penginapan;
  // QRIS hanya untuk PENGINAPAN. Kost transfer manual (tanpa QR).
  const showQr = layanan !== 'KOS' && !!rek?.qr;
  const [bukti, setBukti] = useState<BuktiFile | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setBukti(await fileToBukti(file)); toast.success('Bukti siap ✓'); }
    catch (err) { toast.error('Gagal: ' + (err as Error).message); }
    finally { setBusy(false); }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success('Disalin: ' + text)).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-[13px] font-semibold" style={{ color: TH.brownSoft }}>‹ Kembali ubah data</button>

      {/* Ringkasan */}
      <div className="rounded-[16px] p-4" style={{ background: TH.greenSoft, border: '1px solid #BFE0CD' }}>
        {bayar === 'DP' && dp > 0 ? (
          <>
            <div className="flex justify-between text-[13px]" style={{ color: TH.brownSoft }}>
              <span>Total estimasi</span><span>{formatRupiah(total)}</span>
            </div>
            <div className="flex justify-between items-baseline mt-1.5">
              <span className="text-[13px] font-semibold" style={{ color: TH.green }}>Bayar DP sekarang</span>
              <span className="text-[22px] font-bold" style={{ fontFamily: TH_SERIF, color: TH.brown }}>{formatRupiah(dp)}</span>
            </div>
            <div className="flex justify-between text-[13px] mt-1 font-semibold" style={{ color: TH.danger }}>
              <span>Sisa (belum lunas)</span><span>{formatRupiah(Math.max(0, total - dp))}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-semibold" style={{ color: TH.green }}>Total (Lunas)</span>
            <span className="text-[22px] font-bold" style={{ fontFamily: TH_SERIF, color: TH.brown }}>{total > 0 ? formatRupiah(total) : '—'}</span>
          </div>
        )}
        <div className="text-[12.5px] mt-1.5" style={{ color: TH.brownSoft }}>{ringkas}</div>
      </div>

      {/* Cara bayar + rekening + QR */}
      <THCard className="space-y-3">
        <div className="text-[15px] font-bold" style={{ color: TH.brown }}>Cara Pembayaran</div>
        <p className="text-[13px] leading-relaxed m-0" style={{ color: TH.brownSoft }}>
          {showQr
            ? CARA_BAYAR
            : 'Transfer ke rekening di bawah sesuai nominal, lalu upload bukti transfer. Booking aktif setelah admin verifikasi (maks 1×24 jam). 🌸'}
        </p>

        {isLoading ? (
          <p className="text-[13px]" style={{ color: TH.brownSoft }}>Memuat info pembayaran…</p>
        ) : rek && (rek.nomor || showQr) ? (
          <div className="rounded-[12px] p-3.5" style={{ background: TH.cream, border: `1px solid ${TH.border}` }}>
            <div className="text-[12px] font-semibold mb-2" style={{ color: TH.gold }}>
              {layanan === 'KOS' ? '🏠 Rekening Kost' : '🛏️ Rekening Penginapan'}
            </div>
            {rek.nomor && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[16px] font-bold" style={{ color: TH.brown }}>{rek.bank} · {rek.nomor}</div>
                  <div className="text-[12.5px]" style={{ color: TH.brownSoft }}>a.n {rek.atasNama}</div>
                </div>
                <button onClick={() => copy(rek.nomor)} className="text-[12px] font-bold px-3 py-1.5 rounded-full" style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown }}>Salin</button>
              </div>
            )}
            {showQr && (
              <div className="mt-3 text-center">
                <div className="text-[12px] mb-1.5" style={{ color: TH.brownSoft }}>atau scan QRIS:</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rek.qr} alt="QRIS" className="inline-block rounded-[10px]" style={{ width: 180, height: 180, objectFit: 'contain', border: `1px solid ${TH.border}`, background: '#fff' }} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[12px] p-3.5 text-[13px]" style={{ background: '#FBF1D8', border: '1px solid #E7D3A0', color: '#8A6A24' }}>
            Info rekening belum diisi admin. Hubungi Helpdesk untuk nomor rekening, ya 🙏
          </div>
        )}
      </THCard>

      {/* Upload bukti */}
      <THCard className="space-y-3">
        <THField label="Upload bukti transfer (wajib)" hint="Foto / screenshot bukti bayar (jpg/png)">
          <label className="flex items-center justify-center gap-2 min-h-[52px] rounded-[12px] cursor-pointer text-[14px] font-semibold" style={{ border: `1.5px dashed ${TH.goldSoft}`, background: '#fff', color: TH.gold }}>
            {busy ? 'Memproses…' : bukti ? '✓ Ganti bukti' : '📎 Pilih file bukti'}
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
          </label>
        </THField>
        {bukti && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:${bukti.mimeType};base64,${bukti.base64}`} alt="bukti" className="rounded-[10px]" style={{ width: 56, height: 56, objectFit: 'cover', border: `1px solid ${TH.border}` }} />
            <span className="text-[13px] flex-1 truncate" style={{ color: TH.brownSoft }}>{bukti.name}</span>
            <button onClick={() => setBukti(null)} className="text-[12px] font-semibold" style={{ color: TH.danger }}>Hapus</button>
          </div>
        )}
      </THCard>

      {!bukti && (
        <div className="rounded-[12px] px-4 py-3 text-[12.5px] text-center" style={{ background: '#FBE9E2', border: '1px solid #E8C3B3', color: TH.danger }}>
          ⚠️ Bukti transfer <b>wajib diupload</b> dulu untuk bisa konfirmasi booking.
        </div>
      )}

      <THBtn variant="gold" block onClick={() => bukti && onSubmit(bukti)} disabled={submitting || busy || !bukti}>
        {submitting ? 'Mengirim…' : 'Kirim Bukti & Selesaikan Booking ›'}
      </THBtn>
      <p className="text-[11.5px] text-center" style={{ color: TH.brownSoft }}>
        Booking dikonfirmasi admin setelah bukti diverifikasi (maks 1×24 jam).
      </p>
    </div>
  );
}
