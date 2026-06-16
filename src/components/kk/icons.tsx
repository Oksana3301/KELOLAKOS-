'use client';

// KelolaKos line-icon set — 24×24, currentColor, ~2px stroke. No emoji.
// Ported from design_handoff_kelolakos/app/ui.jsx → LineIcon.

export type KkIconName =
  | 'beranda'
  | 'booking'
  | 'kamar'
  | 'uang'
  | 'lainnya'
  | 'laporan'
  | 'kwitansi'
  | 'layout'
  | 'setting'
  | 'properti'
  | 'fasilitas'
  | 'akun'
  | 'bantuan'
  | 'masuk'
  | 'keluar'
  | 'hapus'
  | 'cek'
  | 'logout'
  | 'chevron'
  | 'kalender'
  | 'kirim'
  | 'unduh'
  | 'refund'
  | 'pembayaran'
  | 'belanja'
  | 'info'
  | 'bahasa'
  | 'teks'
  | 'toko'
  | 'harga'
  | 'massal'
  | 'silang'
  | 'panahAtas'
  | 'tambah'
  | 'muat'
  | 'cari';

interface KkIconProps {
  name: KkIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function KkIcon({ name, size = 26, className, strokeWidth = 2 }: KkIconProps) {
  const p = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const sets: Record<KkIconName, React.ReactNode> = {
    beranda: (
      <>
        <path {...p} d="M3 11l9-7 9 7" />
        <path {...p} d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      </>
    ),
    booking: (
      <>
        <rect {...p} x="3" y="5" width="18" height="16" rx="2" />
        <path {...p} d="M3 9.5h18M8 3v4M16 3v4" />
      </>
    ),
    kamar: (
      <>
        <path {...p} d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
        <path {...p} d="M3 18h18M6 10V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3" />
      </>
    ),
    uang: (
      <>
        <rect {...p} x="2" y="6" width="20" height="12" rx="2" />
        <circle {...p} cx="12" cy="12" r="2.6" />
        <path {...p} d="M6 9.5v5M18 9.5v5" />
      </>
    ),
    lainnya: (
      <>
        <circle {...p} cx="5" cy="12" r="1.6" />
        <circle {...p} cx="12" cy="12" r="1.6" />
        <circle {...p} cx="19" cy="12" r="1.6" />
      </>
    ),
    laporan: (
      <>
        <rect {...p} x="3" y="13" width="4.5" height="7" rx="1.2" />
        <rect {...p} x="9.7" y="8" width="4.5" height="12" rx="1.2" />
        <rect {...p} x="16.5" y="4" width="4.5" height="16" rx="1.2" />
      </>
    ),
    kwitansi: (
      <>
        <path {...p} d="M6 3h12v18l-2.5-1.7L13 21l-2.5-1.7L8 21l-2-1.7L6 3z" />
        <path {...p} d="M9.5 8.5h5M9.5 12.5h5" />
      </>
    ),
    layout: (
      <>
        <rect {...p} x="3" y="3" width="18" height="18" rx="2.5" />
        <path {...p} d="M3 9.5h18M9.5 9.5V21" />
      </>
    ),
    setting: (
      <>
        <path {...p} d="M4 7h16M4 12h16M4 17h16" />
        <circle {...p} cx="9" cy="7" r="2.1" />
        <circle {...p} cx="15" cy="12" r="2.1" />
        <circle {...p} cx="8" cy="17" r="2.1" />
      </>
    ),
    properti: (
      <>
        <path {...p} d="M3 11l9-7 9 7" />
        <path {...p} d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      </>
    ),
    fasilitas: (
      <>
        <rect {...p} x="3" y="3" width="7" height="7" rx="1.6" />
        <rect {...p} x="14" y="3" width="7" height="7" rx="1.6" />
        <rect {...p} x="3" y="14" width="7" height="7" rx="1.6" />
        <rect {...p} x="14" y="14" width="7" height="7" rx="1.6" />
      </>
    ),
    akun: (
      <>
        <circle {...p} cx="12" cy="8" r="4" />
        <path {...p} d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    bantuan: <path {...p} d="M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />,
    masuk: <path {...p} d="M12 5v14M12 19l-5-5M12 19l5-5" />,
    keluar: <path {...p} d="M12 19V5M12 5l-5 5M12 5l5 5" />,
    hapus: <path {...p} d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13" />,
    cek: (
      <>
        <circle {...p} cx="12" cy="12" r="9" />
        <path {...p} d="M8 12.5l2.5 2.5L16 9" />
      </>
    ),
    logout: <path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
    chevron: <path {...p} d="M9 6l6 6-6 6" />,
    kalender: (
      <>
        <rect {...p} x="3" y="5" width="18" height="16" rx="2" />
        <path {...p} d="M3 9.5h18M8 3v4M16 3v4" />
      </>
    ),
    kirim: (
      <>
        <path {...p} d="M21 3L10 14" />
        <path {...p} d="M21 3l-7 18-4-8-8-4 19-6z" />
      </>
    ),
    unduh: <path {...p} d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
    refund: (
      <>
        <path {...p} d="M3 12a9 9 0 1 0 2.6-6.3" />
        <path {...p} d="M3 4v4h4" />
      </>
    ),
    pembayaran: (
      <>
        <rect {...p} x="2" y="6" width="20" height="12" rx="2" />
        <circle {...p} cx="12" cy="12" r="2.6" />
        <path {...p} d="M6 9.5v5M18 9.5v5" />
      </>
    ),
    belanja: (
      <>
        <path {...p} d="M6 8h12l-1.2 11.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L6 8z" />
        <path {...p} d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
    info: (
      <>
        <circle {...p} cx="12" cy="12" r="9" />
        <path {...p} d="M12 11v5M12 7.6h.01" />
      </>
    ),
    bahasa: (
      <>
        <circle {...p} cx="12" cy="12" r="9" />
        <path {...p} d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
      </>
    ),
    teks: (
      <>
        <path {...p} d="M4 8V6h10v2M9 18h2M9 6v12" />
        <path {...p} d="M15 18l2-6 2 6M15.6 16h2.8" />
      </>
    ),
    toko: (
      <>
        <path {...p} d="M4 9l1.2-4h13.6L20 9M5 9v10h14V9M5 9h14" />
        <path {...p} d="M10 19v-5h4v5" />
      </>
    ),
    harga: (
      <>
        <path {...p} d="M4 4h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-4.8 4.8a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 4 10.8V4z" />
        <circle {...p} cx="8.5" cy="8.5" r="1.4" />
      </>
    ),
    massal: (
      <>
        <path {...p} d="M12 3l9 5-9 5-9-5 9-5z" />
        <path {...p} d="M3 13l9 5 9-5" />
      </>
    ),
    silang: (
      <>
        <circle {...p} cx="12" cy="12" r="9" />
        <path {...p} d="M9 9l6 6M15 9l-6 6" />
      </>
    ),
    panahAtas: <path {...p} d="M12 20V5M6 11l6-6 6 6" />,
    tambah: <path {...p} d="M12 5v14M5 12h14" />,
    muat: (
      <>
        <path {...p} d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path {...p} d="M21 3v6h-6" />
      </>
    ),
    cari: (
      <>
        <circle {...p} cx="11" cy="11" r="7" />
        <path {...p} d="M21 21l-4.3-4.3" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {sets[name]}
    </svg>
  );
}
