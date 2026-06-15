'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type RoomStatus } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, Sheet, SheetHead, InfoRow, RoomBadge } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { mapRoomStatus, type RoomDisplayStatus } from '@/components/kk/status';
import { HelpSheet } from '@/components/kk/help-sheet';

const HELP = {
  title: 'Layout Properti',
  tips: [
    'Ini peta semua kamar properti Anda beserta kondisinya saat ini.',
    'Warna kamar menunjukkan statusnya: hijau Terisi, mint Kosong, oranye Perlu Perhatian.',
    'Tekan satu kamar untuk melihat detail penyewa dan statusnya.',
  ],
};

// Status tint for the room tiles + summary cards.
const TILE_TINT: Record<RoomDisplayStatus, { bg: string; dot: string }> = {
  Terisi: { bg: 'bg-kk-mint-soft border-kk-green', dot: 'bg-kk-green' },
  Tersedia: { bg: 'bg-kk-mint-soft border-kk-mint', dot: 'bg-kk-mint' },
  'Perlu Perhatian': { bg: 'bg-kk-orange-soft border-kk-orange', dot: 'bg-kk-orange' },
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat data: ' + (error as Error)?.message);
  }, [isError, error]);

  const rooms = useMemo(() => data?.roomStatus || [], [data]);

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

  // Group rooms per building, then per floor (ordered).
  const buildings = useMemo(() => {
    const byGedung = new Map<string, RoomStatus[]>();
    rooms.forEach((r) => {
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
  }, [rooms]);

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
                <span className={`w-3 h-3 rounded-full ${t.dot}`} />
                <span className="font-heading font-black text-[28px] leading-none text-kk-navy tabular-nums">
                  {r.n}
                </span>
              </div>
              <div className="text-body font-semibold text-kk-navy mt-2">{r.label}</div>
            </div>
          );
        })}
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

      <RoomDetailSheet room={selected} onClose={() => setSelected(null)} />
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
    </>
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
        <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${t.dot}`} />
      </div>
      <div className="text-body font-semibold text-kk-navy">{plainLabel(status)}</div>
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
