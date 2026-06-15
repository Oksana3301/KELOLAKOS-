// ===== KelolaKos · Komponen UI dasar =====
const { useState, useEffect, useRef } = React;

// ---- Tombol ----
function Btn({ variant = 'primary', size = 'md', block, children, onClick, style, type }) {
  const base = {
    fontFamily: 'var(--body)', fontWeight: 600, cursor: 'pointer',
    display: block ? 'flex' : 'inline-flex', width: block ? '100%' : 'auto',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    border: '2px solid transparent', borderRadius: 14,
    minHeight: size === 'lg' ? 64 : 56, fontSize: size === 'lg' ? 21 : 19,
    padding: size === 'lg' ? '0 30px' : '0 26px',
    transition: 'transform .1s ease, background .12s ease', lineHeight: 1.1,
  };
  const variants = {
    primary:   { background: 'var(--orange)', color: '#fff', boxShadow: '0 4px 0 #8F3C20' },
    success:   { background: 'var(--green)',  color: '#fff', boxShadow: '0 4px 0 #1F3D32' },
    secondary: { background: '#fff', color: 'var(--navy)', borderColor: 'var(--navy)' },
    ghost:     { background: 'transparent', color: 'var(--navy)', borderColor: 'var(--mauve)' },
  };
  return (
    <button type={type || 'button'} onClick={onClick}
      onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
      onMouseUp={e => e.currentTarget.style.transform = ''}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
      style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// ---- Badge status pembayaran ----
function BayarBadge({ status, big }) {
  const s = window.BAYAR_STYLE[status] || { bg: 'var(--mint)', fg: 'var(--navy)', dot: 'var(--navy)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: s.bg, color: s.fg,
      fontFamily: 'var(--body)', fontWeight: 600, fontSize: big ? 18 : 16,
      padding: big ? '8px 16px' : '6px 13px', borderRadius: 999 }}>
      <span style={{ width: big ? 11 : 9, height: big ? 11 : 9, borderRadius: '50%', background: s.dot }} />
      {status}
    </span>
  );
}

// ---- Kartu ----
function Card({ children, style, onClick, tone }) {
  const tones = {
    mint:  { background: 'var(--mint-soft)', borderColor: 'var(--mint)' },
    mauve: { background: 'var(--mauve-soft)', borderColor: 'var(--mauve)' },
    plain: { background: '#fff', borderColor: 'var(--mauve)' },
  };
  return (
    <div onClick={onClick} style={{ background: '#fff', border: '2px solid var(--mauve)', borderRadius: 'var(--card-radius)',
      padding: 22, ...(tones[tone] || {}), cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  );
}

// ---- Judul layar + tombol bantuan ----
function ScreenHead({ title, sub, onHelp }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 32, margin: 0, color: 'var(--navy)', lineHeight: 1.05 }}>{title}</h1>
        {sub && <p style={{ margin: '8px 0 0', fontSize: 18, color: 'var(--ink-soft)' }}>{sub}</p>}
      </div>
      <button onClick={onHelp} aria-label="Bantuan" style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%',
        background: 'var(--mint-soft)', border: '2px solid var(--mint)', color: 'var(--navy)',
        fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 22, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>?</button>
    </div>
  );
}

// ---- Sheet / modal dari bawah ----
function Sheet({ open, onClose, children, maxH = '88%' }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(12,44,71,.45)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper)', width: '100%', maxWidth: 640, maxHeight: maxH,
        borderTopLeftRadius: 26, borderTopRightRadius: 26, overflowY: 'auto', animation: 'slideUp .26s cubic-bezier(.2,.8,.2,1)',
        boxShadow: '0 -10px 40px rgba(12,44,71,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 48, height: 5, borderRadius: 999, background: 'var(--mauve)' }} />
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Dialog tengah (konfirmasi) ----
function Dialog({ open, children }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(12,44,71,.5)',
      display: 'grid', placeItems: 'center', padding: 22 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 460, borderRadius: 22, padding: 28,
        animation: 'popIn .22s cubic-bezier(.2,.8,.2,1)', border: '2px solid var(--mauve)' }}>
        {children}
      </div>
    </div>
  );
}

// ---- Baris info label/nilai ----
function InfoRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--mauve-soft)' }}>
      <span style={{ fontSize: 18, color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 19, color: accent || 'var(--navy)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ---- Ikon garis (selaras dengan navigasi) ----
function LineIcon({ name, size = 26, color = 'currentColor', sw = 2 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const sets = {
    laporan:  <><rect {...p} x="3" y="13" width="4.5" height="7" rx="1.2"/><rect {...p} x="9.7" y="8" width="4.5" height="12" rx="1.2"/><rect {...p} x="16.5" y="4" width="4.5" height="16" rx="1.2"/></>,
    kwitansi: <><path {...p} d="M6 3h12v18l-2.5-1.7L13 21l-2.5-1.7L8 21l-2-1.7L6 3z"/><path {...p} d="M9.5 8.5h5M9.5 12.5h5"/></>,
    layout:   <><rect {...p} x="3" y="3" width="18" height="18" rx="2.5"/><path {...p} d="M3 9.5h18M9.5 9.5V21"/></>,
    setting:  <><path {...p} d="M4 7h16M4 12h16M4 17h16"/><circle {...p} cx="9" cy="7" r="2.1"/><circle {...p} cx="15" cy="12" r="2.1"/><circle {...p} cx="8" cy="17" r="2.1"/></>,
    properti: <><path {...p} d="M3 11l9-7 9 7"/><path {...p} d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/></>,
    kamar:    <><path {...p} d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path {...p} d="M3 18h18M6 10V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3"/></>,
    fasilitas:<><rect {...p} x="3" y="3" width="7" height="7" rx="1.6"/><rect {...p} x="14" y="3" width="7" height="7" rx="1.6"/><rect {...p} x="3" y="14" width="7" height="7" rx="1.6"/><rect {...p} x="14" y="14" width="7" height="7" rx="1.6"/></>,
    akun:     <><circle {...p} cx="12" cy="8" r="4"/><path {...p} d="M5 20a7 7 0 0 1 14 0"/></>,
    bantuan:  <><path {...p} d="M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></>,
    masuk:    <><path {...p} d="M12 5v14M12 19l-5-5M12 19l5-5"/></>,
    keluar:   <><path {...p} d="M12 19V5M12 5l-5 5M12 5l5 5"/></>,
    hapus:    <><path {...p} d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13"/></>,
    cek:      <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M8 12.5l2.5 2.5L16 9"/></>,
    logout:   <><path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
    chevron:  <><path {...p} d="M9 6l6 6-6 6"/></>,
    kalender: <><rect {...p} x="3" y="5" width="18" height="16" rx="2"/><path {...p} d="M3 9.5h18M8 3v4M16 3v4"/></>,
    kirim:    <><path {...p} d="M21 3L10 14"/><path {...p} d="M21 3l-7 18-4-8-8-4 19-6z"/></>,
    unduh:    <><path {...p} d="M12 4v11M7 11l5 5 5-5M5 20h14"/></>,
    refund:   <><path {...p} d="M3 12a9 9 0 1 0 2.6-6.3"/><path {...p} d="M3 4v4h4"/></>,
    pembayaran: <><rect {...p} x="2" y="6" width="20" height="12" rx="2"/><circle {...p} cx="12" cy="12" r="2.6"/><path {...p} d="M6 9.5v5M18 9.5v5"/></>,
    belanja:  <><path {...p} d="M6 8h12l-1.2 11.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L6 8z"/><path {...p} d="M9 8a3 3 0 0 1 6 0"/></>,
    info:     <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 11v5M12 7.6h.01"/></>,
    bahasa:   <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z"/></>,
    teks:     <><path {...p} d="M4 8V6h10v2M9 18h2M9 6v12"/><path {...p} d="M15 18l2-6 2 6M15.6 16h2.8"/></>,
    toko:     <><path {...p} d="M4 9l1.2-4h13.6L20 9M5 9v10h14V9M5 9h14"/><path {...p} d="M10 19v-5h4v5"/></>,
    harga:    <><path {...p} d="M4 4h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-4.8 4.8a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 4 10.8V4z"/><circle {...p} cx="8.5" cy="8.5" r="1.4"/></>,
    massal:   <><path {...p} d="M12 3l9 5-9 5-9-5 9-5z"/><path {...p} d="M3 13l9 5 9-5"/></>,
    silang:   <><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M9 9l6 6M15 9l-6 6"/></>,
    panahAtas:<><path {...p} d="M12 20V5M6 11l6-6 6 6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24">{sets[name]}</svg>;
}

// ---- Pembungkus CTA yang menempel di atas (selalu terlihat tanpa scroll) ----
function StickyCTA({ children, style }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 25, background: 'var(--paper)', paddingTop: 6, paddingBottom: 14, marginBottom: 6, ...style }}>
      {children}
    </div>
  );
}

Object.assign(window, { Btn, BayarBadge, Card, ScreenHead, Sheet, Dialog, InfoRow, LineIcon, StickyCTA });
