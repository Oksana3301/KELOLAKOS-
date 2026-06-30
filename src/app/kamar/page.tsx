'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type RoomStatus, type BookingItem, type SubmitRoomUpsertPayload } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { mapRoomStatus, rupiah } from '@/components/kk/status';
import { HelpSheet } from '@/components/kk/help-sheet';
import { useRole } from '@/components/kk/role';
import { ScrollFab } from '@/components/kk/scroll-fab';
import {
  KamarDetail,
  KamarForm,
  HapusKamar,
  type KamarView,
  type KamarFormValue,
} from '@/components/kk/kamar-ui';
import { buildRoomOptions, PAKET_META } from '@/components/kk/booking-ui';

const HELP = {
  title: 'Kelola Kamar',
  tips: [
    'Di sini Anda menambah, mengubah, atau menghapus kamar di properti Anda.',
    'Tekan tombol "Tambah Kamar" di atas untuk membuat kamar baru (nama, gedung, lantai).',
    'Gunakan filter Status (Terisi / Kosong / Perlu Perhatian) dan pencarian — bisa cari juga lewat nama penghuni.',
    'Harga sewa diatur di menu Pengaturan → Harga (mendukung paket kost 6 bln/1 tahun & penginapan per malam/tipe). Detail kamar tetap menampilkan harga yang berlaku.',
    'Tekan satu kartu kamar untuk membuka detailnya, lalu pilih Ubah atau Hapus.',
  ],
};

// Derive a floor number from the room's tipe/catatan ("Lantai 2" → 2).
// HANYA pola eksplisit "Lantai N" — jangan ambil sembarang angka (mis. tipe
// "Deluxe D04" jangan terbaca Lantai 4, atau catatan "renov 2023" → Lantai 2023).
function floorForRoom(room: RoomStatus): number {
  const src = `${room.Tipe_Kamar || ''} ${room.Catatan || ''}`;
  const m = src.match(/lantai\s*(\d+)/i);
  return m ? Number(m[1]) : 1;
}

// Display label for a room's type / service (used by the Tipe filter).
function tipeLabel(room: RoomStatus): string {
  const t = (room.Tipe_Kamar || '').trim();
  if (t) return t;
  const l = (room.Layanan_Default || '').toUpperCase();
  if (l === 'KOS') return 'Kos';
  if (l === 'PENGINAPAN') return 'Penginapan';
  return l ? l.charAt(0) + l.slice(1).toLowerCase() : 'Lainnya';
}

// First occupant name from "Penghuni_Text" (may hold several, comma-separated).
function penghuniName(room: RoomStatus): string {
  return (room.Penghuni_Text || '').trim();
}

const MS_DAY = 86400000;

// Stay info derived from the room's active booking (dates aren't on RoomStatus).
interface StayInfo {
  durasi: string; // "3 bulan" / "14 hari"
  sisaHari: number | null; // days left until checkout (negative = past)
}
function stayInfoFor(b: BookingItem | undefined): StayInfo | null {
  if (!b) return null;
  const periode = Number(b.Jumlah_Periode) || 0;
  const paket = (b.Paket || '').toUpperCase();
  const satuan = /HARI/.test(paket) ? 'hari' : 'bulan';
  const durasi = periode > 0 ? `${periode} ${satuan}` : '';
  let sisaHari: number | null = null;
  if (b.CheckOut) {
    const out = new Date(b.CheckOut);
    if (!isNaN(out.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      out.setHours(0, 0, 0, 0);
      sisaHari = Math.round((out.getTime() - today.getTime()) / MS_DAY);
    }
  }
  return { durasi, sisaHari };
}

const SEMUA = 'Semua';

export default function KamarPage() {
  const qc = useQueryClient();
  const role = useRole();
  const [helpOpen, setHelpOpen] = useState(false);
  const [detail, setDetail] = useState<KamarView | null>(null);
  const [form, setForm] = useState<{ edit: boolean; view: KamarView | null } | null>(null);
  const [hapus, setHapus] = useState<KamarView | null>(null);

  // Filters
  const [cari, setCari] = useState('');
  const [fStatus, setFStatus] = useState<string>(SEMUA);
  const [fTipe, setFTipe] = useState<string>(SEMUA);
  const [fGedung, setFGedung] = useState<string>(SEMUA);
  const [fLantai, setFLantai] = useState<string>(SEMUA);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat kamar: ' + (error as Error)?.message);
  }, [isError, error]);

  const rooms = useMemo(() => data?.roomStatus || [], [data]);
  const rules = useMemo(() => data?.roomPriceRules || [], [data]);
  const prices = useMemo(() => data?.prices || [], [data]);

  // Map RoomID → its active booking (for stay duration / days left). Prefer a
  // non-cancelled booking; later lists don't override an earlier match.
  const bookingByRoom = useMemo(() => {
    const m = new Map<string, BookingItem>();
    if (!data) return m;
    [
      ...(data.paymentBookings || []),
      ...(data.statusActionBookings || []),
      ...(data.closingBookings || []),
      ...(data.feeBookingOptions || []),
    ].forEach((b) => {
      const code = (b.Status_Booking || '').toUpperCase();
      if (code.includes('CANCEL') || code.includes('BATAL')) return;
      if (b.RoomID && !m.has(b.RoomID)) m.set(b.RoomID, b);
    });
    return m;
  }, [data]);

  // Monthly price per room — reuse the SAME resolver the Booking flow uses so the
  // Kamar list and the booking screen never disagree (type-first match, per-room
  // override, penginapan name-as-type).
  const hargaByRoom = useMemo(() => {
    const opts = buildRoomOptions(rooms, prices, undefined, rules);
    return new Map(
      opts.map((o) => [
        o.room.RoomID,
        { harga: o.harga, unit: o.primaryKind ? PAKET_META[o.primaryKind].unitLong : 'bulan' },
      ]),
    );
  }, [rooms, prices, rules]);

  // Build enriched views (room + derived harga + lantai).
  const views: KamarView[] = useMemo(
    () =>
      rooms.map((room) => ({
        room,
        harga: hargaByRoom.get(room.RoomID)?.harga || 0,
        hargaUnit: hargaByRoom.get(room.RoomID)?.unit || 'bulan',
        lantai: floorForRoom(room),
      })),
    [rooms, hargaByRoom],
  );

  const buildings = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.Gedung).filter(Boolean))).sort(),
    [rooms],
  );

  // ── Filter options (distinct values + "Semua") ──
  const tipeOptions = useMemo(
    () => [SEMUA, ...Array.from(new Set(views.map((v) => tipeLabel(v.room)).filter(Boolean))).sort()],
    [views],
  );
  const gedungOptions = useMemo(() => [SEMUA, ...buildings], [buildings]);
  const lantaiOptions = useMemo(
    () => [
      SEMUA,
      ...Array.from(new Set(views.map((v) => v.lantai)))
        .sort((a, b) => a - b)
        .map(String),
    ],
    [views],
  );

  // Status filter labels → the value mapRoomStatus returns ("Kosong" = Tersedia).
  const statusOptions = [SEMUA, 'Terisi', 'Kosong', 'Perlu Perhatian'];

  // ── Apply all filters together ──
  const filtered = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return views.filter((v) => {
      if (q) {
        const hay = `${v.room.Nama_Kamar} ${v.room.Gedung} ${penghuniName(v.room)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fStatus !== SEMUA) {
        const s = mapRoomStatus(v.room); // 'Terisi' | 'Tersedia' | 'Perlu Perhatian'
        const want = fStatus === 'Kosong' ? 'Tersedia' : fStatus;
        if (s !== want) return false;
      }
      if (fTipe !== SEMUA && tipeLabel(v.room) !== fTipe) return false;
      if (fGedung !== SEMUA && v.room.Gedung !== fGedung) return false;
      if (fLantai !== SEMUA && String(v.lantai) !== fLantai) return false;
      return true;
    });
  }, [views, cari, fStatus, fTipe, fGedung, fLantai]);

  const byBuilding = useMemo(() => {
    const grouped: Record<string, KamarView[]> = {};
    filtered.forEach((v) => {
      (grouped[v.room.Gedung] ||= []).push(v);
    });
    return grouped;
  }, [filtered]);

  // ── Upsert mutation (real API; payload shape per SubmitRoomUpsertPayload) ──
  const upsert = useMutation({
    mutationFn: (payload: SubmitRoomUpsertPayload) => api.submitRoomUpsert(payload),
    onSuccess: (res, payload) => {
      toast.success(res.message || `✓ ${payload.namaKamar} berhasil disimpan`);
      setForm(null);
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['room-management'] });
    },
    onError: (e) => toast.error('Gagal menyimpan: ' + (e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (roomId: string) => api.submitRoomDelete(roomId),
    onSuccess: (res, _roomId) => {
      toast.success(res.message || 'Kamar telah dihapus');
      setHapus(null);
      setDetail(null);
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['room-management'] });
    },
    onError: (e) => toast.error('Gagal menghapus: ' + (e as Error).message),
  });

  function handleSave(value: KamarFormValue) {
    const existing = form?.view?.room;
    // Lantai disimpan di Catatan sbg "Lantai N" (sumber baca floorForRoom).
    // Pertahankan catatan lain milik kamar (jangan terhapus saat ubah lantai).
    const restNote = String(existing?.Catatan || '')
      .replace(/lantai\s*\d+/gi, '')
      .replace(/^[\s·,-]+|[\s·,-]+$/g, '')
      .trim();
    const catatan = restNote ? `Lantai ${value.lantai} · ${restNote}` : `Lantai ${value.lantai}`;
    // Tipe kamar TIDAK boleh berisi "Lantai N" (itu bukan tipe — merusak
    // pencocokan harga). Bersihkan bila terlanjur begitu; kamar baru → kosong
    // (harga diatur di Pengaturan, tipe bisa diisi belakangan di sana).
    const existingTipe = String(existing?.Tipe_Kamar || '').trim();
    const tipeKamar = /^lantai\s*\d+$/i.test(existingTipe) ? '' : existingTipe;
    upsert.mutate({
      roomId: existing?.RoomID,
      namaKamar: value.nomor,
      layananDefault: existing?.Layanan_Default || 'KOS',
      gedung: value.gedung,
      tipeKamar,
      kapasitasNormal: existing?.Kapasitas_Normal || 1,
      statusKamar: existing?.Status_Kamar || 'TERSEDIA',
      catatan,
    });
  }

  const formInitial: KamarFormValue | null =
    form?.view != null
      ? {
          nomor: form.view.room.Nama_Kamar,
          gedung: form.view.room.Gedung,
          lantai: form.view.lantai,
        }
      : null;

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
        <div className="text-body text-kk-ink">Memuat data kamar…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <KkCard className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
          <KkIcon name="info" size={30} />
        </div>
        <h2 className="font-heading font-bold text-subhead mb-2">Gagal memuat data</h2>
        <p className="text-body text-kk-ink mb-5">{(error as Error)?.message || 'Terjadi kesalahan'}</p>
        <KkButton variant="primary" onClick={() => refetch()}>
          Coba Lagi
        </KkButton>
      </KkCard>
    );
  }

  return (
    <>
      <ScreenHead
        title="Kelola Kamar"
        sub={`${rooms.length} kamar di ${buildings.length} gedung`}
        onHelp={() => setHelpOpen(true)}
      />

      {role === 'admin' && (
        <div className="mb-6">
          <KkButton
            variant="secondary"
            className="min-h-[48px]"
            onClick={() => setForm({ edit: false, view: null })}
          >
            <KkIcon name="tambah" size={22} /> Tambah Kamar
          </KkButton>
          <p className="text-caption text-kk-ink mt-2 mb-0">
            Tekan satu kamar untuk <b className="text-kk-navy">ubah</b> atau{' '}
            <b className="text-kk-navy">hapus</b>.
          </p>
        </div>
      )}

      {rooms.length === 0 ? (
        <KkCard tone="mint" className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-white text-kk-navy grid place-items-center mx-auto mb-4">
            <KkIcon name="kamar" size={30} />
          </div>
          <p className="text-body text-kk-navy m-0">
            {role === 'admin'
              ? 'Belum ada kamar. Tekan tombol Tambah Kamar di atas untuk memulai.'
              : 'Belum ada kamar.'}
          </p>
        </KkCard>
      ) : (
        <>
          {/* ── Filter bar ── */}
          <div className="mb-5 space-y-3">
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nomor kamar, gedung, atau nama penghuni…"
              className="kk-input"
            />
            <StatusFilterPills value={fStatus} options={statusOptions} onChange={setFStatus} />
            <FilterPills label="Tipe" options={tipeOptions} value={fTipe} onChange={setFTipe} />
            <FilterPills label="Gedung" options={gedungOptions} value={fGedung} onChange={setFGedung} />
            <FilterPills
              label="Lantai"
              options={lantaiOptions}
              value={fLantai}
              onChange={setFLantai}
              render={(o) => (o === SEMUA ? o : `Lantai ${o}`)}
            />
          </div>

          <p className="text-caption font-semibold text-kk-ink mt-0 mb-4">
            Menampilkan {filtered.length} kamar
          </p>

          {filtered.length === 0 ? (
            <KkCard className="text-center text-body text-kk-ink py-7">
              Tidak ada kamar yang cocok dengan pencarian atau filter ini.
            </KkCard>
          ) : (
            <div className="space-y-6">
              {buildings.map((g) => {
                const list = byBuilding[g] || [];
                if (list.length === 0) return null;
                return (
                  <div key={g}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <KkIcon name="properti" size={22} strokeWidth={2.2} className="text-kk-navy" />
                      <h2 className="font-heading font-bold text-[21px] text-kk-navy m-0">{g}</h2>
                      <span className="text-caption font-semibold text-kk-ink">· {list.length} kamar</span>
                    </div>

                    <div className="space-y-3">
                      {list.map((v) => (
                        <RoomRow
                          key={v.room.RoomID}
                          view={v}
                          booking={bookingByRoom.get(v.room.RoomID)}
                          onClick={() => setDetail(v)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail → Ubah / Hapus */}
      <KamarDetail
        view={detail}
        onClose={() => setDetail(null)}
        onEdit={(v) => {
          setDetail(null);
          setForm({ edit: true, view: v });
        }}
        onDelete={(v) => setHapus(v)}
      />

      {/* Add / Edit form */}
      <KamarForm
        open={!!form}
        edit={!!form?.edit}
        initial={formInitial}
        buildings={buildings}
        saving={upsert.isPending}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />

      {/* Delete confirm */}
      <HapusKamar
        view={hapus}
        loading={remove.isPending}
        onClose={() => setHapus(null)}
        onConfirm={() => hapus && remove.mutate(hapus.room.RoomID)}
      />

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />

      <ScrollFab />
    </>
  );
}

// Status filter with a colored dot per option (matches the room-card tints) so
// the owner can eyeball Terisi / Kosong / Perlu Perhatian at a glance.
function StatusFilterPills({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const dot: Record<string, string> = {
    Terisi: 'bg-kk-green',
    Kosong: 'bg-kk-mauve',
    'Perlu Perhatian': 'bg-kk-orange',
  };
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1">
      <span className="flex-shrink-0 text-caption font-semibold text-kk-ink">Status</span>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`flex-shrink-0 inline-flex items-center gap-2 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[16px] border-2 ${
              active ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy'
            }`}
          >
            {dot[o] && (
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${active ? 'bg-white' : dot[o]}`} />
            )}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function FilterPills({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  render?: (o: string) => string;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1">
      <span className="flex-shrink-0 text-caption font-semibold text-kk-ink">{label}</span>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`flex-shrink-0 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[16px] border-2 ${
              active
                ? 'border-kk-navy bg-kk-navy text-white'
                : 'border-kk-mauve bg-white text-kk-navy'
            }`}
          >
            {render ? render(o) : o}
          </button>
        );
      })}
    </div>
  );
}

function RoomRow({
  view,
  booking,
  onClick,
}: {
  view: KamarView;
  booking?: BookingItem;
  onClick: () => void;
}) {
  const { room, harga, lantai, hargaUnit } = view;
  const status = mapRoomStatus(room);
  const tint =
    status === 'Terisi'
      ? 'bg-kk-mint-soft border-kk-mint'
      : status === 'Perlu Perhatian'
        ? 'bg-kk-orange-soft border-kk-orange'
        : 'bg-kk-mauve-soft border-kk-mauve';

  const nama = penghuniName(room);
  const terisi = status !== 'Tersedia';
  const stay = terisi ? stayInfoFor(booking) : null;

  // "sisa" chip text + color
  let sisaText = '';
  let sisaClass = 'text-kk-ink';
  if (stay && stay.sisaHari !== null) {
    if (stay.sisaHari < 0) {
      sisaText = `lewat ${Math.abs(stay.sisaHari)} hari`;
      sisaClass = 'text-kk-orange';
    } else if (stay.sisaHari === 0) {
      sisaText = 'habis hari ini';
      sisaClass = 'text-kk-orange';
    } else {
      sisaText = `sisa ${stay.sisaHari} hari`;
      sisaClass = stay.sisaHari <= 7 ? 'text-kk-orange' : 'text-kk-green';
    }
  }

  return (
    <KkCard onClick={onClick} className="flex items-center gap-3.5 py-4">
      <div
        className={`w-[50px] h-[50px] rounded-[13px] flex-shrink-0 border-2 grid place-items-center text-kk-navy ${tint}`}
      >
        <KkIcon name="kamar" size={24} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-heading font-bold text-[19px] text-kk-navy">{room.Nama_Kamar}</span>
          {terisi && nama && (
            <span className="text-caption text-kk-ink truncate">· {nama}</span>
          )}
        </div>
        <div className="text-caption text-kk-ink">
          Lantai {lantai} · {harga > 0 ? `${rupiah(harga)}/${hargaUnit || 'bulan'}` : 'Harga belum diatur'}
        </div>
        {terisi ? (
          <div className="mt-1 flex items-center gap-2 flex-wrap text-caption">
            {stay?.durasi && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-kk-navy">
                <KkIcon name="kalender" size={15} strokeWidth={2.2} /> Sewa {stay.durasi}
              </span>
            )}
            {sisaText && <span className={`font-semibold ${sisaClass}`}>· {sisaText}</span>}
          </div>
        ) : (
          <div className="mt-1 text-caption font-semibold text-kk-green">Siap disewa</div>
        )}
      </div>
      <KkIcon name="chevron" size={22} strokeWidth={2.4} className="text-kk-mauve flex-shrink-0" />
    </KkCard>
  );
}
