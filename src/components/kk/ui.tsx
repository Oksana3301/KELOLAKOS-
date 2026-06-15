'use client';

// KelolaKos · design-system primitives (ported from app/ui.jsx).
// Big touch targets, navy-on-light, line icons + text. Elderly-friendly.

import { useEffect } from 'react';
import { KkIcon } from './icons';
import { PAY_BADGE, ROOM_BADGE, type PayStatus, type RoomDisplayStatus } from './status';
import { cn } from '@/lib/utils';

// ───────────────────────── Button ─────────────────────────
type BtnVariant = 'primary' | 'success' | 'secondary' | 'ghost';

interface KkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'md' | 'lg';
  block?: boolean;
}

const VARIANT_CLASS: Record<BtnVariant, string> = {
  primary: 'kk-btn-primary',
  success: 'kk-btn-success',
  secondary: 'kk-btn-secondary',
  ghost: 'kk-btn-ghost',
};

export function KkButton({
  variant = 'primary',
  size = 'md',
  block,
  className,
  children,
  type = 'button',
  ...rest
}: KkButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'kk-btn',
        VARIANT_CLASS[variant],
        size === 'lg' && 'kk-btn-lg',
        block && 'kk-btn-block',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ───────────────────────── Card ─────────────────────────
interface KkCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'plain' | 'mint' | 'mauve';
}

export function KkCard({ tone = 'plain', className, children, ...rest }: KkCardProps) {
  return (
    <div
      className={cn(
        'kk-card',
        tone === 'mint' && 'kk-card-mint',
        tone === 'mauve' && 'kk-card-mauve',
        rest.onClick && 'cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ───────────────────────── Payment badge ─────────────────────────
export function BayarBadge({ status, big }: { status: PayStatus; big?: boolean }) {
  const s = PAY_BADGE[status];
  return (
    <span className={cn('kk-badge', s.bg, s.fg, big && 'text-body px-4 py-2')}>
      <span className={cn('rounded-full', s.dot, big ? 'w-3 h-3' : 'w-2.5 h-2.5')} />
      {status}
    </span>
  );
}

export function RoomBadge({ status }: { status: RoomDisplayStatus }) {
  const s = ROOM_BADGE[status];
  return (
    <span className={cn('kk-badge', s.bg, s.fg)}>
      <span className={cn('rounded-full w-2.5 h-2.5', s.dot)} />
      {status}
    </span>
  );
}

// ───────────────────────── Screen header + help "?" ─────────────────────────
export function ScreenHead({
  title,
  sub,
  onHelp,
}: {
  title: string;
  sub?: string;
  onHelp?: () => void;
}) {
  return (
    <div className="flex justify-between items-start gap-3 mb-6">
      <div>
        <h1 className="font-heading font-bold text-page text-kk-navy m-0 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-2 text-body text-kk-ink m-0">{sub}</p>}
      </div>
      {onHelp && (
        <button
          onClick={onHelp}
          aria-label="Bantuan"
          className="flex-shrink-0 w-12 h-12 rounded-full bg-kk-mint-soft border-2 border-kk-mint text-kk-navy font-heading font-black text-[22px] grid place-items-center cursor-pointer"
        >
          ?
        </button>
      )}
    </div>
  );
}

// ───────────────────────── Bottom sheet ─────────────────────────
export function Sheet({
  open,
  onClose,
  children,
  maxH = '88%',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxH?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(12,44,71,.45)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-kk-paper w-full max-w-kk-sheet rounded-t-[26px] overflow-y-auto animate-kkSlideUp shadow-[0_-10px_40px_rgba(12,44,71,.25)]"
        style={{ maxHeight: maxH }}
      >
        <div className="flex justify-center pt-3">
          <div className="w-12 h-[5px] rounded-full bg-kk-mauve" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ───────────────────────── Center dialog ─────────────────────────
export function Dialog({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-5"
      style={{ background: 'rgba(12,44,71,.5)' }}
    >
      <div className="bg-white w-full max-w-[460px] rounded-[22px] p-7 animate-kkPopIn border-2 border-kk-mauve">
        {children}
      </div>
    </div>
  );
}

// ───────────────────────── Info row ─────────────────────────
export function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: 'green' | 'orange' | 'navy';
}) {
  const accentClass =
    accent === 'green' ? 'text-kk-green' : accent === 'orange' ? 'text-kk-orange' : 'text-kk-navy';
  return (
    <div className="flex justify-between items-baseline gap-3 py-2.5 border-b border-kk-mauve-soft">
      <span className="text-body text-kk-ink">{label}</span>
      <span className={cn('font-heading font-bold text-[19px] text-right', accentClass)}>{value}</span>
    </div>
  );
}

// ───────────────────────── Sticky CTA wrapper ─────────────────────────
export function StickyCTA({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('sticky top-0 z-[25] bg-kk-paper pt-1.5 pb-3.5 mb-1.5', className)}>
      {children}
    </div>
  );
}

// ───────────────────────── Sheet header (icon + title + Pemasukan/Pengeluaran tag) ─────────────────────────
export function SheetHead({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-4 pb-2">
      <div>
        <h2 className="font-heading font-bold text-subhead text-kk-navy m-0">{title}</h2>
        {children}
      </div>
      <button
        onClick={onClose}
        aria-label="Tutup"
        className="flex-shrink-0 w-11 h-11 rounded-full bg-white border-2 border-kk-mauve text-kk-navy grid place-items-center cursor-pointer"
      >
        <KkIcon name="silang" size={22} />
      </button>
    </div>
  );
}
