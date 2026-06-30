'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingItem, type BookingFullData, type PaymentRecord } from '@/lib/api';
import { facilityApi, kwitansiApi } from '@/lib/api-v2';
import { ScreenHead, KkButton, KkCard, BayarBadge, StickyCTA } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { DeleteConfirm } from '@/components/kk/confirm';
import { mapPayStatus, rupiah, tglPendek, tglPanjang, type PayStatus } from '@/components/kk/status';
import { BookingFlow, BookingDetail, CancelConfirm, RefundForm, TagihWa, PaymentForm } from '@/components/kk/booking-ui';
import { PendingConfirmations } from '@/components/kk/pending-confirmations';

const HELP = {
  title: 'Booking',
  tips: [
    'Di sini Anda melihat semua penyewa dan mengelola booking mereka.',
    'Tekan tombol oranye "Tambah Penyewa Baru" untuk mencatat penyewa baru — cukup ikuti langkahnya.',
    'Saat memilih kamar, harga mengikuti tipe & gedung kamar itu. Kalau tertulis "harga belum diatur", set dulu di menu Kamar / Pengaturan → Harga.',
    'Untuk penyewa yang baru bayar sebagian (DP), kartunya menampilkan jumlah Dibayar dan Sisa langsung — tidak perlu buka detail.',
    'Tekan satu kartu penyewa untuk melihat rincian, mencatat pembayaran, menagih lewat WhatsApp, mengubah, refund, atau membatalkan booking.',
  ],
};

type TabId = 'semua' | 'Belum Bayar' | 'DP' | 'Lunas' | 'Batal';

const TABS: { id: TabId; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'Belum Bayar', label: 'Belum Bayar' },
  { id: 'DP', label: 'DP' },
  { id: 'Lunas', label: 'Lunas' },
  { id: 'Batal', label: 'Batal' },
];

type LayananId = 'semua' | 'kost' | 'penginapan';
// Tanggal → 'yyyy-mm-dd' (aman untuk berbagai format), '' bila tak valid.
function isoDay(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
// Jumlah bulan dari label paket ("1 Tahun"→12, "6 Bulan"→6, "3 Bulan"→3).
function periodeBulan(s?: string): number {
  const t = String(s || '').toUpperCase();
  if (/TAHUN|SETAHUN/.test(t)) return 12;
  const m = t.match(/(\d+)\s*BULAN/);
  if (m) return Number(m[1]);
  if (/6\s*BULAN|ENAM\s*BULAN/.test(t)) return 6;
  return 0;
}
function addMonthsISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}
// Check-out untuk DITAMPILKAN. Bila tersimpan kosong / ≤ check-in (data lama
// salah), hitung dari check-in + periode paket (khusus kost bulanan/tahunan).
function displayCheckOut(b: BookingItem): string {
  const ci = isoDay(b.CheckIn);
  const co = isoDay(b.CheckOut);
  if (ci && (!co || co <= ci)) {
    const bln = periodeBulan(b.Paket || (b as BookingItem & { Durasi?: string }).Durasi);
    if (bln > 0) return addMonthsISO(ci, bln);
  }
  return b.CheckOut;
}
// Tentukan jenis layanan sebuah booking dari kolom Layanan.
function bookingLayanan(b: BookingItem): 'kost' | 'penginapan' | 'lain' {
  const l = String(b.Layanan || '').toUpperCase();
  if (l.includes('KOS')) return 'kost';
  if (l.includes('INAP') || l.includes('PENGINAP')) return 'penginapan';
  return 'lain';
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingPageInner />
    </Suspense>
  );
}

function BookingPageInner() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabId>('semua');
  const [layanan, setLayanan] = useState<LayananId>('semua');
  const [cari, setCari] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  // Filter rentang tanggal — basis Tgl Masuk (check-in) atau Tgl Bayar.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Add / edit flow
  const [showFlow, setShowFlow] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingFullData | null>(null);
  const [editFacilityIds, setEditFacilityIds] = useState<string[]>([]);

  // Detail sheet + its derived dialogs
  const [detail, setDetail] = useState<BookingFullData | null>(null);
  // BookingID detail yang SEDANG terbuka. Dipakai untuk mengabaikan respons
  // async (getBookingDetail/getBookingRaw) yang datang TERLAMBAT setelah sheet
  // ditutup / pindah booking — supaya sheet TIDAK terbuka lagi sendiri (kesan
  // "kartu muncul 2× dari bawah") dan data tidak tertukar antar-booking.
  const detailIdRef = useRef<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailPayments, setDetailPayments] = useState<PaymentRecord[]>([]);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<BookingFullData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingFullData | null>(null);
  const [refundTarget, setRefundTarget] = useState<BookingFullData | null>(null);
  const [tagihTarget, setTagihTarget] = useState<BookingFullData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingFullData | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  // Active facilities (offered as add-ons during booking).
  const { data: facilities } = useQuery({
    queryKey: ['fasilitas'],
    queryFn: facilityApi.list,
  });

  // Business name for the WhatsApp billing template.
  const { data: bizSettings } = useQuery({
    queryKey: ['kwitansi-settings'],
    queryFn: kwitansiApi.get,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat data: ' + (error as Error).message);
  }, [isError, error]);

  // Auto-open the new-booking flow when navigated with ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditBooking(null);
      setShowFlow(true);
      router.replace('/booking');
    }
  }, [searchParams, router]);

  // Combine all booking lists into one (preserve existing dedupe behavior).
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

  // Deep-link from the Uang menu: ?open=<BookingID> opens that booking's detail.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || !data) return;
    const found = allBookings.find((b) => b.BookingID === openId);
    if (found) openDetail(found);
    router.replace('/booking');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, data, allBookings]);

  // Jumlah booking per jenis layanan (untuk badge di pilihan filter).
  const layananCount = useMemo(() => {
    let kost = 0, penginapan = 0;
    allBookings.forEach((b) => {
      const l = bookingLayanan(b);
      if (l === 'kost') kost++;
      else if (l === 'penginapan') penginapan++;
    });
    return { semua: allBookings.length, kost, penginapan };
  }, [allBookings]);

  const filtered = useMemo(() => {
    let list = allBookings;
    // 1) Filter jenis layanan (kost / penginapan) lebih dulu.
    if (layanan !== 'semua') {
      list = list.filter((b) => bookingLayanan(b) === layanan);
    }
    // 2) Lalu filter status pembayaran.
    if (tab !== 'semua') {
      list = list.filter((b) => mapPayStatus(b) === (tab as PayStatus));
    }
    // 3) Filter RENTANG TANGGAL (berdasarkan tanggal masuk / check-in).
    if (dateFrom || dateTo) {
      list = list.filter((b) => {
        const d = isoDay(b.CheckIn);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }
    // 4) Lalu pencarian.
    if (cari) {
      const q = cari.toLowerCase();
      list = list.filter(
        (b) =>
          b.Nama_Customer.toLowerCase().includes(q) || b.Nama_Kamar.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allBookings, layanan, tab, cari, dateFrom, dateTo]);

  // Ringkasan untuk laporan penjaga (mengikuti filter aktif).
  const summary = useMemo(() => {
    let net = 0, dibayar = 0, sisa = 0;
    filtered.forEach((b) => {
      if (mapPayStatus(b) === 'Batal') return;
      const t = Number(b.Harga_Total_Net) || 0;
      const d = Number(b.Net_Diterima ?? b.Total_Bayar) || 0;
      net += t; dibayar += d;
      sisa += b.Sisa_Bayar != null ? Number(b.Sisa_Bayar) : Math.max(t - d, 0);
    });
    return { count: filtered.length, net, dibayar, sisa };
  }, [filtered]);

  const filterAktif = !!(dateFrom || dateTo || cari || tab !== 'semua' || layanan !== 'semua');

  // Open the detail sheet — fetch full data first so all fields are present.
  function openDetail(b: BookingItem) {
    // Open immediately with the list data so the tap feels instant, then
    // enrich with the full detail (payments + facilities) in the background.
    detailIdRef.current = b.BookingID;
    setDetail(b as BookingFullData);
    setDetailPayments([]);
    setEditFacilityIds([]);
    setLoadingDetail(true);
    refreshDetail(b.BookingID);
  }

  // Tutup sheet detail + tandai tidak ada detail aktif (abaikan respons telat).
  function closeDetail() {
    detailIdRef.current = null;
    setDetail(null);
    setDetailPayments([]);
  }

  // (Re)load the open booking's full detail — used on open and after a payment
  // is deleted, so the sheet reflects the recomputed status/sisa immediately.
  function refreshDetail(bookingId: string) {
    api
      .getBookingDetail(bookingId)
      .then((d) => {
        // Abaikan respons TELAT: sheet sudah ditutup / pindah booking. Jangan
        // pernah membuka sheet lagi sendiri (kesan "kartu muncul 2× dari bawah").
        if (detailIdRef.current !== bookingId) return;
        // MERGE — jangan timpa Bukti_Bayar/Tgl_Pembayaran yang mungkin sudah
        // diisi getBookingRaw (cegah preview "muncul lalu hilang"/race).
        setDetail((prev) => {
          if (!prev || prev.BookingID !== bookingId) return prev;
          return {
            ...d.booking,
            Bukti_Bayar: d.booking.Bukti_Bayar || prev.Bukti_Bayar,
            Tgl_Pembayaran: d.booking.Tgl_Pembayaran || prev.Tgl_Pembayaran,
          };
        });
        setDetailPayments(d.payments || []);
        setEditFacilityIds((d.facilities || []).map((f) => f.id));
      })
      .catch((e) => {
        if (detailIdRef.current === bookingId) toast.error('Gagal memuat detail lengkap: ' + (e as Error).message);
      })
      .finally(() => {
        if (detailIdRef.current === bookingId) setLoadingDetail(false);
      });
    // Ambil baris booking mentah → pastikan Bukti_Bayar & Tgl_Pembayaran terkini
    // ikut tampil (getBookingDetail lama kadang tak mengembalikan kolom ini).
    api
      .getBookingRaw(bookingId)
      .then((raw) => {
        if (!raw || detailIdRef.current !== bookingId) return;
        setDetail((prev) =>
          prev && prev.BookingID === bookingId
            ? { ...prev, Bukti_Bayar: raw.Bukti_Bayar || prev.Bukti_Bayar, Tgl_Pembayaran: raw.Tgl_Pembayaran || prev.Tgl_Pembayaran }
            : prev,
        );
      })
      .catch(() => {});
  }

  async function handleDeletePayment(paymentId: string) {
    if (!detail) return;
    setDeletingPaymentId(paymentId);
    try {
      await api.submitTransactionDelete({ type: 'PAYMENT', id: paymentId });
      toast.success('Pembayaran dihapus. Status booking diperbarui.');
      invalidateAll(detail.BookingID); // daftar booking, kwitansi (initial-data), uang, laporan
      refreshDetail(detail.BookingID); // perbarui sheet detail yang sedang terbuka
    } catch (e) {
      toast.error('Gagal menghapus pembayaran: ' + (e as Error).message);
    } finally {
      setDeletingPaymentId(null);
    }
  }

  function openEdit(b: BookingFullData) {
    detailIdRef.current = null;
    setDetail(null);
    setEditBooking(b);
    setShowFlow(true);
  }

  // ── Mutations ──
  function invalidateAll(id?: string) {
    qc.invalidateQueries({ queryKey: ['initial-data'] });
    if (id) qc.invalidateQueries({ queryKey: ['booking-detail', id] });
    qc.invalidateQueries({ queryKey: ['recent-transactions'] });
    qc.invalidateQueries({ queryKey: ['report-data'] });
  }

  const payMutation = useMutation({
    mutationFn: (v: { b: BookingFullData; nominal: number; jenis: string }) =>
      api.submitPayment({ bookingId: v.b.BookingID, nominal: v.nominal, jenisBayar: v.jenis }),
    onSuccess: (_r, v) => {
      toast.success('✓ Pembayaran tercatat');
      invalidateAll(v.b.BookingID);
      setPayTarget(null);
      // Sheet detail masih terbuka di belakang → segarkan supaya Sisa/Sudah
      // dibayar & Riwayat Pembayaran ikut terupdate (jangan tampil data lama).
      if (detailIdRef.current === v.b.BookingID) refreshDetail(v.b.BookingID);
    },
    onError: (e) => toast.error('Gagal mencatat: ' + (e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (v: { b: BookingFullData; mode: 'hangus' | 'refund' }) => {
      const { b, mode } = v;
      const dibayar = Number(b.Total_Bayar) || 0;
      const existingRefund = Number(b.Refund_Total) || 0;
      const maxRefund = Math.max(0, dibayar - existingRefund);
      if (maxRefund > 0 && mode === 'refund') {
        // Refund penuh → batal + catat refund.
        return api.submitStatusAction({
          bookingId: b.BookingID,
          statusBooking: 'CANCEL_DENGAN_REFUND',
          refundNominal: maxRefund,
          jenisRefund: 'CANCEL_REFUND',
          metodeRefund: 'TUNAI',
          dikembalikanOleh: 'admin',
          alasanRefund: 'Booking dibatalkan',
          tanggalRefund: new Date().toISOString().split('T')[0],
          catatanTambahan: 'Booking dibatalkan — refund penuh',
        });
      }
      if (maxRefund > 0) {
        // DP HANGUS — sudah bayar tapi tidak dikembalikan (sesuai aturan).
        return api.submitStatusAction({
          bookingId: b.BookingID,
          statusBooking: 'CANCEL_DP_HANGUS',
          catatanTambahan: 'Booking dibatalkan — DP hangus (tidak dikembalikan)',
        });
      }
      // Belum bayar apa pun → batal biasa.
      return api.submitStatusAction({
        bookingId: b.BookingID,
        statusBooking: 'CANCEL_TANPA_DP',
        catatanTambahan: 'Booking dibatalkan',
      });
    },
    onSuccess: (_r, v) => {
      toast.success('✓ Booking dibatalkan');
      invalidateAll(v.b.BookingID);
      setCancelTarget(null);
      detailIdRef.current = null;
      setDetail(null);
    },
    onError: (e) => toast.error('Gagal membatalkan: ' + (e as Error).message),
  });

  // Partial refund — booking stays active; backend recomputes net & sisa.
  const refundMutation = useMutation({
    mutationFn: (v: { b: BookingFullData; nominal: number; metode: string; alasan: string }) =>
      api.submitRefund({
        bookingId: v.b.BookingID,
        nominal: v.nominal,
        jenisRefund: 'REFUND_SEBAGIAN',
        metodeRefund: v.metode,
        dikembalikanOleh: 'admin',
        alasanRefund: v.alasan || 'Refund',
        tanggalRefund: new Date().toISOString().split('T')[0],
      }),
    onSuccess: (_r, v) => {
      toast.success('✓ Refund tercatat');
      invalidateAll(v.b.BookingID);
      setRefundTarget(null);
      refreshDetail(v.b.BookingID);
    },
    onError: (e) => toast.error('Gagal refund: ' + (e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (b: BookingFullData) => api.submitBookingDelete(b.BookingID),
    onSuccess: (r, b) => {
      toast.success(r.message || '✓ Booking dihapus');
      invalidateAll(b.BookingID);
      setDeleteTarget(null);
      detailIdRef.current = null;
      setDetail(null);
    },
    onError: (e) => toast.error('Gagal menghapus: ' + (e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
        <div className="text-body text-kk-ink">Memuat data…</div>
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

  return (
    <>
      <ScreenHead
        title="Booking"
        sub={`${allBookings.length} penyewa terdaftar`}
        onHelp={() => setHelpOpen(true)}
      />

      <StickyCTA>
        <KkButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            setEditBooking(null);
            setShowFlow(true);
          }}
        >
          <KkIcon name="tambah" size={24} /> Tambah Penyewa Baru
        </KkButton>
      </StickyCTA>

      {/* Booking dari /info yang butuh konfirmasi */}
      <PendingConfirmations />

      {/* Search */}
      <div className="mb-4">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama penyewa…"
          className="kk-input"
        />
      </div>

      {/* Filter 1: Jenis layanan — Kost vs Penginapan */}
      <div className="text-caption font-semibold text-kk-ink mb-2">Jenis</div>
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-4 -mx-1 px-1">
        {([
          { id: 'semua', label: 'Semua', n: layananCount.semua },
          { id: 'kost', label: '🏠 Kost', n: layananCount.kost },
          { id: 'penginapan', label: '🏨 Penginapan', n: layananCount.penginapan },
        ] as { id: LayananId; label: string; n: number }[]).map((o) => (
          <button
            key={o.id}
            onClick={() => setLayanan(o.id)}
            className={`flex-shrink-0 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[17px] border-2 ${
              layanan === o.id
                ? 'border-kk-navy bg-kk-navy text-white'
                : 'border-kk-mauve bg-white text-kk-navy'
            }`}
          >
            {o.label}
            <span className={`ml-1.5 text-[13px] font-bold ${layanan === o.id ? 'text-white/80' : 'text-kk-ink'}`}>
              {o.n}
            </span>
          </button>
        ))}
      </div>

      {/* Filter 2: Status pembayaran */}
      <div className="text-caption font-semibold text-kk-ink mb-2">Status pembayaran</div>
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-5 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[17px] border-2 ${
              tab === t.id
                ? 'border-kk-navy bg-kk-navy text-white'
                : 'border-kk-mauve bg-white text-kk-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter 3: Rentang tanggal (untuk laporan penjaga) */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-caption font-semibold text-kk-ink">Rentang tanggal</span>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-caption font-semibold text-kk-orange">
            Reset tanggal
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <label className="text-caption font-semibold text-kk-ink">
          Dari
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="kk-input mt-1" />
        </label>
        <label className="text-caption font-semibold text-kk-ink">
          Sampai
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="kk-input mt-1" />
        </label>
      </div>

      {/* Ringkasan laporan (mengikuti filter aktif) */}
      {filterAktif && (
        <KkCard className="mb-4 !bg-kk-navy !border-kk-navy text-white">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-heading font-bold text-[18px]">{summary.count} penyewa</span>
            {(dateFrom || dateTo) && (
              <span className="text-caption text-white/85">
                {dateFrom ? tglPendek(dateFrom) : '…'} – {dateTo ? tglPendek(dateTo) : '…'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[14px]">
            <span>Total: <b className="font-heading">{rupiah(summary.net)}</b></span>
            <span className="text-kk-mint">Dibayar: <b className="font-heading">{rupiah(summary.dibayar)}</b></span>
            <span className="text-kk-orange-soft">Sisa: <b className="font-heading">{rupiah(summary.sisa)}</b></span>
          </div>
        </KkCard>
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <KkCard className="text-center text-body text-kk-ink py-7">
            {cari || tab !== 'semua' || layanan !== 'semua'
              ? 'Tidak ada penyewa di kategori ini.'
              : 'Belum ada booking. Tekan tombol Tambah Penyewa di atas untuk mencatat penyewa pertama Anda.'}
          </KkCard>
        ) : (
          filtered.map((b) => <BookingCard key={b.BookingID} booking={b} onClick={() => openDetail(b)} />)
        )}
      </div>

      {/* ── Modals & sheets ── */}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />

      <BookingFlow
        open={showFlow}
        onClose={() => {
          setShowFlow(false);
          setEditBooking(null);
          setEditFacilityIds([]);
        }}
        rooms={data.roomStatus || []}
        prices={data.prices || []}
        roomPriceRules={data.roomPriceRules || []}
        editBooking={editBooking}
        facilities={facilities || []}
        editFacilityIds={editFacilityIds}
        bookings={allBookings}
      />

      {detail && (
        <BookingDetail
          booking={detail}
          payments={detailPayments}
          loading={loadingDetail}
          deletingPaymentId={deletingPaymentId}
          onClose={closeDetail}
          onPay={() => setPayTarget(detail)}
          onEdit={() => openEdit(detail)}
          onCancel={() => setCancelTarget(detail)}
          onRefund={() => setRefundTarget(detail)}
          onTagih={() => setTagihTarget(detail)}
          onDelete={() => setDeleteTarget(detail)}
          onDeletePayment={handleDeletePayment}
        />
      )}

      {refundTarget && (
        <RefundForm
          booking={refundTarget}
          loading={refundMutation.isPending}
          onClose={() => setRefundTarget(null)}
          onConfirm={(nominal, metode, alasan) =>
            refundMutation.mutate({ b: refundTarget, nominal, metode, alasan })
          }
        />
      )}

      {tagihTarget && (
        <TagihWa
          booking={tagihTarget}
          businessName={bizSettings?.business_name}
          onClose={() => setTagihTarget(null)}
        />
      )}

      {payTarget && (
        <PaymentForm
          booking={payTarget}
          loading={payMutation.isPending}
          onClose={() => setPayTarget(null)}
          onConfirm={(nominal, jenis) => payMutation.mutate({ b: payTarget, nominal, jenis })}
        />
      )}

      {cancelTarget && (
        <CancelConfirm
          booking={cancelTarget}
          loading={cancelMutation.isPending}
          onClose={() => setCancelTarget(null)}
          onConfirm={(mode) => cancelMutation.mutate({ b: cancelTarget, mode })}
        />
      )}

      <DeleteConfirm
        open={!!deleteTarget}
        title={`Hapus data ${deleteTarget?.Nama_Customer || ''}?`}
        message="Tenang, data lain tidak terpengaruh. Booking ini beserta catatan pembayarannya akan dihapus dari daftar."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

// ───────────────────────── Booking card ─────────────────────────
function BookingCard({ booking: b, onClick }: { booking: BookingItem; onClick: () => void }) {
  const status = mapPayStatus(b);
  const batal = status === 'Batal';
  const total = Number(b.Harga_Total_Net) || 0;
  const dibayar = Number(b.Net_Diterima ?? b.Total_Bayar) || 0;
  const sisa = b.Sisa_Bayar != null ? Number(b.Sisa_Bayar) : Math.max(total - dibayar, 0);
  // Show the paid/remaining split whenever money is still owed (DP / belum lunas).
  const showSplit = !batal && sisa > 0;
  return (
    <KkCard onClick={onClick} className={batal ? 'opacity-[0.72]' : ''}>
      <div className="flex justify-between items-start gap-3 mb-2.5">
        <div className="min-w-0">
          <div
            className={`font-heading font-bold text-[20px] text-kk-navy truncate ${
              batal ? 'line-through decoration-kk-ink' : ''
            }`}
          >
            {b.Nama_Customer || '(tanpa nama)'}
          </div>
          <div className="text-[17px] text-kk-ink mt-0.5 truncate">{b.Nama_Kamar}</div>
        </div>
        <BayarBadge status={status} />
      </div>
      {/* Tanggal — pill terang & jelas (lengkap dgn TAHUN) biar mudah dibaca */}
      {(b.CheckIn || b.CheckOut) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-kk-mauve-soft pt-2.5 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-kk-pill px-3 py-1.5 text-[14px] font-bold"
            style={{ background: '#EAF1FB', color: '#1E4E8C', border: '1.5px solid #B9D0EE' }}>
            📅 Masuk: {tglPanjang(b.CheckIn) || '—'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-kk-pill px-3 py-1.5 text-[14px] font-bold"
            style={{ background: '#FBEEE6', color: '#9A4A1E', border: '1.5px solid #F0C9AE' }}>
            🏁 Keluar: {tglPanjang(displayCheckOut(b)) || '—'}
          </span>
        </div>
      )}
      <div className="flex justify-between items-baseline">
        <span className="text-caption text-kk-ink">Total</span>
        <span className="font-heading font-bold text-[19px] text-kk-navy">{rupiah(total)}</span>
      </div>
      {showSplit && (
        <div className="flex justify-between items-baseline gap-2 mt-1.5">
          <span className="text-caption font-semibold text-kk-green">Dibayar {rupiah(dibayar)}</span>
          <span className="text-caption font-semibold text-kk-orange">Sisa {rupiah(sisa)}</span>
        </div>
      )}
      {/* Link bukti (kalau ada) — klik buka Drive, tidak ikut buka detail */}
      {b.Bukti_Bayar && (
        <a
          href={b.Bukti_Bayar}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 mt-2.5 text-caption font-semibold text-kk-navy underline"
        >
          📎 Lihat bukti bayar
        </a>
      )}
      <div className="flex items-center justify-end gap-1 mt-2.5 text-caption font-semibold text-kk-orange">
        Ketuk untuk detail &amp; ubah
        <KkIcon name="chevron" size={16} strokeWidth={2.6} />
      </div>
    </KkCard>
  );
}
