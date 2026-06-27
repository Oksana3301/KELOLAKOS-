'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type RoomStatus } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, Sheet, SheetHead, InfoRow } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { ScrollFab } from '@/components/kk/scroll-fab';
import { BuildingViewer } from '@/components/kk/building-map';
import { roomKey, statusOnDate, type RoomStatus3 } from '@/lib/building-layout';

const SEMUA = 'Semua';

// Status denah (4) — sama dengan peta 2D/3D: Lunas→terisi, DP→dp, Belum
// Bayar/tanpa booking→kosong, maintenance→perbaikan.
type DenahStat = 'terisi' | 'dp' | 'kosong' | 'perbaikan';

type StatusFilter = 'Semua' | 'Terisi' | 'DP' | 'Kosong' | 'Perbaikan';
const STATUS_FILTERS: StatusFilter[] = ['Semua', 'Terisi', 'DP', 'Kosong', 'Perbaikan'];

const HELP = {
  title: 'Layout Properti',
  tips: [
    'Ini peta semua kamar properti Anda beserta kondisinya saat ini.',
    'Warna kamar: hijau = Terisi (lunas), kuning = DP (dipesan, belum lunas), putih = Kosong (masih tersedia), oranye = Perbaikan.',
    'Kamar yang baru bayar DP belum dihitung terisi — masih "DP" sampai pelunasan.',
    'Tekan satu kamar untuk melihat detail penyewa dan status pembayarannya.',
  ],
};

// Tint per status denah (tiles + ringkasan). 4 warna jelas untuk scan sekilas.
const TILE_TINT: Record<DenahStat, { bg: string; dot: string; text: string; label: string }> = {
  terisi: { bg: 'bg-kk-mint-soft border-kk-green', dot: 'bg-kk-green', text: 'text-kk-green', label: 'Terisi' },
  dp: { bg: 'bg-kk-yellow-soft border-kk-yellow', dot: 'bg-kk-yellow', text: 'text-kk-navy', label: 'DP' },
  kosong: { bg: 'bg-white border-kk-mauve', dot: 'bg-kk-ink', text: 'text-kk-ink', label: 'Kosong' },
  perbaikan: { bg: 'bg-kk-orange-soft border-kk-orange', dot: 'bg-kk-orange', text: 'text-kk-orange', label: 'Perbaikan' },
};

// Status denah → label filter.
function statBucket(s: DenahStat): Exclude<StatusFilter, 'Semua'> {
  return s === 'terisi' ? 'Terisi' : s === 'dp' ? 'DP' : s === 'kosong' ? 'Kosong' : 'Perbaikan';
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
  // Status kamar untuk denah diambil dari getPublicRooms — SUMBER YANG SAMA
  // dengan denah ketersediaan di /info, jadi keduanya dijamin sinkron.
  const { data: publicRooms, dataUpdatedAt, isFetching, refetch: refetchPublic } = useQuery({
    queryKey: ['public-rooms'],
    queryFn: api.getPublicRooms,
    retry: 0,
  });
  // Waktu data terakhir dimuat, format WIB (GMT+7) — jelas untuk semua zona waktu.
  const updatedWIB = useMemo(() => {
    if (!dataUpdatedAt) return '';
    const d = new Date(dataUpdatedAt);
    const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    return `${tgl}, ${jam} WIB (GMT+7)`;
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (isError) toast.error('Gagal memuat data: ' + (error as Error)?.message);
  }, [isError, error]);

  const rooms = useMemo(() => data?.roomStatus || [], [data]);

  // Peta status per kamar dari getPublicRooms (kunci = roomKey nama kamar) —
  // identik dengan /info: Lunas→terisi, DP→dp, Belum Bayar/tanpa→kosong, maintenance→perbaikan.
  const statusByKey = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const m = new Map<string, DenahStat>();
    (Array.isArray(publicRooms) ? publicRooms : []).forEach((r) => {
      // REAL-TIME hari ini: perbaikan tetap; selain itu hitung dari rentang booking
      // pada tanggal hari ini (terisi=lunas, dp=DP, kosong) — sinkron dgn /info.
      const s: DenahStat = r.status === 'perbaikan'
        ? 'perbaikan'
        : Array.isArray(r.bookedRanges)
          ? statusOnDate(r.bookedRanges, todayISO, r.status)
          : (r.status === 'dp' || r.status === 'terisi' ? r.status : 'kosong');
      m.set(roomKey(r.nama), s);
    });
    return m;
  }, [publicRooms]);

  // Status denah satu kamar (sinkron /info) — dipakai denah, tiles, ringkasan, filter.
  const denahOf = useMemo(
    () => (r: RoomStatus): DenahStat => statusByKey.get(roomKey(r.Nama_Kamar)) || 'kosong',
    [statusByKey],
  );

  // Status per kamar untuk Denah (cocokkan via nama kamar).
  const statusMap = useMemo(() => {
    const m = new Map<string, RoomStatus3>();
    rooms.forEach((r) => m.set(roomKey(r.Nama_Kamar), denahOf(r)));
    return m;
  }, [rooms, denahOf]);

  // Ringkasan hunian (4 status denah).
  const stats = useMemo(
    () =>
      rooms.reduce(
        (acc, r) => {
          acc[denahOf(r)]++;
          return acc;
        },
        { terisi: 0, dp: 0, kosong: 0, perbaikan: 0 } as Record<DenahStat, number>,
      ),
    [rooms, denahOf],
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
      if (fStatus !== 'Semua' && statBucket(denahOf(r)) !== fStatus) return false;
      return true;
    });
  }, [rooms, cari, fGedung, fLantai, fStatus, denahOf]);

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

  const summary: Array<{ key: string; n: number; status: DenahStat }> = [
    { key: 'terisi', n: stats.terisi, status: 'terisi' },
    { key: 'dp', n: stats.dp, status: 'dp' },
    { key: 'kosong', n: stats.kosong, status: 'kosong' },
    { key: 'perbaikan', n: stats.perbaikan, status: 'perbaikan' },
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
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <h2 className="font-heading font-bold text-subhead text-kk-navy m-0">Denah Properti</h2>
          <button
            onClick={() => { refetch(); refetchPublic(); }}
            disabled={isFetching}
            className="rounded-full px-3 py-1 text-caption font-semibold border-2 border-kk-mauve text-kk-navy bg-white"
          >
            {isFetching ? 'Memuat…' : '🔄 Perbarui'}
          </button>
        </div>
        {updatedWIB && (
          <p className="text-caption text-kk-ink mt-0 mb-3">
            🕒 Status kamar per <b className="text-kk-navy">{updatedWIB}</b> · sinkron dengan denah di /info
          </p>
        )}
        <BuildingViewer statusByRoom={statusMap} accent="#0C2C47" />
      </KkCard>

      {/* Ringkasan hunian (4 status) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
              <div className="text-body font-semibold text-kk-navy mt-2">{t.label}</div>
            </div>
          );
        })}
      </div>

      {/* Legenda warna — biar gampang dibaca sekilas */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <LegendItem dot="bg-kk-green" label="Terisi (lunas)" />
        <LegendItem dot="bg-kk-yellow" label="DP (dipesan)" />
        <LegendItem dot="bg-kk-ink" label="Kosong" ring />
        <LegendItem dot="bg-kk-orange" label="Perbaikan" />
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
                      <RoomTile key={room.RoomID} room={room} status={denahOf(room)} onClick={() => setSelected(room)} />
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

      <RoomDetailSheet room={selected} status={selected ? denahOf(selected) : null} onClose={() => setSelected(null)} />
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

function RoomTile({ room, status, onClick }: { room: RoomStatus; status: DenahStat; onClick: () => void }) {
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
        {t.label}
      </div>
      <div className="text-body text-kk-ink truncate">
        {status === 'dp' ? (nama ? `${nama} · DP` : 'Dipesan (DP)') : nama || 'Siap disewa'}
      </div>
    </button>
  );
}

function RoomDetailSheet({ room, status, onClose }: { room: RoomStatus | null; status: DenahStat | null; onClose: () => void }) {
  return (
    <Sheet open={!!room} onClose={onClose}>
      {room && status && (
        <>
          <SheetHead title={room.Nama_Kamar} onClose={onClose}>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold border-2 ${TILE_TINT[status].bg} ${TILE_TINT[status].text}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${TILE_TINT[status].dot}`} />
                {TILE_TINT[status].label}
              </span>
            </div>
          </SheetHead>
          <div className="px-6 pb-7">
            <InfoRow label="Gedung" value={room.Gedung || '—'} />
            <InfoRow label="Status" value={TILE_TINT[status].label} />
            {status === 'dp' && (
              <InfoRow label="Catatan" value="Sudah DP, menunggu pelunasan — kamar belum dihitung terisi." />
            )}
            <InfoRow label="Penghuni" value={room.Penghuni_Text || 'Siap disewa'} />
          </div>
        </>
      )}
    </Sheet>
  );
}
