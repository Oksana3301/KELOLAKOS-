'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type BookingItem } from '@/lib/api';
import { kwitansiApi } from '@/lib/api-v2';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { rupiah, tglPanjang, mapPayStatus, type PayStatus } from '@/components/kk/status';
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

  // Business profile (saved in Pengaturan → Profil Bisnis). Same query key,
  // so the kwitansi updates whenever the owner edits & saves the profile.
  const { data: settings } = useQuery({
    queryKey: ['kwitansi-settings'],
    queryFn: kwitansiApi.get,
  });

  const businessName = settings?.business_name?.trim() || 'KelolaKos';
  const logoLetter = (settings?.logo_letter?.trim() || businessName[0] || 'K').toUpperCase();
  const showTagline = Boolean(settings?.show_tagline && settings?.tagline?.trim());
  const alamat = settings?.alamat?.trim() || '';
  const kontak = settings?.kontak?.trim() || '';
  const contactLine = [alamat, kontak].filter(Boolean).join(' · ');

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
      // Make sure the custom fonts are ready so the capture isn't rendered with a fallback.
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
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
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
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
          {/* Export target — a TIGHT fixed-width card (so the exported PNG/PDF
              isn't a wide page with the receipt floating in the middle). */}
          <div ref={previewRef} className="bg-white mx-auto w-full max-w-[460px] p-3">
            <div className="w-full bg-white border-2 border-kk-mauve rounded-kk-card px-6 pt-7 pb-6">
              {/* Header: centered logo + business name + (optional) tagline/contact + status.
                  Uses the saved Profil Bisnis settings — tidy & clip-safe on export. */}
              <div className="text-center border-b-2 border-dashed border-kk-mauve pb-5 mb-2">
                <div className="flex items-center justify-center gap-2.5 mb-2.5">
                  <div className="w-11 h-11 rounded-[12px] bg-kk-orange text-white grid place-items-center font-heading font-black text-[24px] flex-shrink-0 leading-none">
                    {logoLetter}
                  </div>
                  <div className="font-heading font-black text-[22px] text-kk-navy leading-none">
                    {businessName}
                  </div>
                </div>
                {showTagline && (
                  <div className="text-caption text-kk-ink leading-snug mb-2">{settings?.tagline}</div>
                )}
                {contactLine && (
                  <div className="text-caption text-kk-ink leading-snug mb-2">{contactLine}</div>
                )}
                <div className="font-body font-semibold text-caption text-kk-ink tracking-wide mb-3">
                  KWITANSI PEMBAYARAN
                </div>
                <div className="flex items-center justify-center">
                  <ReceiptStatus status={mapPayStatus(selected)} />
                </div>
              </div>

              <ReceiptRow label="Nama penyewa" value={selected.Nama_Customer || '-'} />
              <ReceiptRow label="Kamar" value={selected.Nama_Kamar || '-'} />
              <ReceiptRow
                label="Periode sewa"
                value={`${tglPanjang(selected.CheckIn)} – ${tglPanjang(selected.CheckOut)}`}
              />
              <ReceiptRow label="Total sewa" value={rupiah(total)} />
              <ReceiptRow label="Sudah dibayar" value={rupiah(dibayar)} valueClass="text-kk-green" />
              {sisa > 0 && (
                <ReceiptRow label="Sisa tagihan" value={rupiah(sisa)} valueClass="text-kk-orange" />
              )}

              {/* Emphasized total box */}
              <div
                className={
                  'rounded-[14px] border-2 px-[18px] py-3.5 mt-4 flex justify-between items-center gap-3 ' +
                  (sisa > 0 ? 'bg-kk-orange-soft border-[#E7BCAD]' : 'bg-kk-mint-soft border-kk-mint')
                }
              >
                <span className="font-heading font-bold text-[17px] text-kk-navy leading-tight">
                  {sisa > 0 ? 'Masih harus dibayar' : 'Lunas — tidak ada sisa'}
                </span>
                <span
                  className={
                    'font-heading font-black text-[22px] whitespace-nowrap leading-none ' +
                    (sisa > 0 ? 'text-kk-orange' : 'text-kk-green')
                  }
                >
                  {rupiah(sisa > 0 ? sisa : total)}
                </span>
              </div>
            </div>
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

// Export-safe receipt row: items-center (not baseline) so html2canvas keeps it tidy.
function ReceiptRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center gap-3 py-2.5 border-b border-kk-mauve-soft">
      <span className="text-[17px] text-kk-ink leading-tight">{label}</span>
      <span className={'font-heading font-bold text-[18px] text-right leading-tight text-kk-navy ' + (valueClass || '')}>
        {value}
      </span>
    </div>
  );
}

// Export-safe status chip: inline-flex centered, solid fill, no fragile baseline.
function ReceiptStatus({ status }: { status: PayStatus }) {
  const map: Record<PayStatus, string> = {
    Lunas: 'bg-kk-green text-white',
    'Belum Bayar': 'bg-kk-orange text-white',
    DP: 'bg-kk-yellow text-kk-navy',
    Batal: 'bg-kk-mauve text-kk-navy',
  };
  return (
    <span
      className={
        'inline-flex items-center justify-center rounded-full font-body font-semibold text-[15px] px-3.5 py-1.5 leading-tight whitespace-nowrap ' +
        map[status]
      }
    >
      {status}
    </span>
  );
}
