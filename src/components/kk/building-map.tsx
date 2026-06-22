'use client';

// Denah 2D interaktif Top Hills — floor tabs + kamar berwarna sesuai status.
// Ringan (tanpa library 3D). Dipakai di /info (publik) & menu Layout Properti.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FLOORS, GEDUNG_LABEL, roomKey, type Arrangement, type RoomStatus3 } from '@/lib/building-layout';

// 3D dimuat hanya saat dibutuhkan (WebGL berat) → halaman tetap kenceng.
const Building3D = dynamic(() => import('./building-3d'), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center" style={{ height: 420, color: '#9A8B70', fontSize: 13 }}>
      Memuat tampilan 3D…
    </div>
  ),
});

const SC: Record<RoomStatus3, { bg: string; bd: string; fg: string }> = {
  kosong: { bg: '#EAF5EE', bd: '#9ED9B4', fg: '#15724A' },
  terisi: { bg: '#F0EFEC', bd: '#CFC9BF', fg: '#776E60' },
  perbaikan: { bg: '#FBE7DC', bd: '#E7B79A', fg: '#B85A28' },
  unknown: { bg: '#F6F1E7', bd: '#E3D6BC', fg: '#9A8B70' },
};

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
  const c = SC[status];
  return (
    <button
      type="button"
      onClick={onClick}
      title={nama}
      className={
        'rounded-[9px] border-2 font-semibold leading-tight grid place-items-center text-center transition-transform active:scale-95 ' +
        (wide ? 'text-[12px] px-1' : 'text-[13px]')
      }
      style={{
        background: c.bg,
        borderColor: c.bd,
        color: c.fg,
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
  const card = 'rounded-[16px] border p-3.5';
  const cardStyle = { borderColor: '#E0CFA8', background: '#FFFDF8' } as const;
  const label = (
    <div className="text-[12px] font-bold mb-2.5" style={{ color: '#7A6A4F' }}>
      {GEDUNG_LABEL[block.gedung]}
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

export function BuildingMap2D({
  statusByRoom,
  onRoomClick,
  accent = '#1F7A4D',
}: {
  statusByRoom: Map<string, RoomStatus3>;
  onRoomClick?: (nama: string) => void;
  accent?: string;
}) {
  const [lantai, setLantai] = useState(1);
  const floor = FLOORS.find((f) => f.lantai === lantai) || FLOORS[0];
  const st = (nama: string): RoomStatus3 => statusByRoom.get(roomKey(nama)) || 'unknown';

  return (
    <div>
      {/* Floor tabs */}
      <div className="flex justify-center gap-2 mb-4 flex-wrap">
        {FLOORS.map((f) => {
          const active = f.lantai === lantai;
          return (
            <button
              key={f.lantai}
              type="button"
              onClick={() => setLantai(f.lantai)}
              className="min-h-[42px] px-4 rounded-full font-semibold text-[14px] border-2"
              style={
                active
                  ? { background: accent, color: '#fff', borderColor: accent }
                  : { background: '#fff', color: '#5b4a32', borderColor: '#E0CFA8' }
              }
            >
              Lantai {f.lantai}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center flex-wrap gap-3 mb-4 text-[12px]" style={{ color: '#7A6A4F' }}>
        {(['kosong', 'terisi', 'perbaikan'] as RoomStatus3[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: SC[s].bd, borderColor: SC[s].fg }} />
            <span className="capitalize">{s}</span>
          </span>
        ))}
      </div>

      {/* Blocks for this floor */}
      <div className="flex flex-wrap justify-center gap-4">
        {floor.blocks.map((b, i) => (
          <Block key={i} block={b} st={st} onRoomClick={onRoomClick} />
        ))}
      </div>
    </div>
  );
}

// Pembungkus: tombol 2D / 3D. Default 2D (instan); 3D di-lazy-load saat diklik.
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
  return (
    <div>
      <div className="flex justify-center gap-2 mb-4">
        {(['2d', '3d'] as const).map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="min-h-[40px] px-5 rounded-full font-semibold text-[13px] border-2"
              style={
                active
                  ? { background: accent, color: '#fff', borderColor: accent }
                  : { background: '#fff', color: '#5b4a32', borderColor: '#E0CFA8' }
              }
            >
              {m === '2d' ? 'Denah 2D' : 'Lihat 3D'}
            </button>
          );
        })}
      </div>
      {mode === '2d' ? (
        <BuildingMap2D statusByRoom={statusByRoom} onRoomClick={onRoomClick} accent={accent} />
      ) : (
        <Building3D statusByRoom={statusByRoom} accent={accent} />
      )}
    </div>
  );
}
