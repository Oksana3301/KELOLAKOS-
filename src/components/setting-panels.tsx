'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type RoomStatus, type PriceItem, type BuktiFile } from '@/lib/api';
import { facilityApi, kwitansiApi, halamanInfoApi, type Fasilitas, type KwitansiSettings } from '@/lib/api-v2';
import { DEFAULT_INFO, mergeInfo, type HalamanInfo } from '@/lib/halaman-info';
import { formatRupiah, formatRupiahShort } from '@/lib/utils';
import { toast } from 'sonner';

// ===========================================
// Shared sub-components
// ===========================================

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-tx2 mb-1 block">
        {label}
        {required && <span className="text-rd ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-tx3 text-[10px] mt-1">{hint}</div>}
    </div>
  );
}

function RupiahInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  // type=text so Indonesian thousand separators (titik) show while typing.
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3 text-xs font-semibold pointer-events-none">
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value ? new Intl.NumberFormat('id-ID').format(value) : ''}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
        className="input pl-9 tabular-nums"
      />
    </div>
  );
}

// ===========================================
// 1. PROFIL BISNIS Panel
// ===========================================

export function ProfilBisnisPanel() {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['kwitansi-settings'],
    queryFn: kwitansiApi.get,
  });

  const [form, setForm] = useState<Partial<KwitansiSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function setField<K extends keyof KwitansiSettings>(key: K, value: KwitansiSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await kwitansiApi.save(form);
      toast.success('✓ Profil bisnis disimpan');
      queryClient.invalidateQueries({ queryKey: ['kwitansi-settings'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="text-tx3 text-sm text-center py-12">Loading profil...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="bg-blb border border-bl rounded-md p-3 text-xs text-bl leading-relaxed">
        💡 Profil ini akan tampil di kwitansi pembayaran customer & berbagai dokumen.
      </div>

      <FormField label="Nama Bisnis" required>
        <input
          type="text"
          value={form.business_name || ''}
          onChange={(e) => setField('business_name', e.target.value)}
          placeholder="Misal: Kos Mama Mezi"
          className="input"
          required
        />
      </FormField>

      <FormField label="Tagline">
        <input
          type="text"
          value={form.tagline || ''}
          onChange={(e) => setField('tagline', e.target.value)}
          placeholder="Misal: Hunian Nyaman, Harga Terjangkau"
          className="input"
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Alamat Bisnis">
          <textarea
            value={form.alamat || ''}
            onChange={(e) => setField('alamat', e.target.value)}
            placeholder="Jl. Mawar No. 12, Padang..."
            rows={3}
            className="input resize-y"
          />
        </FormField>
        <FormField label="Kontak (WA / Telepon)">
          <textarea
            value={form.kontak || ''}
            onChange={(e) => setField('kontak', e.target.value)}
            placeholder="+62 812-...&#10;email@bisnis.com"
            rows={3}
            className="input resize-y"
          />
        </FormField>
      </div>

      <div className="border-t border-bd pt-4">
        <h4 className="font-bold text-sm mb-3">🧾 Setting Kwitansi</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <FormField label="Nama Penandatangan">
            <input
              type="text"
              value={form.sig_name || ''}
              onChange={(e) => setField('sig_name', e.target.value)}
              placeholder="Misal: Atika Dewi"
              className="input"
            />
          </FormField>
          <FormField label="Jabatan Penandatangan">
            <input
              type="text"
              value={form.sig_title || ''}
              onChange={(e) => setField('sig_title', e.target.value)}
              placeholder="Pemilik / Admin"
              className="input"
            />
          </FormField>
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn btn-pri">
        {submitting ? '⏳ Saving...' : '💾 Simpan Profil'}
      </button>
    </form>
  );
}

// ===========================================
// 2. KELOLA KAMAR Panel
// ===========================================

export function KelolaKamarPanel() {
  const queryClient = useQueryClient();
  const [editingRoom, setEditingRoom] = useState<RoomStatus | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['room-management'],
    queryFn: api.getRoomManagementData,
  });

  const rooms = data?.rooms || [];

  async function handleDelete(room: RoomStatus) {
    const ok = confirm(
      `Hapus / nonaktifkan kamar ${room.Nama_Kamar}?\n\nKalau ada booking aktif, kamar akan diNONAKTIFkan. Kalau kosong, dihapus permanen.`,
    );
    if (!ok) return;
    try {
      const result = await api.submitRoomDelete(room.RoomID);
      toast.success(result.message || 'Selesai');
      queryClient.invalidateQueries({ queryKey: ['room-management'] });
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-tx3 text-xs">{rooms.length} kamar tercatat</p>
        <button onClick={() => setShowAddModal(true)} className="btn btn-pri text-xs">
          + Tambah Kamar
        </button>
      </div>

      {isLoading ? (
        <div className="text-tx3 text-sm text-center py-12">Loading kamar...</div>
      ) : rooms.length === 0 ? (
        <div className="bg-sf2 border border-bd border-dashed rounded-md p-8 text-center text-tx3 text-sm">
          Belum ada kamar. Klik "+ Tambah Kamar" untuk mulai.
        </div>
      ) : (
        <div className="space-y-1.5">
          {rooms.map((r) => (
            <div key={r.RoomID} className="bg-sf border border-bd rounded-md p-3 flex justify-between items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{r.Nama_Kamar}</span>
                  <span className="text-tx3 text-[10px]">({r.RoomID})</span>
                  {!r.Is_Master_Active && r.Is_Master_Active !== ('YA' as 'YA' | 'TIDAK') && (
                    <span className="badge badge-red">NONAKTIF</span>
                  )}
                </div>
                <div className="text-tx3 text-xs mt-0.5">
                  {r.Layanan_Default} · {r.Gedung} · {r.Tipe_Kamar} · Kapasitas {r.Kapasitas_Normal}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setEditingRoom(r)} className="btn btn-sec btn-sm">
                  ✏️
                </button>
                <button onClick={() => handleDelete(r)} className="btn btn-danger btn-sm">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <RoomModal onClose={() => setShowAddModal(false)} />}
      {editingRoom && <RoomModal existing={editingRoom} onClose={() => setEditingRoom(null)} />}
    </div>
  );
}

function RoomModal({
  existing,
  onClose,
}: {
  existing?: RoomStatus;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [namaKamar, setNamaKamar] = useState(existing?.Nama_Kamar || '');
  const [layananDefault, setLayananDefault] = useState(existing?.Layanan_Default || 'KOS');
  const [gedung, setGedung] = useState(existing?.Gedung || 'Gedung A');
  const [tipeKamar, setTipeKamar] = useState(existing?.Tipe_Kamar || '');
  const [kapasitasNormal, setKapasitasNormal] = useState(existing?.Kapasitas_Normal || 1);
  const [statusKamar, setStatusKamar] = useState(existing?.Status_Kamar || 'TERSEDIA');
  const [catatan, setCatatan] = useState(existing?.Catatan || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!namaKamar.trim() || !tipeKamar.trim()) {
      toast.error('Nama kamar & tipe kamar wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.submitRoomUpsert({
        roomId: existing?.RoomID,
        namaKamar: namaKamar.trim(),
        layananDefault,
        gedung,
        tipeKamar: tipeKamar.trim(),
        kapasitasNormal,
        statusKamar,
        catatan,
      });
      toast.success(result.message || (existing ? 'Kamar diupdate' : 'Kamar ditambah'));
      queryClient.invalidateQueries({ queryKey: ['room-management'] });
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-sf w-full max-w-lg rounded-lg shadow-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-base">{existing ? '✏️ Edit Kamar' : '+ Tambah Kamar Baru'}</h3>
          <button onClick={onClose} className="text-tx3 hover:text-tx">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <FormField label="Nama Kamar" required>
            <input type="text" value={namaKamar} onChange={(e) => setNamaKamar(e.target.value)} placeholder="Misal: Kamar Mawar A01" className="input" required />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Layanan" required>
              <select value={layananDefault} onChange={(e) => setLayananDefault(e.target.value)} className="input">
                <option value="KOS">KOS</option>
                <option value="PENGINAPAN">PENGINAPAN</option>
              </select>
            </FormField>
            <FormField label="Gedung" required>
              <input type="text" value={gedung} onChange={(e) => setGedung(e.target.value)} list="gedung-options" className="input" required />
              <datalist id="gedung-options">
                <option value="Gedung A" />
                <option value="Gedung B" />
                <option value="Gedung C" />
              </datalist>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipe Kamar" required>
              <input type="text" value={tipeKamar} onChange={(e) => setTipeKamar(e.target.value)} placeholder="Misal: Standard, Deluxe" className="input" required />
            </FormField>
            <FormField label="Kapasitas Normal" required>
              <input type="number" value={kapasitasNormal} onChange={(e) => setKapasitasNormal(parseInt(e.target.value) || 1)} min={1} max={10} className="input" />
            </FormField>
          </div>

          <FormField label="Status Kamar">
            <select value={statusKamar} onChange={(e) => setStatusKamar(e.target.value)} className="input">
              <option value="TERSEDIA">TERSEDIA (aktif)</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="NONAKTIF">NONAKTIF</option>
            </select>
          </FormField>

          <FormField label="Catatan">
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} className="input resize-y" />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-sec flex-1">Batal</button>
            <button type="submit" disabled={submitting} className="btn btn-pri flex-1">
              {submitting ? '⏳ Saving...' : existing ? '💾 Update' : '✓ Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================
// 3. HARGA UMUM Panel
// ===========================================

export function HargaUmumPanel() {
  const queryClient = useQueryClient();
  const [editingPrice, setEditingPrice] = useState<PriceItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['price-setting'],
    queryFn: api.getPriceSettingData,
  });

  const prices = data?.prices || [];

  // Group by Layanan + Gedung
  const grouped = useMemo(() => {
    const map = new Map<string, PriceItem[]>();
    prices.forEach((p) => {
      const key = `${p.Layanan} · ${p.Gedung}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [prices]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-tx3 text-xs">{prices.length} entry harga · berlaku untuk semua kamar dengan kombinasi Layanan+Gedung+Tipe+Paket yang sama</p>
        <button onClick={() => setShowAddModal(true)} className="btn btn-pri text-xs">
          + Tambah Harga
        </button>
      </div>

      <div className="bg-amb border border-am rounded-md p-3 text-xs text-am leading-relaxed mb-4">
        💡 Harga umum dipakai sebagai fallback. Kalau lo set harga per-kamar di tab "Harga Massal", harga kamar itu yang dipake (override).
      </div>

      {isLoading ? (
        <div className="text-tx3 text-sm text-center py-12">Loading harga...</div>
      ) : prices.length === 0 ? (
        <div className="bg-sf2 border border-bd border-dashed rounded-md p-8 text-center text-tx3 text-sm">
          Belum ada harga. Klik "+ Tambah Harga" untuk mulai.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, items]) => (
            <div key={key}>
              <div className="font-bold text-xs text-tx3 uppercase tracking-wider mb-2">{key}</div>
              <div className="space-y-1.5">
                {items.map((p) => (
                  <div key={p.PriceID} className="bg-sf border border-bd rounded-md p-3 flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{p.Tipe_Kamar} · {p.Paket}</div>
                      <div className="text-tx3 text-[11px] mt-0.5">
                        DP min {formatRupiahShort(p.DP_Minimal)} · Extra bed {formatRupiahShort(p.ExtraBed_Default)} · Extra person {formatRupiahShort(p.ExtraPerson_Default)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm tabular-nums">{formatRupiah(p.Harga_Satuan)}</div>
                      {p.Aktif !== 'YA' && <div className="text-rd text-[10px]">NONAKTIF</div>}
                    </div>
                    <button onClick={() => setEditingPrice(p)} className="btn btn-sec btn-sm flex-shrink-0">✏️</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <PriceModal onClose={() => setShowAddModal(false)} />}
      {editingPrice && <PriceModal existing={editingPrice} onClose={() => setEditingPrice(null)} />}
    </div>
  );
}

function PriceModal({
  existing,
  onClose,
}: {
  existing?: PriceItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [layanan, setLayanan] = useState(existing?.Layanan || 'KOS');
  const [gedung, setGedung] = useState(existing?.Gedung || 'Gedung A');
  const [tipeKamar, setTipeKamar] = useState(existing?.Tipe_Kamar || '');
  const [paket, setPaket] = useState(existing?.Paket || 'Bulanan');
  const [hargaSatuan, setHargaSatuan] = useState(existing?.Harga_Satuan || 0);
  const [dpMinimal, setDpMinimal] = useState(existing?.DP_Minimal || 0);
  const [extraBedDefault, setExtraBedDefault] = useState(existing?.ExtraBed_Default || 0);
  const [extraPersonDefault, setExtraPersonDefault] = useState(existing?.ExtraPerson_Default || 0);
  const [aktif, setAktif] = useState(existing?.Aktif || 'YA');
  const [catatan, setCatatan] = useState(existing?.Catatan || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipeKamar.trim()) {
      toast.error('Tipe kamar wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitPriceSetting({
        priceId: existing?.PriceID,
        layanan,
        gedung,
        tipeKamar: tipeKamar.trim(),
        paket,
        hargaSatuan,
        dpMinimal,
        extraBedDefault,
        extraPersonDefault,
        aktif,
        catatan,
      });
      toast.success(existing ? '✓ Harga diupdate' : '✓ Harga ditambah');
      queryClient.invalidateQueries({ queryKey: ['price-setting'] });
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-sf w-full max-w-lg rounded-lg shadow-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-base">{existing ? '✏️ Edit Harga' : '+ Tambah Harga Baru'}</h3>
          <button onClick={onClose} className="text-tx3 hover:text-tx">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Layanan" required>
              <select value={layanan} onChange={(e) => setLayanan(e.target.value)} className="input">
                <option value="KOS">KOS</option>
                <option value="PENGINAPAN">PENGINAPAN</option>
              </select>
            </FormField>
            <FormField label="Gedung" required>
              <input type="text" value={gedung} onChange={(e) => setGedung(e.target.value)} list="gedung-options-price" className="input" required />
              <datalist id="gedung-options-price">
                <option value="Gedung A" />
                <option value="Gedung B" />
                <option value="Gedung C" />
              </datalist>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipe Kamar" required>
              <input type="text" value={tipeKamar} onChange={(e) => setTipeKamar(e.target.value)} placeholder="Standard / Deluxe / etc" className="input" required />
            </FormField>
            <FormField label="Paket" required>
              <select value={paket} onChange={(e) => setPaket(e.target.value)} className="input">
                <option value="Harian">Harian</option>
                <option value="Mingguan">Mingguan</option>
                <option value="Bulanan">Bulanan</option>
                <option value="6 Bulan">6 Bulan</option>
                <option value="Setahun">Setahun</option>
              </select>
            </FormField>
          </div>

          <FormField label="Harga Satuan (per periode)" required>
            <RupiahInput value={hargaSatuan} onChange={setHargaSatuan} />
          </FormField>

          <FormField label="DP Minimal">
            <RupiahInput value={dpMinimal} onChange={setDpMinimal} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Extra Bed (per bed/periode)">
              <RupiahInput value={extraBedDefault} onChange={setExtraBedDefault} />
            </FormField>
            <FormField label="Extra Person (per orang/periode)">
              <RupiahInput value={extraPersonDefault} onChange={setExtraPersonDefault} />
            </FormField>
          </div>

          <FormField label="Status">
            <select value={aktif} onChange={(e) => setAktif(e.target.value)} className="input">
              <option value="YA">Aktif</option>
              <option value="TIDAK">Nonaktif</option>
            </select>
          </FormField>

          <FormField label="Catatan">
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} className="input resize-y" />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-sec flex-1">Batal</button>
            <button type="submit" disabled={submitting} className="btn btn-pri flex-1">
              {submitting ? '⏳ Saving...' : existing ? '💾 Update' : '✓ Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================
// 4. HARGA MASSAL Panel
// ===========================================

// Derive a floor number from the room's tipe/catatan ("Lantai 2" → 2).
// Mirrors floorForRoom() in src/app/kamar/page.tsx.
function floorForRoom(room: RoomStatus): number {
  const src = `${room.Tipe_Kamar} ${room.Catatan}`;
  const m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
  return m ? Number(m[1]) : 1;
}

export function HargaMassalPanel() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterGedung, setFilterGedung] = useState('ALL');
  const [filterLantai, setFilterLantai] = useState('ALL');
  const [paket, setPaket] = useState('Bulanan');
  const [hargaSatuan, setHargaSatuan] = useState(0);
  const [dpMinimal, setDpMinimal] = useState(0);
  const [extraBedDefault, setExtraBedDefault] = useState(0);
  const [extraPersonDefault, setExtraPersonDefault] = useState(0);
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bulk-price-data'],
    queryFn: api.getBulkPriceData,
  });

  const rooms = data?.rooms || [];
  const rules = data?.rules || [];

  // Distinct gedung values for the Gedung filter.
  const gedungOptions = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.Gedung).filter(Boolean))).sort(),
    [rooms],
  );

  // Distinct floor numbers (derived) for the Lantai filter.
  const lantaiOptions = useMemo(
    () => Array.from(new Set(rooms.map((r) => floorForRoom(r)))).sort((a, b) => a - b),
    [rooms],
  );

  // Rooms matching the active Gedung + Lantai filter.
  const filteredRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          (filterGedung === 'ALL' || r.Gedung === filterGedung) &&
          (filterLantai === 'ALL' || floorForRoom(r) === Number(filterLantai)),
      ),
    [rooms, filterGedung, filterLantai],
  );

  // Group filtered rooms by gedung
  const groupedRooms = useMemo(() => {
    const map = new Map<string, RoomStatus[]>();
    filteredRooms.forEach((r) => {
      if (!map.has(r.Gedung)) map.set(r.Gedung, []);
      map.get(r.Gedung)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRooms]);

  function toggleRoom(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGedung(gedung: string) {
    // Operate only on rooms visible under the current filter.
    const gedungRooms = filteredRooms.filter((r) => r.Gedung === gedung);
    const allSelected = gedungRooms.every((r) => selectedIds.has(r.RoomID));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      gedungRooms.forEach((r) => {
        if (allSelected) next.delete(r.RoomID);
        else next.add(r.RoomID);
      });
      return next;
    });
  }

  // Select exactly the rooms currently matching the Gedung+Lantai filter.
  function selectFiltered() {
    setSelectedIds(new Set(filteredRooms.map((r) => r.RoomID)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) {
      toast.error('Pilih minimal 1 kamar');
      return;
    }
    if (hargaSatuan <= 0) {
      toast.error('Harga satuan wajib lebih dari 0');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.submitBulkRoomPrice({
        roomIdsCsv: Array.from(selectedIds).join(','),
        paket,
        hargaSatuan,
        dpMinimal,
        extraBedDefault,
        extraPersonDefault,
        catatan,
      });
      toast.success(result.message || `Harga diterapkan ke ${selectedIds.size} kamar`);
      queryClient.invalidateQueries({ queryKey: ['bulk-price-data'] });
      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      setSelectedIds(new Set());
      setHargaSatuan(0);
      setCatatan('');
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="text-tx3 text-sm text-center py-12">Loading...</div>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* LEFT: Room selector */}
      <div>
        {/* Gedung + Lantai filters */}
        <div className="bg-sf2 border border-bd rounded-md p-3 mb-3 space-y-2.5">
          <div>
            <div className="text-[11px] font-semibold text-tx2 mb-1.5">Gedung</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterGedung('ALL')}
                className={
                  filterGedung === 'ALL'
                    ? 'px-2.5 py-1 rounded text-[11px] font-semibold bg-ac text-white'
                    : 'px-2.5 py-1 rounded text-[11px] font-semibold bg-sf border border-bd text-tx2 hover:bg-sf2'
                }
              >
                Semua
              </button>
              {gedungOptions.map((g) => (
                <button
                  key={g}
                  onClick={() => setFilterGedung(g)}
                  className={
                    filterGedung === g
                      ? 'px-2.5 py-1 rounded text-[11px] font-semibold bg-ac text-white'
                      : 'px-2.5 py-1 rounded text-[11px] font-semibold bg-sf border border-bd text-tx2 hover:bg-sf2'
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-tx2 mb-1.5">Lantai</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterLantai('ALL')}
                className={
                  filterLantai === 'ALL'
                    ? 'px-2.5 py-1 rounded text-[11px] font-semibold bg-ac text-white'
                    : 'px-2.5 py-1 rounded text-[11px] font-semibold bg-sf border border-bd text-tx2 hover:bg-sf2'
                }
              >
                Semua
              </button>
              {lantaiOptions.map((l) => (
                <button
                  key={l}
                  onClick={() => setFilterLantai(String(l))}
                  className={
                    filterLantai === String(l)
                      ? 'px-2.5 py-1 rounded text-[11px] font-semibold bg-ac text-white'
                      : 'px-2.5 py-1 rounded text-[11px] font-semibold bg-sf border border-bd text-tx2 hover:bg-sf2'
                  }
                >
                  Lantai {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="text-xs text-tx3">
            {selectedIds.size} kamar terpilih · {filteredRooms.length} kamar terfilter
          </div>
          <div className="flex gap-1">
            <button onClick={selectFiltered} className="btn btn-sec btn-sm text-[10px]">Pilih semua (yang terfilter)</button>
            <button onClick={clearAll} className="btn btn-sec btn-sm text-[10px]">Kosongkan pilihan</button>
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {groupedRooms.length === 0 && (
            <div className="bg-sf2 border border-bd border-dashed rounded-md p-6 text-center text-tx3 text-xs">
              Tidak ada kamar yang cocok dengan filter ini.
            </div>
          )}
          {groupedRooms.map(([gedung, items]) => {
            const allSelected = items.every((r) => selectedIds.has(r.RoomID));
            const someSelected = items.some((r) => selectedIds.has(r.RoomID));
            return (
              <div key={gedung}>
                <button
                  onClick={() => toggleGedung(gedung)}
                  className="w-full flex justify-between items-center font-bold text-xs uppercase tracking-wider text-tx2 mb-1.5 hover:text-tx"
                >
                  <span>📍 {gedung}</span>
                  <span className="text-tx3 text-[10px] normal-case font-normal">
                    {allSelected ? '✓ Semua' : someSelected ? '◐ Sebagian' : '○ Belum'} · {items.length} kamar
                  </span>
                </button>
                <div className="space-y-1">
                  {items.map((r) => {
                    const checked = selectedIds.has(r.RoomID);
                    const existingRule = rules.find((ru) => ru.RoomID === r.RoomID && ru.Paket === paket);
                    return (
                      <label
                        key={r.RoomID}
                        className={
                          checked
                            ? 'flex items-center gap-2 p-2 bg-amb border border-am rounded cursor-pointer text-xs'
                            : 'flex items-center gap-2 p-2 bg-sf border border-bd rounded cursor-pointer text-xs hover:bg-sf2'
                        }
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleRoom(r.RoomID)} className="w-3.5 h-3.5 accent-ac" />
                        <span className="font-medium flex-1 truncate">{r.Nama_Kamar}</span>
                        <span className="text-tx3 text-[10px] tabular-nums">{r.Tipe_Kamar}</span>
                        {existingRule && (
                          <span className="bg-gr/10 text-gr px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums">
                            {formatRupiahShort(existingRule.Harga_Satuan)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Form */}
      <div>
        <form onSubmit={handleSubmit} className="bg-sf border border-bd rounded-md p-4 space-y-3 sticky top-4">
          <h3 className="font-bold text-sm">📋 Apply Harga ke Kamar Terpilih</h3>
          <div className="text-tx3 text-xs">
            {selectedIds.size === 0 ? (
              <span className="text-am">⚠️ Belum ada kamar dipilih</span>
            ) : (
              <span>{selectedIds.size} kamar akan dapat harga ini untuk paket <strong>{paket}</strong></span>
            )}
          </div>

          <FormField label="Paket" required>
            <select value={paket} onChange={(e) => setPaket(e.target.value)} className="input">
              <option value="Harian">Harian</option>
              <option value="Mingguan">Mingguan</option>
              <option value="Bulanan">Bulanan</option>
              <option value="6 Bulan">6 Bulan</option>
              <option value="Setahun">Setahun</option>
            </select>
          </FormField>

          <FormField label="Harga Satuan (per periode)" required>
            <RupiahInput value={hargaSatuan} onChange={setHargaSatuan} />
          </FormField>

          <FormField label="DP Minimal">
            <RupiahInput value={dpMinimal} onChange={setDpMinimal} />
          </FormField>

          <div className="grid grid-cols-2 gap-2">
            <FormField label="Extra Bed">
              <RupiahInput value={extraBedDefault} onChange={setExtraBedDefault} />
            </FormField>
            <FormField label="Extra Person">
              <RupiahInput value={extraPersonDefault} onChange={setExtraPersonDefault} />
            </FormField>
          </div>

          <FormField label="Catatan">
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} className="input resize-y" />
          </FormField>

          <button type="submit" disabled={submitting || selectedIds.size === 0} className="btn btn-pri w-full">
            {submitting ? '⏳ Applying...' : `✓ Terapkan ke ${selectedIds.size} kamar`}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===========================================
// 5. FASILITAS KAMAR Panel
// ===========================================

export function FasilitasPanel() {
  const queryClient = useQueryClient();
  const [editingFac, setEditingFac] = useState<Fasilitas | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['fasilitas'],
    queryFn: facilityApi.list,
  });

  async function handleDelete(fac: Fasilitas) {
    const ok = confirm(`Hapus fasilitas ${fac.emoji} ${fac.nama}?\n\nFasilitas ini akan dihapus dari semua kamar yang punya assignment ke fasilitas ini.`);
    if (!ok) return;
    try {
      await facilityApi.delete(fac.id);
      toast.success('✓ Fasilitas dihapus');
      queryClient.invalidateQueries({ queryKey: ['fasilitas'] });
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-tx3 text-xs">{facilities.length} fasilitas tercatat</p>
        <button onClick={() => setShowAddModal(true)} className="btn btn-pri text-xs">
          + Tambah Fasilitas
        </button>
      </div>

      {isLoading ? (
        <div className="text-tx3 text-sm text-center py-12">Loading...</div>
      ) : facilities.length === 0 ? (
        <div className="bg-sf2 border border-bd border-dashed rounded-md p-8 text-center text-tx3 text-sm">
          Belum ada fasilitas
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {facilities.map((f) => (
            <div key={f.id} className="bg-sf border border-bd rounded-md p-3 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xl flex-shrink-0">{f.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{f.nama}</div>
                  <div className="text-tx3 text-[10px] truncate">
                    {f.kode} ·{' '}
                    {f.price_adjust > 0
                      ? `+${formatRupiahShort(f.price_adjust)}/${
                          f.satuan === 'per_hari' ? 'hari' : f.satuan === 'per_tahun' ? 'tahun' : 'bulan'
                        }`
                      : 'Free'}
                    {!f.is_active && <span className="text-rd ml-1">· NONAKTIF</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditingFac(f)} className="btn btn-sec btn-sm">✏️</button>
                <button onClick={() => handleDelete(f)} className="btn btn-danger btn-sm">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <FasilitasModal onClose={() => setShowAddModal(false)} />}
      {editingFac && <FasilitasModal existing={editingFac} onClose={() => setEditingFac(null)} />}
    </div>
  );
}

function FasilitasModal({
  existing,
  onClose,
}: {
  existing?: Fasilitas;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [kode, setKode] = useState(existing?.kode || '');
  const [nama, setNama] = useState(existing?.nama || '');
  const [emoji, setEmoji] = useState(existing?.emoji || '⭐');
  const [priceAdjust, setPriceAdjust] = useState(existing?.price_adjust || 0);
  const [satuan, setSatuan] = useState<'per_bulan' | 'per_hari' | 'per_tahun'>(
    existing?.satuan || 'per_bulan',
  );
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [description, setDescription] = useState(existing?.description || '');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kode.trim() || !nama.trim()) {
      toast.error('Kode & nama wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await facilityApi.save({
        id: existing?.id,
        kode: kode.trim().toUpperCase(),
        nama: nama.trim(),
        emoji,
        price_adjust: priceAdjust,
        satuan,
        is_active: isActive,
        description,
      });
      toast.success(existing ? '✓ Fasilitas diupdate' : '✓ Fasilitas ditambah');
      queryClient.invalidateQueries({ queryKey: ['fasilitas'] });
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-sf w-full max-w-md rounded-lg shadow-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-base">{existing ? '✏️ Edit Fasilitas' : '+ Tambah Fasilitas'}</h3>
          <button onClick={onClose} className="text-tx3 hover:text-tx">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <FormField label="Emoji">
              <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} className="input text-center text-xl" />
            </FormField>
            <FormField label="Kode" required>
              <input type="text" value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="AC, WIFI, TV" className="input uppercase" required />
            </FormField>
          </div>

          <FormField label="Nama Fasilitas" required>
            <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="AC Split Standard / WiFi Cepat" className="input" required />
          </FormField>

          <FormField label="Tambahan Harga" hint="Set 0 untuk fasilitas gratis. Otomatis dikalikan lama sewa saat booking.">
            <RupiahInput value={priceAdjust} onChange={setPriceAdjust} />
          </FormField>

          <FormField label="Satuan Harga" hint="Per hari, per bulan, atau per tahun — dipakai untuk menghitung saat booking.">
            <div className="flex gap-2">
              {(['per_hari', 'per_bulan', 'per_tahun'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setSatuan(u)}
                  className={
                    'flex-1 py-2 rounded-md text-xs font-semibold border ' +
                    (satuan === u ? 'bg-ac text-inv border-ac' : 'bg-sf text-tx2 border-bd')
                  }
                >
                  {u === 'per_hari' ? 'Per Hari' : u === 'per_bulan' ? 'Per Bulan' : 'Per Tahun'}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Deskripsi">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input resize-y" />
          </FormField>

          <label className="flex items-center gap-2 p-2.5 bg-sf2 border border-bd rounded-md cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-ac" />
            <span className="text-xs font-semibold">Fasilitas aktif (muncul di form booking)</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-sec flex-1">Batal</button>
            <button type="submit" disabled={submitting} className="btn btn-pri flex-1">
              {submitting ? '⏳ Saving...' : existing ? '💾 Update' : '✓ Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================
// HALAMAN INFO (public landing /info) editor
// ===========================================
function readBase64_(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    r.onerror = () => reject(new Error('Gagal membaca berkas'));
    r.readAsDataURL(file);
  });
}

function MediaSlot({
  value,
  onChange,
  label,
  accept = 'image/*',
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const isVideo = accept.startsWith('video');

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const base64 = await readBase64_(file);
      const res = await halamanInfoApi.uploadMedia({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        base64,
      } as BuktiFile);
      if (res?.url) {
        onChange(res.url);
        toast.success('Berhasil diunggah');
      } else {
        toast.error('Upload gagal: tidak ada URL kembali. Pasang patch backend dulu, atau tempel link manual.');
      }
    } catch (e) {
      toast.error('Upload gagal: ' + (e as Error).message + '. Bisa tempel link foto/video manual di bawah.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="text-[11px] font-semibold text-tx2 mb-1 block">{label}</label>
      {value ? (
        <div className="relative">
          {isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={value} controls className="w-full rounded-md border border-bd aspect-video bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="w-full rounded-md border border-bd object-cover aspect-video" />
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 border border-bd text-rd grid place-items-center text-sm shadow"
            aria-label="Hapus"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
          className={
            'flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-md py-6 px-3 text-center cursor-pointer text-xs ' +
            (drag ? 'border-ac bg-sf2' : 'border-bd bg-sf')
          }
        >
          <span className="text-lg">{busy ? '⏳' : isVideo ? '🎬' : '🖼️'}</span>
          <span className="text-tx2 font-semibold">{busy ? 'Mengunggah…' : 'Klik / seret berkas ke sini'}</span>
          <input type="file" accept={accept} className="hidden" onChange={(e) => upload(e.target.files?.[0] || undefined)} />
        </label>
      )}
      <input
        className="input mt-1.5 text-xs"
        placeholder="…atau tempel link (Drive/YouTube)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// A list of media (foto/video) up to `max` — each item is a MediaSlot.
function MediaListField({
  label,
  value,
  onChange,
  max,
  accept = 'image/*',
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  accept?: string;
}) {
  const items = value || [];
  function setAt(i: number, url: string) {
    const next = [...items];
    if (url) next[i] = url;
    else next.splice(i, 1);
    onChange(next.filter(Boolean));
  }
  const slots = Math.min(max, items.length + 1); // existing + 1 slot tambah
  return (
    <div>
      <div className="text-[11px] font-semibold text-tx2 mb-1">
        {label} <span className="text-tx3">({items.length}/{max})</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: slots }).map((_, i) => (
          <MediaSlot key={i} label={`#${i + 1}`} value={items[i] || ''} onChange={(u) => setAt(i, u)} accept={accept} />
        ))}
      </div>
    </div>
  );
}

export function HalamanInfoPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['halaman-info'], queryFn: halamanInfoApi.get });
  const [form, setForm] = useState<HalamanInfo>(DEFAULT_INFO);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(mergeInfo(data));
  }, [data]);

  function set<K extends keyof HalamanInfo>(key: K, value: HalamanInfo[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }
  function setPeng(i: number, key: 'nama' | 'sub' | 'malam' | 'bulan' | 'tahun', value: string) {
    setForm((p) => {
      const peng = p.penginapan.map((x, idx) => (idx === i ? { ...x, [key]: value } : x));
      return { ...p, penginapan: peng };
    });
  }
  function setPengFoto(i: number, list: string[]) {
    setForm((p) => ({
      ...p,
      penginapan: p.penginapan.map((x, idx) => (idx === i ? { ...x, foto: list } : x)),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await halamanInfoApi.save(form);
      toast.success('✓ Halaman info disimpan');
      qc.invalidateQueries({ queryKey: ['halaman-info'] });
    } catch (e) {
      toast.error('Gagal menyimpan: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-sf2 border border-bd rounded-md p-3 text-[11px] text-tx2">
        Konten ini muncul di halaman publik <strong>/info</strong> (bisa dibagikan ke calon penghuni). Foto/video
        diunggah ke Google Drive. Jika upload belum jalan, pasang patch backend dulu atau tempel link manual.
      </div>

      {/* Dasar */}
      <div className="space-y-3">
        <h4 className="font-bold text-sm">📝 Dasar</h4>
        <FormField label="Nama properti"><input className="input" value={form.nama} onChange={(e) => set('nama', e.target.value)} /></FormField>
        <FormField label="Tagline (judul besar)" hint="Boleh pakai Enter untuk baris baru.">
          <textarea className="input resize-y" rows={2} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </FormField>
        <FormField label="Deskripsi singkat"><textarea className="input resize-y" rows={2} value={form.deskripsi} onChange={(e) => set('deskripsi', e.target.value)} /></FormField>
        <FormField label="Alamat"><input className="input" value={form.alamat} onChange={(e) => set('alamat', e.target.value)} /></FormField>
        <FormField label="Link Google Maps"><input className="input" value={form.maps} onChange={(e) => set('maps', e.target.value)} /></FormField>
      </div>

      {/* WhatsApp */}
      <div className="space-y-3">
        <h4 className="font-bold text-sm">💬 WhatsApp</h4>
        <FormField label="WA Resmi (booking & bukti bayar)"><input className="input" value={form.waResmi} onChange={(e) => set('waResmi', e.target.value)} /></FormField>
        <FormField label="WA Survey / Penjaga (Bang Mezi)"><input className="input" value={form.waMezi} onChange={(e) => set('waMezi', e.target.value)} /></FormField>
        <FormField label="Pesan pembuka WA"><textarea className="input resize-y" rows={2} value={form.waPesan} onChange={(e) => set('waPesan', e.target.value)} /></FormField>
      </div>

      {/* Kost */}
      <div className="space-y-3">
        <h4 className="font-bold text-sm">🏠 Kost (teaser)</h4>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Teaser harga"><input className="input" value={form.kostTeaser} onChange={(e) => set('kostTeaser', e.target.value)} /></FormField>
          <FormField label="Satuan"><input className="input" value={form.kostTeaserUnit} onChange={(e) => set('kostTeaserUnit', e.target.value)} /></FormField>
        </div>
      </div>

      {/* Penginapan */}
      <div className="space-y-3">
        <h4 className="font-bold text-sm">🛏️ Penginapan (harga & foto per tipe)</h4>
        {form.penginapan.map((p, i) => (
          <div key={i} className="border border-bd rounded-md p-3 space-y-2">
            <input className="input font-semibold" value={p.nama} onChange={(e) => setPeng(i, 'nama', e.target.value)} />
            <input className="input text-xs" value={p.sub} onChange={(e) => setPeng(i, 'sub', e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <input className="input text-xs" placeholder="/malam" value={p.malam} onChange={(e) => setPeng(i, 'malam', e.target.value)} />
              <input className="input text-xs" placeholder="/bulan" value={p.bulan} onChange={(e) => setPeng(i, 'bulan', e.target.value)} />
              <input className="input text-xs" placeholder="/tahun" value={p.tahun} onChange={(e) => setPeng(i, 'tahun', e.target.value)} />
            </div>
            <MediaListField label={`Foto ${p.nama} (maks 10)`} value={p.foto} onChange={(l) => setPengFoto(i, l)} max={10} />
          </div>
        ))}
      </div>

      {/* Foto & Video */}
      <div className="space-y-4">
        <h4 className="font-bold text-sm">📸 Foto & Video</h4>
        <MediaSlot label="Foto Hero (depan)" value={form.fotoHero} onChange={(u) => set('fotoHero', u)} />
        <MediaListField label="Foto Kost (maks 10)" value={form.fotoKost} onChange={(l) => set('fotoKost', l)} max={10} />
        <MediaListField label="Foto Area / Galeri Umum (maks 10)" value={form.fotoArea} onChange={(l) => set('fotoArea', l)} max={10} />
        <MediaListField label="Video — YouTube/Drive/mp4 (maks 6)" value={form.videos} onChange={(l) => set('videos', l)} max={6} accept="video/*" />
        <div className="bg-sf2 border border-bd rounded-md p-2.5 text-[10px] text-tx3 leading-relaxed">
          💡 Video besar sebaiknya pakai <strong>link YouTube/Google Drive</strong> (tempel di kolom link) — lebih ringan & tidak makan kuota.
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-pri btn-lg w-full">
        {saving ? '⏳ Menyimpan…' : '💾 Simpan Halaman Info'}
      </button>
      <a href="/info" target="_blank" rel="noopener noreferrer" className="btn btn-sec w-full">
        🔗 Buka halaman /info
      </a>
    </div>
  );
}
