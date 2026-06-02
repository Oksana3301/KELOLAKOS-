'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, type BookingItem, type BookingFullData } from '@/lib/api';
import { formatRupiah, formatDate } from '@/lib/utils';
import { Topbar } from '@/components/topbar';
import { BookingFormModal } from '@/components/booking-form-modal';
import { BookingDetailDrawer } from '@/components/booking-detail-drawer';
import { PeriodFilter, resolvePeriod, type PeriodValue } from '@/components/period-filter';

type TabType = 'all' | 'belum_bayar' | 'aktif_dp' | 'aktif_lunas' | 'ekstra';

export default function BookingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'all' });

  // [B2] State for booking detail drawer
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // [B3] State for edit modal — when set, opens BookingFormModal in 'edit' mode
  const [editingBooking, setEditingBooking] = useState<BookingFullData | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // Combine all booking lists into one
  const allBookings = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const combined: BookingItem[] = [];
    [
      ...(data.paymentBookings || []),
      ...(data.statusActionBookings || []),
      ...(data.closingBookings || []),
      ...(data.feeBookingOptions || []),
    ].forEach((b) => {
      if (!seen.has(b.BookingID)) {
        seen.add(b.BookingID);
        combined.push(b);
      }
    });
    return combined;
  }, [data]);

  // Filter by tab + search
  const filteredBookings = useMemo(() => {
    let list = allBookings;

    if (activeTab === 'belum_bayar') {
      list = list.filter((b) => b.Status_Bayar === 'BELUM_BAYAR' || b.Status_Bayar === 'BELUM BAYAR');
    } else if (activeTab === 'aktif_dp') {
      list = list.filter((b) => b.Status_Bayar === 'DP/PARSIAL');
    } else if (activeTab === 'aktif_lunas') {
      list = list.filter((b) => b.Status_Bayar === 'LUNAS' || b.Status_Bayar === 'LEBIH BAYAR');
    } else if (activeTab === 'ekstra') {
      // Note: legacy bookings don't have ekstra flag in list endpoints; this tab works best after V2 migration
      // Skip for now — empty result
      list = [];
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.Nama_Customer.toLowerCase().includes(q) ||
          b.Nama_Kamar.toLowerCase().includes(q) ||
          b.BookingID.toLowerCase().includes(q),
      );
    }

    // [B7] Period filter — filter by CheckIn date
    const resolvedP = resolvePeriod(period);
    if (resolvedP) {
      const startMs = new Date(resolvedP.start + 'T00:00:00').getTime();
      const endMs = new Date(resolvedP.end + 'T23:59:59').getTime();
      list = list.filter((b) => {
        if (!b.CheckIn) return false;
        const t = new Date(b.CheckIn).getTime();
        return !isNaN(t) && t >= startMs && t <= endMs;
      });
    }

    return list;
  }, [allBookings, activeTab, search, period]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: allBookings.length,
      belum_bayar: allBookings.filter((b) => b.Status_Bayar === 'BELUM BAYAR' || b.Status_Bayar === 'BELUM_BAYAR').length,
      aktif_dp: allBookings.filter((b) => b.Status_Bayar === 'DP/PARSIAL').length,
      aktif_lunas: allBookings.filter((b) => b.Status_Bayar === 'LUNAS' || b.Status_Bayar === 'LEBIH BAYAR').length,
      ekstra: 0, // TODO: implement after backend exposes ekstra flag in list endpoints
    };
  }, [allBookings]);

  // [B3] Handler: drawer "Edit" button → fetch detail then open form modal in edit mode
  async function handleOpenEdit() {
    if (!selectedBookingId) return;
    try {
      const detail = await api.getBookingDetail(selectedBookingId);
      setEditingBooking(detail.booking);
      setSelectedBookingId(null); // close drawer
    } catch (e) {
      console.error('Failed to load booking for edit:', e);
    }
  }

  return (
    <>
      <Topbar />

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <Link href="/" className="text-tx3 text-xs hover:text-ac inline-flex items-center gap-1 mb-1">
              ← Beranda
            </Link>
            <h1 className="font-serif text-3xl tracking-tight">Booking</h1>
            <p className="text-tx3 text-sm mt-1">
              {isLoading ? 'Loading…' : `${allBookings.length} booking aktif`}
            </p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-pri">
            + Booking Baru
          </button>
        </div>

        {/* [B7] Period Filter */}
        <div className="card mb-3 !p-3">
          <PeriodFilter value={period} onChange={setPeriod} compact />
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Cari nama customer, kamar, atau booking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <Tab label="Semua" count={counts.all} active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
          <Tab
            label="Belum Bayar"
            count={counts.belum_bayar}
            active={activeTab === 'belum_bayar'}
            onClick={() => setActiveTab('belum_bayar')}
          />
          <Tab
            label="Aktif DP"
            count={counts.aktif_dp}
            active={activeTab === 'aktif_dp'}
            onClick={() => setActiveTab('aktif_dp')}
          />
          <Tab
            label="Lunas"
            count={counts.aktif_lunas}
            active={activeTab === 'aktif_lunas'}
            onClick={() => setActiveTab('aktif_lunas')}
          />
          <Tab
            label="⭐ Ekstra"
            count={counts.ekstra}
            active={activeTab === 'ekstra'}
            onClick={() => setActiveTab('ekstra')}
          />
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-tx3 text-sm text-center py-8">Loading bookings…</div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-sf2 border border-bd border-dashed rounded-md p-8 text-center text-tx3 text-sm">
              {search ? 'Tidak ada booking yang cocok dengan pencarian' : 'Belum ada booking di kategori ini'}
            </div>
          ) : (
            filteredBookings.map((b) => (
              <BookingRow
                key={b.BookingID}
                booking={b}
                onClick={() => setSelectedBookingId(b.BookingID)}
              />
            ))
          )}
        </div>
      </div>

      {/* [B1] Create Booking Modal */}
      {showCreateModal && data && (
        <BookingFormModal
          mode="create"
          rooms={data.roomStatus || []}
          prices={data.prices || []}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* [B2] Booking Detail Drawer */}
      {selectedBookingId && (
        <BookingDetailDrawer
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onEdit={handleOpenEdit}
        />
      )}

      {/* [B3] Edit Booking Modal */}
      {editingBooking && data && (
        <BookingFormModal
          mode="edit"
          rooms={data.roomStatus || []}
          prices={data.prices || []}
          existingBooking={editingBooking}
          onClose={() => setEditingBooking(null)}
        />
      )}
    </>
  );
}

// ===========================================
// Tab button
// ===========================================
function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-1.5 rounded-md bg-ac text-inv text-xs font-semibold whitespace-nowrap'
          : 'px-3 py-1.5 rounded-md bg-sf2 text-tx2 text-xs font-medium hover:bg-bd whitespace-nowrap'
      }
    >
      {label}
      <span
        className={
          active
            ? 'ml-1.5 bg-inv/20 text-inv px-1.5 py-0.5 rounded text-[10px] tabular-nums'
            : 'ml-1.5 bg-bd text-tx3 px-1.5 py-0.5 rounded text-[10px] tabular-nums'
        }
      >
        {count}
      </span>
    </button>
  );
}

// ===========================================
// Booking Row — clickable to open detail drawer
// ===========================================
function BookingRow({ booking: b, onClick }: { booking: BookingItem; onClick: () => void }) {
  const statusBookingBadge =
    b.Status_Booking === 'SELESAI'
      ? 'badge-green'
      : b.Status_Booking.startsWith('CANCEL')
      ? 'badge-red'
      : 'badge-blue';

  const statusBayarBadge =
    b.Status_Bayar === 'LUNAS'
      ? 'badge-violet'
      : b.Status_Bayar === 'DP/PARSIAL'
      ? 'badge-blue'
      : b.Status_Bayar.startsWith('LEBIH')
      ? 'badge-green'
      : b.Status_Bayar.startsWith('REFUND') || b.Status_Bayar.startsWith('DP HANGUS') || b.Status_Bayar.startsWith('CANCEL')
      ? 'badge-red'
      : 'badge-amber';

  return (
    <button
      onClick={onClick}
      className="w-full bg-sf border border-bd rounded-md p-3 hover:bg-sf2 hover:border-bds transition-colors text-left flex justify-between items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-bold text-sm truncate">{b.Nama_Customer || '(tanpa nama)'}</div>
          <span className={`badge ${statusBookingBadge}`}>{b.Status_Booking}</span>
          <span className={`badge ${statusBayarBadge}`}>{b.Status_Bayar}</span>
        </div>
        <div className="text-tx3 text-xs truncate">
          {b.Nama_Kamar} · {b.Paket} · {formatDate(b.CheckIn)} → {formatDate(b.CheckOut)}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-bold text-sm tabular-nums">{formatRupiah(b.Harga_Total_Net)}</div>
        {b.Sisa_Bayar > 0 ? (
          <div className="text-rd text-[10px] font-semibold tabular-nums">
            Sisa {formatRupiah(b.Sisa_Bayar)}
          </div>
        ) : (
          <div className="text-gr text-[10px] font-semibold">✓ Lunas</div>
        )}
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-tx3 flex-shrink-0"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
