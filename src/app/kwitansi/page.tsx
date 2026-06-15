'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type BookingItem } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, InfoRow, BayarBadge } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { rupiah, tglPanjang, mapPayStatus } from '@/components/kk/status';
import { downloadAsPNG, copyAsPNGToClipboard } from '@/lib/image-export';

const HELP = {
  title: 'Kwitansi',
  tips: [
    'Pilih penyewa yang sudah membayar (Lunas atau DP) untuk membuat bukti pembayaran.',
    'Periksa dulu isi kwitansi: nama, kamar, periode sewa, dan jumlah yang sudah dibayar.',
    'Tekan "Kirim lewat WhatsApp" untuk menyalin kwitansi, atau "Simpan PDF" untuk mengunduhnya.',
  ],
};

export default function KwitansiPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  const { data: initialData } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // Tenants for the picker — only those who have paid something (Lunas / DP).
  const tenants: BookingItem[] = useMemo(() => {
    const set = new Map<string, BookingItem>();
    (initialData?.paymentBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.statusActionBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.closingBookings || []).forEach((b) => set.set(b.BookingID, b));
    return Array.from(set.values())
      .filter((b) => {
        const s = mapPayStatus(b);
        return s === 'Lunas' || s === 'DP';
      })
      .sort((a, b) => {
        const ta = a.CheckIn ? new Date(a.CheckIn).getTime() : 0;
        const tb = b.CheckIn ? new Date(b.CheckIn).getTime() : 0;
        return tb - ta;
      });
  }, [initialData]);

  // Default-select the first tenant once the list loads.
  useEffect(() => {
    if (!selectedId && tenants.length > 0) setSelectedId(tenants[0].BookingID);
  }, [tenants, selectedId]);

  const selected = useMemo(
    () => tenants.find((b) => b.BookingID === selectedId) || null,
    [tenants, selectedId],
  );

  const total = Number(selected?.Harga_Total_Net) || 0;
  const dibayar = Number(selected?.Net_Diterima ?? selected?.Total_Bayar) || 0;
  const sisa = Number(selected?.Sisa_Bayar) || 0;

  async function handleSendWhatsApp() {
    if (!previewRef.current) return;
    const toastId = toast.loading('Menyiapkan kwitansi…');
    try {
      const result = await copyAsPNGToClipboard({
        element: previewRef.current,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      if (result.method === 'clipboard') {
        toast.success('Kwitansi tersalin. Buka WhatsApp lalu tempel dengan Ctrl+V.', { id: toastId });
      } else {
        toast.success('Kwitansi diunduh sebagai gambar untuk dikirim lewat WhatsApp.', { id: toastId });
      }
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    }
  }

  async function handleSavePDF() {
    if (!previewRef.current) return;
    const toastId = toast.loading('Menyiapkan berkas…');
    try {
      const name = selected?.Nama_Customer || 'penyewa';
      const filename = `kwitansi-${name.replace(/\s+/g, '_')}-${Date.now()}`;
      await downloadAsPNG({
        element: previewRef.current,
        filename,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      toast.success('Kwitansi tersimpan.', { id: toastId });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    }
  }

  return (
    <>
      <ScreenHead
        title="Kwitansi"
        sub="Buat bukti pembayaran untuk penyewa."
        onHelp={() => setHelpOpen(true)}
      />

      {/* 1. Pilih penyewa */}
      <StepHeading n={1} title="Pilih penyewa" />
      {tenants.length === 0 ? (
        <KkCard tone="mint" className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white text-kk-navy grid place-items-center flex-shrink-0">
            <KkIcon name="info" size={26} />
          </div>
          <p className="text-body text-kk-navy m-0">
            Belum ada penyewa yang membayar. Catat pembayaran dulu di menu Booking.
          </p>
        </KkCard>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {tenants.map((b) => {
            const active = b.BookingID === selectedId;
            return (
              <button
                key={b.BookingID}
                onClick={() => setSelectedId(b.BookingID)}
                aria-pressed={active}
                className={
                  'flex-shrink-0 min-h-[48px] px-[18px] rounded-[12px] cursor-pointer font-body font-semibold text-[17px] whitespace-nowrap border-2 transition-colors ' +
                  (active
                    ? 'border-kk-navy bg-kk-navy text-white'
                    : 'border-kk-mauve bg-white text-kk-navy')
                }
              >
                {b.Nama_Customer || '(tanpa nama)'}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Periksa kwitansi */}
      {selected && (
        <>
          <StepHeading n={2} title="Periksa kwitansi" className="mt-7" />
          <div ref={previewRef}>
            <KkCard className="bg-white">
              {/* Header: logo + name + status badge */}
              <div className="flex justify-between items-center gap-3 border-b-2 border-dashed border-kk-mauve pb-4 mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-[10px] bg-kk-orange text-white grid place-items-center font-heading font-black text-[22px] flex-shrink-0">
                    K
                  </div>
                  <div className="font-heading font-black text-[20px] text-kk-navy">KelolaKos</div>
                </div>
                <BayarBadge status={mapPayStatus(selected)} />
              </div>

              <InfoRow label="Nama penyewa" value={selected.Nama_Customer || '-'} />
              <InfoRow label="Kamar" value={selected.Nama_Kamar || '-'} />
              <InfoRow
                label="Periode sewa"
                value={`${tglPanjang(selected.CheckIn)} – ${tglPanjang(selected.CheckOut)}`}
              />
              <InfoRow label="Total sewa" value={rupiah(total)} />
              <InfoRow label="Sudah dibayar" value={rupiah(dibayar)} accent="green" />
              {sisa > 0 && <InfoRow label="Sisa tagihan" value={rupiah(sisa)} accent="orange" />}

              {/* Emphasized total box */}
              <div
                className={
                  'rounded-[14px] border-2 px-[18px] py-3.5 mt-4 flex justify-between items-center gap-3 ' +
                  (sisa > 0
                    ? 'bg-kk-orange-soft border-[#E7BCAD]'
                    : 'bg-kk-mint-soft border-kk-mint')
                }
              >
                <span className="font-heading font-bold text-[18px] text-kk-navy">
                  {sisa > 0 ? 'Masih harus dibayar' : 'Lunas — tidak ada sisa'}
                </span>
                <span
                  className={
                    'font-heading font-black text-[22px] whitespace-nowrap ' +
                    (sisa > 0 ? 'text-kk-orange' : 'text-kk-green')
                  }
                >
                  {rupiah(sisa > 0 ? sisa : total)}
                </span>
              </div>
            </KkCard>
          </div>

          {/* 3. Kirim ke penyewa */}
          <StepHeading n={3} title="Kirim ke penyewa" className="mt-7" />
          <div className="space-y-3">
            <KkButton variant="primary" size="lg" block onClick={handleSendWhatsApp}>
              <KkIcon name="kirim" size={22} strokeWidth={2.2} /> Kirim lewat WhatsApp
            </KkButton>
            <KkButton variant="secondary" block onClick={handleSavePDF}>
              <KkIcon name="unduh" size={22} strokeWidth={2.2} /> Simpan PDF
            </KkButton>
          </div>
        </>
      )}

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
    </>
  );
}

function StepHeading({ n, title, className }: { n: number; title: string; className?: string }) {
  return (
    <div className={'flex items-center gap-3 mb-3 ' + (className || '')}>
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-kk-navy text-white grid place-items-center font-heading font-black text-[17px]">
        {n}
      </span>
      <h2 className="font-heading font-bold text-subhead text-kk-navy m-0">{title}</h2>
    </div>
  );
}
