'use client';

// Visual 3D gedung Top Hills (WebGL via react-three-fiber).
// Hanya dimuat saat user menekan "Lihat 3D" (lazy) supaya halaman tetap ringan.
// Tiap kamar = balok, warnanya ikut status live. Klik balok → info kamar.

import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import {
  room3DPositions,
  roomKey,
  FLOOR_H,
  ROOM_H,
  GEDUNG_LABEL,
  type RoomStatus3,
  type Room3D,
} from '@/lib/building-layout';

// Warna kotak per status (selaras dengan denah 2D).
const SC3: Record<RoomStatus3, string> = {
  kosong: '#4FB07B',
  dp: '#E3B43C',
  terisi: '#B9B1A2',
  perbaikan: '#E08A4E',
  unknown: '#D8C9A6',
};
const STATUS_LABEL: Record<RoomStatus3, string> = {
  kosong: 'Kosong',
  dp: 'DP (dipesan)',
  terisi: 'Terisi',
  perbaikan: 'Perbaikan',
  unknown: 'Belum ada data',
};

interface Placed extends Room3D {
  status: RoomStatus3;
  y: number;
}

function RoomMesh({
  room,
  selected,
  onSelect,
}: {
  room: Placed;
  selected: boolean;
  onSelect: (r: Placed) => void;
}) {
  const [hover, setHover] = useState(false);
  const color = SC3[room.status];
  return (
    <mesh
      position={[room.cx, room.y, room.cz]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(room);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      scale={selected ? 1.06 : 1}
    >
      <boxGeometry args={[room.w, ROOM_H, room.d]} />
      <meshStandardMaterial
        color={color}
        emissive={selected || hover ? color : '#000000'}
        emissiveIntensity={selected ? 0.45 : hover ? 0.25 : 0}
        roughness={0.7}
        metalness={0.05}
      />
      {selected ? (
        <Html center distanceFactor={10} position={[0, ROOM_H, 0]} zIndexRange={[40, 0]}>
          <div
            style={{
              background: '#1d160c',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: 10,
              fontSize: 12,
              whiteSpace: 'nowrap',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(0,0,0,.3)',
            }}
          >
            {room.nama} · {STATUS_LABEL[room.status]}
          </div>
        </Html>
      ) : null}
    </mesh>
  );
}

function Scene({
  rooms,
  selected,
  onSelect,
}: {
  rooms: Placed[];
  selected: string | null;
  onSelect: (r: Placed) => void;
}) {
  // Pusat scene supaya OrbitControls berputar di tengah gedung.
  const center = useMemo(() => {
    if (!rooms.length) return { x: 0, z: 0, top: FLOOR_H };
    const xs = rooms.map((r) => r.cx);
    const zs = rooms.map((r) => r.cz);
    const maxL = Math.max(...rooms.map((r) => r.lantai));
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      z: (Math.min(...zs) + Math.max(...zs)) / 2,
      top: maxL * FLOOR_H,
    };
  }, [rooms]);

  return (
    <group position={[-center.x, 0, -center.z]}>
      {/* Lantai dasar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.05, center.z]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#efe7d4" />
      </mesh>
      {rooms.map((r) => (
        <RoomMesh
          key={`${r.lantai}-${r.nama}`}
          room={r}
          selected={selected === `${r.lantai}-${r.nama}`}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

export default function Building3D({
  statusByRoom,
  accent = '#A9802F',
}: {
  statusByRoom: Map<string, RoomStatus3>;
  accent?: string;
}) {
  const [selected, setSelected] = useState<Placed | null>(null);

  const rooms = useMemo<Placed[]>(() => {
    return room3DPositions().map((r) => {
      const status = statusByRoom.get(roomKey(r.nama)) || 'unknown';
      const y = (r.lantai - 1) * FLOOR_H + ROOM_H / 2;
      return { ...r, status, y };
    });
  }, [statusByRoom]);

  const selKey = selected ? `${selected.lantai}-${selected.nama}` : null;

  return (
    <div>
      <div
        style={{ height: 420, borderRadius: 16, overflow: 'hidden', border: '1px solid #E0CFA8', background: '#f7f1e3' }}
      >
        <Canvas camera={{ position: [9, 10, 16], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[10, 18, 8]} intensity={1.1} />
          <directionalLight position={[-8, 10, -6]} intensity={0.35} />
          <Scene rooms={rooms} selected={selKey} onSelect={setSelected} />
          <OrbitControls
            enablePan
            minDistance={6}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, FLOOR_H * 1.4, 0]}
          />
        </Canvas>
      </div>

      {/* Legend + petunjuk */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-[12px]" style={{ color: '#7A6A4F' }}>
        {(['kosong', 'dp', 'terisi', 'perbaikan'] as RoomStatus3[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px]" style={{ background: SC3[s] }} />
            <span>{STATUS_LABEL[s]}</span>
          </span>
        ))}
      </div>
      <p className="text-center text-[11px] mt-1.5" style={{ color: '#9A8B70' }}>
        Geser untuk memutar · cubit/scroll untuk zoom · ketuk kamar untuk detail
      </p>

      {selected ? (
        <div
          className="mt-3 mx-auto max-w-sm rounded-[14px] px-4 py-3 text-center"
          style={{ background: '#FFFDF8', border: `1px solid ${accent}33` }}
        >
          <div className="font-bold text-[15px]" style={{ color: accent }}>
            {selected.nama}
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: '#7A6A4F' }}>
            {GEDUNG_LABEL[selected.gedung]} · Lantai {selected.lantai} · {STATUS_LABEL[selected.status]}
          </div>
        </div>
      ) : null}
    </div>
  );
}
