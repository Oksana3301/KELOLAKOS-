'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, type RoomStatus } from '@/lib/api';
import { formatRupiah, getStatusBorderColor, getStatusStyle } from '@/lib/utils';
import { Topbar } from '@/components/topbar';
import { toast } from 'sonner';

export default function KamarPage() {
  const [search, setSearch] = useState('');
  const [gedungFilter, setGedungFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  const rooms = data?.roomStatus || [];

  // Get list of unique gedung
  const gedungList = useMemo(() => {
    const set = new Set(rooms.map((r) => r.Gedung));
    return Array.from(set).sort();
  }, [rooms]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (gedungFilter !== 'all' && r.Gedung !== gedungFilter) return false;
      if (statusFilter !== 'all' && r.Status_Code !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.Nama_Kamar.toLowerCase().includes(q) &&
          !r.RoomID.toLowerCase().includes(q) &&
          !r.Penghuni_Text.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rooms, search, gedungFilter, statusFilter]);

  // Group filtered rooms by gedung
  const roomsByGedung = useMemo(() => {
    const grouped: Record<string, RoomStatus[]> = {};
    filteredRooms.forEach((r) => {
      if (!grouped[r.Gedung]) grouped[r.Gedung] = [];
      grouped[r.Gedung].push(r);
    });
    return grouped;
  }, [filteredRooms]);

  if (isError) {
    toast.error('Gagal load kamar: ' + (error as Error)?.message);
  }

  return (
    <main className="max-w-[1240px] mx-auto p-5">
      <Topbar
        action={
          <Link href="/booking">
            <button className="btn btn-pri">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Booking
            </button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-4 items-end justify-between">
        <div>
          <h1 className="page-title">Kamar</h1>
          <p className="text-tx3 text-[13px] mt-1 font-medium">
            Peta seluruh kamar · klik kamar untuk detail
          </p>
        </div>
      </div>

      {/* View Mode toggle (List | 3D) — preview of multi-view, 3D link goes to /layout3d later */}
      <div className="inline-flex gap-1 p-1 bg-sf2 rounded-md mb-4 w-fit">
        <button className="border-0 bg-sf text-tx px-4 py-2 text-[13px] font-semibold rounded-sm cursor-pointer shadow-xs inline-flex items-center gap-2">
          📋 List View
        </button>
        <Link href="/layout3d">
          <button className="border-0 bg-transparent text-tx3 hover:text-tx hover:bg-white/50 px-4 py-2 text-[13px] font-semibold rounded-sm cursor-pointer inline-flex items-center gap-2 transition-colors">
            🏗️ Layout 3D
          </button>
        </Link>
      </div>

      {/* Toolbar: search + gedung + status filters */}
      <div className="card mb-4 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kamar atau penghuni…"
            className="input pl-9"
          />
        </div>

        <select
          value={gedungFilter}
          onChange={(e) => setGedungFilter(e.target.value)}
          className="input max-w-[180px]"
        >
          <option value="all">Semua Gedung</option>
          {gedungList.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input max-w-[180px]"
        >
          <option value="all">Semua Status</option>
          <option value="READY">🟢 Tersedia</option>
          <option value="AKTIF_LUNAS">🟣 Aktif Lunas</option>
          <option value="AKTIF_DP">🔵 DP/Parsial</option>
          <option value="BELUM_BAYAR">🟡 Belum Bayar</option>
          <option value="LEWAT_CHECKOUT">🔴 Lewat Checkout</option>
        </select>

        <div className="text-tx3 text-xs ml-auto">
          Menampilkan <strong className="text-tx">{filteredRooms.length}</strong> dari{' '}
          {rooms.length} kamar
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-20 text-tx3 text-sm">⏳ Loading data kamar…</div>
      )}

      {!isLoading && filteredRooms.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-tx font-semibold mb-1">Gak ada kamar yang cocok</div>
          <div className="text-tx3 text-xs">Coba ubah filter atau search-nya</div>
        </div>
      )}

      {/* Grouped by gedung */}
      <div className="space-y-5">
        {Object.entries(roomsByGedung).map(([gedung, roomList]) => {
          const totalRooms = roomList.length;
          const readyCount = roomList.filter((r) => r.Status_Code === 'READY').length;
          const occupiedPct = Math.round(((totalRooms - readyCount) / totalRooms) * 100);

          return (
            <div key={gedung}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-bold text-base">{gedung}</h2>
                  <p className="text-tx3 text-xs">
                    {totalRooms} kamar · {totalRooms - readyCount} terisi · {readyCount} tersedia
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-tx3 font-semibold">{occupiedPct}% terisi</div>
                  <div className="w-24 h-1.5 bg-sf2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ac transition-all duration-500"
                      style={{ width: `${occupiedPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {roomList.map((room) => (
                  <RoomCard
                    key={room.RoomID}
                    room={room}
                    onClick={() => setSelectedRoom(room)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer detail */}
      {selectedRoom && (
        <RoomDrawer room={selectedRoom} onClose={() => setSelectedRoom(null)} />
      )}
    </main>
  );
}

function RoomCard({ room, onClick }: { room: RoomStatus; onClick: () => void }) {
  const borderColor = getStatusBorderColor(room.Status_Code);
  const statusStyle = getStatusStyle(room.Status_Code);

  return (
    <button
      onClick={onClick}
      className="text-left bg-sf border border-bd rounded-md p-3 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
      style={{ borderLeftColor: borderColor, borderLeftWidth: '4px' }}
    >
      <div className="flex justify-between items-start gap-2 mb-1.5">
        <div className="font-bold text-sm leading-tight">{room.Nama_Kamar}</div>
        <span className="text-base">{statusStyle.emoji}</span>
      </div>
      <div className="text-tx3 text-[10px] mb-2">
        {room.Layanan_Default} · {room.Tipe_Kamar}
      </div>
      <div className={`badge ${statusStyle.badgeClass} mb-1`}>{statusStyle.label}</div>
      {room.Penghuni_Text && (
        <div className="text-[10px] text-tx2 mt-2 line-clamp-2 leading-snug">
          {room.Penghuni_Text}
        </div>
      )}
    </button>
  );
}

function RoomDrawer({ room, onClose }: { room: RoomStatus; onClose: () => void }) {
  const statusStyle = getStatusStyle(room.Status_Code);

  return (
    <div
      className="fixed inset-0 bg-tx/40 backdrop-blur-sm z-40 flex items-stretch justify-end"
      onClick={onClose}
    >
      <aside
        className="bg-sf w-full max-w-md h-full shadow-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-sf border-b border-bd p-5 z-10">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-tx3 text-[11px] font-semibold uppercase tracking-wider mb-1">
                {room.Gedung}
              </div>
              <h2 className="font-bold text-lg leading-tight">{room.Nama_Kamar}</h2>
              <div className="text-tx3 text-xs mt-0.5">
                {room.RoomID} · {room.Layanan_Default} · {room.Tipe_Kamar}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-tx3 hover:text-tx p-1"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-tx3 mb-2">
              Status Saat Ini
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{statusStyle.emoji}</span>
              <div>
                <div className={`badge ${statusStyle.badgeClass} text-xs`}>{statusStyle.label}</div>
                <div className="text-tx3 text-xs mt-1 leading-snug">{room.Status_Reason}</div>
              </div>
            </div>
          </div>

          {/* Penghuni */}
          {room.Penghuni_Text && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-tx3 mb-2">
                Penghuni Aktif
              </div>
              <div className="bg-sf2 border border-bd rounded-md p-3 text-sm leading-relaxed">
                {room.Penghuni_Text}
              </div>
            </div>
          )}

          {/* Info detail */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-tx3 mb-2">
              Spesifikasi
            </div>
            <div className="space-y-1.5">
              <DRow label="Kapasitas" value={`${room.Kapasitas_Normal} orang`} />
              <DRow label="Master Aktif" value={room.Is_Master_Active === 'YA' ? '✓ Ya' : '✗ Tidak'} />
              <DRow label="Override" value={room.Can_Override === 'YA' ? '✓ Boleh' : '✗ Tidak'} />
              {room.Catatan && <DRow label="Catatan" value={room.Catatan} />}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-bd grid grid-cols-2 gap-2">
            <Link href="/booking" className="w-full">
              <button className="btn btn-pri w-full text-xs">+ Booking baru</button>
            </Link>
            <button
              className="btn btn-sec text-xs"
              onClick={() => toast.info('Edit kamar akan dibuka di /setting (coming soon)')}
            >
              ✏️ Edit kamar
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-tx3">{label}</span>
      <span className="text-tx font-semibold text-right">{value}</span>
    </div>
  );
}
