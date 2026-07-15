'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BookingItem, type BookingFullData, type PaymentRecord } from '@/lib/api';
import { invalidateBookingData } from '@/lib/query-sync';
import { bookingToInvoice } from '@/lib/invoice';
import { resolveIdentity, buildInvoiceWaText, invoiceWaUrl } from '@/lib/invoice-wa';
import { facilityApi, kwitansiApi } from '@/lib/api-v2';
import { ScreenHead, KkButton, KkCard, BayarBadge, StickyCTA } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import { DeleteConfirm } from '@/components/kk/confirm';
import { mapPayStatus, rupiah, tglPendek, tglPanjang, type PayStatus } from '@/components/kk/status';
import { BookingFlow, BookingDetail, CancelConfirm, RefundForm, TagihWa, PaymentForm, periodeInfo } from '@/components/kk/booking-ui';
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
// Deteksi tanggal yang tidak logis pada sebuah booking → dipakai untuk menandai
// kartu (outline merah) supaya owner/penjaga gampang menemukan & memperbaiki.
// Aturan: keluar harus SETELAH masuk; booking Lunas harus punya tanggal masuk.
function bookingDateIssue(b: BookingItem): string {
  const status = mapPayStatus(b);
  if (status === 'Batal') return '';
  const ci = isoDay(b.CheckIn);
  const co = isoDay(b.CheckOut);
  const tp = isoDay(b.Tgl_Pembayaran || '');
  if (ci && co && co <= ci) return 'Tanggal keluar ≤ tanggal masuk';
  if (status === 'Lunas' && !ci) return 'Lunas tapi tanggal masuk kosong';
  // Tanggal pembayaran (pelunasan) SETELAH tanggal keluar → tidak logis.
  if (tp && co && tp > co) return 'Tanggal bayar setelah tanggal keluar';
  return '';
}
// Tentukan jenis layanan sebuah booking dari kolom Layanan.
function bookingLayanan(b: BookingItem): 'kost' | 'penginapan' | 'lain' {
  const l = String(b.Layanan || '').toUpperCase();
  if (l.includes('KOS')) return 'kost';
  if (l.includes('INAP') || l.includes('PENGINAP')) return 'penginapan';
  return 'lain';
}
// Emote per jenis layanan (dipakai di kartu biar enak dilihat & gampang dibedakan).
function bookingEmote(b: BookingItem): string {
  const l = bookingLayanan(b);
  return l === 'kost' ? '🏠' : l === 'penginapan' ? '🏨' : '📁';
}
// Tanggal acuan untuk filter rentang & tampilan: tanggal masuk (check-in) kalau ada;
// kalau belum di-set (mis. DP) → pakai tanggal pembayaran/DP tercatat ("tanggal keisi").
function bookingRangeDate(b: BookingItem): string {
  return isoDay(b.CheckIn) || isoDay(b.Tgl_Pembayaran || '');
}
// Kunci urutan "terbaru dibuat paling atas". Created_At → Timestamp → tgl bayar →
// check-in → BookingID (ID berbasis waktu ikut tersortir). Dibandingkan menurun.
function bookingCreatedKey(b: BookingItem): string {
  const x = b as BookingItem & { Created_At?: string; Timestamp?: string };
  return String(x.Created_At || x.Timestamp || b.Tgl_Pembayaran || b.CheckIn || b.BookingID || '');
}

// Basis tanggal untuk FILTER rentang — dipilih owner (DP / Lunas / Keluar / Masuk).
type DateBasis = 'masuk' | 'dp' | 'lunas' | 'keluar';
function bookingBasisDate(b: BookingItem, basis: DateBasis): string {
  if (basis === 'keluar') return isoDay(displayCheckOut(b));
  // Tgl_Pembayaran = tanggal pembayaran tercatat saat konfirmasi (proxy tgl DP/lunas).
  if (basis === 'dp') return isoDay(b.Tgl_Pembayaran || '') || isoDay(b.CheckIn);
  if (basis === 'lunas') {
    // KOST lunas → tanggal masuk = tanggal pelunasan (CheckIn sumber kebenaran).
    if (bookingLayanan(b) === 'kost' && mapPayStatus(b) === 'Lunas' && isoDay(b.CheckIn)) return isoDay(b.CheckIn);
    return isoDay(b.Tgl_Pembayaran || '');
  }
  return bookingRangeDate(b); // 'masuk' = tanggal keisi (check-in / DP)
}

// Urutan per-status untuk "nyisir & penagihan":
//  • Lunas / Belum Bayar → tanggal MASUK menaik (rencana masuk paling awal di atas).
//  • DP → tanggal DP menaik (paling LAMA DP di atas → paling perlu ditagih pelunasan).
// Tanggal kosong ditaruh paling bawah (sentinel tinggi).
function bookingSortKey(b: BookingItem, status: PayStatus): string {
  const HI = '9999-12-31';
  if (status === 'DP') return isoDay(b.Tgl_Pembayaran || '') || isoDay(b.CheckIn) || HI;
  if (status === 'Lunas' || status === 'Belum Bayar') return isoDay(b.CheckIn) || bookingRangeDate(b) || HI;
  return HI;
}
// ── Anak baru vs anak lama (cycle pelunasan) ──────────────────────────────
// Identitas customer = nomor WA (dinormalisasi 62xx); fallback nama (lowercase).
// Anak lama = punya booking LUNAS di Top Hills; jumlahnya = berapa kali pelunasan.
// Penting buat aturan perpanjangan: anak lama yang melunasi LEBIH CEPAT dari
// tenggat → tanggal checkout periode barunya tetap dihitung dari checkout
// terakhirnya (bukan dari tanggal pelunasan); anak baru ikut tanggal pelunasan.
function custIdentityKey(b: Pick<BookingItem, 'WhatsApp' | 'Nama_Customer'>): string {
  let wa = String(b.WhatsApp || '').replace(/[^0-9]/g, '');
  if (wa.startsWith('0')) wa = '62' + wa.slice(1);
  if (wa.length >= 9) return 'wa:' + wa;
  const nama = String(b.Nama_Customer || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return nama ? 'nm:' + nama : '';
}

// Hari ini (tanggal kalender) di WIB — dicocokkan ke jam sistem GMT+7,
// bukan timezone perangkat, biar penilaian "lewat tempo" konsisten.
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

// Selisih hari booking thd masa tempo (CheckOut) per hari ini WIB.
// >0 = sudah lewat N hari · 0 = jatuh tempo HARI INI · <0 = belum.
// null = tak relevan (batal/selesai/tanpa tanggal keluar).
function tempoDays(b: BookingItem, today: string): number | null {
  const st = (b.Status_Booking || '').toUpperCase();
  if (st.includes('SELESAI') || st.includes('CANCEL') || st.includes('BATAL')) return null;
  const co = isoDay(b.CheckOut);
  if (!co || !today) return null;
  return Math.round((Date.parse(today) - Date.parse(co)) / 86400000);
}

function sortByStatusRule(list: BookingItem[], status: PayStatus): BookingItem[] {
  if (status === 'Batal') {
    // Batal → paling baru diubah/dibuat di atas (arsip).
    return [...list].sort((a, b) => bookingCreatedKey(b).localeCompare(bookingCreatedKey(a)));
  }
  return [...list].sort((a, b) => {
    const ka = bookingSortKey(a, status), kb = bookingSortKey(b, status);
    if (ka !== kb) return ka.localeCompare(kb); // menaik (paling awal / paling lama DP dulu)
    return bookingCreatedKey(b).localeCompare(bookingCreatedKey(a)); // tie-break: terbaru dulu
  });
}
// Urutan seksi saat tab "Semua" — yang perlu ditagih di atas, arsip di bawah.
const SECTION_ORDER: PayStatus[] = ['DP', 'Belum Bayar', 'Lunas', 'Batal'];

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
  const [periode, setPeriode] = useState<string>('semua');
  const [cari, setCari] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  // Filter rentang tanggal — basis dipilih: Masuk / DP / Lunas / Keluar.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateBasis, setDateBasis] = useState<DateBasis>('masuk');
  // Filter jatuh masa tempo (CheckOut ≤ hari ini WIB, belum ditutup).
  const [fTempo, setFTempo] = useState(false);
  // Tick per menit → penilaian "lewat tempo" ikut jam berjalan (realtime WIB).
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => todayWIB(), [nowTick]);

  // Add / edit flow
  const [showFlow, setShowFlow] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingFullData | null>(null);
  const [editFacilityIds, setEditFacilityIds] = useState<string[]>([]);
  // Fasilitas yang dipilih penyewa pada booking yang sedang dibuka (untuk DITAMPILKAN
  // di detail — owner/penjaga bisa lihat "ada fasilitas apa" tanpa buka form edit).
  const [detailFacilities, setDetailFacilities] = useState<{ id: string; nama: string; emoji: string }[]>([]);

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

  // Ringkasan fasilitas per booking → badge di kartu daftar. Graceful: bila
  // backend (BACKEND_PATCH_BOOKING_FASILITAS_LIST.gs) belum di-deploy, query ini
  // gagal diam-diam dan kartu tetap normal (tanpa badge fasilitas).
  const { data: bookingFas } = useQuery({
    queryKey: ['booking-fasilitas'],
    queryFn: api.getBookingFasilitas,
    retry: false,
    staleTime: 60_000,
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

  // Cycle pelunasan per customer (identitas = WA/nama) — jumlah booking LUNAS.
  // 0 = anak baru (belum pernah pelunasan) · ≥1 = anak lama (Nx pelunasan).
  const lunasCycles = useMemo(() => {
    const m = new Map<string, number>();
    allBookings.forEach((b) => {
      if (mapPayStatus(b) !== 'Lunas') return;
      const k = custIdentityKey(b);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [allBookings]);

  // Jumlah booking yang jatuh/lewat masa tempo (badge di chip filter).
  const tempoCount = useMemo(
    () => allBookings.filter((b) => { const d = tempoDays(b, today); return d != null && d >= 0; }).length,
    [allBookings, today],
  );

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

  // Periode yang benar-benar ADA di data → pilihan filter adaptif (mis. 6 Bulan,
  // 1 Tahun, Belum Tahu, Harian…). "Belum Tahu" ditaruh paling depan biar gampang
  // dipantau owner/penjaga; sisanya urut jumlah terbanyak.
  const periodeOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; n: number; belumTahu: boolean }>();
    allBookings.forEach((b) => {
      const p = periodeInfo(b.Paket);
      if (p.key === 'kosong') return;
      const cur = map.get(p.key);
      if (cur) cur.n++;
      else map.set(p.key, { key: p.key, label: p.label, n: 1, belumTahu: p.belumTahu });
    });
    return Array.from(map.values()).sort(
      (a, b) => (b.belumTahu ? 1 : 0) - (a.belumTahu ? 1 : 0) || b.n - a.n,
    );
  }, [allBookings]);

  const filtered = useMemo(() => {
    let list = allBookings;
    // 1) Filter jenis layanan (kost / penginapan) lebih dulu.
    if (layanan !== 'semua') {
      list = list.filter((b) => bookingLayanan(b) === layanan);
    }
    // 1b) Filter periode (6 bulan / 1 tahun / belum tahu / …).
    if (periode !== 'semua') {
      list = list.filter((b) => periodeInfo(b.Paket).key === periode);
    }
    // 2) Lalu filter status pembayaran.
    if (tab !== 'semua') {
      list = list.filter((b) => mapPayStatus(b) === (tab as PayStatus));
    }
    // 2b) Filter jatuh masa tempo (hari ini WIB atau sudah lewat).
    if (fTempo) {
      list = list.filter((b) => { const d = tempoDays(b, today); return d != null && d >= 0; });
    }
    // 3) Filter RENTANG TANGGAL — basis dipilih owner (Masuk / DP / Lunas / Keluar).
    if (dateFrom || dateTo) {
      list = list.filter((b) => {
        const d = bookingBasisDate(b, dateBasis);
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
    // Urutan final ditentukan per-status saat render (lihat sortByStatusRule).
    return list;
  }, [allBookings, layanan, periode, tab, cari, dateFrom, dateTo, dateBasis, fTempo, today]);

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

  const filterAktif = !!(dateFrom || dateTo || cari || tab !== 'semua' || layanan !== 'semua' || periode !== 'semua');

  // Open the detail sheet — fetch full data first so all fields are present.
  function openDetail(b: BookingItem) {
    // Open immediately with the list data so the tap feels instant, then
    // enrich with the full detail (payments + facilities) in the background.
    detailIdRef.current = b.BookingID;
    setDetail(b as BookingFullData);
    setDetailPayments([]);
    setEditFacilityIds([]);
    setDetailFacilities([]);
    setLoadingDetail(true);
    refreshDetail(b.BookingID);
  }

  // Tutup sheet detail + tandai tidak ada detail aktif (abaikan respons telat).
  function closeDetail() {
    detailIdRef.current = null;
    setDetail(null);
    setDetailPayments([]);
    setDetailFacilities([]);
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
          const db = d.booking as BookingFullData;
          return {
            ...db,
            Bukti_Bayar: db.Bukti_Bayar || prev.Bukti_Bayar,
            Bukti_URLs: db.Bukti_URLs || prev.Bukti_URLs,
            Tgl_Pembayaran: db.Tgl_Pembayaran || prev.Tgl_Pembayaran,
            // PERTAHANKAN kolom penting untuk EDIT (periode/kamar/harga). Kalau
            // getBookingDetail tak mengembalikannya, JANGAN sampai hilang —
            // ambil dari data list (prev), biar prefill Ubah tetap benar
            // (mis. periode "1 Tahun" tidak berubah jadi "6 Bulan" sendiri).
            Paket: db.Paket || prev.Paket,
            Durasi: db.Durasi || prev.Durasi,
            Jumlah_Periode: db.Jumlah_Periode || prev.Jumlah_Periode,
            Jumlah_Orang: db.Jumlah_Orang || prev.Jumlah_Orang,
            Layanan: db.Layanan || prev.Layanan,
            Tipe_Kamar: db.Tipe_Kamar || prev.Tipe_Kamar,
            Nama_Kamar: db.Nama_Kamar || prev.Nama_Kamar,
            Gedung: db.Gedung || prev.Gedung,
            RoomID: db.RoomID || prev.RoomID,
            Harga_Kamar: db.Harga_Kamar || prev.Harga_Kamar,
            // Tanggal & WA: kalau detail tak mengirimnya, JANGAN sampai prefill Ubah
            // mereset tanggal masuk ke hari ini / mengosongkan WA lalu tersimpan.
            CheckIn: db.CheckIn || prev.CheckIn,
            CheckOut: db.CheckOut || prev.CheckOut,
            WhatsApp: db.WhatsApp || prev.WhatsApp,
          };
        });
        setDetailPayments(d.payments || []);
        setEditFacilityIds((d.facilities || []).map((f) => f.id));
        setDetailFacilities((d.facilities || []).map((f) => ({ id: f.id, nama: f.nama, emoji: f.emoji })));
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
            ? {
                ...prev,
                Bukti_Bayar: raw.Bukti_Bayar || prev.Bukti_Bayar,
                Bukti_URLs: raw.Bukti_URLs || prev.Bukti_URLs,
                Tgl_Pembayaran: raw.Tgl_Pembayaran || prev.Tgl_Pembayaran,
                Created_At: raw.Created_At || prev.Created_At,
                Updated_At: raw.Updated_At || prev.Updated_At,
                Timestamp: raw.Timestamp || prev.Timestamp,
                // Jejak notif ke customer → biar badge "sudah dikirim" muncul di detail.
                Notif_Email_At: raw.Notif_Email_At || prev.Notif_Email_At,
                Notif_Email_Info: raw.Notif_Email_Info || prev.Notif_Email_Info,
                Notif_WA_At: raw.Notif_WA_At || prev.Notif_WA_At,
                Notif_WA_Info: raw.Notif_WA_Info || prev.Notif_WA_Info,
              }
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
  // Sinkron ke SEMUA halaman (Beranda/Kamar/Uang/Laporan/Invoice/Layout) tiap ada
  // perubahan booking — lewat helper terpusat.
  function invalidateAll(id?: string) {
    invalidateBookingData(qc, id);
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
      // Auto KUITANSI PELUNASAN ke WhatsApp bila pembayaran ini melunasi.
      const total = Number(v.b.Harga_Total_Net) || 0;
      const prevDibayar = Number(v.b.Net_Diterima ?? v.b.Total_Bayar) || 0;
      const newDibayar = prevDibayar + Number(v.nominal || 0);
      // Kuitansi HANYA bila benar-benar LUNAS (jangan cuma karena jenis 'PELUNASAN'
      // — pelunasan parsial tetap ada sisa → itu invoice, bukan kuitansi).
      if (total > 0 && newDibayar >= total) {
        const inv = bookingToInvoice(
          { ...v.b, Harga_Total_Net: total, Net_Diterima: newDibayar, Sisa_Bayar: Math.max(0, total - newDibayar) },
          undefined,
        );
        const identity = resolveIdentity(bizSettings, inv.layanan || 'penginapan');
        const url = invoiceWaUrl(buildInvoiceWaText(inv, identity), v.b.WhatsApp);
        window.open(url, '_blank', 'noopener');
        toast.success('🧾 Kuitansi pelunasan dibuka di WhatsApp', {
          action: { label: 'Buka WA', onClick: () => window.open(url, '_blank', 'noopener') },
        });
        // Auto email KUITANSI ke customer (bila email tersimpan). Graceful.
        api.sendBookingDoc({ bookingId: v.b.BookingID, kind: 'kwitansi' })
          .then((r) => { if (r?.ok) toast.success('📧 Kuitansi dikirim ke email customer'); })
          .catch(() => { /* backend email belum deploy → lewati */ });
      }
    },
    onError: (e) => toast.error('Gagal mencatat: ' + (e as Error).message),
  });

  // Kirim MANUAL Email + WA ke customer (tombol di detail). Anti-spam: kalau sudah
  // pernah dikirim, backend balas alreadySent → tampilkan toast "kirim ulang?".
  const kirimMutation = useMutation({
    mutationFn: (v: { bookingId: string; force?: boolean }) =>
      api.kirimKeCustomerManual({ bookingId: v.bookingId, force: v.force }),
    onSuccess: (r, v) => {
      if (r.alreadySent) {
        toast('Sudah pernah dikirim ke customer', {
          description: [r.email?.info, r.wa?.info].filter(Boolean).join(' · ') || undefined,
          action: { label: 'Kirim ulang', onClick: () => kirimMutation.mutate({ bookingId: v.bookingId, force: true }) },
        });
        return;
      }
      const okParts: string[] = [];
      if (r.email?.status === 'OK') okParts.push('📧 Email');
      if (r.wa?.status === 'OK') okParts.push('💬 WA');
      const failParts: string[] = [];
      if (r.email?.status === 'GAGAL') failParts.push('Email');
      if (r.wa?.status === 'GAGAL') failParts.push('WA');
      if (okParts.length) toast.success('Terkirim ke customer: ' + okParts.join(' + '));
      if (failParts.length) toast.error('Gagal: ' + failParts.join(' + ') + '. Cek kolom Notif di sheet.');
      if (!okParts.length && !failParts.length) toast.info('Customer tidak punya email/WA — tidak ada yang dikirim.');
      invalidateAll(v.bookingId);
      if (detailIdRef.current === v.bookingId) refreshDetail(v.bookingId);
    },
    onError: (e) => toast.error('Gagal kirim: ' + (e as Error).message),
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

      {/* Filter 1b: Periode (lama sewa) — adaptif sesuai data yang ada */}
      {periodeOptions.length > 1 && (
        <>
          <div className="text-caption font-semibold text-kk-ink mb-2">Periode</div>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-4 -mx-1 px-1">
            {([{ key: 'semua', label: 'Semua', n: allBookings.length, belumTahu: false }, ...periodeOptions]).map((o) => {
              const active = periode === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setPeriode(o.key)}
                  className={`flex-shrink-0 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[17px] border-2 ${
                    active
                      ? o.belumTahu ? 'border-kk-orange bg-kk-orange text-white' : 'border-kk-navy bg-kk-navy text-white'
                      : o.belumTahu ? 'border-kk-orange bg-kk-orange-soft text-kk-navy' : 'border-kk-mauve bg-white text-kk-navy'
                  }`}
                >
                  {o.belumTahu ? '🤔 ' : ''}{o.label}
                  <span className={`ml-1.5 text-[13px] font-bold ${active ? 'text-white/80' : 'text-kk-ink'}`}>
                    {o.n}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

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

      {/* Filter 2b: Jatuh masa tempo — CheckOut ≤ hari ini (WIB), belum ditutup */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-5 -mx-1 px-1">
        <button
          onClick={() => setFTempo((v) => !v)}
          className={`flex-shrink-0 min-h-[48px] px-[18px] rounded-kk-pill font-body font-semibold text-[17px] border-2 ${
            fTempo
              ? 'border-[#B42318] bg-[#B42318] text-white'
              : tempoCount > 0
                ? 'border-[#F3B4B4] bg-[#FDECEC] text-[#B42318]'
                : 'border-kk-mauve bg-white text-kk-navy'
          }`}
        >
          ⏰ Jatuh tempo
          <span className={`ml-1.5 text-[13px] font-bold ${fTempo ? 'text-white/80' : ''}`}>
            {tempoCount}
          </span>
        </button>
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
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <label className="text-caption font-semibold text-kk-ink">
          Dari
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="kk-input mt-1" />
        </label>
        <label className="text-caption font-semibold text-kk-ink">
          Sampai
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="kk-input mt-1" />
        </label>
      </div>
      {/* Basis tanggal rentang — DP / Lunas / Keluar / Masuk */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-caption font-semibold text-kk-ink">Berdasarkan:</span>
        {([
          { id: 'masuk', label: '📅 Masuk' },
          { id: 'dp', label: '💵 DP' },
          { id: 'lunas', label: '✅ Lunas' },
          { id: 'keluar', label: '🚪 Keluar' },
        ] as { id: DateBasis; label: string }[]).map((o) => (
          <button
            key={o.id}
            onClick={() => setDateBasis(o.id)}
            className={`min-h-[38px] px-3.5 rounded-kk-pill font-body font-semibold text-[14px] border-2 ${
              dateBasis === o.id ? 'border-kk-navy bg-kk-navy text-white' : 'border-kk-mauve bg-white text-kk-navy'
            }`}
          >
            {o.label}
          </button>
        ))}
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

      {/* List — grid 2 kolom. Tab "Semua" → dikelompokkan per status (DP, Belum
          Bayar, Lunas, Batal) dengan garis pembatas biar gampang disisir. */}
      {filtered.length === 0 ? (
        <KkCard className="text-center text-body text-kk-ink py-7">
          {cari || tab !== 'semua' || layanan !== 'semua'
            ? 'Tidak ada penyewa di kategori ini.'
            : 'Belum ada booking. Tekan tombol Tambah Penyewa di atas untuk mencatat penyewa pertama Anda.'}
        </KkCard>
      ) : tab === 'semua' ? (
        SECTION_ORDER.map((s) => {
          const items = sortByStatusRule(filtered.filter((b) => mapPayStatus(b) === s), s);
          if (!items.length) return null;
          return (
            <div key={s} className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <BayarBadge status={s} />
                <span className="text-caption font-semibold text-kk-ink">{items.length} penyewa</span>
                <div className="flex-1 h-px bg-kk-mauve" />
              </div>
              <div className="grid grid-cols-2 gap-2.5 items-start">
                {items.map((b) => (
                  <BookingCard key={b.BookingID} booking={b} fas={bookingFas?.[b.BookingID]}
                    cycles={lunasCycles.get(custIdentityKey(b)) || 0} tempoHari={tempoDays(b, today)}
                    onClick={() => openDetail(b)} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="grid grid-cols-2 gap-2.5 items-start">
          {sortByStatusRule(filtered, tab as PayStatus).map((b) => (
            <BookingCard key={b.BookingID} booking={b} fas={bookingFas?.[b.BookingID]}
              cycles={lunasCycles.get(custIdentityKey(b)) || 0} tempoHari={tempoDays(b, today)}
              onClick={() => openDetail(b)} />
          ))}
        </div>
      )}

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
          facilities={detailFacilities}
          loading={loadingDetail}
          deletingPaymentId={deletingPaymentId}
          onClose={closeDetail}
          onPay={() => setPayTarget(detail)}
          onEdit={() => openEdit(detail)}
          onCancel={() => setCancelTarget(detail)}
          onRefund={() => setRefundTarget(detail)}
          onTagih={() => setTagihTarget(detail)}
          onKirimCustomer={() => kirimMutation.mutate({ bookingId: detail.BookingID })}
          kirimLoading={kirimMutation.isPending}
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
function BookingCard({
  booking: b,
  fas,
  cycles = 0,
  tempoHari = null,
  onClick,
}: {
  booking: BookingItem;
  fas?: { count: number; names: string[]; ringkas: string; dateIssue?: string };
  /** Jumlah pelunasan customer ini di Top Hills (0 = anak baru). */
  cycles?: number;
  /** Selisih hari thd masa tempo: >0 lewat, 0 hari ini, null tak relevan. */
  tempoHari?: number | null;
  onClick: () => void;
}) {
  const status = mapPayStatus(b);
  const batal = status === 'Batal';
  const per = periodeInfo(b.Paket);
  const total = Number(b.Harga_Total_Net) || 0;
  const dibayar = Number(b.Net_Diterima ?? b.Total_Bayar) || 0;
  const sisa = b.Sisa_Bayar != null ? Number(b.Sisa_Bayar) : Math.max(total - dibayar, 0);
  // Show the paid/remaining split whenever money is still owed (DP / belum lunas).
  const showSplit = !batal && sisa > 0;
  // Tanggal tidak logis → outline merah + banner supaya gampang ditemukan.
  // Gabung deteksi lokal (dari data list) + flag dari backend (mis. DP > pelunasan,
  // yang butuh data pembayaran → dikirim lewat peta bookingFas).
  const dateIssue = bookingDateIssue(b) || fas?.dateIssue || '';
  const rangeD = bookingRangeDate(b);
  const dateLabel = isoDay(b.CheckIn) ? 'Masuk' : 'DP';
  return (
    <KkCard
      onClick={onClick}
      className={`!p-3 ${batal ? 'opacity-[0.72]' : ''} ${dateIssue ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}
    >
      {dateIssue && (
        <div className="flex items-center gap-1 mb-2 rounded-kk-pill px-2 py-1 text-[11px] font-bold leading-tight"
          style={{ background: '#FDECEC', color: '#B42318', border: '1.5px solid #F3B4B4' }}>
          ⚠️ {dateIssue}
        </div>
      )}
      {/* Nama + emote layanan + status */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex items-center gap-1">
          <span className="text-[16px] leading-none flex-shrink-0">{bookingEmote(b)}</span>
          <span className={`font-heading font-bold text-[15px] text-kk-navy truncate ${batal ? 'line-through decoration-kk-ink' : ''}`}>
            {b.Nama_Customer || '(tanpa nama)'}
          </span>
        </div>
        <BayarBadge status={status} />
      </div>
      <div className="text-[13px] text-kk-ink mt-0.5 truncate">{b.Nama_Kamar}</div>
      {/* Anak baru vs anak lama (cycle pelunasan) + jatuh/lewat masa tempo */}
      {!batal && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-kk-pill px-2 py-0.5 text-[11px] font-bold"
            style={
              cycles > 0
                ? { background: '#FBF1D8', color: '#8A6A1B', border: '1px solid #E8D49A' }
                : { background: '#E6F2EC', color: '#1F6B47', border: '1px solid #BFDCCB' }
            }
            title={
              cycles > 0
                ? `Anak lama — sudah ${cycles}x pelunasan. Perpanjangan: checkout baru dihitung dari checkout terakhir (bukan tanggal pelunasan).`
                : 'Anak baru — belum pernah pelunasan di Top Hills. Checkout mengikuti tanggal pelunasan.'
            }
          >
            {cycles > 0 ? `⭐ Lama · ${cycles}x lunas` : '🌱 Baru'}
          </span>
          {tempoHari != null && tempoHari >= 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-kk-pill px-2 py-0.5 text-[11px] font-bold"
              style={
                tempoHari > 0
                  ? { background: '#FDECEC', color: '#B42318', border: '1px solid #F3B4B4' }
                  : { background: '#FBEEE6', color: '#9A4A1E', border: '1px solid #F0C9AE' }
              }
            >
              ⏰ {tempoHari > 0 ? `Lewat tempo ${tempoHari} hari` : 'Jatuh tempo hari ini'}
            </span>
          )}
        </div>
      )}
      {/* Periode chip */}
      {per.label !== '—' && (
        <span
          className="inline-flex items-center gap-1 rounded-kk-pill px-2 py-0.5 mt-1.5 text-[11px] font-bold"
          style={
            per.belumTahu
              ? { background: '#FBEEE6', color: '#9A4A1E', border: '1px solid #F0C9AE' }
              : { background: '#EEF0F4', color: '#3A4256', border: '1px solid #D6DAE3' }
          }
        >
          {per.belumTahu ? '🤔' : '🗓️'} {per.label}
        </span>
      )}
      {/* Tanggal acuan (masuk / DP) — 1 baris ringkas */}
      {rangeD && (
        <div className="text-[12px] font-semibold mt-1.5" style={{ color: '#1E4E8C' }}>
          📅 {dateLabel}: {tglPendek(rangeD)}
        </div>
      )}
      {/* Fasilitas indikator ringkas */}
      {fas && fas.count > 0 && (
        <div className="text-[11px] text-kk-ink mt-1 truncate">🛋️ {fas.ringkas}</div>
      )}
      {/* Uang */}
      <div className="flex items-baseline justify-between mt-1.5 pt-1.5 border-t border-kk-mauve-soft">
        <span className="text-[11px] text-kk-ink">Total</span>
        <span className="font-heading font-bold text-[15px] text-kk-navy">{rupiah(total)}</span>
      </div>
      {showSplit && (
        <div className="text-[11px] font-semibold text-kk-orange mt-0.5 text-right">Sisa {rupiah(sisa)}</div>
      )}
    </KkCard>
  );
}
