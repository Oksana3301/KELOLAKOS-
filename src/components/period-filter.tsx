'use client';

import { useMemo } from 'react';

export type PeriodPreset =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'last_7'
  | 'last_30'
  | 'last_90'
  | 'custom';

export interface PeriodValue {
  preset: PeriodPreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function resolvePeriod(value: PeriodValue): { start: string; end: string } | null {
  if (value.preset === 'all') return null;

  const today = new Date();

  if (value.preset === 'custom') {
    return {
      start: value.startDate || fmt(today),
      end: value.endDate || fmt(today),
    };
  }

  if (value.preset === 'today') {
    const t = fmt(today);
    return { start: t, end: t };
  }

  if (value.preset === 'this_week') {
    return { start: fmt(startOfWeek(today)), end: fmt(today) };
  }

  if (value.preset === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: fmt(start), end: fmt(today) };
  }

  if (value.preset === 'this_year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: fmt(start), end: fmt(today) };
  }

  // last_N days
  const daysMap: Record<string, number> = { last_7: 7, last_30: 30, last_90: 90 };
  const days = daysMap[value.preset];
  if (days) {
    const start = new Date(today);
    start.setDate(start.getDate() - days + 1);
    return { start: fmt(start), end: fmt(today) };
  }

  return null;
}

const PRESETS: Array<{ key: PeriodPreset; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'this_week', label: 'Minggu Ini' },
  { key: 'this_month', label: 'Bulan Ini' },
  { key: 'this_year', label: 'Tahun Ini' },
  { key: 'last_7', label: '7 Hari' },
  { key: 'last_30', label: '30 Hari' },
  { key: 'last_90', label: '90 Hari' },
  { key: 'custom', label: 'Custom' },
];

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  /** Compact mode: no label */
  compact?: boolean;
  /** Hide "Semua" option */
  hideAll?: boolean;
}

export function PeriodFilter({ value, onChange, compact, hideAll }: PeriodFilterProps) {
  const presets = hideAll ? PRESETS.filter((p) => p.key !== 'all') : PRESETS;

  const resolved = useMemo(() => resolvePeriod(value), [value]);

  function applyPreset(preset: PeriodPreset) {
    if (preset === 'custom') {
      // Keep existing dates or default to last 30 days
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      onChange({
        preset: 'custom',
        startDate: value.startDate || fmt(past),
        endDate: value.endDate || fmt(today),
      });
    } else {
      onChange({ preset });
    }
  }

  function setCustomStart(date: string) {
    onChange({ preset: 'custom', startDate: date, endDate: value.endDate });
  }

  function setCustomEnd(date: string) {
    onChange({ preset: 'custom', startDate: value.startDate, endDate: date });
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-tx3">
          📅 Filter Periode
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={
              value.preset === p.key
                ? 'px-2.5 py-1 rounded-md bg-ac text-inv text-[11px] font-semibold whitespace-nowrap'
                : 'px-2.5 py-1 rounded-md bg-sf2 text-tx2 text-[11px] font-medium hover:bg-bd whitespace-nowrap'
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' && (
        <div className="flex flex-wrap gap-2 items-end pt-1">
          <div>
            <label className="text-[9px] font-semibold text-tx3 mb-0.5 block">Dari</label>
            <input
              type="date"
              value={value.startDate || ''}
              onChange={(e) => setCustomStart(e.target.value)}
              className="input text-xs py-1"
            />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-tx3 mb-0.5 block">Sampai</label>
            <input
              type="date"
              value={value.endDate || ''}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="input text-xs py-1"
            />
          </div>
        </div>
      )}

      {resolved && (
        <div className="text-[10px] text-tx3">
          📍 Periode: <span className="font-semibold tabular-nums">{resolved.start}</span> →{' '}
          <span className="font-semibold tabular-nums">{resolved.end}</span>
        </div>
      )}
    </div>
  );
}
