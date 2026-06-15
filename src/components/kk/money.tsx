'use client';

// KelolaKos · shared money system (ported from app/money.jsx).
// Period filter + 4 KPI cards + KPI detail dialog. Used on Beranda,
// Keuangan, and Laporan so the look + language stay identical.

import { useState } from 'react';
import { KkIcon } from './icons';
import { KkButton, Dialog, InfoRow } from './ui';
import { rupiah, tglPendek } from './status';
import { resolvePeriod, type PeriodValue } from '@/components/period-filter';
import { cn } from '@/lib/utils';

export type { PeriodValue };
export { resolvePeriod };

const PRESETS: Array<{ key: PeriodValue['preset']; label: string }> = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'this_week', label: 'Minggu Ini' },
  { key: 'this_month', label: 'Bulan Ini' },
  { key: 'this_year', label: 'Tahun Ini' },
];

/** Human label for the current period selection. */
export function periodLabel(v: PeriodValue): string {
  if (v.preset === 'custom') {
    if (v.startDate && v.endDate) return `${tglPendek(v.startDate)} – ${tglPendek(v.endDate)}`;
    return 'Pilih Tanggal';
  }
  return PRESETS.find((p) => p.key === v.preset)?.label || 'Bulan Ini';
}

function pill(active: boolean) {
  return cn(
    'flex-shrink-0 inline-flex items-center gap-2 min-h-kk-touch px-[18px] rounded-kk-pill border-2 font-body font-semibold text-[17px] whitespace-nowrap cursor-pointer',
    active ? 'bg-kk-navy text-white border-kk-navy' : 'bg-white text-kk-navy border-kk-mauve',
  );
}

export function KkPeriodFilter({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}) {
  const isCustom = value.preset === 'custom';
  const [open, setOpen] = useState(false);
  const [dari, setDari] = useState(value.startDate || '');
  const [sampai, setSampai] = useState(value.endDate || '');
  const valid = !!dari && !!sampai && new Date(dari) <= new Date(sampai);

  return (
    <div className="mb-5">
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1">
        {PRESETS.map((o) => (
          <button
            key={o.key}
            onClick={() => {
              setOpen(false);
              onChange({ preset: o.key });
            }}
            className={pill(!isCustom && value.preset === o.key)}
          >
            {o.label}
          </button>
        ))}
        <button onClick={() => setOpen((s) => !s)} className={pill(isCustom)}>
          <KkIcon name="kalender" size={18} />
          {isCustom ? periodLabel(value) : 'Pilih Tanggal'}
        </button>
      </div>

      {open && (
        <div className="mt-3 bg-white border-2 border-kk-mauve rounded-kk-btn p-[18px]">
          <div className="font-heading font-bold text-[18px] mb-3">Pilih rentang tanggal sendiri</div>
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <label className="text-caption font-semibold text-kk-ink">
              Dari tanggal
              <input
                type="date"
                value={dari}
                onChange={(e) => setDari(e.target.value)}
                className="kk-input mt-1.5"
              />
            </label>
            <label className="text-caption font-semibold text-kk-ink">
              Sampai tanggal
              <input
                type="date"
                value={sampai}
                onChange={(e) => setSampai(e.target.value)}
                className="kk-input mt-1.5"
              />
            </label>
          </div>
          <KkButton
            variant="primary"
            block
            disabled={!valid}
            onClick={() => {
              if (valid) {
                onChange({ preset: 'custom', startDate: dari, endDate: sampai });
                setOpen(false);
              }
            }}
          >
            Terapkan Rentang Ini
          </KkButton>
          {!valid && (dari || sampai) && (
            <div className="text-caption text-kk-orange mt-2.5 font-semibold">
              Pastikan tanggal &quot;sampai&quot; tidak lebih awal dari &quot;dari&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── KPI cards ─────────────────────────
export interface MoneyData {
  masuk: number;
  keluar: number;
  /** Cash-on-hand snapshot — does NOT change with the time filter. */
  sisa: number;
  /** Label of the current period, shown in the detail dialog. */
  label: string;
}

type KpiId = 'bersih' | 'masuk' | 'keluar' | 'sisa';

const META: Record<KpiId, { label: string; jelas: string; jenis: 'green' | 'in' | 'out' | 'navy' }> = {
  bersih: { label: 'Pendapatan Bersih', jelas: 'Untung Anda — uang masuk dikurangi uang keluar', jenis: 'green' },
  masuk: { label: 'Uang Masuk', jelas: 'Semua uang yang Anda terima', jenis: 'in' },
  keluar: { label: 'Uang Keluar', jelas: 'Semua uang yang Anda keluarkan', jenis: 'out' },
  sisa: { label: 'Sisa Uang', jelas: 'Uang tunai yang Anda punya sekarang', jenis: 'navy' },
};

function angka(d: MoneyData): Record<KpiId, number> {
  return { bersih: d.masuk - d.keluar, masuk: d.masuk, keluar: d.keluar, sisa: d.sisa };
}

function MoneyKpiCard({ id, nilai, onClick }: { id: KpiId; nilai: number; onClick: () => void }) {
  const m = META[id];
  const feat = m.jenis === 'green' || m.jenis === 'navy';
  const bg = m.jenis === 'green' ? 'bg-kk-green' : m.jenis === 'navy' ? 'bg-kk-navy' : 'bg-white';
  const border = feat ? 'border-transparent' : 'border-kk-mauve';
  const valColor = feat ? 'text-white' : m.jenis === 'in' ? 'text-kk-green' : 'text-kk-orange';
  const subColor = feat ? 'text-white/90' : 'text-kk-ink';
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left cursor-pointer border-2 rounded-kk-card p-[20px_16px_16px] flex flex-col gap-1.5 min-h-[156px]',
        bg,
        border,
      )}
    >
      <div className={cn('font-heading font-bold text-[19px]', feat ? 'text-white' : 'text-kk-navy')}>
        {m.label}
      </div>
      <div className={cn('text-caption leading-snug min-h-[40px]', subColor)}>{m.jelas}</div>
      <div className={cn('font-heading font-black text-[28px] leading-[1.05] mt-auto tracking-tight tabular-nums whitespace-nowrap', valColor)}>
        {rupiah(nilai)}
      </div>
      <div className={cn('flex items-center gap-1 text-caption font-semibold mt-1', subColor)}>
        Lihat rincian <KkIcon name="chevron" size={15} strokeWidth={2.6} />
      </div>
    </button>
  );
}

export function MoneyKpiGrid({ data, onDetail }: { data: MoneyData; onDetail: (id: string) => void }) {
  const a = angka(data);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {(['bersih', 'masuk', 'keluar', 'sisa'] as KpiId[]).map((id) => (
        <MoneyKpiCard key={id} id={id} nilai={a[id]} onClick={() => onDetail(id)} />
      ))}
    </div>
  );
}

const PENJELASAN: Record<KpiId, string> = {
  bersih: 'Inilah keuntungan Anda pada periode ini — uang yang masuk dikurangi semua uang yang keluar.',
  masuk: 'Total semua uang yang Anda terima dari penyewa pada periode ini (pembayaran sewa dan uang muka).',
  keluar: 'Total semua uang yang Anda keluarkan pada periode ini, seperti listrik, gaji penjaga, dan perbaikan.',
  sisa: 'Perkiraan uang tunai yang Anda miliki saat ini. Angka ini tidak ikut berubah saat Anda mengganti filter waktu.',
};

export function MoneyKpiDetail({
  id,
  data,
  breakdown,
  onClose,
}: {
  id: string;
  data: MoneyData;
  /** Optional real category breakdown for masuk/keluar. */
  breakdown?: { masuk?: Array<{ l: string; v: number }>; keluar?: Array<{ l: string; v: number }> };
  onClose: () => void;
}) {
  const kid = id as KpiId;
  const m = META[kid];
  const a = angka(data);
  const nilai = a[kid];
  return (
    <Dialog open>
      <div className="font-body font-semibold text-caption text-kk-ink">{data.label}</div>
      <h3 className="font-heading font-bold text-[25px] mt-0.5 mb-2">{m.label}</h3>
      <div
        className={cn(
          'font-heading font-black text-[36px] tracking-tight mb-3.5',
          m.jenis === 'out' ? 'text-kk-orange' : 'text-kk-green',
        )}
      >
        {rupiah(nilai)}
      </div>
      <p className="text-body text-kk-ink mt-0 mb-4 leading-relaxed">{PENJELASAN[kid]}</p>

      {kid === 'bersih' && (
        <div className="bg-kk-paper border-2 border-kk-mauve-soft rounded-kk-btn px-4 pt-1.5 pb-3.5 mb-4">
          <InfoRow label="Uang masuk" value={`+ ${rupiah(data.masuk)}`} accent="green" />
          <InfoRow label="Uang keluar" value={`− ${rupiah(data.keluar)}`} accent="orange" />
          <div className="flex justify-between items-baseline pt-3">
            <span className="font-heading font-bold text-[19px]">Pendapatan bersih</span>
            <span className="font-heading font-black text-[21px]">{rupiah(nilai)}</span>
          </div>
        </div>
      )}

      {(kid === 'masuk' || kid === 'keluar') && breakdown?.[kid] && breakdown[kid]!.length > 0 && (
        <div className="bg-kk-paper border-2 border-kk-mauve-soft rounded-kk-btn px-4 pt-1.5 pb-2 mb-4">
          {breakdown[kid]!.map((row, i) => (
            <InfoRow key={i} label={row.l} value={rupiah(row.v)} />
          ))}
        </div>
      )}

      <KkButton variant="primary" block onClick={onClose}>
        Mengerti
      </KkButton>
    </Dialog>
  );
}
