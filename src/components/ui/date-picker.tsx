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

type Variant = 'default' | 'kk';

// Tema kelas per variant. 'kk' = design-system Top Hills (elderly-friendly).
const THEME: Record<Variant, {
  trigger: string; triggerDisabled: string; placeholder: string; value: string; chevron: string;
  panel: string; navBtn: string; header: string; dow: string;
  daySel: string; dayToday: string; dayBase: string; dayDisabled: string;
  today: string; clear: string; divider: string;
}> = {
  default: {
    trigger: 'input flex items-center justify-between gap-2 text-left cursor-pointer',
    triggerDisabled: 'input flex items-center justify-between gap-2 text-left bg-sf2 cursor-not-allowed opacity-70',
    placeholder: 'text-tx3', value: 'text-tx', chevron: 'text-tx3',
    panel: 'bg-sf border border-bd rounded-lg shadow-lg',
    navBtn: 'hover:bg-sf2 text-tx2', header: 'text-tx', dow: 'text-tx3',
    daySel: 'bg-ac text-inv font-bold', dayToday: 'bg-sf2 text-ac font-bold hover:bg-bd',
    dayBase: 'text-tx hover:bg-sf2', dayDisabled: 'text-tx3/40 cursor-not-allowed',
    today: 'text-ac', clear: 'text-tx3 hover:text-rd', divider: 'border-bd',
  },
  kk: {
    trigger: 'kk-input flex items-center justify-between gap-2 text-left cursor-pointer',
    triggerDisabled: 'kk-input flex items-center justify-between gap-2 text-left opacity-60 cursor-not-allowed',
    placeholder: 'text-kk-ink', value: 'text-kk-navy font-semibold', chevron: 'text-kk-ink',
    panel: 'bg-white border-2 border-kk-mauve rounded-kk-card shadow-lg',
    navBtn: 'hover:bg-kk-paper text-kk-navy', header: 'text-kk-navy', dow: 'text-kk-ink',
    daySel: 'bg-kk-navy text-white font-bold', dayToday: 'text-kk-orange font-bold hover:bg-kk-paper',
    dayBase: 'text-kk-navy hover:bg-kk-paper', dayDisabled: 'text-kk-ink/40 cursor-not-allowed',
    today: 'text-kk-navy', clear: 'text-kk-ink hover:text-kk-orange', divider: 'border-kk-mauve',
  },
};

interface DatePickerProps {
  value: string; // YYYY-MM-DD | ''
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
  min?: string; // YYYY-MM-DD
  disabled?: boolean;
  /** Tampilkan tombol "Hari ini" */
  todayButton?: boolean;
  variant?: Variant;
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
  variant = 'default',
}: DatePickerProps) {
  const t = THEME[variant];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;

  const [view, setView] = useState<Date>(() => selected || new Date());
  useEffect(() => {
    if (open) setView(selected || new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    const offset = (first.getDay() + 6) % 7; // Senin = 0
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
        className={disabled ? t.triggerDisabled : t.trigger}
      >
        <span className={value ? t.value : t.placeholder}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${t.chevron} flex-shrink-0`}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-[60] mt-1 w-[260px] p-2.5 left-0 ${t.panel}`}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className={`w-7 h-7 grid place-items-center rounded-md ${t.navBtn}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className={`text-xs font-bold ${t.header}`}>{MONTHS[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className={`w-7 h-7 grid place-items-center rounded-md ${t.navBtn}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW.map((d) => (
              <div key={d} className={`text-[10px] font-semibold text-center py-1 ${t.dow}`}>{d}</div>
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
                    (isSel ? t.daySel : isDisabled ? t.dayDisabled : isToday ? t.dayToday : t.dayBase)
                  }
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {(todayButton || clearable) && (
            <div className={`flex items-center justify-between mt-2 pt-2 border-t ${t.divider}`}>
              {todayButton ? (
                <button type="button" onClick={() => pick(new Date())} className={`text-[11px] font-semibold hover:underline ${t.today}`}>
                  Hari ini
                </button>
              ) : <span />}
              {clearable && value && (
                <button type="button" onClick={() => { onChange(''); setOpen(false); }} className={`text-[11px] font-semibold ${t.clear}`}>
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
