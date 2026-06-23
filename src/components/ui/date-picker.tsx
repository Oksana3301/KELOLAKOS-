'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/** ISO helper — local date (no timezone shift) → YYYY-MM-DD */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const DOW = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function fmtDisplay(s: string): string {
  const d = parseISO(s);
  if (!d) return '';
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD | ''
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
  min?: string; // YYYY-MM-DD
  disabled?: boolean;
  /** Tampilkan tombol "Hari ini" */
  todayButton?: boolean;
}

/**
 * Date picker dengan kalender custom — ringan, tanpa dependency.
 * Mengembalikan string ISO (YYYY-MM-DD). Kosong = belum dipilih.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  clearable = false,
  min,
  disabled,
  todayButton = true,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;

  // Bulan yang sedang ditampilkan di kalender
  const [view, setView] = useState<Date>(() => selected || new Date());
  useEffect(() => {
    if (open) setView(selected || new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const grid = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    // offset Senin = 0
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const todayISO = toISO(new Date());

  function pick(d: Date) {
    if (minDate && d < minDate) return;
    onChange(toISO(d));
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`input flex items-center justify-between gap-2 text-left ${disabled ? 'bg-sf2 cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      >
        <span className={value ? 'text-tx' : 'text-tx3'}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-tx3 flex-shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-[60] mt-1 w-[260px] bg-sf border border-bd rounded-lg shadow-lg p-2.5 left-0">
          {/* Header bulan */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="w-7 h-7 grid place-items-center rounded-md hover:bg-sf2 text-tx2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className="text-xs font-bold text-tx">{MONTHS[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="w-7 h-7 grid place-items-center rounded-md hover:bg-sf2 text-tx2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          {/* Hari */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW.map((d) => (
              <div key={d} className="text-[10px] font-semibold text-tx3 text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = toISO(d);
              const isSel = iso === value;
              const isToday = iso === todayISO;
              const isDisabled = !!(minDate && d < minDate);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(d)}
                  className={
                    'h-8 rounded-md text-xs font-medium tabular-nums transition-colors ' +
                    (isSel
                      ? 'bg-ac text-inv font-bold'
                      : isDisabled
                        ? 'text-tx3/40 cursor-not-allowed'
                        : isToday
                          ? 'bg-sf2 text-ac font-bold hover:bg-bd'
                          : 'text-tx hover:bg-sf2')
                  }
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Aksi cepat */}
          {(todayButton || clearable) && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-bd">
              {todayButton ? (
                <button type="button" onClick={() => pick(new Date())} className="text-[11px] font-semibold text-ac hover:underline">
                  Hari ini
                </button>
              ) : <span />}
              {clearable && value && (
                <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-[11px] font-semibold text-tx3 hover:text-rd">
                  Hapus
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
