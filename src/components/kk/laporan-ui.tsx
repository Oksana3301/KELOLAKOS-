'use client';

// KelolaKos · Laporan-only UI helpers (owned by the Laporan page).
// Ported from design_handoff_kelolakos/app/screens-more.jsx → BreakBar.

import { rupiah } from './status';
import { cn } from '@/lib/utils';

/** A category row with a proportional colored bar (income green / expense orange). */
export function BreakBar({
  label,
  val,
  max,
  color,
}: {
  label: string;
  val: number;
  max: number;
  color: 'green' | 'orange';
}) {
  const pct = max > 0 ? Math.max(4, Math.round((val / max) * 100)) : 0;
  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-baseline gap-2.5 mb-1.5">
        <span className="text-body font-semibold text-kk-navy">{label}</span>
        <span className="font-heading font-bold text-[17px] text-kk-navy whitespace-nowrap tabular-nums">
          {rupiah(val)}
        </span>
      </div>
      <div className="h-3 rounded-kk-pill bg-kk-mauve-soft overflow-hidden">
        <div
          className={cn('h-full rounded-kk-pill', color === 'green' ? 'bg-kk-green' : 'bg-kk-orange')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
