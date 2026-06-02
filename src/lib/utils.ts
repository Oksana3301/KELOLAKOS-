/**
 * Utility helpers — formatting, status mapping
 */

export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

export function formatRupiahShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}rb`;
  return `Rp ${amount}`;
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function formatDateShort(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

/**
 * Map status code to badge color + emoji
 */
export function getStatusStyle(statusCode: string): {
  badgeClass: string;
  emoji: string;
  label: string;
} {
  const map: Record<string, { badgeClass: string; emoji: string; label: string }> = {
    READY: { badgeClass: 'badge-green', emoji: '🟢', label: 'Tersedia' },
    AKTIF_DP: { badgeClass: 'badge-blue', emoji: '🔵', label: 'DP / Parsial' },
    AKTIF_LUNAS: { badgeClass: 'badge-violet', emoji: '🟣', label: 'Aktif Lunas' },
    BELUM_BAYAR: { badgeClass: 'badge-amber', emoji: '🟡', label: 'Belum Bayar' },
    LEWAT_CHECKOUT: { badgeClass: 'badge-red', emoji: '🔴', label: 'Lewat Checkout' },
  };
  return map[statusCode] || { badgeClass: 'badge-green', emoji: '⚪', label: statusCode };
}

/**
 * Status code → border-left color (for kamar cards)
 */
export function getStatusBorderColor(statusCode: string): string {
  const map: Record<string, string> = {
    READY: '#15803D',
    AKTIF_DP: '#1D4ED8',
    AKTIF_LUNAS: '#6D28D9',
    BELUM_BAYAR: '#B45309',
    LEWAT_CHECKOUT: '#B91C1C',
  };
  return map[statusCode] || '#D6D3D1';
}

/**
 * Get day count between 2 dates
 */
export function getDaysBetween(start: string | Date, end: string | Date): number {
  try {
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

/**
 * Combine class names (lightweight clsx alternative)
 */
export function cn(...classes: (string | null | undefined | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
