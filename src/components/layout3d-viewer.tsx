'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import type { RoomStatus } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  READY: '#22C55E',
  AKTIF_DP: '#3B82F6',
  AKTIF_LUNAS: '#8B5CF6',
  AKTIF_MULTI: '#EF4444',
  BOOKED_BELUM_BAYAR: '#F59E0B',
  CHECKIN: '#EC4899',
  LEBIH_BAYAR: '#10B981',
  NONAKTIF: '#6B7280',
};

const STATUS_EMOJI: Record<string, string> = {
  READY: '✓',
  AKTIF_DP: '💰',
  AKTIF_LUNAS: '🔒',
  AKTIF_MULTI: '⚠️',
  BOOKED_BELUM_BAYAR: '⏳',
  CHECKIN: '🚪',
  LEBIH_BAYAR: '💎',
  NONAKTIF: '🔧',
};

function statusColor(code: string): string {
  return STATUS_COLORS[code] || '#94A3B8';
}

function statusEmoji(code: string): string {
  return STATUS_EMOJI[code] || '·';
}

// Compute contrast color (white/black) based on background
function contrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#0C0A09' : '#FFFFFF';
}

interface Layout3DViewerProps {
  rooms: RoomStatus[];
  onRoomClick?: (room: RoomStatus) => void;
  selectedRoomId?: string;
}

export function Layout3DViewer({ rooms, onRoomClick, selectedRoomId }: Layout3DViewerProps) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group rooms by gedung
  const grouped = useMemo(() => {
    const map = new Map<string, RoomStatus[]>();
    rooms.forEach((r) => {
      const g = r.Gedung || 'Tanpa Gedung';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rooms]);

  // Scroll selected room into view
  useEffect(() => {
    if (!selectedRoomId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-room-id="${selectedRoomId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [selectedRoomId]);

  if (rooms.length === 0) {
    return (
      <div className="bg-sf2 border border-bd border-dashed rounded-md p-12 text-center" style={{ height: '70vh' }}>
        <div className="text-4xl mb-3">🏗️</div>
        <div className="text-tx3 text-sm">
          Belum ada kamar untuk di-render. Tambah kamar dulu di Setting → Kelola Kamar.
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-gradient-to-br from-slate-50 to-slate-200 border border-bd rounded-md overflow-hidden relative"
      style={{ height: '70vh', minHeight: '500px' }}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-white/95 border border-bd rounded-md shadow-sm p-1">
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          className="w-7 h-7 grid place-items-center hover:bg-sf2 rounded text-tx2 text-base font-bold"
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-7 h-7 grid place-items-center hover:bg-sf2 rounded text-tx3 text-[10px] font-bold"
          aria-label="Reset zoom"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
          className="w-7 h-7 grid place-items-center hover:bg-sf2 rounded text-tx2 text-base font-bold"
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
      </div>

      {/* Scroll container */}
      <div ref={containerRef} className="absolute inset-0 overflow-auto p-5">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease-out',
            display: 'inline-block',
            minWidth: '100%',
          }}
        >
          {grouped.map(([gedungName, gedungRooms]) => {
            // Status breakdown for this gedung
            const statusCounts = new Map<string, number>();
            gedungRooms.forEach((r) => {
              const code = r.Status_Code || 'READY';
              statusCounts.set(code, (statusCounts.get(code) || 0) + 1);
            });

            return (
              <div key={gedungName} className="mb-8">
                {/* Gedung header */}
                <div className="flex items-baseline gap-3 mb-3 px-2">
                  <h3 className="font-bold text-base text-tx">
                    📍 {gedungName}
                  </h3>
                  <span className="text-tx3 text-xs">
                    {gedungRooms.length} kamar
                  </span>
                  <div className="flex gap-1 text-[10px]">
                    {Array.from(statusCounts.entries()).map(([code, count]) => (
                      <span
                        key={code}
                        className="px-1.5 py-0.5 rounded font-semibold tabular-nums"
                        style={{
                          backgroundColor: statusColor(code) + '30',
                          color: statusColor(code),
                        }}
                      >
                        {statusEmoji(code)} {count}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Room grid */}
                <div
                  className="grid gap-2 px-2"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 90px))',
                    justifyContent: 'start',
                  }}
                >
                  {gedungRooms.map((room) => {
                    const color = statusColor(room.Status_Code);
                    const textColor = contrastTextColor(color);
                    const isSelected = room.RoomID === selectedRoomId;
                    return (
                      <button
                        key={room.RoomID}
                        data-room-id={room.RoomID}
                        onClick={() => onRoomClick?.(room)}
                        className="relative rounded-lg border-2 p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ac/40"
                        style={{
                          backgroundColor: color,
                          color: textColor,
                          borderColor: isSelected ? '#0C0A09' : 'transparent',
                          boxShadow: isSelected
                            ? '0 4px 12px rgba(0,0,0,0.25), 0 0 0 2px #0C0A09'
                            : '0 1px 3px rgba(0,0,0,0.1)',
                          aspectRatio: '1 / 1',
                          transform: isSelected ? 'translateY(-2px) scale(1.05)' : 'none',
                        }}
                        title={`${room.Nama_Kamar}\n${room.Status_Label}\n${room.Status_Reason}`}
                      >
                        {/* Status emoji top right */}
                        <span
                          className="absolute top-1 right-1.5 text-[10px] leading-none opacity-80"
                          aria-hidden
                        >
                          {statusEmoji(room.Status_Code)}
                        </span>

                        {/* Room name */}
                        <div className="font-bold text-xs leading-tight mb-1">
                          {room.Nama_Kamar.length > 12
                            ? room.Nama_Kamar.slice(0, 11) + '…'
                            : room.Nama_Kamar}
                        </div>

                        {/* Type */}
                        <div className="text-[9px] opacity-75 leading-tight">
                          {room.Tipe_Kamar}
                        </div>

                        {/* Active count */}
                        {room.Active_Count > 0 && (
                          <div className="absolute bottom-1 left-1.5 text-[9px] font-bold tabular-nums opacity-90">
                            {room.Active_Count}×
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help footer */}
      <div className="absolute bottom-3 left-3 right-16 flex justify-between items-center text-[10px] text-tx3 bg-white/90 backdrop-blur-sm rounded-md px-3 py-1.5 pointer-events-none border border-bd">
        <span>🖱️ Klik kamar untuk detail · Drag scroll untuk lihat semua</span>
        <span className="font-semibold">{rooms.length} kamar total</span>
      </div>
    </div>
  );
}
