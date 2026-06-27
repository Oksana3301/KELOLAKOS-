'use client';

// Denah interaktif Top Hills — filter GLOBAL (layanan kost/penginapan + lantai)
// yang dipakai bersama oleh tampilan 2D & 3D. Filter ditaruh di samping (desktop)
// supaya enak dipakai. Warna status sangat kontras (lihat STATUS_STYLE).

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  FLOORS,
  GEDUNG_LABEL,
  STATUS_STYLE,
  gedungLayanan,
  roomKey,
  type Arrangement,
  type LayananKey,
  type RoomStatus3,
} from '@/lib/building-layout';

// 3D dimuat hanya saat dibutuhkan (WebGL berat) → halaman tetap kenceng.
const Building3D = dynamic(() => import('./building-3d'), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center" style={{ height: 440, color: '#9A8B70', fontSize: 13 }}>
      Memuat tampilan 3D…
    </div>
  ),
});

type LayananFilter = 'semua' | LayananKey;
type LantaiFilter = 'semua' | number;

const LEGEND_ORDER: RoomStatus3[] = ['kosong', 'dp', 'terisi', 'perbaikan'];

function RoomBox({
  nama,
  status,
  onClick,
  wide,
}: {
  nama: string;
  status: RoomStatus3;
  onClick?: () => void;
  wide?: boolean;
}) {
  const c = STATUS_STYLE[status];
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${nama} · ${c.label}`}
      className={
        'rounded-[9px] font-bold leading-tight grid place-items-center text-center transition-transform active:scale-95 ' +
        (wide ? 'text-[12px] px-1' : 'text-[13px]')
      }
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        color: c.text,
        width: wide ? 92 : 46,
        height: wide ? 46 : 36,
      }}
    >
      {nama}
    </button>
  );
}

function Block({
  block,
  st,
  onRoomClick,
}: {
  block: Arrangement;
  st: (nama: string) => RoomStatus3;
  onRoomClick?: (nama: string) => void;
}) {
  const layanan = gedungLayanan(block.gedung);
  const card = 'rounded-[16px] border p-3.5';
  const cardStyle = { borderColor: '#E0CFA8', background: '#FFFDF8' } as const;
  const label = (
    <div className="flex items-center gap-1.5 mb-2.5">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
        style={
          layanan === 'kost'
            ? { background: '#EAF1FB', color: '#1E4E8C', border: '1px solid #B9D0EE' }
            : { background: '#F3EAFB', color: '#6B2FA0', border: '1px solid #D9C2F0' }
        }
      >
        {layanan === 'kost' ? '🏠 Kost' : '🏨 Penginapan'}
      </span>
      <span className="text-[12px] font-bold" style={{ color: '#7A6A4F' }}>
        {GEDUNG_LABEL[block.gedung]}
      </span>
    </div>
  );

  if (block.shape === 'twinCol') {
    const colOf = (list: string[]) => (
      <div className="flex flex-col gap-1.5">
        {list.map((nama, i) => (
          <div key={nama}>
            {i === block.gapAfter ? <div style={{ height: 12 }} /> : null}
            <RoomBox nama={nama} status={st(nama)} onClick={() => onRoomClick?.(nama)} />
          </div>
        ))}
      </div>
    );
    return (
      <div className={card} style={cardStyle}>
        {label}
        <div className="flex justify-center gap-2.5">
          {colOf(block.left)}
          <div className="w-5 self-stretch" />
          {colOf(block.right)}
        </div>
      </div>
    );
  }

  if (block.shape === 'lShape') {
    return (
      <div className={card} style={cardStyle}>
        {label}
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {block.top.map((nama) => (
            <RoomBox key={nama} nama={nama} status={st(nama)} onClick={() => onRoomClick?.(nama)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {block.side.map((nama) => (
            <RoomBox key={nama} nama={nama} status={st(nama)} onClick={() => onRoomClick?.(nama)} />
          ))}
        </div>
      </div>
    );
  }

  // row (penginapan)
  return (
    <div className={card} style={cardStyle}>
      {label}
      <div className="flex flex-wrap gap-2">
        {block.rooms.map((nama) => (
          <RoomBox key={nama} nama={nama} status={st(nama)} onClick={() => onRoomClick?.(nama)} wide />
        ))}
      </div>
    </div>
  );
}

// Satu pill filter (dipakai untuk Layanan & Lantai).
function FilterChip({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[40px] px-3.5 rounded-full font-semibold text-[13.5px] border-2 whitespace-nowrap transition-colors"
      style={
        active
          ? { background: accent, color: '#fff', borderColor: accent }
          : { background: '#fff', color: '#5b4a32', borderColor: '#E0CFA8' }
      }
    >
      {children}
    </button>
  );
}

// Panel filter (layanan + lantai + legenda) — dipakai 2D & 3D. Responsif:
// di samping pada layar lebar, menumpuk di atas pada mobile.
function FilterPanel({
  layanan,
  setLayanan,
  lantai,
  setLantai,
  lantaiOpts,
  accent,
}: {
  layanan: LayananFilter;
  setLayanan: (v: LayananFilter) => void;
  lantai: LantaiFilter;
  setLantai: (v: LantaiFilter) => void;
  lantaiOpts: number[];
  accent: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9A8B70' }}>
          Layanan
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['semua', 'Semua'],
            ['kost', '🏠 Kost'],
            ['penginapan', '🏨 Penginapan'],
          ] as [LayananFilter, string][]).map(([v, l]) => (
            <FilterChip key={v} active={layanan === v} onClick={() => setLayanan(v)} accent={accent}>
              {l}
            </FilterChip>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9A8B70' }}>
          Lantai
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={lantai === 'semua'} onClick={() => setLantai('semua')} accent={accent}>
            Semua
          </FilterChip>
          {lantaiOpts.map((n) => (
            <FilterChip key={n} active={lantai === n} onClick={() => setLantai(n)} accent={accent}>
              Lantai {n}
            </FilterChip>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: '#9A8B70' }}>
          Keterangan warna
        </div>
        <div className="flex flex-col gap-1.5">
          {LEGEND_ORDER.map((s) => (
            <span key={s} className="inline-flex items-center gap-2 text-[12.5px]" style={{ color: '#5b4a32' }}>
              <span
                className="w-3.5 h-3.5 rounded-[4px] flex-shrink-0"
                style={{ background: STATUS_STYLE[s].bg, border: `2px solid ${STATUS_STYLE[s].border}` }}
              />
              {STATUS_STYLE[s].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BuildingViewer({
  statusByRoom,
  onRoomClick,
  accent = '#1F7A4D',
}: {
  statusByRoom: Map<string, RoomStatus3>;
  onRoomClick?: (nama: string) => void;
  accent?: string;
}) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [layanan, setLayanan] = useState<LayananFilter>('semua');
  const [lantai, setLantai] = useState<LantaiFilter>('semua');

  const st = (nama: string): RoomStatus3 => statusByRoom.get(roomKey(nama)) || 'unknown';

  // Lantai yang tersedia untuk layanan terpilih (mis. penginapan hanya lt.2–3).
  const lantaiOpts = useMemo(() => {
    const set = new Set<number>();
    FLOORS.forEach((f) => {
      const ada = f.blocks.some((b) => layanan === 'semua' || gedungLayanan(b.gedung) === layanan);
      if (ada) set.add(f.lantai);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [layanan]);

  // Reset lantai bila pilihan tak lagi valid setelah ganti layanan.
  const effLantai: LantaiFilter = lantai !== 'semua' && !lantaiOpts.includes(lantai) ? 'semua' : lantai;

  // Floor + block yang lolos filter, untuk 2D.
  const visibleFloors = useMemo(() => {
    return FLOORS.filter((f) => effLantai === 'semua' || f.lantai === effLantai)
      .map((f) => ({
        lantai: f.lantai,
        blocks: f.blocks.filter((b) => layanan === 'semua' || gedungLayanan(b.gedung) === layanan),
      }))
      .filter((f) => f.blocks.length > 0);
  }, [layanan, effLantai]);

  return (
    <div>
      {/* Toggle 2D / 3D */}
      <div className="flex justify-center gap-2 mb-4">
        {(['2d', '3d'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="min-h-[42px] px-6 rounded-full font-semibold text-[14px] border-2"
            style={
              m === mode
                ? { background: accent, color: '#fff', borderColor: accent }
                : { background: '#fff', color: '#5b4a32', borderColor: '#E0CFA8' }
            }
          >
            {m === '2d' ? '🗺️ Denah 2D' : '🧊 Lihat 3D'}
          </button>
        ))}
      </div>

      {/* Layout: filter di samping (desktop) / atas (mobile) + denah */}
      <div className="flex flex-col md:flex-row gap-5">
        <aside
          className="md:w-[190px] flex-shrink-0 md:sticky md:top-2 self-start rounded-[16px] p-4"
          style={{ background: '#FBF7EC', border: '1px solid #E8DBBF' }}
        >
          <FilterPanel
            layanan={layanan}
            setLayanan={setLayanan}
            lantai={effLantai}
            setLantai={setLantai}
            lantaiOpts={lantaiOpts}
            accent={accent}
          />
        </aside>

        <div className="flex-1 min-w-0">
          {mode === '2d' ? (
            visibleFloors.length === 0 ? (
              <div className="text-center py-10 text-[13px]" style={{ color: '#9A8B70' }}>
                Tidak ada kamar untuk filter ini.
              </div>
            ) : (
              <div className="space-y-5">
                {visibleFloors.map((f) => (
                  <div key={f.lantai}>
                    <div className="text-[13px] font-bold mb-2.5" style={{ color: '#7A6A4F' }}>
                      Lantai {f.lantai}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {f.blocks.map((b, i) => (
                        <Block key={i} block={b} st={st} onRoomClick={onRoomClick} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <Building3D
              statusByRoom={statusByRoom}
              accent={accent}
              layananFilter={layanan}
              lantaiFilter={effLantai}
            />
          )}
        </div>
      </div>
    </div>
  );
}
