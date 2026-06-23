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
import {
  bookingToInvoice, digitsOnly, deriveInvoice, DEFAULT_IDENTITY, SEED_SCENARIOS, SCENARIO_LABELS,
  type Invoice, type InvoiceIdentity,
} from '@/lib/invoice';

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
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: initialData } = useQuery({ queryKey: ['initial-data'], queryFn: api.getInitialData });
  const { data: settings } = useQuery({ queryKey: ['kwitansi-settings'], queryFn: kwitansiApi.get });

  // Apply saved default variant once settings load.
  useEffect(() => {
    if (settings?.inv_variant === 'krem' || settings?.inv_variant === 'pita') setVariant(settings.inv_variant);
  }, [settings?.inv_variant]);

  const identity: InvoiceIdentity = {
    bankName: settings?.inv_bank_name?.trim() || DEFAULT_IDENTITY.bankName,
    accountNo: settings?.inv_account_no?.trim() || DEFAULT_IDENTITY.accountNo,
    accountName: settings?.inv_account_name?.trim() || DEFAULT_IDENTITY.accountName,
    waResmi: settings?.inv_wa_resmi?.trim() || DEFAULT_IDENTITY.waResmi,
    ownerName: settings?.inv_owner_name?.trim() || settings?.sig_name?.trim() || DEFAULT_IDENTITY.ownerName,
    ownerTitle: settings?.inv_owner_title?.trim() || settings?.sig_title?.trim() || DEFAULT_IDENTITY.ownerTitle,
    qrisBase64: settings?.inv_qris_base64 || '',
  };

  // Tenants for booking mode (only those who paid something).
  const tenants: BookingItem[] = useMemo(() => {
    const set = new Map<string, BookingItem>();
    (initialData?.paymentBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.statusActionBookings || []).forEach((b) => set.set(b.BookingID, b));
    (initialData?.closingBookings || []).forEach((b) => set.set(b.BookingID, b));
    return Array.from(set.values())
      .filter((b) => ['Lunas', 'DP'].includes(mapPayStatus(b)))
      .sort((a, b) => (new Date(b.CheckIn || 0).getTime()) - (new Date(a.CheckIn || 0).getTime()));
  }, [initialData]);

  useEffect(() => {
    if (mode === 'booking' && !selectedId && tenants.length > 0) setSelectedId(tenants[0].BookingID);
  }, [mode, tenants, selectedId]);

  const selectedBooking = tenants.find((b) => b.BookingID === selectedId) || null;

  // Payment breakdown for the selected booking (for per-payment rows).
  const { data: detail } = useQuery({
    queryKey: ['booking-detail', selectedId],
    queryFn: () => api.getBookingDetail(selectedId),
    enabled: mode === 'booking' && !!selectedId,
  });

  const invoice: Invoice = useMemo(() => {
    if (mode === 'manual') return manualInv;
    if (!selectedBooking) return SEED_SCENARIOS['penginapan-harian'];
    return bookingToInvoice(selectedBooking, detail?.payments);
  }, [mode, manualInv, selectedBooking, detail]);

  const { balance } = deriveInvoice(invoice);

  function flashCopied(key: string, text: string) {
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopied(key);
    copyTimer.current = setTimeout(() => setCopied(null), 1700);
    toast.success('Tersalin: ' + text);
  }

  async function exportPNG(share: boolean) {
    if (!exportRef.current) return;
    const toastId = toast.loading('Menyiapkan invoice…');
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
      // beri jeda agar gambar (logo/ttd) ter-load di node export
      await new Promise((r) => setTimeout(r, 120));
      if (share) {
        const res = await copyAsPNGToClipboard({ element: exportRef.current, scale: 2, backgroundColor: '#E3D9C4' });
        toast.success(
          res.method === 'clipboard'
            ? 'Invoice tersalin. Buka WhatsApp lalu tempel (Ctrl+V).'
            : 'Invoice diunduh untuk dikirim lewat WhatsApp.',
          { id: toastId },
        );
      } else {
        const nm = (invoice.customer.name || 'invoice').replace(/\s+/g, '_');
        await downloadAsPNG({ element: exportRef.current, filename: `invoice-${nm}-${Date.now()}`, scale: 2, backgroundColor: '#E3D9C4' });
        toast.success('Invoice tersimpan (PNG).', { id: toastId });
      }
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

      {/* Preview */}
      <div className="mt-5 flex justify-center">
        <div style={{ width: PREVIEW_W, height: Math.round(1528 * scale), overflow: 'hidden', borderRadius: 18, boxShadow: '0 18px 50px -22px rgba(120,96,40,.5)' }}>
          <div style={{ width: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <InvoiceDocument
              inv={invoice} identity={identity} variant={variant} showStamp={showStamp} showQR={showQR}
              copied={copied}
              onCopyRek={() => flashCopied('rek', digitsOnly(identity.accountNo))}
              onCopyTotal={() => flashCopied('total', String(balance))}
            />
          </div>
        </div>
      </div>

      {/* Aksi */}
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <KkButton variant="primary" size="lg" block onClick={() => exportPNG(true)}>
          <KkIcon name="kirim" size={22} strokeWidth={2.2} /> Kirim lewat WhatsApp
        </KkButton>
        <KkButton variant="secondary" block onClick={() => exportPNG(false)}>
          <KkIcon name="unduh" size={22} strokeWidth={2.2} /> Unduh PNG
        </KkButton>
      </div>

      {/* Pengaturan Invoice (bank & identitas) */}
      <div className="mt-6">
        <button onClick={() => setSettingsOpen((o) => !o)} className="flex items-center gap-2 text-kk-navy font-heading font-bold text-subhead">
          <KkIcon name="panahAtas" size={20} className={settingsOpen ? '' : 'rotate-180'} /> Pengaturan Invoice (bank & identitas)
        </button>
        {settingsOpen && (
          <IdentityEditor key={JSON.stringify(identity)} initial={identity} variant={variant} onSave={saveIdentity} />
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
function IdentityEditor({ initial, variant, onSave }: { initial: InvoiceIdentity; variant: 'krem' | 'pita'; onSave: (n: Partial<KwitansiSettings>) => void }) {
  const [f, setF] = useState(initial);
  return (
    <KkCard className="mt-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {field('Bank', <input className="kk-input" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} />)}
        {field('No. Rekening', <input className="kk-input" value={f.accountNo} onChange={(e) => setF({ ...f, accountNo: e.target.value })} />)}
        {field('Atas Nama', <input className="kk-input" value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} />)}
        {field('WhatsApp Resmi', <input className="kk-input" value={f.waResmi} onChange={(e) => setF({ ...f, waResmi: e.target.value })} />)}
        {field('Nama Pemilik', <input className="kk-input" value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} />)}
        {field('Jabatan', <input className="kk-input" value={f.ownerTitle} onChange={(e) => setF({ ...f, ownerTitle: e.target.value })} />)}
      </div>
      <KkButton variant="primary" block onClick={() => onSave({
        inv_bank_name: f.bankName, inv_account_no: f.accountNo, inv_account_name: f.accountName,
        inv_wa_resmi: f.waResmi, inv_owner_name: f.ownerName, inv_owner_title: f.ownerTitle, inv_variant: variant,
      })}>
        Simpan Pengaturan Invoice
      </KkButton>
      <p className="text-caption text-kk-ink m-0">Variant aktif ({variant === 'krem' ? 'Krem Klasik' : 'Pita Emas'}) ikut tersimpan sebagai default.</p>
    </KkCard>
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
