'use client';

// KelolaKos · Kelola Kamar (master-data CRUD) — page-specific UI.
// Detail sheet + add/edit form + delete confirm. CRUD mirrors Booking.
// Reuses the shared KK library; logic/data wiring lives in the page.

import { useEffect, useState } from 'react';
import { Sheet, SheetHead, KkButton, KkCard, InfoRow, RoomBadge } from './ui';
import { MoneyInput } from './money-input';
import { KkIcon } from './icons';
import { DeleteConfirm } from './confirm';
import { mapRoomStatus, rupiah, type RoomDisplayStatus } from './status';
import type { RoomStatus } from '@/lib/api';

// A room enriched with the derived display values the page computes.
export interface KamarView {
  room: RoomStatus;
  harga: number;
  /** Unit label for `harga` (e.g. "bulan", "hari") from the room's primary paket. */
  hargaUnit?: string;
  lantai: number;
}

// ───────────────────────── Form field (big label + example + hint) ─────────────────────────
function KamarField({
  label,
  contoh,
  hint,
  children,
}: {
  label: string;
  contoh?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <label className="block font-heading font-bold text-[19px] text-kk-navy mb-1">{label}</label>
      {contoh && <div className="text-caption text-kk-ink mb-2">{contoh}</div>}
      {children}
      {hint && (
        <div className="flex items-start gap-2 mt-2 text-caption text-kk-ink">
          <KkIcon name="bantuan" size={18} className="flex-shrink-0 mt-0.5" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

const inputClass =
  'w-full font-body font-medium text-[20px] text-kk-navy px-4 py-3.5 border-2 border-kk-mauve rounded-kk-btn bg-white outline-none focus:border-kk-navy';

// ───────────────────────── Detail sheet (Ubah / Hapus) ─────────────────────────
export function KamarDetail({
  view,
  onClose,
  onEdit,
  onDelete,
}: {
  view: KamarView | null;
  onClose: () => void;
  onEdit: (v: KamarView) => void;
  onDelete: (v: KamarView) => void;
}) {
  if (!view) return null;
  const { room, harga, lantai, hargaUnit } = view;
  const status: RoomDisplayStatus = mapRoomStatus(room);
  const occupied = status !== 'Tersedia';
  const penyewa = (room.Penghuni_Text || '').trim();

  return (
    <Sheet open={!!view} onClose={onClose} maxH="84%">
      <div className="px-6 pt-2 pb-7">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-heading font-black text-[27px] text-kk-navy m-0 leading-tight">
              {room.Nama_Kamar}
            </h2>
            <div className="text-body text-kk-ink mt-1">{room.Gedung}</div>
          </div>
          <RoomBadge status={status} />
        </div>

        <KkCard className="mb-5 py-1">
          <InfoRow label="Gedung" value={room.Gedung} />
          <InfoRow label="Lantai" value={`Lantai ${lantai}`} />
          <InfoRow label="Harga sewa" value={harga > 0 ? `${rupiah(harga)} / ${hargaUnit || 'bulan'}` : 'Belum diatur'} />
          <InfoRow label="Penyewa" value={penyewa || 'Belum ada'} />
        </KkCard>

        {occupied && (
          <KkCard tone="mint" className="flex items-start gap-3 mb-4">
            <KkIcon name="info" size={24} className="text-kk-navy flex-shrink-0 mt-0.5" />
            <p className="text-body text-kk-navy m-0 leading-snug">
              Kamar ini sedang terisi. Sebaiknya jangan dihapus selama masih ada penyewa.
            </p>
          </KkCard>
        )}

        <div className="grid grid-cols-2 gap-3">
          <KkButton variant="secondary" block onClick={() => onEdit(view)}>
            <KkIcon name="teks" size={20} strokeWidth={2.2} /> Ubah Kamar
          </KkButton>
          <KkButton
            variant="ghost"
            block
            onClick={() => onDelete(view)}
            className="text-kk-orange border-kk-orange-soft"
          >
            <KkIcon name="hapus" size={20} strokeWidth={2.2} /> Hapus Kamar
          </KkButton>
        </div>
      </div>
    </Sheet>
  );
}

// ───────────────────────── Add / Edit form ─────────────────────────
export interface KamarFormValue {
  nomor: string;
  gedung: string;
  lantai: number;
  harga: number;
}

export function KamarForm({
  open,
  edit,
  initial,
  buildings,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  edit: boolean;
  initial: KamarFormValue | null;
  buildings: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (value: KamarFormValue) => void;
}) {
  const [nomor, setNomor] = useState('');
  const [gedung, setGedung] = useState('');
  const [lantai, setLantai] = useState(1);
  const [harga, setHarga] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setNomor(initial.nomor);
      setGedung(initial.gedung);
      setLantai(initial.lantai || 1);
      setHarga(initial.harga > 0 ? String(initial.harga) : '');
    } else {
      setNomor('');
      setGedung(buildings[0] || '');
      setLantai(1);
      setHarga('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const hargaNum = Number(harga);
  const valid = nomor.trim().length > 0 && !!gedung;

  function simpan() {
    if (!valid || saving) return;
    onSave({ nomor: nomor.trim().toUpperCase(), gedung, lantai: Number(lantai), harga: hargaNum });
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHead title={edit ? 'Ubah Kamar' : 'Tambah Kamar Baru'} onClose={onClose} />
      <div className="px-6 pb-7 pt-2">
        <KamarField label="Nomor Kamar" contoh="Contoh: A7 atau B3" hint="Boleh huruf dan angka, singkat saja.">
          <input
            autoFocus
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            placeholder="Tulis nomor kamar…"
            className={inputClass}
          />
        </KamarField>

        <div className="mb-6">
          <label className="block font-heading font-bold text-[19px] text-kk-navy mb-2">Gedung</label>
          <div className="flex flex-wrap gap-2.5">
            {buildings.map((g) => {
              const active = gedung === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGedung(g)}
                  className={
                    'min-h-[48px] px-5 rounded-xl font-body font-semibold text-[16px] border-2 cursor-pointer ' +
                    (active
                      ? 'bg-kk-navy border-kk-navy text-white'
                      : 'bg-white border-kk-mauve text-kk-navy')
                  }
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <label className="block font-heading font-bold text-[19px] text-kk-navy mb-2">Lantai</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLantai(Math.max(1, lantai - 1))}
              aria-label="Kurangi lantai"
              className="w-[54px] h-[54px] rounded-kk-btn border-2 border-kk-navy bg-white text-kk-navy text-[28px] leading-none grid place-items-center cursor-pointer flex-shrink-0"
            >
              −
            </button>
            <div className="flex-1 text-center font-heading font-black text-[24px] text-kk-navy">
              Lantai {lantai}
            </div>
            <button
              type="button"
              onClick={() => setLantai(Math.min(5, lantai + 1))}
              aria-label="Tambah lantai"
              className="w-[54px] h-[54px] rounded-kk-btn border-2 border-kk-navy bg-white text-kk-navy text-[28px] leading-none grid place-items-center cursor-pointer flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>

        <KamarField
          label="Harga Sewa per Bulan"
          contoh="Contoh: 850.000"
          hint="Titik ribuan otomatis."
        >
          <MoneyInput
            value={harga}
            onChange={(n) => setHarga(n ? String(n) : '')}
            placeholder="850.000"
            className={inputClass}
          />
        </KamarField>

        {hargaNum > 0 && (
          <div className="flex items-center justify-between bg-kk-mint-soft border-2 border-kk-mint rounded-kk-btn px-5 py-3.5 mb-6">
            <span className="font-heading font-bold text-[18px] text-kk-navy">Harga sewa</span>
            <span className="font-heading font-black text-[22px] text-kk-navy">{rupiah(hargaNum)}/bln</span>
          </div>
        )}

        <KkButton
          variant="success"
          size="lg"
          block
          onClick={simpan}
          disabled={!valid || saving}
          className={!valid ? 'opacity-50' : ''}
        >
          <KkIcon name="cek" size={22} strokeWidth={2.4} />{' '}
          {saving ? 'Menyimpan…' : edit ? 'Simpan Perubahan' : 'Simpan Kamar'}
        </KkButton>
      </div>
    </Sheet>
  );
}

// ───────────────────────── Delete confirm ─────────────────────────
export function HapusKamar({
  view,
  loading,
  onClose,
  onConfirm,
}: {
  view: KamarView | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!view) return null;
  const occupied = mapRoomStatus(view.room) !== 'Tersedia';
  const penyewa = (view.room.Penghuni_Text || '').trim();

  return (
    <DeleteConfirm
      open={!!view}
      title={`Hapus ${view.room.Nama_Kamar}?`}
      loading={loading}
      onCancel={onClose}
      onConfirm={onConfirm}
      message={
        occupied ? (
          <>
            Kamar ini sedang ditempati{' '}
            <b className="text-kk-navy">{penyewa || 'seorang penyewa'}</b>. Tenang, data penyewa
            tidak ikut terhapus.
          </>
        ) : (
          <>Tenang, kamar lain tidak terpengaruh. Anda bisa menambah kamar baru kapan saja.</>
        )
      }
    />
  );
}
