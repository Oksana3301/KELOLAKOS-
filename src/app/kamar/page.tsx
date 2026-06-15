'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type RoomStatus, type SubmitRoomUpsertPayload } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, StickyCTA } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { mapRoomStatus, rupiah } from '@/components/kk/status';
import { HelpSheet } from '@/components/kk/help-sheet';
import {
  KamarDetail,
  KamarForm,
  HapusKamar,
  type KamarView,
  type KamarFormValue,
} from '@/components/kk/kamar-ui';

const HELP = {
  title: 'Kelola Kamar',
  tips: [
    'Di sini Anda menambah, mengubah, atau menghapus kamar di properti Anda.',
    'Tekan tombol oranye "Tambah Kamar Baru" untuk membuat kamar baru.',
    'Tekan satu kartu kamar untuk membuka detailnya, lalu pilih Ubah atau Hapus.',
  ],
};

// Pull the monthly price for a room from the price rules (display only).
function priceForRoom(
  room: RoomStatus,
  rules: { RoomID: string; Harga_Satuan: number }[],
  prices: { Layanan: string; Gedung: string; Tipe_Kamar: string; Paket: string; Harga_Satuan: number }[],
): number {
  const rule = rules.find((r) => r.RoomID === room.RoomID && r.Harga_Satuan > 0);
  if (rule) return rule.Harga_Satuan;
  const match = prices.find(
    (p) =>
      p.Layanan === room.Layanan_Default &&
      p.Gedung === room.Gedung &&
      p.Tipe_Kamar === room.Tipe_Kamar &&
      (p.Paket === 'BULANAN' || p.Paket === '1_BULAN' || true),
  );
  return match?.Harga_Satuan || 0;
}

// Derive a floor number from the room's tipe/catatan ("Lantai 2" → 2).
function floorForRoom(room: RoomStatus): number {
  const src = `${room.Tipe_Kamar} ${room.Catatan}`;
  const m = src.match(/lantai\s*(\d+)/i) || src.match(/\b(\d+)\b/);
  return m ? Number(m[1]) : 1;
}

export default function KamarPage() {
  const qc = useQueryClient();
  const [helpOpen, setHelpOpen] = useState(false);
  const [detail, setDetail] = useState<KamarView | null>(null);
  const [form, setForm] = useState<{ edit: boolean; view: KamarView | null } | null>(null);
  const [hapus, setHapus] = useState<KamarView | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['initial-data'],
    queryFn: api.getInitialData,
  });

  useEffect(() => {
    if (isError) toast.error('Gagal memuat kamar: ' + (error as Error)?.message);
  }, [isError, error]);

  const rooms = useMemo(() => data?.roomStatus || [], [data]);
  const rules = useMemo(() => data?.roomPriceRules || [], [data]);
  const prices = useMemo(() => data?.prices || [], [data]);

  // Build enriched views (room + derived harga + lantai).
  const views: KamarView[] = useMemo(
    () =>
      rooms.map((room) => ({
        room,
        harga: priceForRoom(room, rules, prices),
        lantai: floorForRoom(room),
      })),
    [rooms, rules, prices],
  );

  const buildings = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.Gedung).filter(Boolean))).sort(),
    [rooms],
  );

  const byBuilding = useMemo(() => {
    const grouped: Record<string, KamarView[]> = {};
    views.forEach((v) => {
      (grouped[v.room.Gedung] ||= []).push(v);
    });
    return grouped;
  }, [views]);

  // ── Upsert mutation (real API; payload shape per SubmitRoomUpsertPayload) ──
  const upsert = useMutation({
    mutationFn: (payload: SubmitRoomUpsertPayload) => api.submitRoomUpsert(payload),
    onSuccess: (res, payload) => {
      toast.success(res.message || `✓ ${payload.namaKamar} berhasil disimpan`);
      setForm(null);
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['room-management'] });
    },
    onError: (e) => toast.error('Gagal menyimpan: ' + (e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (roomId: string) => api.submitRoomDelete(roomId),
    onSuccess: (res, _roomId) => {
      toast.success(res.message || 'Kamar telah dihapus');
      setHapus(null);
      setDetail(null);
      qc.invalidateQueries({ queryKey: ['initial-data'] });
      qc.invalidateQueries({ queryKey: ['room-management'] });
    },
    onError: (e) => toast.error('Gagal menghapus: ' + (e as Error).message),
  });

  function handleSave(value: KamarFormValue) {
    const existing = form?.view?.room;
    upsert.mutate({
      roomId: existing?.RoomID,
      namaKamar: value.nomor,
      layananDefault: existing?.Layanan_Default || 'KOS',
      gedung: value.gedung,
      tipeKamar: existing?.Tipe_Kamar || `Lantai ${value.lantai}`,
      kapasitasNormal: existing?.Kapasitas_Normal || 1,
      statusKamar: existing?.Status_Kamar || 'TERSEDIA',
      catatan: existing?.Catatan || `Lantai ${value.lantai}`,
    });
  }

  const formInitial: KamarFormValue | null =
    form?.view != null
      ? {
          nomor: form.view.room.Nama_Kamar,
          gedung: form.view.room.Gedung,
          lantai: form.view.lantai,
          harga: form.view.harga,
        }
      : null;

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
        <div className="text-body text-kk-ink">Memuat data kamar…</div>
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
        title="Kelola Kamar"
        sub={`${rooms.length} kamar di ${buildings.length} gedung`}
        onHelp={() => setHelpOpen(true)}
      />

      <StickyCTA>
        <KkButton variant="primary" size="lg" block onClick={() => setForm({ edit: false, view: null })}>
          <KkIcon name="tambah" size={24} /> Tambah Kamar Baru
        </KkButton>
      </StickyCTA>

      <p className="text-caption text-kk-ink mt-0 mb-6">
        Tekan satu kamar untuk <b className="text-kk-navy">ubah</b> atau{' '}
        <b className="text-kk-navy">hapus</b>.
      </p>

      {rooms.length === 0 ? (
        <KkCard tone="mint" className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-white text-kk-navy grid place-items-center mx-auto mb-4">
            <KkIcon name="kamar" size={30} />
          </div>
          <p className="text-body text-kk-navy m-0">
            Belum ada kamar. Tekan tombol Tambah Kamar Baru di atas untuk memulai.
          </p>
        </KkCard>
      ) : (
        <div className="space-y-6">
          {buildings.map((g) => {
            const list = byBuilding[g] || [];
            return (
              <div key={g}>
                <div className="flex items-center gap-2.5 mb-3">
                  <KkIcon name="properti" size={22} strokeWidth={2.2} className="text-kk-navy" />
                  <h2 className="font-heading font-bold text-[21px] text-kk-navy m-0">{g}</h2>
                  <span className="text-caption font-semibold text-kk-ink">· {list.length} kamar</span>
                </div>

                <div className="space-y-3">
                  {list.map((v) => (
                    <RoomRow key={v.room.RoomID} view={v} onClick={() => setDetail(v)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail → Ubah / Hapus */}
      <KamarDetail
        view={detail}
        onClose={() => setDetail(null)}
        onEdit={(v) => {
          setDetail(null);
          setForm({ edit: true, view: v });
        }}
        onDelete={(v) => setHapus(v)}
      />

      {/* Add / Edit form */}
      <KamarForm
        open={!!form}
        edit={!!form?.edit}
        initial={formInitial}
        buildings={buildings}
        saving={upsert.isPending}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />

      {/* Delete confirm */}
      <HapusKamar
        view={hapus}
        loading={remove.isPending}
        onClose={() => setHapus(null)}
        onConfirm={() => hapus && remove.mutate(hapus.room.RoomID)}
      />

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
    </>
  );
}

function RoomRow({ view, onClick }: { view: KamarView; onClick: () => void }) {
  const { room, harga, lantai } = view;
  const status = mapRoomStatus(room);
  const tint =
    status === 'Terisi'
      ? 'bg-kk-mint-soft border-kk-mint'
      : status === 'Perlu Perhatian'
        ? 'bg-kk-orange-soft border-kk-orange'
        : 'bg-kk-mauve-soft border-kk-mauve';

  return (
    <KkCard onClick={onClick} className="flex items-center gap-3.5 py-4">
      <div
        className={`w-[50px] h-[50px] rounded-[13px] flex-shrink-0 border-2 grid place-items-center text-kk-navy ${tint}`}
      >
        <KkIcon name="kamar" size={24} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-bold text-[19px] text-kk-navy truncate">
          {room.Nama_Kamar}
        </div>
        <div className="text-caption text-kk-ink">
          Lantai {lantai} · {harga > 0 ? `${rupiah(harga)}/bulan` : 'Harga belum diatur'}
        </div>
      </div>
      <KkIcon name="chevron" size={22} strokeWidth={2.4} className="text-kk-mauve flex-shrink-0" />
    </KkCard>
  );
}
