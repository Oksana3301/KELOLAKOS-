'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type RoomStatus } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, Sheet, SheetHead, InfoRow, RoomBadge } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { mapRoomStatus, type RoomDisplayStatus } from '@/components/kk/status';
import { HelpSheet } from '@/components/kk/help-sheet';
import { ScrollFab } from '@/components/kk/scroll-fab';
import { BuildingMap2D } from '@/components/kk/building-map';
import { roomKey, type RoomStatus3 } from '@/lib/building-layout';

const SEMUA = 'Semua';

// Plain status filter values (the page maps Tersedia→Kosong, Perlu Perhatian→Perhatian).
type StatusFilter = 'Semua' | 'Terisi' | 'Kosong' | 'Perhatian';
const STATUS_FILTERS: StatusFilter[] = ['Semua', 'Terisi', 'Kosong', 'Perhatian'];

// Map a room to its plain filter bucket using the existing status mapping.
function statusBucket(room: RoomStatus): Exclude<StatusFilter, 'Semua'> {
  const s = mapRoomStatus(room);
  if (s === 'Terisi') return 'Terisi';
  if (s === 'Tersedia') return 'Kosong';
  return 'Perhatian';
}

const HELP = {
  title: 'Layout Properti',
  tips: [
    'Ini peta semua kamar properti Anda beserta kondisinya saat ini.',
    'Warna kamar menunjukkan statusnya: hijau = Terisi, putih = Kosong, oranye = Perlu Perhatian.',
    'Tekan satu kamar untuk melihat detail penyewa dan statusnya.',
  ],
};

// Status tint for the room tiles + summary cards — three clearly distinct
// colors so the owner can scan at a glance: green = Terisi, white = Kosong,
// orange = Perlu Perhatian.
const TILE_TINT: Record<RoomDisplayStatus, { bg: string; dot: string; text: string }> = {
  Terisi: { bg: 'bg-kk-mint-soft border-kk-green', dot: 'bg-kk-green', text: 'text-kk-green' },
  Tersedia: { bg: 'bg-white border-kk-mauve', dot: 'bg-kk-ink', text: 'text-kk-ink' },
  'Perlu Perhatian': { bg: 'bg-kk-orange-soft border-kk-orange', dot: 'bg-kk-orange', text: 'text-kk-orange' },
};

// Plain-language label shown on tiles/summary ("Kosong" instead of "Tersedia").
function plainLabel(s: RoomDisplayStatus): string {
  return s === 'Tersedia' ? 'Kosong' : s;
}

// Derive a floor number from the room's tipe/catatan ("Lantai 2" → 2).
function floorForRoom(room: RoomStatus): number {
  const src = `${room.Tipe_Kamar} ${room.Catatan}`;
  const m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
  return m ? Number(m[1]) : 1;
}

// First name of the tenant from Penghuni_Text (drop honorifics, keep first word).
function firstName(penghuni: string | null | undefined): string | null {
  if (!penghuni) return null;
  const cleaned = penghuni.replace(/^(Pak|Bu|Bpk|Ibu|Mas|Mbak)\s+/i, '').trim();
  const word = cleaned.split(/[\s,·]+/)[0];
  return word || null;
}

export default function LayoutPropertiPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [selected, setSelected] = useState<RoomStatus | null>(null);

  // Filters
  const [cari, setCari] = useState('');
  const [fGedung, setFGedung] = useState<string>(SEMUA);
  const [fLantai, setFLantai] = useState<string>(SEMUA);
  const [fStatus, setFStatus] = useState<StatusFilter>('Semua');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat data: ' + (error as Error)?.message);
  }, [isError, error]);

  const rooms = useMemo(() => data?.roomStatus || [], [data]);

  // Status per kamar untuk Denah (cocokkan via nama kamar).
  const statusMap = useMemo(() => {
    const m = new Map<string, RoomStatus3>();
    rooms.forEach((r) => {
      const s = mapRoomStatus(r);
      const v: RoomStatus3 = s === 'Tersedia' ? 'kosong' : s === 'Terisi' ? 'terisi' : 'perbaikan';
      m.set(roomKey(r.Nama_Kamar), v);
    });
    return m;
  }, [rooms]);

  // Occupancy summary counts (3 plain statuses).
  const stats = useMemo(
    () =>
      rooms.reduce(
        (acc, r) => {
          const s = mapRoomStatus(r);
          if (s === 'Terisi') acc.terisi++;
          else if (s === 'Tersedia') acc.kosong++;
          else acc.perhatian++;
          return acc;
        },
        { terisi: 0, kosong: 0, perhatian: 0 },
      ),
    [rooms],
  );

  // ── Filter options (distinct values + "Semua") ──
  const gedungOptions = useMemo(
    () => [SEMUA, ...Array.from(new Set(rooms.map((r) => r.Gedung).filter(Boolean))).sort()],
    [rooms],
  );
  const lantaiOptions = useMemo(
    () => [
      SEMUA,
      ...Array.from(new Set(rooms.map((r) => floorForRoom(r))))
        .sort((a, b) => a - b)
        .map(String),
    ],
    [rooms],
  );

  // ── Apply all filters together (before grouping) ──
  const filtered = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rooms.filter((r) => {
      if (q) {
        const hay = `${r.Nama_Kamar} ${r.Gedung} ${firstName(r.Penghuni_Text) || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fGedung !== SEMUA && r.Gedung !== fGedung) return false;
      if (fLantai !== SEMUA && String(floorForRoom(r)) !== fLantai) return false;
      if (fStatus !== 'Semua' && statusBucket(r) !== fStatus) return false;
      return true;
    });
  }, [rooms, cari, fGedung, fLantai, fStatus]);

  // Group filtered rooms per building, then per floor (ordered).
  const buildings = useMemo(() => {
    const byGedung = new Map<string, RoomStatus[]>();
    filtered.forEach((r) => {
      const g = r.Gedung || 'Tanpa Gedung';
      const list = byGedung.get(g) || [];
      list.push(r);
      byGedung.set(g, list);
    });

    return Array.from(byGedung.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([gedung, list]) => {
        const byFloor = new Map<number, RoomStatus[]>();
        list.forEach((r) => {
          const f = floorForRoom(r);
          const fl = byFloor.get(f) || [];
          fl.push(r);
          byFloor.set(f, fl);
        });
        const floors = Array.from(byFloor.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([lantai, fRooms]) => ({ lantai, rooms: fRooms }));
        return { gedung, floors };
      });
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
        <div className="text-body text-kk-ink">Memuat layout…</div>
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

  const summary: Array<{ key: string; n: number; label: string; status: RoomDisplayStatus }> = [
    { key: 'terisi', n: stats.terisi, label: 'Terisi', status: 'Terisi' },
    { key: 'kosong', n: stats.kosong, label: 'Kosong', status: 'Tersedia' },
    { key: 'perhatian', n: stats.perhatian, label: 'Perhatian', status: 'Perlu Perhatian' },
  ];

  return (
    <>
      <ScreenHead
        title="Layout Properti"
        sub="Peta semua kamar dan kondisinya."
        onHelp={() => setHelpOpen(true)}
      />

      {/* Denah per lantai (sesuai tata letak gedung) */}
      <KkCard className="mb-6 overflow-x-auto">
        <h2 className="font-heading font-bold text-subhead text-kk-navy m-0 mb-4">Denah Properti</h2>
        <BuildingMap2D statusByRoom={statusMap} accent="#0C2C47" />
      </KkCard>

      {/* Ringkasan hunian */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {summary.map((r) => {
          const t = TILE_TINT[r.status];
          return (
            <div
              key={r.key}
              className={`border-2 rounded-kk-card px-2.5 py-4 text-center ${t.bg}`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full ${t.dot}`} />
                <span className={`font-heading font-black text-[28px] leading-none tabular-nums ${t.text}`}>
                  {r.n}
                </span>
              </div>
              <div className="text-body font-semibold text-kk-navy mt-2">{r.label}</div>
            </div>
          );
        })}
      </div>

      {/* Legenda warna — biar gampang dibaca sekilas */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <LegendItem dot="bg-kk-green" label="Terisi" />
        <LegendItem dot="bg-kk-ink" label="Kosong" ring />
        <LegendItem dot="bg-kk-orange" label="Perlu Perhatian" />
      </div>

      <p className="text-body text-kk-ink mt-0 mb-6">
        Tekan satu kamar untuk melihat detail penyewa dan status pembayarannya.
      </p>

      {rooms.length === 0 ? (
        <KkCard tone="mint" className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-white text-kk-navy grid place-items-center mx-auto mb-4">
            <KkIcon name="kamar" size={30} />
          </div>
          <p className="text-body text-kk-navy m-0">
            Belum ada kamar untuk ditampilkan di peta ini.
          </p>
        </KkCard>
      ) : (
        <>
          {/* ── Cari & filter ── */}
          <div className="mb-5 space-y-3">
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama kamar, gedung, atau penghuni…"
              className="kk-input"
            />
            <FilterPills label="Gedung" options={gedungOptions} value={fGedung} onChange={setFGedung} />
            <FilterPills
              label="Lantai"
              options={lantaiOptions}
              value={fLantai}
              onChange={setFLantai}
              render={(o) => (o === SEMUA ? o : `Lantai ${o}`)}
            />
            <FilterPills
              label="Status"
              options={STATUS_FILTERS}
              value={fStatus}
              onChange={(v) => setFStatus(v as StatusFilter)}
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
            <div className="space-y-7">
          {buildings.map((b) => (
            <div key={b.gedung}>
              <div className="flex items-center gap-2.5 mb-3.5">
                <KkIcon name="properti" size={22} strokeWidth={2.2} className="text-kk-navy" />
                <h2 className="font-heading font-bold text-[21px] text-kk-navy m-0">{b.gedung}</h2>
              </div>

              {b.floors.map((f) => (
                <div key={f.lantai} className="mb-4">
                  <div className="text-caption font-semibold text-kk-ink uppercase tracking-wide mb-2.5">
                    Lantai {f.lantai}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {f.rooms.map((room) => (
                      <RoomTile key={room.RoomID} room={room} onClick={() => setSelected(room)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
            </div>
          )}
        </>
      )}

      <RoomDetailSheet room={selected} onClose={() => setSelected(null)} />
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />

      <ScrollFab />
    </>
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

function LegendItem({ dot, label, ring }: { dot: string; label: string; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-caption font-semibold text-kk-navy">
      <span className={`w-3.5 h-3.5 rounded-full ${dot} ${ring ? 'ring-2 ring-kk-mauve' : ''}`} />
      {label}
    </span>
  );
}

function RoomTile({ room, onClick }: { room: RoomStatus; onClick: () => void }) {
  const status = mapRoomStatus(room);
  const t = TILE_TINT[status];
  const nama = firstName(room.Penghuni_Text);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 rounded-kk-card p-4 text-left flex flex-col gap-2 min-h-[96px] cursor-pointer ${t.bg}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading font-black text-[22px] text-kk-navy truncate">
          {room.Nama_Kamar}
        </span>
        <span className={`w-4 h-4 rounded-full flex-shrink-0 ${t.dot}`} />
      </div>
      <div className={`inline-flex items-center gap-1.5 font-heading font-bold text-body ${t.text}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
        {plainLabel(status)}
      </div>
      <div className="text-body text-kk-ink truncate">{nama || 'Siap disewa'}</div>
    </button>
  );
}

function RoomDetailSheet({ room, onClose }: { room: RoomStatus | null; onClose: () => void }) {
  const status = room ? mapRoomStatus(room) : null;
  return (
    <Sheet open={!!room} onClose={onClose}>
      {room && status && (
        <>
          <SheetHead title={room.Nama_Kamar} onClose={onClose}>
            <div className="mt-2">
              <RoomBadge status={status} />
            </div>
          </SheetHead>
          <div className="px-6 pb-7">
            <InfoRow label="Gedung" value={room.Gedung || '—'} />
            <InfoRow label="Status" value={plainLabel(status)} />
            <InfoRow label="Penghuni" value={room.Penghuni_Text || 'Siap disewa'} />
          </div>
        </>
      )}
    </Sheet>
  );
}
