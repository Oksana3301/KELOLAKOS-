'use client';

import type { Fasilitas } from '@/lib/api';
import { TH, TH_SERIF } from '@/lib/tophills-theme';
import { isExtraBed, formatRupiah } from '@/lib/booking-pricing';
import { THField } from '@/components/info/booking-shell';

export function FasilitasEstimasi({
  fasilitas, demo, selectedIds, onToggle, extraBedQty, onExtraBed, basePrice, baseLabel,
}: {
  fasilitas: Fasilitas[];
  demo?: boolean;
  selectedIds: string[];
  onToggle: (id: string) => void;
  extraBedQty: number;
  onExtraBed: (qty: number) => void;
  basePrice: number;
  baseLabel: string;
}) {
  const extraBed = fasilitas.find(isExtraBed);
  const addons = fasilitas.filter((f) => !isExtraBed(f));
  const addonTotal =
    selectedIds.reduce((s, id) => {
      const f = fasilitas.find((x) => x.id === id);
      return s + (f ? Number(f.price_adjust) || 0 : 0);
    }, 0) + (extraBed ? extraBedQty * (Number(extraBed.price_adjust) || 0) : 0);
  const total = basePrice + addonTotal;

  return (
    <>
      {addons.length > 0 && (
        <THField label="Fasilitas tambahan (opsional)">
          <div className="space-y-2">
            {addons.map((f) => {
              const on = selectedIds.includes(f.id);
              const price = Number(f.price_adjust) || 0;
              return (
                <button
                  key={f.id}
                  onClick={() => onToggle(f.id)}
                  className="flex items-center justify-between w-full rounded-[12px] px-3.5 py-3 text-left"
                  style={on ? { background: '#FBF3E0', border: `1.5px solid ${TH.gold}` } : { background: '#fff', border: `1.5px solid ${TH.border}` }}
                >
                  <span className="text-[14px] font-semibold" style={{ color: TH.brown }}>{f.emoji} {f.nama}</span>
                  <span className="text-[13px] font-bold" style={{ color: on ? TH.gold : TH.brownSoft }}>
                    {price > 0 ? '+' + formatRupiah(price) : 'Gratis'} {on ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </THField>
      )}

      {extraBed && (
        <THField label={`${extraBed.emoji} Extra bed (${formatRupiah(extraBed.price_adjust)}${extraBed.satuan === 'per_hari' ? '/malam' : ''})`}>
          <div className="flex items-center gap-4">
            <Stepper qty={extraBedQty} onChange={onExtraBed} />
            <span className="text-[13px]" style={{ color: TH.brownSoft }}>{extraBedQty > 0 ? `+${formatRupiah(extraBedQty * (Number(extraBed.price_adjust) || 0))}` : 'Tidak ambil'}</span>
          </div>
        </THField>
      )}

      <div className="rounded-[14px] p-4" style={{ background: TH.cream, border: `1px solid ${TH.border}` }}>
        <div className="flex justify-between text-[13px]" style={{ color: TH.brownSoft }}>
          <span>{baseLabel}</span>
          <span>{basePrice > 0 ? formatRupiah(basePrice) : '—'}</span>
        </div>
        {addonTotal > 0 && (
          <div className="flex justify-between text-[13px] mt-1" style={{ color: TH.brownSoft }}>
            <span>Tambahan</span>
            <span>+{formatRupiah(addonTotal)}</span>
          </div>
        )}
        <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: `1px dashed ${TH.border}` }}>
          <span className="text-[14px] font-bold" style={{ color: TH.brown }}>Estimasi total</span>
          <span className="text-[21px] font-bold" style={{ fontFamily: TH_SERIF, color: TH.gold }}>
            {basePrice > 0 ? formatRupiah(total) : 'Dikonfirmasi admin'}
          </span>
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: TH.brownSoft }}>
          *Estimasi. Total pasti dikonfirmasi admin saat verifikasi.{demo ? ' (fasilitas: data contoh)' : ''}
        </p>
      </div>
    </>
  );
}

function Stepper({ qty, onChange }: { qty: number; onChange: (q: number) => void }) {
  const btn = { width: 40, height: 40, background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown };
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(0, qty - 1))} className="rounded-[10px] text-[20px] font-bold grid place-items-center" style={btn}>−</button>
      <span className="text-[17px] font-bold w-6 text-center" style={{ color: TH.brown }}>{qty}</span>
      <button onClick={() => onChange(Math.min(5, qty + 1))} className="rounded-[10px] text-[20px] font-bold grid place-items-center" style={btn}>+</button>
    </div>
  );
}
