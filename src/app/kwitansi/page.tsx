'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kwitansiApi, type KwitansiSettings } from '@/lib/api-v2';
import { api, type BookingDetail, type BookingItem } from '@/lib/api';
import { Topbar } from '@/components/topbar';
import { formatRupiah, formatDate } from '@/lib/utils';
import { downloadAsPNG, copyAsPNGToClipboard } from '@/lib/image-export';
import { toast } from 'sonner';

const ACCENT_COLORS = [
  { name: 'Hitam', value: '#0C0A09' },
  { name: 'Biru', value: '#1D4ED8' },
  { name: 'Hijau', value: '#15803D' },
  { name: 'Ungu', value: '#6D28D9' },
  { name: 'Merah', value: '#B91C1C' },
  { name: 'Amber', value: '#B45309' },
  { name: 'Coklat', value: '#78350F' },
  { name: 'Teal', value: '#0F766E' },
];

const FONT_STYLES = [
  { value: 'default', name: 'Default (Inter)', preview: 'Aa', stack: '"Inter", system-ui, sans-serif' },
  { value: 'serif', name: 'Serif (Instrument)', preview: 'Aa', stack: '"Instrument Serif", Georgia, serif' },
  { value: 'elegant', name: 'Elegant', preview: 'Aa', stack: 'Georgia, "Times New Roman", serif' },
  { value: 'classic', name: 'Classic', preview: 'Aa', stack: '"Courier New", monospace' },
];

const LAYOUTS = [
  { value: 'standard', name: 'Standard', icon: '◫' },
  { value: 'center', name: 'Center', icon: '◳' },
  { value: 'compact', name: 'Compact', icon: '▤' },
];

export default function KwitansiPage() {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kwitansi-settings'],
    queryFn: kwitansiApi.get,
  });

  const { data: initialData } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // All bookings (for picker)
  const allBookings: BookingItem[] = (() => {
    const set = new Map<string, BookingItem>();
    (initialData?.paymentBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.statusActionBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.closingBookings || []).forEach((b) => set.set(b.BookingID, b));
    return Array.from(set.values()).sort((a, b) => {
      const ta = a.CheckIn ? new Date(a.CheckIn).getTime() : 0;
      const tb = b.CheckIn ? new Date(b.CheckIn).getTime() : 0;
      return tb - ta;
    });
  })();

  // Selected booking detail (for real preview)
  const { data: selectedBooking } = useQuery({
    queryKey: ['booking-detail', selectedBookingId],
    queryFn: () => api.getBookingDetail(selectedBookingId),
    enabled: !!selectedBookingId,
  });

  const [form, setForm] = useState<Partial<KwitansiSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function setField<K extends keyof KwitansiSettings>(key: K, value: KwitansiSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSubmitting(true);
    try {
      await kwitansiApi.save(form);
      toast.success('✓ Setting kwitansi disimpan');
      queryClient.invalidateQueries({ queryKey: ['kwitansi-settings'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPNG() {
    if (!previewRef.current) return;
    const toastId = toast.loading('⏳ Generating PNG...');
    try {
      const customerName = selectedBooking?.booking?.Nama_Customer || 'preview';
      const filename = `kwitansi-${customerName.replace(/\s+/g, '_')}-${Date.now()}`;
      await downloadAsPNG({
        element: previewRef.current,
        filename,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      toast.success('✓ PNG ke-download', { id: toastId });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    }
  }

  async function handleCopyToClipboard() {
    if (!previewRef.current) return;
    const toastId = toast.loading('⏳ Copying to clipboard...');
    try {
      const result = await copyAsPNGToClipboard({
        element: previewRef.current,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      if (result.method === 'clipboard') {
        toast.success('✓ Copied! Paste ke WA Web / Email / etc dengan Ctrl+V', { id: toastId });
      } else {
        toast.success('✓ Clipboard tidak available, ke-download sbg fallback', { id: toastId });
      }
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    }
  }

  if (isLoading) {
    return (
      <>
        <Topbar />
        <div className="px-6 py-12 text-center text-tx3">⏳ Loading...</div>
      </>
    );
  }

  return (
    <>
      <Topbar />

      <div className="px-6 py-6 max-w-7xl mx-auto print:max-w-none print:px-0 print:py-0">
        {/* Header — hidden in print */}
        <div className="mb-5 print:hidden">
          <Link href="/setting" className="text-tx3 text-xs hover:text-ac inline-flex items-center gap-1 mb-1">
            ← Setting
          </Link>
          <div className="flex justify-between items-start gap-3">
            <div>
              <h1 className="font-serif text-3xl tracking-tight">Kwitansi Customizer</h1>
              <p className="text-tx3 text-sm mt-1">
                Atur tampilan kwitansi yang dicetak untuk customer
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleDownloadPNG} className="btn btn-pri text-xs">
                💾 Download PNG
              </button>
              <button onClick={handleCopyToClipboard} className="btn btn-sec text-xs">
                📋 Copy ke Clipboard
              </button>
              <button onClick={handlePrint} className="btn btn-sec text-xs">
                🖨️ Print
              </button>
              <button onClick={handleSave} disabled={submitting} className="btn btn-sec text-xs">
                {submitting ? '⏳ Saving...' : '💾 Simpan Setting'}
              </button>
            </div>
          </div>
        </div>

        {/* Booking picker — for previewing with real customer data */}
        <div className="bg-blb border border-bl rounded-md p-3 mb-4 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-bl">📋 Preview dengan booking:</label>
            <select
              value={selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value)}
              className="input text-xs flex-1 min-w-[200px] max-w-md"
            >
              <option value="">— Pakai data dummy (preview design) —</option>
              {allBookings.slice(0, 50).map((b) => (
                <option key={b.BookingID} value={b.BookingID}>
                  {b.Nama_Customer} · {b.Nama_Kamar} · {formatRupiah(b.Harga_Total_Net)} ({b.Status_Booking})
                </option>
              ))}
            </select>
            {selectedBookingId && (
              <button
                onClick={() => setSelectedBookingId('')}
                className="text-bl text-xs hover:underline"
              >
                ✕ Reset
              </button>
            )}
          </div>
          <div className="text-bl text-[10px] mt-1.5">
            💡 Pilih booking → preview update dengan nama customer asli → download PNG → kirim ke customer via WA
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-5 print:block">
          {/* LEFT: Editor — hidden in print */}
          <aside className="space-y-5 print:hidden">
            {/* Theme */}
            <Section title="🎨 Tema Warna">
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setField('accent_color', c.value)}
                    className={
                      form.accent_color === c.value
                        ? 'aspect-square rounded-md border-2 border-ac ring-2 ring-ac/30 flex items-end justify-center pb-1'
                        : 'aspect-square rounded-md border-2 border-bd hover:border-bds flex items-end justify-center pb-1'
                    }
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {form.accent_color === c.value && (
                      <span className="text-white text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </Section>

            {/* Font */}
            <Section title="🔤 Font">
              <div className="grid grid-cols-2 gap-2">
                {FONT_STYLES.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setField('font_style', f.value as KwitansiSettings['font_style'])}
                    className={
                      form.font_style === f.value
                        ? 'border-2 border-ac rounded-md p-3 text-center'
                        : 'border-2 border-bd hover:border-bds rounded-md p-3 text-center'
                    }
                    style={{ fontFamily: f.stack }}
                  >
                    <div className="text-2xl mb-1">{f.preview}</div>
                    <div className="text-[10px] font-medium">{f.name}</div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Layout */}
            <Section title="📐 Layout">
              <div className="grid grid-cols-3 gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setField('layout', l.value as KwitansiSettings['layout'])}
                    className={
                      form.layout === l.value
                        ? 'border-2 border-ac rounded-md p-3 text-center'
                        : 'border-2 border-bd hover:border-bds rounded-md p-3 text-center'
                    }
                  >
                    <div className="text-xl mb-1">{l.icon}</div>
                    <div className="text-[10px] font-medium">{l.name}</div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Logo */}
            <Section title="🎯 Logo">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setField('logo_mode', 'letter')}
                  className={
                    form.logo_mode === 'letter'
                      ? 'flex-1 btn btn-pri text-xs'
                      : 'flex-1 btn btn-sec text-xs'
                  }
                >
                  Inisial Huruf
                </button>
                <button
                  onClick={() => setField('logo_mode', 'image')}
                  className={
                    form.logo_mode === 'image'
                      ? 'flex-1 btn btn-pri text-xs'
                      : 'flex-1 btn btn-sec text-xs'
                  }
                >
                  Gambar
                </button>
              </div>
              {form.logo_mode === 'letter' && (
                <input
                  type="text"
                  value={form.logo_letter || ''}
                  onChange={(e) => setField('logo_letter', e.target.value.slice(0, 2).toUpperCase())}
                  maxLength={2}
                  placeholder="KK"
                  className="input text-center font-bold text-xl"
                />
              )}
              {form.logo_mode === 'image' && (
                <div className="text-tx3 text-[11px] bg-sf2 border border-bd rounded-md p-3">
                  💡 Upload gambar logo akan tersedia di update berikutnya. Sementara pake mode "Inisial Huruf".
                </div>
              )}
            </Section>

            {/* Custom Text */}
            <Section title="✏️ Custom Text">
              <FormField label="Judul Kwitansi">
                <input
                  type="text"
                  value={form.title_text || ''}
                  onChange={(e) => setField('title_text', e.target.value)}
                  placeholder="KWITANSI PEMBAYARAN"
                  className="input"
                />
              </FormField>
              <FormField label="Pesan Terima Kasih">
                <input
                  type="text"
                  value={form.thankyou_text || ''}
                  onChange={(e) => setField('thankyou_text', e.target.value)}
                  placeholder="Terima kasih atas pembayarannya"
                  className="input"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Nama TTD">
                  <input
                    type="text"
                    value={form.sig_name || ''}
                    onChange={(e) => setField('sig_name', e.target.value)}
                    className="input"
                  />
                </FormField>
                <FormField label="Jabatan TTD">
                  <input
                    type="text"
                    value={form.sig_title || ''}
                    onChange={(e) => setField('sig_title', e.target.value)}
                    className="input"
                  />
                </FormField>
              </div>
            </Section>

            {/* Toggles */}
            <Section title="⚙️ Display">
              <label className="flex items-center gap-2 p-2 bg-sf2 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_tagline ?? true}
                  onChange={(e) => setField('show_tagline', e.target.checked)}
                  className="w-4 h-4 accent-ac"
                />
                <span className="text-xs font-medium">Tampilkan tagline</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-sf2 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_stamp ?? true}
                  onChange={(e) => setField('show_stamp', e.target.checked)}
                  className="w-4 h-4 accent-ac"
                />
                <span className="text-xs font-medium">Tampilkan kotak stempel</span>
              </label>
            </Section>
          </aside>

          {/* RIGHT: Preview — visible in print */}
          <main className="lg:sticky lg:top-4 lg:self-start print:static">
            <div className="bg-sf2 border border-bd rounded-md p-4 mb-2 text-center text-tx3 text-[11px] font-medium print:hidden">
              👁️ Live Preview · {selectedBooking ? `Data booking ${selectedBooking.booking.Nama_Customer}` : 'Data dummy'}
            </div>
            <div ref={previewRef}>
              <KwitansiPreview settings={form} bookingData={selectedBooking} />
            </div>
          </main>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:static { position: static !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}

// ===========================================
// Kwitansi Live Preview
// ===========================================

function KwitansiPreview({
  settings,
  bookingData,
}: {
  settings: Partial<KwitansiSettings>;
  bookingData?: BookingDetail;
}) {
  const accent = settings.accent_color || '#0C0A09';
  const fontStack =
    FONT_STYLES.find((f) => f.value === settings.font_style)?.stack || FONT_STYLES[0].stack;
  const layout = settings.layout || 'standard';

  // Use real booking data if provided, else dummy
  const isReal = !!bookingData;
  const b = bookingData?.booking;
  const payments = bookingData?.payments || [];

  const data = isReal && b
    ? {
        no: b.BookingID || '-',
        tanggal: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        customer: b.Nama_Customer || '-',
        kamar: `${b.Nama_Kamar || '-'} (${b.RoomID || '-'})`,
        paket: `${b.Paket || '-'} · ${b.Jumlah_Periode || 1} periode`,
        items: (() => {
          const items: Array<{ label: string; value: number }> = [];
          if (b.Harga_Kamar) {
            items.push({
              label: `Harga kamar (${b.Jumlah_Periode || 1} × ${formatRupiah(Number(b.Harga_Kamar) / (Number(b.Jumlah_Periode) || 1))})`,
              value: Number(b.Harga_Kamar) || 0,
            });
          }
          if (Number(b.Extra_Charge) > 0) {
            items.push({ label: 'Biaya tambahan', value: Number(b.Extra_Charge) });
          }
          if (Number(b.Diskon) > 0) {
            items.push({ label: 'Diskon', value: -Number(b.Diskon) });
          }
          return items;
        })(),
        total: Number(b.Harga_Total_Net) || 0,
        dibayar: Number(b.Total_Bayar) || 0,
        sisa: Number(b.Sisa_Bayar) || 0,
        status: b.Status_Bayar || '',
        paymentInfo: payments.length > 0
          ? `${payments.length} pembayaran · terakhir: ${formatDate(payments[payments.length - 1].Tanggal_Bayar)}`
          : '',
      }
    : {
        no: 'BK-PNG-260601-145532',
        tanggal: new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        customer: 'Pak Budi Santoso',
        kamar: 'Gedung A Deluxe (A05)',
        paket: 'Bulanan · 3 periode',
        items: [
          { label: 'Harga kamar (3 × Rp 800.000)', value: 2400000 },
          { label: 'AC + WiFi (3 periode)', value: 600000 },
          { label: 'Diskon promo', value: -200000 },
        ],
        total: 2800000,
        dibayar: 1500000,
        sisa: 1300000,
        status: '',
        paymentInfo: '',
      };

  return (
    <div
      className="bg-white shadow-lg rounded-md max-w-[600px] mx-auto"
      style={{ fontFamily: fontStack }}
    >
      <div className={layout === 'compact' ? 'p-6' : 'p-8'}>
        {/* Header */}
        <div className={layout === 'center' ? 'text-center mb-6' : 'flex justify-between items-start mb-6'}>
          <div className={layout === 'center' ? 'flex flex-col items-center' : 'flex items-start gap-3'}>
            {settings.logo_mode !== 'image' && (
              <div
                className="w-12 h-12 rounded-md flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                style={{ backgroundColor: accent }}
              >
                {settings.logo_letter || 'KK'}
              </div>
            )}
            <div className={layout === 'center' ? 'mt-2' : ''}>
              <div className="font-bold text-base" style={{ color: accent }}>
                {settings.business_name || 'Nama Bisnis Anda'}
              </div>
              {settings.show_tagline && settings.tagline && (
                <div className="text-xs text-gray-600 italic">{settings.tagline}</div>
              )}
            </div>
          </div>
          {layout === 'standard' && (
            <div className="text-right text-[10px] text-gray-600 max-w-[200px]">
              {settings.alamat && (
                <div className="whitespace-pre-wrap leading-tight">{settings.alamat}</div>
              )}
              {settings.kontak && (
                <div className="mt-1 whitespace-pre-wrap leading-tight">{settings.kontak}</div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div
          className={`pb-3 mb-4 border-b-2 ${layout === 'center' ? 'text-center' : ''}`}
          style={{ borderColor: accent }}
        >
          <div className="font-bold text-lg tracking-wider" style={{ color: accent }}>
            {settings.title_text || 'KWITANSI PEMBAYARAN'}
          </div>
          <div className="text-[10px] text-gray-600 mt-0.5 tabular-nums">
            No: {data.no} · {data.tanggal}
          </div>
        </div>

        {/* Customer info */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Penyewa</div>
            <div className="font-semibold">{data.customer}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Kamar</div>
            <div className="font-semibold">{data.kamar}</div>
            <div className="text-[10px] text-gray-600">{data.paket}</div>
          </div>
        </div>

        {/* Items */}
        <div className="border-y border-gray-200 py-3 mb-3">
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs py-1">
              <span className={item.value < 0 ? 'text-gray-600' : ''}>{item.label}</span>
              <span className={`tabular-nums font-medium ${item.value < 0 ? 'text-red-600' : ''}`}>
                {item.value < 0 ? '-' : ''}
                {formatRupiah(Math.abs(item.value))}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mb-5 space-y-1">
          <div className="flex justify-between text-xs">
            <span>Total</span>
            <span className="font-bold tabular-nums">{formatRupiah(data.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-green-700">
            <span>Sudah Dibayar</span>
            <span className="font-bold tabular-nums">{formatRupiah(data.dibayar)}</span>
          </div>
          <div
            className="flex justify-between text-sm pt-2 mt-1 border-t-2 font-bold"
            style={{ borderColor: accent, color: accent }}
          >
            <span>{data.sisa <= 0 ? 'LUNAS' : 'SISA'}</span>
            <span className="tabular-nums">{formatRupiah(Math.max(0, data.sisa))}</span>
          </div>
          {data.status && (
            <div className="flex justify-between text-[10px] text-gray-500 pt-1">
              <span>Status: {data.status}</span>
              {data.paymentInfo && <span className="italic">{data.paymentInfo}</span>}
            </div>
          )}
        </div>

        {/* Thank you + signature */}
        <div className={layout === 'center' ? 'text-center' : 'flex justify-between items-end gap-4'}>
          <div className="text-xs italic text-gray-600 max-w-[280px]">
            {settings.thankyou_text || 'Terima kasih atas pembayarannya.'}
          </div>
          {settings.show_stamp && (
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded h-16 w-32 mb-1 flex items-center justify-center text-[9px] text-gray-400">
                stempel/ttd
              </div>
              <div className="text-[10px] font-semibold">{settings.sig_name || '(_______)'}</div>
              <div className="text-[9px] text-gray-600">{settings.sig_title || 'Admin'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================
// Sub-components
// ===========================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-sf border border-bd rounded-md p-4">
      <h3 className="font-bold text-xs uppercase tracking-wider text-tx3 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-tx2 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
