'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearStoredAccessCode } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { href: '/', label: 'Beranda', match: (p: string) => p === '/' },
  { href: '/kamar', label: 'Kamar', match: (p: string) => p.startsWith('/kamar') },
  { href: '/booking', label: 'Booking', match: (p: string) => p.startsWith('/booking') },
  { href: '/keuangan', label: 'Keuangan', match: (p: string) => p.startsWith('/keuangan') },
  { href: '/laporan', label: 'Laporan', match: (p: string) => p.startsWith('/laporan') },
  { href: '/setting', label: 'Setting', match: (p: string) => p.startsWith('/setting') || p.startsWith('/kwitansi') || p.startsWith('/layout3d') },
];

interface TopbarProps {
  /** Optional right-side action button */
  action?: React.ReactNode;
}

export function Topbar({ action }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    if (confirm('Logout dari Top Hills & Co? Lo perlu input access code lagi setelah ini.')) {
      clearStoredAccessCode();
      toast.success('Logout berhasil');
      setTimeout(() => router.refresh(), 500);
      setTimeout(() => window.location.reload(), 800);
    }
  }

  return (
    <header className="sticky top-3 z-30 mb-4 print:hidden">
      <div className="bg-sf border border-bd rounded-lg shadow-xs px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-5">
        {/* Brand */}
        <div className="flex items-center gap-3 pr-4 border-r border-bd">
          <div className="w-9 h-9 rounded-md bg-ac text-inv grid place-items-center font-extrabold text-lg">
            T
          </div>
          <div className="hidden sm:block">
            <div className="font-bold text-sm leading-tight">{'Top Hills & Co'}</div>
            <div className="text-tx3 text-[11px] font-medium mt-0.5">Property OS</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex gap-0.5 p-0.5 bg-sf2 rounded-md w-fit mx-auto overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={
                    active
                      ? 'border-0 bg-sf text-tx px-3 py-1.5 text-[13px] font-semibold rounded-sm cursor-pointer shadow-xs whitespace-nowrap'
                      : 'border-0 bg-transparent text-tx3 px-3 py-1.5 text-[13px] font-semibold rounded-sm cursor-pointer hover:text-tx hover:bg-white/60 transition-colors whitespace-nowrap'
                  }
                >
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-sf2 border border-bd rounded-full text-[11px] font-semibold text-tx3">
            <span className="w-1.5 h-1.5 rounded-full bg-gr shadow-[0_0_0_2px_#DCFCE7]" />
            Sinkron
          </div>
          {action}
          <button
            onClick={handleLogout}
            className="text-tx3 hover:text-rd p-1.5 transition-colors"
            title="Logout (clear access code)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
