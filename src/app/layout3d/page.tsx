'use client';

import Link from 'next/link';
import { useState, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { api, type RoomStatus } from '@/lib/api';
import { Topbar } from '@/components/topbar';

// Dynamic import: Three.js is heavy, load only when needed (and client-side only)
const Layout3DViewer = dynamic(
  () => import('@/components/layout3d-viewer').then((m) => m.Layout3DViewer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-sf2 rounded-md flex items-center justify-center" style={{ height: '70vh' }}>
        <div className="text-tx3 text-sm">⏳ Loading layout viewer...</div>
      </div>
    ),
  },
);

const STATUS_LEGEND: Array<{ code: string; label: string; color: string }> = [
  { code: 'READY', label: 'Ready / Kosong', color: '#22C55E' },
  { code: 'AKTIF_DP', label: 'DP / Parsial', color: '#3B82F6' },
  { code: 'AKTIF_LUNAS', label: 'Aktif Lunas', color: '#8B5CF6' },
  { code: 'BOOKED_BELUM_BAYAR', label: 'Booked Belum Bayar', color: '#F59E0B' },
  { code: 'CHECKIN', label: 'Check-in', color: '#EC4899' },
  { code: 'NONAKTIF', label: 'Nonaktif / Maintenance', color: '#6B7280' },
  { code: 'LEBIH_BAYAR', label: 'Lebih Bayar', color: '#10B981' },
  { code: 'AKTIF_MULTI', label: 'Aktif Multi-booking', color: '#EF4444' },
];

export default function Layout3DPage() {
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  const rooms = useMemo(() => data?.roomStatus || [], [data]);

  // Compute status stats
  const stats = useMemo(() => {
    const map = new Map<string, number>();
    rooms.forEach((r) => {
      const code = r.Status_Code || 'READY';
      map.set(code, (map.get(code) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rooms]);

  return (
    <>
      <Topbar />

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <Link href="/" className="text-tx3 text-xs hover:text-ac inline-flex items-center gap-1 mb-1">
            ← Beranda
          </Link>
          <h1 className="font-serif text-3xl tracking-tight">Layout Properti</h1>
          <p className="text-tx3 text-sm mt-1">
            Visualisasi top-down semua kamar dengan status real-time. Klik kamar untuk detail.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          {/* LEFT: Layout Viewer */}
          <div>
            {isLoading ? (
              <div className="bg-sf2 rounded-md flex items-center justify-center" style={{ height: '70vh' }}>
                <div className="text-tx3 text-sm">⏳ Loading rooms...</div>
              </div>
            ) : rooms.length === 0 ? (
              <div className="bg-sf2 border border-bd border-dashed rounded-md p-12 text-center">
                <div className="text-4xl mb-3">🏠</div>
                <div className="text-tx3 text-sm">
                  Belum ada kamar. Tambah kamar dulu di Setting → Kelola Kamar.
                </div>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="bg-sf2 rounded-md flex items-center justify-center" style={{ height: '70vh' }}>
                    <div className="text-tx3 text-sm">⏳ Loading...</div>
                  </div>
                }
              >
                <Layout3DViewer
                  rooms={rooms}
                  onRoomClick={setSelectedRoom}
                  selectedRoomId={selectedRoom?.RoomID}
                />
              </Suspense>
            )}
          </div>

          {/* RIGHT: Info panel */}
          <aside className="space-y-3">
            {/* Selected Room */}
            {selectedRoom ? (
              <div className="bg-sf border border-bd rounded-md p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-tx3 text-[10px] uppercase tracking-wider font-bold">
                      Kamar Dipilih
                    </div>
                    <h3 className="font-bold text-base">{selectedRoom.Nama_Kamar}</h3>
                    <div className="text-tx3 text-xs">
                      {selectedRoom.Gedung} · {selectedRoom.Tipe_Kamar}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className="text-tx3 hover:text-tx text-xs"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <Row label="Status" value={selectedRoom.Status_Label} />
                  <Row label="Layanan" value={selectedRoom.Layanan_Default} />
                  <Row label="Kapasitas" value={`${selectedRoom.Kapasitas_Normal} orang`} />
                  {selectedRoom.Active_Count > 0 && (
                    <Row label="Booking Aktif" value={`${selectedRoom.Active_Count}`} accent="text-bl" />
                  )}
                </div>

                {selectedRoom.Penghuni_Text && (
                  <div className="mt-3 pt-3 border-t border-bd">
                    <div className="text-tx3 text-[10px] uppercase tracking-wider font-bold mb-1">
                      Penghuni / Booking
                    </div>
                    <div className="text-[11px] text-tx2 leading-relaxed">
                      {selectedRoom.Penghuni_Text}
                    </div>
                  </div>
                )}

                {selectedRoom.Status_Reason && (
                  <div className="mt-3 pt-3 border-t border-bd">
                    <div className="text-[11px] text-tx3 italic">{selectedRoom.Status_Reason}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-sf2 border border-bd border-dashed rounded-md p-4 text-center text-tx3 text-xs">
                💡 Klik salah satu kamar untuk lihat detail
              </div>
            )}

            {/* Stats */}
            <div className="bg-sf border border-bd rounded-md p-4">
              <div className="text-tx3 text-[10px] uppercase tracking-wider font-bold mb-2">
                Ringkasan Status ({rooms.length} kamar)
              </div>
              <div className="space-y-1.5">
                {stats.map(([code, count]) => {
                  const legend = STATUS_LEGEND.find((l) => l.code === code);
                  return (
                    <div key={code} className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: legend?.color || '#888' }}
                        />
                        <span>{legend?.label || code}</span>
                      </span>
                      <span className="font-bold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-sf border border-bd rounded-md p-4">
              <div className="text-tx3 text-[10px] uppercase tracking-wider font-bold mb-2">
                Legenda Warna
              </div>
              <div className="space-y-1.5">
                {STATUS_LEGEND.map((l) => (
                  <div key={l.code} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: l.color }}
                    />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tip */}
            <div className="bg-blb border border-bl rounded-md p-3 text-[11px] text-bl leading-relaxed">
              💡 Layout di-generate otomatis dari list kamar lo. Kamar di-group per Gedung dan disusun grid.
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-tx3">{label}</span>
      <span className={`font-semibold ${accent || 'text-tx'}`}>{value}</span>
    </div>
  );
}
