'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingFullData, type RoomStatus } from '@/lib/api';
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
    orang: grab(/(\d+)\s*orang/i),
  };
}
const toNum = (s: string) => Number(String(s).replace(/[^0-9]/g, '')) || 0;
// Jumlah orang yang aman ditampilkan (kolom kadang keisi nilai aneh) → angka 1–30 saja.
function safeOrang(b: BookingFullData, p: { orang: string }): number {
  const fromCol = Number(b.Jumlah_Orang);
  if (Number.isFinite(fromCol) && fromCol >= 1 && fromCol <= 30) return fromCol;
  const fromNote = Number(p.orang);
  if (Number.isFinite(fromNote) && fromNote >= 1 && fromNote <= 30) return fromNote;
  return 0;
}
function tglID(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PendingConfirmations() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pending-bookings'], queryFn: api.getPendingBookings, retry: 0, refetchInterval: 60_000 });
  // Daftar kamar (untuk pilih/ganti kamar saat edit) — berbagi cache dgn /booking.
  const { data: initial } = useQuery({ queryKey: ['initial-data'], queryFn: api.getInitialData });
  const rooms = useMemo<RoomStatus[]>(() => initial?.roomStatus || [], [initial]);
  const list = Array.isArray(data) ? data : [];
  const [sel, setSel] = useState<BookingFullData | null>(null);
  const [edit, setEdit] = useState<BookingFullData | null>(null);

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
  const saveEdit = useMutation({
    mutationFn: (v: Parameters<typeof api.editPendingBooking>[0]) => api.editPendingBooking(v),
    onSuccess: () => {
      toast.success('✓ Data booking diperbarui');
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['pending-bookings'] });
      qc.invalidateQueries({ queryKey: ['initial-data'] });
    },
    onError: (e) => toast.error('Gagal menyimpan: ' + (e as Error).message),
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
            const orang = safeOrang(b, p);
            const layanan = String(b.Layanan).toUpperCase() === 'KOS' ? 'Kost' : 'Penginapan';
            return (
              <div key={b.BookingID} className="rounded-kk-card border border-kk-mauve p-3.5">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-kk-navy text-[16px]">{b.Nama_Customer || '(tanpa nama)'}</div>
                    <div className="text-[13px] text-kk-ink">{b.Nama_Kamar}{b.Gedung ? ' · ' + b.Gedung : ''} · {layanan}</div>
                    <div className="text-[12.5px] text-kk-ink mt-0.5">
                      {b.Paket || b.Durasi || '-'}{orang ? ' · ' + orang + ' org' : ''}
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
          onEdit={() => { setEdit(sel); setSel(null); }}
          onConfirm={(s) => confirm.mutate({ id: sel.BookingID, status: s })}
          onReject={() => { if (window.confirm(`Tolak booking ${sel.Nama_Customer}?`)) reject.mutate(sel.BookingID); }}
        />
      )}

      {edit && (
        <PendingEditSheet
          b={edit}
          rooms={rooms}
          busy={saveEdit.isPending}
          onClose={() => setEdit(null)}
          onSave={(payload) => saveEdit.mutate(payload)}
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

function PendingDetailSheet({ b, busy, onClose, onEdit, onConfirm, onReject }: {
  b: BookingFullData; busy: boolean; onClose: () => void; onEdit: () => void; onConfirm: (s: 'DP' | 'Lunas') => void; onReject: () => void;
}) {
  const p = parseCatatan(b.Catatan);
  const orang = safeOrang(b, p);
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
          <Row label="Jumlah orang" value={orang ? `${orang} orang` : ''} />
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

        {/* Ubah data dulu (mis. ganti kamar / betulkan nama) tanpa harus konfirmasi */}
        <KkButton variant="secondary" block onClick={onEdit} disabled={busy} className="mb-3">
          ✏️ Ubah Data Booking
        </KkButton>

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

// ── Ubah data booking PENDING — bebas (nama, WA, kamar/tipe, dll) tanpa ubah status bayar.
function toDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}
function kamarLabel(nama?: string, gedung?: string): string {
  const n = String(nama || '').trim();
  const g = String(gedung || '').trim();
  return g ? `${n} — ${g}` : n;
}

function PendingEditSheet({ b, rooms, busy, onClose, onSave }: {
  b: BookingFullData;
  rooms: RoomStatus[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Parameters<typeof api.editPendingBooking>[0]) => void;
}) {
  const [nama, setNama] = useState(b.Nama_Customer || '');
  const [hp, setHp] = useState(String(b.WhatsApp || ''));
  const [layanan, setLayanan] = useState<'KOS' | 'PENGINAPAN'>(
    String(b.Layanan || '').toUpperCase().includes('KOS') ? 'KOS' : 'PENGINAPAN',
  );
  const [kamar, setKamar] = useState(kamarLabel(b.Nama_Kamar, b.Gedung));
  const [durasi, setDurasi] = useState(b.Paket || b.Durasi || '');
  const [orang, setOrang] = useState(safeOrang(b, parseCatatan(b.Catatan)) || 1);
  const [masuk, setMasuk] = useState(toDateInput(b.CheckIn));
  const [catatan, setCatatan] = useState(b.Catatan || '');

  // Opsi kamar per layanan; selalu sertakan kamar yang sedang dipilih.
  const kamarOpts = useMemo(() => {
    const want = layanan === 'KOS' ? 'KOS' : 'PENGINAP';
    const opts = rooms
      .filter((r) => String(r.Layanan_Default || '').toUpperCase().includes(want))
      .map((r) => kamarLabel(r.Nama_Kamar, r.Gedung));
    const set = new Set(opts);
    if (kamar && !set.has(kamar)) opts.unshift(kamar);
    return Array.from(new Set(opts));
  }, [rooms, layanan, kamar]);

  // Tipe kamar diturunkan dari kamar terpilih (untuk dikirim & ditampilkan).
  const tipe = useMemo(() => {
    const r = rooms.find((x) => kamarLabel(x.Nama_Kamar, x.Gedung) === kamar);
    return r?.Tipe_Kamar || b.Tipe_Kamar || '';
  }, [rooms, kamar, b.Tipe_Kamar]);

  function save() {
    if (!nama.trim()) { toast.error('Nama wajib diisi'); return; }
    onSave({
      bookingId: b.BookingID,
      nama: nama.trim(),
      whatsapp: hp.trim(),
      kamar,
      tipe,
      layanan,
      durasi: durasi.trim(),
      jumlahOrang: orang,
      tglMulai: masuk,
      catatan,
    });
  }

  return (
    <Sheet open onClose={onClose} dismissable={false}>
      <div className="px-6 pt-5 pb-8">
        <h2 className="font-heading font-black text-[22px] text-kk-navy m-0 mb-1">Ubah Data Booking</h2>
        <p className="text-caption text-kk-ink mt-0 mb-4">
          Betulkan data atau pindah kamar. Status tetap <b>menunggu konfirmasi</b> — kamu yang Terima/Tolak nanti.
        </p>

        <div className="space-y-3.5">
          <Field label="Nama penyewa">
            <input className="kk-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama" />
          </Field>
          <Field label="WhatsApp">
            <input className="kk-input" value={hp} onChange={(e) => setHp(e.target.value)} placeholder="62812…" inputMode="numeric" />
          </Field>

          <Field label="Layanan">
            <div className="grid grid-cols-2 gap-2">
              {(['KOS', 'PENGINAPAN'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayanan(l)}
                  className={`min-h-[48px] rounded-kk-pill font-body font-semibold border-2 ${
                    layanan === l ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy'
                  }`}
                >
                  {l === 'KOS' ? 'Kost' : 'Penginapan'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Kamar" hint={tipe ? `Tipe: ${tipe}` : undefined}>
            <select className="kk-input" value={kamar} onChange={(e) => setKamar(e.target.value)}>
              {kamarOpts.length === 0 && <option value="">(tidak ada kamar)</option>}
              {kamarOpts.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Durasi / paket">
              <input className="kk-input" value={durasi} onChange={(e) => setDurasi(e.target.value)} placeholder="mis. 6 Bulan / Per Malam" />
            </Field>
            <Field label="Tanggal masuk">
              <input type="date" className="kk-input" value={masuk} onChange={(e) => setMasuk(e.target.value)} />
            </Field>
          </div>

          <Field label="Jumlah orang">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setOrang((o) => Math.max(1, o - 1))}
                className="w-12 h-12 rounded-kk-card border-2 border-kk-mauve text-[24px] font-bold text-kk-navy grid place-items-center">−</button>
              <span className="font-heading font-black text-[22px] text-kk-navy w-8 text-center">{orang}</span>
              <button type="button" onClick={() => setOrang((o) => Math.min(30, o + 1))}
                className="w-12 h-12 rounded-kk-card border-2 border-kk-mauve text-[24px] font-bold text-kk-navy grid place-items-center">+</button>
            </div>
          </Field>

          <Field label="Catatan">
            <textarea className="kk-input resize-y" rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
        </div>

        <KkButton variant="primary" block onClick={save} disabled={busy} className="mt-5">
          {busy ? 'Menyimpan…' : 'Simpan Perubahan'}
        </KkButton>
        <KkButton variant="secondary" block onClick={onClose} disabled={busy} className="mt-2">Batal</KkButton>
      </div>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-kk-navy mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-kk-ink mt-1">{hint}</span> : null}
    </label>
  );
}
