'use client';

// KelolaKos · MoneyInput — a number field that shows Indonesian thousand
// separators (titik) while you type: 2000000 → "2.000.000". Keeps the parsing
// simple (digits only) and always reports a plain number to the parent.

import { cn } from '@/lib/utils';

const idFmt = new Intl.NumberFormat('id-ID');

/** Format a number/numeric-string with "." thousand separators; "" when empty. */
export function formatThousands(value: number | string | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9]/g, ''));
  if (!n) return '';
  return idFmt.format(n);
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
  prefix = true,
  autoFocus,
}: {
  /** Current numeric value (number, or numeric string). */
  value: number | string;
  /** Reports the raw number (0 when cleared). */
  onChange: (n: number) => void;
  placeholder?: string;
  /** Override the input class (defaults to the KK input style). */
  className?: string;
  /** Show the "Rp" prefix inside the field. */
  prefix?: boolean;
  autoFocus?: boolean;
}) {
  const display = formatThousands(value);
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-kk-ink font-semibold pointer-events-none">
          Rp
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
        className={cn(className || 'kk-input', 'tabular-nums', prefix && 'pl-12')}
      />
    </div>
  );
}
