'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type BookingItem } from '@/lib/api';
import { kwitansiApi, type KwitansiSettings } from '@/lib/api-v2';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { mapPayStatus } from '@/components/kk/status';
import { downloadAsPNG, copyAsPNGToClipboard } from '@/lib/image-export';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import { ALL_ROOMS, roomKey } from '@/lib/building-layout';
import {
  bookingToInvoice, digitsOnly, deriveInvoice, rp, DEFAULT_IDENTITY, SEED_SCENARIOS, SCENARIO_LABELS,
  type Invoice, type InvoiceIdentity, type Layanan,
} from '@/lib/invoice';

// Format tanggal + jam pembayaran (WIB) untuk pesan WhatsApp.
function fmtDateTimeWIB(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

/** Pilih rekening & QR sesuai jenis (kost / penginapan), fallback ke field lama. */
function resolveIdentity(s: KwitansiSettings | undefined, layanan: Layanan): InvoiceIdentity {
  const isKost = layanan === 'kost';
  const t = (v: unknown) => String(v ?? '').trim(); // aman walau value berupa angka
  const bank = isKost ? s?.inv_kost_bank_name : s?.inv_png_bank_name;
  const acc = isKost ? s?.inv_kost_account_no : s?.inv_png_account_no;
  const accName = isKost ? s?.inv_kost_account_name : s?.inv_png_account_name;
  // QRIS hanya untuk PENGINAPAN. Kost = tanpa QR (transfer manual).
  const qr = isKost ? '' : (s?.inv_png_qris_base64 || s?.inv_qris_base64);
  return {
    bankName: t(bank) || t(s?.inv_bank_name) || DEFAULT_IDENTITY.bankName,
    accountNo: t(acc) || t(s?.inv_account_no) || DEFAULT_IDENTITY.accountNo,
    accountName: t(accName) || t(s?.inv_account_name) || DEFAULT_IDENTITY.accountName,
    waResmi: t(s?.inv_wa_resmi) || DEFAULT_IDENTITY.waResmi,
    ownerName: t(s?.inv_owner_name) || t(s?.sig_name) || DEFAULT_IDENTITY.ownerName,
    ownerTitle: t(s?.inv_owner_title) || t(s?.sig_title) || DEFAULT_IDENTITY.ownerTitle,
    qrisBase64: isKost ? '' : String(qr || ''),
  };
}

/** File gambar → data URL ter-resize (maks ~520px) supaya base64 tidak kebesaran. */
function fileToResizedDataUrl(file: File, max = 520): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas tidak tersedia'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Gambar tidak valid'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

const HELP = {
  title: 'Invoice',
  tips: [
    'Pilih sumber: ambil dari booking yang sudah ada, atau isi manual.',
    'Ganti tampilan (Krem Klasik / Pita Emas), nyalakan stempel & QR sesuai kebutuhan.',
    'Tekan "Unduh PNG" atau "Kirim WhatsApp" untuk membagikan invoice ke penyewa.',
    'Atur bank, nomor rekening & identitas pemilik di bagian "Pengaturan Invoice".',
  ],
};

const PREVIEW_W = 520;

export default function InvoicePage() {
  const qc = useQueryClient();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mode, setMode] = useState<'booking' | 'manual'>('booking');
  const [variant, setVariant] = useState<'krem' | 'pita'>('krem');
  const [showStamp, setShowStamp] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [seedKey, setSeedKey] = useState('penginapan-harian');
  const [manualInv, setManualInv] = useState<Invoice>(() => JSON.parse(JSON.stringify(SEED_SCENARIOS['penginapan-harian'])));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [docH, setDocH] = useState(1600);

  const { data: initialData } = useQuery({ queryKey: ['initial-data'], queryFn: api.getInitialData });
  const { data: settings } = useQuery({ queryKey: ['kwitansi-settings'], queryFn: kwitansiApi.get });

  // Apply saved default variant once settings load.
  useEffect(() => {
    if (settings?.inv_variant === 'krem' || settings?.inv_variant === 'pita') setVariant(settings.inv_variant);
  }, [settings?.inv_variant]);

  // Deep-link dari flow booking: /kwitansi?booking=<id> → langsung tampilkan invoicenya.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bk = new URLSearchParams(window.location.search).get('booking');
    if (bk) { setMode('booking'); setSelectedId(bk); }
  }, []);

  // Booking untuk dipilih — termasuk yang Belum Bayar / DP / Lunas (bukan yang batal).
  const tenants: BookingItem[] = useMemo(() => {
    const set = new Map<string, BookingItem>();
    (initialData?.paymentBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.statusActionBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.closingBookings || []).forEach((b) => set.set(b.BookingID, b));
    return Array.from(set.values())
      .filter((b) => ['Lunas', 'DP', 'Belum Bayar'].includes(mapPayStatus(b)))
      .sort((a, b) => (new Date(b.CheckIn || 0).getTime()) - (new Date(a.CheckIn || 0).getTime()));
  }, [initialData]);

  useEffect(() => {
    if (mode === 'booking' && !selectedId && tenants.length > 0) setSelectedId(tenants[0].BookingID);
  }, [mode, tenants, selectedId]);

  const selectedBooking = tenants.find((b) => b.BookingID === selectedId) || null;

  // Gedung & lantai akurat dari denah resmi (untuk pesan WhatsApp).
  const layoutByKey = useMemo(() => {
    const m = new Map<string, { gedung: string; lantai: number }>();
    ALL_ROOMS.forEach((r) => m.set(roomKey(r.nama), { gedung: r.gedung, lantai: r.lantai }));
    return m;
  }, []);

  // Payment breakdown for the selected booking (for per-payment rows).
  const { data: detail } = useQuery({
    queryKey: ['booking-detail', selectedId],
    queryFn: () => api.getBookingDetail(selectedId),
    enabled: mode === 'booking' && !!selectedId,
  });

  const invoice: Invoice = useMemo(() => {
    if (mode === 'manual') return manualInv;
    // Pakai booking dari daftar; kalau deep-link (belum ada di daftar) pakai detailnya.
    const bk = selectedBooking || (detail?.booking as unknown as BookingItem | undefined);
    if (!bk) return SEED_SCENARIOS['penginapan-harian'];
    return bookingToInvoice(bk, detail?.payments);
  }, [mode, manualInv, selectedBooking, detail]);

  const { subtotal, balance, fullyPaid } = deriveInvoice(invoice);
  const payNominal = fullyPaid ? subtotal : balance;
  const layanan: Layanan = invoice.layanan || 'penginapan';
  const identity = resolveIdentity(settings, layanan);

  // Ukur tinggi invoice (font lebih besar → lebih tinggi) agar preview pas, tidak terpotong.
  useEffect(() => {
    if (!previewRef.current) return;
    const el = previewRef.current;
    const ro = new ResizeObserver(() => setDocH(el.offsetHeight || 1600));
    ro.observe(el);
    setDocH(el.offsetHeight || 1600);
    return () => ro.disconnect();
  }, [invoice, variant, showStamp, showQR, identity]);

  function flashCopied(key: string, text: string) {
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopied(key);
    copyTimer.current = setTimeout(() => setCopied(null), 1700);
    toast.success('Tersalin: ' + text);
  }

  // Pesan WhatsApp lengkap & ramah untuk penyewa yang dipilih.
  function buildWaText(): string {
    const bk = selectedBooking || (detail?.booking as unknown as BookingItem | undefined);
    const nama = invoice.customer.name || 'Kak';
    const namaKamar = bk?.Nama_Kamar || '';
    const gedung = bk?.Gedung || '';
    const lo = namaKamar ? layoutByKey.get(roomKey(namaKamar)) : undefined;
    const lantai = lo?.lantai || 0;
    const isKost = layanan === 'kost';
    const tipe = bk?.Tipe_Kamar || '';
    const periode = invoice.booking.period || bk?.Paket || '';
    const jenisBayar = fullyPaid ? 'Pelunasan' : 'DP';

    // Tanggal & jam pembayaran terakhir (dari rincian; fallback hari ini).
    const pays = detail?.payments || [];
    const lastPay = pays.length ? pays[pays.length - 1] : null;
    const bayarSaat = fmtDateTimeWIB(lastPay?.Tanggal_Bayar || new Date().toISOString());
    const dibayarAmt = Number(bk?.Net_Diterima || 0) || (fullyPaid ? subtotal : 0);
    const sisa = balance;

    const lokasi = [`Kamar ${namaKamar}`, gedung, lantai ? `Lantai ${lantai}` : ''].filter(Boolean).join(' · ');

    return [
      `Halo Kak ${nama} 🌸`,
      ``,
      `Berikut konfirmasi pembayaran Top Hills:`,
      ``,
      `🏠 ${lokasi}`,
      `🛏️ Tipe: ${isKost ? 'Kost' : 'Penginapan'}${tipe ? ` · ${tipe}` : ''}`,
      periode ? `📅 Periode sewa: ${periode}` : '',
      `✅ Telah melakukan ${jenisBayar}${dibayarAmt ? `: ${rp(dibayarAmt)}` : ''} pada ${bayarSaat}`,
      sisa > 0 ? `💰 Sisa tagihan: ${rp(sisa)}` : `💰 Status: LUNAS ✓`,
      ``,
      `Berikut bukti/invoice yang dapat kami kirimkan, mohon dicek kembali ya. 🙏`,
      `Terima kasih 🌸`,
    ].filter((l) => l !== '').join('\n');
  }

  // Buka WhatsApp penyewa yang dipilih (wa.me) dengan pesan lengkap — SINKRON
  // di dalam gesture klik supaya TIDAK diblok popup. Gambar invoice disalin ke
  // clipboard di latar (untuk ditempel), atau pakai "Unduh PNG" lalu lampirkan.
  function sendToWa() {
    const raw = digitsOnly(invoice.customer.phone || '');
    const norm = raw.startsWith('0') ? '62' + raw.slice(1) : raw;
    const text = encodeURIComponent(buildWaText());
    const url = norm ? `https://wa.me/${norm}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    void copyInvoiceImageBg();
  }

  // Salin invoice sebagai PNG ke clipboard — siap tempel (paste) ke WhatsApp.
  async function copyInvoicePNG() {
    if (!exportRef.current) return;
    const toastId = toast.loading('Menyiapkan invoice…');
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 120));
      const res = await copyAsPNGToClipboard({ element: exportRef.current, scale: 2, backgroundColor: null });
      if (res.method === 'clipboard') {
        toast.success('Invoice tersalin (PNG) — tinggal tempel (paste) ke chat WhatsApp 🌸', { id: toastId });
      } else {
        toast.success('Invoice terunduh (PNG) — lampirkan ke chat WhatsApp.', { id: toastId });
      }
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    }
  }

  async function copyInvoiceImageBg() {
    if (!exportRef.current) return;
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      const res = await copyAsPNGToClipboard({ element: exportRef.current, scale: 2, backgroundColor: null });
      if (res.method === 'clipboard') {
        toast.success('WhatsApp terbuka. Gambar invoice tersalin — tempel (paste) di chat 🌸');
      } else {
        toast('WhatsApp terbuka. Untuk gambar, pakai "Unduh PNG" lalu lampirkan.', { icon: 'ℹ️' });
      }
    } catch {
      toast('WhatsApp terbuka. Untuk gambar, pakai "Unduh PNG" lalu lampirkan.', { icon: 'ℹ️' });
    }
  }

  async function downloadPNG() {
    if (!exportRef.current) return;
    const toastId = toast.loading('Menyiapkan invoice…');
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      // beri jeda agar gambar (logo/ttd) ter-load di node export
      await new Promise((r) => setTimeout(r, 120));
      const nm = (invoice.customer.name || 'invoice').replace(/\s+/g, '_');
      await downloadAsPNG({ element: exportRef.current, filename: `invoice-${nm}-${Date.now()}`, scale: 2, backgroundColor: null });
      toast.success('Invoice tersimpan (PNG).', { id: toastId });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message, { id: toastId });
    }
  }

  async function saveIdentity(next: Partial<KwitansiSettings>) {
    const merged = { ...(settings || {}), ...next };
    try {
      await kwitansiApi.save(merged);
      qc.invalidateQueries({ queryKey: ['kwitansi-settings'] });
      toast.success('Pengaturan invoice tersimpan ✓');
    } catch (e) {
      toast.error('Gagal menyimpan: ' + (e as Error).message);
    }
  }

  const scale = PREVIEW_W / 1080;

  return (
    <>
      <ScreenHead title="Invoice" sub="Buat invoice mewah Top Hills untuk penyewa." onHelp={() => setHelpOpen(true)} />

      {/* Sumber data */}
      <SegRow
        label="Sumber data"
        options={[{ v: 'booking', l: 'Dari booking' }, { v: 'manual', l: 'Isi manual' }]}
        value={mode}
        onChange={(v) => setMode(v as 'booking' | 'manual')}
      />

      {mode === 'booking' ? (
        tenants.length === 0 ? (
          <KkCard tone="mint" className="flex items-center gap-4 mt-3">
            <div className="w-12 h-12 rounded-full bg-white text-kk-navy grid place-items-center flex-shrink-0"><KkIcon name="info" size={26} /></div>
            <p className="text-body text-kk-navy m-0">Belum ada penyewa yang membayar. Catat pembayaran dulu di menu Booking, atau pakai mode "Isi manual".</p>
          </KkCard>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 mt-3">
            {tenants.map((b) => {
              const on = b.BookingID === selectedId;
              return (
                <button key={b.BookingID} onClick={() => setSelectedId(b.BookingID)}
                  className={'flex-shrink-0 min-h-[44px] px-4 rounded-[12px] font-body font-semibold text-[15px] whitespace-nowrap border-2 ' + (on ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy')}>
                  {b.Nama_Customer || '(tanpa nama)'}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <ManualEditor seedKey={seedKey} setSeedKey={setSeedKey} inv={manualInv} setInv={setManualInv} />
      )}

      {/* Tampilan & opsi */}
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <SegRow label="Tampilan" options={[{ v: 'krem', l: 'Krem Klasik' }, { v: 'pita', l: 'Pita Emas' }]} value={variant} onChange={(v) => setVariant(v as 'krem' | 'pita')} />
        <div className="flex gap-2 items-end">
          <Toggle label="Stempel" on={showStamp} onClick={() => setShowStamp((s) => !s)} />
          <Toggle label="QR" on={showQR} onClick={() => setShowQR((s) => !s)} />
        </div>
      </div>

      <div className="mt-4 text-center text-caption text-kk-ink">
        Rekening & QR dipakai: <b className="text-kk-navy">{layanan === 'kost' ? 'Kost' : 'Penginapan'}</b>
        {' · '}{identity.bankName} · {identity.accountNo}
      </div>

      {/* Preview */}
      <div className="mt-3 flex justify-center">
        <div style={{ width: PREVIEW_W, height: Math.round(docH * scale), overflow: 'hidden', borderRadius: 18, boxShadow: '0 18px 50px -22px rgba(120,96,40,.5)' }}>
          <div ref={previewRef} style={{ width: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <InvoiceDocument
              inv={invoice} identity={identity} variant={variant} showStamp={showStamp} showQR={showQR}
              copied={copied}
              onCopyRek={() => flashCopied('rek', digitsOnly(identity.accountNo))}
              onCopyTotal={() => flashCopied('total', String(balance))}
            />
          </div>
        </div>
      </div>

      {/* Aksi utama — buka WhatsApp penyewa (wa.me) berisi pesan konfirmasi lengkap */}
      <KkButton variant="primary" size="lg" block className="mt-5" onClick={sendToWa}>
        <KkIcon name="kirim" size={22} strokeWidth={2.2} /> Kirim ke WhatsApp Penyewa
      </KkButton>
      <p className="mt-2 text-caption text-kk-ink text-center">
        Langsung membuka chat WhatsApp <b className="text-kk-navy">{invoice.customer.name || 'penyewa'}</b> berisi pesan konfirmasi (nama, kamar, periode, DP/Lunas).
        Gambar invoice ikut <b className="text-kk-navy">tersalin</b> — tinggal tempel (paste) di chat, atau pakai <b className="text-kk-navy">Unduh PNG</b> lalu lampirkan.
      </p>

      {/* Salin invoice sebagai gambar — siap tempel ke WhatsApp */}
      <KkButton variant="secondary" size="lg" block className="mt-3" onClick={copyInvoicePNG}>
        <KkIcon name="cek" size={20} strokeWidth={2.2} /> Salin Invoice (PNG) — siap tempel ke WhatsApp
      </KkButton>

      {/* Aksi tambahan */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <KkButton variant="secondary" block onClick={downloadPNG}>
          <KkIcon name="unduh" size={20} strokeWidth={2.2} /> Unduh PNG
        </KkButton>
        <KkButton variant="secondary" block onClick={() => flashCopied('rek', digitsOnly(identity.accountNo))}>
          <KkIcon name="cek" size={20} strokeWidth={2.2} />
          {copied === 'rek' ? 'Tersalin ✓' : 'Salin No. Rekening'}
        </KkButton>
      </div>

      {/* Pengaturan Invoice (bank & identitas) */}
      <div className="mt-6">
        <button onClick={() => setSettingsOpen((o) => !o)} className="flex items-center gap-2 text-kk-navy font-heading font-bold text-subhead">
          <KkIcon name="panahAtas" size={20} className={settingsOpen ? '' : 'rotate-180'} /> Pengaturan Invoice (bank & identitas)
        </button>
        {settingsOpen && (
          <IdentityEditor key={settings ? 'loaded' : 'loading'} settings={settings} variant={variant} onSave={saveIdentity} />
        )}
      </div>

      {/* Node export tersembunyi (ukuran penuh, tanpa tombol salin) */}
      <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }} aria-hidden>
        <div ref={exportRef}>
          <InvoiceDocument inv={invoice} identity={identity} variant={variant} showStamp={showStamp} showQR={showQR} forExport />
        </div>
      </div>

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
    </>
  );
}

// ── Kontrol kecil ────────────────────────────────────────────────────────────
function SegRow({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-caption font-semibold text-kk-ink mb-1.5">{label}</div>
      <div className="flex gap-2">
        {options.map((o) => (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={'flex-1 min-h-[44px] px-3 rounded-[12px] font-body font-semibold text-[15px] border-2 ' + (value === o.v ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy')}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={'flex-1 min-h-[44px] px-3 rounded-[12px] font-body font-semibold text-[15px] border-2 flex items-center justify-center gap-2 ' + (on ? 'border-kk-green bg-kk-mint-soft text-kk-navy' : 'border-kk-mauve bg-white text-kk-ink')}>
      <span className={'w-4 h-4 rounded-[5px] grid place-items-center ' + (on ? 'bg-kk-green text-white' : 'bg-kk-mauve')}>{on ? '✓' : ''}</span>
      {label}
    </button>
  );
}

function field(label: string, el: React.ReactNode) {
  return (
    <div>
      <label className="text-caption font-semibold text-kk-ink mb-1 block">{label}</label>
      {el}
    </div>
  );
}

// ── Editor identitas (disimpan ke kwitansi-settings) ─────────────────────────
function IdentityEditor({ settings, variant, onSave }: { settings: KwitansiSettings | undefined; variant: 'krem' | 'pita'; onSave: (n: Partial<KwitansiSettings>) => void }) {
  const s = settings;
  const t = (v: unknown) => String(v ?? ''); // value bisa angka (nomor rekening) → paksa string
  const [wa, setWa] = useState(t(s?.inv_wa_resmi) || DEFAULT_IDENTITY.waResmi);
  const [owner, setOwner] = useState(t(s?.inv_owner_name) || t(s?.sig_name) || DEFAULT_IDENTITY.ownerName);
  const [ownerTitle, setOwnerTitle] = useState(t(s?.inv_owner_title) || t(s?.sig_title) || DEFAULT_IDENTITY.ownerTitle);

  const [kBank, setKBank] = useState(t(s?.inv_kost_bank_name) || t(s?.inv_bank_name) || DEFAULT_IDENTITY.bankName);
  const [kAcc, setKAcc] = useState(t(s?.inv_kost_account_no) || t(s?.inv_account_no) || DEFAULT_IDENTITY.accountNo);
  const [kName, setKName] = useState(t(s?.inv_kost_account_name) || t(s?.inv_account_name) || DEFAULT_IDENTITY.accountName);
  const [kQr, setKQr] = useState(t(s?.inv_kost_qris_base64));

  const [pBank, setPBank] = useState(t(s?.inv_png_bank_name) || t(s?.inv_bank_name) || DEFAULT_IDENTITY.bankName);
  const [pAcc, setPAcc] = useState(t(s?.inv_png_account_no) || t(s?.inv_account_no) || DEFAULT_IDENTITY.accountNo);
  const [pName, setPName] = useState(t(s?.inv_png_account_name) || t(s?.inv_account_name) || DEFAULT_IDENTITY.accountName);
  const [pQr, setPQr] = useState(t(s?.inv_png_qris_base64));

  return (
    <KkCard className="mt-3 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {field('WhatsApp Resmi', <input className="kk-input" value={wa} onChange={(e) => setWa(e.target.value)} />)}
        {field('Nama Pemilik', <input className="kk-input" value={owner} onChange={(e) => setOwner(e.target.value)} />)}
        {field('Jabatan', <input className="kk-input" value={ownerTitle} onChange={(e) => setOwnerTitle(e.target.value)} />)}
      </div>

      <RekeningBlock title="🏠 Rekening & QR — Kost" bank={kBank} setBank={setKBank} acc={kAcc} setAcc={setKAcc} name={kName} setName={setKName} qr={kQr} setQr={setKQr} />
      <RekeningBlock title="🛏️ Rekening & QR — Penginapan" bank={pBank} setBank={setPBank} acc={pAcc} setAcc={setPAcc} name={pName} setName={setPName} qr={pQr} setQr={setPQr} />

      <KkButton variant="primary" block onClick={() => onSave({
        inv_wa_resmi: wa, inv_owner_name: owner, inv_owner_title: ownerTitle, inv_variant: variant,
        inv_kost_bank_name: kBank, inv_kost_account_no: kAcc, inv_kost_account_name: kName, inv_kost_qris_base64: kQr,
        inv_png_bank_name: pBank, inv_png_account_no: pAcc, inv_png_account_name: pName, inv_png_qris_base64: pQr,
      })}>
        Simpan Pengaturan Invoice
      </KkButton>
      <p className="text-caption text-kk-ink m-0">Invoice otomatis pakai rekening & QR sesuai jenisnya (Kost / Penginapan). Variant aktif ({variant === 'krem' ? 'Krem Klasik' : 'Pita Emas'}) ikut tersimpan sebagai default.</p>
    </KkCard>
  );
}

function RekeningBlock({ title, bank, setBank, acc, setAcc, name, setName, qr, setQr }: {
  title: string; bank: string; setBank: (v: string) => void; acc: string; setAcc: (v: string) => void;
  name: string; setName: (v: string) => void; qr: string; setQr: (v: string) => void;
}) {
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToResizedDataUrl(file);
      setQr(url);
      toast.success('QR diunggah ✓');
    } catch (err) {
      toast.error('Gagal unggah QR: ' + (err as Error).message);
    }
  }
  return (
    <div className="rounded-kk-card border-2 border-kk-mauve p-3">
      <div className="font-heading font-bold text-kk-navy mb-2">{title}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        {field('Bank', <input className="kk-input" value={bank} onChange={(e) => setBank(e.target.value)} />)}
        {field('No. Rekening', <input className="kk-input" value={acc} onChange={(e) => setAcc(e.target.value)} />)}
        {field('Atas Nama', <input className="kk-input" value={name} onChange={(e) => setName(e.target.value)} />)}
      </div>
      <div className="flex items-center gap-3 mt-3">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR" className="w-[72px] h-[72px] rounded-[10px] object-cover border border-kk-mauve" />
        ) : (
          <div className="w-[72px] h-[72px] rounded-[10px] border-2 border-dashed border-kk-mauve grid place-items-center text-caption text-kk-ink">QR</div>
        )}
        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border-2 border-kk-navy text-kk-navy font-semibold text-[14px] cursor-pointer">
            <KkIcon name="unduh" size={18} className="rotate-180" /> Unggah QR
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
          </label>
          {qr && <button className="text-kk-orange font-semibold text-[13px] text-left" onClick={() => setQr('')}>Hapus QR</button>}
        </div>
      </div>
    </div>
  );
}

// ── Editor manual ────────────────────────────────────────────────────────────
function ManualEditor({ seedKey, setSeedKey, inv, setInv }: { seedKey: string; setSeedKey: (s: string) => void; inv: Invoice; setInv: (i: Invoice) => void }) {
  const up = (patch: Partial<Invoice>) => setInv({ ...inv, ...patch });
  return (
    <KkCard className="mt-3 space-y-3">
      {field('Mulai dari contoh', (
        <select className="kk-input" value={seedKey} onChange={(e) => { setSeedKey(e.target.value); setInv(JSON.parse(JSON.stringify(SEED_SCENARIOS[e.target.value]))); }}>
          {Object.keys(SEED_SCENARIOS).map((k) => <option key={k} value={k}>{SCENARIO_LABELS[k]}</option>)}
        </select>
      ))}
      <div className="grid sm:grid-cols-3 gap-3">
        {field('No. Invoice', <input className="kk-input" value={inv.id} onChange={(e) => up({ id: e.target.value })} />)}
        {field('Tanggal', <input className="kk-input" value={inv.date} onChange={(e) => up({ date: e.target.value })} />)}
        {field('Jatuh Tempo', <input className="kk-input" value={inv.due} onChange={(e) => up({ due: e.target.value })} />)}
      </div>
      {field('Status pill (opsional)', <input className="kk-input" value={inv.tag || ''} onChange={(e) => up({ tag: e.target.value || undefined })} placeholder="TAGIHAN DP / PELUNASAN" />)}
      <div className="grid sm:grid-cols-3 gap-3">
        {field('Nama Customer', <input className="kk-input" value={inv.customer.name} onChange={(e) => up({ customer: { ...inv.customer, name: e.target.value } })} />)}
        {field('No. HP', <input className="kk-input" value={inv.customer.phone} onChange={(e) => up({ customer: { ...inv.customer, phone: e.target.value } })} />)}
        {field('Keterangan', <input className="kk-input" value={inv.customer.kind} onChange={(e) => up({ customer: { ...inv.customer, kind: e.target.value } })} />)}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {field('Kamar', <input className="kk-input" value={inv.booking.room} onChange={(e) => up({ booking: { ...inv.booking, room: e.target.value } })} />)}
        {field('Periode', <input className="kk-input" value={inv.booking.period} onChange={(e) => up({ booking: { ...inv.booking, period: e.target.value } })} />)}
      </div>

      <div className="text-caption font-semibold text-kk-ink">Item</div>
      {inv.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_56px_96px_28px] gap-2 items-center">
          <input className="kk-input" value={it.desc} placeholder="Deskripsi" onChange={(e) => { const items = [...inv.items]; items[i] = { ...it, desc: e.target.value }; up({ items }); }} />
          <input className="kk-input text-center" type="number" value={it.qty} onChange={(e) => { const items = [...inv.items]; items[i] = { ...it, qty: Number(e.target.value) || 0 }; up({ items }); }} />
          <input className="kk-input" type="number" value={it.price} onChange={(e) => { const items = [...inv.items]; items[i] = { ...it, price: Number(e.target.value) || 0 }; up({ items }); }} />
          <button className="text-kk-orange font-bold" onClick={() => up({ items: inv.items.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <KkButton variant="secondary" onClick={() => up({ items: [...inv.items, { desc: '', note: '', qty: 1, price: 0 }] })}>+ Tambah item</KkButton>

      <div className="text-caption font-semibold text-kk-ink">Pembayaran</div>
      {inv.payments.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_28px] gap-2 items-center">
          <input className="kk-input" value={p.label} placeholder="Label (mis. Uang Muka / Pelunasan)" onChange={(e) => { const payments = [...inv.payments]; payments[i] = { ...p, label: e.target.value }; up({ payments }); }} />
          <input className="kk-input" type="number" value={p.amount} onChange={(e) => { const payments = [...inv.payments]; payments[i] = { ...p, amount: Number(e.target.value) || 0 }; up({ payments }); }} />
          <button className="text-kk-orange font-bold" onClick={() => up({ payments: inv.payments.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <KkButton variant="secondary" onClick={() => up({ payments: [...inv.payments, { label: 'Pelunasan', amount: 0 }] })}>+ Tambah pembayaran</KkButton>
    </KkCard>
  );
}
