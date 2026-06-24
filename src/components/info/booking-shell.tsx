'use client';

import Link from 'next/link';
import { TH, TH_SERIF, TH_BODY } from '@/lib/tophills-theme';

// Shell standalone untuk halaman publik /info/booking/* (di luar app gate).
export function BookingShell({ children, back }: { children: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div style={{ background: TH.cream, fontFamily: TH_BODY, color: TH.brown }} className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur" style={{ background: 'rgba(244,236,221,0.92)', borderBottom: `1px solid ${TH.border}` }}>
        <div className="mx-auto max-w-[680px] px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/info" className="flex items-center gap-2.5 no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/invoice/logo-mark.png" alt="Top Hills" style={{ height: 36, width: 'auto', display: 'block' }} />
            <span style={{ fontFamily: TH_SERIF, color: TH.gold }} className="text-[18px] font-semibold tracking-[0.14em]">TOP HILLS</span>
          </Link>
          {back && (
            <Link href={back.href} className="text-[13px] font-semibold no-underline" style={{ color: TH.brownSoft }}>
              ‹ {back.label}
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[680px] px-4 py-7 pb-16">
        {children}
        <div className="text-center mt-9 pt-5" style={{ borderTop: `1px solid ${TH.border}` }}>
          <a
            href={`https://wa.me/628116646615?text=${encodeURIComponent('Halo Top Hills 🌸, saya butuh bantuan soal booking online.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-semibold no-underline"
            style={{ color: TH.brownSoft }}
          >
            Kesulitan mengisi? 💬 Chat Helpdesk Top Hills
          </a>
        </div>
      </main>
    </div>
  );
}

export function THCard({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={'rounded-[18px] p-5 ' + className} style={{ background: TH.card, border: `1px solid ${TH.border}`, ...style }}>
      {children}
    </div>
  );
}

export function THBtn({ children, onClick, href, variant = 'primary', block, disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'ghost' | 'gold'; block?: boolean; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[14px] font-bold text-[15px] no-underline transition-colors min-h-[50px] px-5 cursor-pointer';
  const styles: React.CSSProperties =
    variant === 'primary'
      ? { background: TH.gold, color: '#FBF7EC', border: `1px solid ${TH.gold}` }
      : variant === 'gold'
        ? { background: 'linear-gradient(135deg,#B98C34,#8A6A24)', color: '#fff', border: 'none' }
        : { background: 'transparent', color: TH.brown, border: `1.5px solid ${TH.border}` };
  const cls = base + (block ? ' w-full' : '') + (disabled ? ' opacity-50 pointer-events-none' : '');
  if (href && !disabled) return <Link href={href} className={cls} style={styles}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls} style={styles}>{children}</button>;
}

export function THField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold mb-1.5" style={{ color: TH.brown }}>{label}</span>
      {children}
      {error ? (
        <span className="block text-[12px] mt-1" style={{ color: TH.danger }}>{error}</span>
      ) : hint ? (
        <span className="block text-[12px] mt-1" style={{ color: TH.brownSoft }}>{hint}</span>
      ) : null}
    </label>
  );
}

export function THInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={'w-full min-h-[48px] rounded-[12px] px-3.5 text-[15px] outline-none ' + (props.className || '')}
      style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown, ...props.style }}
    />
  );
}

export function THSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={'w-full min-h-[48px] rounded-[12px] px-3.5 text-[15px] outline-none ' + (props.className || '')}
      style={{ background: '#fff', border: `1.5px solid ${TH.border}`, color: TH.brown, ...props.style }}
    />
  );
}

// Layar sukses setelah submit booking publik (Baru / Perpanjang).
export function BookingDone({ nama, demo }: { nama?: string; demo?: boolean }) {
  const waResmi = '628116646615'; // WA resmi Top Hills
  const msg = `Halo Top Hills 🌸, saya baru kirim permintaan booking${nama ? ' atas nama ' + nama : ''}. Mohon dikonfirmasi & detail pembayarannya ya 🙏`;
  return (
    <div className="text-center pt-3">
      <div className="text-[56px] leading-none">✅</div>
      <h1 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[28px] font-bold mt-2 mb-2">Permintaan Terkirim!</h1>
      <p className="text-[14.5px] leading-relaxed mb-4" style={{ color: TH.brownSoft }}>
        Tim Top Hills akan menghubungimu lewat <b style={{ color: TH.brown }}>WhatsApp</b> untuk konfirmasi data &amp; detail pembayaran.
        Booking aktif <b style={{ color: TH.brown }}>setelah pembayaran dikonfirmasi</b> ya 🌸
      </p>
      {demo && (
        <div className="text-[11.5px] rounded-full px-3 py-1.5 inline-block mb-4" style={{ background: '#FBF1D8', color: '#8A6A24', border: '1px solid #E7D3A0' }}>
          ⚙️ Mode demo — backend submit belum di-deploy
        </div>
      )}
      <div className="space-y-3 mt-2">
        <a href={`https://wa.me/${waResmi}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] font-bold text-[15px] no-underline min-h-[50px] px-5"
          style={{ background: 'linear-gradient(135deg,#B98C34,#8A6A24)', color: '#fff' }}>
          💬 Chat Top Hills sekarang
        </a>
        <THBtn variant="ghost" href="/info" block>Kembali ke beranda</THBtn>
      </div>
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[28px] font-bold leading-tight m-0">{children}</h1>
      {sub && <p className="text-[14px] mt-1.5 m-0" style={{ color: TH.brownSoft }}>{sub}</p>}
    </div>
  );
}
